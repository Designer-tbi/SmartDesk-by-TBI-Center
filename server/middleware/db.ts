import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../../db';
import { setTenantContext, clearTenantContext } from '../tenancy';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

/**
 * Decode the JWT (best-effort) to find the acting user's companyId/role BEFORE
 * the auth middleware runs, so we can configure Row-Level Security session
 * variables on the DB client from the very first query.
 *
 * Super-admins can override the target company via `x-company-id` or
 * `?companyId=` (used by the admin UI when browsing tenants).
 */
function peekTenantFromRequest(req: Request): {
  companyId: string | null;
  companyType: string | null;
  isSuperAdmin: boolean;
} {
  // Primary: HttpOnly cookie. Fallback: Authorization header.
  let token: string | undefined = (req as any).cookies?.smartdesk_session;
  if (!token) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      token = auth.split(' ')[1];
    }
  }
  if (!token) {
    return { companyId: null, companyType: null, isSuperAdmin: false };
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const isSuperAdmin = decoded?.role === 'super_admin';
    let companyId: string | null = decoded?.companyId ?? null;
    if (isSuperAdmin) {
      const override =
        (req.headers['x-company-id'] as string) ||
        (req.query.companyId as string) ||
        (req.body && req.body.companyId);
      if (override) companyId = override;
    }
    return {
      companyId,
      companyType: decoded?.isDemo ? 'demo' : 'real',
      isSuperAdmin,
    };
  } catch {
    return { companyId: null, companyType: null, isSuperAdmin: false };
  }
}

export const dbMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  let client: any = null;
  let released = false;

  const release = async () => {
    if (client && !released) {
      released = true;
      // Clear tenant context before handing the pooled client back so no
      // state leaks across requests/users.
      await clearTenantContext(client);
      client.release();
    }
  };

  try {
    const connectionPromise = db.connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout')), 4000)
    );

    client = await Promise.race([connectionPromise, timeoutPromise]);
    req.db = client;

    // Reset search_path to public
    await client.query('SET search_path TO public');

    // Establish tenant isolation context for Row-Level Security policies.
    const ctx = peekTenantFromRequest(req);
    await setTenantContext(client, {
      companyId: ctx.companyId,
      companyType: ctx.companyType,
      isSuperAdmin: ctx.isSuperAdmin,
    });

    res.on('finish', release);
    res.on('close', release);

    next();
  } catch (err) {
    await release();
    next(err);
  }
};
