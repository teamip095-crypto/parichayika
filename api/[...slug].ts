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
 *   @vercel/node@7+ runs TS via Node's ESM loader (NO esbuild bundling).
 *   Node ESM strictly requires the EXACT file extension on relative imports.
 *   That's why we use "../server.ts" and "../server/db.ts" here, and why
 *   the same files inside server.ts use "../server/db" without extension
 *   only when bundled by esbuild locally.
 *
 *   To keep both worlds working, we set tsconfig `allowImportingTsExtensions: true`
 *   and use explicit ".ts" extensions on every relative import in this file
 *   AND in server.ts + server/*.ts. Vercel then transpiles everything to a
 *   single Node-runnable file.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../server.ts";
import { initDatabase } from "../server/db.ts";

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
