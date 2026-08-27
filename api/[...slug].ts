/**
 * PARICHAYIKA — Vercel Serverless API Entry (catch-all)
 *
 * This file is the SINGLE serverless function exposed on Vercel.
 * The `[...slug]` filename makes Vercel route EVERY /api/* request
 * (and /api itself) to this handler.
 *
 * ARCHITECTURE (FIXED — works with @vercel/node@7+):
 *   The Express API is pre-bundled at build time by esbuild into
 *   /dist/server.cjs (a single CommonJS bundle, ~190KB). This file
 *   just dynamically imports that bundle and forwards requests.
 *
 *   This sidesteps ALL @vercel/node@7 ESM/extensionless import issues
 *   because:
 *     1. The bundle is a single self-contained .cjs file
 *     2. /dist/ is the Vercel `outputDirectory` so the file ships
 *     3. No relative source-TS imports remain in this entry file
 *
 * Build sequence (from vercel.json buildCommand):
 *   vite build (frontend → dist/index.html, dist/assets/*)
 *   esbuild server/index.ts --bundle --platform=node --format=cjs
 *     → dist/server.cjs (single bundled backend)
 *
 * Local dev: same file works because Vercel CLI runs the same build.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import path from "path";
import fs from "fs";

// Resolve the pre-built server bundle path.
// In production: /var/task/dist/server.cjs
// In local dev:  <cwd>/dist/server.cjs
const SERVER_BUNDLE_PATH = path.join(
  process.cwd(),
  "dist",
  "server.cjs"
);

// Cache the imported app across cold starts
let cachedApp: any = null;
let dbInitAttempted = false;

async function getApp() {
  if (cachedApp) return cachedApp;

  if (!fs.existsSync(SERVER_BUNDLE_PATH)) {
    throw new Error(`Server bundle not found at ${SERVER_BUNDLE_PATH}. Run 'npm run build' first.`);
  }

  // Use createRequire to load the CJS bundle from ESM context
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const bundle = require(SERVER_BUNDLE_PATH);

  // The bundle's default export is the Express `app`
  cachedApp = bundle.default || bundle;

  // Fire-and-forget DB init
  if (!dbInitAttempted && typeof bundle.initDatabase === "function") {
    dbInitAttempted = true;
    bundle.initDatabase().catch((err: any) => {
      console.warn("[parichayika] Background DB init notice:", err?.message || err);
    });
  }

  return cachedApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();
    return (app as any)(req, res);
  } catch (err: any) {
    console.error("[parichayika] Handler init error:", err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Server initialization failed",
        message: err?.message || "Unknown error",
        path: SERVER_BUNDLE_PATH
      });
    }
  }
}
