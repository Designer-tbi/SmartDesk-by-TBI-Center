import app from '../app';

/**
 * Vercel serverless entry point.
 *
 * We deliberately do NOT call seedDatabase() here. The production DB is
 * already set up and reseeding on every cold start burns the 10s Vercel
 * budget. Migrations should be run manually via /api/admin/init (TODO) or a
 * one-off CLI script.
 *
 * Any thrown error is caught and serialized so the developer sees a real
 * message in the Runtime Logs instead of the opaque FUNCTION_INVOCATION_FAILED.
 */
export default async (req: any, res: any) => {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Entry] Unhandled error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'VercelEntryPointError',
        message: err?.message || String(err),
        code: err?.code,
      });
    }
  }
};
