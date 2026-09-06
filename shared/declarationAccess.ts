/** Declarations are reserved to administrator and manager roles, never HR alone. */
export function canAccessDeclarations(role?: string | null): boolean {
  return !!role && (['admin', 'super_admin', 'manager'].includes(role)
    || ['role_admin_', 'role_super_admin_', 'role_manager_'].some(prefix => role.startsWith(prefix)));
}
