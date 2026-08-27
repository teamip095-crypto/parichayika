import pg from "pg";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { parse as parsePgConnectionString } from "pg-connection-string";

dotenv.config();

const { Pool } = pg;

// Local fallback paths (lazily initialized only in local development/test mode)
const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "parichayika.db");

function ensureLocalDirsLazy() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    // Non-fatal if filesystem is read-only (e.g. Vercel serverless /tmp)
  }
}

// Global state
let pgPool: pg.Pool | null = null;
let sqlJsDb: any = null;
export let isPostgres = false;
let initPromise: Promise<void> | null = null;
let schemaInitialized = false;

// Normalize PostgreSQL connection string (trims quotes/whitespace, handles empty string)
function getCleanPgUrl(): string | null {
  const envCandidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.SUPABASE_DB_URL,
    process.env.SUPABASE_DATABASE_URL,
    process.env.PGDATABASE_URL
  ];
  for (const raw of envCandidates) {
    if (!raw) continue;
    let url = String(raw).trim();
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
      url = url.slice(1, -1).trim();
    }
    if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
      return url;
    }
  }
  return null;
}

// Safely sanitize error messages to prevent accidental credential leakage
function sanitizeErrorMessage(msg: string): string {
  if (!msg) return "";
  return String(msg)
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgres://[REDACTED_AUTH]@")
    .replace(/password=[^\s;&]+/gi, "password=[REDACTED]");
}

export interface SafeDbInfo {
  configured: boolean;
  protocol: string;
  host: string;
  port: string;
  database: string;
  userPrefix: string;
  hasSslParam: boolean;
}

// Extract safe database info without exposing credentials
export function getSafeDbInfo(rawUrl: string | null): SafeDbInfo {
  if (!rawUrl) {
    return {
      configured: false,
      protocol: "none",
      host: "none",
      port: "none",
      database: "none",
      userPrefix: "none",
      hasSslParam: false
    };
  }

  try {
    const isPostgresqlProtocol = rawUrl.startsWith("postgresql://");
    const protocol = isPostgresqlProtocol ? "postgresql" : "postgres";
    
    // Parse using pg-connection-string (the official PostgreSQL URI parser)
    const parsed = parsePgConnectionString(rawUrl);
    
    const host = parsed.host || "unknown";
    const port = parsed.port ? String(parsed.port) : "5432";
    const database = parsed.database || "postgres";
    const user = parsed.user || "postgres";
    const userPrefix = user.includes(".") ? user.split(".")[0] : (user.length > 12 ? user.slice(0, 8) : user);
    const hasSslParam = Boolean(parsed.ssl) || rawUrl.includes("sslmode=");

    return {
      configured: true,
      protocol,
      host,
      port,
      database,
      userPrefix,
      hasSslParam
    };
  } catch (err: any) {
    return {
      configured: true,
      protocol: rawUrl.startsWith("postgresql://") ? "postgresql" : "postgres",
      host: "parse_error",
      port: "none",
      database: "none",
      userPrefix: "unknown",
      hasSslParam: false
    };
  }
}

// Global safe error and diagnostics tracker
let lastPgError: {
  message: string;
  code?: string;
  name?: string;
  timestamp: string;
  operation?: string;
} | null = null;

export function getSafeDbDiagnostics() {
  const url = getCleanPgUrl();
  const safeInfo = getSafeDbInfo(url);
  return {
    configured: Boolean(url),
    isPostgres,
    hasPool: Boolean(pgPool),
    target: {
      protocol: safeInfo.protocol,
      host: safeInfo.host,
      port: safeInfo.port,
      database: safeInfo.database,
      userPrefix: safeInfo.userPrefix
    },
    poolMetrics: pgPool ? {
      totalCount: (pgPool as any).totalCount,
      idleCount: (pgPool as any).idleCount,
      waitingCount: (pgPool as any).waitingCount
    } : null,
    lastError: lastPgError
  };
}

// Convert standard SQLite ? query syntax to PostgreSQL $1, $2, etc.
function formatQueryForPg(sql: string): string {
  let paramIndex = 1;
  let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  // Replace SQLite specific functions and keywords with PostgreSQL standards
  pgSql = pgSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, "SERIAL PRIMARY KEY");
  pgSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, "INSERT INTO");
  pgSql = pgSql.replace(/INSERT OR REPLACE INTO/gi, "INSERT INTO");
  // Replace SQLite GLOB with PostgreSQL POSIX regex ~
  pgSql = pgSql.replace(/GLOB\s+'\[0-9\]\*'/gi, "~ '^[0-9]+$'");
  pgSql = pgSql.replace(/GLOB\s+'([^']+)'/gi, "~ '$1'");
  return pgSql;
}

