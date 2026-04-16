import app from '../app';
import { db, seedDatabase } from '../db';

/**
 * Vercel serverless entry point.
 *
 * IMPORTANT: we do NOT run seedDatabase/initializeDatabase synchronously here.
 * Vercel Hobby functions have a 10-second hard timeout and even an idempotent
 * DDL sweep against Neon can exceed that on a cold connection. The production
 * database is already fully set up (schema + seed data), so we just serve
 * requests. If a later deploy ever needs to migrate, run the seed manually
 * through /api/admin/init or a one-off script.
 *
 * The only thing we do asynchronously (fire-and-forget) is kick off a seed
 * attempt — this is harmless on an already-initialized DB thanks to the
 * schema_version fast-path in seedDatabase().
 */
let seedKickedOff = false;
function kickOffSeedOnce() {
  if (seedKickedOff) return;
  seedKickedOff = true;
  // Never await this — purely background, errors are logged and swallowed.
  seedDatabase(db).catch((err: any) => {
    console.error('Background seed failed (non-fatal):', err?.message || err);
  });
}

export default async (req: any, res: any) => {
  try {
    kickOffSeedOnce();
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Entry Point Error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Vercel Entry Point Error',
        message: err?.message || String(err),
      });
    }
  }
};
