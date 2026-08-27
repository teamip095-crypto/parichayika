/**
 * PARICHAYIKA — Vercel Serverless API Entry (catch-all)
 *
 * This file is the SINGLE serverless function exposed on Vercel.
 * The `[...slug]` filename makes Vercel route EVERY /api/* request
 * (and /api itself) to this handler.
 *
 * Architecture:
 *   Request → Vercel routing → api/[...slug].ts → Express app → route handlers
 *
 * IMPORTANT — Vercel bundling note:
 *   @vercel/node@7+ transpiles TS to JS but does NOT rewrite ".ts" extensions
 *   in import paths. Using "../server.ts" causes ERR_MODULE_NOT_FOUND at runtime
 *   because the deployed file is server.js (not server.ts).
 *
 *   Using extensionless imports ("../server", "../server/db") lets Vercel's
 *   bundler resolve them correctly at build time. The same extensionless
 *   imports also work locally with esbuild bundling.
 *
 *   See tsconfig.json — moduleResolution: "bundler" + allowImportingTsExtensions: false
 *   ensures extensionless imports are valid in BOTH environments.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../server";
import { initDatabase } from "../server/db";

// DB init is fired once per cold start, non-blocking.
// /api/health must respond even if DB connection is still warming up.
let dbInitAttempted = false;

function ensureDbStarted() {
  if (dbInitAttempted) return;
  dbInitAttempted = true;
  initDatabase().catch((err: any) => {
    console.warn("[parichayika] Background DB init notice:", err?.message || err);
  });
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  ensureDbStarted();
  return (app as any)(req, res);
}
