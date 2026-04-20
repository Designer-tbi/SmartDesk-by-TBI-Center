import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { initializeTenantSchema, seedDefaultRoles } from '../../db.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireSuperAdmin);

adminRouter.get('/stats', async (req, res, next) => {
  try {
    const realCompaniesCount = await req.db.query("SELECT COUNT(*) as count FROM public.companies WHERE type = 'real'");
    const demoCompaniesCount = await req.db.query("SELECT COUNT(*) as count FROM public.companies WHERE type = 'demo'");
    const totalUsers = await req.db.query("SELECT COUNT(*) as count FROM public.users");
    const realUsers = await req.db.query(
      `SELECT COUNT(*) as count FROM public.users u
       JOIN public.companies c ON u."companyId" = c.id
       WHERE c.type = 'real'`,
    );
    const demoUsers = await req.db.query(
      `SELECT COUNT(*) as count FROM public.users u
       JOIN public.companies c ON u."companyId" = c.id
       WHERE c.type = 'demo'`,
    );

    res.json({
      realCompanies: parseInt(realCompaniesCount.rows[0]?.count || '0', 10),
      demoCompanies: parseInt(demoCompaniesCount.rows[0]?.count || '0', 10),
      totalUsers: parseInt(totalUsers.rows[0]?.count || '0', 10),
      realUsers: parseInt(realUsers.rows[0]?.count || '0', 10),
      demoUsers: parseInt(demoUsers.rows[0]?.count || '0', 10),
    });
  } catch (error) {
    next(error);
  }
});