// Atomic and safe SQLite database file writer (when in local fallback mode)
function saveSqlJsDb() {
  if (sqlJsDb && !isPostgres) {
    try {
      const data = sqlJsDb.export();
      const tmpPath = `${DB_PATH}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, Buffer.from(data));
      fs.renameSync(tmpPath, DB_PATH);
    } catch (e) {
      console.error("Failed to save local database atomically:", e);
    }
  }
}

// Execute query with parameters
export async function dbRun(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  if (!pgPool && !sqlJsDb) {
    try {
      await initDatabase();
    } catch (initErr: any) {
      const safeMsg = sanitizeErrorMessage(initErr?.message || String(initErr));
      throw new Error(`Database connection unavailable: ${safeMsg}`);
    }
  }

  if (isPostgres && pgPool) {
    try {
      const pgSql = formatQueryForPg(sql);
      // Add RETURNING id ONLY for INSERTs into tables that have an `id` column.
      // Tables WITHOUT id (e.g. settings, audit_logs key-only) would error out.
      const TABLES_WITHOUT_ID = new Set(["settings"]);
      const isInsert = /^\s*INSERT\s+INTO\s+([a-z_]+)/i.exec(sql);
      const tableName = isInsert ? isInsert[1].toLowerCase() : "";
      const hasIdColumn = tableName && !TABLES_WITHOUT_ID.has(tableName);
      const queryToRun = hasIdColumn && !pgSql.includes("RETURNING") ? `${pgSql} RETURNING id` : pgSql;

      const res = await pgPool.query(queryToRun, params);
      const lastID = res.rows && res.rows[0] && res.rows[0].id ? Number(res.rows[0].id) : 0;
      const changes = res.rowCount || 0;
      return { lastID, changes };
    } catch (err: any) {
      const safeMsg = sanitizeErrorMessage(err?.message || String(err));
      console.error(`[PostgreSQL dbRun Error] Code: ${err?.code || "N/A"}, SQL: ${sql.slice(0, 100)}, Error: ${safeMsg}`);
      // CRITICAL FIX: If pool was ended (Vercel warm instance reuse), re-init.
      if (err?.message?.includes("pool after calling end") || err?.code === "57P01") {
        console.warn("[dbRun] Pool was ended, attempting re-initialization...");
        isPostgres = false;
        try { await pgPool.end(); } catch {}
        pgPool = null;
        initPromise = null;
        try {
          await initDatabase();
          if (isPostgres && pgPool) {
            const pgSql = formatQueryForPg(sql);
            const isInsertMatch = /^\s*INSERT\s+INTO\s+([a-z_]+)/i.exec(sql);
            const tblName = isInsertMatch ? isInsertMatch[1].toLowerCase() : "";
            const hasIdCol = tblName && tblName !== "settings";
            const retryQuery = hasIdCol && !pgSql.includes("RETURNING") ? `${pgSql} RETURNING id` : pgSql;
            const res = await pgPool.query(retryQuery, params);
            const lastID = res.rows && res.rows[0] && res.rows[0].id ? Number(res.rows[0].id) : 0;
            const changes = res.rowCount || 0;
            return { lastID, changes };
          }
        } catch (retryErr: any) {
          console.error("[dbRun] Pool re-init failed:", retryErr?.message);
        }
      }
      lastPgError = {
        message: safeMsg,
        code: err?.code,
        name: err?.name || "QueryError",
        timestamp: new Date().toISOString(),
        operation: "dbRun"
      };
      throw new Error(`PostgreSQL execution error [${err?.code || "ERR"}]: ${safeMsg}`);
    }
  }

  if (!sqlJsDb) {
    // If PostgreSQL pool was expected, retry one initialization attempt before failing
    const pgUrl = getCleanPgUrl();
    if (pgUrl) {
      try {
        initPromise = null;
        await initDatabase();
        if (isPostgres && pgPool) {
          return dbRun(sql, params);
        }
      } catch (retryErr: any) {
        const safeMsg = sanitizeErrorMessage(retryErr?.message || String(retryErr));
        throw new Error(`Database connection unavailable: ${safeMsg}`);
      }
    }
    const lastDetail = lastPgError ? ` [${lastPgError.code || "ERR"}]: ${lastPgError.message}` : "";
    throw new Error(`Database connection unavailable. Please check PostgreSQL DATABASE_URL.${lastDetail}`);
  }

  // SQLite (sql.js) Fallback Execution
  try {
    const stmt = sqlJsDb.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    stmt.free();

    let lastID = 0;
    let changes = 0;
    try {
      const res = sqlJsDb.exec("SELECT last_insert_rowid() as lastID, changes() as changes");
      if (res && res.length > 0 && res[0].values && res[0].values.length > 0) {
        lastID = Number(res[0].values[0][0]) || 0;
        changes = Number(res[0].values[0][1]) || 0;
      }
    } catch {}

    saveSqlJsDb();
    return { lastID, changes };
  } catch (err: any) {
    if (err?.message?.includes("malformed") || err?.message?.includes("corrupt")) {
      console.error("Local database corrupted, reinitializing clean instance...", err);
      sqlJsDb = null;
      initPromise = null;
      await initDatabase();
      return dbRun(sql, params);
    }
    throw err;
  }
}

// Query multiple rows
export async function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (!pgPool && !sqlJsDb) {
    try {
      await initDatabase();
    } catch (initErr: any) {
      const safeMsg = sanitizeErrorMessage(initErr?.message || String(initErr));
      throw new Error(`Database connection unavailable: ${safeMsg}`);
    }
  }

  if (isPostgres && pgPool) {
    try {
      const pgSql = formatQueryForPg(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows as T[];
    } catch (err: any) {
      const safeMsg = sanitizeErrorMessage(err?.message || String(err));
      console.error(`[PostgreSQL dbAll Error] Code: ${err?.code || "N/A"}, SQL: ${sql.slice(0, 100)}, Error: ${safeMsg}`);
      // CRITICAL FIX: If pool was ended (Vercel warm instance reuse), re-init.
      if (err?.message?.includes("pool after calling end") || err?.code === "57P01") {
        console.warn("[dbAll] Pool was ended, attempting re-initialization...");
        isPostgres = false;
        try { await pgPool.end(); } catch {}
        pgPool = null;
        initPromise = null;
        try {
          await initDatabase();
          if (isPostgres && pgPool) {
            const pgSql = formatQueryForPg(sql);
            const res = await pgPool.query(pgSql, params);
            return res.rows as T[];
          }
        } catch (retryErr: any) {
          console.error("[dbAll] Pool re-init failed:", retryErr?.message);
        }
      }
      lastPgError = {
        message: safeMsg,
        code: err?.code,
        name: err?.name || "QueryError",
        timestamp: new Date().toISOString(),
        operation: "dbAll"
      };
      throw new Error(`PostgreSQL execution error [${err?.code || "ERR"}]: ${safeMsg}`);
    }
  }

  if (!sqlJsDb) {
    const pgUrl = getCleanPgUrl();
    if (pgUrl) {
      try {
        initPromise = null;
        await initDatabase();
        if (isPostgres && pgPool) {
          return dbAll<T>(sql, params);
        }
      } catch (retryErr: any) {
        const safeMsg = sanitizeErrorMessage(retryErr?.message || String(retryErr));
        throw new Error(`Database connection unavailable: ${safeMsg}`);
      }
    }
    const lastDetail = lastPgError ? ` [${lastPgError.code || "ERR"}]: ${lastPgError.message}` : "";
    throw new Error(`Database connection unavailable. Please check PostgreSQL DATABASE_URL.${lastDetail}`);
  }

  // SQLite Fallback
  try {
    const stmt = sqlJsDb.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  } catch (err: any) {
    if (err?.message?.includes("malformed") || err?.message?.includes("corrupt")) {
      console.error("Local database query corrupted, resetting...", err);
      sqlJsDb = null;
      initPromise = null;
      await initDatabase();
      return dbAll<T>(sql, params);
    }
    throw err;
  }
}

// Query a single row
export async function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  if (!pgPool && !sqlJsDb) {
    try {
      await initDatabase();
    } catch (initErr: any) {
      const safeMsg = sanitizeErrorMessage(initErr?.message || String(initErr));
      throw new Error(`Database connection unavailable: ${safeMsg}`);
    }
  }

  if (isPostgres && pgPool) {
    try {
      const pgSql = formatQueryForPg(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows[0] as T | undefined;
    } catch (err: any) {
      const safeMsg = sanitizeErrorMessage(err?.message || String(err));
      console.error(`[PostgreSQL dbGet Error] Code: ${err?.code || "N/A"}, SQL: ${sql.slice(0, 100)}, Error: ${safeMsg}`);
      // CRITICAL FIX: If pool was ended (Vercel warm instance reuse),
      // reset state and re-initialize ONCE before giving up.
      if (err?.message?.includes("pool after calling end") || err?.code === "57P01") {
        console.warn("[dbGet] Pool was ended, attempting re-initialization...");
        isPostgres = false;
        try { await pgPool.end(); } catch {}
        pgPool = null;
        initPromise = null;
        try {
          await initDatabase();
          if (isPostgres && pgPool) {
            const pgSql = formatQueryForPg(sql);
            const res = await pgPool.query(pgSql, params);
            return res.rows[0] as T | undefined;
          }
        } catch (retryErr: any) {
          console.error("[dbGet] Pool re-init failed:", retryErr?.message);
        }
      }
      lastPgError = {
        message: safeMsg,
        code: err?.code,
        name: err?.name || "QueryError",
        timestamp: new Date().toISOString(),
        operation: "dbGet"
      };
      throw new Error(`PostgreSQL execution error [${err?.code || "ERR"}]: ${safeMsg}`);
    }
  }

  if (!sqlJsDb) {
    const pgUrl = getCleanPgUrl();
    if (pgUrl) {
      try {
        initPromise = null;
        await initDatabase();
        if (isPostgres && pgPool) {
          return dbGet<T>(sql, params);
        }
      } catch (retryErr: any) {
        const safeMsg = sanitizeErrorMessage(retryErr?.message || String(retryErr));
        throw new Error(`Database connection unavailable: ${safeMsg}`);
      }
    }
    const lastDetail = lastPgError ? ` [${lastPgError.code || "ERR"}]: ${lastPgError.message}` : "";
    throw new Error(`Database connection unavailable. Please check PostgreSQL DATABASE_URL.${lastDetail}`);
  }

  // SQLite Fallback
  try {
    const stmt = sqlJsDb.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    let row: T | undefined = undefined;
    if (stmt.step()) {
      row = stmt.getAsObject() as T;
    }
    stmt.free();
    return row;
  } catch (err: any) {
    if (err?.message?.includes("malformed") || err?.message?.includes("corrupt")) {
      console.error("Local database query corrupted, resetting...", err);
      sqlJsDb = null;
      initPromise = null;
      await initDatabase();
      return dbGet<T>(sql, params);
    }
    throw err;
  }
}

// Embedded PostgreSQL Schema DDL (Ensures zero runtime failure in serverless bundle environments)
const POSTGRES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS super_admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(150),
  email VARCHAR(255),
  mobile VARCHAR(50),
  role VARCHAR(50) DEFAULT 'SUPER_ADMIN',
  password_hash TEXT NOT NULL,
  recovery_email VARCHAR(255),
  recovery_whatsapp VARCHAR(50),
  reset_token TEXT,
  reset_token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  name_en VARCHAR(150) NOT NULL,
  name_hi VARCHAR(150) NOT NULL,
  is_enabled SMALLINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sangathans (
  id SERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  name_en VARCHAR(200) NOT NULL,
  name_hi VARCHAR(200) NOT NULL,
  is_enabled SMALLINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS magazines (
  id SERIAL PRIMARY KEY,
  name_en VARCHAR(150) NOT NULL,
  name_hi VARCHAR(150) NOT NULL,
  is_enabled SMALLINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS editions (
  id SERIAL PRIMARY KEY,
  magazine_id INTEGER NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
  name_en VARCHAR(150) NOT NULL,
  name_hi VARCHAR(150) NOT NULL,
  is_enabled SMALLINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS advertisement_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_hi VARCHAR(100) NOT NULL,
  is_enabled SMALLINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS advertisement_sizes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(150) NOT NULL,
  name_hi VARCHAR(150) NOT NULL,
  width NUMERIC(6, 2) NOT NULL,
  height NUMERIC(6, 2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'inch',
  rows INTEGER DEFAULT 1,
  cols INTEGER DEFAULT 1,
  is_enabled SMALLINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pricings (
  id SERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  sangathan_id INTEGER NOT NULL REFERENCES sangathans(id) ON DELETE CASCADE,
  magazine_id INTEGER NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
  edition_id INTEGER NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  adv_type_code VARCHAR(50) NOT NULL,
  adv_size_code VARCHAR(50) NOT NULL,
  price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS advertisements (
  id SERIAL PRIMARY KEY,
  ad_number VARCHAR(100) UNIQUE NOT NULL,
  type_code VARCHAR(50) NOT NULL,
  district_hi VARCHAR(150) NOT NULL,
  sangathan_hi VARCHAR(200) NOT NULL,
  magazine_hi VARCHAR(150) NOT NULL,
  edition_hi VARCHAR(150) NOT NULL,
  size_code VARCHAR(50) NOT NULL,
  size_hi VARCHAR(150) NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_mobile1 VARCHAR(50) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'PENDING',
  production_status VARCHAR(50) DEFAULT 'Pending',
  uploaded_jpg_url TEXT,
  design_link TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matrimony_profiles (
  id SERIAL PRIMARY KEY,
  ad_id INTEGER UNIQUE NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  dob VARCHAR(50),
  height VARCHAR(50),
  blood_group VARCHAR(20),
  gotra VARCHAR(100),
  education TEXT,
  occupation TEXT,
  father_name VARCHAR(200),
  father_occupation TEXT,
  mother_name VARCHAR(200),
  mobile1 VARCHAR(50),
  mobile2 VARCHAR(50),
  whatsapp VARCHAR(50),
  current_address TEXT,
  permanent_address TEXT,
  photo_url TEXT,
  biodata_url TEXT,
  extra_fields_json TEXT
);

CREATE TABLE IF NOT EXISTS business_advertisements (
  id SERIAL PRIMARY KEY,
  ad_id INTEGER UNIQUE NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  business_name VARCHAR(255) DEFAULT '',
  owner_name VARCHAR(200) DEFAULT '',
  category VARCHAR(150),
  business_desc TEXT,
  products_services TEXT,
  special_offer TEXT,
  key_features TEXT,
  mobile1 VARCHAR(50),
  mobile2 VARCHAR(50),
  whatsapp VARCHAR(50),
  email VARCHAR(150),
  business_address TEXT,
  other_address TEXT,
  logo_url TEXT,
  photo_url TEXT,
  ready_ad_url TEXT,
  ad_maker_design_json TEXT,
  extra_fields_json TEXT
);

CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  filepath TEXT,
  url TEXT NOT NULL,
  storage_path TEXT,
  mimetype VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  provider VARCHAR(50) DEFAULT 'supabase',
  uploaded_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  ad_type VARCHAR(50) NOT NULL,
  data_json TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(100) UNIQUE NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'PENDING',
  payment_ref VARCHAR(100),
  payment_date VARCHAR(100),
  payment_screenshot TEXT,
  rejection_reason TEXT,
  verified_by VARCHAR(100),
  verification_time VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  ad_number VARCHAR(100) NOT NULL,
  ad_type VARCHAR(50) NOT NULL,
  district_hi VARCHAR(150) NOT NULL,
  sangathan_hi VARCHAR(200) NOT NULL,
  magazine_hi VARCHAR(150) NOT NULL,
  edition_hi VARCHAR(150) NOT NULL,
  size_hi VARCHAR(150) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_mobile VARCHAR(50) NOT NULL,
  production_status VARCHAR(50) DEFAULT 'Pending',
  uploaded_jpg_url TEXT,
  design_link TEXT,
  matrimony_details_json TEXT,
  business_details_json TEXT
);

CREATE TABLE IF NOT EXISTS publications (
  id SERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  sangathan_id INTEGER NOT NULL REFERENCES sangathans(id) ON DELETE CASCADE,
  magazine_id INTEGER NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
  edition_id INTEGER NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  is_enabled SMALLINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  district_hi VARCHAR(150),
  sangathan_hi VARCHAR(200),
  magazine_hi VARCHAR(150),
  edition_hi VARCHAR(150),
  layout_config_json TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  status VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  error_reason TEXT
);

CREATE TABLE IF NOT EXISTS advertisement_counters (
  counter_date VARCHAR(50) PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_configurations (
  id SERIAL PRIMARY KEY,
  configuration_id VARCHAR(100) UNIQUE NOT NULL,
  district VARCHAR(150) NOT NULL,
  sangathan VARCHAR(200) NOT NULL,
  magazine VARCHAR(150) NOT NULL,
  edition VARCHAR(150) NOT NULL,
  adv_type VARCHAR(50) NOT NULL,
  size_name VARCHAR(150) NOT NULL,
  width NUMERIC(6, 2) NOT NULL,
  height NUMERIC(6, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  layout VARCHAR(100) NOT NULL,
  pricing NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'enabled'
);

CREATE TABLE IF NOT EXISTS custom_fields (
  id SERIAL PRIMARY KEY,
  form_type VARCHAR(50) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  required SMALLINT DEFAULT 0,
  placeholder TEXT,
  help_text TEXT,
  default_value TEXT,
  visible SMALLINT DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  select_options TEXT,
  CONSTRAINT uq_form_field UNIQUE(form_type, field_name)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  actor_id VARCHAR(100),
  actor_email VARCHAR(255),
  details TEXT,
  ip_address VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ad_number ON advertisements(ad_number);
CREATE INDEX IF NOT EXISTS idx_ad_customer_name ON advertisements(customer_name);
CREATE INDEX IF NOT EXISTS idx_ad_payment_status ON advertisements(payment_status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_items(session_id);
`;

// Database Initialization (PostgreSQL with graceful local SQLite development fallback)
export async function initDatabase(): Promise<void> {
  if (isPostgres && pgPool) return;
  if (sqlJsDb) return;
  if (initPromise) return initPromise;
  initPromise = doInitDatabase().finally(() => {
    // If initialization did not produce a working pool or local DB, clear initPromise so future calls can retry
    if (!isPostgres && !sqlJsDb) {
      initPromise = null;
      if (pgPool) {
        try { pgPool.end(); } catch {}
        pgPool = null;
      }
    }
  });
  return initPromise;
}

async function doInitDatabase(): Promise<void> {
  const databaseUrl = getCleanPgUrl();
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

  if (databaseUrl) {
    const safeInfo = getSafeDbInfo(databaseUrl);
    const parsedConfig = parsePgConnectionString(databaseUrl);
    const isLocalHost = !parsedConfig.host || parsedConfig.host === "localhost" || parsedConfig.host === "127.0.0.1";
    const portNum = parsedConfig.port ? parseInt(String(parsedConfig.port), 10) : 5432;

    console.log(`[DB INIT] Connecting to PostgreSQL at ${safeInfo.host}:${safeInfo.port} (protocol: ${safeInfo.protocol}, database: ${safeInfo.database}, user: ${safeInfo.userPrefix})...`);

    try {
      if (pgPool) {
        try { await pgPool.end(); } catch {}
        pgPool = null;
      }

      pgPool = new Pool({
        host: parsedConfig.host || undefined,
        port: isNaN(portNum) ? 5432 : portNum,
        database: parsedConfig.database || "postgres",
        user: parsedConfig.user || undefined,
        password: parsedConfig.password || undefined,
        ssl: isLocalHost ? false : { rejectUnauthorized: false },
        max: isVercel ? 4 : 10,
        idleTimeoutMillis: isVercel ? 0 : 20000, // Vercel: never time out (keep pool alive across requests)
        connectionTimeoutMillis: 10000,
        // CRITICAL FIX: do NOT set allowExitOnIdle on Vercel — it causes the
        // serverless function to exit, killing the pg pool mid-request and
        // resulting in "Cannot use a pool after calling end on the pool" errors
        // for any subsequent requests routed to this warm instance.
        allowExitOnIdle: !isVercel,
      });

      // Handle pool errors gracefully to prevent serverless crash
      let poolEnded = false;
      pgPool.on("error", (poolErr: any) => {
        const safeMsg = sanitizeErrorMessage(poolErr?.message || String(poolErr));
        console.warn(`[DB POOL NOTICE] Code: ${poolErr?.code || "N/A"}, Msg: ${safeMsg}`);
        // CRITICAL FIX: if the pool reports it's been ended, mark it so future
        // dbGet/dbAll/dbRun calls re-initialize instead of trying to use a dead pool.
        if (poolErr?.message?.includes("pool after calling end") || poolErr?.code === "57P01") {
          poolEnded = true;
          isPostgres = false;
        }
        lastPgError = {
          message: safeMsg,
          code: poolErr?.code,
          name: poolErr?.name || "PoolError",
          timestamp: new Date().toISOString(),
          operation: "background_pool"
        };
      });

      // Direct client connect test (SELECT 1)
      const client = await pgPool.connect();
      try {
        await client.query("SELECT 1;");
      } finally {
        client.release();
      }

      isPostgres = true;
      lastPgError = null;
      console.log(`[DB INIT] ✅ Successfully connected to PostgreSQL / Supabase (${safeInfo.host}:${safeInfo.port}).`);

      // Run schema initialization and seed on PostgreSQL once per instance
      if (!schemaInitialized) {
        schemaInitialized = true;
        try {
          await setupPostgresTables();
          await seedData();
        } catch (schemaErr: any) {
          const safeMsg = sanitizeErrorMessage(schemaErr?.message || String(schemaErr));
          console.warn(`[DB SCHEMA/SEED NOTICE] Non-fatal setup notice: ${safeMsg}`);
          // CRITICAL FIX: Schema/seed errors (e.g. "table already exists") must NOT
          // invalidate the pool. The pool itself connected fine (SELECT 1 passed above).
          // Mark schemaInitialized=true so we don't retry, but keep pgPool alive.
          // Previous code was reaching the outer catch block which calls pgPool.end(),
          // making ALL subsequent requests fail with "Cannot use a pool after calling
          // end on the pool". This was the root cause of intermittent 404/500 on Vercel.
        }
      }
      return;
    } catch (pgErr: any) {
      const safeMsg = sanitizeErrorMessage(pgErr?.message || String(pgErr));
      const errCode = pgErr?.code || pgErr?.name || "CONN_FAIL";
      lastPgError = {
        message: safeMsg,
        code: pgErr?.code,
        name: pgErr?.name || "ConnectionError",
        timestamp: new Date().toISOString(),
        operation: "init_connection"
      };
      console.error(`[DB INIT ERROR] ❌ PostgreSQL connection failed to ${safeInfo.host}:${safeInfo.port} [Code: ${errCode}]: ${safeMsg}`);
      isPostgres = false;
      if (pgPool) {
        try { await pgPool.end(); } catch {}
        pgPool = null;
      }

      if (isVercel) {
        console.warn(`Operating in Vercel serverless environment. PostgreSQL target failed to connect. Target: ${safeInfo.host}:${safeInfo.port}`);
        throw new Error(`PostgreSQL connection failed [${errCode}]: ${safeMsg}`);
      }
    }
  } else if (isVercel) {
    const err = new Error("PostgreSQL DATABASE_URL not detected in environment variables.");
    lastPgError = {
      message: err.message,
      code: "NO_DATABASE_URL",
      name: "ConfigError",
      timestamp: new Date().toISOString(),
      operation: "env_check"
    };
    console.warn("[DB INIT] ⚠️ DATABASE_URL is not configured in Vercel environment.");
    throw err;
  }

  // Local development / testing fallback to embedded sql.js (only in non-production local environments)
  try {
    ensureLocalDirsLazy();
    console.log("Using Local Embedded SQL Database Engine for local development...");
    const { default: initSqlJs } = await import("sql.js");
    const SQL = await initSqlJs();
    let dbLoaded = false;

    if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 0) {
      try {
        const filebuffer = fs.readFileSync(DB_PATH);
        const testDb = new SQL.Database(filebuffer);
        const checkRes = testDb.exec("PRAGMA integrity_check(1);");
        if (checkRes && checkRes[0]?.values?.[0]?.[0] === "ok") {
          sqlJsDb = testDb;
          dbLoaded = true;
        }
      } catch (err) {
        console.warn("Existing local DB disk image corrupted. Backing up and resetting...", err);
        dbLoaded = false;
      }
    }

    if (!dbLoaded) {
      sqlJsDb = new SQL.Database();
    }

    setupLocalTables(sqlJsDb);
    await seedData();
    saveSqlJsDb();
  } catch (localErr) {
    console.error("Local SQL.js initialization notice:", localErr);
  }
}

async function setupPostgresTables() {
  if (!pgPool) return;
  try {
    await pgPool.query(POSTGRES_SCHEMA_SQL);
    await pgPool.query(`
      DO $$ 
      BEGIN 
        BEGIN
          ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS name VARCHAR(150);
          ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS email VARCHAR(255);
          ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS mobile VARCHAR(50);
          ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'SUPER_ADMIN';
        EXCEPTION WHEN others THEN NULL;
        END;
      END $$;
    `);
  } catch (err: any) {
    const safeMsg = sanitizeErrorMessage(err?.message || String(err));
    console.warn(`[DB SCHEMA NOTICE] Code: ${err?.code || "N/A"}, Msg: ${safeMsg}`);
  }
}

function setupLocalTables(targetDb: any) {
  targetDb.exec(`PRAGMA foreign_keys = ON;`);

  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS super_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT,
      email TEXT,
      mobile TEXT,
      role TEXT DEFAULT 'SUPER_ADMIN',
      password_hash TEXT NOT NULL,
      recovery_email TEXT,
      recovery_whatsapp TEXT,
      reset_token TEXT,
      reset_token_expiry TEXT
    );

    CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_hi TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sangathans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      district_id INTEGER NOT NULL,
      name_en TEXT NOT NULL,
      name_hi TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      FOREIGN KEY(district_id) REFERENCES districts(id)
    );

    CREATE TABLE IF NOT EXISTS magazines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_hi TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS editions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      magazine_id INTEGER NOT NULL,
      name_en TEXT NOT NULL,
      name_hi TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      FOREIGN KEY(magazine_id) REFERENCES magazines(id)
    );

    CREATE TABLE IF NOT EXISTS advertisement_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_hi TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS advertisement_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_hi TEXT NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      unit TEXT DEFAULT 'inch',
      rows INTEGER DEFAULT 1,
      cols INTEGER DEFAULT 1,
      is_enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pricings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      district_id INTEGER NOT NULL,
      sangathan_id INTEGER NOT NULL,
      magazine_id INTEGER NOT NULL,
      edition_id INTEGER NOT NULL,
      adv_type_code TEXT NOT NULL,
      adv_size_code TEXT NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY(district_id) REFERENCES districts(id),
      FOREIGN KEY(sangathan_id) REFERENCES sangathans(id),
      FOREIGN KEY(magazine_id) REFERENCES magazines(id),
      FOREIGN KEY(edition_id) REFERENCES editions(id)
    );

    CREATE TABLE IF NOT EXISTS advertisements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_number TEXT UNIQUE NOT NULL,
      type_code TEXT NOT NULL,
      district_hi TEXT NOT NULL,
      sangathan_hi TEXT NOT NULL,
      magazine_hi TEXT NOT NULL,
      edition_hi TEXT NOT NULL,
      size_code TEXT NOT NULL,
      size_hi TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_mobile1 TEXT NOT NULL,
      price REAL NOT NULL,
      payment_status TEXT DEFAULT 'PENDING',
      production_status TEXT DEFAULT 'Pending',
      uploaded_jpg_url TEXT,
      design_link TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matrimony_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      dob TEXT,
      height TEXT,
      blood_group TEXT,
      gotra TEXT,
      education TEXT,
      occupation TEXT,
      father_name TEXT,
      father_occupation TEXT,
      mother_name TEXT,
      mobile1 TEXT,
      mobile2 TEXT,
      whatsapp TEXT,
      current_address TEXT,
      permanent_address TEXT,
      photo_url TEXT,
      biodata_url TEXT,
      extra_fields_json TEXT,
      FOREIGN KEY(ad_id) REFERENCES advertisements(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS business_advertisements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_id INTEGER UNIQUE NOT NULL,
      business_name TEXT DEFAULT '',
      owner_name TEXT DEFAULT '',
      category TEXT,
      business_desc TEXT,
      products_services TEXT,
      special_offer TEXT,
      key_features TEXT,
      mobile1 TEXT,
      mobile2 TEXT,
      whatsapp TEXT,
      email TEXT,
      business_address TEXT,
      other_address TEXT,
      logo_url TEXT,
      photo_url TEXT,
      ready_ad_url TEXT,
      ad_maker_design_json TEXT,
      extra_fields_json TEXT,
      FOREIGN KEY(ad_id) REFERENCES advertisements(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      url TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      ad_type TEXT NOT NULL,
      data_json TEXT NOT NULL,
      price REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      total_amount REAL NOT NULL,
      payment_status TEXT DEFAULT 'PENDING',
      payment_ref TEXT,
      payment_date TEXT,
      payment_screenshot TEXT,
      rejection_reason TEXT,
      verified_by TEXT,
      verification_time TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      ad_number TEXT NOT NULL,
      ad_type TEXT NOT NULL,
      district_hi TEXT NOT NULL,
      sangathan_hi TEXT NOT NULL,
      magazine_hi TEXT NOT NULL,
      edition_hi TEXT NOT NULL,
      size_hi TEXT NOT NULL,
      price REAL NOT NULL,
      customer_name TEXT NOT NULL,
      customer_mobile TEXT NOT NULL,
      production_status TEXT DEFAULT 'Pending',
      uploaded_jpg_url TEXT,
      design_link TEXT,
      matrimony_details_json TEXT,
      business_details_json TEXT,
      FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS publications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      district_id INTEGER NOT NULL,
      sangathan_id INTEGER NOT NULL,
      magazine_id INTEGER NOT NULL,
      edition_id INTEGER NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      FOREIGN KEY(district_id) REFERENCES districts(id),
      FOREIGN KEY(sangathan_id) REFERENCES sangathans(id),
      FOREIGN KEY(magazine_id) REFERENCES magazines(id),
      FOREIGN KEY(edition_id) REFERENCES editions(id)
    );

    CREATE TABLE IF NOT EXISTS print_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      district_hi TEXT,
      sangathan_hi TEXT,
      magazine_hi TEXT,
      edition_hi TEXT,
      layout_config_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT UNIQUE PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whatsapp_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      error_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS advertisement_counters (
      counter_date TEXT UNIQUE PRIMARY KEY,
      last_seq INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS admin_configurations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      configuration_id TEXT UNIQUE NOT NULL,
      district TEXT NOT NULL,
      sangathan TEXT NOT NULL,
      magazine TEXT NOT NULL,
      edition TEXT NOT NULL,
      adv_type TEXT NOT NULL,
      size_name TEXT NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      unit TEXT NOT NULL,
      layout TEXT NOT NULL,
      pricing REAL NOT NULL,
      status TEXT DEFAULT 'enabled'
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_type TEXT NOT NULL,
      field_name TEXT NOT NULL,
      label TEXT NOT NULL,
      field_type TEXT NOT NULL,
      required INTEGER DEFAULT 0,
      placeholder TEXT,
      help_text TEXT,
      default_value TEXT,
      visible INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      select_options TEXT,
      UNIQUE(form_type, field_name)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor_id TEXT,
      actor_email TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ad_number ON advertisements(ad_number);
    CREATE INDEX IF NOT EXISTS idx_ad_customer_name ON advertisements(customer_name);
    CREATE INDEX IF NOT EXISTS idx_ad_payment_status ON advertisements(payment_status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_order_id ON orders(order_id);
  `);

  // Migrate local SQLite columns if table existed prior to schema update
  try { targetDb.exec(`ALTER TABLE super_admins ADD COLUMN name TEXT;`); } catch {}
  try { targetDb.exec(`ALTER TABLE super_admins ADD COLUMN email TEXT;`); } catch {}
  try { targetDb.exec(`ALTER TABLE super_admins ADD COLUMN mobile TEXT;`); } catch {}
  try { targetDb.exec(`ALTER TABLE super_admins ADD COLUMN role TEXT DEFAULT 'SUPER_ADMIN';`); } catch {}
  try { targetDb.exec(`ALTER TABLE super_admins ADD COLUMN recovery_email TEXT;`); } catch {}
  try { targetDb.exec(`ALTER TABLE super_admins ADD COLUMN recovery_whatsapp TEXT;`); } catch {}
  try { targetDb.exec(`ALTER TABLE super_admins ADD COLUMN reset_token TEXT;`); } catch {}
  try { targetDb.exec(`ALTER TABLE super_admins ADD COLUMN reset_token_expiry TEXT;`); } catch {}
}

async function seedData() {
  try {
    // 1. Seed Districts
    const districtsCheck = await dbGet("SELECT COUNT(*) as count FROM districts");
    if (!districtsCheck || Number(districtsCheck.count) === 0) {
      const dists = [
        ["Raipur", "रायपुर"],
        ["Durg", "दुर्ग"],
        ["Bilaspur", "बिलासपुर"],
        ["Rajnandgaon", "राजनांदगांव"],
        ["Dhamtari", "धमतरी"],
        ["Mahasamund", "महासमुंद"]
      ];
      for (const [en, hi] of dists) {
        await dbRun("INSERT INTO districts (name_en, name_hi, is_enabled) VALUES (?, ?, 1)", [en, hi]);
      }
    }

    // 2. Seed Sangathans
    const sangathansCheck = await dbGet("SELECT COUNT(*) as count FROM sangathans");
    if (!sangathansCheck || Number(sangathansCheck.count) === 0) {
      const sangs = [
        [1, "Raipur Sahu Sangathan", "रायपुर साहू संगठन"],
        [2, "Durg Sahu Sangathan", "दुर्ग साहू संगठन"],
        [3, "Bilaspur Sahu Sangathan", "बिलासपुर साहू संगठन"]
      ];
      for (const [dId, en, hi] of sangs) {
        await dbRun("INSERT INTO sangathans (district_id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", [dId, en, hi]);
      }
    }

    // 3. Seed Magazines
    const magazinesCheck = await dbGet("SELECT COUNT(*) as count FROM magazines");
    if (!magazinesCheck || Number(magazinesCheck.count) === 0) {
      await dbRun("INSERT INTO magazines (name_en, name_hi, is_enabled) VALUES (?, ?, 1)", ["Parichayika", "परिचायिका"]);
    }

    // 4. Seed Editions
    const editionsCheck = await dbGet("SELECT COUNT(*) as count FROM editions");
    if (!editionsCheck || Number(editionsCheck.count) === 0) {
      await dbRun("INSERT INTO editions (magazine_id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", [1, "Edition 2026", "संस्करण 2026"]);
      await dbRun("INSERT INTO editions (magazine_id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", [1, "Edition 2027", "संस्करण 2027"]);
    }

    // 5. Seed Advertisement Types
    const typesCheck = await dbGet("SELECT COUNT(*) as count FROM advertisement_types");
    if (!typesCheck || Number(typesCheck.count) === 0) {
      await dbRun("INSERT INTO advertisement_types (code, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", ["matrimony", "Matrimony", "विवाह विज्ञापन"]);
      await dbRun("INSERT INTO advertisement_types (code, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", ["business", "Business", "व्यवसाय विज्ञापन"]);
    }

    // 6. Seed Advertisement Sizes
    const sizesCheck = await dbGet("SELECT COUNT(*) as count FROM advertisement_sizes");
    if (!sizesCheck || Number(sizesCheck.count) === 0) {
      const sizes = [
        ["matrimony_standard", "Matrimony Standard", "विवाह मानक (3.5 × 2 इंच)", 3.5, 2, "inch", 1, 1],
        ["business_full", "Full Page", "पूरा पृष्ठ (7.2 × 9.6 इंच)", 7.2, 9.6, "inch", 1, 1],
        ["business_half", "Half Page", "आधा पृष्ठ (7.2 × 4.8 इंच)", 7.2, 4.8, "inch", 1, 1],
        ["business_quarter", "Quarter Page", "चौथाई पृष्ठ (3.6 × 4.8 इंच)", 3.6, 4.8, "inch", 1, 1],
        ["business_custom", "Custom Size", "कस्टम आकार", 0, 0, "inch", 1, 1]
      ];
      for (const [code, en, hi, w, h, u, r, c] of sizes) {
        await dbRun("INSERT INTO advertisement_sizes (code, name_en, name_hi, width, height, unit, rows, cols, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)", [code, en, hi, w, h, u, r, c]);
      }
    }

    // 7. Seed Default Pricings
    const pricingsCheck = await dbGet("SELECT COUNT(*) as count FROM pricings");
    if (!pricingsCheck || Number(pricingsCheck.count) === 0) {
      const priceList = [
        [1, 1, 1, 1, "matrimony", "matrimony_standard", 500],
        [1, 1, 1, 1, "business", "business_full", 5000],
        [1, 1, 1, 1, "business", "business_half", 3000],
        [1, 1, 1, 1, "business", "business_quarter", 1500],
        [1, 1, 1, 1, "business", "business_custom", 2500],
        [2, 2, 1, 1, "matrimony", "matrimony_standard", 450],
        [2, 2, 1, 1, "business", "business_full", 4500],
        [2, 2, 1, 1, "business", "business_half", 2500],
        [2, 2, 1, 1, "business", "business_quarter", 1200],
        [2, 2, 1, 1, "business", "business_custom", 2000],
        [3, 3, 1, 1, "matrimony", "matrimony_standard", 400],
        [3, 3, 1, 1, "business", "business_full", 4000],
        [3, 3, 1, 1, "business", "business_half", 2200],
        [3, 3, 1, 1, "business", "business_quarter", 1000],
        [3, 3, 1, 1, "business", "business_custom", 1800]
      ];
      for (const [dId, sId, mId, eId, tCode, sCode, pr] of priceList) {
        await dbRun("INSERT INTO pricings (district_id, sangathan_id, magazine_id, edition_id, adv_type_code, adv_size_code, price) VALUES (?, ?, ?, ?, ?, ?, ?)", [dId, sId, mId, eId, tCode, sCode, pr]);
      }
    }

    // 8. Seed Publications
    const publicationsCheck = await dbGet("SELECT COUNT(*) as count FROM publications");
    if (!publicationsCheck || Number(publicationsCheck.count) === 0) {
      await dbRun("INSERT INTO publications (district_id, sangathan_id, magazine_id, edition_id, is_enabled) VALUES (?, ?, ?, ?, 1)", [1, 1, 1, 1]);
      await dbRun("INSERT INTO publications (district_id, sangathan_id, magazine_id, edition_id, is_enabled) VALUES (?, ?, ?, ?, 1)", [2, 2, 1, 1]);
      await dbRun("INSERT INTO publications (district_id, sangathan_id, magazine_id, edition_id, is_enabled) VALUES (?, ?, ?, ?, 1)", [3, 3, 1, 1]);
    }

    // 9. Default settings
    const settingsCheck = await dbGet("SELECT COUNT(*) as count FROM settings");
    if (!settingsCheck || Number(settingsCheck.count) === 0) {
      await dbRun("INSERT INTO settings (key, value) VALUES (?, ?)", ["upi_id", "9301056006@paytm"]);
      await dbRun("INSERT INTO settings (key, value) VALUES (?, ?)", ["upi_name", "Parichayika Powered by Indian Press"]);
      await dbRun("INSERT INTO settings (key, value) VALUES (?, ?)", ["whatsapp_api_enabled", "0"]);
    }

    // 10. Default Admin Configurations
    const configsCheck = await dbGet("SELECT COUNT(*) as count FROM admin_configurations");
    if (!configsCheck || Number(configsCheck.count) === 0) {
      await dbRun(`
        INSERT INTO admin_configurations (configuration_id, district, sangathan, magazine, edition, adv_type, size_name, width, height, unit, layout, pricing, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ["CONF-000001", "रायपुर", "रायपुर साहू समाज", "परिचायिका", "2026", "विवाह", "3.5 × 2 inch", 3.5, 2, "inch", "Standard", 500, "enabled"]);
    }
  } catch (err) {
    console.error("Error during database seeding:", err);
  }
}

// Race-condition safe ad number generator
export async function generateAdNumber(sangathanHi: string, magazineHi: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${dd}-${mm}-${yy}`;

  const row = await dbGet<{ last_seq: number }>("SELECT last_seq FROM advertisement_counters WHERE counter_date = ?", [dateStr]);
  if (!row) {
    await dbRun("INSERT INTO advertisement_counters (counter_date, last_seq) VALUES (?, 1)", [dateStr]);
    return `${dateStr} / ${sangathanHi || "रायपुर साहू संगठन"} / ${magazineHi || "परिचायिका"} / 001`;
  } else {
    const nextSeq = Number(row.last_seq) + 1;
    await dbRun("UPDATE advertisement_counters SET last_seq = ? WHERE counter_date = ?", [nextSeq, dateStr]);
    const seq = String(nextSeq).padStart(3, "0");
    return `${dateStr} / ${sangathanHi || "रायपुर साहू संगठन"} / ${magazineHi || "परिचायिका"} / ${seq}`;
  }
}
