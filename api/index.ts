/**
 * Vercel serverless entry point.
 *
 * This file is wrapped in try/catch at every level so that any crash
 * produces an explicit JSON error with stack trace instead of the opaque
 * FUNCTION_INVOCATION_FAILED page.
 */

let appImportError: any = null;
let app: any = null;

try {
  // Dynamic import wrapped in try/catch so a module-level error in app.ts
  // (e.g. missing dep, bad env) doesn't bubble up as FUNCTION_INVOCATION_FAILED.
  const mod = await import('../app');
  app = mod.default;
} catch (err: any) {
  appImportError = err;
  console.error('[Vercel Entry] FAILED TO IMPORT app.ts:', err);
}

export default async function handler(req: any, res: any) {
  // First sanity check: did the app even load?
  if (appImportError) {
    return res.status(500).json({
      error: 'AppImportError',
      message: appImportError?.message || String(appImportError),
      code: appImportError?.code,
      stack: appImportError?.stack?.split('\n').slice(0, 10),
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
        vercel: !!process.env.VERCEL,
        nodeVersion: process.version,
      },
    });
  }
  if (typeof app !== 'function') {
    return res.status(500).json({
      error: 'AppNotAFunction',
      message: `Expected app to be an Express handler, got ${typeof app}`,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
        vercel: !!process.env.VERCEL,
        nodeVersion: process.version,
      },
    });
  }

  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Entry] Express handler threw:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'VercelEntryPointError',
        message: err?.message || String(err),
        code: err?.code,
        stack: err?.stack?.split('\n').slice(0, 10),
      });
    }
  }
}