// Return companies grouped by type so the admin UI can render a separated
// "Production" vs "Démo" view.
adminRouter.get('/companies/by-type', async (req, res, next) => {
  try {
    const result = await req.db.query(
      `SELECT id, name, type, status, country, "createdAt"
       FROM public.companies
       ORDER BY type, name`,
    );
    const grouped = { real: [] as any[], demo: [] as any[] };
    for (const row of result.rows) {
      (row.type === 'demo' ? grouped.demo : grouped.real).push(row);
    }
    res.json(grouped);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/users', async (req, res, next) => {
  try {
    const users = await req.db.query(`
      SELECT u.id, u.email, u.role, u.name, u.status, u."lastLogin", c.name as "companyName"
      FROM public.users u
      LEFT JOIN public.companies c ON u."companyId" = c.id
    `);
    res.json(users.rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/activity', async (req, res, next) => {
  try {
    // Note: activity_log is per-tenant. This query will only work if search_path is set to a tenant.
    // For super admin global view, we might need a different approach or move activity_log to public.
    const activity = await req.db.query(`
      SELECT a.*, u.name as "userName", c.name as "companyName"
      FROM activity_log a
      LEFT JOIN public.users u ON a."userId" = u.id
      LEFT JOIN public.companies c ON u."companyId" = c.id
      WHERE u.role != 'super_admin' OR u.role IS NULL
      ORDER BY a."createdAt" DESC
      LIMIT 100
    `);
    res.json(activity.rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/test-schema', async (req, res, next) => {
  try {
    const result = await req.db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies'
    `);
    res.json(result.rows.map(r => r.column_name));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/companies', async (req, res, next) => {
  try {
    // Include lifecycle fields so the super-admin UI can show the
    // 15-day demo countdown + CRM row counts for each tenant.
    const companies = await req.db.query(`
      SELECT
        c.*,
        COALESCE((SELECT COUNT(*) FROM contacts WHERE "companyId" = c.id), 0)::int AS "contactsCount",
        COALESCE((SELECT COUNT(*) FROM products WHERE "companyId" = c.id), 0)::int AS "productsCount",
        COALESCE((SELECT COUNT(*) FROM invoices WHERE "companyId" = c.id), 0)::int AS "invoicesCount",
        COALESCE((SELECT COUNT(*) FROM public.users WHERE "companyId" = c.id), 0)::int AS "usersCount",
        CASE
          WHEN c.type = 'demo' AND c."demoExpiresAt" IS NOT NULL
          THEN GREATEST(0, EXTRACT(EPOCH FROM (c."demoExpiresAt" - NOW())) / 86400)::int
          ELSE NULL
        END AS "daysRemaining"
      FROM public.companies c
      ORDER BY c.type, c.name
    `);
    res.json(companies.rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/companies', async (req, res, next) => {
  try {
    const { id, name, type, status, adminName, adminEmail, adminPassword, adminPhone } = req.body;
    const schemaName = `tenant_${id.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    
    await req.db.query('BEGIN');
    
    // Create company. Demo companies get the DGID fiscalization API key
    // baked in so invoices can be auto-certified on creation.
    const dgidKey = type === 'demo'
      ? (process.env.DGID_DEMO_API_KEY || '97ecc2858d30bfe83f8f4b4f66250fd5eda6c41af396dada290ea4144bfd943c')
      : null;
    await req.db.query('INSERT INTO public.companies (id, name, type, status, phone, email, "createdAt", "schemaName", "fiscalizationApiKey") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, name, type, status || 'active', adminPhone || null, adminEmail || null, new Date().toISOString(), schemaName, dgidKey]);
    
    // Initialize schema
    await initializeTenantSchema(schemaName);

    // Seed default roles (set RLS session so INSERTs pass WITH CHECK)
    await req.db.query(
      `SELECT set_config('app.current_company_id', $1, false)`,
      [id],
    );
    await seedDefaultRoles(req.db, id);

    // Create admin user if details provided
    if (adminEmail && adminPassword) {
      const userId = `user_${Date.now()}`;
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      // Assign the default admin role
      const adminRoleId = `role_admin_${id}`;
      await req.db.query('INSERT INTO public.users (id, "companyId", email, password, role, name, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [userId, id, adminEmail, hashedPassword, adminRoleId, adminName || name, 'Active']);
    }
    
    await req.db.query('COMMIT');
    res.status(201).json({ id, name, type, status: status || 'active', schemaName });
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

adminRouter.put('/companies/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, status } = req.body;
    await req.db.query('UPDATE public.companies SET name = $1, type = $2, status = $3 WHERE id = $4',
      [name, type, status, id]);
    // Keep the DGID demo key in sync when a company becomes demo / ceases
    // to be demo. Non-demo companies get the key cleared for safety.
    if (type === 'demo') {
      const dgidKey = process.env.DGID_DEMO_API_KEY || '97ecc2858d30bfe83f8f4b4f66250fd5eda6c41af396dada290ea4144bfd943c';
      await req.db.query(
        `UPDATE public.companies SET "fiscalizationApiKey" = $1 WHERE id = $2 AND ("fiscalizationApiKey" IS NULL OR "fiscalizationApiKey" = '')`,
        [dgidKey, id],
      );
    } else {
      await req.db.query(`UPDATE public.companies SET "fiscalizationApiKey" = NULL WHERE id = $1`, [id]);
    }
    res.json({ id, name, type, status });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/companies/:id/convert-to-real', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('UPDATE public.companies SET type = $1 WHERE id = $2', ['real', id]);
    res.json({ id, type: 'real' });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/companies/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    try {
      const companyRes = await req.db.query('SELECT "schemaName" FROM public.companies WHERE id = $1', [id]);
      const schemaName = companyRes.rows[0]?.schemaName;

      await req.db.query('BEGIN');
      
      // Delete child tables first to avoid foreign key constraint violations
      // since the database schema has 'NO ACTION' instead of 'CASCADE' for many tables
      
      // 1. Delete items that reference other tables
      await req.db.query('DELETE FROM public.role_permissions WHERE "roleId" IN (SELECT id FROM public.roles WHERE "companyId" = $1)', [id]);
      await req.db.query('DELETE FROM public.journal_items WHERE "journalEntryId" IN (SELECT id FROM public.journal_entries WHERE "companyId" = $1)', [id]);
      await req.db.query('DELETE FROM public.invoice_items WHERE "invoiceId" IN (SELECT id FROM public.invoices WHERE "companyId" = $1)', [id]);
      await req.db.query('DELETE FROM public.quote_template_items WHERE "templateId" IN (SELECT id FROM public.quote_templates WHERE "companyId" = $1)', [id]);
      
      // 2. Delete tables that reference employees or users
      const tablesReferencingUsersOrEmployees = [
        'employee_tasks',
        'leave_requests',
        'payslips',
        'contracts',
        'activity_log',
        'events',
        'schedules',
        'sessions'
      ];
      for (const table of tablesReferencingUsersOrEmployees) {
        await req.db.query(`DELETE FROM public.${table} WHERE "companyId" = $1`, [id]);
      }

      // 3. Delete tables that reference companies directly
      const tablesReferencingCompanies = [
        'roles',
        'journal_entries',
        'quote_templates',
        'invoices',
        'projects',
        'products',
        'contract_templates',
        'transactions'
      ];
      for (const table of tablesReferencingCompanies) {
        await req.db.query(`DELETE FROM public.${table} WHERE "companyId" = $1`, [id]);
      }

      // 4. Delete core entities
      await req.db.query('DELETE FROM public.employees WHERE "companyId" = $1', [id]);
      await req.db.query('DELETE FROM public.contacts WHERE "companyId" = $1', [id]);
      await req.db.query('DELETE FROM public.users WHERE "companyId" = $1', [id]);
      
      // 5. Finally delete the company
      await req.db.query('DELETE FROM public.companies WHERE id = $1', [id]);
      
      // 6. Drop the schema if it exists
      if (schemaName) {
        await req.db.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      }

      await req.db.query('COMMIT');
    } catch (e) {
      await req.db.query('ROLLBACK');
      console.error('Error deleting company:', e);
      throw e;
    }
    res.status(204).send();
  } catch (error) {
    console.error('Outer error deleting company:', error);
    next(error);
  }
});

// Manage users for a company
adminRouter.get('/companies/:companyId/users', async (req, res, next) => {
  try {
    const users = await req.db.query('SELECT id, email, role, name, status, "lastLogin" FROM public.users WHERE "companyId" = $1', [req.params.companyId]);
    res.json(users.rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/companies/:companyId/users', async (req, res, next) => {
  try {
    const { id, email, password, role, name, status } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await req.db.query('INSERT INTO public.users (id, "companyId", email, password, role, name, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, req.params.companyId, email, hashedPassword, role, name, status || 'Active']);
    res.status(201).json({ id, companyId: req.params.companyId, email, role, name, status: status || 'Active' });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/users/:id', async (req, res, next) => {
  try {
    const userId = req.params.id;
    try {
      await req.db.query('BEGIN');
      
      // Delete child records first to avoid NO ACTION foreign key constraints
      const tablesReferencingUsers = [
        'activity_log',
        'events',
        'schedules',
        'sessions'
      ];
      
      for (const table of tablesReferencingUsers) {
        // Some tables might reference user via different columns
        if (table === 'events') {
          await req.db.query(`DELETE FROM public.events WHERE "userId" = $1 OR "assignedTo" = $1`, [userId]);
        } else if (table === 'schedules') {
          await req.db.query(`DELETE FROM public.schedules WHERE "userId" = $1 OR "createdBy" = $1`, [userId]);
        } else {
          await req.db.query(`DELETE FROM public.${table} WHERE "userId" = $1`, [userId]);
        }
      }

      await req.db.query('DELETE FROM public.users WHERE id = $1 AND role != $2', [userId, 'super_admin']);
      await req.db.query('COMMIT');
    } catch (e) {
      await req.db.query('ROLLBACK');
      throw e;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
