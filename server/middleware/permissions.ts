import type { Request, Response, NextFunction } from 'express';

/**
 * Granular permission enforcement.
 *
 * Custom roles (created via POST/PUT /api/company/roles) carry a list of
 * permission ids (crm.edit, sales.delete, hr.payroll, ...) in the
 * `role_permissions` table — the same ids the Users & Roles UI lets an
 * admin toggle per module. Until now nothing ever read that table outside
 * of the roles CRUD screen itself, so the checkboxes were purely cosmetic:
 * any authenticated tenant member could call any write endpoint regardless
 * of their assigned role's configured permissions.
 *
 * `req.user.role` holds either:
 *   - 'super_admin' — cross-tenant, always full access.
 *   - a bare legacy string ('admin', 'rh') — pre-dates the per-company
 *     roles table (seeded fixtures / very old accounts). Treated as full
 *     access so we don't silently lock out accounts that were never
 *     migrated to a `role_<id>` row.
 *   - a company-scoped role id — resolved against `role_permissions`. The
 *     seeded default roles use an underscore-prefixed id
 *     ('role_admin_<companyId>', 'role_sales_<companyId>', ...); roles an
 *     admin creates by hand through the Users & Roles UI get a
 *     hyphenated id ('role-<random>') instead — both are just opaque
 *     foreign keys into `roles`/`role_permissions`, so we look either kind
 *     up the same way rather than pattern-matching the id shape. The
 *     seeded Administrator role stores the sentinel permission id 'all'.
 */
const FULL_ACCESS = Symbol('full-access');
type PermissionSet = Set<string> | typeof FULL_ACCESS;

/** Mirrors server/utils/roles.ts's isManagerRole — see the safety-net note below. */
function isAdminTierRoleId(role: string): boolean {
  return role.startsWith('role_admin_') || role.startsWith('role_rh_') || role.startsWith('role_super_admin_');
}

async function resolvePermissions(db: any, role: string | null | undefined): Promise<PermissionSet> {
  if (!role) return new Set();
  if (role === 'super_admin' || role === 'admin' || role === 'rh') return FULL_ACCESS;

  const result = await db.query('SELECT "permissionId" FROM role_permissions WHERE "roleId" = $1', [role]);
  const perms: string[] = result.rows.map((r: any) => r.permissionId);
  if (perms.includes('all')) return FULL_ACCESS;
  // Safety net: an admin/rh-tier role id with literally zero rows means
  // `roles`/`role_permissions` was never seeded for that company (seeding
  // normally runs at company-creation time — see seedDefaultRoles) rather
  // than an admin deliberately stripped of every permission, which
  // wouldn't happen since the seeded Administrator role always carries
  // 'all'. Fail open here instead of silently locking every admin out of
  // their own company; a real custom role with a genuinely empty
  // permission set never has one of these reserved prefixes.
  if (perms.length === 0 && isAdminTierRoleId(role)) return FULL_ACCESS;
  return new Set(perms);
}

/**
 * JSON-serializable variant for API responses (e.g. GET /api/auth/me) so
 * the frontend can hide nav sections the user's role has zero permissions
 * for, without duplicating the resolution logic client-side.
 */
export async function resolvePermissionsList(db: any, role: string | null | undefined): Promise<string[] | 'all'> {
  const perms = await resolvePermissions(db, role);
  return perms === FULL_ACCESS ? 'all' : Array.from(perms);
}

/** Express middleware factory: 403s unless the user's role grants `permissionId`. */
export function requirePermission(permissionId: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = await resolvePermissions(req.db, req.user?.role);
      if (perms === FULL_ACCESS || perms.has(permissionId)) {
        return next();
      }
      return res.status(403).json({
        error: `Action non autorisée : votre rôle ne dispose pas de la permission "${permissionId}".`,
      });
    } catch (error) {
      next(error);
    }
  };
}
