import type { Request, Response, NextFunction } from 'express';
import { canAccessDeclarations } from '../../shared/declarationAccess.js';
import { requirePermission } from './permissions.js';
export function requireDeclarationManager(req: Request, res: Response, next: NextFunction) {
  if (!canAccessDeclarations(req.user?.role)) {
    return res.status(403).json({ error: 'Les déclarations sont réservées aux administrateurs et managers.' });
  }
  return requirePermission(req.method === 'GET' ? 'declarations.view' : 'declarations.edit')(req, res, next);
}
