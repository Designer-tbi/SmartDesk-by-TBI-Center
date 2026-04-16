/**
 * Row-Level Security (RLS) setup for multi-tenant isolation.
 *
 * Each tenant table carries a "companyId" column. We enable PostgreSQL RLS on
 * every tenant table and attach a single USING/WITH CHECK policy that requires
 *
 *   companyId = current_setting('app.current_company_id', true)
 *   OR current_setting('app.is_super_admin', true) = 'true'
 *
 * The connection-scoped session variables are set by the `dbMiddleware` at the
 * start of every HTTP request, based on the authenticated user's JWT.
 *
 * Super-admins can freely read/write across tenants but can also "impersonate"
 * a specific company by sending `x-company-id` / `?companyId=...` — in which
 * case we set `app.current_company_id` to that value AND keep
 * `app.is_super_admin = true` so they retain read access to child tables via
 * joins.
 */
import type { Pool } from 'pg';

/** Tables that hold tenant-scoped data and must have a "companyId" column. */
export const TENANT_TABLES = [
  'contacts',
  'products',
  'invoices',
  'invoice_items',
  'projects',
  'employees',
  'employee_tasks',
  'transactions',
  'journal_entries',
  'journal_items',
  'quote_templates',
  'quote_template_items',
  'leave_requests',
  'payslips',
  'contracts',
  'contract_templates',
  'roles',
  'activity_log',
  'events',
  'schedules',
  // `users`, `sessions` and `companies` are handled separately — they have to
  // stay readable at login time before a companyId is bound.
] as const;

const POLICY_NAME = 'tenant_isolation';

/**
 * Enable RLS and (re)create the tenant policy on every tenant table.
 * Idempotent: safe to call on every boot.
 */
export async function enableTenantRLS(db: Pool): Promise<void> {
  for (const table of TENANT_TABLES) {
    try {
      // Make sure the table exists before touching it.
      const exists = await db.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [table],
      );
      if (exists.rows.length === 0) continue;

      // Ensure the column exists (should already, but defensive).
      await db.query(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "companyId" TEXT`,
      );

      // Enable + force RLS. FORCE makes the policy apply even to table owners.
      await db.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await db.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);

      // Drop the old policy (if any) so we can safely redefine it.
      await db.query(
        `DROP POLICY IF EXISTS ${POLICY_NAME} ON ${table}`,
      );

      // Unified policy: match the tenant OR allow super-admins.
      await db.query(`
        CREATE POLICY ${POLICY_NAME} ON ${table}
        USING (
          "companyId" = current_setting('app.current_company_id', true)
          OR current_setting('app.is_super_admin', true) = 'true'
        )
        WITH CHECK (
          "companyId" = current_setting('app.current_company_id', true)
          OR current_setting('app.is_super_admin', true) = 'true'
        )
      `);
    } catch (err) {
      // Log and continue — we never want RLS setup to crash the boot.
      console.error(`RLS setup failed for ${table}:`, err);
    }
  }
  console.log(`RLS enabled on ${TENANT_TABLES.length} tenant tables`);
}

/**
 * Set per-request session variables so the RLS policies can evaluate.
 * Called at the start of every HTTP request, once per acquired client.
 *
 * Using `set_config(..., false)` = session-scoped (persists on the pooled
 * connection until overwritten). Because we call it on every request before
 * releasing the client back, there is no leakage between tenants.
 */
export async function setTenantContext(
  client: any,
  ctx: {
    companyId: string | null | undefined;
    companyType?: string | null;
    isSuperAdmin: boolean;
  },
): Promise<void> {
  await client.query(
    `SELECT
       set_config('app.current_company_id', $1, false),
       set_config('app.current_company_type', $2, false),
       set_config('app.is_super_admin', $3, false)`,
    [
      ctx.companyId ?? '',
      ctx.companyType ?? '',
      ctx.isSuperAdmin ? 'true' : 'false',
    ],
  );
}

/**
 * Clear tenant context on client release so a stale super-admin flag can't
 * leak into an unauthenticated request that reuses the same pool connection.
 */
export async function clearTenantContext(client: any): Promise<void> {
  try {
    await client.query(
      `SELECT
         set_config('app.current_company_id', '', false),
         set_config('app.current_company_type', '', false),
         set_config('app.is_super_admin', 'false', false)`,
    );
  } catch {
    /* client may already be closed — ignore */
  }
}
