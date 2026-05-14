/**
 * Authenticate partner-platform requests via a static API key.
 *
 * The key is read from the `EXTERNAL_API_KEY` env var and must be
 * supplied either as an `X-API-Key` header OR an `Authorization:
 * Bearer <key>` header. We accept both so partners can use whichever
 * fits their existing HTTP client.
 *
 * If `EXTERNAL_API_KEY` isn't set on the server, the route is
 * effectively disabled (returns 503). Never falls back to a default
 * to avoid silently exposing the provisioning endpoint.
 */
import type { Request, Response, NextFunction } from 'express';

export const requireExternalApiKey = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const expected = process.env.EXTERNAL_API_KEY;
  if (!expected) {
    return res.status(503).json({
      error: 'External provisioning disabled. Set EXTERNAL_API_KEY on the server.',
    });
  }
  const headerKey = (req.headers['x-api-key'] as string | undefined) || '';
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const presented = headerKey || bearer;
  if (!presented || presented !== expected) {
    return res.status(401).json({ error: 'Invalid or missing API key.' });
  }
  next();
};
