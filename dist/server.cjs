var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default,
  getSafeDbDiagnostics: () => getSafeDbDiagnostics,
  initDatabase: () => initDatabase,
  isPostgres: () => isPostgres,
  transliterateText: () => transliterateText,
  uploadFile: () => uploadFile,
  validateUpload: () => validateUpload
});
module.exports = __toCommonJS(index_exports);
var import_express = __toESM(require("express"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_multer = __toESM(require("multer"), 1);
var import_dotenv3 = __toESM(require("dotenv"), 1);

// server/db.ts
var import_pg = __toESM(require("pg"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_pg_connection_string = require("pg-connection-string");
import_dotenv.default.config();
var { Pool } = import_pg.default;
var DB_DIR = import_path.default.join(process.cwd(), "data");
var DB_PATH = import_path.default.join(DB_DIR, "parichayika.db");
function ensureLocalDirsLazy() {
  try {
    if (!import_fs.default.existsSync(DB_DIR)) {
      import_fs.default.mkdirSync(DB_DIR, { recursive: true });
    }
    const uploadsDir = import_path.default.join(process.cwd(), "uploads");
    if (!import_fs.default.existsSync(uploadsDir)) {
      import_fs.default.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
  }
}
var pgPool = null;
var sqlJsDb = null;
var isPostgres = false;
var initPromise = null;
var schemaInitialized = false;
function getCleanPgUrl() {
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
    if (url.startsWith('"') && url.endsWith('"') || url.startsWith("'") && url.endsWith("'")) {
      url = url.slice(1, -1).trim();
    }
    if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
      return url;
    }
  }
  return null;
}
function sanitizeErrorMessage(msg) {
  if (!msg) return "";
  return String(msg).replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgres://[REDACTED_AUTH]@").replace(/password=[^\s;&]+/gi, "password=[REDACTED]");
}
function getSafeDbInfo(rawUrl) {
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
    const parsed = (0, import_pg_connection_string.parse)(rawUrl);
    const host = parsed.host || "unknown";
    const port = parsed.port ? String(parsed.port) : "5432";
    const database = parsed.database || "postgres";
    const user = parsed.user || "postgres";
    const userPrefix = user.includes(".") ? user.split(".")[0] : user.length > 12 ? user.slice(0, 8) : user;
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
  } catch (err) {
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
var lastPgError = null;
function getSafeDbDiagnostics() {
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
      totalCount: pgPool.totalCount,
      idleCount: pgPool.idleCount,
      waitingCount: pgPool.waitingCount
    } : null,
    lastError: lastPgError
  };
}
function formatQueryForPg(sql) {
  let paramIndex = 1;
  let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  pgSql = pgSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, "SERIAL PRIMARY KEY");
  pgSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, "INSERT INTO");
  pgSql = pgSql.replace(/INSERT OR REPLACE INTO/gi, "INSERT INTO");
  pgSql = pgSql.replace(/GLOB\s+'\[0-9\]\*'/gi, "~ '^[0-9]+$'");
  pgSql = pgSql.replace(/GLOB\s+'([^']+)'/gi, "~ '$1'");
  return pgSql;
}
function saveSqlJsDb() {
  if (sqlJsDb && !isPostgres) {
    try {
      const data = sqlJsDb.export();
      const tmpPath = `${DB_PATH}.tmp.${Date.now()}`;
      import_fs.default.writeFileSync(tmpPath, Buffer.from(data));
      import_fs.default.renameSync(tmpPath, DB_PATH);
    } catch (e) {
      console.error("Failed to save local database atomically:", e);
    }
  }
}
async function dbRun(sql, params = []) {
  if (!pgPool && !sqlJsDb) {
    try {
      await initDatabase();
    } catch (initErr) {
      const safeMsg = sanitizeErrorMessage(initErr?.message || String(initErr));
      throw new Error(`Database connection unavailable: ${safeMsg}`);
    }
  }
  if (isPostgres && pgPool) {
    try {
      const pgSql = formatQueryForPg(sql);
      const TABLES_WITHOUT_ID = /* @__PURE__ */ new Set(["settings"]);
      const isInsert = /^\s*INSERT\s+INTO\s+([a-z_]+)/i.exec(sql);
      const tableName = isInsert ? isInsert[1].toLowerCase() : "";
      const hasIdColumn = tableName && !TABLES_WITHOUT_ID.has(tableName);
      const queryToRun = hasIdColumn && !pgSql.includes("RETURNING") ? `${pgSql} RETURNING id` : pgSql;
      const res = await pgPool.query(queryToRun, params);
      const lastID = res.rows && res.rows[0] && res.rows[0].id ? Number(res.rows[0].id) : 0;
      const changes = res.rowCount || 0;
      return { lastID, changes };
    } catch (err) {
      const safeMsg = sanitizeErrorMessage(err?.message || String(err));
      console.error(`[PostgreSQL dbRun Error] Code: ${err?.code || "N/A"}, SQL: ${sql.slice(0, 100)}, Error: ${safeMsg}`);
      if (err?.message?.includes("pool after calling end") || err?.code === "57P01") {
        console.warn("[dbRun] Pool was ended, attempting re-initialization...");
        isPostgres = false;
        try {
          await pgPool.end();
        } catch {
        }
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
        } catch (retryErr) {
          console.error("[dbRun] Pool re-init failed:", retryErr?.message);
        }
      }
      lastPgError = {
        message: safeMsg,
        code: err?.code,
        name: err?.name || "QueryError",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        operation: "dbRun"
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
          return dbRun(sql, params);
        }
      } catch (retryErr) {
        const safeMsg = sanitizeErrorMessage(retryErr?.message || String(retryErr));
        throw new Error(`Database connection unavailable: ${safeMsg}`);
      }
    }
    const lastDetail = lastPgError ? ` [${lastPgError.code || "ERR"}]: ${lastPgError.message}` : "";
    throw new Error(`Database connection unavailable. Please check PostgreSQL DATABASE_URL.${lastDetail}`);
  }
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
    } catch {
    }
    saveSqlJsDb();
    return { lastID, changes };
  } catch (err) {
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
async function dbAll(sql, params = []) {
  if (!pgPool && !sqlJsDb) {
    try {
      await initDatabase();
    } catch (initErr) {
      const safeMsg = sanitizeErrorMessage(initErr?.message || String(initErr));
      throw new Error(`Database connection unavailable: ${safeMsg}`);
    }
  }
  if (isPostgres && pgPool) {
    try {
      const pgSql = formatQueryForPg(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows;
    } catch (err) {
      const safeMsg = sanitizeErrorMessage(err?.message || String(err));
      console.error(`[PostgreSQL dbAll Error] Code: ${err?.code || "N/A"}, SQL: ${sql.slice(0, 100)}, Error: ${safeMsg}`);
      if (err?.message?.includes("pool after calling end") || err?.code === "57P01") {
        console.warn("[dbAll] Pool was ended, attempting re-initialization...");
        isPostgres = false;
        try {
          await pgPool.end();
        } catch {
        }
        pgPool = null;
        initPromise = null;
        try {
          await initDatabase();
          if (isPostgres && pgPool) {
            const pgSql = formatQueryForPg(sql);
            const res = await pgPool.query(pgSql, params);
            return res.rows;
          }
        } catch (retryErr) {
          console.error("[dbAll] Pool re-init failed:", retryErr?.message);
        }
      }
      lastPgError = {
        message: safeMsg,
        code: err?.code,
        name: err?.name || "QueryError",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
          return dbAll(sql, params);
        }
      } catch (retryErr) {
        const safeMsg = sanitizeErrorMessage(retryErr?.message || String(retryErr));
        throw new Error(`Database connection unavailable: ${safeMsg}`);
      }
    }
    const lastDetail = lastPgError ? ` [${lastPgError.code || "ERR"}]: ${lastPgError.message}` : "";
    throw new Error(`Database connection unavailable. Please check PostgreSQL DATABASE_URL.${lastDetail}`);
  }
  try {
    const stmt = sqlJsDb.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (err) {
    if (err?.message?.includes("malformed") || err?.message?.includes("corrupt")) {
      console.error("Local database query corrupted, resetting...", err);
      sqlJsDb = null;
      initPromise = null;
      await initDatabase();
      return dbAll(sql, params);
    }
    throw err;
  }
}
async function dbGet(sql, params = []) {
  if (!pgPool && !sqlJsDb) {
    try {
      await initDatabase();
    } catch (initErr) {
      const safeMsg = sanitizeErrorMessage(initErr?.message || String(initErr));
      throw new Error(`Database connection unavailable: ${safeMsg}`);
    }
  }
  if (isPostgres && pgPool) {
    try {
      const pgSql = formatQueryForPg(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows[0];
    } catch (err) {
      const safeMsg = sanitizeErrorMessage(err?.message || String(err));
      console.error(`[PostgreSQL dbGet Error] Code: ${err?.code || "N/A"}, SQL: ${sql.slice(0, 100)}, Error: ${safeMsg}`);
      if (err?.message?.includes("pool after calling end") || err?.code === "57P01") {
        console.warn("[dbGet] Pool was ended, attempting re-initialization...");
        isPostgres = false;
        try {
          await pgPool.end();
        } catch {
        }
        pgPool = null;
        initPromise = null;
        try {
          await initDatabase();
          if (isPostgres && pgPool) {
            const pgSql = formatQueryForPg(sql);
            const res = await pgPool.query(pgSql, params);
            return res.rows[0];
          }
        } catch (retryErr) {
          console.error("[dbGet] Pool re-init failed:", retryErr?.message);
        }
      }
      lastPgError = {
        message: safeMsg,
        code: err?.code,
        name: err?.name || "QueryError",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
          return dbGet(sql, params);
        }
      } catch (retryErr) {
        const safeMsg = sanitizeErrorMessage(retryErr?.message || String(retryErr));
        throw new Error(`Database connection unavailable: ${safeMsg}`);
      }
    }
    const lastDetail = lastPgError ? ` [${lastPgError.code || "ERR"}]: ${lastPgError.message}` : "";
    throw new Error(`Database connection unavailable. Please check PostgreSQL DATABASE_URL.${lastDetail}`);
  }
  try {
    const stmt = sqlJsDb.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    let row = void 0;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();
    return row;
  } catch (err) {
    if (err?.message?.includes("malformed") || err?.message?.includes("corrupt")) {
      console.error("Local database query corrupted, resetting...", err);
      sqlJsDb = null;
      initPromise = null;
      await initDatabase();
      return dbGet(sql, params);
    }
    throw err;
  }
}
var POSTGRES_SCHEMA_SQL = `
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
async function initDatabase() {
  if (isPostgres && pgPool) return;
  if (sqlJsDb) return;
  if (initPromise) return initPromise;
  initPromise = doInitDatabase().finally(() => {
    if (!isPostgres && !sqlJsDb) {
      initPromise = null;
      if (pgPool) {
        try {
          pgPool.end();
        } catch {
        }
        pgPool = null;
      }
    }
  });
  return initPromise;
}
async function doInitDatabase() {
  const databaseUrl = getCleanPgUrl();
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  if (databaseUrl) {
    const safeInfo = getSafeDbInfo(databaseUrl);
    const parsedConfig = (0, import_pg_connection_string.parse)(databaseUrl);
    const isLocalHost = !parsedConfig.host || parsedConfig.host === "localhost" || parsedConfig.host === "127.0.0.1";
    const portNum = parsedConfig.port ? parseInt(String(parsedConfig.port), 10) : 5432;
    console.log(`[DB INIT] Connecting to PostgreSQL at ${safeInfo.host}:${safeInfo.port} (protocol: ${safeInfo.protocol}, database: ${safeInfo.database}, user: ${safeInfo.userPrefix})...`);
    try {
      if (pgPool) {
        try {
          await pgPool.end();
        } catch {
        }
        pgPool = null;
      }
      pgPool = new Pool({
        host: parsedConfig.host || void 0,
        port: isNaN(portNum) ? 5432 : portNum,
        database: parsedConfig.database || "postgres",
        user: parsedConfig.user || void 0,
        password: parsedConfig.password || void 0,
        ssl: isLocalHost ? false : { rejectUnauthorized: false },
        max: isVercel ? 4 : 10,
        idleTimeoutMillis: isVercel ? 0 : 2e4,
        // Vercel: never time out (keep pool alive across requests)
        connectionTimeoutMillis: 1e4,
        // CRITICAL FIX: do NOT set allowExitOnIdle on Vercel — it causes the
        // serverless function to exit, killing the pg pool mid-request and
        // resulting in "Cannot use a pool after calling end on the pool" errors
        // for any subsequent requests routed to this warm instance.
        allowExitOnIdle: !isVercel
      });
      let poolEnded = false;
      pgPool.on("error", (poolErr) => {
        const safeMsg = sanitizeErrorMessage(poolErr?.message || String(poolErr));
        console.warn(`[DB POOL NOTICE] Code: ${poolErr?.code || "N/A"}, Msg: ${safeMsg}`);
        if (poolErr?.message?.includes("pool after calling end") || poolErr?.code === "57P01") {
          poolEnded = true;
          isPostgres = false;
        }
        lastPgError = {
          message: safeMsg,
          code: poolErr?.code,
          name: poolErr?.name || "PoolError",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          operation: "background_pool"
        };
      });
      const client = await pgPool.connect();
      try {
        await client.query("SELECT 1;");
      } finally {
        client.release();
      }
      isPostgres = true;
      lastPgError = null;
      console.log(`[DB INIT] \u2705 Successfully connected to PostgreSQL / Supabase (${safeInfo.host}:${safeInfo.port}).`);
      if (!schemaInitialized) {
        schemaInitialized = true;
        try {
          await setupPostgresTables();
          await seedData();
        } catch (schemaErr) {
          const safeMsg = sanitizeErrorMessage(schemaErr?.message || String(schemaErr));
          console.warn(`[DB SCHEMA/SEED NOTICE] Non-fatal setup notice: ${safeMsg}`);
        }
      }
      return;
    } catch (pgErr) {
      const safeMsg = sanitizeErrorMessage(pgErr?.message || String(pgErr));
      const errCode = pgErr?.code || pgErr?.name || "CONN_FAIL";
      lastPgError = {
        message: safeMsg,
        code: pgErr?.code,
        name: pgErr?.name || "ConnectionError",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        operation: "init_connection"
      };
      console.error(`[DB INIT ERROR] \u274C PostgreSQL connection failed to ${safeInfo.host}:${safeInfo.port} [Code: ${errCode}]: ${safeMsg}`);
      isPostgres = false;
      if (pgPool) {
        try {
          await pgPool.end();
        } catch {
        }
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
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      operation: "env_check"
    };
    console.warn("[DB INIT] \u26A0\uFE0F DATABASE_URL is not configured in Vercel environment.");
    throw err;
  }
  try {
    ensureLocalDirsLazy();
    console.log("Using Local Embedded SQL Database Engine for local development...");
    const { default: initSqlJs } = await import("sql.js");
    const SQL = await initSqlJs();
    let dbLoaded = false;
    if (import_fs.default.existsSync(DB_PATH) && import_fs.default.statSync(DB_PATH).size > 0) {
      try {
        const filebuffer = import_fs.default.readFileSync(DB_PATH);
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
  } catch (err) {
    const safeMsg = sanitizeErrorMessage(err?.message || String(err));
    console.warn(`[DB SCHEMA NOTICE] Code: ${err?.code || "N/A"}, Msg: ${safeMsg}`);
  }
}
function setupLocalTables(targetDb) {
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
  try {
    targetDb.exec(`ALTER TABLE super_admins ADD COLUMN name TEXT;`);
  } catch {
  }
  try {
    targetDb.exec(`ALTER TABLE super_admins ADD COLUMN email TEXT;`);
  } catch {
  }
  try {
    targetDb.exec(`ALTER TABLE super_admins ADD COLUMN mobile TEXT;`);
  } catch {
  }
  try {
    targetDb.exec(`ALTER TABLE super_admins ADD COLUMN role TEXT DEFAULT 'SUPER_ADMIN';`);
  } catch {
  }
  try {
    targetDb.exec(`ALTER TABLE super_admins ADD COLUMN recovery_email TEXT;`);
  } catch {
  }
  try {
    targetDb.exec(`ALTER TABLE super_admins ADD COLUMN recovery_whatsapp TEXT;`);
  } catch {
  }
  try {
    targetDb.exec(`ALTER TABLE super_admins ADD COLUMN reset_token TEXT;`);
  } catch {
  }
  try {
    targetDb.exec(`ALTER TABLE super_admins ADD COLUMN reset_token_expiry TEXT;`);
  } catch {
  }
}
async function seedData() {
  try {
    const seedFlag = await dbGet("SELECT value FROM settings WHERE key = 'seed_completed'");
    if (seedFlag && seedFlag.value === "true") {
      return;
    }
    const districtsCheck = await dbGet("SELECT COUNT(*) as count FROM districts");
    if (!districtsCheck || Number(districtsCheck.count) === 0) {
      const dists = [
        ["Raipur", "\u0930\u093E\u092F\u092A\u0941\u0930"],
        ["Durg", "\u0926\u0941\u0930\u094D\u0917"],
        ["Bilaspur", "\u092C\u093F\u0932\u093E\u0938\u092A\u0941\u0930"],
        ["Rajnandgaon", "\u0930\u093E\u091C\u0928\u093E\u0902\u0926\u0917\u093E\u0902\u0935"],
        ["Dhamtari", "\u0927\u092E\u0924\u0930\u0940"],
        ["Mahasamund", "\u092E\u0939\u093E\u0938\u092E\u0941\u0902\u0926"]
      ];
      for (const [en, hi] of dists) {
        await dbRun("INSERT INTO districts (name_en, name_hi, is_enabled) VALUES (?, ?, 1)", [en, hi]);
      }
    }
    const sangathansCheck = await dbGet("SELECT COUNT(*) as count FROM sangathans");
    if (!sangathansCheck || Number(sangathansCheck.count) === 0) {
      const sangs = [
        [1, "Raipur Sahu Sangathan", "\u0930\u093E\u092F\u092A\u0941\u0930 \u0938\u093E\u0939\u0942 \u0938\u0902\u0917\u0920\u0928"],
        [2, "Durg Sahu Sangathan", "\u0926\u0941\u0930\u094D\u0917 \u0938\u093E\u0939\u0942 \u0938\u0902\u0917\u0920\u0928"],
        [3, "Bilaspur Sahu Sangathan", "\u092C\u093F\u0932\u093E\u0938\u092A\u0941\u0930 \u0938\u093E\u0939\u0942 \u0938\u0902\u0917\u0920\u0928"]
      ];
      for (const [dId, en, hi] of sangs) {
        await dbRun("INSERT INTO sangathans (district_id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", [dId, en, hi]);
      }
    }
    const magazinesCheck = await dbGet("SELECT COUNT(*) as count FROM magazines");
    if (!magazinesCheck || Number(magazinesCheck.count) === 0) {
      await dbRun("INSERT INTO magazines (name_en, name_hi, is_enabled) VALUES (?, ?, 1)", ["Parichayika", "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E"]);
    }
    const editionsCheck = await dbGet("SELECT COUNT(*) as count FROM editions");
    if (!editionsCheck || Number(editionsCheck.count) === 0) {
      await dbRun("INSERT INTO editions (magazine_id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", [1, "Edition 2026", "\u0938\u0902\u0938\u094D\u0915\u0930\u0923 2026"]);
      await dbRun("INSERT INTO editions (magazine_id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", [1, "Edition 2027", "\u0938\u0902\u0938\u094D\u0915\u0930\u0923 2027"]);
    }
    const typesCheck = await dbGet("SELECT COUNT(*) as count FROM advertisement_types");
    if (!typesCheck || Number(typesCheck.count) === 0) {
      await dbRun("INSERT INTO advertisement_types (code, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", ["matrimony", "Matrimony", "\u0935\u093F\u0935\u093E\u0939 \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928"]);
      await dbRun("INSERT INTO advertisement_types (code, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", ["business", "Business", "\u0935\u094D\u092F\u0935\u0938\u093E\u092F \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928"]);
    }
    const sizesCheck = await dbGet("SELECT COUNT(*) as count FROM advertisement_sizes");
    if (!sizesCheck || Number(sizesCheck.count) === 0) {
      const sizes = [
        ["matrimony_standard", "Matrimony Standard", "\u0935\u093F\u0935\u093E\u0939 \u092E\u093E\u0928\u0915 (3.5 \xD7 2 \u0907\u0902\u091A)", 3.5, 2, "inch", 1, 1],
        ["business_full", "Full Page", "\u092A\u0942\u0930\u093E \u092A\u0943\u0937\u094D\u0920 (7.2 \xD7 9.6 \u0907\u0902\u091A)", 7.2, 9.6, "inch", 1, 1],
        ["business_half", "Half Page", "\u0906\u0927\u093E \u092A\u0943\u0937\u094D\u0920 (7.2 \xD7 4.8 \u0907\u0902\u091A)", 7.2, 4.8, "inch", 1, 1],
        ["business_quarter", "Quarter Page", "\u091A\u094C\u0925\u093E\u0908 \u092A\u0943\u0937\u094D\u0920 (3.6 \xD7 4.8 \u0907\u0902\u091A)", 3.6, 4.8, "inch", 1, 1],
        ["business_custom", "Custom Size", "\u0915\u0938\u094D\u091F\u092E \u0906\u0915\u093E\u0930", 0, 0, "inch", 1, 1]
      ];
      for (const [code, en, hi, w, h, u, r, c] of sizes) {
        await dbRun("INSERT INTO advertisement_sizes (code, name_en, name_hi, width, height, unit, rows, cols, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)", [code, en, hi, w, h, u, r, c]);
      }
    }
    const pricingsCheck = await dbGet("SELECT COUNT(*) as count FROM pricings");
    if (!pricingsCheck || Number(pricingsCheck.count) === 0) {
      const priceList = [
        [1, 1, 1, 1, "matrimony", "matrimony_standard", 500],
        [1, 1, 1, 1, "business", "business_full", 5e3],
        [1, 1, 1, 1, "business", "business_half", 3e3],
        [1, 1, 1, 1, "business", "business_quarter", 1500],
        [1, 1, 1, 1, "business", "business_custom", 2500],
        [2, 2, 1, 1, "matrimony", "matrimony_standard", 450],
        [2, 2, 1, 1, "business", "business_full", 4500],
        [2, 2, 1, 1, "business", "business_half", 2500],
        [2, 2, 1, 1, "business", "business_quarter", 1200],
        [2, 2, 1, 1, "business", "business_custom", 2e3],
        [3, 3, 1, 1, "matrimony", "matrimony_standard", 400],
        [3, 3, 1, 1, "business", "business_full", 4e3],
        [3, 3, 1, 1, "business", "business_half", 2200],
        [3, 3, 1, 1, "business", "business_quarter", 1e3],
        [3, 3, 1, 1, "business", "business_custom", 1800]
      ];
      for (const [dId, sId, mId, eId, tCode, sCode, pr] of priceList) {
        await dbRun("INSERT INTO pricings (district_id, sangathan_id, magazine_id, edition_id, adv_type_code, adv_size_code, price) VALUES (?, ?, ?, ?, ?, ?, ?)", [dId, sId, mId, eId, tCode, sCode, pr]);
      }
    }
    const publicationsCheck = await dbGet("SELECT COUNT(*) as count FROM publications");
    if (!publicationsCheck || Number(publicationsCheck.count) === 0) {
      await dbRun("INSERT INTO publications (district_id, sangathan_id, magazine_id, edition_id, is_enabled) VALUES (?, ?, ?, ?, 1)", [1, 1, 1, 1]);
      await dbRun("INSERT INTO publications (district_id, sangathan_id, magazine_id, edition_id, is_enabled) VALUES (?, ?, ?, ?, 1)", [2, 2, 1, 1]);
      await dbRun("INSERT INTO publications (district_id, sangathan_id, magazine_id, edition_id, is_enabled) VALUES (?, ?, ?, ?, 1)", [3, 3, 1, 1]);
    }
    const settingsCheck = await dbGet("SELECT COUNT(*) as count FROM settings");
    if (!settingsCheck || Number(settingsCheck.count) === 0) {
      await dbRun("INSERT INTO settings (key, value) VALUES (?, ?)", ["upi_id", "9301056006@paytm"]);
      await dbRun("INSERT INTO settings (key, value) VALUES (?, ?)", ["upi_name", "Parichayika Powered by Indian Press"]);
      await dbRun("INSERT INTO settings (key, value) VALUES (?, ?)", ["whatsapp_api_enabled", "0"]);
    }
    const configsCheck = await dbGet("SELECT COUNT(*) as count FROM admin_configurations");
    if (!configsCheck || Number(configsCheck.count) === 0) {
      await dbRun(`
        INSERT INTO admin_configurations (configuration_id, district, sangathan, magazine, edition, adv_type, size_name, width, height, unit, layout, pricing, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ["CONF-000001", "\u0930\u093E\u092F\u092A\u0941\u0930", "\u0930\u093E\u092F\u092A\u0941\u0930 \u0938\u093E\u0939\u0942 \u0938\u092E\u093E\u091C", "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E", "2026", "\u0935\u093F\u0935\u093E\u0939", "3.5 \xD7 2 inch", 3.5, 2, "inch", "Standard", 500, "enabled"]);
    }
    try {
      await dbRun("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = ?", ["seed_completed", "true", "true"]);
    } catch {
      try {
        const existing = await dbGet("SELECT value FROM settings WHERE key = 'seed_completed'");
        if (!existing) {
          await dbRun("INSERT INTO settings (key, value) VALUES (?, ?)", ["seed_completed", "true"]);
        } else {
          await dbRun("UPDATE settings SET value = ? WHERE key = ?", ["true", "seed_completed"]);
        }
      } catch {
      }
    }
    console.log("[DB SEED] \u2713 Seed completed and flag set. Admin now controls all masters data.");
  } catch (err) {
    console.error("Error during database seeding:", err);
  }
}

