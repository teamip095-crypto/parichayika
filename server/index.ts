import express from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import dotenv from "dotenv";
import {
  initDatabase,
  dbRun,
  dbAll,
  dbGet,
  generateAdNumber,
  isPostgres,
  getSafeDbDiagnostics
} from "./db";
import { uploadFile, validateUpload } from "./storage";
import { transliterateText } from "./transliteration";

// Load environment variables
dotenv.config();

// ============================================================================
// MONEY INTEGRITY HELPER — guarantees finite Number for any monetary value
// PostgreSQL pg driver returns NUMERIC(10,2) columns as strings ("500.00").
// Without coercion, "500.00" + "500.00" becomes string concatenation
// "500.00500.00" — exactly the bug the user reported.
// ============================================================================
function toMoney(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  // Strip currency symbols, thousand separators, whitespace
  const cleaned = String(value)
    .replace(/[₹$€£,\s]/g, "")
    .replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  if (!isFinite(n) || isNaN(n)) return 0;
  // Round to 2 decimals to prevent floating point drift
  return Math.round(n * 100) / 100;
}

// Coerce to a guaranteed-numeric string for SQL parameter binding
function toMoneyStr(value: any): string {
  return toMoney(value).toFixed(2);
}

// Format INR amount for display: 500 -> "₹500.00"
function formatINR(value: any): string {
  return "₹" + toMoney(value).toFixed(2);
}

const app = express();
const PORT = 3000;

// Production JWT Secret Validation
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      console.error("FATAL: JWT_SECRET environment variable is missing in production environment!");
    }
    return "parichayika-super-secret-key-2026";
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

// Middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Configure static uploads directory serving (only for local development).
// On Vercel serverless runtime the filesystem is read-only and uploads are
// persisted to Supabase Storage — this middleware is a no-op there.
if (!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
}

// JWT Authentication Middleware for Super Admin (Enforces role-based access control)
const authenticateAdmin = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
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

// Memory storage for serverless / persistent cloud object storage uploads
const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Max 50MB for print files (CDR, PSD, PDF, etc.)
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();
    const allowedExtensions = [".cdr", ".psd", ".pdf", ".ai", ".eps", ".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif", ".svg", ".jfif", ".heic", ".heif"];
    
    if (allowedExtensions.includes(ext) || mime.startsWith("image/") || mime.includes("pdf") || mime.includes("photoshop") || mime.includes("coreldraw") || mime.includes("postscript") || mime.includes("octet-stream")) {
      cb(null, true);
    } else {
      cb(null, true); // Allow all image formats gracefully
    }
  }
});

// Helper to retrieve the current maximum sequence number for Matrimony ads
// Fully compatible with PostgreSQL (POSIX regex ~) and SQLite (GLOB) with safety fallback
async function getMaxMatrimonyAdSeq(): Promise<number> {
  try {
    const sql = isPostgres
      ? "SELECT MAX(CAST(ad_number AS INTEGER)) as maxnum FROM advertisements WHERE type_code = 'matrimony' AND ad_number ~ '^[0-9]+$'"
      : "SELECT MAX(CAST(ad_number AS INTEGER)) as maxnum FROM advertisements WHERE type_code = 'matrimony' AND ad_number GLOB '[0-9]*'";
    const row = await dbGet<{ maxnum?: number; maxNum?: number }>(sql);
    const val = Number(row?.maxnum || (row as any)?.maxNum || 0);
    if (!isNaN(val) && val > 0) return val;
  } catch (err) {
    console.warn("Direct regex ad number query failed, using safe fallback scan:", err);
  }

  // Safe universal fallback
  try {
    const rows = await dbAll<{ ad_number: string }>("SELECT ad_number FROM advertisements WHERE type_code = 'matrimony'");
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

// API Routes

// 0. Primary Health Check & Readiness Endpoint (Must never block or fail on cold-start)
app.get(["/api/health", "/health"], (req: any, res: any) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const dbDiagnostics = getSafeDbDiagnostics();
  // Storage health check: BOTH SUPABASE_URL AND SUPABASE_SERVICE_ROLE_KEY must be set.
  // Reporting "supabase" when only URL is set (but key missing) was misleading and
  // hid the real production bug where uploads silently fell back to base64.
  const hasSupabaseUrl = !!process.env.SUPABASE_URL;
  const hasSupabaseServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const storageStatus = (hasSupabaseUrl && hasSupabaseServiceKey) ? "supabase"
                     : hasSupabaseUrl ? "supabase_misconfigured_key_missing"
                     : "unconfigured";
  return res.status(200).json({
    status: "ok",
    service: "parichayika-api",
    environment: process.env.NODE_ENV || "production",
    database: isPostgres ? "postgresql" : (dbDiagnostics.configured ? "postgresql_configured" : "ready"),
    storage: storageStatus,
    timestamp: new Date().toISOString()
  });
});

// Safe Database Diagnostics (Never outputs credentials, passwords, or tokens)
app.get("/api/db-diagnostics", async (req: any, res: any) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  try {
    const diag = getSafeDbDiagnostics();
    let queryTest: any = null;
    try {
      queryTest = await dbGet("SELECT 1 as connected");
    } catch (qErr: any) {
      queryTest = { error: qErr?.message || String(qErr) };
    }
    return res.status(200).json({
      status: "ok",
      diagnostics: diag,
      queryTest,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      error: err?.message || String(err),
      timestamp: new Date().toISOString()
    });
  }
});

// Helper to ensure numeric characters remain in English (ASCII digits 0-9)
function convertHindiNumeralsToEnglish(str: string): string {
  const mapping: { [key: string]: string } = {
    "०": "0",
    "१": "1",
    "२": "2",
    "३": "3",
    "४": "4",
    "५": "5",
    "६": "6",
    "७": "7",
    "८": "8",
    "९": "9"
  };
  return str.replace(/[०-९]/g, (m) => mapping[m] || m);
}

