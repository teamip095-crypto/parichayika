import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../server.js";
import { initDatabase } from "../server/db.js";

// Non-blocking database initialization kick-off
let dbInitAttempted = false;

function ensureDbStarted() {
  if (!dbInitAttempted) {
    dbInitAttempted = true;
    initDatabase().catch((err) => {
      console.warn("Background DB initialization notice:", err?.message || err);
    });
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Normalize URL for Express routing
  if (req.url) {
    if (!req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
      req.url = `/api${req.url.startsWith("/") ? req.url : "/" + req.url}`;
    }
  }

  // Kick off background DB connection if not already attempted (does not block /api/health)
  ensureDbStarted();

  // Forward request to Express app
  return (app as any)(req, res);
}