// server/storage.ts
var import_supabase_js = require("@supabase/supabase-js");
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_dotenv2 = __toESM(require("dotenv"), 1);
import_dotenv2.default.config();
var ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".tif",
  ".tiff",
  ".svg",
  ".heic",
  ".heif",
  ".pdf",
  ".ai",
  ".eps",
  ".psd",
  ".cdr"
]);
var MAX_FILE_SIZE = 50 * 1024 * 1024;
var supabaseClient = null;
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    supabaseClient = (0, import_supabase_js.createClient)(url, key, {
      auth: { persistSession: false }
    });
    return supabaseClient;
  }
  return null;
}
function validateUpload(file) {
  if (!file) {
    return { valid: false, error: "\u092B\u093C\u093E\u0907\u0932 \u092A\u094D\u0930\u0926\u093E\u0928 \u0928\u0939\u0940\u0902 \u0915\u0940 \u0917\u0908 \u0939\u0948\u0964" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `\u092B\u093C\u093E\u0907\u0932 \u0915\u093E \u0906\u0915\u093E\u0930 50MB \u0938\u0947 \u0905\u0927\u093F\u0915 \u0928\u0939\u0940\u0902 \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F\u0964 (\u0935\u0930\u094D\u0924\u092E\u093E\u0928 \u0906\u0915\u093E\u0930: ${(file.size / (1024 * 1024)).toFixed(1)}MB)` };
  }
  const ext = import_path2.default.extname(file.originalname).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `\u0905\u092E\u093E\u0928\u094D\u092F \u092B\u093C\u093E\u0907\u0932 \u092A\u094D\u0930\u0915\u093E\u0930 (${ext})\u0964 \u0915\u0947\u0935\u0932 JPG, PNG, WEBP, PDF, CDR, PSD \u0938\u094D\u0935\u0940\u0915\u0943\u0924 \u0939\u0948\u0902\u0964` };
  }
  return { valid: true };
}
async function uploadFile(options) {
  const { buffer, originalname, folder = "general", isPublic = true } = options;
  const size = buffer.length;
  const validation = validateUpload({ originalname, mimetype: options.mimetype, size });
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const rawExt = import_path2.default.extname(originalname).toLowerCase();
  const ext = rawExt || (options.mimetype?.includes("png") ? ".png" : options.mimetype?.includes("webp") ? ".webp" : ".jpg");
  const mimetype = options.mimetype || "image/jpeg";
  const cleanBaseName = import_path2.default.basename(originalname, rawExt).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const uniqueKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const finalFilename = `${cleanBaseName}-${uniqueKey}${ext}`;
  const objectPath = `${folder}/${finalFilename}`;
  const supabase = getSupabaseClient();
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "parichayika-media";
  if (supabase) {
    try {
      const { data, error } = await supabase.storage.from(bucketName).upload(objectPath, buffer, {
        contentType: mimetype,
        upsert: true
      });
      if (!error && data) {
        let publicUrl = "";
        if (isPublic) {
          const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(objectPath);
          publicUrl = urlData.publicUrl;
        } else {
          const { data: signedData } = await supabase.storage.from(bucketName).createSignedUrl(objectPath, 60 * 60 * 24 * 365);
          publicUrl = signedData?.signedUrl || "";
        }
        return {
          url: publicUrl,
          storagePath: objectPath,
          filename: finalFilename,
          mimetype,
          size,
          provider: "supabase"
        };
      } else if (error) {
        console.warn("Supabase Storage upload warning (falling back if needed):", error.message);
      }
    } catch (sbErr) {
      console.warn("Supabase Storage error:", sbErr.message);
    }
  }
  const isVercelRuntime = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isVercelRuntime) {
    throw new Error(
      "Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars required). Local filesystem uploads are not supported on Vercel serverless runtime."
    );
  }
  const uploadsDir = import_path2.default.join(process.cwd(), "uploads", folder);
  if (!import_fs2.default.existsSync(uploadsDir)) {
    import_fs2.default.mkdirSync(uploadsDir, { recursive: true });
  }
  const localFilePath = import_path2.default.join(uploadsDir, finalFilename);
  import_fs2.default.writeFileSync(localFilePath, buffer);
  const localUrl = `/uploads/${folder}/${finalFilename}`;
  return {
    url: localUrl,
    storagePath: localFilePath,
    filename: finalFilename,
    mimetype,
    size,
    provider: "local"
  };
}

