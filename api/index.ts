import app from '../app';
import { db, seedDatabase } from '../db';

let seedPromise: Promise<void> | null = null;

function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seedDatabase(db).catch((err: any) => {
      console.error('Seeding failed (non-fatal):', err);
    });
  }
  return seedPromise;
}

export default async (req: any, res: any) => {
  try {
    // On the very first invocation we await seeding to make sure the tables
    // exist before the request tries to query them. Thanks to the DB-backed
    // schema_version fast-path inside seedDatabase, every subsequent cold
    // start returns in <100 ms.
    await ensureSeeded();

    console.log(`Vercel Request: ${req.method} ${req.url}`);

    // Express's `app` is itself a (req, res) handler.
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Entry Point Error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Vercel Entry Point Error',
        message: err?.message || String(err),
        stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined,
      });
    }
  }
};
