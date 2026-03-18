import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import { initializeTenantSchema, seedDefaultRoles } from '../../db.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireSuperAdmin);

adminRouter.get('/stats', async (req, res, next) => {
  try {
    const realCompaniesCount = await req.db.query("SELECT COUNT(*) as count FROM public.companies WHERE type = 'real'");
    const demoCompaniesCount = await req.db.query("SELECT COUNT(*) as count FROM public.companies WHERE type = 'demo'");
    const totalUsers = await req.db.query("SELECT COUNT(*) as count FROM public.users");

    res.json({
      realCompanies: parseInt(realCompaniesCount.rows[0]?.count || '0', 10),
      demoCompanies: parseInt(demoCompaniesCount.rows[0]?.count || '0', 10),
      totalUsers: parseInt(totalUsers.rows[0]?.count || '0', 10)
    });
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

adminRouter.get('/companies', async (req, res, next) => {
  try {
    const companies = await req.db.query('SELECT * FROM public.companies');
    res.json(companies.rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/companies', async (req, res, next) => {
  const client = req.db;
  try {
    const { id, name, type, status, adminName, adminEmail, adminPassword, adminPhone } = req.body;
    const schemaName = `tenant_${id.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    
    await client.query('BEGIN');
    
    // Create company
    await client.query('INSERT INTO public.companies (id, name, type, status, phone, email, "createdAt", "schemaName") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, name, type, status || 'active', adminPhone || null, adminEmail || null, new Date().toISOString(), schemaName]);
    
    // Initialize schema
    await initializeTenantSchema(schemaName);

    // Seed default roles
    await seedDefaultRoles(client, id);

    // Create admin user if details provided
    if (adminEmail && adminPassword) {
      const userId = `user_${Date.now()}`;
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      // Assign the default admin role
      const adminRoleId = `role_admin_${id}`;
      await client.query('INSERT INTO public.users (id, "companyId", email, password, role, name, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [userId, id, adminEmail, hashedPassword, adminRoleId, adminName || name, 'Active']);
    }
    
    await client.query('COMMIT');
    res.status(201).json({ id, name, type, status: status || 'active', schemaName });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  }
});

adminRouter.put('/companies/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, status } = req.body;
    await req.db.query('UPDATE public.companies SET name = $1, type = $2, status = $3 WHERE id = $4',
      [name, type, status, id]);
    res.json({ id, name, type, status });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/companies/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = req.db;
    try {
      const companyRes = await client.query('SELECT "schemaName" FROM public.companies WHERE id = $1', [id]);
      const schemaName = companyRes.rows[0]?.schemaName;

      await client.query('BEGIN');
      
      // If we have a schema, we should probably drop it or just delete data
      // For now, let's just delete the company and its users (global tables)
      // The schema could be archived or dropped
      if (schemaName) {
        await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      }

      await client.query('DELETE FROM public.users WHERE "companyId" = $1', [id]);
      await client.query('DELETE FROM public.companies WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
    res.status(204).send();
  } catch (error) {
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
    await req.db.query('DELETE FROM public.users WHERE id = $1 AND role != $2', [req.params.id, 'super_admin']);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