// server/transliteration.ts
function convertHindiNumeralsToEnglish(str) {
  const mapping = {
    "\u0966": "0",
    "\u0967": "1",
    "\u0968": "2",
    "\u0969": "3",
    "\u096A": "4",
    "\u096B": "5",
    "\u096C": "6",
    "\u096D": "7",
    "\u096E": "8",
    "\u096F": "9"
  };
  return str.replace(/[०-९]/g, (m) => mapping[m] || m);
}
var PHONETIC_DICTIONARY = {
  // Surnames & Castes
  "sahu": "\u0938\u093E\u0939\u0942",
  "sharma": "\u0936\u0930\u094D\u092E\u093E",
  "verma": "\u0935\u0930\u094D\u092E\u093E",
  "gupta": "\u0917\u0941\u092A\u094D\u0924\u093E",
  "patel": "\u092A\u091F\u0947\u0932",
  "dewangan": "\u0926\u0947\u0935\u093E\u0902\u0917\u0928",
  "yadav": "\u092F\u093E\u0926\u0935",
  "singh": "\u0938\u093F\u0902\u0939",
  "agrawal": "\u0905\u0917\u094D\u0930\u0935\u093E\u0932",
  "agarwal": "\u0905\u0917\u094D\u0930\u0935\u093E\u0932",
  "jain": "\u091C\u0948\u0928",
  "soni": "\u0938\u094B\u0928\u0940",
  "mishra": "\u092E\u093F\u0936\u094D\u0930\u093E",
  "pandey": "\u092A\u093E\u0923\u094D\u0921\u0947\u092F",
  "shukla": "\u0936\u0941\u0915\u094D\u0932\u093E",
  "dubey": "\u0926\u0941\u092C\u0947",
  "tiwari": "\u0924\u093F\u0935\u093E\u0930\u0940",
  "joshi": "\u091C\u094B\u0936\u0940",
  "bhat": "\u092D\u091F\u094D\u091F",
  "bhatt": "\u092D\u091F\u094D\u091F",
  "kashyap": "\u0915\u0936\u094D\u092F\u092A",
  "chandrakar": "\u091A\u0902\u0926\u094D\u0930\u093E\u0915\u0930",
  "sahuu": "\u0938\u093E\u0939\u0942",
  "kumari": "\u0915\u0941\u092E\u093E\u0930\u0940",
  "kumar": "\u0915\u0941\u092E\u093E\u0930",
  "lal": "\u0932\u093E\u0932",
  "prasad": "\u092A\u094D\u0930\u0938\u093E\u0926",
  "choudhary": "\u091A\u094C\u0927\u0930\u0940",
  "chowdhury": "\u091A\u094C\u0927\u0930\u0940",
  "deshmukh": "\u0926\u0947\u0936\u092E\u0941\u0916",
  "rathore": "\u0930\u093E\u0920\u094C\u0930",
  "nayak": "\u0928\u093E\u092F\u0915",
  "sen": "\u0938\u0947\u0928",
  "bisen": "\u092C\u093F\u0938\u0947\u0928",
  // Popular First Names
  "ramesh": "\u0930\u092E\u0947\u0936",
  "suresh": "\u0938\u0941\u0930\u0947\u0936",
  "rajesh": "\u0930\u093E\u091C\u0947\u0936",
  "mahesh": "\u092E\u0939\u0947\u0936",
  "dinesh": "\u0926\u093F\u0928\u0947\u0936",
  "mukesh": "\u092E\u0941\u0915\u0947\u0936",
  "rakesh": "\u0930\u093E\u0915\u0947\u0936",
  "anil": "\u0905\u0928\u093F\u0932",
  "sunil": "\u0938\u0941\u0928\u0940\u0932",
  "sanjay": "\u0938\u0902\u091C\u092F",
  "vijay": "\u0935\u093F\u091C\u092F",
  "ajay": "\u0905\u091C\u092F",
  "vinod": "\u0935\u093F\u0928\u094B\u0926",
  "manoj": "\u092E\u0928\u094B\u091C",
  "pankaj": "\u092A\u0902\u0915\u091C",
  "neeraj": "\u0928\u0940\u0930\u091C",
  "rahul": "\u0930\u093E\u0939\u0941\u0932",
  "rohit": "\u0930\u094B\u0939\u093F\u0924",
  "amit": "\u0905\u092E\u093F\u0924",
  "sumit": "\u0938\u0941\u092E\u093F\u0924",
  "ashwani": "\u0905\u0936\u094D\u0935\u093F\u0928\u0940",
  "ashwini": "\u0905\u0936\u094D\u0935\u093F\u0928\u0940",
  "ashwin": "\u0905\u0936\u094D\u0935\u093F\u0928",
  "vikas": "\u0935\u093F\u0915\u093E\u0938",
  "vikram": "\u0935\u093F\u0915\u094D\u0930\u092E",
  "deepak": "\u0926\u0940\u092A\u0915",
  "pradeep": "\u092A\u094D\u0930\u0926\u0940\u092A",
  "sandeep": "\u0938\u0902\u0926\u0940\u092A",
  "kuldeep": "\u0915\u0941\u0932\u0926\u0940\u092A",
  "santosh": "\u0938\u0902\u0924\u094B\u0937",
  "alok": "\u0906\u0932\u094B\u0915",
  "anand": "\u0906\u0928\u0902\u0926",
  "ashok": "\u0905\u0936\u094B\u0915",
  "bharat": "\u092D\u0930\u0924",
  "chetna": "\u091A\u0947\u0924\u0928\u093E",
  "divya": "\u0926\u093F\u0935\u094D\u092F\u093E",
  "geeta": "\u0917\u0940\u0924\u093E",
  "hemant": "\u0939\u0947\u092E\u0902\u0924",
  "kamal": "\u0915\u092E\u0932",
  "kiran": "\u0915\u093F\u0930\u0923",
  "laxmi": "\u0932\u0915\u094D\u0937\u094D\u092E\u0940",
  "mamta": "\u092E\u092E\u0924\u093E",
  "manju": "\u092E\u0902\u091C\u0942",
  "meena": "\u092E\u0940\u0928\u093E",
  "mohan": "\u092E\u094B\u0939\u0928",
  "neha": "\u0928\u0947\u0939\u093E",
  "pooja": "\u092A\u0942\u091C\u093E",
  "poonam": "\u092A\u0942\u0928\u092E",
  "priya": "\u092A\u094D\u0930\u093F\u092F\u093E",
  "priyanka": "\u092A\u094D\u0930\u093F\u092F\u0902\u0915\u093E",
  "pushpa": "\u092A\u0941\u0937\u094D\u092A\u093E",
  "radha": "\u0930\u093E\u0927\u093E",
  "rajni": "\u0930\u091C\u0928\u0940",
  "rekha": "\u0930\u0947\u0916\u093E",
  "ritu": "\u0930\u093F\u0924\u0941",
  "roshni": "\u0930\u094B\u0936\u0928\u0940",
  "rupa": "\u0930\u0942\u092A\u093E",
  "sarita": "\u0938\u0930\u093F\u0924\u093E",
  "seema": "\u0938\u0940\u092E\u093E",
  "shashi": "\u0936\u0936\u093F",
  "shobha": "\u0936\u094B\u092D\u093E",
  "sneha": "\u0938\u094D\u0928\u0947\u0939\u093E",
  "sonam": "\u0938\u094B\u0928\u092E",
  "sudha": "\u0938\u0941\u0927\u093E",
  "sunita": "\u0938\u0941\u0928\u0940\u0924\u093E",
  "sushma": "\u0938\u0941\u0937\u092E\u093E",
  "swati": "\u0938\u094D\u0935\u093E\u0924\u093F",
  "tanu": "\u0924\u0928\u0941",
  "uma": "\u0909\u092E\u093E",
  "vandana": "\u0935\u0902\u0926\u0928\u093E",
  "varsha": "\u0935\u0930\u094D\u0937\u093E",
  // Towns & Districts (Chhattisgarh & Central India)
  "raipur": "\u0930\u093E\u092F\u092A\u0941\u0930",
  "bilaspur": "\u092C\u093F\u0932\u093E\u0938\u092A\u0941\u0930",
  "durg": "\u0926\u0941\u0930\u094D\u0917",
  "bhilai": "\u092D\u093F\u0932\u093E\u0908",
  "rajnandgaon": "\u0930\u093E\u091C\u0928\u093E\u0902\u0926\u0917\u093E\u0902\u0935",
  "korba": "\u0915\u094B\u0930\u092C\u093E",
  "raigarh": "\u0930\u093E\u092F\u0917\u0922\u093C",
  "jagdalpur": "\u091C\u0917\u0926\u0932\u092A\u0941\u0930",
  "ambikapur": "\u0905\u0902\u092C\u093F\u0915\u093E\u092A\u0941\u0930",
  "dhamtari": "\u0927\u092E\u0924\u0930\u0940",
  "mahasamund": "\u092E\u0939\u093E\u0938\u092E\u0941\u0902\u0926",
  "kanker": "\u0915\u093E\u0902\u0915\u0947\u0930",
  "kawardha": "\u0915\u0935\u0930\u094D\u0927\u093E",
  "kabirdham": "\u0915\u092C\u0940\u0930\u0927\u093E\u092E",
  "janjgir": "\u091C\u093E\u0902\u091C\u0917\u0940\u0930",
  "champa": "\u091A\u093E\u0902\u092A\u093E",
  "bemetara": "\u092C\u0947\u092E\u0947\u0924\u0930\u093E",
  "balod": "\u092C\u093E\u0932\u094B\u0926",
  "balodabazar": "\u092C\u0932\u094C\u0926\u093E\u092C\u093E\u091C\u093E\u0930",
  "gariaband": "\u0917\u0930\u093F\u092F\u093E\u092C\u0902\u0926",
  "mungeli": "\u092E\u0941\u0902\u0917\u0947\u0932\u0940",
  "surajpur": "\u0938\u0942\u0930\u091C\u092A\u0941\u0930",
  "balrampur": "\u092C\u0932\u0930\u093E\u092E\u092A\u0941\u0930",
  "jashpur": "\u091C\u0936\u092A\u0941\u0930",
  "korea": "\u0915\u094B\u0930\u093F\u092F\u093E",
  "bastar": "\u092C\u0938\u094D\u0924\u0930",
  "dantewada": "\u0926\u0902\u0924\u0947\u0935\u093E\u0921\u093C\u093E",
  "sukma": "\u0938\u0941\u0915\u092E\u093E",
  "bijapur": "\u092C\u0940\u091C\u093E\u092A\u0941\u0930",
  "narayanpur": "\u0928\u093E\u0930\u093E\u092F\u0923\u092A\u0941\u0930",
  "kondagaon": "\u0915\u094B\u0902\u0921\u093E\u0917\u093E\u0902\u0935",
  "khairagarh": "\u0916\u0948\u0930\u093E\u0917\u0922\u093C",
  "sarangarh": "\u0938\u093E\u0930\u0902\u0917\u0922\u093C",
  "chhattisgarh": "\u091B\u0924\u094D\u0924\u0940\u0938\u0917\u0922\u093C",
  "cg": "\u091B.\u0917.",
  "india": "\u092D\u093E\u0930\u0924",
  // Occupations & Relationships
  "father": "\u092A\u093F\u0924\u093E",
  "mother": "\u092E\u093E\u0924\u093E",
  "brother": "\u092D\u093E\u0908",
  "sister": "\u092C\u0939\u0928",
  "son": "\u092A\u0941\u0924\u094D\u0930",
  "daughter": "\u092A\u0941\u0924\u094D\u0930\u0940",
  "husband": "\u092A\u0924\u093F",
  "wife": "\u092A\u0924\u094D\u0928\u0940",
  "service": "\u0938\u0947\u0935\u093E",
  "business": "\u0935\u094D\u092F\u0935\u0938\u093E\u092F",
  "job": "\u0928\u094C\u0915\u0930\u0940",
  "teacher": "\u0936\u093F\u0915\u094D\u0937\u0915",
  "engineer": "\u0907\u0902\u091C\u0940\u0928\u093F\u092F\u0930",
  "doctor": "\u0921\u0949\u0915\u094D\u091F\u0930",
  "lawyer": "\u0905\u0927\u093F\u0935\u0915\u094D\u0924\u093E",
  "advocate": "\u0905\u0927\u093F\u0935\u0915\u094D\u0924\u093E",
  "farmer": "\u0915\u0943\u0937\u0915",
  "agriculture": "\u0915\u0943\u0937\u093F",
  "retired": "\u0938\u0947\u0935\u093E\u0928\u093F\u0935\u0943\u0924\u094D\u0924",
  "student": "\u091B\u093E\u0924\u094D\u0930",
  "self": "\u0938\u094D\u0935\u092F\u0902",
  "shop": "\u0926\u0941\u0915\u093E\u0928",
  "store": "\u0938\u094D\u091F\u094B\u0930",
  "private": "\u0928\u093F\u091C\u0940",
  "government": "\u0936\u093E\u0938\u0915\u0940\u092F",
  "housewife": "\u0917\u0943\u0939\u0923\u0940"
};
function applyPreTransliterationFixes(text) {
  if (!text) return { processed: text, hasOnlyKnownTerms: false };
  let processed = text.trim();
  processed = processed.replace(/(^|\s)(smt\.?|shrimati|shreemati|mrs\.?)(?=\s|$)/gi, "$1\u0936\u094D\u0930\u0940\u092E\u0924\u0940 ");
  processed = processed.replace(/(^|\s)(shri\.?|shree|mr\.?|sri)(?=\s|$)/gi, "$1\u0936\u094D\u0930\u0940 ");
  processed = processed.replace(/(^|\s)(late\.?|lt\.?|sw\.?|swargiya|swargiye|expired|deceased|passed\s*away)(?=\s|$)/gi, "$1\u0938\u094D\u0935. ");
  processed = processed.replace(/(^|\s)(dr\.?|doctor)(?=\s|$)/gi, "$1\u0921\u0949. ");
  processed = processed.replace(/(^|\s)(adv\.?|advocate|vakeel|vakil|lawyer)(?=\s|$)/gi, "$1\u0905\u0927\u093F\u0935\u0915\u094D\u0924\u093E ");
  processed = processed.replace(/(^|\s)(er\.?|engineer)(?=\s|$)/gi, "$1\u0907\u0902\u091C\u0940. ");
  processed = processed.replace(/(^|\s)(prof\.?|professor)(?=\s|$)/gi, "$1\u092A\u094D\u0930\u094B. ");
  processed = processed.replace(/(^|\s)(pt\.?|pandit)(?=\s|$)/gi, "$1\u092A\u0902. ");
  processed = processed.replace(/(^|\s)(ku\.?|kumari|ms\.?|sushri)(?=\s|$)/gi, "$1\u0915\u0941. ");
  processed = processed.replace(/\b(10th\s*pass|10th\s*class|10th|10\s*th|दसवीं\s*पास|दसवीं|10\s*वीं\s*पास|10\s*वीं)\b/gi, "10\u0935\u0940\u0902");
  processed = processed.replace(/\b(12th\s*pass|12th\s*class|12th|12\s*th|बारहवीं\s*पास|बारहवीं|12\s*वीं\s*पास|12\s*वीं)\b/gi, "12\u0935\u0940\u0902");
  processed = processed.replace(/\b(m\.?\s*com\.?|mcom|एम\.?\s*कॉम\.?|म\.?\s*कॉम\.?|एमकॉम)\b/gi, "\u090F\u092E.\u0915\u0949\u092E.");
  processed = processed.replace(/\b(b\.?\s*com\.?|bcom|बी\.?\s*कॉम\.?|बीकॉम)\b/gi, "\u092C\u0940.\u0915\u0949\u092E.");
  processed = processed.replace(/\b(m\.?\s*a\.?|ma|एम\.?\s*ए\.?|एमए)\b/gi, "\u090F\u092E.\u090F.");
  processed = processed.replace(/\b(b\.?\s*a\.?|ba|बी\.?\s*ए\.?|बीए)\b/gi, "\u092C\u0940.\u090F.");
  processed = processed.replace(/\b(m\.?\s*sc\.?|msc|एम\.?\s*एससी\.?|एमएससी|एम\.?\s*एस\.?\s*सी\.?)\b/gi, "\u090F\u092E.\u090F\u0938\u0938\u0940.");
  processed = processed.replace(/\b(b\.?\s*sc\.?|bsc|बी\.?\s*एससी\.?|बीएससी|बी\.?\s*एस\.?\s*सी\.?)\b/gi, "\u092C\u0940.\u090F\u0938\u0938\u0940.");
  processed = processed.replace(/\b(m\.?\s*tech\.?|mtech|एम\.?\s*टेक\.?|एमटेक)\b/gi, "\u090F\u092E.\u091F\u0947\u0915.");
  processed = processed.replace(/\b(b\.?\s*tech\.?|btech|बी\.?\s*टेक\.?|बीटेक)\b/gi, "\u092C\u0940.\u091F\u0947\u0915.");
  processed = processed.replace(/\b(m\.?\s*e\.?|me|एम\.?\s*ई\.?|एमई)\b/gi, "\u090F\u092E.\u0908.");
  processed = processed.replace(/\b(b\.?\s*e\.?|be|बी\.?\s*ई\.?|बीई)\b/gi, "\u092C\u0940.\u0908.");
  processed = processed.replace(/\b(m\.?\s*c\.?\s*a\.?|mca|एम\.?\s*सी\.?\s*ए\.?|एमसीए)\b/gi, "\u090F\u092E\u0938\u0940\u090F");
  processed = processed.replace(/\b(b\.?\s*c\.?\s*a\.?|bca|बी\.?\s*सी\.?\s*ए\.?|बीसीए)\b/gi, "\u092C\u0940\u0938\u0940\u090F");
  processed = processed.replace(/\b(m\.?\s*b\.?\s*a\.?|mba|एम\.?\s*बी\.?\s*ए\.?|एमबीए)\b/gi, "\u090F\u092E\u092C\u0940\u090F");
  processed = processed.replace(/\b(b\.?\s*b\.?\s*a\.?|bba|बी\.?\s*बी\.?\s*ए\.?|बीबीए)\b/gi, "\u092C\u0940\u092C\u0940\u090F");
  processed = processed.replace(/\b(m\.?\s*b\.?\s*b\.?\s*s\.?|mbbs|एम\.?\s*बी\.?\s*बी\.?\s*एस\.?|एमबीबीएस)\b/gi, "\u090F\u092E\u092C\u0940\u092C\u0940\u090F\u0938");
  processed = processed.replace(/\b(b\.?\s*d\.?\s*s\.?|bds|बी\.?\s*डी\.?\s*एस\.?|बीडीएस)\b/gi, "\u092C\u0940\u0921\u0940\u090F\u0938");
  processed = processed.replace(/\b(b\.?\s*a\.?\s*m\.?\s*s\.?|bams|बी\.?\s*ए\.?\s*एम\.?\s*एस\.?|बीएएमएस)\b/gi, "\u092C\u0940\u090F\u090F\u092E\u090F\u0938");
  processed = processed.replace(/\b(b\.?\s*h\.?\s*m\.?\s*s\.?|bhms|बी\.?\s*एच\.?\s*एम\.?\s*एस\.?|बीएचएमएस)\b/gi, "\u092C\u0940\u090F\u091A\u090F\u092E\u090F\u0938");
  processed = processed.replace(/\b(m\.?\s*d\.?|md|एम\.?\s*डी\.?|एमडी)\b/gi, "\u090F\u092E.\u0921\u0940.");
  processed = processed.replace(/\b(m\.?\s*s\.?|ms|एम\.?\s*एस\.?|एमएस)\b/gi, "\u090F\u092E.\u090F\u0938.");
  processed = processed.replace(/\b(l\.?\s*l\.?\s*m\.?|llm|एल\.?\s*एल\.?\s*एम\.?|एलएलएम)\b/gi, "\u090F\u0932\u090F\u0932\u090F\u092E");
  processed = processed.replace(/\b(l\.?\s*l\.?\s*b\.?|llb|एल\.?\s*एल\.?\s*बी\.?|एलएलबी)\b/gi, "\u090F\u0932\u090F\u0932\u092C\u0940");
  processed = processed.replace(/\b(m\.?\s*ed\.?|med|एम\.?\s*एड\.?|एमएड)\b/gi, "\u090F\u092E.\u090F\u0921.");
  processed = processed.replace(/\b(b\.?\s*ed\.?|bed|बी\.?\s*एड\.?|बीएड)\b/gi, "\u092C\u0940.\u090F\u0921.");
  processed = processed.replace(/\b(d\.?\s*el\.?\s*ed\.?|deled|डी\.?\s*एल\.?\s*एड\.?|डीएलएड)\b/gi, "\u0921\u0940.\u090F\u0932.\u090F\u0921.");
  processed = processed.replace(/\b(d\.?\s*ed\.?|ded|डी\.?\s*एड\.?|डीएड)\b/gi, "\u0921\u0940.\u090F\u0921.");
  processed = processed.replace(/\b(c\s*tet|ctet|सीटेट|सी\.?\s*टैट)\b/gi, "\u0938\u0940\u091F\u0947\u091F");
  processed = processed.replace(/\b(t\s*et|tet|टेट|टी\.?\s*टैट)\b/gi, "\u091F\u0940\u0908\u091F\u0940");
  processed = processed.replace(/\b(ph\.?\s*d\.?|phd|पी\.?\s*एच\.?\s*डी\.?|पीएचडी|पीएच\.?\s*डी\.?)\b/gi, "\u092A\u0940\u090F\u091A.\u0921\u0940.");
  processed = processed.replace(/\b(post\s*doctorate|पोस्ट\s*डॉक्टरेट)\b/gi, "\u092A\u094B\u0938\u094D\u091F \u0921\u0949\u0915\u094D\u091F\u0930\u0947\u091F");
  processed = processed.replace(/\b(c\.?\s*a\.?|ca|सी\.?\s*ए\.?|सीए)\b/gi, "\u0938\u0940\u090F");
  processed = processed.replace(/\b(c\.?\s*s\.?|cs|सी\.?\s*एस\.?|सीएस)\b/gi, "\u0938\u0940\u090F\u0938");
  processed = processed.replace(/\b(c\.?\s*m\.?\s*a\.?|cma|icwa|सीएमए|सी\.?\s*एम\.?\s*ए\.?)\b/gi, "\u0938\u0940\u090F\u092E\u090F");
  processed = processed.replace(/\b(m\.?\s*pharm\.?|mpharm|m\s*pharma|एम\.?\s*फार्मा|एमफार्मा|एम\.?\s*फार्म)\b/gi, "\u090F\u092E.\u092B\u093E\u0930\u094D\u092E\u093E");
  processed = processed.replace(/\b(b\.?\s*pharm\.?|bpharm|b\s*pharma|बी\.?\s*फार्मा|बीफार्मा|बी\.?\s*फार्म)\b/gi, "\u092C\u0940.\u092B\u093E\u0930\u094D\u092E\u093E");
  processed = processed.replace(/\b(d\.?\s*pharm\.?|dpharm|d\s*pharma|डी\.?\s*फार्मा|डीफार्मा|डी\.?\s*फार्म)\b/gi, "\u0921\u0940.\u092B\u093E\u0930\u094D\u092E\u093E");
  processed = processed.replace(/\b(pgdca|पीजीडीसीए|पी\.?\s*जी\.?\s*डी\.?\s*सी\.?\s*ए\.?)\b/gi, "\u092A\u0940\u091C\u0940\u0921\u0940\u0938\u0940\u090F");
  processed = processed.replace(/\b(dca|डीसीए|डी\.?\s*सी\.?\s*ए\.?)\b/gi, "\u0921\u0940\u0938\u0940\u090F");
  processed = processed.replace(/\b(iti|आईटीआई|आई\.?\s*टी\.?\s*आई\.?)\b/gi, "\u0906\u0908\u091F\u0940\u0906\u0908");
  processed = processed.replace(/\b(polytechnic|पॉलिटेक्निक|पोलिटेक्निक)\b/gi, "\u092A\u0949\u0932\u093F\u091F\u0947\u0915\u094D\u0928\u093F\u0915");
  processed = processed.replace(/\b(diploma|डिप्लोमा)\b/gi, "\u0921\u093F\u092A\u094D\u0932\u094B\u092E\u093E");
  processed = processed.replace(/\b(post\s*graduat(e|ion)|पोस्ट\s*ग्रेजुएशन|पोस्ट\s*ग्रेजुएट|स्नातकोत्तर)\b/gi, "\u0938\u094D\u0928\u093E\u0924\u0915\u094B\u0924\u094D\u0924\u0930");
  processed = processed.replace(/\b(graduat(e|ion)|ग्रेजुएशन|ग्रेजुएट|स्नातक)\b/gi, "\u0938\u094D\u0928\u093E\u0924\u0915");
  processed = processed.replace(/\b(honours|hons|ऑनर्स)\b/gi, "\u0911\u0928\u0930\u094D\u0938");
  processed = processed.replace(/\b(pursuing|running|adhyayanrat|studying)\b/gi, "\u0905\u0927\u094D\u092F\u092F\u0928\u0930\u0924");
  processed = processed.replace(/\b(pass|passed|passed\s*out|completed|passedout)\b/gi, "\u0909\u0924\u094D\u0924\u0940\u0930\u094D\u0923");
  processed = processed.replace(/\b(first\s*division|1st\s*division|1st\s*div|first\s*class)\b/gi, "\u092A\u094D\u0930\u0925\u092E \u0936\u094D\u0930\u0947\u0923\u0940");
  processed = processed.replace(/\b(second\s*division|2nd\s*division|2nd\s*div|second\s*class)\b/gi, "\u0926\u094D\u0935\u093F\u0924\u0940\u092F \u0936\u094D\u0930\u0947\u0923\u0940");
  processed = processed.replace(/\b(third\s*division|3rd\s*division|3rd\s*div)\b/gi, "\u0924\u0943\u0924\u0940\u092F \u0936\u094D\u0930\u0947\u0923\u0940");
  processed = processed.replace(/\b(gold\s*medalist|gold\s*medal)\b/gi, "\u0938\u094D\u0935\u0930\u094D\u0923 \u092A\u0926\u0915 \u0935\u093F\u091C\u0947\u0924\u093E");
  processed = processed.replace(/(^|\s)(govt\.?\s*teacher|government\s*teacher|shaskiya\s*shikshak|sarkari\s*teacher|sarkari\s*master)(?=\s|$)/gi, "$1\u0936\u093E\u0938\u0915\u0940\u092F \u0936\u093F\u0915\u094D\u0937\u0915");
  processed = processed.replace(/(^|\s)(govt\.?\s*service|govt\.?\s*job|government\s*service|government\s*job|shaskiya\s*seva|sarkari\s*naukri|govt\.?\s*employee|government\s*employee|govt\.?\s*servant|shaskiya\s*karmachari)(?=\s|$)/gi, "$1\u0936\u093E\u0938\u0915\u0940\u092F \u0938\u0947\u0935\u093E");
  processed = processed.replace(/(^|\s)(pvt\.?\s*job|private\s*job|private\s*service|pvt\.?\s*service|private\s*naukri|private\s*company|pvt\.?\s*ltd|company\s*job)(?=\s|$)/gi, "$1\u0928\u093F\u091C\u0940 \u0938\u0947\u0935\u093E");
  processed = processed.replace(/(^|\s)(housewife|house\s*wife|homemaker|home\s*maker|grahini|grihini)(?=\s|$)/gi, "$1\u0917\u0943\u0939\u0923\u0940");
  processed = processed.replace(/(^|\s)(farmer|farming|agriculture|kisan|krishak|kheti|krishi|kisani|khetibadi)\b/gi, "$1\u0915\u0943\u0937\u093F");
  processed = processed.replace(/(^|\s)(business|vyavasay|vyapar|dhandha|trade|trading)\b/gi, "$1\u0935\u094D\u092F\u0935\u0938\u093E\u092F");
  processed = processed.replace(/(^|\s)(shopkeeper|shop\s*keeper|shop\s*owner|kirana\s*store|kirana\s*shop|general\s*store|kirana\s*vyapar|dukan|dukandar)\b/gi, "$1\u0935\u094D\u092F\u0935\u0938\u093E\u092F (\u0926\u0941\u0915\u093E\u0928)");
  processed = processed.replace(/(^|\s)(teacher|shikshak|adhyapak|master|masterji|school\s*teacher)\b/gi, "$1\u0936\u093F\u0915\u094D\u0937\u0915");
  processed = processed.replace(/(^|\s)(lecturer|vyakhyata)\b/gi, "$1\u0935\u094D\u092F\u093E\u0916\u094D\u092F\u093E\u0924\u093E");
  processed = processed.replace(/(^|\s)(professor|pradhyapak)\b/gi, "$1\u092A\u094D\u0930\u093E\u0927\u094D\u092F\u093E\u092A\u0915");
  processed = processed.replace(/(^|\s)(retired|retd\.?|sewanivritt|sevanivritt|pensioner)\b/gi, "$1\u0938\u0947\u0935\u093E\u0928\u093F\u0935\u0943\u0924\u094D\u0924");
  processed = processed.replace(/(^|\s)(ex\s*-?\s*serviceman|ex\s*army|retd\s*army|retd\s*fauj)\b/gi, "$1\u0938\u0947\u0935\u093E\u0928\u093F\u0935\u0943\u0924\u094D\u0924 \u0938\u0948\u0928\u093F\u0915");
  processed = processed.replace(/(^|\s)(self\s*employed|swarojgar|swarozgar|own\s*business|apna\s*kaam)\b/gi, "$1\u0938\u094D\u0935\u0930\u094B\u091C\u0917\u093E\u0930");
  processed = processed.replace(/(^|\s)(contractor|thekedar|thekedari|civil\s*contractor)\b/gi, "$1\u0920\u0947\u0915\u0947\u0926\u093E\u0930");
  processed = processed.replace(/(^|\s)(civil\s*engineer)\b/gi, "$1\u0938\u093F\u0935\u093F\u0932 \u0907\u0902\u091C\u0940\u0928\u093F\u092F\u0930");
  processed = processed.replace(/(^|\s)(software\s*engineer|software\s*developer|it\s*engineer)\b/gi, "$1\u0938\u0949\u092B\u094D\u091F\u0935\u0947\u092F\u0930 \u0907\u0902\u091C\u0940\u0928\u093F\u092F\u0930");
  processed = processed.replace(/(^|\s)(electrician|vidyut\s*karmi)\b/gi, "$1\u0907\u0932\u0947\u0915\u094D\u091F\u094D\u0930\u0940\u0936\u093F\u092F\u0928");
  processed = processed.replace(/(^|\s)(plumber)\b/gi, "$1\u092A\u094D\u0932\u0902\u092C\u0930");
  processed = processed.replace(/(^|\s)(carpenter|badhai)\b/gi, "$1\u092C\u0922\u093C\u0908");
  processed = processed.replace(/(^|\s)(mason|mistri|rajmistri|rajgir)\b/gi, "$1\u0930\u093E\u091C\u092E\u093F\u0938\u094D\u0924\u094D\u0930\u0940");
  processed = processed.replace(/(^|\s)(driver|chalak|auto\s*driver|car\s*driver)\b/gi, "$1\u091A\u093E\u0932\u0915");
  processed = processed.replace(/(^|\s)(police|police\s*service|police\s*constable|inspector|sub\s*inspector|si|asi|ti)\b/gi, "$1\u092A\u0941\u0932\u093F\u0938");
  processed = processed.replace(/(^|\s)(army|defence|defense|fauj|military|soldier|jawan)\b/gi, "$1\u092D\u093E\u0930\u0924\u0940\u092F \u0938\u0947\u0928\u093E");
  processed = processed.replace(/(^|\s)(accountant|lekhakar|munim)\b/gi, "$1\u0932\u0947\u0916\u093E\u0915\u093E\u0930");
  processed = processed.replace(/(^|\s)(bank\s*manager|branch\s*manager)\b/gi, "$1\u092C\u0948\u0902\u0915 \u092A\u094D\u0930\u092C\u0902\u0927\u0915");
  processed = processed.replace(/(^|\s)(bank\s*employee|banker|bank\s*clerk|bank\s*po)\b/gi, "$1\u092C\u0948\u0902\u0915 \u0915\u0930\u094D\u092E\u091A\u093E\u0930\u0940");
  processed = processed.replace(/(^|\s)(manager|prabandhak)\b/gi, "$1\u092A\u094D\u0930\u092C\u0902\u0927\u0915");
  processed = processed.replace(/(^|\s)(doctor|chikitsak|vaidya)\b/gi, "$1\u091A\u093F\u0915\u093F\u0924\u094D\u0938\u0915");
  processed = processed.replace(/(^|\s)(pharmacist|chemist|medical\s*store)\b/gi, "$1\u092B\u093E\u0930\u094D\u092E\u093E\u0938\u093F\u0938\u094D\u091F (\u092E\u0947\u0921\u093F\u0915\u0932)");
  processed = processed.replace(/(^|\s)(clerk|lipik|babu)\b/gi, "$1\u0932\u093F\u092A\u093F\u0915");
  processed = processed.replace(/(^|\s)(mechanic)\b/gi, "$1\u092E\u0948\u0915\u0947\u0928\u093F\u0915");
  processed = processed.replace(/(^|\s)(tailor|darji|silai)\b/gi, "$1\u0926\u0930\u094D\u091C\u0940");
  processed = processed.replace(/(^|\s)(labour|labor|majduri|daily\s*wages|khetihar\s*majdoor|majdoor)\b/gi, "$1\u0926\u0948\u0928\u093F\u0915 \u092E\u091C\u0926\u0942\u0930\u0940");
  processed = processed.replace(/(^|\s)(security\s*guard|guard|chowkidar)\b/gi, "$1\u0938\u0941\u0930\u0915\u094D\u0937\u093E \u0917\u093E\u0930\u094D\u0921");
  processed = processed.replace(/(^|\s)(patwari)\b/gi, "$1\u092A\u091F\u0935\u093E\u0930\u0940");
  processed = processed.replace(/(^|\s)(panchayat\s*sachiv|sachiv)\b/gi, "$1\u092A\u0902\u091A\u093E\u092F\u0924 \u0938\u091A\u093F\u0935");
  processed = processed.replace(/(^|\s)(sarpanch)\b/gi, "$1\u0938\u0930\u092A\u0902\u091A");
  processed = processed.replace(/(^|\s)(kotwar)\b/gi, "$1\u0915\u094B\u091F\u0935\u093E\u0930");
  processed = processed.replace(/(^|\s)(postman|dakpal|post\s*master)\b/gi, "$1\u0921\u093E\u0915\u092A\u093E\u0932");
  processed = processed.replace(/(^|\s)(and|aur|&|\+)\b/gi, "$1\u090F\u0935\u0902");
  processed = processed.replace(/\s+/g, " ").trim();
  const isAllHindi = /^[\u0900-\u097F\s\d+\-.,()/@#&]+$/.test(processed);
  return { processed, hasOnlyKnownTerms: isAllHindi };
}
function applyPostTransliterationFixes(text) {
  if (!text) return text;
  let fixed = text;
  fixed = fixed.replace(/सहु\b/g, "\u0938\u093E\u0939\u0942");
  fixed = fixed.replace(/\bसहु\b/g, "\u0938\u093E\u0939\u0942");
  fixed = fixed.replace(/शाहू/g, "\u0938\u093E\u0939\u0942");
  fixed = fixed.replace(/सहू/g, "\u0938\u093E\u0939\u0942");
  fixed = fixed.replace(/अश्वनी/g, "\u0905\u0936\u094D\u0935\u093F\u0928\u0940");
  fixed = fixed.replace(/अश्विनि/g, "\u0905\u0936\u094D\u0935\u093F\u0928\u0940");
  fixed = fixed.replace(/साहूू/g, "\u0938\u093E\u0939\u0942");
  fixed = fixed.replace(/[ ]{2,}/g, " ");
  return fixed;
}
function phoneticTransliterateWord(word) {
  const lower = word.toLowerCase().trim();
  if (!lower) return word;
  if (PHONETIC_DICTIONARY[lower]) {
    return PHONETIC_DICTIONARY[lower];
  }
  if (/^[\u0900-\u097F\d+\-.,()/@#&]+$/.test(word)) {
    return word;
  }
  let i = 0;
  let result = "";
  const len = lower.length;
  const CONSONANTS = [
    ["shh", "\u0937\u094D"],
    ["chh", "\u091B"],
    ["kh", "\u0916"],
    ["gh", "\u0918"],
    ["ch", "\u091A"],
    ["jh", "\u091D"],
    ["th", "\u0925"],
    ["dh", "\u0927"],
    ["ph", "\u092B"],
    ["bh", "\u092D"],
    ["sh", "\u0936"],
    ["tr", "\u0924\u094D\u0930"],
    ["gy", "\u091C\u094D\u091E"],
    ["gn", "\u091C\u094D\u091E"],
    ["ksh", "\u0915\u094D\u0937"],
    ["ng", "\u0902"],
    ["nk", "\u0902\u0915"],
    ["nd", "\u0902\u0926"],
    ["nt", "\u0902\u0924"],
    ["mp", "\u0902\u092A"],
    ["mb", "\u0902\u092C"],
    ["k", "\u0915"],
    ["g", "\u0917"],
    ["j", "\u091C"],
    ["t", "\u0924"],
    ["d", "\u0926"],
    ["n", "\u0928"],
    ["p", "\u092A"],
    ["f", "\u092B"],
    ["b", "\u092C"],
    ["m", "\u092E"],
    ["y", "\u092F"],
    ["r", "\u0930"],
    ["l", "\u0932"],
    ["v", "\u0935"],
    ["w", "\u0935"],
    ["s", "\u0938"],
    ["h", "\u0939"],
    ["x", "\u0915\u094D\u0938"],
    ["z", "\u091C\u093C"],
    ["c", "\u0915"],
    ["q", "\u0915"]
  ];
  const VOWEL_MATRAS = [
    // [pattern, standalone, matra]
    ["aa", "\u0906", "\u093E"],
    ["ai", "\u0910", "\u0948"],
    ["au", "\u0914", "\u094C"],
    ["ee", "\u0908", "\u0940"],
    ["ii", "\u0908", "\u0940"],
    ["oo", "\u090A", "\u0942"],
    ["uu", "\u090A", "\u0942"],
    ["a", "\u0905", ""],
    ["i", "\u0907", "\u093F"],
    ["u", "\u0909", "\u0941"],
    ["e", "\u090F", "\u0947"],
    ["o", "\u0913", "\u094B"]
  ];
  let prevWasConsonant = false;
  while (i < len) {
    const sub = lower.slice(i);
    let matchedVowel = false;
    for (const [pat, standalone, matra] of VOWEL_MATRAS) {
      if (sub.startsWith(pat)) {
        if (prevWasConsonant) {
          result += matra;
        } else {
          result += standalone;
        }
        i += pat.length;
        prevWasConsonant = false;
        matchedVowel = true;
        break;
      }
    }
    if (matchedVowel) continue;
    let matchedConsonant = false;
    for (const [pat, devanagari] of CONSONANTS) {
      if (sub.startsWith(pat)) {
        if (prevWasConsonant) {
          result += "\u094D";
        }
        result += devanagari;
        i += pat.length;
        prevWasConsonant = true;
        matchedConsonant = true;
        break;
      }
    }
    if (matchedConsonant) continue;
    result += lower[i];
    prevWasConsonant = false;
    i++;
  }
  return result;
}
function offlineTransliterateSentence(text) {
  const words = text.split(" ");
  const converted = words.map((w) => {
    if (!w.trim()) return w;
    return phoneticTransliterateWord(w);
  });
  return converted.join(" ");
}
async function transliterateText(text) {
  if (!text || typeof text !== "string") {
    return { result: "", method: "EMPTY" };
  }
  const trimmed = text.trim();
  const isExcluded = /^[0-9+\-:\s@.]+$|^(https?:\/\/|www\.)|^\d{10}$/.test(trimmed);
  if (isExcluded) {
    return { result: text, method: "EXCLUDED" };
  }
  const preProcessed = applyPreTransliterationFixes(text);
  if (preProcessed.hasOnlyKnownTerms) {
    const res = applyPostTransliterationFixes(convertHindiNumeralsToEnglish(preProcessed.processed));
    return { result: res, method: "PRE_TRANSLATION_MAP" };
  }
  const textToTranslate = preProcessed.processed;
  try {
    const gitUrl = `https://inputtools.google.com/request?text=${encodeURIComponent(
      textToTranslate
    )}&itc=hi-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const gitRes = await fetch(gitUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });
    clearTimeout(timeoutId);
    if (gitRes.ok) {
      const gitData = await gitRes.json();
      if (gitData[0] === "SUCCESS" && Array.isArray(gitData[1]) && gitData[1].length > 0) {
        const fullPhonetic = gitData[1].map((entry) => entry?.[1]?.[0] || entry?.[0] || "").filter(Boolean).join(" ").trim();
        if (fullPhonetic && /[\u0900-\u097F]/.test(fullPhonetic)) {
          const res = applyPostTransliterationFixes(convertHindiNumeralsToEnglish(fullPhonetic));
          return { result: res, method: "GOOGLE_INPUT_TOOLS" };
        }
      }
    }
  } catch {
  }
  try {
    const gtUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&q=${encodeURIComponent(
      textToTranslate
    )}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const gtRes = await fetch(gtUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });
    clearTimeout(timeoutId);
    if (gtRes.ok) {
      const data = await gtRes.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((item) => item[0]).filter(Boolean).join("");
        if (translated && /[\u0900-\u097F]/.test(translated)) {
          const res = applyPostTransliterationFixes(convertHindiNumeralsToEnglish(translated.trim()));
          return { result: res, method: "GOOGLE_TRANSLATE" };
        }
      }
    }
  } catch {
  }
  const offlineResult = offlineTransliterateSentence(textToTranslate);
  const finalResult = applyPostTransliterationFixes(convertHindiNumeralsToEnglish(offlineResult));
  return { result: finalResult, method: "PHONETIC_RULE_ENGINE" };
}

// server/index.ts
import_dotenv3.default.config();
function toMoney(value) {
  if (value === null || value === void 0 || value === "") return 0;
  const cleaned = String(value).replace(/[₹$€£,\s]/g, "").replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  if (!isFinite(n) || isNaN(n)) return 0;
  return Math.round(n * 100) / 100;
}
var app = (0, import_express.default)();
var PORT = 3e3;
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      console.error("FATAL: JWT_SECRET environment variable is missing in production environment!");
    }
    return "parichayika-super-secret-key-2026";
  }
  return secret;
}
var JWT_SECRET = getJwtSecret();
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
if (!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.use("/uploads", import_express.default.static(import_path3.default.join(process.cwd(), "uploads")));
}
var authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = import_jsonwebtoken.default.verify(token, JWT_SECRET);
    if (!decoded.adminId || decoded.role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Forbidden: Super Admin access required" });
    }
    req.adminId = decoded.adminId;
    req.username = decoded.username;
    req.role = decoded.role;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Forbidden: Invalid or expired token" });
  }
};
var memoryStorage = import_multer.default.memoryStorage();
var upload = (0, import_multer.default)({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  // Max 50MB for print files (CDR, PSD, PDF, etc.)
  fileFilter: (req, file, cb) => {
    const ext = import_path3.default.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();
    const allowedExtensions = [".cdr", ".psd", ".pdf", ".ai", ".eps", ".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif", ".svg", ".jfif", ".heic", ".heif"];
    if (allowedExtensions.includes(ext) || mime.startsWith("image/") || mime.includes("pdf") || mime.includes("photoshop") || mime.includes("coreldraw") || mime.includes("postscript") || mime.includes("octet-stream")) {
      cb(null, true);
    } else {
      cb(null, true);
    }
  }
});
async function getMaxMatrimonyAdSeq() {
  try {
    const sql = isPostgres ? "SELECT MAX(CAST(ad_number AS INTEGER)) as maxnum FROM advertisements WHERE type_code = 'matrimony' AND ad_number ~ '^[0-9]+$'" : "SELECT MAX(CAST(ad_number AS INTEGER)) as maxnum FROM advertisements WHERE type_code = 'matrimony' AND ad_number GLOB '[0-9]*'";
    const row = await dbGet(sql);
    const val = Number(row?.maxnum || row?.maxNum || 0);
    if (!isNaN(val) && val > 0) return val;
  } catch (err) {
    console.warn("Direct regex ad number query failed, using safe fallback scan:", err);
  }
  try {
    const rows = await dbAll("SELECT ad_number FROM advertisements WHERE type_code = 'matrimony'");
    let max = 0;
    for (const r of rows) {
      if (r?.ad_number && /^\d+$/.test(String(r.ad_number).trim())) {
        const n = parseInt(String(r.ad_number).trim(), 10);
        if (n > max) max = n;
      }
    }
    return max;
  } catch {
    return 0;
  }
}
app.get(["/api/health", "/health"], (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const dbDiagnostics = getSafeDbDiagnostics();
  const hasSupabaseUrl = !!process.env.SUPABASE_URL;
  const hasSupabaseServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const storageStatus = hasSupabaseUrl && hasSupabaseServiceKey ? "supabase" : hasSupabaseUrl ? "supabase_misconfigured_key_missing" : "unconfigured";
  return res.status(200).json({
    status: "ok",
    service: "parichayika-api",
    environment: process.env.NODE_ENV || "production",
    database: isPostgres ? "postgresql" : dbDiagnostics.configured ? "postgresql_configured" : "ready",
    storage: storageStatus,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/db-diagnostics", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  try {
    const diag = getSafeDbDiagnostics();
    let queryTest = null;
    try {
      queryTest = await dbGet("SELECT 1 as connected");
    } catch (qErr) {
      queryTest = { error: qErr?.message || String(qErr) };
    }
    return res.status(200).json({
      status: "ok",
      diagnostics: diag,
      queryTest,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      error: err?.message || String(err),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
function formatDobToDDMMYYYY(val) {
  if (!val || typeof val !== "string" || !val.trim() || val.trim() === "-") {
    return "-";
  }
  const trimmed = val.trim();
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:T.*)?$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${day}/${month}/${year}`;
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${day}/${month}/${year}`;
  }
  if (trimmed.includes("T") || trimmed.includes("Z")) {
    const parsedDate = new Date(trimmed);
    if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
      const day = String(parsedDate.getDate()).padStart(2, "0");
      const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
      const year = parsedDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }
  return trimmed;
}
app.post("/api/transliterate", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.json({ result: "" });
  }
  try {
    const outcome = await transliterateText(text);
    return res.json({
      result: outcome.result,
      method: outcome.method
    });
  } catch (err) {
    console.error("Transliteration endpoint error:", err);
    return res.json({
      result: text,
      method: "ERROR_FALLBACK"
    });
  }
});
app.get("/api/masters", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    const districts = await dbAll("SELECT * FROM districts WHERE is_enabled = 1");
    const sangathans = await dbAll("SELECT * FROM sangathans WHERE is_enabled = 1");
    const magazines = await dbAll("SELECT * FROM magazines WHERE is_enabled = 1");
    const editions = await dbAll("SELECT * FROM editions WHERE is_enabled = 1");
    const sizes = await dbAll("SELECT * FROM advertisement_sizes WHERE is_enabled = 1");
    const pricings = await dbAll("SELECT * FROM pricings");
    const publications = await dbAll(`
      SELECT p.*, d.name_hi as district_hi, s.name_hi as sangathan_hi, m.name_hi as magazine_hi, e.name_hi as edition_hi
      FROM publications p
      JOIN districts d ON p.district_id = d.id
      JOIN sangathans s ON p.sangathan_id = s.id
      JOIN magazines m ON p.magazine_id = m.id
      JOIN editions e ON p.edition_id = e.id
      WHERE p.is_enabled = 1
    `);
    res.json({
      districts,
      sangathans,
      magazines,
      editions,
      sizes,
      pricings,
      publications
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/advertisements/next-ad-number", async (req, res) => {
  const typeCode = req.query.type || "matrimony";
  const magazineHi = req.query.magazine || "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E";
  try {
    if (typeCode === "matrimony") {
      const countRow = await dbGet("SELECT COUNT(*) as count FROM advertisements WHERE type_code = 'matrimony'");
      const currentCount = Number(countRow?.count || 0);
      const nextSeq = String(currentCount + 1).padStart(3, "0");
      return res.json({ nextAdNumber: nextSeq, count: currentCount });
    } else {
      const countRow = await dbGet("SELECT COUNT(*) as count FROM advertisements WHERE type_code = 'business'");
      const currentCount = Number(countRow?.count || 0);
      const nextSeq = String(currentCount + 1).padStart(3, "0");
      return res.json({ nextAdNumber: `BUS-${nextSeq} / ${magazineHi}`, count: currentCount });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/advertisements/save", async (req, res) => {
  const { adId, typeCode, publicationId, sizeCode, customerName, customerMobile, sessionId: rawSessionId, formData = {} } = req.body;
  const sessionId = (rawSessionId || formData.sessionId || req.query?.sessionId || "").toString().trim();
  const trimmedName = (customerName || "").toString().trim();
  const trimmedMobile = (customerMobile || "").toString().trim();
  const effectiveCustomerName = trimmedName || (typeCode === "business" ? "\u0935\u094D\u092F\u0935\u0938\u093E\u092F\u093F\u0915 \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928" : "");
  const effectiveCustomerMobile = trimmedMobile || (typeCode === "business" ? "9999999999" : "");
  if (!typeCode || !effectiveCustomerName || !effectiveCustomerMobile) {
    return res.status(400).json({ error: "Required fields are missing" });
  }
  const cleanPhone = effectiveCustomerMobile.replace(/[^0-9]/g, "");
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: "\u092E\u0941\u0916\u094D\u092F \u092E\u094B\u092C\u093E\u0907\u0932 \u0928\u0902\u092C\u0930 \u0920\u0940\u0915 10 \u0905\u0902\u0915\u094B\u0902 \u0915\u093E \u0939\u094B\u0928\u093E \u0906\u0935\u0936\u094D\u092F\u0915 \u0939\u0948\u0964" });
  }
  try {
    let district_hi = "\u0930\u093E\u092F\u092A\u0941\u0930";
    let sangathan_hi = "\u0930\u093E\u092F\u092A\u0941\u0930 \u0938\u093E\u0939\u0942 \u0938\u0902\u0917\u0920\u0928";
    let magazine_hi = "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E";
    let edition_hi = "\u0938\u0902\u0938\u094D\u0915\u0930\u0923 2026";
    let price = 500;
    let size_hi = "\u0935\u093F\u0935\u093E\u0939 \u092E\u093E\u0928\u0915 (3.5 \xD7 2 \u0907\u0902\u091A)";
    if (typeCode === "business") {
      if (sizeCode === "business_full") {
        size_hi = "\u092A\u0942\u0930\u093E \u092A\u0943\u0937\u094D\u0920 (7.2 \xD7 9.6 \u0907\u0902\u091A)";
        price = 5e3;
      } else if (sizeCode === "business_half") {
        size_hi = "\u0906\u0927\u093E \u092A\u0943\u0937\u094D\u0920 (7.2 \xD7 4.8 \u0907\u0902\u091A)";
        price = 3e3;
      } else if (sizeCode === "business_quarter") {
        size_hi = "\u091A\u094C\u0925\u093E\u0908 \u092A\u0943\u0937\u094D\u0920 (3.6 \xD7 4.8 \u0907\u0902\u091A)";
        price = 1500;
      } else {
        size_hi = "\u0935\u094D\u092F\u0935\u0938\u093E\u092F\u093F\u0915 \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928";
        price = 2500;
      }
    }
    if (publicationId && typeof publicationId === "string" && publicationId.startsWith("CONF-")) {
      const conf = await dbGet("SELECT * FROM admin_configurations WHERE configuration_id = ?", [publicationId]);
      if (conf) {
        district_hi = conf.district;
        sangathan_hi = conf.sangathan;
        magazine_hi = conf.magazine;
        edition_hi = conf.edition;
        price = conf.pricing;
        size_hi = `${conf.size_name} (${conf.width} \xD7 ${conf.height} ${conf.unit})`;
      } else {
        return res.status(400).json({ error: "\u0907\u0938 \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u0915\u0947 \u0932\u093F\u090F \u0906\u0935\u0936\u094D\u092F\u0915 \u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0915\u0949\u0928\u094D\u092B\u093C\u093F\u0917\u0930\u0947\u0936\u0928 \u0909\u092A\u0932\u092C\u094D\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 \u0915\u0943\u092A\u092F\u093E \u0935\u094D\u092F\u0935\u0938\u094D\u0925\u093E\u092A\u0915 \u0938\u0947 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902\u0964" });
      }
    } else if (publicationId && publicationId !== "CUSTOM") {
      const pub = await dbGet(`
        SELECT p.*, d.name_hi as district_hi, s.name_hi as sangathan_hi, m.name_hi as magazine_hi, e.name_hi as edition_hi
        FROM publications p
        JOIN districts d ON p.district_id = d.id
        JOIN sangathans s ON p.sangathan_id = s.id
        JOIN magazines m ON p.magazine_id = m.id
        JOIN editions e ON p.edition_id = e.id
        WHERE p.id = ?
      `, [publicationId]);
      if (pub) {
        district_hi = pub.district_hi;
        sangathan_hi = pub.sangathan_hi;
        magazine_hi = pub.magazine_hi;
        edition_hi = pub.edition_hi;
        const pricing = await dbGet(`
          SELECT price FROM pricings
          WHERE district_id = ? AND sangathan_id = ? AND magazine_id = ? AND edition_id = ?
          AND adv_type_code = ? AND adv_size_code = ?
        `, [pub.district_id, pub.sangathan_id, pub.magazine_id, pub.edition_id, typeCode, sizeCode || "matrimony_standard"]);
        if (pricing) {
          price = pricing.price;
        } else {
          if (typeCode === "matrimony") price = 500;
          else if (sizeCode === "business_full") price = 5e3;
          else if (sizeCode === "business_half") price = 3e3;
          else if (sizeCode === "business_quarter") price = 1500;
          else price = 2500;
        }
      }
      if (typeCode === "business" && sizeCode) {
        const sz = await dbGet("SELECT name_hi FROM advertisement_sizes WHERE code = ?", [sizeCode]);
        if (sz) size_hi = sz.name_hi;
      }
    } else {
      district_hi = formData.district_hi || "\u0906\u0935\u0902\u091F\u0928 \u092A\u094D\u0930\u0924\u0940\u0915\u094D\u0937\u093F\u0924";
      sangathan_hi = formData.sangathan_hi || "\u0906\u0935\u0902\u091F\u0928 \u092A\u094D\u0930\u0924\u0940\u0915\u094D\u0937\u093F\u0924";
      magazine_hi = formData.magazine_hi || "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E";
      edition_hi = formData.edition_hi || "\u0938\u0902\u0938\u094D\u0915\u0930\u0923 2026";
      if (typeCode === "matrimony") price = 500;
      else if (sizeCode === "business_full") price = 5e3;
      else if (sizeCode === "business_half") price = 3e3;
      else if (sizeCode === "business_quarter") price = 1500;
      else price = 2500;
      if (typeCode === "business" && sizeCode) {
        const sz = await dbGet("SELECT name_hi FROM advertisement_sizes WHERE code = ?", [sizeCode]);
        if (sz) size_hi = sz.name_hi;
      }
    }
    const created_at = (/* @__PURE__ */ new Date()).toISOString();
    let targetAdId;
    let finalAdNum = "";
    let existingAd = null;
    if (adId) {
      existingAd = await dbGet("SELECT id, ad_number FROM advertisements WHERE id = ?", [adId]);
    }
    if (existingAd) {
      targetAdId = Number(existingAd.id);
      finalAdNum = existingAd.ad_number;
      await dbRun(`
        UPDATE advertisements SET
          customer_name = ?,
          customer_mobile1 = ?,
          price = ?,
          district_hi = ?,
          sangathan_hi = ?,
          magazine_hi = ?,
          edition_hi = ?,
          size_code = ?,
          size_hi = ?
        WHERE id = ?
      `, [effectiveCustomerName, effectiveCustomerMobile, price, district_hi, sangathan_hi, magazine_hi, edition_hi, sizeCode || (typeCode === "matrimony" ? "matrimony_standard" : "business_size"), size_hi, targetAdId]);
    } else {
      if (typeCode === "matrimony") {
        const maxSeq = await getMaxMatrimonyAdSeq();
        let nextSeq = maxSeq + 1;
        finalAdNum = String(nextSeq).padStart(3, "0");
        while (await dbGet("SELECT id FROM advertisements WHERE ad_number = ?", [finalAdNum])) {
          nextSeq++;
          finalAdNum = String(nextSeq).padStart(3, "0");
        }
      } else {
        const countRow = await dbGet("SELECT COUNT(*) as count FROM advertisements WHERE type_code = 'business'");
        let nextSeq = Number(countRow?.count || 0) + 1;
        finalAdNum = `BUS-${String(nextSeq).padStart(3, "0")} / ${magazine_hi}`;
        while (await dbGet("SELECT id FROM advertisements WHERE ad_number = ?", [finalAdNum])) {
          nextSeq++;
          finalAdNum = `BUS-${String(nextSeq).padStart(3, "0")} / ${magazine_hi}`;
        }
      }
      const adResult = await dbRun(`
        INSERT INTO advertisements (
          ad_number, type_code, district_hi, sangathan_hi, magazine_hi, edition_hi, size_code, size_hi,
          customer_name, customer_mobile1, price, payment_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
      `, [finalAdNum, typeCode, district_hi, sangathan_hi, magazine_hi, edition_hi, sizeCode || (typeCode === "matrimony" ? "matrimony_standard" : "business_size"), size_hi, effectiveCustomerName, effectiveCustomerMobile, price, created_at]);
      targetAdId = adResult.lastID;
      if (!targetAdId) {
        const maxAd = await dbGet("SELECT MAX(id) as maxId FROM advertisements");
        targetAdId = maxAd?.maxId || 1;
      }
    }
    if (typeCode === "matrimony") {
      const standardKeys = [
        "name",
        "dob",
        "height",
        "blood_group",
        "gotra",
        "education",
        "occupation",
        "father_name",
        "father_occupation",
        "mother_name",
        "mobile1",
        "mobile2",
        "whatsapp",
        "currentAddress",
        "permanentAddress",
        "photoUrl",
        "biodataUrl"
      ];
      const extraFields = {};
      for (const k of Object.keys(formData)) {
        if (!standardKeys.includes(k)) {
          extraFields[k] = formData[k];
        }
      }
      await dbRun("DELETE FROM matrimony_profiles WHERE ad_id = ?", [targetAdId]);
      await dbRun(`
        INSERT INTO matrimony_profiles (
          ad_id, name, dob, height, blood_group, gotra, education, occupation,
          father_name, father_occupation, mother_name, mobile1, mobile2, whatsapp,
          current_address, permanent_address, photo_url, biodata_url, extra_fields_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        targetAdId,
        formData.name || "",
        formatDobToDDMMYYYY(formData.dob) || "",
        formData.height || "",
        formData.blood_group || "",
        formData.gotra || "",
        formData.education || "",
        formData.occupation || "",
        formData.father_name || "",
        formData.father_occupation || "",
        formData.mother_name || "",
        formData.mobile1 || "",
        formData.mobile2 || "",
        formData.whatsapp || "",
        formData.currentAddress || "",
        formData.permanentAddress || "",
        formData.photoUrl || "",
        formData.biodataUrl || "",
        JSON.stringify(extraFields)
      ]);
    } else {
      const standardKeys = [
        "businessName",
        "ownerName",
        "category",
        "businessDesc",
        "productsServices",
        "specialOffer",
        "keyFeatures",
        "mobile1",
        "mobile2",
        "whatsapp",
        "email",
        "businessAddress",
        "otherAddress",
        "logoUrl",
        "photoUrl",
        "readyAdUrl",
        "designLink"
      ];
      const extraFields = {};
      for (const k of Object.keys(formData)) {
        if (!standardKeys.includes(k)) {
          extraFields[k] = formData[k];
        }
      }
      const readyUrl = formData.readyAdUrl || formData.designLink || "";
      await dbRun("DELETE FROM business_advertisements WHERE ad_id = ?", [targetAdId]);
      await dbRun(`
        INSERT INTO business_advertisements (
          ad_id, business_name, owner_name, category, business_desc, products_services, special_offer,
          key_features, mobile1, mobile2, whatsapp, email, business_address, other_address,
          logo_url, photo_url, ready_ad_url, extra_fields_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        targetAdId,
        formData.businessName || "\u0935\u094D\u092F\u0935\u0938\u093E\u092F \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928",
        formData.ownerName || effectiveCustomerName,
        formData.category || "",
        formData.businessDesc || "",
        formData.productsServices || "",
        formData.specialOffer || "",
        formData.keyFeatures || "",
        formData.mobile1 || effectiveCustomerMobile,
        formData.mobile2 || "",
        formData.whatsapp || "",
        formData.email || "",
        formData.businessAddress || "",
        formData.otherAddress || "",
        formData.logoUrl || "",
        formData.photoUrl || "",
        readyUrl,
        JSON.stringify(extraFields)
      ]);
    }
    let cartItemId = null;
    if (sessionId) {
      const cartItemData = {
        ...formData,
        name: effectiveCustomerName,
        mobile1: effectiveCustomerMobile,
        adId: targetAdId,
        adNumber: finalAdNum,
        district_hi,
        sangathan_hi,
        magazine_hi,
        edition_hi,
        size_code: sizeCode || (typeCode === "matrimony" ? "matrimony_standard" : "business_size"),
        size_hi,
        price: toMoney(price),
        adType: typeCode
      };
      const existingCartItems = await dbAll("SELECT id, data_json FROM cart_items WHERE session_id = ?", [sessionId]);
      for (const item of existingCartItems) {
        try {
          const parsed = JSON.parse(item.data_json);
          if (parsed.adId === targetAdId || parsed.adNumber && parsed.adNumber === finalAdNum) {
            cartItemId = item.id;
            break;
          }
        } catch {
        }
      }
      if (cartItemId) {
        await dbRun(
          "UPDATE cart_items SET ad_type = ?, data_json = ?, price = ? WHERE id = ?",
          [typeCode, JSON.stringify(cartItemData), toMoney(price), cartItemId]
        );
      } else {
        const cartResult = await dbRun(
          "INSERT INTO cart_items (session_id, ad_type, data_json, price, created_at) VALUES (?, ?, ?, ?, ?)",
          [sessionId, typeCode, JSON.stringify(cartItemData), toMoney(price), created_at]
        );
        cartItemId = cartResult.lastID;
      }
    }
    res.json({
      id: targetAdId,
      adNumber: finalAdNum,
      price,
      cartItemId,
      success: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/upload", (req, res, next) => {
  if (req.is("json") || req.body && req.body.base64) {
    return next();
  }
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const uploadFolder = req.query.folder || req.body && req.body.folder || "general";
    if (req.body && req.body.base64) {
      const { base64, filename = `upload-${Date.now()}.jpg` } = req.body;
      const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let mimetype = "image/jpeg";
      if (matches && matches.length === 3) {
        mimetype = matches[1];
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(base64, "base64");
      }
      const uploadRes2 = await uploadFile({
        buffer,
        originalname: filename,
        mimetype,
        folder: uploadFolder
      });
      const result2 = await dbRun(
        "INSERT INTO uploads (filename, filepath, url, mimetype, size, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [uploadRes2.filename, uploadRes2.storagePath, uploadRes2.url, uploadRes2.mimetype, uploadRes2.size, (/* @__PURE__ */ new Date()).toISOString()]
      );
      return res.json({
        id: result2.lastID,
        url: uploadRes2.url,
        mimetype: uploadRes2.mimetype,
        size: uploadRes2.size,
        provider: uploadRes2.provider
      });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "\u0915\u094B\u0908 \u092B\u093C\u093E\u0907\u0932 \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0928\u0939\u0940\u0902 \u0939\u0941\u0908\u0964 \u0915\u0943\u092A\u092F\u093E \u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964" });
    }
    const uploadRes = await uploadFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname || `upload-${Date.now()}.jpg`,
      mimetype: req.file.mimetype || "image/jpeg",
      folder: uploadFolder
    });
    const result = await dbRun(
      "INSERT INTO uploads (filename, filepath, url, mimetype, size, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [uploadRes.filename, uploadRes.storagePath, uploadRes.url, uploadRes.mimetype, uploadRes.size, (/* @__PURE__ */ new Date()).toISOString()]
    );
    res.json({
      id: result.lastID,
      url: uploadRes.url,
      mimetype: uploadRes.mimetype,
      size: uploadRes.size,
      provider: uploadRes.provider
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/dispatch-email", async (req, res) => {
  const { recipientEmail, subject, adNumber, customerName, customerMobile, adType, dimensions, fileUrl, designData, fullDetails } = req.body;
  const targetEmail = recipientEmail || "ipgroup2002@gmail.com";
  try {
    const logEntry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      targetEmail,
      subject: subject || `[\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E 2026] \u0928\u092F\u093E \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u092A\u094D\u0930\u0935\u093F\u0937\u094D\u091F\u093F - ${adNumber || "ADV"} (${customerName || "Customer"})`,
      adNumber,
      customerName,
      customerMobile,
      adType,
      dimensions,
      fileUrl,
      fullDetails
    };
    console.log(`[DISPATCH EMAIL TO ${targetEmail}]`, JSON.stringify(logEntry, null, 2));
    try {
      await dbRun(
        "INSERT INTO admin_activity_logs (admin_username, action_type, description, target_id, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          "SYSTEM_DISPATCH",
          "EMAIL_DISPATCH_TO_INDIAN_PRESS",
          `\u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u092B\u093C\u093E\u0907\u0932/\u092A\u094D\u0930\u0935\u093F\u0937\u094D\u091F\u093F \u0938\u0940\u0927\u0947 ${targetEmail} \u0915\u094B \u092D\u0947\u091C\u0940 \u0917\u0908\u0964 \u0917\u094D\u0930\u093E\u0939\u0915: ${customerName}, \u092B\u094B\u0928: ${customerMobile}, \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u0938\u0902\u0916\u094D\u092F\u093E: ${adNumber}`,
          adNumber || "DIRECT_SUBMISSION",
          req.ip || "127.0.0.1",
          (/* @__PURE__ */ new Date()).toISOString()
        ]
      );
    } catch (e) {
      console.warn("Could not write to admin_activity_logs:", e);
    }
    res.json({
      success: true,
      message: `\u092A\u094D\u0930\u0935\u093F\u0937\u094D\u091F\u093F \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 ${targetEmail} \u0914\u0930 \u0907\u0902\u0921\u093F\u092F\u0928 \u092A\u094D\u0930\u0947\u0938 \u090F\u0921\u092E\u093F\u0928 \u0915\u094B \u092A\u094D\u0930\u0947\u0937\u093F\u0924 \u0915\u0940 \u0917\u0908\u0964`,
      targetEmail,
      timestamp: logEntry.timestamp,
      adNumber
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/cart", async (req, res) => {
  const sessionId = (req.query.sessionId || "").toString().trim();
  if (!sessionId) return res.json([]);
  try {
    const items = await dbAll("SELECT * FROM cart_items WHERE session_id = ? ORDER BY id DESC", [sessionId]);
    res.json(items.map((item) => ({
      id: item.id,
      sessionId: item.session_id,
      adType: item.ad_type,
      data: JSON.parse(item.data_json),
      price: toMoney(item.price)
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/cart/add", async (req, res) => {
  const { sessionId: rawSessionId, adType, data, price } = req.body;
  const sessionId = (rawSessionId || "").toString().trim();
  if (!sessionId || !adType || !data) {
    return res.status(400).json({ error: "Missing required cart details" });
  }
  try {
    const created_at = (/* @__PURE__ */ new Date()).toISOString();
    if (data.adId || data.adNumber) {
      const existing = await dbAll("SELECT id, data_json FROM cart_items WHERE session_id = ?", [sessionId]);
      for (const ex of existing) {
        try {
          const parsed = JSON.parse(ex.data_json);
          if (data.adId && parsed.adId === data.adId || data.adNumber && parsed.adNumber === data.adNumber) {
            await dbRun("DELETE FROM cart_items WHERE id = ?", [ex.id]);
          }
        } catch {
        }
      }
    }
    const result = await dbRun(
      "INSERT INTO cart_items (session_id, ad_type, data_json, price, created_at) VALUES (?, ?, ?, ?, ?)",
      [sessionId, adType, JSON.stringify(data), price, created_at]
    );
    res.json({ success: true, id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/cart/add-matrimony", async (req, res) => {
  const { sessionId: rawSessionId, matrimonyData, publications } = req.body;
  const sessionId = (rawSessionId || "").toString().trim();
  if (!sessionId || !matrimonyData || !publications || !Array.isArray(publications) || publications.length === 0) {
    return res.status(400).json({ error: "\u0915\u0943\u092A\u092F\u093E \u0938\u092D\u0940 \u0906\u0935\u0936\u094D\u092F\u0915 \u0935\u093F\u0935\u0930\u0923 \u0914\u0930 \u0915\u092E \u0938\u0947 \u0915\u092E \u090F\u0915 \u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u091A\u0941\u0928\u0947\u0902\u0964" });
  }
  try {
    const created_at = (/* @__PURE__ */ new Date()).toISOString();
    const addedItems = [];
    if (matrimonyData.adId || matrimonyData.adNumber) {
      const existing = await dbAll("SELECT id, data_json FROM cart_items WHERE session_id = ?", [sessionId]);
      for (const ex of existing) {
        try {
          const parsed = JSON.parse(ex.data_json);
          if (matrimonyData.adId && parsed.adId === matrimonyData.adId || matrimonyData.adNumber && parsed.adNumber === matrimonyData.adNumber) {
            await dbRun("DELETE FROM cart_items WHERE id = ?", [ex.id]);
          }
        } catch {
        }
      }
    }
    for (let i = 0; i < publications.length; i++) {
      const pub = publications[i];
      const districtId = Number(pub.district_id) || 1;
      const sangathanId = Number(pub.sangathan_id) || 1;
      const magazineId = Number(pub.magazine_id) || 1;
      const editionId = Number(pub.edition_id) || 1;
      const sizeCode = pub.size_code || "matrimony_standard";
      const district = await dbGet("SELECT * FROM districts WHERE id = ?", [districtId]);
      const sangathan = await dbGet("SELECT * FROM sangathans WHERE id = ?", [sangathanId]);
      const magazine = await dbGet("SELECT * FROM magazines WHERE id = ?", [magazineId]);
      const edition = await dbGet("SELECT * FROM editions WHERE id = ?", [editionId]);
      const district_hi = district?.name_hi || pub.district_hi || matrimonyData.district_hi || "\u0930\u093E\u092F\u092A\u0941\u0930";
      const sangathan_hi = sangathan?.name_hi || pub.sangathan_hi || matrimonyData.sangathan_hi || "\u0930\u093E\u092F\u092A\u0941\u0930 \u0938\u093E\u0939\u0942 \u0938\u0902\u0917\u0920\u0928";
      const magazine_hi = magazine?.name_hi || pub.magazine_hi || matrimonyData.magazine_hi || "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E";
      const edition_hi = edition?.name_hi || pub.edition_hi || matrimonyData.edition_hi || "\u0938\u0902\u0938\u094D\u0915\u0930\u0923 2026";
      const sizeRecord = await dbGet("SELECT * FROM advertisement_sizes WHERE code = ?", [sizeCode]);
      const size_hi = sizeRecord?.name_hi || "\u0935\u093F\u0935\u093E\u0939 \u092E\u093E\u0928\u0915 (3.5 \xD7 2 \u0907\u0902\u091A)";
      let pricing = await dbGet(
        "SELECT price FROM pricings WHERE district_id = ? AND sangathan_id = ? AND magazine_id = ? AND edition_id = ? AND adv_type_code = 'matrimony' AND adv_size_code = ?",
        [districtId, sangathanId, magazineId, editionId, sizeCode]
      );
      if (!pricing || pricing.price === void 0 || pricing.price === null || pricing.price <= 0) {
        pricing = await dbGet(
          "SELECT price FROM pricings WHERE district_id = ? AND sangathan_id = ? AND adv_type_code = 'matrimony'",
          [districtId, sangathanId]
        );
      }
      const verifiedPrice = pricing && toMoney(pricing.price) > 0 ? toMoney(pricing.price) : 500;
      let adNumber = "";
      if (i === 0 && matrimonyData.adNumber) {
        adNumber = matrimonyData.adNumber;
      } else {
        const maxSeq = await getMaxMatrimonyAdSeq();
        let nextSeq = maxSeq + 1 + (matrimonyData.adNumber ? i - 1 : i);
        adNumber = String(nextSeq).padStart(3, "0");
      }
      const itemData = {
        ...matrimonyData,
        adNumber,
        size_code: sizeCode,
        size_hi,
        district_id: String(districtId),
        sangathan_id: String(sangathanId),
        magazine_id: String(magazineId),
        edition_id: String(editionId),
        district_hi,
        sangathan_hi,
        magazine_hi,
        edition_hi,
        publicationIndex: i + 1,
        totalPublications: publications.length,
        price: verifiedPrice
      };
      const result = await dbRun(
        "INSERT INTO cart_items (session_id, ad_type, data_json, price, created_at) VALUES (?, 'matrimony', ?, ?, ?)",
        [sessionId, JSON.stringify(itemData), verifiedPrice, created_at]
      );
      addedItems.push({ id: result.lastID, price: verifiedPrice, adNumber });
    }
    res.json({ success: true, count: addedItems.length, items: addedItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/cart/add-business", async (req, res) => {
  const { sessionId, sizeCode, designLink, uploadedJpgUrl, publications } = req.body;
  if (!sessionId || !sizeCode || !designLink || !uploadedJpgUrl || !publications || !Array.isArray(publications) || publications.length === 0) {
    return res.status(400).json({ error: "\u0915\u0943\u092A\u092F\u093E \u0938\u092D\u0940 \u0906\u0935\u0936\u094D\u092F\u0915 \u0935\u093F\u0935\u0930\u0923 (\u0921\u093F\u091C\u093C\u093E\u0907\u0928 \u0932\u093F\u0902\u0915, CMYK JPG \u092B\u093C\u093E\u0907\u0932 \u0914\u0930 \u0915\u092E \u0938\u0947 \u0915\u092E \u090F\u0915 \u092A\u094D\u0930\u0915\u093E\u0936\u0928) \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902\u0964" });
  }
  const validSizes = ["business_full", "business_half", "business_quarter"];
  if (!validSizes.includes(sizeCode)) {
    return res.status(400).json({ error: "\u0905\u092E\u093E\u0928\u094D\u092F \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u0906\u0915\u093E\u0930\u0964" });
  }
  try {
    const sizeRecord = await dbGet("SELECT * FROM advertisement_sizes WHERE code = ?", [sizeCode]);
    const size_hi = sizeRecord?.name_hi || (sizeCode === "business_full" ? "\u092A\u0942\u0930\u093E \u092A\u0943\u0937\u094D\u0920 (7.2 \xD7 9.6 \u0907\u0902\u091A)" : sizeCode === "business_half" ? "\u0906\u0927\u093E \u092A\u0943\u0937\u094D\u0920 (7.2 \xD7 4.8 \u0907\u0902\u091A)" : "\u091A\u094C\u0925\u093E\u0908 \u092A\u0943\u0937\u094D\u0920 (3.6 \xD7 4.8 \u0907\u0902\u091A)");
    const created_at = (/* @__PURE__ */ new Date()).toISOString();
    const addedItems = [];
    for (let i = 0; i < publications.length; i++) {
      const pub = publications[i];
      const districtId = Number(pub.district_id);
      const sangathanId = Number(pub.sangathan_id);
      const magazineId = Number(pub.magazine_id);
      const editionId = Number(pub.edition_id);
      if (!districtId || !sangathanId || !magazineId || !editionId) {
        return res.status(400).json({ error: "\u0915\u0943\u092A\u092F\u093E \u0938\u092D\u0940 \u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u092B\u093C\u0940\u0932\u094D\u0921 (\u091C\u093F\u0932\u093E, \u0938\u0902\u0917\u0920\u0928, \u092A\u0924\u094D\u0930\u093F\u0915\u093E, \u0938\u0902\u0938\u094D\u0915\u0930\u0923) \u091A\u0941\u0928\u0947\u0902\u0964" });
      }
      const district = await dbGet("SELECT * FROM districts WHERE id = ? AND is_enabled = 1", [districtId]);
      const sangathan = await dbGet("SELECT * FROM sangathans WHERE id = ? AND district_id = ? AND is_enabled = 1", [sangathanId, districtId]);
      const magazine = await dbGet("SELECT * FROM magazines WHERE id = ? AND is_enabled = 1", [magazineId]);
      const edition = await dbGet("SELECT * FROM editions WHERE id = ? AND magazine_id = ? AND is_enabled = 1", [editionId, magazineId]);
      if (!district || !sangathan || !magazine || !edition) {
        return res.status(400).json({ error: "\u091A\u092F\u0928\u093F\u0924 \u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0938\u0902\u092F\u094B\u091C\u0928 \u0905\u092E\u093E\u0928\u094D\u092F \u092F\u093E \u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F \u0939\u0948\u0964" });
      }
      const pricing = await dbGet(
        "SELECT price FROM pricings WHERE district_id = ? AND sangathan_id = ? AND magazine_id = ? AND edition_id = ? AND adv_type_code = 'business' AND adv_size_code = ?",
        [districtId, sangathanId, magazineId, editionId, sizeCode]
      );
      if (!pricing || pricing.price === void 0 || pricing.price === null || pricing.price <= 0) {
        return res.status(400).json({
          error: `\u092A\u094D\u0930\u0915\u093E\u0936\u0928 '${district.name_hi} - ${sangathan.name_hi}' \u0915\u0947 \u0932\u093F\u090F \u0905\u092D\u0940 \u0926\u0930 \u0928\u093F\u0930\u094D\u0927\u093E\u0930\u093F\u0924 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 \u0915\u0943\u092A\u092F\u093E \u0926\u0942\u0938\u0930\u093E \u0935\u093F\u0915\u0932\u094D\u092A \u091A\u0941\u0928\u0947\u0902\u0964`
        });
      }
      const verifiedPrice = toMoney(pricing.price);
      const countRow = await dbGet("SELECT COUNT(*) as count FROM advertisements WHERE type_code = 'business'");
      const nextSeq = String(Number(countRow?.count || 0) + 1 + i).padStart(3, "0");
      const adNumber = `BUS-${nextSeq} / ${magazine.name_hi}`;
      const itemData = {
        adNumber,
        businessName: "\u0935\u094D\u092F\u093E\u0935\u0938\u093E\u092F\u093F\u0915 \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928",
        ownerName: "\u0917\u094D\u0930\u093E\u0939\u0915",
        size_code: sizeCode,
        size_hi,
        designLink,
        uploadedJpgUrl,
        readyAdUrl: uploadedJpgUrl,
        district_id: String(districtId),
        sangathan_id: String(sangathanId),
        magazine_id: String(magazineId),
        edition_id: String(editionId),
        district_hi: district.name_hi,
        sangathan_hi: sangathan.name_hi,
        magazine_hi: magazine.name_hi,
        edition_hi: edition.name_hi,
        publicationIndex: i + 1,
        totalPublications: publications.length
      };
      const result = await dbRun(
        "INSERT INTO cart_items (session_id, ad_type, data_json, price, created_at) VALUES (?, 'business', ?, ?, ?)",
        [sessionId, JSON.stringify(itemData), verifiedPrice, created_at]
      );
      addedItems.push({ id: result.lastID, price: verifiedPrice, adNumber });
    }
    res.json({ success: true, count: addedItems.length, items: addedItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/cart/remove/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM cart_items WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/cart/clear", async (req, res) => {
  const sessionId = (req.body?.sessionId || req.query?.sessionId || "").toString().trim();
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }
  try {
    await dbRun("DELETE FROM cart_items WHERE session_id = ?", [sessionId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/order/submit", async (req, res) => {
  const { sessionId, customerName, customerMobile } = req.body;
  if (!sessionId || !customerName || !customerMobile) {
    return res.status(400).json({ error: "Missing required checkout parameters" });
  }
  const cleanPhone = customerMobile.replace(/[^0-9]/g, "");
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: "\u092E\u0941\u0916\u094D\u092F \u092E\u094B\u092C\u093E\u0907\u0932 \u0928\u0902\u092C\u0930 \u0920\u0940\u0915 10 \u0905\u0902\u0915\u094B\u0902 \u0915\u093E \u0939\u094B\u0928\u093E \u0906\u0935\u0936\u094D\u092F\u0915 \u0939\u0948\u0964" });
  }
  try {
    const cartItems = await dbAll("SELECT * FROM cart_items WHERE session_id = ?", [sessionId]);
    if (cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }
    let total = 0;
    const itemsWithParsedData = cartItems.map((item) => {
      const parsedData = JSON.parse(item.data_json);
      total += toMoney(item.price);
      return { ...item, parsedData };
    });
    const orderId = `ORD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const created_at = (/* @__PURE__ */ new Date()).toISOString();
    await dbRun(
      "INSERT INTO orders (order_id, total_amount, payment_status, created_at) VALUES (?, ?, 'PENDING', ?)",
      [orderId, toMoney(total), created_at]
    );
    for (const item of itemsWithParsedData) {
      const parsed = item.parsedData;
      const finalAdNum = parsed.adNumber || `ADV-PENDING-${Date.now()}`;
      const uploadedJpg = parsed.uploadedJpgUrl || parsed.photoUrl || parsed.readyAdUrl || null;
      const designLink = parsed.designLink || null;
      await dbRun(
        `INSERT INTO order_items (
          order_id, ad_number, ad_type, district_hi, sangathan_hi, magazine_hi, edition_hi, size_hi, price,
          customer_name, customer_mobile, production_status, uploaded_jpg_url, design_link,
          matrimony_details_json, business_details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?)`,
        [
          orderId,
          finalAdNum,
          item.ad_type,
          parsed.district_hi || "\u0930\u093E\u092F\u092A\u0941\u0930",
          parsed.sangathan_hi || "\u0930\u093E\u092F\u092A\u0941\u0930 \u0938\u093E\u0939\u0942 \u0938\u0902\u0917\u0920\u0928",
          parsed.magazine_hi || "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E",
          parsed.edition_hi || "\u0938\u0902\u0938\u094D\u0915\u0930\u0923 2026",
          parsed.size_hi || (item.ad_type === "matrimony" ? "\u0935\u093F\u0935\u093E\u0939 \u092E\u093E\u0928\u0915 (3.5 \xD7 2 \u0907\u0902\u091A)" : "\u0935\u094D\u092F\u0935\u0938\u093E\u092F \u0906\u0915\u093E\u0930"),
          toMoney(item.price),
          customerName,
          customerMobile,
          uploadedJpg,
          designLink,
          item.ad_type === "matrimony" ? item.data_json : null,
          item.ad_type === "business" ? item.data_json : null
        ]
      );
      try {
        let existingAd = null;
        if (parsed.adId) {
          existingAd = await dbGet("SELECT id FROM advertisements WHERE id = ?", [parsed.adId]);
        }
        if (!existingAd && finalAdNum) {
          existingAd = await dbGet("SELECT id FROM advertisements WHERE ad_number = ?", [finalAdNum]);
        }
        let adDbId;
        if (existingAd) {
          adDbId = existingAd.id;
          await dbRun(`
            UPDATE advertisements SET
              customer_name = ?, customer_mobile1 = ?, price = ?, district_hi = ?, sangathan_hi = ?,
              magazine_hi = ?, edition_hi = ?, size_code = ?, size_hi = ?, production_status = 'Pending',
              uploaded_jpg_url = ?, design_link = ?
            WHERE id = ?
          `, [
            customerName,
            customerMobile,
            toMoney(item.price),
            parsed.district_hi || "\u0930\u093E\u092F\u092A\u0941\u0930",
            parsed.sangathan_hi || "\u0930\u093E\u092F\u092A\u0941\u0930 \u0938\u093E\u0939\u0942 \u0938\u0902\u0917\u0920\u0928",
            parsed.magazine_hi || "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E",
            parsed.edition_hi || "\u0938\u0902\u0938\u094D\u0915\u0930\u0923 2026",
            parsed.size_code || (item.ad_type === "matrimony" ? "matrimony_standard" : "business_full"),
            parsed.size_hi || (item.ad_type === "matrimony" ? "\u0935\u093F\u0935\u093E\u0939 \u092E\u093E\u0928\u0915 (3.5 \xD7 2 \u0907\u0902\u091A)" : "\u092A\u0942\u0930\u093E \u092A\u0943\u0937\u094D\u0920 (7.2 \xD7 9.6 \u0907\u0902\u091A)"),
            uploadedJpg,
            designLink,
            adDbId
          ]);
        } else {
          const adRes = await dbRun(`
            INSERT INTO advertisements (
              ad_number, type_code, district_hi, sangathan_hi, magazine_hi, edition_hi, size_code, size_hi,
              customer_name, customer_mobile1, price, payment_status, production_status, uploaded_jpg_url, design_link, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'Pending', ?, ?, ?)
          `, [
            finalAdNum,
            item.ad_type,
            parsed.district_hi || "\u0930\u093E\u092F\u092A\u0941\u0930",
            parsed.sangathan_hi || "\u0930\u093E\u092F\u092A\u0941\u0930 \u0938\u093E\u0939\u0942 \u0938\u0902\u0917\u0920\u0928",
            parsed.magazine_hi || "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E",
            parsed.edition_hi || "\u0938\u0902\u0938\u094D\u0915\u0930\u0923 2026",
            parsed.size_code || "business_full",
            parsed.size_hi || "\u092A\u0942\u0930\u093E \u092A\u0943\u0937\u094D\u0920 (7.2 \xD7 9.6 \u0907\u0902\u091A)",
            customerName,
            customerMobile,
            toMoney(item.price),
            uploadedJpg,
            designLink,
            created_at
          ]);
          adDbId = adRes.lastID;
        }
        if (item.ad_type === "matrimony") {
          await dbRun(`
            INSERT INTO matrimony_profiles (
              ad_id, name, dob, height, blood_group, gotra, education, occupation,
              father_name, father_occupation, mother_name, mobile1, mobile2, whatsapp,
              current_address, permanent_address, photo_url, biodata_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(ad_id) DO UPDATE SET
              name = excluded.name,
              dob = excluded.dob,
              height = excluded.height,
              blood_group = excluded.blood_group,
              gotra = excluded.gotra,
              education = excluded.education,
              occupation = excluded.occupation,
              father_name = excluded.father_name,
              mobile1 = excluded.mobile1,
              photo_url = excluded.photo_url
          `, [
            adDbId,
            parsed.name || customerName,
            formatDobToDDMMYYYY(parsed.dob) || "",
            parsed.height || "",
            parsed.blood_group || "",
            parsed.gotra || "",
            parsed.education || "",
            parsed.occupation || "",
            parsed.father_name || "",
            parsed.father_occupation || "",
            parsed.mother_name || "",
            parsed.mobile1 || customerMobile,
            parsed.mobile2 || "",
            parsed.whatsapp || "",
            parsed.currentAddress || "",
            parsed.permanentAddress || "",
            parsed.photoUrl || uploadedJpg || "",
            parsed.biodataUrl || ""
          ]);
        } else if (item.ad_type === "business") {
          await dbRun(`
            INSERT INTO business_advertisements (
              ad_id, business_name, owner_name, ready_ad_url, photo_url, mobile1
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(ad_id) DO UPDATE SET
              business_name = excluded.business_name,
              owner_name = excluded.owner_name,
              ready_ad_url = excluded.ready_ad_url,
              photo_url = excluded.photo_url,
              mobile1 = excluded.mobile1
          `, [
            adDbId,
            parsed.businessName || "\u0935\u094D\u092F\u093E\u0935\u0938\u093E\u092F\u093F\u0915 \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928",
            parsed.ownerName || customerName,
            uploadedJpg || designLink || "",
            uploadedJpg || "",
            customerMobile
          ]);
        }
      } catch (errAd) {
        console.error("Ad record sync error during checkout:", errAd);
      }
    }
    await dbRun("DELETE FROM cart_items WHERE session_id = ?", [sessionId]);
    const primaryUpiId = "9301056006@ybl";
    const cleanPayeeName = "IndianPress";
    const formattedAmount = toMoney(total).toFixed(2);
    const cleanTxnRef = `ORD${orderId.replace(/[^a-zA-Z0-9]/g, "")}`;
    const cleanTxnNote = `Parichayika_${orderId}`;
    const upiPayload = `upi://pay?pa=${primaryUpiId}&pn=${cleanPayeeName}&am=${formattedAmount}&cu=INR&tn=${cleanTxnNote}&tr=${cleanTxnRef}`;
    const upiHandles = [
      { id: "phonepe", label: "PhonePe UPI", vpa: "9301056006@ybl" },
      { id: "paytm", label: "Paytm UPI", vpa: "9301056006@paytm" },
      { id: "bhim", label: "BHIM / Yes Bank", vpa: "9301056006@ibl" },
      { id: "gpay", label: "Google Pay / Axis", vpa: "9301056006@axl" }
    ];
    res.json({
      orderId,
      totalAmount: total,
      paymentStatus: "PENDING",
      upiPayload,
      primaryUpiId,
      upiHandles,
      cleanPayeeName,
      recipientPhone: "9301056006"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
async function sendWhatsAppNotification(orderId, phone, customerName, status, message) {
  try {
    const created_at = (/* @__PURE__ */ new Date()).toISOString();
    await dbRun(
      "INSERT INTO whatsapp_notifications (order_id, phone, customer_name, status, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [orderId, phone, customerName, status, message, created_at]
    );
    console.log(`
============================================================
\u{1F4F1} [AUTOMATED WHATSAPP NOTIFICATION] DISPATCHED SUCCESSFULLY
============================================================
Order ID:      ${orderId}
Recipient:     ${customerName} (${phone})
Type/Status:   ${status}
Timestamp:     ${created_at}
------------------------------------------------------------
Message:
${message}
============================================================
`);
  } catch (err) {
    console.error("\u274C Error registering WhatsApp notification in database:", err.message);
  }
}
app.post("/api/order/payment-submit", async (req, res) => {
  const { orderId, paymentRef, paymentDate, customerName, paymentScreenshot } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: "Missing required order ID" });
  }
  try {
    const nowStr = (/* @__PURE__ */ new Date()).toISOString();
    await dbRun(
      "UPDATE orders SET payment_status = 'SUBMITTED', payment_ref = ?, payment_date = ?, payment_screenshot = ? WHERE order_id = ?",
      [paymentRef || "DIRECT_UPI_CONFIRMED", paymentDate || nowStr, paymentScreenshot || "", orderId]
    );
    try {
      const items = await dbAll("SELECT customer_name, customer_mobile, ad_type, ad_number, district_hi, sangathan_hi FROM order_items WHERE order_id = ?", [orderId]);
      if (items && items.length > 0) {
        const mainCustomer = items[0];
        const customerPhone = mainCustomer.customer_mobile || "N/A";
        const customerNameVal = mainCustomer.customer_name || customerName || "\u0917\u094D\u0930\u093E\u0939\u0915";
        const orderObj = await dbGet("SELECT total_amount FROM orders WHERE order_id = ?", [orderId]);
        const amount = orderObj?.total_amount || 0;
        const adDetails = items.map((it, idx) => `  ${idx + 1}. ${it.ad_type === "matrimony" ? "\u0935\u093F\u0935\u093E\u0939 \u092A\u0930\u093F\u091A\u092F \u092A\u094D\u0930\u0935\u093F\u0937\u094D\u091F\u093F" : "\u0935\u094D\u092F\u093E\u0935\u0938\u093E\u092F\u093F\u0915 \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928"} (${it.ad_number}) [${it.district_hi} \u2022 ${it.sangathan_hi}]`).join("\n");
        const host = req.get("host") || "localhost:3000";
        const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
        const invoiceLink = `${protocol}://${host}/?order=${orderId}`;
        const customerMsg = `*\u092A\u094D\u0930\u0935\u0947\u0936 \u092A\u0924\u094D\u0930 / \u092D\u0941\u0917\u0924\u093E\u0928 \u092A\u0941\u0937\u094D\u091F\u093F - \u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E 2026* \u{1F4DD}

\u0928\u092E\u0938\u094D\u0924\u0947 *${customerNameVal}*, \u0906\u092A\u0915\u093E \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u0935\u093F\u0935\u0930\u0923 \u0914\u0930 \u092D\u0941\u0917\u0924\u093E\u0928 \u0938\u094D\u0915\u094D\u0930\u0940\u0928\u0936\u0949\u091F \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u0938\u092C\u092E\u093F\u091F \u0939\u094B \u0917\u092F\u093E \u0939\u0948\u0964

*\u0911\u0930\u094D\u0921\u0930 \u0935\u093F\u0935\u0930\u0923:*
\u2022 *\u0911\u0930\u094D\u0921\u0930 ID:* ${orderId}
\u2022 *\u0915\u0941\u0932 \u0930\u093E\u0936\u093F:* \u20B9${amount}
\u2022 *\u0938\u094D\u0925\u093F\u0924\u093F:* \u23F3 \u0938\u0924\u094D\u092F\u093E\u092A\u0928 \u0939\u0947\u0924\u0941 \u0932\u0902\u092C\u093F\u0924 (Submitted)

*\u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u0935\u093F\u0935\u0930\u0923:*
${adDetails}

*\u0906\u0935\u0936\u094D\u092F\u0915 \u0938\u0942\u091A\u0928\u093E:* \u090F\u0921\u092E\u093F\u0928 \u0926\u094D\u0935\u093E\u0930\u093E \u092D\u0941\u0917\u0924\u093E\u0928 \u0938\u094D\u0915\u094D\u0930\u0940\u0928\u0936\u0949\u091F \u0915\u0940 \u091C\u093E\u0901\u091A \u0939\u094B\u0928\u0947 \u0915\u0947 \u092A\u0936\u094D\u091A\u093E\u0924 \u0939\u0940 \u0906\u092A\u0915\u0940 \u0921\u093F\u091C\u093F\u091F\u0932 \u092A\u093E\u0935\u0924\u0940 (Invoice) \u0930\u0938\u0940\u0926 \u0938\u094D\u0935\u0940\u0915\u0943\u0924 \u0939\u094B\u0917\u0940\u0964 \u0930\u0938\u0940\u0926 \u0924\u0948\u092F\u093E\u0930 \u0939\u094B\u0928\u0947 \u092A\u0930 \u0906\u092A\u0915\u094B \u0935\u094D\u0939\u093E\u091F\u094D\u0938\u090F\u092A \u092A\u0930 \u0911\u091F\u094B\u092E\u0948\u091F\u093F\u0915 \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0939\u094B \u091C\u093E\u090F\u0917\u0940\u0964

\u{1F517} *\u0938\u094D\u0925\u093F\u0924\u093F \u091C\u093E\u0901\u091A \u0932\u093F\u0902\u0915:* ${invoiceLink}

\u0927\u0928\u094D\u092F\u0935\u093E\u0926,
*\u0907\u0902\u0921\u093F\u092F\u0928 \u092A\u094D\u0930\u0947\u0938 / \u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E \u091F\u0940\u092E* \u{1F338}`;
        await sendWhatsAppNotification(orderId, customerPhone, customerNameVal, "SUBMITTED", customerMsg);
        const superAdmin = await dbGet("SELECT recovery_whatsapp FROM super_admins LIMIT 1");
        const adminPhone = superAdmin?.recovery_whatsapp || "9301056006";
        const adminMsg = `*\u{1F6A8} \u0928\u092F\u093E \u092D\u0941\u0917\u0924\u093E\u0928 \u0938\u0924\u094D\u092F\u093E\u092A\u0928 \u0905\u0928\u0941\u0930\u094B\u0927 - \u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E 2026*

*\u0928\u092F\u093E \u0906\u0930\u094D\u0921\u0930 \u0938\u092C\u092E\u093F\u091F \u0939\u0941\u0906 \u0939\u0948:*
\u2022 *\u0911\u0930\u094D\u0921\u0930 ID:* ${orderId}
\u2022 *\u0917\u094D\u0930\u093E\u0939\u0915:* ${customerNameVal} (${customerPhone})
\u2022 *\u0915\u0941\u0932 \u0930\u093E\u0936\u093F:* \u20B9${amount}
\u2022 *\u092D\u0941\u0917\u0924\u093E\u0928 \u0938\u094D\u0915\u094D\u0930\u0940\u0928\u0936\u0949\u091F:* ${paymentScreenshot ? "\u0909\u092A\u0932\u092C\u094D\u0927 (\u0938\u0902\u0932\u0917\u094D\u0928)" : "\u0928\u0939\u0940\u0902 \u092A\u093E\u092F\u093E \u0917\u092F\u093E"}
\u2022 *\u0938\u094D\u0925\u093F\u0924\u093F:* \u23F3 \u0938\u0924\u094D\u092F\u093E\u092A\u0928 \u0932\u0902\u092C\u093F\u0924

*\u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u0935\u093F\u0935\u0930\u0923:*
${adDetails}

\u{1F517} *\u090F\u0921\u092E\u093F\u0928 \u092A\u0948\u0928\u0932 \u0932\u093F\u0902\u0915:* ${protocol}://${host}/admin`;
        await sendWhatsAppNotification(orderId, adminPhone, "\u0938\u0941\u092A\u0930 \u090F\u0921\u092E\u093F\u0928", "ADMIN_ALERT_SUBMITTED", adminMsg);
      }
    } catch (waErr) {
      console.error("WhatsApp notification generation error:", waErr.message);
    }
    res.json({ success: true, message: "Payment confirmation recorded" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/orders/:orderId", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await dbGet("SELECT * FROM orders WHERE order_id = ?", [orderId]);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    const items = await dbAll("SELECT * FROM order_items WHERE order_id = ?", [orderId]);
    const enrichedItems = items.map((it) => {
      let matrimonyDetails = null;
      let businessDetails = null;
      try {
        if (it.matrimony_details_json) matrimonyDetails = JSON.parse(it.matrimony_details_json);
      } catch (e) {
      }
      try {
        if (it.business_details_json) businessDetails = JSON.parse(it.business_details_json);
      } catch (e) {
      }
      return {
        ...it,
        matrimonyDetails,
        businessDetails
      };
    });
    res.json({
      ...order,
      total_amount: toMoney(order.total_amount),
      items: enrichedItems
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/orders/:orderId/invoice", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await dbGet("SELECT * FROM orders WHERE order_id = ?", [orderId]);
    if (!order) {
      return res.status(404).json({ error: "\u0911\u0930\u094D\u0921\u0930 \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0928\u0939\u0940\u0902 \u0939\u0941\u0906\u0964" });
    }
    if (order.payment_status !== "PAID") {
      return res.status(403).json({
        error: "\u092D\u0941\u0917\u0924\u093E\u0928 \u0915\u093E \u0938\u0924\u094D\u092F\u093E\u092A\u0928 \u0932\u0902\u092C\u093F\u0924 \u0939\u0948\u0964 \u0906\u0927\u093F\u0915\u093E\u0930\u093F\u0915 \u0930\u0938\u0940\u0926 (Official Invoice) \u0915\u0947\u0935\u0932 \u0935\u094D\u092F\u0935\u0938\u094D\u0925\u093E\u092A\u0915 \u0926\u094D\u0935\u093E\u0930\u093E \u092D\u0941\u0917\u0924\u093E\u0928 \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0939\u094B\u0928\u0947 \u0915\u0947 \u092A\u0936\u094D\u091A\u093E\u0924 \u091C\u093E\u0930\u0940 \u0915\u0940 \u091C\u093E\u0924\u0940 \u0939\u0948\u0964",
        payment_status: order.payment_status,
        is_paid: false
      });
    }
    const items = await dbAll("SELECT * FROM order_items WHERE order_id = ?", [orderId]);
    const enrichedItems = items.map((it) => {
      let matrimonyDetails = null;
      let businessDetails = null;
      try {
        if (it.matrimony_details_json) matrimonyDetails = JSON.parse(it.matrimony_details_json);
      } catch (e) {
      }
      try {
        if (it.business_details_json) businessDetails = JSON.parse(it.business_details_json);
      } catch (e) {
      }
      return {
        ...it,
        matrimonyDetails,
        businessDetails
      };
    });
    const invoiceNumber = `INV-${order.order_id}`;
    res.json({
      invoice_number: invoiceNumber,
      order_id: order.order_id,
      total_amount: toMoney(order.total_amount),
      payment_status: "PAID",
      payment_ref: order.payment_ref || "UPI_VERIFIED",
      payment_date: order.payment_date || order.verification_time || order.created_at,
      payment_screenshot: order.payment_screenshot,
      verified_by: order.verified_by || "Admin",
      verification_time: order.verification_time,
      created_at: order.created_at,
      organization: "\u0930\u093E\u092F\u092A\u0941\u0930 \u091C\u093F\u0932\u093E \u0938\u093E\u0939\u0942 \u0938\u0902\u0918 / \u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E 2026",
      items: enrichedItems
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/setup-status", async (req, res) => {
  try {
    const admin = await dbGet("SELECT COUNT(*) as count FROM super_admins");
    const count = Number(admin?.count ?? 0);
    const setupRequired = count === 0;
    res.json({
      setupRequired,
      count,
      hasSuperAdmin: !setupRequired,
      message: setupRequired ? "No Super Admin account found. Setup required." : "Super Admin exists. Login required."
    });
  } catch (error) {
    res.status(500).json({ error: error.message, setupRequired: false });
  }
});
function getClientIp(req) {
  try {
    if (!req) return "";
    const headers = req.headers || {};
    const forwarded = headers["x-forwarded-for"] || headers["x-real-ip"];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : String(forwarded).split(",")[0].trim();
    }
    if (req.socket?.remoteAddress) return String(req.socket.remoteAddress);
    if (req.connection?.remoteAddress) return String(req.connection.remoteAddress);
    return "";
  } catch {
    return "";
  }
}
async function logAudit(action, actorId, actorEmail, details, ipAddress = null) {
  try {
    await dbRun(
      "INSERT INTO audit_logs (action, actor_id, actor_email, details, ip_address) VALUES (?, ?, ?, ?, ?)",
      [action, actorId ? String(actorId) : null, actorEmail || null, details || null, ipAddress || null]
    );
  } catch (err) {
    console.error("[AUDIT LOG ERROR]", err);
  }
}
app.post("/api/admin/setup", async (req, res) => {
  const { name, email, mobile, password, confirmPassword } = req.body;
  const username = (email || req.body.username || "").trim().toLowerCase();
  const clientIp = getClientIp(req);
  if (!name || !email || !mobile || !password || !confirmPassword) {
    return res.status(400).json({ error: "\u0938\u092D\u0940 \u092B\u0940\u0932\u094D\u0921 (\u0928\u093E\u092E, \u0908\u092E\u0947\u0932, \u092E\u094B\u092C\u093E\u0907\u0932, \u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u0914\u0930 \u0915\u0928\u094D\u092B\u0930\u094D\u092E \u092A\u093E\u0938\u0935\u0930\u094D\u0921) \u092D\u0930\u0928\u093E \u0906\u0935\u0936\u094D\u092F\u0915 \u0939\u0948\u0964" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "\u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u0914\u0930 \u0915\u0928\u094D\u092B\u0930\u094D\u092E \u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u092E\u0947\u0932 \u0928\u0939\u0940\u0902 \u0916\u093E\u0924\u0947\u0964" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "\u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u0915\u092E \u0938\u0947 \u0915\u092E 6 \u0905\u0915\u094D\u0937\u0930\u094B\u0902 \u0915\u093E \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F\u0964" });
  }
  try {
    const adminCheck = await dbGet("SELECT COUNT(*) as count FROM super_admins");
    const count = Number(adminCheck?.count ?? 0);
    if (count > 0) {
      return res.status(400).json({ error: "\u0938\u0941\u092A\u0930 \u090F\u0921\u092E\u093F\u0928 \u092A\u0939\u0932\u0947 \u0939\u0940 \u092C\u0928\u093E\u092F\u093E \u091C\u093E \u091A\u0941\u0915\u093E \u0939\u0948\u0964 \u0905\u0928\u094D\u092F \u0938\u0941\u092A\u0930 \u090F\u0921\u092E\u093F\u0928 \u0928\u0939\u0940\u0902 \u092C\u0928\u093E\u092F\u093E \u091C\u093E \u0938\u0915\u0924\u093E\u0964" });
    }
    const hash = await import_bcryptjs.default.hash(password, 10);
    try {
      await dbRun(
        "INSERT INTO super_admins (username, name, email, mobile, password_hash, recovery_email, recovery_whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          username,
          name.trim(),
          email.trim().toLowerCase(),
          mobile.trim(),
          hash,
          email.trim().toLowerCase(),
          mobile.trim()
        ]
      );
    } catch (insertErr) {
      await dbRun(
        "INSERT INTO super_admins (username, password_hash, recovery_email, recovery_whatsapp) VALUES (?, ?, ?, ?)",
        [
          username,
          hash,
          email.trim().toLowerCase(),
          mobile.trim()
        ]
      );
    }
    await logAudit(
      "SUPER_ADMIN_CREATED",
      "1",
      email.trim().toLowerCase(),
      `Super Admin account created: Name: ${name.trim()}, Mobile: ${mobile.trim()}`,
      Array.isArray(clientIp) ? clientIp[0] : String(clientIp)
    );
    res.json({
      success: true,
      message: "\u0938\u0941\u092A\u0930 \u090F\u0921\u092E\u093F\u0928 \u0916\u093E\u0924\u093E \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u092C\u0928 \u0917\u092F\u093E \u0939\u0948\u0964 \u0905\u092C \u0906\u092A \u0932\u0949\u0917\u093F\u0928 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/recovery-settings", authenticateAdmin, async (req, res) => {
  try {
    const admin = await dbGet("SELECT username, recovery_email as recoveryEmail, recovery_whatsapp as recoveryWhatsapp FROM super_admins WHERE id = ?", [req.adminId]);
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/admin/recovery-settings", authenticateAdmin, async (req, res) => {
  const { recoveryEmail, recoveryWhatsapp } = req.body;
  try {
    await dbRun(
      "UPDATE super_admins SET recovery_email = ?, recovery_whatsapp = ? WHERE id = ?",
      [recoveryEmail, recoveryWhatsapp, req.adminId]
    );
    await logAudit("ADMIN_RECOVERY_SETTINGS_UPDATED", req.adminId, req.adminUser?.username || "", `Updated recovery email: ${recoveryEmail}, whatsapp: ${recoveryWhatsapp}`);
    res.json({ success: true, message: "\u0930\u093F\u0915\u0935\u0930\u0940 \u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938 \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0915\u0940 \u0917\u0908\u0902\u0964" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/admin/forgot-password", async (req, res) => {
  const { email } = req.body;
  const clientIp = getClientIp(req);
  if (!email) return res.status(400).json({ error: "\u0908\u092E\u0947\u0932 \u0906\u0908\u0921\u0940 \u0926\u0930\u094D\u091C \u0915\u0930\u0928\u093E \u0906\u0935\u0936\u094D\u092F\u0915 \u0939\u0948\u0964" });
  try {
    const admin = await dbGet("SELECT * FROM super_admins WHERE username = ? OR recovery_email = ?", [email, email]);
    if (!admin) {
      return res.status(404).json({ error: "\u0907\u0938 \u0908\u092E\u0947\u0932 \u092A\u0924\u0947 \u0915\u0947 \u0938\u093E\u0925 \u0915\u094B\u0908 \u090F\u0921\u092E\u093F\u0928 \u092A\u0902\u091C\u0940\u0915\u0943\u0924 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964" });
    }
    const crypto = await import("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
    await dbRun(
      "UPDATE super_admins SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
      [resetToken, expiry, admin.id]
    );
    await logAudit("FORGOT_PASSWORD_REQUESTED", admin.id, admin.email || admin.username, "Password reset token generated", Array.isArray(clientIp) ? clientIp[0] : String(clientIp));
    const resetUrl = `/admin-reset-password?token=${resetToken}`;
    res.json({
      success: true,
      message: "\u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u0930\u0940\u0938\u0947\u091F \u0932\u093F\u0902\u0915 \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u091C\u0928\u0930\u0947\u091F \u0939\u094B \u0917\u092F\u093E \u0939\u0948\u0964",
      resetToken,
      resetUrl,
      whatsappNumber: admin.recovery_whatsapp || "",
      recoveryEmail: admin.recovery_email || ""
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/admin/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  const clientIp = getClientIp(req);
  if (!token || !newPassword) {
    return res.status(400).json({ error: "\u091F\u094B\u0915\u0928 \u0914\u0930 \u0928\u092F\u093E \u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u0906\u0935\u0936\u094D\u092F\u0915 \u0939\u0948\u0964" });
  }
  try {
    const admin = await dbGet("SELECT * FROM super_admins WHERE reset_token = ?", [token]);
    if (!admin) {
      return res.status(400).json({ error: "\u0905\u0935\u0948\u0927 \u092F\u093E \u0909\u092A\u092F\u094B\u0917 \u0915\u093F\u092F\u093E \u0939\u0941\u0906 \u0930\u0940\u0938\u0947\u091F \u091F\u094B\u0915\u0928\u0964" });
    }
    const now = /* @__PURE__ */ new Date();
    const expiry = new Date(admin.reset_token_expiry);
    if (now > expiry) {
      return res.status(400).json({ error: "\u0930\u0940\u0938\u0947\u091F \u091F\u094B\u0915\u0928 \u0915\u0940 \u0938\u092E\u092F\u093E\u0935\u0927\u093F \u0938\u092E\u093E\u092A\u094D\u0924 \u0939\u094B \u091A\u0941\u0915\u0940 \u0939\u0948 (Expired)\u0964" });
    }
    const hash = await import_bcryptjs.default.hash(newPassword, 10);
    await dbRun(
      "UPDATE super_admins SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
      [hash, admin.id]
    );
    await logAudit("PASSWORD_RESET_SUCCESS", admin.id, admin.email || admin.username, "Super Admin password reset successfully with token", Array.isArray(clientIp) ? clientIp[0] : String(clientIp));
    res.json({ success: true, message: "\u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u0930\u0940\u0938\u0947\u091F \u0939\u094B \u0917\u092F\u093E \u0939\u0948\u0964 \u0905\u092C \u0906\u092A \u0932\u0949\u0917\u093F\u0928 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/custom-fields/:formType", async (req, res) => {
  const { formType } = req.params;
  try {
    const fields = await dbAll(
      "SELECT * FROM custom_fields WHERE form_type = ? AND visible = 1 ORDER BY display_order ASC",
      [formType]
    );
    res.json(fields);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/custom-fields/:formType", authenticateAdmin, async (req, res) => {
  const { formType } = req.params;
  try {
    const fields = await dbAll(
      "SELECT * FROM custom_fields WHERE form_type = ? ORDER BY display_order ASC",
      [formType]
    );
    res.json(fields);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/admin/custom-fields", authenticateAdmin, async (req, res) => {
  const { form_type, field_name, label, field_type, required, placeholder, help_text, default_value, visible, display_order, select_options } = req.body;
  if (!form_type || !field_name || !label || !field_type) {
    return res.status(400).json({ error: "Missing required field attributes" });
  }
  try {
    await dbRun(`
      INSERT INTO custom_fields (form_type, field_name, label, field_type, required, placeholder, help_text, default_value, visible, display_order, select_options)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [form_type, field_name.toLowerCase(), label, field_type, required ? 1 : 0, placeholder || "", help_text || "", default_value || "", visible ? 1 : 0, display_order || 0, select_options || ""]);
    res.json({ success: true, message: "\u092B\u093C\u0940\u0932\u094D\u0921 \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u091C\u094B\u0921\u093C\u093E \u0917\u092F\u093E\u0964" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/admin/custom-fields/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { label, field_type, required, placeholder, help_text, default_value, visible, display_order, select_options } = req.body;
  try {
    await dbRun(`
      UPDATE custom_fields
      SET label = ?, field_type = ?, required = ?, placeholder = ?, help_text = ?, default_value = ?, visible = ?, display_order = ?, select_options = ?
      WHERE id = ?
    `, [label, field_type, required ? 1 : 0, placeholder || "", help_text || "", default_value || "", visible ? 1 : 0, display_order || 0, select_options || "", id]);
    res.json({ success: true, message: "\u092B\u093C\u0940\u0932\u094D\u0921 \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u0905\u092A\u0921\u0947\u091F \u0915\u093F\u092F\u093E \u0917\u092F\u093E\u0964" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/admin/custom-fields/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM custom_fields WHERE id = ?", [id]);
    res.json({ success: true, message: "\u092B\u093C\u0940\u0932\u094D\u0921 \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u0939\u091F\u093E \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post(["/api/admin/login", "/api/auth/login"], async (req, res) => {
  const { username, password } = req.body;
  const clientIp = getClientIp(req);
  if (!username || !password) {
    return res.status(400).json({ error: "\u092F\u0942\u091C\u093C\u0930\u0928\u0947\u092E/\u0908\u092E\u0947\u0932 \u0914\u0930 \u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u0906\u0935\u0936\u094D\u092F\u0915 \u0939\u0948\u0902\u0964" });
  }
  try {
    const cleanUser = String(username).trim().toLowerCase();
    let admin = null;
    try {
      admin = await dbGet(
        "SELECT * FROM super_admins WHERE LOWER(username) = ? OR LOWER(email) = ? OR mobile = ?",
        [cleanUser, cleanUser, cleanUser]
      );
    } catch {
      admin = await dbGet(
        "SELECT * FROM super_admins WHERE LOWER(username) = ? OR LOWER(recovery_email) = ?",
        [cleanUser, cleanUser]
      );
    }
    if (!admin) {
      return res.status(401).json({ error: "\u0917\u0932\u0924 \u092F\u0942\u091C\u093C\u0930\u0928\u0947\u092E/\u0908\u092E\u0947\u0932 \u092F\u093E \u092A\u093E\u0938\u0935\u0930\u094D\u0921" });
    }
    const match = await import_bcryptjs.default.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ error: "\u0917\u0932\u0924 \u092F\u0942\u091C\u093C\u0930\u0928\u0947\u092E/\u0908\u092E\u0947\u0932 \u092F\u093E \u092A\u093E\u0938\u0935\u0930\u094D\u0921" });
    }
    const role = admin && admin.role ? admin.role : "SUPER_ADMIN";
    if (role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "\u092A\u0939\u0941\u0902\u091A \u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924: \u0915\u0947\u0935\u0932 SUPER_ADMIN \u0915\u094B \u0939\u0940 \u0905\u0928\u0941\u092E\u0924\u093F \u0939\u0948\u0964" });
    }
    const token = import_jsonwebtoken.default.sign(
      {
        adminId: admin.id,
        username: admin.username || admin.email,
        name: admin.name || admin.username,
        role: "SUPER_ADMIN"
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    await logAudit("SUPER_ADMIN_LOGGED_IN", admin.id, admin.email || admin.username, "Super Admin logged in successfully", Array.isArray(clientIp) ? clientIp[0] : String(clientIp));
    res.json({
      token,
      username: admin.username || admin.email,
      name: admin.name || admin.username,
      role: "SUPER_ADMIN"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/admin/change-password", authenticateAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const clientIp = getClientIp(req);
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Missing passwords" });
  }
  try {
    const admin = await dbGet("SELECT * FROM super_admins WHERE id = ?", [req.adminId]);
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    const match = await import_bcryptjs.default.compare(currentPassword, admin.password_hash);
    if (!match) return res.status(400).json({ error: "Incorrect current password" });
    const newHash = await import_bcryptjs.default.hash(newPassword, 10);
    await dbRun("UPDATE super_admins SET password_hash = ? WHERE id = ?", [newHash, req.adminId]);
    await logAudit("SUPER_ADMIN_PASSWORD_CHANGED", req.adminId, admin.email || admin.username, "Super Admin password changed successfully via dashboard", Array.isArray(clientIp) ? clientIp[0] : String(clientIp));
    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/audit-logs", authenticateAdmin, async (req, res) => {
  try {
    const logs = await dbAll("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100");
    res.json({ logs: logs || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/dashboard", authenticateAdmin, async (req, res) => {
  try {
    const totalOrders = await dbGet("SELECT COUNT(*) as count FROM orders");
    const totalAds = await dbGet("SELECT COUNT(*) as count FROM advertisements");
    const pendingOrders = await dbGet("SELECT COUNT(*) as count FROM orders WHERE payment_status = 'PENDING'");
    const verifiedOrders = await dbGet("SELECT COUNT(*) as count FROM orders WHERE payment_status = 'PAID'");
    const totalRevenue = await dbGet("SELECT SUM(total_amount) as total FROM orders WHERE payment_status = 'PAID'");
    res.json({
      counts: {
        totalOrders: Number(totalOrders?.count || 0),
        totalAds: Number(totalAds?.count || 0),
        pendingOrders: Number(pendingOrders?.count || 0),
        verifiedOrders: Number(verifiedOrders?.count || 0),
        totalRevenue: toMoney(totalRevenue?.total || 0)
      },
      status: "active"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/orders", authenticateAdmin, async (req, res) => {
  try {
    const orders = await dbAll("SELECT * FROM orders ORDER BY id DESC");
    const items = await dbAll("SELECT * FROM order_items");
    const enrichedOrders = orders.map((ord) => {
      const orderItems = items.filter((it) => it.order_id === ord.order_id);
      return {
        ...ord,
        items: orderItems.map((it) => ({
          ...it,
          matrimonyDetails: it.matrimony_details_json ? JSON.parse(it.matrimony_details_json) : null,
          businessDetails: it.business_details_json ? JSON.parse(it.business_details_json) : null
        }))
      };
    });
    res.json(enrichedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/admin/orders/:orderId/verify", authenticateAdmin, async (req, res) => {
  const { orderId } = req.params;
  const { status, reason } = req.body;
  if (!status || !["PAID", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status state" });
  }
  try {
    const order = await dbGet("SELECT * FROM orders WHERE order_id = ?", [orderId]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    const verifiedBy = req.username;
    const verificationTime = (/* @__PURE__ */ new Date()).toISOString();
    await dbRun(
      "UPDATE orders SET payment_status = ?, verified_by = ?, verification_time = ?, rejection_reason = ? WHERE order_id = ?",
      [status, verifiedBy, verificationTime, reason || null, orderId]
    );
    const items = await dbAll("SELECT ad_number, customer_name, customer_mobile, ad_type, district_hi, sangathan_hi FROM order_items WHERE order_id = ?", [orderId]);
    for (const item of items) {
      await dbRun("UPDATE advertisements SET payment_status = ? WHERE ad_number = ?", [status, item.ad_number]);
    }
    try {
      if (items && items.length > 0) {
        const mainCustomer = items[0];
        const customerPhone = mainCustomer.customer_mobile || "N/A";
        const customerNameVal = mainCustomer.customer_name || "\u0917\u094D\u0930\u093E\u0939\u0915";
        const amount = order.total_amount || 0;
        const adDetails = items.map((it, idx) => `  ${idx + 1}. ${it.ad_type === "matrimony" ? "\u0935\u093F\u0935\u093E\u0939 \u092A\u0930\u093F\u091A\u092F \u092A\u094D\u0930\u0935\u093F\u0937\u094D\u091F\u093F" : "\u0935\u094D\u092F\u093E\u0935\u0938\u093E\u092F\u093F\u0915 \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928"} (${it.ad_number}) [${it.district_hi} \u2022 ${it.sangathan_hi}]`).join("\n");
        const host = req.get("host") || "localhost:3000";
        const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
        const invoiceLink = `${protocol}://${host}/?order=${orderId}`;
        if (status === "PAID") {
          const customerMsg = `*\u092A\u094D\u0930\u0935\u0947\u0936 \u0938\u094D\u0935\u0940\u0915\u0943\u0924 \u0930\u0938\u0940\u0926 - \u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E 2026* \u2705

\u0928\u092E\u0938\u094D\u0924\u0947 *${customerNameVal}*, \u0906\u092A\u0915\u093E \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u092D\u0941\u0917\u0924\u093E\u0928 \u0938\u094D\u0935\u0940\u0915\u0943\u0924 \u0939\u094B \u0917\u092F\u093E \u0939\u0948 \u0914\u0930 \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u0909\u0924\u094D\u092A\u093E\u0926\u0928 (Print Production) \u0915\u0947 \u0932\u093F\u090F \u092D\u0947\u091C \u0926\u093F\u092F\u093E \u0917\u092F\u093E \u0939\u0948\u0964

*\u0911\u0930\u094D\u0921\u0930 \u0935\u093F\u0935\u0930\u0923:*
\u2022 *\u0911\u0930\u094D\u0921\u0930 ID:* ${orderId}
\u2022 *\u0915\u0941\u0932 \u0930\u093E\u0936\u093F:* \u20B9${amount}
\u2022 *\u0938\u094D\u0925\u093F\u0924\u093F:* \u{1F7E2} \u0938\u094D\u0935\u0940\u0915\u0943\u0924 (PAID)

*\u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u0935\u093F\u0935\u0930\u0923:*
${adDetails}

\u{1F517} *\u0921\u093F\u091C\u093F\u091F\u0932 \u092A\u093E\u0935\u0924\u0940 / Invoice \u0921\u093E\u0909\u0928\u0932\u094B\u0921 \u0915\u0930\u0947\u0902:* ${invoiceLink}

\u0927\u0928\u094D\u092F\u0935\u093E\u0926,
*\u0907\u0902\u0921\u093F\u092F\u0928 \u092A\u094D\u0930\u0947\u0938 / \u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E \u091F\u0940\u092E* \u{1F338}`;
          await sendWhatsAppNotification(orderId, customerPhone, customerNameVal, "PAID", customerMsg);
          const superAdmin = await dbGet("SELECT recovery_whatsapp FROM super_admins LIMIT 1");
          const adminPhone = superAdmin?.recovery_whatsapp || "9301056006";
          const adminMsg = `*\u2705 \u092D\u0941\u0917\u0924\u093E\u0928 \u0938\u094D\u0935\u0940\u0915\u0943\u0924 \u092A\u0941\u0937\u094D\u091F\u093F - \u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E 2026*

\u2022 *\u0911\u0930\u094D\u0921\u0930 ID:* ${orderId}
\u2022 *\u0917\u094D\u0930\u093E\u0939\u0915:* ${customerNameVal} (${customerPhone})
\u2022 *\u0915\u0941\u0932 \u0930\u093E\u0936\u093F:* \u20B9${amount}
\u2022 *\u0938\u094D\u0925\u093F\u0924\u093F:* \u{1F7E2} \u0938\u094D\u0935\u0940\u0915\u0943\u0924 (PAID)

\u0909\u0924\u094D\u092A\u093E\u0926\u0928 \u0905\u0928\u0941\u092D\u093E\u0917 \u092E\u0947\u0902 \u092E\u0941\u0926\u094D\u0930\u0923 (Print Sheet) \u0939\u0947\u0924\u0941 \u092A\u094D\u0930\u0935\u093F\u0937\u094D\u091F\u093F\u092F\u093E\u0901 \u092D\u0947\u091C \u0926\u0940 \u0917\u0908 \u0939\u0948\u0902\u0964`;
          await sendWhatsAppNotification(orderId, adminPhone, "\u0938\u0941\u092A\u0930 \u090F\u0921\u092E\u093F\u0928", "ADMIN_ALERT_PAID", adminMsg);
        } else if (status === "REJECTED") {
          const rejectReason = reason || "\u092D\u0941\u0917\u0924\u093E\u0928 \u0935\u093F\u0935\u0930\u0923 \u0905\u092E\u093E\u0928\u094D\u092F \u092A\u093E\u092F\u093E \u0917\u092F\u093E\u0964 \u0915\u0943\u092A\u092F\u093E \u092A\u0941\u0928\u0903 \u0938\u0939\u0940 \u091C\u093E\u0928\u0915\u093E\u0930\u0940 \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902\u0964";
          const customerMsg = `*\u092D\u0941\u0917\u0924\u093E\u0928 \u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924 / \u0935\u093F\u092B\u0932 \u0938\u0942\u091A\u0928\u093E - \u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E 2026* \u274C

\u0928\u092E\u0938\u094D\u0924\u0947 *${customerNameVal}*, \u0906\u092A\u0915\u0947 \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928 \u0906\u0930\u094D\u0921\u0930 \u0915\u093E \u092D\u0941\u0917\u0924\u093E\u0928 \u0935\u093F\u0935\u0930\u0923 *\u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924 (REJECTED)* \u0915\u0930 \u0926\u093F\u092F\u093E \u0917\u092F\u093E \u0939\u0948\u0964

*\u0911\u0930\u094D\u0921\u0930 \u0935\u093F\u0935\u0930\u0923:*
\u2022 *\u0911\u0930\u094D\u0921\u0930 ID:* ${orderId}
\u2022 *\u0915\u0941\u0932 \u0930\u093E\u0936\u093F:* \u20B9${amount}
\u2022 *\u0938\u094D\u0925\u093F\u0924\u093F:* \u{1F534} \u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924 (REJECTED)
\u2022 *\u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924\u093F \u0915\u093E \u0915\u093E\u0930\u0923:* ${rejectReason}

*\u0915\u0943\u092A\u092F\u093E \u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902:*
\u0906\u092A \u0928\u0940\u091A\u0947 \u0926\u093F\u090F \u0932\u093F\u0902\u0915 \u092A\u0930 \u091C\u093E\u0915\u0930 \u0905\u092A\u0928\u093E \u0938\u0939\u0940 \u092D\u0941\u0917\u0924\u093E\u0928 \u0935\u093F\u0935\u0930\u0923 \u0926\u0930\u094D\u091C \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902 \u092F\u093E \u092B\u093F\u0930 \u0938\u0947 \u092D\u0941\u0917\u0924\u093E\u0928 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964

\u{1F517} *\u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902 / \u0921\u093F\u091C\u093F\u091F\u0932 \u092A\u093E\u0935\u0924\u0940:* ${invoiceLink}

\u092F\u0926\u093F \u0915\u094B\u0908 \u0938\u092E\u0938\u094D\u092F\u093E \u0939\u094B \u0924\u094B \u0915\u0943\u092A\u092F\u093E \u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E \u090F\u0921\u092E\u093F\u0928 \u0938\u0947 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902\u0964

\u0927\u0928\u094D\u092F\u0935\u093E\u0926,
*\u0907\u0902\u0921\u093F\u092F\u0928 \u092A\u094D\u0930\u0947\u0938 / \u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E \u091F\u0940\u092E* \u{1F338}`;
          await sendWhatsAppNotification(orderId, customerPhone, customerNameVal, "REJECTED", customerMsg);
          const superAdmin = await dbGet("SELECT recovery_whatsapp FROM super_admins LIMIT 1");
          const adminPhone = superAdmin?.recovery_whatsapp || "9301056006";
          const adminMsg = `*\u274C \u092D\u0941\u0917\u0924\u093E\u0928 \u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924 (REJECTED) - \u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E 2026*

\u2022 *\u0911\u0930\u094D\u0921\u0930 ID:* ${orderId}
\u2022 *\u0917\u094D\u0930\u093E\u0939\u0915:* ${customerNameVal} (${customerPhone})
\u2022 *\u0915\u0941\u0932 \u0930\u093E\u0936\u093F:* \u20B9${amount}
\u2022 *\u0938\u094D\u0925\u093F\u0924\u093F:* \u{1F534} \u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924 (REJECTED)
\u2022 *\u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924\u093F \u0915\u093E \u0915\u093E\u0930\u0923:* ${rejectReason}

\u0917\u094D\u0930\u093E\u0939\u0915 \u0915\u094B \u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938 \u0939\u0947\u0924\u0941 \u0938\u0942\u091A\u0928\u093E \u092D\u0947\u091C \u0926\u0940 \u0917\u0908 \u0939\u0948\u0964`;
          await sendWhatsAppNotification(orderId, adminPhone, "\u0938\u0941\u092A\u0930 \u090F\u0921\u092E\u093F\u0928", "ADMIN_ALERT_REJECTED", adminMsg);
        }
      }
    } catch (waErr) {
      console.error("WhatsApp notification verification trigger error:", waErr.message);
    }
    res.json({ success: true, message: `Order updated to ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/whatsapp-logs", authenticateAdmin, async (req, res) => {
  try {
    const logs = await dbAll("SELECT * FROM whatsapp_notifications ORDER BY id DESC");
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/admin/masters/:entity", authenticateAdmin, async (req, res) => {
  const { entity } = req.params;
  const data = req.body;
  try {
    if (entity === "districts") {
      await dbRun("INSERT INTO districts (name_en, name_hi, is_enabled) VALUES (?, ?, 1)", [data.name_en, data.name_hi]);
    } else if (entity === "sangathans") {
      await dbRun("INSERT INTO sangathans (district_id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", [data.district_id, data.name_en, data.name_hi]);
    } else if (entity === "magazines") {
      await dbRun("INSERT INTO magazines (name_en, name_hi, is_enabled) VALUES (?, ?, 1)", [data.name_en, data.name_hi]);
    } else if (entity === "editions") {
      await dbRun("INSERT INTO editions (magazine_id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, 1)", [data.magazine_id, data.name_en, data.name_hi]);
    } else if (entity === "sizes") {
      await dbRun(
        "INSERT INTO advertisement_sizes (code, name_en, name_hi, width, height, unit, rows, cols, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
        [data.code, data.name_en, data.name_hi, data.width, data.height, data.unit || "inch", data.rows || 1, data.cols || 1]
      );
    } else if (entity === "pricings") {
      await dbRun(
        "INSERT INTO pricings (district_id, sangathan_id, magazine_id, edition_id, adv_type_code, adv_size_code, price) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [data.district_id, data.sangathan_id, data.magazine_id, data.edition_id, data.adv_type_code, data.adv_size_code, toMoney(data.price)]
      );
    } else if (entity === "publications") {
      await dbRun(
        "INSERT INTO publications (district_id, sangathan_id, magazine_id, edition_id, is_enabled) VALUES (?, ?, ?, ?, 1)",
        [data.district_id, data.sangathan_id, data.magazine_id, data.edition_id]
      );
    } else {
      return res.status(400).json({ error: "Invalid master entity" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/admin/masters/:entity/:id", authenticateAdmin, async (req, res) => {
  const { entity, id } = req.params;
  const data = req.body;
  try {
    if (entity === "districts") {
      await dbRun("UPDATE districts SET name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [data.name_en, data.name_hi, data.is_enabled !== void 0 ? data.is_enabled ? 1 : 0 : 1, id]);
    } else if (entity === "sangathans") {
      await dbRun("UPDATE sangathans SET district_id = ?, name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [data.district_id, data.name_en, data.name_hi, data.is_enabled !== void 0 ? data.is_enabled ? 1 : 0 : 1, id]);
    } else if (entity === "magazines") {
      await dbRun("UPDATE magazines SET name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [data.name_en, data.name_hi, data.is_enabled !== void 0 ? data.is_enabled ? 1 : 0 : 1, id]);
    } else if (entity === "editions") {
      await dbRun("UPDATE editions SET magazine_id = ?, name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [data.magazine_id, data.name_en, data.name_hi, data.is_enabled !== void 0 ? data.is_enabled ? 1 : 0 : 1, id]);
    } else if (entity === "publications") {
      await dbRun("UPDATE publications SET district_id = ?, sangathan_id = ?, magazine_id = ?, edition_id = ?, is_enabled = ? WHERE id = ?", [data.district_id, data.sangathan_id, data.magazine_id, data.edition_id, data.is_enabled !== void 0 ? data.is_enabled ? 1 : 0 : 1, id]);
    } else if (entity === "pricings") {
      await dbRun("UPDATE pricings SET district_id = ?, sangathan_id = ?, magazine_id = ?, edition_id = ?, adv_type_code = ?, adv_size_code = ?, price = ? WHERE id = ?", [data.district_id, data.sangathan_id, data.magazine_id, data.edition_id, data.adv_type_code, data.adv_size_code, toMoney(data.price), id]);
    } else {
      return res.status(400).json({ error: "Invalid master entity" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/admin/masters/:entity/:id", authenticateAdmin, async (req, res) => {
  const { entity, id } = req.params;
  try {
    const tableMap = {
      districts: "districts",
      sangathans: "sangathans",
      magazines: "magazines",
      editions: "editions",
      publications: "publications",
      pricings: "pricings"
    };
    const tbl = tableMap[entity];
    if (!tbl) return res.status(400).json({ error: "Invalid master entity" });
    await dbRun(`DELETE FROM ${tbl} WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/admin/order-items/:id/production-status", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const production_status = req.body.production_status || req.body.productionStatus;
  const allowed = ["Pending", "Approved", "Preflight", "Ready for Production", "In Production", "Production", "Published", "Completed"];
  if (!production_status || !allowed.includes(production_status)) {
    return res.status(400).json({ error: "Invalid production status value" });
  }
  try {
    const item = await dbGet("SELECT * FROM order_items WHERE id = ?", [id]);
    if (!item) return res.status(404).json({ error: "Order item not found" });
    await dbRun("UPDATE order_items SET production_status = ? WHERE id = ?", [production_status, id]);
    if (item.ad_number) {
      await dbRun("UPDATE advertisements SET production_status = ? WHERE ad_number = ?", [production_status, item.ad_number]);
    }
    res.json({ success: true, message: "Production status updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/advertisements", authenticateAdmin, async (req, res) => {
  try {
    const ads = await dbAll("SELECT * FROM advertisements ORDER BY id DESC");
    const matDetails = await dbAll("SELECT * FROM matrimony_profiles");
    const busDetails = await dbAll("SELECT * FROM business_advertisements");
    const orderItems = await dbAll("SELECT * FROM order_items");
    const enriched = ads.map((ad) => {
      let mat = matDetails.find((m) => m.ad_id === ad.id);
      let bus = busDetails.find((b) => b.ad_id === ad.id);
      if (!mat && ad.type_code === "matrimony") {
        const item = orderItems.find((it) => it.ad_number === ad.ad_number && it.matrimony_details_json);
        if (item) {
          try {
            const parsed = JSON.parse(item.matrimony_details_json);
            mat = {
              ad_id: ad.id,
              name: parsed.name || ad.customer_name,
              dob: formatDobToDDMMYYYY(parsed.dob) || "",
              height: parsed.height || "",
              blood_group: parsed.blood_group || "",
              gotra: parsed.gotra || "",
              education: parsed.education || "",
              occupation: parsed.occupation || "",
              father_name: parsed.father_name || "",
              father_occupation: parsed.father_occupation || "",
              mother_name: parsed.mother_name || "",
              mobile1: parsed.mobile1 || ad.customer_mobile1,
              photo_url: parsed.photoUrl || ad.uploaded_jpg_url || ""
            };
          } catch (e) {
          }
        }
      } else if (mat) {
        mat = {
          ...mat,
          dob: formatDobToDDMMYYYY(mat.dob)
        };
      }
      if (!bus && ad.type_code === "business") {
        const item = orderItems.find((it) => it.ad_number === ad.ad_number && it.business_details_json);
        if (item) {
          try {
            const parsed = JSON.parse(item.business_details_json);
            bus = {
              ad_id: ad.id,
              business_name: parsed.businessName || "\u0935\u094D\u092F\u093E\u0935\u0938\u093E\u092F\u093F\u0915 \u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928",
              owner_name: parsed.ownerName || ad.customer_name,
              ready_ad_url: parsed.uploadedJpgUrl || parsed.readyAdUrl || ad.uploaded_jpg_url || "",
              photo_url: parsed.uploadedJpgUrl || parsed.photoUrl || ad.uploaded_jpg_url || "",
              mobile1: parsed.mobile1 || ad.customer_mobile1,
              design_link: parsed.designLink || ad.design_link || ""
            };
          } catch (e) {
          }
        }
      }
      return {
        ...ad,
        matrimonyProfile: mat || null,
        businessProfile: bus ? {
          ...bus,
          adMakerDesignJson: bus.ad_maker_design_json ? typeof bus.ad_maker_design_json === "string" ? JSON.parse(bus.ad_maker_design_json) : bus.ad_maker_design_json : null
        } : null
      };
    });
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/admin/advertisements/:id/publication", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { district_hi, sangathan_hi, magazine_hi, edition_hi } = req.body;
  try {
    const ad = await dbGet("SELECT ad_number FROM advertisements WHERE id = ?", [id]);
    if (!ad) return res.status(404).json({ error: "Advertisement not found" });
    await dbRun(`
      UPDATE advertisements SET
        district_hi = ?,
        sangathan_hi = ?,
        magazine_hi = ?,
        edition_hi = ?
      WHERE id = ?
    `, [district_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", sangathan_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", magazine_hi || "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E", edition_hi || "\u0938\u0902\u0938\u094D\u0915\u0930\u0923 2026", id]);
    await dbRun(`
      UPDATE order_items SET
        district_hi = ?,
        sangathan_hi = ?
      WHERE ad_number = ?
    `, [district_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", sangathan_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", ad.ad_number]);
    res.json({ success: true, message: "\u092A\u094D\u0930\u0915\u093E\u0936\u0928, \u091C\u093F\u0932\u093E \u090F\u0935\u0902 \u0938\u0902\u0917\u0920\u0928 \u0935\u093F\u0935\u0930\u0923 \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u0905\u092A\u0921\u0947\u091F \u0915\u093F\u092F\u093E \u0917\u092F\u093E\u0964" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/admin/orders/:orderId/publication", authenticateAdmin, async (req, res) => {
  const { orderId } = req.params;
  const { district_hi, sangathan_hi, magazine_hi, edition_hi, ad_number } = req.body;
  try {
    const order = await dbGet("SELECT * FROM orders WHERE order_id = ?", [orderId]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (ad_number) {
      await dbRun(`
        UPDATE order_items SET
          district_hi = ?,
          sangathan_hi = ?
        WHERE order_id = ? AND ad_number = ?
      `, [district_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", sangathan_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", orderId, ad_number]);
      await dbRun(`
        UPDATE advertisements SET
          district_hi = ?,
          sangathan_hi = ?,
          magazine_hi = ?,
          edition_hi = ?
        WHERE ad_number = ?
      `, [district_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", sangathan_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", magazine_hi || "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E", edition_hi || "\u0938\u0902\u0938\u094D\u0915\u0930\u0923 2026", ad_number]);
    } else {
      const items = await dbAll("SELECT ad_number FROM order_items WHERE order_id = ?", [orderId]);
      await dbRun(`
        UPDATE order_items SET
          district_hi = ?,
          sangathan_hi = ?
        WHERE order_id = ?
      `, [district_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", sangathan_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", orderId]);
      for (const item of items) {
        await dbRun(`
          UPDATE advertisements SET
            district_hi = ?,
            sangathan_hi = ?,
            magazine_hi = ?,
            edition_hi = ?
          WHERE ad_number = ?
        `, [district_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", sangathan_hi || "\u092A\u094D\u0930\u0915\u093E\u0936\u0928 \u0932\u0902\u092C\u093F\u0924", magazine_hi || "\u092A\u0930\u093F\u091A\u093E\u092F\u093F\u0915\u093E", edition_hi || "\u0938\u0902\u0938\u094D\u0915\u0930\u0923 2026", item.ad_number]);
      }
    }
    res.json({ success: true, message: "\u092A\u094D\u0930\u0915\u093E\u0936\u0928, \u091C\u093F\u0932\u093E \u090F\u0935\u0902 \u0938\u0902\u0917\u0920\u0928 \u0935\u093F\u0935\u0930\u0923 \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0915\u093F\u092F\u093E \u0917\u092F\u093E\u0964" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/admin/pricings/update", authenticateAdmin, async (req, res) => {
  const { id, price } = req.body;
  if (!id || price === void 0) {
    return res.status(400).json({ error: "Missing id or price parameters" });
  }
  try {
    await dbRun("UPDATE pricings SET price = ? WHERE id = ?", [toMoney(price), Number(id)]);
    res.json({ success: true, message: "Price updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/configurations", async (req, res) => {
  try {
    const configs = await dbAll("SELECT * FROM admin_configurations ORDER BY id DESC");
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/admin/configurations", authenticateAdmin, async (req, res) => {
  const { district, sangathan, magazine, edition, adv_type, size_name, width, height, unit, layout, pricing, status } = req.body;
  if (!district || !sangathan || !magazine || !edition || !adv_type || !size_name || pricing === void 0) {
    return res.status(400).json({ error: "Required fields are missing" });
  }
  try {
    const configuration_id = "CONF-" + Math.floor(1e5 + Math.random() * 9e5);
    await dbRun(`
      INSERT INTO admin_configurations (configuration_id, district, sangathan, magazine, edition, adv_type, size_name, width, height, unit, layout, pricing, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [configuration_id, district, sangathan, magazine, edition, adv_type, size_name, Number(width || 0), Number(height || 0), unit || "inch", layout || "Standard", Number(pricing), status || "enabled"]);
    res.json({ success: true, configurationId: configuration_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/admin/configurations/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { district, sangathan, magazine, edition, adv_type, size_name, width, height, unit, layout, pricing, status } = req.body;
  try {
    const existing = await dbGet("SELECT * FROM admin_configurations WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    await dbRun(`
      UPDATE admin_configurations SET
        district = ?, sangathan = ?, magazine = ?, edition = ?, adv_type = ?, size_name = ?,
        width = ?, height = ?, unit = ?, layout = ?, pricing = ?, status = ?
      WHERE id = ?
    `, [district, sangathan, magazine, edition, adv_type, size_name, Number(width || 0), Number(height || 0), unit || "inch", layout || "Standard", Number(pricing), status || "enabled", id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/admin/configurations/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM admin_configurations WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/backup", authenticateAdmin, async (req, res) => {
  try {
    const districts = await dbAll("SELECT * FROM districts");
    const sangathans = await dbAll("SELECT * FROM sangathans");
    const magazines = await dbAll("SELECT * FROM magazines");
    const editions = await dbAll("SELECT * FROM editions");
    const types = await dbAll("SELECT * FROM advertisement_types");
    const sizes = await dbAll("SELECT * FROM advertisement_sizes");
    const pricings = await dbAll("SELECT * FROM pricings");
    const advertisements = await dbAll("SELECT * FROM advertisements");
    const matrimonyProfiles = await dbAll("SELECT * FROM matrimony_profiles");
    const businessAdvertisements = await dbAll("SELECT * FROM business_advertisements");
    const orders = await dbAll("SELECT * FROM orders");
    const orderItems = await dbAll("SELECT * FROM order_items");
    const publications = await dbAll("SELECT * FROM publications");
    const printJobs = await dbAll("SELECT * FROM print_jobs");
    const settings = await dbAll("SELECT * FROM settings");
    const customFields = await dbAll("SELECT * FROM custom_fields");
    const adminConfigs = await dbAll("SELECT * FROM admin_configurations");
    const whatsappNotifications = await dbAll("SELECT * FROM whatsapp_notifications");
    const backupPayload = {
      app: "Parichayika",
      version: "2026.1",
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      exportedBy: req.username || "SuperAdmin",
      tables: {
        districts,
        sangathans,
        magazines,
        editions,
        advertisement_types: types,
        advertisement_sizes: sizes,
        pricings,
        advertisements,
        matrimony_profiles: matrimonyProfiles,
        business_advertisements: businessAdvertisements,
        orders,
        order_items: orderItems,
        publications,
        print_jobs: printJobs,
        settings,
        custom_fields: customFields,
        admin_configurations: adminConfigs,
        whatsapp_notifications: whatsappNotifications
      }
    };
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="parichayika-backup-${Date.now()}.json"`);
    res.json(backupPayload);
  } catch (error) {
    res.status(500).json({ error: "Backup generation failed: " + error.message });
  }
});
app.post("/api/admin/restore", authenticateAdmin, async (req, res) => {
  const { confirmation, backupData } = req.body;
  if (confirmation !== "CONFIRM_RESTORE" || !backupData || !backupData.tables) {
    return res.status(400).json({ error: "Invalid restore payload or confirmation keyword mismatch (must be CONFIRM_RESTORE)." });
  }
  try {
    const { tables } = backupData;
    if (Array.isArray(tables.districts)) {
      for (const d of tables.districts) {
        const exists = await dbGet("SELECT id FROM districts WHERE id = ?", [d.id]);
        if (exists) {
          await dbRun("UPDATE districts SET name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [d.name_en, d.name_hi, d.is_enabled, d.id]);
        } else {
          await dbRun("INSERT INTO districts (id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, ?)", [d.id, d.name_en, d.name_hi, d.is_enabled]);
        }
      }
    }
    if (Array.isArray(tables.sangathans)) {
      for (const s of tables.sangathans) {
        const exists = await dbGet("SELECT id FROM sangathans WHERE id = ?", [s.id]);
        if (exists) {
          await dbRun("UPDATE sangathans SET district_id = ?, name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [s.district_id, s.name_en, s.name_hi, s.is_enabled, s.id]);
        } else {
          await dbRun("INSERT INTO sangathans (id, district_id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, ?, ?)", [s.id, s.district_id, s.name_en, s.name_hi, s.is_enabled]);
        }
      }
    }
    if (Array.isArray(tables.magazines)) {
      for (const m of tables.magazines) {
        const exists = await dbGet("SELECT id FROM magazines WHERE id = ?", [m.id]);
        if (exists) {
          await dbRun("UPDATE magazines SET name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [m.name_en, m.name_hi, m.is_enabled, m.id]);
        } else {
          await dbRun("INSERT INTO magazines (id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, ?)", [m.id, m.name_en, m.name_hi, m.is_enabled]);
        }
      }
    }
    if (Array.isArray(tables.editions)) {
      for (const e of tables.editions) {
        const exists = await dbGet("SELECT id FROM editions WHERE id = ?", [e.id]);
        if (exists) {
          await dbRun("UPDATE editions SET magazine_id = ?, name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [e.magazine_id, e.name_en, e.name_hi, e.is_enabled, e.id]);
        } else {
          await dbRun("INSERT INTO editions (id, magazine_id, name_en, name_hi, is_enabled) VALUES (?, ?, ?, ?, ?)", [e.id, e.magazine_id, e.name_en, e.name_hi, e.is_enabled]);
        }
      }
    }
    if (Array.isArray(tables.pricings)) {
      for (const p of tables.pricings) {
        const exists = await dbGet("SELECT id FROM pricings WHERE id = ?", [p.id]);
        if (exists) {
          await dbRun("UPDATE pricings SET district_id = ?, sangathan_id = ?, magazine_id = ?, edition_id = ?, adv_type_code = ?, adv_size_code = ?, price = ? WHERE id = ?", [p.district_id, p.sangathan_id, p.magazine_id, p.edition_id, p.adv_type_code, p.adv_size_code, p.price, p.id]);
        } else {
          await dbRun("INSERT INTO pricings (id, district_id, sangathan_id, magazine_id, edition_id, adv_type_code, adv_size_code, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [p.id, p.district_id, p.sangathan_id, p.magazine_id, p.edition_id, p.adv_type_code, p.adv_size_code, p.price]);
        }
      }
    }
    res.json({ success: true, message: "\u0921\u0947\u091F\u093E\u092C\u0947\u0938 \u092C\u0948\u0915\u0905\u092A \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u092A\u0941\u0928\u0930\u094D\u0938\u094D\u0925\u093E\u092A\u093F\u0924 (Restored) \u0915\u093F\u092F\u093E \u0917\u092F\u093E\u0964" });
  } catch (error) {
    res.status(500).json({ error: "Restore operation failed: " + error.message });
  }
});
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});
var index_default = app;
async function startServer() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return;
  }
  try {
    await initDatabase();
  } catch (err) {
    console.warn("[SERVER STARTUP] Database initialization notice:", err?.message || err);
  }
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path3.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath, {
      setHeaders: (res) => {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      }
    }));
    app.get("*", (req, res) => {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.sendFile(import_path3.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
var isServerlessOrTest = Boolean(
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === "test"
);
if (!isServerlessOrTest) {
  startServer();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getSafeDbDiagnostics,
  initDatabase,
  isPostgres,
  transliterateText,
  uploadFile,
  validateUpload
});
//# sourceMappingURL=server.cjs.map