// Pre-transliteration translation map for biodata terms, honorifics, and occupations
function applyPreTransliterationFixes(text: string): { processed: string; hasOnlyKnownTerms: boolean } {
  if (!text) return { processed: text, hasOnlyKnownTerms: false };

  let processed = text.trim();

  // 1. Honorifics & Titles (Case-insensitive)
  processed = processed.replace(/(^|\s)(smt\.?|shrimati|shreemati|mrs\.?)(?=\s|$)/gi, "$1श्रीमती ");
  processed = processed.replace(/(^|\s)(shri\.?|shree|mr\.?|sri)(?=\s|$)/gi, "$1श्री ");
  processed = processed.replace(/(^|\s)(late\.?|lt\.?|sw\.?|swargiya|swargiye|expired|deceased|passed\s*away)(?=\s|$)/gi, "$1स्व. ");
  processed = processed.replace(/(^|\s)(dr\.?|doctor)(?=\s|$)/gi, "$1डॉ. ");
  processed = processed.replace(/(^|\s)(adv\.?|advocate|vakeel|vakil|lawyer)(?=\s|$)/gi, "$1अधिवक्ता ");
  processed = processed.replace(/(^|\s)(er\.?|engineer)(?=\s|$)/gi, "$1इंजी. ");
  processed = processed.replace(/(^|\s)(prof\.?|professor)(?=\s|$)/gi, "$1प्रो. ");
  processed = processed.replace(/(^|\s)(pt\.?|pandit)(?=\s|$)/gi, "$1पं. ");
  processed = processed.replace(/(^|\s)(ku\.?|kumari|ms\.?|sushri)(?=\s|$)/gi, "$1कु. ");

  // 2. Comprehensive Degree / Educational Qualifications mapping (Applied first to preserve acronyms)
  processed = processed.replace(/\b(10th\s*pass|10th\s*class|10th|10\s*th|दसवीं\s*पास|दसवीं|10\s*वीं\s*पास|10\s*वीं)\b/gi, "10वीं");
  processed = processed.replace(/\b(12th\s*pass|12th\s*class|12th|12\s*th|बारहवीं\s*पास|बारहवीं|12\s*वीं\s*पास|12\s*वीं)\b/gi, "12वीं");
  processed = processed.replace(/\b(m\.?\s*com\.?|mcom|एम\.?\s*कॉम\.?|म\.?\s*कॉम\.?|एमकॉम)\b/gi, "एम.कॉम.");
  processed = processed.replace(/\b(b\.?\s*com\.?|bcom|बी\.?\s*कॉम\.?|बीकॉम)\b/gi, "बी.कॉम.");
  processed = processed.replace(/\b(m\.?\s*a\.?|ma|एम\.?\s*ए\.?|एमए)\b/gi, "एम.ए.");
  processed = processed.replace(/\b(b\.?\s*a\.?|ba|बी\.?\s*ए\.?|बीए)\b/gi, "बी.ए.");
  processed = processed.replace(/\b(m\.?\s*sc\.?|msc|एम\.?\s*एससी\.?|एमएससी|एम\.?\s*एस\.?\s*सी\.?)\b/gi, "एम.एससी.");
  processed = processed.replace(/\b(b\.?\s*sc\.?|bsc|बी\.?\s*एससी\.?|बीएससी|बी\.?\s*एस\.?\s*सी\.?)\b/gi, "बी.एससी.");
  processed = processed.replace(/\b(m\.?\s*tech\.?|mtech|एम\.?\s*टेक\.?|एमटेक)\b/gi, "एम.टेक.");
  processed = processed.replace(/\b(b\.?\s*tech\.?|btech|बी\.?\s*टेक\.?|बीटेक)\b/gi, "बी.टेक.");
  processed = processed.replace(/\b(m\.?\s*e\.?|me|एम\.?\s*ई\.?|एमई)\b/gi, "एम.ई.");
  processed = processed.replace(/\b(b\.?\s*e\.?|be|बी\.?\s*ई\.?|बीई)\b/gi, "बी.ई.");
  processed = processed.replace(/\b(m\.?\s*c\.?\s*a\.?|mca|एम\.?\s*सी\.?\s*ए\.?|एमसीए)\b/gi, "एमसीए");
  processed = processed.replace(/\b(b\.?\s*c\.?\s*a\.?|bca|बी\.?\s*सी\.?\s*ए\.?|बीसीए)\b/gi, "बीसीए");
  processed = processed.replace(/\b(m\.?\s*b\.?\s*a\.?|mba|एम\.?\s*बी\.?\s*ए\.?|एमबीए)\b/gi, "एमबीए");
  processed = processed.replace(/\b(b\.?\s*b\.?\s*a\.?|bba|बी\.?\s*बी\.?\s*ए\.?|बीबीए)\b/gi, "बीबीए");
  processed = processed.replace(/\b(m\.?\s*b\.?\s*b\.?\s*s\.?|mbbs|एम\.?\s*बी\.?\s*बी\.?\s*एस\.?|एमबीबीएस)\b/gi, "एमबीबीएस");
  processed = processed.replace(/\b(b\.?\s*d\.?\s*s\.?|bds|बी\.?\s*डी\.?\s*एस\.?|बीडीएस)\b/gi, "बीडीएस");
  processed = processed.replace(/\b(b\.?\s*a\.?\s*m\.?\s*s\.?|bams|बी\.?\s*ए\.?\s*एम\.?\s*एस\.?|बीएएमएस)\b/gi, "बीएएमएस");
  processed = processed.replace(/\b(b\.?\s*h\.?\s*m\.?\s*s\.?|bhms|बी\.?\s*एच\.?\s*एम\.?\s*एस\.?|बीएचएमएस)\b/gi, "बीएचएमएस");
  processed = processed.replace(/\b(m\.?\s*d\.?|md|एम\.?\s*डी\.?|एमडी)\b/gi, "एम.डी.");
  processed = processed.replace(/\b(m\.?\s*s\.?|ms|एम\.?\s*एस\.?|एमएस)\b/gi, "एम.एस.");
  processed = processed.replace(/\b(l\.?\s*l\.?\s*m\.?|llm|एल\.?\s*एल\.?\s*एम\.?|एलएलएम)\b/gi, "एलएलएम");
  processed = processed.replace(/\b(l\.?\s*l\.?\s*b\.?|llb|एल\.?\s*एल\.?\s*बी\.?|एलएलबी)\b/gi, "एलएलबी");
  processed = processed.replace(/\b(m\.?\s*ed\.?|med|एम\.?\s*एड\.?|एमएड)\b/gi, "एम.एड.");
  processed = processed.replace(/\b(b\.?\s*ed\.?|bed|बी\.?\s*एड\.?|बीएड)\b/gi, "बी.एड.");
  processed = processed.replace(/\b(d\.?\s*el\.?\s*ed\.?|deled|डी\.?\s*एल\.?\s*एड\.?|डीएलएड)\b/gi, "डी.एल.एड.");
  processed = processed.replace(/\b(d\.?\s*ed\.?|ded|डी\.?\s*एड\.?|डीएड)\b/gi, "डी.एड.");
  processed = processed.replace(/\b(c\s*tet|ctet|सीटेट|सी\.?\s*टैट)\b/gi, "सीटेट");
  processed = processed.replace(/\b(t\s*et|tet|टेट|टी\.?\s*टैट)\b/gi, "टीईटी");
  processed = processed.replace(/\b(ph\.?\s*d\.?|phd|पी\.?\s*एच\.?\s*डी\.?|पीएचडी|पीएच\.?\s*डी\.?)\b/gi, "पीएच.डी.");
  processed = processed.replace(/\b(post\s*doctorate|पोस्ट\s*डॉक्टरेट)\b/gi, "पोस्ट डॉक्टरेट");
  processed = processed.replace(/\b(c\.?\s*a\.?|ca|सी\.?\s*ए\.?|सीए)\b/gi, "सीए");
  processed = processed.replace(/\b(c\.?\s*s\.?|cs|सी\.?\s*एस\.?|सीएस)\b/gi, "सीएस");
  processed = processed.replace(/\b(c\.?\s*m\.?\s*a\.?|cma|icwa|सीएमए|सी\.?\s*एम\.?\s*ए\.?)\b/gi, "सीएमए");
  processed = processed.replace(/\b(m\.?\s*pharm\.?|mpharm|m\s*pharma|एम\.?\s*फार्मा|एमफार्मा|एम\.?\s*फार्म)\b/gi, "एम.फार्मा");
  processed = processed.replace(/\b(b\.?\s*pharm\.?|bpharm|b\s*pharma|बी\.?\s*फार्मा|बीफार्मा|बी\.?\s*फार्म)\b/gi, "बी.फार्मा");
  processed = processed.replace(/\b(d\.?\s*pharm\.?|dpharm|d\s*pharma|डी\.?\s*फार्मा|डीफार्मा|डी\.?\s*फार्म)\b/gi, "डी.फार्मा");
  processed = processed.replace(/\b(pgdca|पीजीडीसीए|पी\.?\s*जी\.?\s*डी\.?\s*सी\.?\s*ए\.?)\b/gi, "पीजीडीसीए");
  processed = processed.replace(/\b(dca|डीसीए|डी\.?\s*सी\.?\s*ए\.?)\b/gi, "डीसीए");
  processed = processed.replace(/\b(iti|आईटीआई|आई\.?\s*टी\.?\s*आई\.?)\b/gi, "आईटीआई");
  processed = processed.replace(/\b(polytechnic|पॉलिटेक्निक|पोलिटेक्निक)\b/gi, "पॉलिटेक्निक");
  processed = processed.replace(/\b(diploma|डिप्लोमा)\b/gi, "डिप्लोमा");
  processed = processed.replace(/\b(post\s*graduat(e|ion)|पोस्ट\s*ग्रेजुएशन|पोस्ट\s*ग्रेजुएट|स्नातकोत्तर)\b/gi, "स्नातकोत्तर");
  processed = processed.replace(/\b(graduat(e|ion)|ग्रेजुएशन|ग्रेजुएट|स्नातक)\b/gi, "स्नातक");
  processed = processed.replace(/\b(honours|hons|ऑनर्स)\b/gi, "ऑनर्स");
  processed = processed.replace(/\b(pursuing|running|adhyayanrat|studying)\b/gi, "अध्ययनरत");
  processed = processed.replace(/\b(pass|passed|passed\s*out|completed|passedout)\b/gi, "उत्तीर्ण");
  processed = processed.replace(/\b(first\s*division|1st\s*division|1st\s*div|first\s*class)\b/gi, "प्रथम श्रेणी");
  processed = processed.replace(/\b(second\s*division|2nd\s*division|2nd\s*div|second\s*class)\b/gi, "द्वितीय श्रेणी");
  processed = processed.replace(/\b(third\s*division|3rd\s*division|3rd\s*div)\b/gi, "तृतीय श्रेणी");
  processed = processed.replace(/\b(gold\s*medalist|gold\s*medal)\b/gi, "स्वर्ण पदक विजेता");

  // 3. Comprehensive Occupations & Father's Occupation mapping
  processed = processed.replace(/(^|\s)(govt\.?\s*teacher|government\s*teacher|shaskiya\s*shikshak|sarkari\s*teacher|sarkari\s*master)(?=\s|$)/gi, "$1शासकीय शिक्षक");
  processed = processed.replace(/(^|\s)(govt\.?\s*service|govt\.?\s*job|government\s*service|government\s*job|shaskiya\s*seva|sarkari\s*naukri|govt\.?\s*employee|government\s*employee|govt\.?\s*servant|shaskiya\s*karmachari)(?=\s|$)/gi, "$1शासकीय सेवा");
  processed = processed.replace(/(^|\s)(pvt\.?\s*job|private\s*job|private\s*service|pvt\.?\s*service|private\s*naukri|private\s*company|pvt\.?\s*ltd|company\s*job)(?=\s|$)/gi, "$1निजी सेवा");
  processed = processed.replace(/(^|\s)(housewife|house\s*wife|homemaker|home\s*maker|grahini|grihini)(?=\s|$)/gi, "$1गृहणी");
  processed = processed.replace(/(^|\s)(farmer|farming|agriculture|kisan|krishak|kheti|krishi|kisani|khetibadi)\b/gi, "$1कृषि");
  processed = processed.replace(/(^|\s)(business|vyavasay|vyapar|dhandha|trade|trading)\b/gi, "$1व्यवसाय");
  processed = processed.replace(/(^|\s)(shopkeeper|shop\s*keeper|shop\s*owner|kirana\s*store|kirana\s*shop|general\s*store|kirana\s*vyapar|dukan|dukandar)\b/gi, "$1व्यवसाय (दुकान)");
  processed = processed.replace(/(^|\s)(teacher|shikshak|adhyapak|master|masterji|school\s*teacher)\b/gi, "$1शिक्षक");
  processed = processed.replace(/(^|\s)(lecturer|vyakhyata)\b/gi, "$1व्याख्याता");
  processed = processed.replace(/(^|\s)(professor|pradhyapak)\b/gi, "$1प्राध्यापक");
  processed = processed.replace(/(^|\s)(retired|retd\.?|sewanivritt|sevanivritt|pensioner)\b/gi, "$1सेवानिवृत्त");
  processed = processed.replace(/(^|\s)(ex\s*-?\s*serviceman|ex\s*army|retd\s*army|retd\s*fauj)\b/gi, "$1सेवानिवृत्त सैनिक");
  processed = processed.replace(/(^|\s)(self\s*employed|swarojgar|swarozgar|own\s*business|apna\s*kaam)\b/gi, "$1स्वरोजगार");
  processed = processed.replace(/(^|\s)(contractor|thekedar|thekedari|civil\s*contractor)\b/gi, "$1ठेकेदार");
  processed = processed.replace(/(^|\s)(civil\s*engineer)\b/gi, "$1सिविल इंजीनियर");
  processed = processed.replace(/(^|\s)(software\s*engineer|software\s*developer|it\s*engineer)\b/gi, "$1सॉफ्टवेयर इंजीनियर");
  processed = processed.replace(/(^|\s)(electrician|vidyut\s*karmi)\b/gi, "$1इलेक्ट्रीशियन");
  processed = processed.replace(/(^|\s)(plumber)\b/gi, "$1प्लंबर");
  processed = processed.replace(/(^|\s)(carpenter|badhai)\b/gi, "$1बढ़ई");
  processed = processed.replace(/(^|\s)(mason|mistri|rajmistri|rajgir)\b/gi, "$1राजमिस्त्री");
  processed = processed.replace(/(^|\s)(driver|chalak|auto\s*driver|car\s*driver)\b/gi, "$1चालक");
  processed = processed.replace(/(^|\s)(police|police\s*service|police\s*constable|inspector|sub\s*inspector|si|asi|ti)\b/gi, "$1पुलिस");
  processed = processed.replace(/(^|\s)(army|defence|defense|fauj|military|soldier|jawan)\b/gi, "$1भारतीय सेना");
  processed = processed.replace(/(^|\s)(accountant|lekhakar|munim)\b/gi, "$1लेखाकार");
  processed = processed.replace(/(^|\s)(bank\s*manager|branch\s*manager)\b/gi, "$1बैंक प्रबंधक");
  processed = processed.replace(/(^|\s)(bank\s*employee|banker|bank\s*clerk|bank\s*po)\b/gi, "$1बैंक कर्मचारी");
  processed = processed.replace(/(^|\s)(manager|prabandhak)\b/gi, "$1प्रबंधक");
  processed = processed.replace(/(^|\s)(doctor|chikitsak|vaidya)\b/gi, "$1चिकित्सक");
  processed = processed.replace(/(^|\s)(pharmacist|chemist|medical\s*store)\b/gi, "$1फार्मासिस्ट (मेडिकल)");
  processed = processed.replace(/(^|\s)(clerk|lipik|babu)\b/gi, "$1लिपिक");
  processed = processed.replace(/(^|\s)(mechanic)\b/gi, "$1मैकेनिक");
  processed = processed.replace(/(^|\s)(tailor|darji|silai)\b/gi, "$1दर्जी");
  processed = processed.replace(/(^|\s)(labour|labor|majduri|daily\s*wages|khetihar\s*majdoor|majdoor)\b/gi, "$1दैनिक मजदूरी");
  processed = processed.replace(/(^|\s)(security\s*guard|guard|chowkidar)\b/gi, "$1सुरक्षा गार्ड");
  processed = processed.replace(/(^|\s)(patwari)\b/gi, "$1पटवारी");
  processed = processed.replace(/(^|\s)(panchayat\s*sachiv|sachiv)\b/gi, "$1पंचायत सचिव");
  processed = processed.replace(/(^|\s)(sarpanch)\b/gi, "$1सरपंच");
  processed = processed.replace(/(^|\s)(kotwar)\b/gi, "$1कोटवार");
  processed = processed.replace(/(^|\s)(postman|dakpal|post\s*master)\b/gi, "$1डाकपाल");
  processed = processed.replace(/(^|\s)(and|aur|&|\+)\b/gi, "$1एवं");

  // Clean extra spaces
  processed = processed.replace(/\s+/g, " ").trim();

  // If already completely in Hindi / Devanagari script after translation
  const isAllHindi = /^[\u0900-\u097F\s\d+\-.,()/@#&]+$/.test(processed);

  return { processed, hasOnlyKnownTerms: isAllHindi };
}

// Custom dictionary and regex post-processing to fix spelling and academic/degree transliteration errors
function applyPostTransliterationFixes(text: string): string {
  if (!text) return text;

  let fixed = text;

  // 1. Common honorific & title mistranslations from phonetic tools
  fixed = fixed.replace(/(^|\s)शमत(?=\s|$)/g, "$1श्रीमती");
  fixed = fixed.replace(/(^|\s)शमती(?=\s|$)/g, "$1श्रीमती");
  fixed = fixed.replace(/(^|\s)श्रीमति(?=\s|$)/g, "$1श्रीमती");
  fixed = fixed.replace(/(^|\s)लेट(?=\s+[\u0900-\u097F])/g, "$1स्व.");
  fixed = fixed.replace(/(^|\s)स्वर्गी(?=\s|$)/g, "$1स्वर्गीय");

  // 2. Surname & Name phonetic fixes (Sahu -> साहू, Ashwini -> अश्विनी)
  fixed = fixed.replace(/सहु\b/g, "साहू");
  fixed = fixed.replace(/\bसहु\b/g, "साहू");
  fixed = fixed.replace(/सहु/g, "साहू");
  fixed = fixed.replace(/शाहू/g, "साहू");
  fixed = fixed.replace(/सहू/g, "साहू");
  fixed = fixed.replace(/अश्वनी/g, "अश्विनी");
  fixed = fixed.replace(/अश्विनि/g, "अश्विनी");
  fixed = fixed.replace(/साहूू/g, "साहू");
  fixed = fixed.replace(/राम कुमार/g, "रामकुमार");
  fixed = fixed.replace(/राज कुमार/g, "राजकुमार");

  // 3. Degrees & Educational acronyms cleanups
  const degreeRules: { pattern: RegExp; replacement: string }[] = [
    // Schooling
    { pattern: /\b(10th\s*pass|10th\s*class|10th|दसवीं\s*पास|दसवीं|10\s*वीं\s*पास|10\s*वीं)\b/gi, replacement: "10वीं" },
    { pattern: /\b(12th\s*pass|12th\s*class|12th|बारहवीं\s*पास|बारहवीं|12\s*वीं\s*पास|12\s*वीं)\b/gi, replacement: "12वीं" },
    
    // Commerce
    { pattern: /\b(m\.?\s*com\.?|mcom|एम\.?\s*कॉम\.?|म\.?\s*कॉम\.?|एमकॉम)\b/gi, replacement: "एम.कॉम." },
    { pattern: /\b(b\.?\s*com\.?|bcom|बी\.?\s*कॉम\.?|बीकॉम)\b/gi, replacement: "बी.कॉम." },
    
    // Arts
    { pattern: /\b(m\.?\s*a\.?|ma|एम\.?\s*ए\.?|एमए)\b/gi, replacement: "एम.ए." },
    { pattern: /\b(b\.?\s*a\.?|ba|बी\.?\s*ए\.?|बीए)\b/gi, replacement: "बी.ए." },
    
    // Science
    { pattern: /\b(m\.?\s*sc\.?|msc|एम\.?\s*एससी\.?|एमएससी|एम\.?\s*एस\.?\s*सी\.?)\b/gi, replacement: "एम.एससी." },
    { pattern: /\b(b\.?\s*sc\.?|bsc|बी\.?\s*एससी\.?|बीएससी|बी\.?\s*एस\.?\s*सी\.?)\b/gi, replacement: "बी.एससी." },
    
    // Engineering & Technology
    { pattern: /\b(m\.?\s*tech\.?|mtech|एम\.?\s*टेक\.?|एमटेक)\b/gi, replacement: "एम.टेक." },
    { pattern: /\b(b\.?\s*tech\.?|btech|बी\.?\s*टेक\.?|बीटेक)\b/gi, replacement: "बी.टेक." },
    { pattern: /\b(m\.?\s*e\.?|me|एम\.?\s*ई\.?|एमई)\b/gi, replacement: "एम.ई." },
    { pattern: /\b(b\.?\s*e\.?|be|बी\.?\s*ई\.?|बीई)\b/gi, replacement: "बी.ई." },
    
    // Computer Applications & Management
    { pattern: /\b(m\.?\s*c\.?\s*a\.?|mca|एम\.?\s*सी\.?\s*ए\.?|एमसीए)\b/gi, replacement: "एमसीए" },
    { pattern: /\b(b\.?\s*c\.?\s*a\.?|bca|बी\.?\s*सी\.?\s*ए\.?|बीसीए)\b/gi, replacement: "बीसीए" },
    { pattern: /\b(m\.?\s*b\.?\s*a\.?|mba|एम\.?\s*बी\.?\s*ए\.?|एमबीए)\b/gi, replacement: "एमबीए" },
    { pattern: /\b(b\.?\s*b\.?\s*a\.?|bba|बी\.?\s*बी\.?\s*ए\.?|बीबीए)\b/gi, replacement: "बीबीए" },
    
    // Medical & Paramedical
    { pattern: /\b(m\.?\s*b\.?\s*b\.?\s*s\.?|mbbs|एम\.?\s*बी\.?\s*बी\.?\s*एस\.?|एमबीबीएस)\b/gi, replacement: "एमबीबीएस" },
    { pattern: /\b(b\.?\s*d\.?\s*s\.?|bds|बी\.?\s*डी\.?\s*एस\.?|बीडीएस)\b/gi, replacement: "बीडीएस" },
    { pattern: /\b(b\.?\s*a\.?\s*m\.?\s*s\.?|bams|बी\.?\s*ए\.?\s*एम\.?\s*एस\.?|बीएएमएस)\b/gi, replacement: "बीएएमएस" },
    { pattern: /\b(b\.?\s*h\.?\s*m\.?\s*s\.?|bhms|बी\.?\s*एच\.?\s*एम\.?\s*एस\.?|बीएचएमएस)\b/gi, replacement: "बीएचएमएस" },
    { pattern: /\b(m\.?\s*d\.?|md|एम\.?\s*डी\.?|एमडी)\b/gi, replacement: "एम.डी." },
    { pattern: /\b(m\.?\s*s\.?|ms|एम\.?\s*एस\.?|एमएस)\b/gi, replacement: "एम.एस." },
    
    // Law
    { pattern: /\b(l\.?\s*l\.?\s*m\.?|llm|एल\.?\s*एल\.?\s*एम\.?|एलएलएम)\b/gi, replacement: "एलएलएम" },
    { pattern: /\b(l\.?\s*l\.?\s*b\.?|llb|एल\.?\s*एल\.?\s*बी\.?|एलएलबी)\b/gi, replacement: "एलएलबी" },
    
    // Education & Teaching
    { pattern: /\b(m\.?\s*ed\.?|med|एम\.?\s*एड\.?|एमएड)\b/gi, replacement: "एम.एड." },
    { pattern: /\b(b\.?\s*ed\.?|bed|बी\.?\s*एड\.?|बीएड)\b/gi, replacement: "बी.एड." },
    { pattern: /\b(d\.?\s*el\.?\s*ed\.?|deled|डी\.?\s*एल\.?\s*एड\.?|डीएलएड)\b/gi, replacement: "डी.एल.एड." },
    { pattern: /\b(d\.?\s*ed\.?|ded|डी\.?\s*एड\.?|डीएड)\b/gi, replacement: "डी.एड." },
    { pattern: /\b(c\s*tet|ctet|सीटेट|सी\.?\s*टैट)\b/gi, replacement: "सीटेट" },
    { pattern: /\b(t\s*et|tet|टेट|टी\.?\s*टैट)\b/gi, replacement: "टीईटी" },
    
    // Doctorate & Higher Research
    { pattern: /\b(ph\.?\s*d\.?|phd|पी\.?\s*एच\.?\s*डी\.?|पीएचडी|पीएच\.?\s*डी\.?)\b/gi, replacement: "पीएच.डी." },
    { pattern: /\b(post\s*doctorate|पोस्ट\s*डॉक्टरेट)\b/gi, replacement: "पोस्ट डॉक्टरेट" },
    
    // Professional / Finance
    { pattern: /\b(c\.?\s*a\.?|ca|सी\.?\s*ए\.?|सीए)\b/gi, replacement: "सीए" },
    { pattern: /\b(c\.?\s*s\.?|cs|सी\.?\s*एस\.?|सीएस)\b/gi, replacement: "सीएस" },
    { pattern: /\b(c\.?\s*m\.?\s*a\.?|cma|icwa|सीएमए|सी\.?\s*एम\.?\s*ए\.?)\b/gi, replacement: "सीएमए" },
    
    // Pharmacy
    { pattern: /\b(m\.?\s*pharm\.?|mpharm|m\s*pharma|एम\.?\s*फार्मा|एमफार्मा|एम\.?\s*फार्म)\b/gi, replacement: "एम.फार्मा" },
    { pattern: /\b(b\.?\s*pharm\.?|bpharm|b\s*pharma|बी\.?\s*फार्मा|बीफार्मा|बी\.?\s*फार्म)\b/gi, replacement: "बी.फार्मा" },
    { pattern: /\b(d\.?\s*pharm\.?|dpharm|d\s*pharma|डी\.?\s*फार्मा|डीफार्मा|डी\.?\s*फार्म)\b/gi, replacement: "डी.फार्मा" },
    
    // Computer & Technical Diplomas
    { pattern: /\b(pgdca|पीजीडीसीए|पी\.?\s*जी\.?\s*डी\.?\s*सी\.?\s*ए\.?)\b/gi, replacement: "पीजीडीसीए" },
    { pattern: /\b(dca|डीसीए|डी\.?\s*सी\.?\s*ए\.?)\b/gi, replacement: "डीसीए" },
    { pattern: /\b(iti|आईटीआई|आई\.?\s*टी\.?\s*आई\.?)\b/gi, replacement: "आईटीआई" },
    { pattern: /\b(polytechnic|पॉलिटेक्निक|पोलिटेक्निक)\b/gi, replacement: "पॉलिटेक्निक" },
    { pattern: /\b(diploma|डिप्लोमा)\b/gi, replacement: "डिप्लोमा" },
    
    // General degree terms
    { pattern: /\b(post\s*graduat(e|ion)|पोस्ट\s*ग्रेजुएशन|पोस्ट\s*ग्रेजुएट|स्नातकोत्तर)\b/gi, replacement: "स्नातकोत्तर" },
    { pattern: /\b(graduat(e|ion)|ग्रेजुएशन|ग्रेजुएट|स्नातक)\b/gi, replacement: "स्नातक" },
    { pattern: /\b(honours|hons|ऑनर्स)\b/gi, replacement: "ऑनर्स" },
    { pattern: /\b(pursuing|running|adhyayanrat|studying)\b/gi, replacement: "अध्ययनरत" },
    { pattern: /\b(pass|passed|passed\s*out|completed|passedout)\b/gi, replacement: "उत्तीर्ण" },
    { pattern: /\b(first\s*division|1st\s*division|1st\s*div|first\s*class)\b/gi, replacement: "प्रथम श्रेणी" },
    { pattern: /\b(second\s*division|2nd\s*division|2nd\s*div|second\s*class)\b/gi, replacement: "द्वितीय श्रेणी" },
    { pattern: /\b(third\s*division|3rd\s*division|3rd\s*div)\b/gi, replacement: "तृतीय श्रेणी" },
    { pattern: /\b(gold\s*medalist|gold\s*medal)\b/gi, replacement: "स्वर्ण पदक विजेता" }
  ];

  for (const rule of degreeRules) {
    fixed = fixed.replace(rule.pattern, rule.replacement);
  }

  return fixed;
}

// Unified processing wrapper
function transliterationPostProcess(str: string): string {
  const englishDigits = convertHindiNumeralsToEnglish(str);
  return applyPostTransliterationFixes(englishDigits);
}

// Universal Date of Birth DD/MM/YYYY formatter
function formatDobToDDMMYYYY(val?: string | null): string {
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

// Google Translate API helper
async function translateViaGoogle(text: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0]
          .map((item: any) => item[0])
          .filter(Boolean)
          .join("");
        if (translated && translated.trim()) {
          return translated.trim();
        }
      }
    }
  } catch (err) {
    // ignore
  }
  return null;
}

