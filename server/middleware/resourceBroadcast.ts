/**
 * Resource change broadcaster.
 *
 * Mounted globally after the auth middleware. Intercepts successful
 * POST / PUT / DELETE responses on mutating API routes and emits a
 * single `RESOURCE_CHANGED` event on the WebSocket so connected
 * clients can refetch their data without ad-hoc broadcasts sprinkled
 * throughout every controller.
 *
 * Why not wire each route individually?
 * - Less boilerplate (and fewer places to forget).
 * - A single, predictable event shape for the frontend.
 * - Existing activity.logActivity calls still fire in parallel.
 */
import type { Request, Response, NextFunction } from 'express';
import { broadcast } from '../activity.js';

/** Maps a URL path segment to a logical resource key the frontend cares about. */
const RESOURCE_MAP: Array<[RegExp, string]> = [
  [/^\/api\/contacts(\/|$)/, 'contacts'],
  [/^\/api\/products(\/|$)/, 'products'],
  [/^\/api\/invoices(\/|$)/, 'invoices'],
  [/^\/api\/projects(\/|$)/, 'projects'],
  [/^\/api\/employees\/leaves(\/|$)/, 'leaves'],
  [/^\/api\/employees\/payslips(\/|$)/, 'payslips'],
  [/^\/api\/employees\/contracts(\/|$)/, 'contracts'],
  [/^\/api\/employees\/tasks(\/|$)/, 'employeeTasks'],
  [/^\/api\/employees(\/|$)/, 'employees'],
  [/^\/api\/schedules(\/|$)/, 'schedules'],
  [/^\/api\/journal-entries(\/|$)/, 'journalEntries'],
  [/^\/api\/transactions(\/|$)/, 'transactions'],
  [/^\/api\/events(\/|$)/, 'events'],
];

const resolveResource = (url: string): string | null => {
  for (const [re, key] of RESOURCE_MAP) {
    if (re.test(url)) return key;
  }
  return null;
};

export const resourceChangeBroadcaster = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const method = req.method;
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    return next();
  }
  const resource = resolveResource(req.originalUrl.split('?')[0]);
  if (!resource) return next();

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const companyId = (req as any).user?.companyId
        || (req as any).db?.companyId
        || null;
      broadcast({
        type: 'RESOURCE_CHANGED',
        data: {
          resource,
          method,
          url: req.originalUrl,
          id: req.params?.id || null,
          companyId,
          at: new Date().toISOString(),
        },
      });
    }
  });
  next();
};
