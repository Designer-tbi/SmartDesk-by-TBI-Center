/**
 * Subscription gate — blocks every API mutation (and most reads)
 * when a tenant's trial has expired and no active PayPal subscription
 * is in place.
 *
 * Runs at the app level (before route-level auth) so it can gate all
 * routers uniformly. It decodes the JWT itself — we can't rely on
 * req.user because that's populated by the per-router requireAuth
 * middleware which runs later.
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';
const TRIAL_MS = 15 * 24 * 60 * 60 * 1000;

const ALLOW_PREFIX = [
  '/api/auth',
  '/api/subscription',
  '/api/public',
];

const ALLOW_EXACT_GET = new Set([
  '/api/company',
  '/api/stats',
]);

const peekCompany = (req: Request): { companyId: string | null; isSuperAdmin: boolean } => {
  let token: string | undefined = (req as any).cookies?.smartdesk_session;
  if (!token) {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) token = auth.split(' ')[1];
  }
  if (!token) return { companyId: null, isSuperAdmin: false };
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      companyId: decoded?.companyId || null,
      isSuperAdmin: decoded?.role === 'super_admin',
    };
  } catch {
    return { companyId: null, isSuperAdmin: false };
  }
};

export const enforceSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const path = req.originalUrl.split('?')[0];
  if (!path.startsWith('/api/')) return next();
  if (ALLOW_PREFIX.some((p) => path.startsWith(p))) return next();
  if (req.method === 'GET' && ALLOW_EXACT_GET.has(path)) return next();

  const { companyId, isSuperAdmin } = peekCompany(req);
  if (!companyId || isSuperAdmin) return next();

  try {
    const r = await (req as any).db.query(
      `SELECT "trialStartedAt", "subscriptionStatus"
         FROM companies WHERE id = $1`,
      [companyId],
    );
    const row = r.rows[0] || {};
    const status = row.subscriptionStatus || 'trial';
    if (status === 'active') return next();

    if (row.trialStartedAt) {
      const elapsed = Date.now() - new Date(row.trialStartedAt).getTime();
      if (elapsed < TRIAL_MS) return next();
    } else {
      // No trial stamp yet — allow, the /login handler will stamp it.
      return next();
    }

    return res.status(402).json({
      error: 'Subscription required',
      code: 'SUBSCRIPTION_REQUIRED',
      subscriptionStatus: status,
    });
  } catch (err) {
    console.error('enforceSubscription middleware error:', err);
    return next();
  }
};