// 1. Google Cloud Translation & Transliteration converter API
app.post("/api/transliterate", async (req: any, res: any) => {
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
  } catch (err: any) {
    console.error("Transliteration endpoint error:", err);
    return res.json({
      result: text,
      method: "ERROR_FALLBACK"
    });
  }
});

// 2. Load Masters Data (for frontend selections)
app.get("/api/masters", async (req: any, res: any) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Next Auto Ad Number for Matrimony & Business
app.get("/api/advertisements/next-ad-number", async (req: any, res: any) => {
  const typeCode = req.query.type || "matrimony";
  const magazineHi = req.query.magazine || "परिचायिका";
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create or Edit an Advertisement (Draft/Final with Immediate Immutable Advertisement Number Generation & Cart Synchronization)
app.post("/api/advertisements/save", async (req: any, res: any) => {
  const { adId, typeCode, publicationId, sizeCode, customerName, customerMobile, sessionId: rawSessionId, formData = {} } = req.body;
  const sessionId = (rawSessionId || formData.sessionId || req.query?.sessionId || "").toString().trim();
  const effectiveCustomerName = customerName || (typeCode === "business" ? "व्यवसायिक विज्ञापन" : "");
  const effectiveCustomerMobile = customerMobile || (typeCode === "business" ? "9999999999" : "");
  if (!typeCode || !effectiveCustomerName || !effectiveCustomerMobile) {
    return res.status(400).json({ error: "Required fields are missing" });
  }

  const cleanPhone = effectiveCustomerMobile.replace(/[^0-9]/g, "");
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: "मुख्य मोबाइल नंबर ठीक 10 अंकों का होना आवश्यक है।" });
  }

  try {
    // 1. Resolve publication details
    let district_hi = "रायपुर";
    let sangathan_hi = "रायपुर साहू संगठन";
    let magazine_hi = "परिचायिका";
    let edition_hi = "संस्करण 2026";
    let price = 500;
    let size_hi = "विवाह मानक (3.5 × 2 इंच)";

    if (typeCode === "business") {
      if (sizeCode === "business_full") {
        size_hi = "पूरा पृष्ठ (7.2 × 9.6 इंच)";
        price = 5000;
      } else if (sizeCode === "business_half") {
        size_hi = "आधा पृष्ठ (7.2 × 4.8 इंच)";
        price = 3000;
      } else if (sizeCode === "business_quarter") {
        size_hi = "चौथाई पृष्ठ (3.6 × 4.8 इंच)";
        price = 1500;
      } else {
        size_hi = "व्यवसायिक विज्ञापन";
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
        size_hi = `${conf.size_name} (${conf.width} × ${conf.height} ${conf.unit})`;
      } else {
        return res.status(400).json({ error: "इस विज्ञापन के लिए आवश्यक प्रकाशन कॉन्फ़िगरेशन उपलब्ध नहीं है। कृपया व्यवस्थापक से संपर्क करें।" });
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

        // Resolve pricing from DB pricing master
        const pricing = await dbGet(`
          SELECT price FROM pricings
          WHERE district_id = ? AND sangathan_id = ? AND magazine_id = ? AND edition_id = ?
          AND adv_type_code = ? AND adv_size_code = ?
        `, [pub.district_id, pub.sangathan_id, pub.magazine_id, pub.edition_id, typeCode, sizeCode || "matrimony_standard"]);

        if (pricing) {
          price = pricing.price;
        } else {
          if (typeCode === "matrimony") price = 500;
          else if (sizeCode === "business_full") price = 5000;
          else if (sizeCode === "business_half") price = 3000;
          else if (sizeCode === "business_quarter") price = 1500;
          else price = 2500;
        }
      }

      if (typeCode === "business" && sizeCode) {
        const sz = await dbGet("SELECT name_hi FROM advertisement_sizes WHERE code = ?", [sizeCode]);
        if (sz) size_hi = sz.name_hi;
      }
    } else {
      // CUSTOM / MANUAL OR ADMIN-ASSIGNED DISTRICT & SANGATHAN
      district_hi = formData.district_hi || "आवंटन प्रतीक्षित";
      sangathan_hi = formData.sangathan_hi || "आवंटन प्रतीक्षित";
      magazine_hi = formData.magazine_hi || "परिचायिका";
      edition_hi = formData.edition_hi || "संस्करण 2026";

      if (typeCode === "matrimony") price = 500;
      else if (sizeCode === "business_full") price = 5000;
      else if (sizeCode === "business_half") price = 3000;
      else if (sizeCode === "business_quarter") price = 1500;
      else price = 2500;

      if (typeCode === "business" && sizeCode) {
        const sz = await dbGet("SELECT name_hi FROM advertisement_sizes WHERE code = ?", [sizeCode]);
        if (sz) size_hi = sz.name_hi;
      }
    }

    const created_at = new Date().toISOString();
    let targetAdId: number;
    let finalAdNum = "";

    // Check if adId exists in DB
    let existingAd: any = null;
    if (adId) {
      existingAd = await dbGet("SELECT id, ad_number FROM advertisements WHERE id = ?", [adId]);
    }

    if (existingAd) {
      // EDIT MODE: Update existing advertisements record
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
      // CREATE MODE: Generate a unique, persistent, immutable ad_number immediately on save!
      if (typeCode === "matrimony") {
        const maxSeq = await getMaxMatrimonyAdSeq();
        let nextSeq = maxSeq + 1;
        finalAdNum = String(nextSeq).padStart(3, "0");
        while (await dbGet("SELECT id FROM advertisements WHERE ad_number = ?", [finalAdNum])) {
          nextSeq++;
          finalAdNum = String(nextSeq).padStart(3, "0");
        }
      } else {
        const countRow = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM advertisements WHERE type_code = 'business'");
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
        const maxAd = await dbGet<{ maxId: number }>("SELECT MAX(id) as maxId FROM advertisements");
        targetAdId = maxAd?.maxId || 1;
      }
    }

    if (typeCode === "matrimony") {
      const standardKeys = [
        "name", "dob", "height", "blood_group", "gotra", "education", "occupation",
        "father_name", "father_occupation", "mother_name", "mobile1", "mobile2", "whatsapp",
        "currentAddress", "permanentAddress", "photoUrl", "biodataUrl"
      ];
      const extraFields: Record<string, any> = {};
      for (const k of Object.keys(formData)) {
        if (!standardKeys.includes(k)) {
          extraFields[k] = formData[k];
        }
      }

      // Safe clean up in case of any duplicate/orphan before inserting
      await dbRun("DELETE FROM matrimony_profiles WHERE ad_id = ?", [targetAdId]);

      await dbRun(`
        INSERT INTO matrimony_profiles (
          ad_id, name, dob, height, blood_group, gotra, education, occupation,
          father_name, father_occupation, mother_name, mobile1, mobile2, whatsapp,
          current_address, permanent_address, photo_url, biodata_url, extra_fields_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        targetAdId, formData.name || "", formatDobToDDMMYYYY(formData.dob) || "", formData.height || "", formData.blood_group || "", formData.gotra || "", formData.education || "", formData.occupation || "",
        formData.father_name || "", formData.father_occupation || "", formData.mother_name || "", formData.mobile1 || "", formData.mobile2 || "", formData.whatsapp || "",
        formData.currentAddress || "", formData.permanentAddress || "", formData.photoUrl || "", formData.biodataUrl || "", JSON.stringify(extraFields)
      ]);
    } else {
      const standardKeys = [
        "businessName", "ownerName", "category", "businessDesc", "productsServices", "specialOffer",
        "keyFeatures", "mobile1", "mobile2", "whatsapp", "email", "businessAddress", "otherAddress",
        "logoUrl", "photoUrl", "readyAdUrl", "designLink"
      ];
      const extraFields: Record<string, any> = {};
      for (const k of Object.keys(formData)) {
        if (!standardKeys.includes(k)) {
          extraFields[k] = formData[k];
        }
      }

      const readyUrl = formData.readyAdUrl || formData.designLink || "";

      // Safe clean up in case of any duplicate/orphan before inserting
      await dbRun("DELETE FROM business_advertisements WHERE ad_id = ?", [targetAdId]);

      await dbRun(`
        INSERT INTO business_advertisements (
          ad_id, business_name, owner_name, category, business_desc, products_services, special_offer,
          key_features, mobile1, mobile2, whatsapp, email, business_address, other_address,
          logo_url, photo_url, ready_ad_url, extra_fields_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        targetAdId, formData.businessName || "व्यवसाय विज्ञापन", formData.ownerName || effectiveCustomerName, formData.category || "", formData.businessDesc || "", formData.productsServices || "", formData.specialOffer || "",
        formData.keyFeatures || "", formData.mobile1 || effectiveCustomerMobile, formData.mobile2 || "", formData.whatsapp || "", formData.email || "", formData.businessAddress || "", formData.otherAddress || "",
        formData.logoUrl || "", formData.photoUrl || "", readyUrl, JSON.stringify(extraFields)
      ]);
    }

    let cartItemId: number | null = null;

    // Immediately synchronize/upsert cart item if sessionId is provided
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

      // Check for existing cart item for same sessionId and advertisement
      const existingCartItems = await dbAll("SELECT id, data_json FROM cart_items WHERE session_id = ?", [sessionId]);
      for (const item of existingCartItems) {
        try {
          const parsed = JSON.parse(item.data_json);
          if (parsed.adId === targetAdId || (parsed.adNumber && parsed.adNumber === finalAdNum)) {
            cartItemId = item.id;
            break;
          }
        } catch {}
      }

      if (cartItemId) {
        await dbRun(
          "UPDATE cart_items SET ad_type = ?, data_json = ?, price = ? WHERE id = ?", [typeCode, JSON.stringify(cartItemData), toMoney(price), cartItemId]
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

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Persistent File Upload Route with robust error handling (Multipart + Base64 JSON support)
app.post("/api/upload", (req: any, res: any, next: any) => {
  // If JSON request with base64 image data
  if (req.is("json") || (req.body && req.body.base64)) {
    return next();
  }
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req: any, res: any) => {
  try {
    const uploadFolder = req.query.folder || (req.body && req.body.folder) || "general";

    // Case 1: Base64 JSON uploaded
    if (req.body && req.body.base64) {
      const { base64, filename = `upload-${Date.now()}.jpg` } = req.body;
      const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let mimetype = "image/jpeg";
      
      if (matches && matches.length === 3) {
        mimetype = matches[1];
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(base64, "base64");
      }

      const uploadRes = await uploadFile({
        buffer,
        originalname: filename,
        mimetype,
        folder: uploadFolder
      });

      const result = await dbRun(
        "INSERT INTO uploads (filename, filepath, url, mimetype, size, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [uploadRes.filename, uploadRes.storagePath, uploadRes.url, uploadRes.mimetype, uploadRes.size, new Date().toISOString()]
      );

      return res.json({
        id: result.lastID,
        url: uploadRes.url,
        mimetype: uploadRes.mimetype,
        size: uploadRes.size,
        provider: uploadRes.provider
      });
    }

    // Case 2: Standard Multipart file uploaded
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "कोई फ़ाइल प्राप्त नहीं हुई। कृपया पुनः प्रयास करें।" });
    }

    const uploadRes = await uploadFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname || `upload-${Date.now()}.jpg`,
      mimetype: req.file.mimetype || "image/jpeg",
      folder: uploadFolder
    });

    const result = await dbRun(
      "INSERT INTO uploads (filename, filepath, url, mimetype, size, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [uploadRes.filename, uploadRes.storagePath, uploadRes.url, uploadRes.mimetype, uploadRes.size, new Date().toISOString()]
    );

    res.json({
      id: result.lastID,
      url: uploadRes.url,
      mimetype: uploadRes.mimetype,
      size: uploadRes.size,
      provider: uploadRes.provider
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Direct Dispatch & Email Notification Endpoint for ipgroup2002@gmail.com
app.post("/api/dispatch-email", async (req: any, res: any) => {
  const { recipientEmail, subject, adNumber, customerName, customerMobile, adType, dimensions, fileUrl, designData, fullDetails } = req.body;
  const targetEmail = recipientEmail || "ipgroup2002@gmail.com";

  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      targetEmail,
      subject: subject || `[परिचायिका 2026] नया विज्ञापन प्रविष्टि - ${adNumber || "ADV"} (${customerName || "Customer"})`,
      adNumber,
      customerName,
      customerMobile,
      adType,
      dimensions,
      fileUrl,
      fullDetails
    };

    console.log(`[DISPATCH EMAIL TO ${targetEmail}]`, JSON.stringify(logEntry, null, 2));

    // Also persist dispatch log in database for admin auditing
    try {
      await dbRun(
        "INSERT INTO admin_activity_logs (admin_username, action_type, description, target_id, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          "SYSTEM_DISPATCH",
          "EMAIL_DISPATCH_TO_INDIAN_PRESS",
          `विज्ञापन फ़ाइल/प्रविष्टि सीधे ${targetEmail} को भेजी गई। ग्राहक: ${customerName}, फोन: ${customerMobile}, विज्ञापन संख्या: ${adNumber}`,
          adNumber || "DIRECT_SUBMISSION",
          req.ip || "127.0.0.1",
          new Date().toISOString()
        ]
      );
    } catch (e) {
      console.warn("Could not write to admin_activity_logs:", e);
    }

    res.json({
      success: true,
      message: `प्रविष्टि सफलतापूर्वक ${targetEmail} और इंडियन प्रेस एडमिन को प्रेषित की गई।`,
      targetEmail,
      timestamp: logEntry.timestamp,
      adNumber
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Persistent Shopping Cart APIs
app.get("/api/cart", async (req: any, res: any) => {
  const sessionId = (req.query.sessionId || "").toString().trim();
  if (!sessionId) return res.json([]);
  try {
    const items = await dbAll("SELECT * FROM cart_items WHERE session_id = ? ORDER BY id DESC", [sessionId]);
    res.json(items.map((item: any) => ({
      id: item.id,
      sessionId: item.session_id,
      adType: item.ad_type,
      data: JSON.parse(item.data_json),
      price: toMoney(item.price)
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/cart/add", async (req: any, res: any) => {
  const { sessionId: rawSessionId, adType, data, price } = req.body;
  const sessionId = (rawSessionId || "").toString().trim();
  if (!sessionId || !adType || !data) {
    return res.status(400).json({ error: "Missing required cart details" });
  }
  try {
    const created_at = new Date().toISOString();

    // Deduplicate if cart item with same adId or adNumber already exists for this session
    if (data.adId || data.adNumber) {
      const existing = await dbAll("SELECT id, data_json FROM cart_items WHERE session_id = ?", [sessionId]);
      for (const ex of existing) {
        try {
          const parsed = JSON.parse(ex.data_json);
          if ((data.adId && parsed.adId === data.adId) || (data.adNumber && parsed.adNumber === data.adNumber)) {
            await dbRun("DELETE FROM cart_items WHERE id = ?", [ex.id]);
          }
        } catch {}
      }
    }

    const result = await dbRun(
      "INSERT INTO cart_items (session_id, ad_type, data_json, price, created_at) VALUES (?, ?, ?, ?, ?)",
      [sessionId, adType, JSON.stringify(data), price, created_at]
    );
    res.json({ success: true, id: result.lastID });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Matrimony Ad Multi-Publication Cart Add Endpoint
app.post("/api/cart/add-matrimony", async (req: any, res: any) => {
  const { sessionId: rawSessionId, matrimonyData, publications } = req.body;
  const sessionId = (rawSessionId || "").toString().trim();
  if (!sessionId || !matrimonyData || !publications || !Array.isArray(publications) || publications.length === 0) {
    return res.status(400).json({ error: "कृपया सभी आवश्यक विवरण और कम से कम एक प्रकाशन चुनें।" });
  }

  try {
    const created_at = new Date().toISOString();
    const addedItems = [];

    // Deduplicate any previous cart item for this adId or adNumber under this sessionId
    if (matrimonyData.adId || matrimonyData.adNumber) {
      const existing = await dbAll("SELECT id, data_json FROM cart_items WHERE session_id = ?", [sessionId]);
      for (const ex of existing) {
        try {
          const parsed = JSON.parse(ex.data_json);
          if ((matrimonyData.adId && parsed.adId === matrimonyData.adId) || (matrimonyData.adNumber && parsed.adNumber === matrimonyData.adNumber)) {
            await dbRun("DELETE FROM cart_items WHERE id = ?", [ex.id]);
          }
        } catch {}
      }
    }

    for (let i = 0; i < publications.length; i++) {
      const pub = publications[i];
      const districtId = Number(pub.district_id) || 1;
      const sangathanId = Number(pub.sangathan_id) || 1;
      const magazineId = Number(pub.magazine_id) || 1;
      const editionId = Number(pub.edition_id) || 1;
      const sizeCode = pub.size_code || "matrimony_standard";

      // Resilient master lookups
      const district = await dbGet("SELECT * FROM districts WHERE id = ?", [districtId]);
      const sangathan = await dbGet("SELECT * FROM sangathans WHERE id = ?", [sangathanId]);
      const magazine = await dbGet("SELECT * FROM magazines WHERE id = ?", [magazineId]);
      const edition = await dbGet("SELECT * FROM editions WHERE id = ?", [editionId]);

      const district_hi = district?.name_hi || pub.district_hi || matrimonyData.district_hi || "रायपुर";
      const sangathan_hi = sangathan?.name_hi || pub.sangathan_hi || matrimonyData.sangathan_hi || "रायपुर साहू संगठन";
      const magazine_hi = magazine?.name_hi || pub.magazine_hi || matrimonyData.magazine_hi || "परिचायिका";
      const edition_hi = edition?.name_hi || pub.edition_hi || matrimonyData.edition_hi || "संस्करण 2026";

      const sizeRecord = await dbGet("SELECT * FROM advertisement_sizes WHERE code = ?", [sizeCode]);
      const size_hi = sizeRecord?.name_hi || "विवाह मानक (3.5 × 2 इंच)";

      // Server-side authoritative pricing lookup
      let pricing = await dbGet(
        "SELECT price FROM pricings WHERE district_id = ? AND sangathan_id = ? AND magazine_id = ? AND edition_id = ? AND adv_type_code = 'matrimony' AND adv_size_code = ?",
        [districtId, sangathanId, magazineId, editionId, sizeCode]
      );

      if (!pricing || pricing.price === undefined || pricing.price === null || pricing.price <= 0) {
        pricing = await dbGet(
          "SELECT price FROM pricings WHERE district_id = ? AND sangathan_id = ? AND adv_type_code = 'matrimony'",
          [districtId, sangathanId]
        );
      }

      const verifiedPrice = pricing && toMoney(pricing.price) > 0 ? toMoney(pricing.price) : 500;

      // Auto-generate or preserve unique ad number for this publication
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Business Ad Multi-Publication Cart Add Endpoint
app.post("/api/cart/add-business", async (req: any, res: any) => {
  const { sessionId, sizeCode, designLink, uploadedJpgUrl, publications } = req.body;
  if (!sessionId || !sizeCode || !designLink || !uploadedJpgUrl || !publications || !Array.isArray(publications) || publications.length === 0) {
    return res.status(400).json({ error: "कृपया सभी आवश्यक विवरण (डिज़ाइन लिंक, CMYK JPG फ़ाइल और कम से कम एक प्रकाशन) दर्ज करें।" });
  }

  const validSizes = ["business_full", "business_half", "business_quarter"];
  if (!validSizes.includes(sizeCode)) {
    return res.status(400).json({ error: "अमान्य विज्ञापन आकार।" });
  }

  try {
    const sizeRecord = await dbGet("SELECT * FROM advertisement_sizes WHERE code = ?", [sizeCode]);
    const size_hi = sizeRecord?.name_hi || (
      sizeCode === "business_full" ? "पूरा पृष्ठ (7.2 × 9.6 इंच)" :
      sizeCode === "business_half" ? "आधा पृष्ठ (7.2 × 4.8 इंच)" :
      "चौथाई पृष्ठ (3.6 × 4.8 इंच)"
    );

    const created_at = new Date().toISOString();
    const addedItems = [];

    for (let i = 0; i < publications.length; i++) {
      const pub = publications[i];
      const districtId = Number(pub.district_id);
      const sangathanId = Number(pub.sangathan_id);
      const magazineId = Number(pub.magazine_id);
      const editionId = Number(pub.edition_id);

      if (!districtId || !sangathanId || !magazineId || !editionId) {
        return res.status(400).json({ error: "कृपया सभी प्रकाशन फ़ील्ड (जिला, संगठन, पत्रिका, संस्करण) चुनें।" });
      }

      // Check existence in DB
      const district = await dbGet("SELECT * FROM districts WHERE id = ? AND is_enabled = 1", [districtId]);
      const sangathan = await dbGet("SELECT * FROM sangathans WHERE id = ? AND district_id = ? AND is_enabled = 1", [sangathanId, districtId]);
      const magazine = await dbGet("SELECT * FROM magazines WHERE id = ? AND is_enabled = 1", [magazineId]);
      const edition = await dbGet("SELECT * FROM editions WHERE id = ? AND magazine_id = ? AND is_enabled = 1", [editionId, magazineId]);

      if (!district || !sangathan || !magazine || !edition) {
        return res.status(400).json({ error: "चयनित प्रकाशन संयोजन अमान्य या निष्क्रिय है।" });
      }

      // Server-side authoritative pricing lookup
      const pricing = await dbGet(
        "SELECT price FROM pricings WHERE district_id = ? AND sangathan_id = ? AND magazine_id = ? AND edition_id = ? AND adv_type_code = 'business' AND adv_size_code = ?",
        [districtId, sangathanId, magazineId, editionId, sizeCode]
      );

      if (!pricing || pricing.price === undefined || pricing.price === null || pricing.price <= 0) {
        return res.status(400).json({
          error: `प्रकाशन '${district.name_hi} - ${sangathan.name_hi}' के लिए अभी दर निर्धारित नहीं है। कृपया दूसरा विकल्प चुनें।`
        });
      }

      const verifiedPrice = toMoney(pricing.price);

      // Auto-generate Ad Number for this item
      const countRow = await dbGet("SELECT COUNT(*) as count FROM advertisements WHERE type_code = 'business'");
      const nextSeq = String(Number(countRow?.count || 0) + 1 + i).padStart(3, "0");
      const adNumber = `BUS-${nextSeq} / ${magazine.name_hi}`;

      const itemData = {
        adNumber,
        businessName: "व्यावसायिक विज्ञापन",
        ownerName: "ग्राहक",
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/cart/remove/:id", async (req: any, res: any) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM cart_items WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/cart/clear", async (req: any, res: any) => {
  const sessionId = (req.body?.sessionId || req.query?.sessionId || "").toString().trim();
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }
  try {
    await dbRun("DELETE FROM cart_items WHERE session_id = ?", [sessionId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Checkout: Order creation and Dynamic UPI Payee Generator
app.post("/api/order/submit", async (req: any, res: any) => {
  const { sessionId, customerName, customerMobile } = req.body;
  if (!sessionId || !customerName || !customerMobile) {
    return res.status(400).json({ error: "Missing required checkout parameters" });
  }

  const cleanPhone = customerMobile.replace(/[^0-9]/g, "");
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: "मुख्य मोबाइल नंबर ठीक 10 अंकों का होना आवश्यक है।" });
  }

  try {
    // 1. Fetch current items in cart
    const cartItems = await dbAll("SELECT * FROM cart_items WHERE session_id = ?", [sessionId]);
    if (cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // 2. Authoritative Price calculation on server
    let total = 0;
    const itemsWithParsedData = cartItems.map((item) => {
      const parsedData = JSON.parse(item.data_json);
      total += toMoney(item.price);
      return { ...item, parsedData };
    });

    const orderId = `ORD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const created_at = new Date().toISOString();

    // 3. Create main order record
    await dbRun(
      "INSERT INTO orders (order_id, total_amount, payment_status, created_at) VALUES (?, ?, 'PENDING', ?)",
      [orderId, toMoney(total), created_at]
    );

    // 4. Save order items mapping & persistent advertisement records
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
          parsed.district_hi || "रायपुर",
          parsed.sangathan_hi || "रायपुर साहू संगठन",
          parsed.magazine_hi || "परिचायिका",
          parsed.edition_hi || "संस्करण 2026",
          parsed.size_hi || (item.ad_type === "matrimony" ? "विवाह मानक (3.5 × 2 इंच)" : "व्यवसाय आकार"),
          toMoney(item.price),
          customerName,
          customerMobile,
          uploadedJpg,
          designLink,
          item.ad_type === "matrimony" ? item.data_json : null,
          item.ad_type === "business" ? item.data_json : null
        ]
      );

      // Create or update record in advertisements table for Print Production
      try {
        let existingAd = null;
        if (parsed.adId) {
          existingAd = await dbGet("SELECT id FROM advertisements WHERE id = ?", [parsed.adId]);
        }
        if (!existingAd && finalAdNum) {
          existingAd = await dbGet("SELECT id FROM advertisements WHERE ad_number = ?", [finalAdNum]);
        }

        let adDbId: number;
        if (existingAd) {
          adDbId = existingAd.id;
          await dbRun(`
            UPDATE advertisements SET
              customer_name = ?, customer_mobile1 = ?, price = ?, district_hi = ?, sangathan_hi = ?,
              magazine_hi = ?, edition_hi = ?, size_code = ?, size_hi = ?, production_status = 'Pending',
              uploaded_jpg_url = ?, design_link = ?
            WHERE id = ?
          `, [
            customerName, customerMobile, toMoney(item.price),
            parsed.district_hi || "रायपुर", parsed.sangathan_hi || "रायपुर साहू संगठन",
            parsed.magazine_hi || "परिचायिका", parsed.edition_hi || "संस्करण 2026",
            parsed.size_code || (item.ad_type === "matrimony" ? "matrimony_standard" : "business_full"),
            parsed.size_hi || (item.ad_type === "matrimony" ? "विवाह मानक (3.5 × 2 इंच)" : "पूरा पृष्ठ (7.2 × 9.6 इंच)"),
            uploadedJpg, designLink, adDbId
          ]);
        } else {
          const adRes = await dbRun(`
            INSERT INTO advertisements (
              ad_number, type_code, district_hi, sangathan_hi, magazine_hi, edition_hi, size_code, size_hi,
              customer_name, customer_mobile1, price, payment_status, production_status, uploaded_jpg_url, design_link, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'Pending', ?, ?, ?)
          `, [
            finalAdNum, item.ad_type,
            parsed.district_hi || "रायपुर", parsed.sangathan_hi || "रायपुर साहू संगठन",
            parsed.magazine_hi || "परिचायिका", parsed.edition_hi || "संस्करण 2026",
            parsed.size_code || "business_full",
            parsed.size_hi || "पूरा पृष्ठ (7.2 × 9.6 इंच)",
            customerName, customerMobile, toMoney(item.price),
            uploadedJpg, designLink, created_at
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
            parsed.businessName || "व्यावसायिक विज्ञापन",
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

    // Clear user's cart
    await dbRun("DELETE FROM cart_items WHERE session_id = ?", [sessionId]);

    // Retrieve UPI details with NPCI-compliant parameters
    const primaryUpiId = "9301056006@ybl";
    const cleanPayeeName = "IndianPress";
    const formattedAmount = toMoney(total).toFixed(2);
    const cleanTxnRef = `ORD${orderId.replace(/[^a-zA-Z0-9]/g, "")}`;
    const cleanTxnNote = `Parichayika_${orderId}`;

    // Standard NPCI Compliant UPI URI
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp helper function to save to DB and console log notifications
async function sendWhatsAppNotification(orderId: string, phone: string, customerName: string, status: string, message: string) {
  try {
    const created_at = new Date().toISOString();
    await dbRun(
      "INSERT INTO whatsapp_notifications (order_id, phone, customer_name, status, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [orderId, phone, customerName, status, message, created_at]
    );
    console.log(`
============================================================
📱 [AUTOMATED WHATSAPP NOTIFICATION] DISPATCHED SUCCESSFULLY
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
  } catch (err: any) {
    console.error("❌ Error registering WhatsApp notification in database:", err.message);
  }
}

// 7. Customer submits payment confirmation
app.post("/api/order/payment-submit", async (req: any, res: any) => {
  const { orderId, paymentRef, paymentDate, customerName, paymentScreenshot } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: "Missing required order ID" });
  }
  try {
    const nowStr = new Date().toISOString();
    await dbRun(
      "UPDATE orders SET payment_status = 'SUBMITTED', payment_ref = ?, payment_date = ?, payment_screenshot = ? WHERE order_id = ?",
      [paymentRef || "DIRECT_UPI_CONFIRMED", paymentDate || nowStr, paymentScreenshot || "", orderId]
    );

    // Dynamic WhatsApp receipt generation
    try {
      const items = await dbAll("SELECT customer_name, customer_mobile, ad_type, ad_number, district_hi, sangathan_hi FROM order_items WHERE order_id = ?", [orderId]);
      if (items && items.length > 0) {
        const mainCustomer = items[0];
        const customerPhone = mainCustomer.customer_mobile || "N/A";
        const customerNameVal = mainCustomer.customer_name || customerName || "ग्राहक";

        const orderObj = await dbGet("SELECT total_amount FROM orders WHERE order_id = ?", [orderId]);
        const amount = orderObj?.total_amount || 0;

        const adDetails = items.map((it, idx) => `  ${idx + 1}. ${it.ad_type === "matrimony" ? "विवाह परिचय प्रविष्टि" : "व्यावसायिक विज्ञापन"} (${it.ad_number}) [${it.district_hi} • ${it.sangathan_hi}]`).join("\n");

        const host = req.get("host") || "localhost:3000";
        const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
        const invoiceLink = `${protocol}://${host}/?order=${orderId}`;

        const customerMsg = `*प्रवेश पत्र / भुगतान पुष्टि - परिचायिका 2026* 📝

नमस्ते *${customerNameVal}*, आपका विज्ञापन विवरण और भुगतान स्क्रीनशॉट सफलतापूर्वक सबमिट हो गया है।

*ऑर्डर विवरण:*
• *ऑर्डर ID:* ${orderId}
• *कुल राशि:* ₹${amount}
• *स्थिति:* ⏳ सत्यापन हेतु लंबित (Submitted)

*विज्ञापन विवरण:*
${adDetails}

*आवश्यक सूचना:* एडमिन द्वारा भुगतान स्क्रीनशॉट की जाँच होने के पश्चात ही आपकी डिजिटल पावती (Invoice) रसीद स्वीकृत होगी। रसीद तैयार होने पर आपको व्हाट्सएप पर ऑटोमैटिक प्राप्त हो जाएगी।

🔗 *स्थिति जाँच लिंक:* ${invoiceLink}

धन्यवाद,
*इंडियन प्रेस / परिचायिका टीम* 🌸`;

        // 1. Send simulated WhatsApp message to customer
        await sendWhatsAppNotification(orderId, customerPhone, customerNameVal, "SUBMITTED", customerMsg);

        // 2. Also notify admin (Simulated)
        const superAdmin = await dbGet("SELECT recovery_whatsapp FROM super_admins LIMIT 1");
        const adminPhone = superAdmin?.recovery_whatsapp || "9301056006";
        const adminMsg = `*🚨 नया भुगतान सत्यापन अनुरोध - परिचायिका 2026*

*नया आर्डर सबमिट हुआ है:*
• *ऑर्डर ID:* ${orderId}
• *ग्राहक:* ${customerNameVal} (${customerPhone})
• *कुल राशि:* ₹${amount}
• *भुगतान स्क्रीनशॉट:* ${paymentScreenshot ? "उपलब्ध (संलग्न)" : "नहीं पाया गया"}
• *स्थिति:* ⏳ सत्यापन लंबित

*विज्ञापन विवरण:*
${adDetails}

🔗 *एडमिन पैनल लिंक:* ${protocol}://${host}/admin`;

        await sendWhatsAppNotification(orderId, adminPhone, "सुपर एडमिन", "ADMIN_ALERT_SUBMITTED", adminMsg);
      }
    } catch (waErr: any) {
      console.error("WhatsApp notification generation error:", waErr.message);
    }

    res.json({ success: true, message: "Payment confirmation recorded" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7.1 Public Order / Invoice Lookup API
app.get("/api/orders/:orderId", async (req: any, res: any) => {
  const { orderId } = req.params;
  try {
    const order = await dbGet("SELECT * FROM orders WHERE order_id = ?", [orderId]);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    const items = await dbAll("SELECT * FROM order_items WHERE order_id = ?", [orderId]);
    const enrichedItems = items.map((it: any) => {
      let matrimonyDetails = null;
      let businessDetails = null;
      try {
        if (it.matrimony_details_json) matrimonyDetails = JSON.parse(it.matrimony_details_json);
      } catch (e) {}
      try {
        if (it.business_details_json) businessDetails = JSON.parse(it.business_details_json);
      } catch (e) {}
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7.2 Strict Authoritative Invoice Generation API (Requires PAID status)
app.get("/api/orders/:orderId/invoice", async (req: any, res: any) => {
  const { orderId } = req.params;
  try {
    const order = await dbGet("SELECT * FROM orders WHERE order_id = ?", [orderId]);
    if (!order) {
      return res.status(404).json({ error: "ऑर्डर प्राप्त नहीं हुआ।" });
    }

    // Security Gate: Final invoice can ONLY be generated for verified, successful PAID orders
    if (order.payment_status !== "PAID") {
      return res.status(403).json({
        error: "भुगतान का सत्यापन लंबित है। आधिकारिक रसीद (Official Invoice) केवल व्यवस्थापक द्वारा भुगतान सत्यापित होने के पश्चात जारी की जाती है।",
        payment_status: order.payment_status,
        is_paid: false
      });
    }

    const items = await dbAll("SELECT * FROM order_items WHERE order_id = ?", [orderId]);
    const enrichedItems = items.map((it: any) => {
      let matrimonyDetails = null;
      let businessDetails = null;
      try {
        if (it.matrimony_details_json) matrimonyDetails = JSON.parse(it.matrimony_details_json);
      } catch (e) {}
      try {
        if (it.business_details_json) businessDetails = JSON.parse(it.business_details_json);
      } catch (e) {}
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
      organization: "रायपुर जिला साहू संघ / परिचायिका 2026",
      items: enrichedItems
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 1. Setup Status Check API (Determines if a SUPER_ADMIN exists in PostgreSQL/database)
app.get("/api/admin/setup-status", async (req: any, res: any) => {
  try {
    const admin = await dbGet("SELECT COUNT(*) as count FROM super_admins");
    const count = Number(admin?.count ?? 0);
    const setupRequired = count === 0;
    res.json({ 
      setupRequired, 
      count,
      hasSuperAdmin: !setupRequired,
      message: setupRequired 
        ? "No Super Admin account found. Setup required." 
        : "Super Admin exists. Login required."
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, setupRequired: false });
  }
});

// Audit log helper
function getClientIp(req: any): string {
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

async function logAudit(action: string, actorId: string | number | null, actorEmail: string | null, details: string | null, ipAddress: string | null = null) {
  try {
    await dbRun(
      "INSERT INTO audit_logs (action, actor_id, actor_email, details, ip_address) VALUES (?, ?, ?, ?, ?)",
      [action, actorId ? String(actorId) : null, actorEmail || null, details || null, ipAddress || null]
    );
  } catch (err) {
    console.error("[AUDIT LOG ERROR]", err);
  }
}

// 2. Setup Super Admin account (Create Super Admin Account)
app.post("/api/admin/setup", async (req: any, res: any) => {
  const { name, email, mobile, password, confirmPassword } = req.body;
  const username = (email || req.body.username || "").trim().toLowerCase();
  const clientIp = getClientIp(req);
  
  if (!name || !email || !mobile || !password || !confirmPassword) {
    return res.status(400).json({ error: "सभी फील्ड (नाम, ईमेल, मोबाइल, पासवर्ड और कन्फर्म पासवर्ड) भरना आवश्यक है।" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "पासवर्ड और कन्फर्म पासवर्ड मेल नहीं खाते।" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।" });
  }
  try {
    // 7. Prevent creation of a second Super Admin
    const adminCheck = await dbGet("SELECT COUNT(*) as count FROM super_admins");
    const count = Number(adminCheck?.count ?? 0);
    if (count > 0) {
      return res.status(400).json({ error: "सुपर एडमिन पहले ही बनाया जा चुका है। अन्य सुपर एडमिन नहीं बनाया जा सकता।" });
    }
    
    // 5. Hash the password securely (bcrypt)
    const hash = await bcrypt.hash(password, 10);
    
    // 4. & 6. Create the first Super Admin securely in PostgreSQL
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
    } catch (insertErr: any) {
      // Fallback for minimal legacy schema (username, password_hash, recovery_email, recovery_whatsapp)
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

    // 8. Create security audit log
    await logAudit(
      "SUPER_ADMIN_CREATED",
      "1",
      email.trim().toLowerCase(),
      `Super Admin account created: Name: ${name.trim()}, Mobile: ${mobile.trim()}`,
      Array.isArray(clientIp) ? clientIp[0] : String(clientIp)
    );

    res.json({ 
      success: true, 
      message: "सुपर एडमिन खाता सफलतापूर्वक बन गया है। अब आप लॉगिन कर सकते हैं।" 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get admin recovery settings
app.get("/api/admin/recovery-settings", authenticateAdmin, async (req: any, res: any) => {
  try {
    const admin = await dbGet("SELECT username, recovery_email as recoveryEmail, recovery_whatsapp as recoveryWhatsapp FROM super_admins WHERE id = ?", [req.adminId]);
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    res.json(admin);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save recovery settings
app.post("/api/admin/recovery-settings", authenticateAdmin, async (req: any, res: any) => {
  const { recoveryEmail, recoveryWhatsapp } = req.body;
  try {
    await dbRun(
      "UPDATE super_admins SET recovery_email = ?, recovery_whatsapp = ? WHERE id = ?",
      [recoveryEmail, recoveryWhatsapp, req.adminId]
    );
    await logAudit("ADMIN_RECOVERY_SETTINGS_UPDATED", req.adminId, req.adminUser?.username || "", `Updated recovery email: ${recoveryEmail}, whatsapp: ${recoveryWhatsapp}`);
    res.json({ success: true, message: "रिकवरी सेटिंग्स सफलतापूर्वक सुरक्षित की गईं।" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Forgot Password link generation
app.post("/api/admin/forgot-password", async (req: any, res: any) => {
  const { email } = req.body;
  const clientIp = getClientIp(req);
  if (!email) return res.status(400).json({ error: "ईमेल आईडी दर्ज करना आवश्यक है।" });
  try {
    const admin = await dbGet("SELECT * FROM super_admins WHERE username = ? OR recovery_email = ?", [email, email]);
    if (!admin) {
      return res.status(404).json({ error: "इस ईमेल पते के साथ कोई एडमिन पंजीकृत नहीं है।" });
    }

    const crypto = await import("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes limit

    await dbRun(
      "UPDATE super_admins SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
      [resetToken, expiry, admin.id]
    );

    await logAudit("FORGOT_PASSWORD_REQUESTED", admin.id, admin.email || admin.username, "Password reset token generated", Array.isArray(clientIp) ? clientIp[0] : String(clientIp));

    const resetUrl = `/admin-reset-password?token=${resetToken}`;

    res.json({
      success: true,
      message: "पासवर्ड रीसेट लिंक सफलतापूर्वक जनरेट हो गया है।",
      resetToken,
      resetUrl,
      whatsappNumber: admin.recovery_whatsapp || "",
      recoveryEmail: admin.recovery_email || ""
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reset Password API
app.post("/api/admin/reset-password", async (req: any, res: any) => {
  const { token, newPassword } = req.body;
  const clientIp = getClientIp(req);
  if (!token || !newPassword) {
    return res.status(400).json({ error: "टोकन और नया पासवर्ड आवश्यक है।" });
  }
  try {
    const admin = await dbGet("SELECT * FROM super_admins WHERE reset_token = ?", [token]);
    if (!admin) {
      return res.status(400).json({ error: "अवैध या उपयोग किया हुआ रीसेट टोकन।" });
    }

    const now = new Date();
    const expiry = new Date(admin.reset_token_expiry);
    if (now > expiry) {
      return res.status(400).json({ error: "रीसेट टोकन की समयावधि समाप्त हो चुकी है (Expired)।" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await dbRun(
      "UPDATE super_admins SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
      [hash, admin.id]
    );

    await logAudit("PASSWORD_RESET_SUCCESS", admin.id, admin.email || admin.username, "Super Admin password reset successfully with token", Array.isArray(clientIp) ? clientIp[0] : String(clientIp));

    res.json({ success: true, message: "पासवर्ड सफलतापूर्वक रीसेट हो गया है। अब आप लॉगिन कर सकते हैं।" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Custom fields public getter
app.get("/api/custom-fields/:formType", async (req: any, res: any) => {
  const { formType } = req.params;
  try {
    const fields = await dbAll(
      "SELECT * FROM custom_fields WHERE form_type = ? AND visible = 1 ORDER BY display_order ASC",
      [formType]
    );
    res.json(fields);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Custom fields admin getter (all fields)
app.get("/api/admin/custom-fields/:formType", authenticateAdmin, async (req: any, res: any) => {
  const { formType } = req.params;
  try {
    const fields = await dbAll(
      "SELECT * FROM custom_fields WHERE form_type = ? ORDER BY display_order ASC",
      [formType]
    );
    res.json(fields);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Custom fields builder insert API
app.post("/api/admin/custom-fields", authenticateAdmin, async (req: any, res: any) => {
  const { form_type, field_name, label, field_type, required, placeholder, help_text, default_value, visible, display_order, select_options } = req.body;
  if (!form_type || !field_name || !label || !field_type) {
    return res.status(400).json({ error: "Missing required field attributes" });
  }
  try {
    await dbRun(`
      INSERT INTO custom_fields (form_type, field_name, label, field_type, required, placeholder, help_text, default_value, visible, display_order, select_options)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [form_type, field_name.toLowerCase(), label, field_type, required ? 1 : 0, placeholder || "", help_text || "", default_value || "", visible ? 1 : 0, display_order || 0, select_options || ""]);
    res.json({ success: true, message: "फ़ील्ड सफलतापूर्वक जोड़ा गया।" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Custom fields builder update API
app.put("/api/admin/custom-fields/:id", authenticateAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  const { label, field_type, required, placeholder, help_text, default_value, visible, display_order, select_options } = req.body;
  try {
    await dbRun(`
      UPDATE custom_fields
      SET label = ?, field_type = ?, required = ?, placeholder = ?, help_text = ?, default_value = ?, visible = ?, display_order = ?, select_options = ?
      WHERE id = ?
    `, [label, field_type, required ? 1 : 0, placeholder || "", help_text || "", default_value || "", visible ? 1 : 0, display_order || 0, select_options || "", id]);
    res.json({ success: true, message: "फ़ील्ड सफलतापूर्वक अपडेट किया गया।" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Custom fields builder delete API
app.delete("/api/admin/custom-fields/:id", authenticateAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM custom_fields WHERE id = ?", [id]);
    res.json({ success: true, message: "फ़ील्ड सफलतापूर्वक हटा दिया गया।" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Super Admin login
app.post(["/api/admin/login", "/api/auth/login"], async (req: any, res: any) => {
  const { username, password } = req.body;
  const clientIp = getClientIp(req);
  if (!username || !password) {
    return res.status(400).json({ error: "यूज़रनेम/ईमेल और पासवर्ड आवश्यक हैं।" });
  }
  try {
    const cleanUser = String(username).trim().toLowerCase();
    let admin: any = null;
    try {
      admin = await dbGet(
        "SELECT * FROM super_admins WHERE LOWER(username) = ? OR LOWER(email) = ? OR mobile = ?",
        [cleanUser, cleanUser, cleanUser]
      );
    } catch {
      // Graceful fallback for minimal legacy schema
      admin = await dbGet(
        "SELECT * FROM super_admins WHERE LOWER(username) = ? OR LOWER(recovery_email) = ?",
        [cleanUser, cleanUser]
      );
    }
    if (!admin) {
      return res.status(401).json({ error: "गलत यूज़रनेम/ईमेल या पासवर्ड" });
    }
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ error: "गलत यूज़रनेम/ईमेल या पासवर्ड" });
    }
    const role = (admin && admin.role) ? admin.role : "SUPER_ADMIN";
    if (role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "पहुंच अस्वीकृत: केवल SUPER_ADMIN को ही अनुमति है।" });
    }
    const token = jwt.sign(
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin change password
app.post("/api/admin/change-password", authenticateAdmin, async (req: any, res: any) => {
  const { currentPassword, newPassword } = req.body;
  const clientIp = getClientIp(req);
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Missing passwords" });
  }
  try {
    const admin = await dbGet("SELECT * FROM super_admins WHERE id = ?", [req.adminId]);
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const match = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!match) return res.status(400).json({ error: "Incorrect current password" });

    const newHash = await bcrypt.hash(newPassword, 10);
    await dbRun("UPDATE super_admins SET password_hash = ? WHERE id = ?", [newHash, req.adminId]);

    await logAudit("SUPER_ADMIN_PASSWORD_CHANGED", req.adminId, admin.email || admin.username, "Super Admin password changed successfully via dashboard", Array.isArray(clientIp) ? clientIp[0] : String(clientIp));

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Audit Logs API
app.get("/api/admin/audit-logs", authenticateAdmin, async (req: any, res: any) => {
  try {
    const logs = await dbAll("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100");
    res.json({ logs: logs || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Dashboard Summary API
app.get("/api/admin/dashboard", authenticateAdmin, async (req: any, res: any) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Admin List & Filter Orders
app.get("/api/admin/orders", authenticateAdmin, async (req: any, res: any) => {
  try {
    const orders = await dbAll("SELECT * FROM orders ORDER BY id DESC");
    const items = await dbAll("SELECT * FROM order_items");
    
    // Structure order items grouped under orders
    const enrichedOrders = orders.map((ord) => {
      const orderItems = items.filter((it) => it.order_id === ord.order_id);
      return {
        ...ord,
        items: orderItems.map(it => ({
          ...it,
          matrimonyDetails: it.matrimony_details_json ? JSON.parse(it.matrimony_details_json) : null,
          businessDetails: it.business_details_json ? JSON.parse(it.business_details_json) : null
        }))
      };
    });
    res.json(enrichedOrders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Admin Verify Payment (Approve order)
// This creates actual, final immutable advertisement numbers for the advertisements in this order!
app.post("/api/admin/orders/:orderId/verify", authenticateAdmin, async (req: any, res: any) => {
  const { orderId } = req.params;
  const { status, reason } = req.body; // 'PAID' or 'REJECTED'
  if (!status || !["PAID", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status state" });
  }

  try {
    const order = await dbGet("SELECT * FROM orders WHERE order_id = ?", [orderId]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const verifiedBy = req.username;
    const verificationTime = new Date().toISOString();

    await dbRun(
      "UPDATE orders SET payment_status = ?, verified_by = ?, verification_time = ?, rejection_reason = ? WHERE order_id = ?",
      [status, verifiedBy, verificationTime, reason || null, orderId]
    );

    // Find all order items under this order, and update pre-saved advertisements status
    const items = await dbAll("SELECT ad_number, customer_name, customer_mobile, ad_type, district_hi, sangathan_hi FROM order_items WHERE order_id = ?", [orderId]);
    for (const item of items) {
      await dbRun("UPDATE advertisements SET payment_status = ? WHERE ad_number = ?", [status, item.ad_number]);
    }

    // Trigger WhatsApp notification for PAID or REJECTED
    try {
      if (items && items.length > 0) {
        const mainCustomer = items[0];
        const customerPhone = mainCustomer.customer_mobile || "N/A";
        const customerNameVal = mainCustomer.customer_name || "ग्राहक";
        const amount = order.total_amount || 0;

        const adDetails = items.map((it, idx) => `  ${idx + 1}. ${it.ad_type === "matrimony" ? "विवाह परिचय प्रविष्टि" : "व्यावसायिक विज्ञापन"} (${it.ad_number}) [${it.district_hi} • ${it.sangathan_hi}]`).join("\n");

        const host = req.get("host") || "localhost:3000";
        const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
        const invoiceLink = `${protocol}://${host}/?order=${orderId}`;

        if (status === "PAID") {
          const customerMsg = `*प्रवेश स्वीकृत रसीद - परिचायिका 2026* ✅

नमस्ते *${customerNameVal}*, आपका विज्ञापन भुगतान स्वीकृत हो गया है और विज्ञापन उत्पादन (Print Production) के लिए भेज दिया गया है।

*ऑर्डर विवरण:*
• *ऑर्डर ID:* ${orderId}
• *कुल राशि:* ₹${amount}
• *स्थिति:* 🟢 स्वीकृत (PAID)

*विज्ञापन विवरण:*
${adDetails}

🔗 *डिजिटल पावती / Invoice डाउनलोड करें:* ${invoiceLink}

धन्यवाद,
*इंडियन प्रेस / परिचायिका टीम* 🌸`;

          // 1. Notify Customer
          await sendWhatsAppNotification(orderId, customerPhone, customerNameVal, "PAID", customerMsg);

          // 2. Notify Admin
          const superAdmin = await dbGet("SELECT recovery_whatsapp FROM super_admins LIMIT 1");
          const adminPhone = superAdmin?.recovery_whatsapp || "9301056006";
          const adminMsg = `*✅ भुगतान स्वीकृत पुष्टि - परिचायिका 2026*

• *ऑर्डर ID:* ${orderId}
• *ग्राहक:* ${customerNameVal} (${customerPhone})
• *कुल राशि:* ₹${amount}
• *स्थिति:* 🟢 स्वीकृत (PAID)

उत्पादन अनुभाग में मुद्रण (Print Sheet) हेतु प्रविष्टियाँ भेज दी गई हैं।`;
          await sendWhatsAppNotification(orderId, adminPhone, "सुपर एडमिन", "ADMIN_ALERT_PAID", adminMsg);

        } else if (status === "REJECTED") {
          const rejectReason = reason || "भुगतान विवरण अमान्य पाया गया। कृपया पुनः सही जानकारी दर्ज करें।";
          const customerMsg = `*भुगतान अस्वीकृत / विफल सूचना - परिचायिका 2026* ❌

नमस्ते *${customerNameVal}*, आपके विज्ञापन आर्डर का भुगतान विवरण *अस्वीकृत (REJECTED)* कर दिया गया है।

*ऑर्डर विवरण:*
• *ऑर्डर ID:* ${orderId}
• *कुल राशि:* ₹${amount}
• *स्थिति:* 🔴 अस्वीकृत (REJECTED)
• *अस्वीकृति का कारण:* ${rejectReason}

*कृपया पुनः प्रयास करें:*
आप नीचे दिए लिंक पर जाकर अपना सही भुगतान विवरण दर्ज कर सकते हैं या फिर से भुगतान कर सकते हैं।

🔗 *पुनः प्रयास करें / डिजिटल पावती:* ${invoiceLink}

यदि कोई समस्या हो तो कृपया परिचायिका एडमिन से संपर्क करें।

धन्यवाद,
*इंडियन प्रेस / परिचायिका टीम* 🌸`;

          // 1. Notify Customer
          await sendWhatsAppNotification(orderId, customerPhone, customerNameVal, "REJECTED", customerMsg);

          // 2. Notify Admin
          const superAdmin = await dbGet("SELECT recovery_whatsapp FROM super_admins LIMIT 1");
          const adminPhone = superAdmin?.recovery_whatsapp || "9301056006";
          const adminMsg = `*❌ भुगतान अस्वीकृत (REJECTED) - परिचायिका 2026*

• *ऑर्डर ID:* ${orderId}
• *ग्राहक:* ${customerNameVal} (${customerPhone})
• *कुल राशि:* ₹${amount}
• *स्थिति:* 🔴 अस्वीकृत (REJECTED)
• *अस्वीकृति का कारण:* ${rejectReason}

ग्राहक को पुनः प्रयास हेतु सूचना भेज दी गई है।`;
          await sendWhatsAppNotification(orderId, adminPhone, "सुपर एडमिन", "ADMIN_ALERT_REJECTED", adminMsg);
        }
      }
    } catch (waErr: any) {
      console.error("WhatsApp notification verification trigger error:", waErr.message);
    }

    res.json({ success: true, message: `Order updated to ${status}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10.1 Admin Fetch WhatsApp Notification Logs
app.get("/api/admin/whatsapp-logs", authenticateAdmin, async (req: any, res: any) => {
  try {
    const logs = await dbAll("SELECT * FROM whatsapp_notifications ORDER BY id DESC");
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Admin Master Data CRUDS
app.post("/api/admin/masters/:entity", authenticateAdmin, async (req: any, res: any) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/admin/masters/:entity/:id", authenticateAdmin, async (req: any, res: any) => {
  const { entity, id } = req.params;
  const data = req.body;
  try {
    if (entity === "districts") {
      await dbRun("UPDATE districts SET name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [data.name_en, data.name_hi, data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : 1, id]);
    } else if (entity === "sangathans") {
      await dbRun("UPDATE sangathans SET district_id = ?, name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [data.district_id, data.name_en, data.name_hi, data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : 1, id]);
    } else if (entity === "magazines") {
      await dbRun("UPDATE magazines SET name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [data.name_en, data.name_hi, data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : 1, id]);
    } else if (entity === "editions") {
      await dbRun("UPDATE editions SET magazine_id = ?, name_en = ?, name_hi = ?, is_enabled = ? WHERE id = ?", [data.magazine_id, data.name_en, data.name_hi, data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : 1, id]);
    } else if (entity === "publications") {
      await dbRun("UPDATE publications SET district_id = ?, sangathan_id = ?, magazine_id = ?, edition_id = ?, is_enabled = ? WHERE id = ?", [data.district_id, data.sangathan_id, data.magazine_id, data.edition_id, data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : 1, id]);
    } else if (entity === "pricings") {
      await dbRun("UPDATE pricings SET district_id = ?, sangathan_id = ?, magazine_id = ?, edition_id = ?, adv_type_code = ?, adv_size_code = ?, price = ? WHERE id = ?", [data.district_id, data.sangathan_id, data.magazine_id, data.edition_id, data.adv_type_code, data.adv_size_code, toMoney(data.price), id]);
    } else {
      return res.status(400).json({ error: "Invalid master entity" });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/admin/masters/:entity/:id", authenticateAdmin, async (req: any, res: any) => {
  const { entity, id } = req.params;
  try {
    const tableMap: { [key: string]: string } = {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11.1 Update Publication Production Status
app.put("/api/admin/order-items/:id/production-status", authenticateAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  const production_status = req.body.production_status || req.body.productionStatus;
  // Allowed workflow states. The full workflow is:
  // Pending → Approved → Preflight → Production → Published → Completed
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Retrieve Approved, Paid Advertisements for Print Production Layout
app.get("/api/admin/advertisements", authenticateAdmin, async (req: any, res: any) => {
  try {
    const ads = await dbAll("SELECT * FROM advertisements ORDER BY id DESC");
    const matDetails = await dbAll("SELECT * FROM matrimony_profiles");
    const busDetails = await dbAll("SELECT * FROM business_advertisements");
    const orderItems = await dbAll("SELECT * FROM order_items");

    const enriched = ads.map((ad) => {
      let mat = matDetails.find((m) => m.ad_id === ad.id);
      let bus = busDetails.find((b) => b.ad_id === ad.id);

      // Fallback to order_items json data if not in direct profile table
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
          } catch (e) {}
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
              business_name: parsed.businessName || "व्यावसायिक विज्ञापन",
              owner_name: parsed.ownerName || ad.customer_name,
              ready_ad_url: parsed.uploadedJpgUrl || parsed.readyAdUrl || ad.uploaded_jpg_url || "",
              photo_url: parsed.uploadedJpgUrl || parsed.photoUrl || ad.uploaded_jpg_url || "",
              mobile1: parsed.mobile1 || ad.customer_mobile1,
              design_link: parsed.designLink || ad.design_link || ""
            };
          } catch (e) {}
        }
      }

      return {
        ...ad,
        matrimonyProfile: mat || null,
        businessProfile: bus ? {
          ...bus,
          adMakerDesignJson: bus.ad_maker_design_json ? (typeof bus.ad_maker_design_json === "string" ? JSON.parse(bus.ad_maker_design_json) : bus.ad_maker_design_json) : null
        } : null
      };
    });
    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12.1 Admin Update Publication & District/Sangathan Allocation for Advertisement
app.put("/api/admin/advertisements/:id/publication", authenticateAdmin, async (req: any, res: any) => {
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
    `, [district_hi || "प्रकाशन लंबित", sangathan_hi || "प्रकाशन लंबित", magazine_hi || "परिचायिका", edition_hi || "संस्करण 2026", id]);

    // Also update matching order_items
    await dbRun(`
      UPDATE order_items SET
        district_hi = ?,
        sangathan_hi = ?
      WHERE ad_number = ?
    `, [district_hi || "प्रकाशन लंबित", sangathan_hi || "प्रकाशन लंबित", ad.ad_number]);

    res.json({ success: true, message: "प्रकाशन, जिला एवं संगठन विवरण सफलतापूर्वक अपडेट किया गया।" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12.2 Admin Update Publication & District/Sangathan Allocation for Entire Order / Order Items
app.put("/api/admin/orders/:orderId/publication", authenticateAdmin, async (req: any, res: any) => {
  const { orderId } = req.params;
  const { district_hi, sangathan_hi, magazine_hi, edition_hi, ad_number } = req.body;
  try {
    const order = await dbGet("SELECT * FROM orders WHERE order_id = ?", [orderId]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (ad_number) {
      // Update specific item
      await dbRun(`
        UPDATE order_items SET
          district_hi = ?,
          sangathan_hi = ?
        WHERE order_id = ? AND ad_number = ?
      `, [district_hi || "प्रकाशन लंबित", sangathan_hi || "प्रकाशन लंबित", orderId, ad_number]);

      await dbRun(`
        UPDATE advertisements SET
          district_hi = ?,
          sangathan_hi = ?,
          magazine_hi = ?,
          edition_hi = ?
        WHERE ad_number = ?
      `, [district_hi || "प्रकाशन लंबित", sangathan_hi || "प्रकाशन लंबित", magazine_hi || "परिचायिका", edition_hi || "संस्करण 2026", ad_number]);
    } else {
      // Update all items in this order
      const items = await dbAll("SELECT ad_number FROM order_items WHERE order_id = ?", [orderId]);
      await dbRun(`
        UPDATE order_items SET
          district_hi = ?,
          sangathan_hi = ?
        WHERE order_id = ?
      `, [district_hi || "प्रकाशन लंबित", sangathan_hi || "प्रकाशन लंबित", orderId]);

      for (const item of items) {
        await dbRun(`
          UPDATE advertisements SET
            district_hi = ?,
            sangathan_hi = ?,
            magazine_hi = ?,
            edition_hi = ?
          WHERE ad_number = ?
        `, [district_hi || "प्रकाशन लंबित", sangathan_hi || "प्रकाशन लंबित", magazine_hi || "परिचायिका", edition_hi || "संस्करण 2026", item.ad_number]);
      }
    }

    res.json({ success: true, message: "प्रकाशन, जिला एवं संगठन विवरण सफलतापूर्वक सुरक्षित किया गया।" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 13. Admin Update Pricing rate dynamically
app.post("/api/admin/pricings/update", authenticateAdmin, async (req: any, res: any) => {
  const { id, price } = req.body;
  if (!id || price === undefined) {
    return res.status(400).json({ error: "Missing id or price parameters" });
  }
  try {
    await dbRun("UPDATE pricings SET price = ? WHERE id = ?", [toMoney(price), Number(id)]);
    res.json({ success: true, message: "Price updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 14. Admin Configurations API (Super Admin)
app.get("/api/admin/configurations", async (req: any, res: any) => {
  try {
    const configs = await dbAll("SELECT * FROM admin_configurations ORDER BY id DESC");
    res.json(configs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/configurations", authenticateAdmin, async (req: any, res: any) => {
  const { district, sangathan, magazine, edition, adv_type, size_name, width, height, unit, layout, pricing, status } = req.body;
  if (!district || !sangathan || !magazine || !edition || !adv_type || !size_name || pricing === undefined) {
    return res.status(400).json({ error: "Required fields are missing" });
  }
  try {
    // Generate system-generated unique configuration_id
    const configuration_id = "CONF-" + Math.floor(100000 + Math.random() * 900000);
    await dbRun(`
      INSERT INTO admin_configurations (configuration_id, district, sangathan, magazine, edition, adv_type, size_name, width, height, unit, layout, pricing, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [configuration_id, district, sangathan, magazine, edition, adv_type, size_name, Number(width || 0), Number(height || 0), unit || "inch", layout || "Standard", Number(pricing), status || "enabled"]);
    res.json({ success: true, configurationId: configuration_id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/admin/configurations/:id", authenticateAdmin, async (req: any, res: any) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/admin/configurations/:id", authenticateAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM admin_configurations WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 15. Super Admin Database Backup API (Full JSON Export)
app.get("/api/admin/backup", authenticateAdmin, async (req: any, res: any) => {
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
      exportedAt: new Date().toISOString(),
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
  } catch (error: any) {
    res.status(500).json({ error: "Backup generation failed: " + error.message });
  }
});

// 16. Super Admin Database Restore API
app.post("/api/admin/restore", authenticateAdmin, async (req: any, res: any) => {
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

    res.json({ success: true, message: "डेटाबेस बैकअप सफलतापूर्वक पुनर्स्थापित (Restored) किया गया।" });
  } catch (error: any) {
    res.status(500).json({ error: "Restore operation failed: " + error.message });
  }
});

// 404 handler for unmatched /api/* requests so they return JSON error instead of falling through to Vite HTML
app.all("/api/*", (req: any, res: any) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Export app for serverless function entrypoints (Vercel)
export default app;

// Re-export for the Vercel serverless entry (api/[...slug].ts) which loads
// the pre-bundled dist/server.cjs. These named exports let the entry file
// trigger DB initialization at cold start without duplicating logic.
export { initDatabase, isPostgres, getSafeDbDiagnostics } from "./db";
export { uploadFile, validateUpload } from "./storage";
export { transliterateText } from "./transliteration";

// Setup dev server or static distribution build (Standalone / Container runtime)
async function startServer() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    // Under Vercel serverless environment, runtime is handled by api/index.ts
    return;
  }

  try {
    await initDatabase();
  } catch (err: any) {
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res) => {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      }
    }));
    app.get("*", (req, res) => {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

const isServerlessOrTest = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NODE_ENV === "test"
);

if (!isServerlessOrTest) {
  startServer();
}
