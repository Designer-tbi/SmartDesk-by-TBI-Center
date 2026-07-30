import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './jwtSecret.js';

export interface TenantContext {
  companyId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Extract the `smartdesk_session` JWT from a raw `Cookie` header string and
 * decode it. Used anywhere we only have a raw Node `IncomingMessage` (no
 * cookie-parser middleware has run yet) — e.g. the WebSocket upgrade
 * request, which never goes through Express's request pipeline.
 */
export function tenantContextFromCookieHeader(cookieHeader: string | undefined): TenantContext {
  if (!cookieHeader) return { companyId: null, isSuperAdmin: false };
  const match = cookieHeader.match(/(?:^|;\s*)smartdesk_session=([^;]+)/);
  if (!match) return { companyId: null, isSuperAdmin: false };
  try {
    const decoded = jwt.verify(decodeURIComponent(match[1]), JWT_SECRET) as any;
    return {
      companyId: decoded?.companyId ?? null,
      isSuperAdmin: decoded?.role === 'super_admin',
    };
  } catch {
    return { companyId: null, isSuperAdmin: false };
  }
}
