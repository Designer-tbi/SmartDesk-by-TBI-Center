/**
 * SmartDesk roles are keyed per-company (e.g. `role_admin_demo-1`,
 * `role_rh_demo-2`) so we match by prefix here, plus the legacy plain
 * values used by super-admin and seeded fixtures. Mirrors
 * server/utils/roles.ts — keep both in sync.
 */
export function isManagerRole(role?: string | null): boolean {
  if (!role) return false;
  if (role === 'admin' || role === 'super_admin' || role === 'rh') return true;
  return role.startsWith('role_admin_') || role.startsWith('role_rh_') || role.startsWith('role_super_admin_');
}

/**
 * True if the user's resolved permission set (from GET /api/auth/me,
 * mirrors the server-side requirePermission() check) grants access to
 * `modulePrefix` (e.g. "crm", "hr") — any of that module's .view/.edit/
 * .delete/etc ids, or full ('all') access.
 *
 * `permissions` missing entirely (stale cached user, older API response)
 * fails OPEN — show the nav item — rather than hiding a module a user may
 * actually have access to just because we haven't refetched yet.
 */
export function hasModuleAccess(permissions: string[] | 'all' | undefined | null, modulePrefix: string): boolean {
  if (permissions == null) return true;
  if (permissions === 'all') return true;
  return permissions.some((p) => p === 'all' || p.startsWith(`${modulePrefix}.`));
}

/**
 * True if the user's resolved permission set grants a SPECIFIC permission
 * id (e.g. "hr.payroll"), mirroring the server-side requirePermission()
 * check exactly — unlike hasModuleAccess, which only checks the module
 * prefix. Used to gate manager-only write UI (buttons, forms) so a
 * non-manager doesn't see actions that will just 403 server-side.
 *
 * `permissions` missing entirely fails OPEN for the same reason as
 * hasModuleAccess — a stale cached user shouldn't lose access to actions
 * they actually have.
 */
export function hasPermission(permissions: string[] | 'all' | undefined | null, permissionId: string): boolean {
  if (permissions == null) return true;
  if (permissions === 'all') return true;
  return permissions.some((p) => p === 'all' || p === permissionId);
}
