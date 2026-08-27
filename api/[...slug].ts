/**
 * PARICHAYIKA — Vercel Serverless API Entry (catch-all)
 *
 * This file is the SINGLE serverless function exposed on Vercel.
 * The `[...slug]` filename makes Vercel route EVERY /api/* request
 * (and /api itself) to this handler. No vercel.json rewrites are needed
 * for /api/* — Vercel's filesystem routing handles it natively.
 *
 * Architecture:
 *   Request → Vercel routing → api/[...slug].ts → Express app → route handlers
 *
 * The Express app (server.ts) already defines all 51 /api/* routes.
 * We only forward the request to that Express instance.
 *
 * IMPORTANT: imports use NO file extension so @vercel/node's esbuild bundler
 * resolves them at build time and inlines server.ts + server/db.ts + etc.
 * into the deployed function. The phantom ".js" imports in the previous
 * api/index.ts caused ERR_MODULE_NOT_FOUND → Vercel 404.
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
  // Vercel preserves the original req.url (e.g. "/api/health?x=1") for
  // catch-all routes, so we do NOT need to rewrite the URL — Express will
  // match the request directly against its registered /api/* routes.
  ensureDbStarted();
  return (app as any)(req, res);
}
