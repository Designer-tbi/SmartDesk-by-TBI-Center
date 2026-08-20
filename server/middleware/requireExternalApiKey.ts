/**
 * Authenticate partner-platform requests via a per-partner API key.
 *
 * Each partner has its own key (managed via /api/admin/api-keys, stored
 * hashed in the `api_keys` table — see server/services/apiKeys.ts) so one
 * partner's key can be revoked without affecting anyone else's, and every
 * request can be attributed to the partner that made it (`req.partnerId`/
 * `req.partnerName`).
 *
 * The key must be supplied either as an `X-API-Key` header OR an
 * `Authorization: Bearer <key>` header. We accept both so partners can use
 * whichever fits their existing HTTP client.
 *
 * `EXTERNAL_API_KEY` (a single static env-var key, the original scheme) is
 * still accepted as a legacy fallback so an already-integrated partner
 * isn't broken while everyone migrates to per-partner keys — new
 * integrations should be issued a real key instead.
 */
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { verifyApiKey } from '../services/apiKeys.js';

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const requireExternalApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const headerKey = (req.headers['x-api-key'] as string | undefined) || '';
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const presented = headerKey || bearer;
  if (!presented) {
    return res.status(401).json({ error: 'Invalid or missing API key.' });
  }

  const legacyKey = process.env.EXTERNAL_API_KEY;
  if (legacyKey && timingSafeEqual(presented, legacyKey)) {
    (req as any).partnerName = 'legacy-shared-key';
    return next();
  }

  try {
    const partner = await verifyApiKey(presented);
    if (!partner) {
      return res.status(401).json({ error: 'Invalid or missing API key.' });
    }
    (req as any).partnerId = partner.id;
    (req as any).partnerName = partner.partnerName;
    next();
  } catch (error) {
    next(error);
  }
};
