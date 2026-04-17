/**
 * Minimal sanity check endpoint — does NOT import Express, does NOT touch
 * the DB, does NOT parse cookies. If this returns 200 but /api/auth/login
 * returns FUNCTION_INVOCATION_FAILED, the problem is specifically in the
 * Express app, not in the Vercel runtime.
 */
export default function handler(req: any, res: any) {
  try {
    res.status(200).json({
      ok: true,
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        vercel: !!process.env.VERCEL,
        region: process.env.VERCEL_REGION || null,
        nodeEnv: process.env.NODE_ENV,
      },
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
        dbUrlPrefix: process.env.DATABASE_URL
          ? process.env.DATABASE_URL.slice(0, 20) + '...'
          : null,
      },
      received: {
        method: req.method,
        url: req.url,
        hasHeaders: !!req.headers,
        hasBody: req.body !== undefined,
        bodyType: req.body ? typeof req.body : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      stack: err?.stack,
    });
  }
}
