import { createClient, SupabaseClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

export interface UploadResult {
  url: string;
  storagePath: string;
  filename: string;
  mimetype: string;
  size: number;
  provider: "supabase" | "local";
}

// Allowed MIME types whitelist
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/tiff",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/postscript", // .ai, .eps
  "image/vnd.adobe.photoshop", // .psd
  "application/x-photoshop",
  "application/cdr", // .cdr
  "application/coreldraw",
  "application/x-cdr",
  "application/octet-stream" // for CDR/PSD binaries
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".svg", ".heic", ".heif",
  ".pdf", ".ai", ".eps", ".psd", ".cdr"
]);

// Maximum file size: 50MB (Print production assets, CDR, PSD, high-res photos)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false }
    });
    return supabaseClient;
  }
  return null;
}

export function validateUpload(file: { originalname: string; mimetype?: string; size: number }): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "फ़ाइल प्रदान नहीं की गई है।" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `फ़ाइल का आकार 50MB से अधिक नहीं होना चाहिए। (वर्तमान आकार: ${(file.size / (1024 * 1024)).toFixed(1)}MB)` };
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `अमान्य फ़ाइल प्रकार (${ext})। केवल JPG, PNG, WEBP, PDF, CDR, PSD स्वीकृत हैं।` };
  }

  return { valid: true };
}

/**
 * Upload a file buffer to persistent storage (Supabase Storage with Local fallback)
 */
export async function uploadFile(options: {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  folder?: "photos" | "receipts" | "artworks" | "designs" | "general";
  isPublic?: boolean;
}): Promise<UploadResult> {
  const { buffer, originalname, folder = "general", isPublic = true } = options;
  const size = buffer.length;

  const validation = validateUpload({ originalname, mimetype: options.mimetype, size });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const rawExt = path.extname(originalname).toLowerCase();
  const ext = rawExt || (options.mimetype?.includes("png") ? ".png" : options.mimetype?.includes("webp") ? ".webp" : ".jpg");
  const mimetype = options.mimetype || "image/jpeg";

  // Prevent path traversal & collision
  const cleanBaseName = path.basename(originalname, rawExt).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const uniqueKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const finalFilename = `${cleanBaseName}-${uniqueKey}${ext}`;
  const objectPath = `${folder}/${finalFilename}`;

  const supabase = getSupabaseClient();
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "parichayika-media";

  // 1. Production Mode: Supabase Cloud Object Storage
  if (supabase) {
    try {
      // Ensure bucket exists or attempt upload
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
          // Signed URL fallback for private assets (expires in 1 year for ad production review)
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
    } catch (sbErr: any) {
      console.warn("Supabase Storage error:", sbErr.message);
    }
  }

  // 2. Development / Fallback Mode: Local Filesystem Storage
  // On Vercel production (read-only filesystem), local writes would silently fail.
  // Refuse here so misconfiguration surfaces as a clear error instead of EROFS.
  const isVercelRuntime = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isVercelRuntime) {
    throw new Error(
      "Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars required). " +
      "Local filesystem uploads are not supported on Vercel serverless runtime."
    );
  }

  const uploadsDir = path.join(process.cwd(), "uploads", folder);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const localFilePath = path.join(uploadsDir, finalFilename);
  fs.writeFileSync(localFilePath, buffer);

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

/**
 * Delete a file by object path
 */
export async function deleteFile(storagePath: string, bucket = process.env.SUPABASE_STORAGE_BUCKET || "parichayika-media"): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (supabase && !storagePath.startsWith("/") && !storagePath.includes("\\")) {
    try {
      const { error } = await supabase.storage.from(bucket).remove([storagePath]);
      if (!error) return true;
    } catch (e) {
      console.error("Failed to delete from Supabase storage:", e);
    }
  }

  // Local fallback deletion
  if (fs.existsSync(storagePath)) {
    try {
      fs.unlinkSync(storagePath);
      return true;
    } catch (e) {
      console.error("Failed to delete local file:", e);
    }
  }

  return false;
}
