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
