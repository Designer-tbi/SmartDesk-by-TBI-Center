import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import bcrypt from 'bcrypt';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireSuperAdmin);

adminRouter.get('/stats', async (req, res, next) => {
  try {
    const realCompaniesCount = await req.db.query("SELECT COUNT(*) as count FROM companies WHERE type = 'real'");
    const demoCompaniesCount = await req.db.query("SELECT COUNT(*) as count FROM companies WHERE type = 'demo'");
    const totalUsers = await req.db.query("SELECT COUNT(*) as count FROM users");

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
      FROM users u
      LEFT JOIN companies c ON u."companyId" = c.id
    `);
    res.json(users.rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/activity', async (req, res, next) => {
  try {
    const activity = await req.db.query(`
      SELECT a.*, u.name as "userName", c.name as "companyName"
      FROM activity_log a
      LEFT JOIN users u ON a."userId" = u.id
      LEFT JOIN companies c ON a."companyId" = c.id
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
    const companies = await req.db.query('SELECT * FROM companies');
    res.json(companies.rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/companies', async (req, res, next) => {
  try {
    const { id, name, type, status } = req.body;
    await req.db.query('INSERT INTO companies (id, name, type, status, "createdAt") VALUES ($1, $2, $3, $4, $5)',
      [id, name, type, status || 'active', new Date().toISOString()]);
    res.status(201).json({ id, name, type, status: status || 'active' });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/companies/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, status } = req.body;
    await req.db.query('UPDATE companies SET name = $1, type = $2, status = $3 WHERE id = $4',
      [name, type, status, id]);
    res.json({ id, name, type, status });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/companies/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await req.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM journal_items WHERE "journalEntryId" IN (SELECT id FROM journal_entries WHERE "companyId" = $1)', [id]);
      await client.query('DELETE FROM journal_entries WHERE "companyId" = $1', [id]);
      await client.query('DELETE FROM transactions WHERE "companyId" = $1', [id]);
      await client.query('DELETE FROM employees WHERE "companyId" = $1', [id]);
      await client.query('DELETE FROM projects WHERE "companyId" = $1', [id]);
      await client.query('DELETE FROM invoice_items WHERE "invoiceId" IN (SELECT id FROM invoices WHERE "companyId" = $1)', [id]);
      await client.query('DELETE FROM invoices WHERE "companyId" = $1', [id]);
      await client.query('DELETE FROM products WHERE "companyId" = $1', [id]);
      await client.query('DELETE FROM contacts WHERE "companyId" = $1', [id]);
      await client.query('DELETE FROM users WHERE "companyId" = $1', [id]);
      await client.query('DELETE FROM companies WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Manage users for a company
adminRouter.get('/companies/:companyId/users', async (req, res, next) => {
  try {
    const users = await req.db.query('SELECT id, email, role, name, status, "lastLogin" FROM users WHERE "companyId" = $1', [req.params.companyId]);
    res.json(users.rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/companies/:companyId/users', async (req, res, next) => {
  try {
    const { id, email, password, role, name, status } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await req.db.query('INSERT INTO users (id, "companyId", email, password, role, name, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, req.params.companyId, email, hashedPassword, role, name, status || 'Active']);
    res.status(201).json({ id, companyId: req.params.companyId, email, role, name, status: status || 'Active' });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/users/:id', async (req, res, next) => {
  try {
    await req.db.query('DELETE FROM users WHERE id = $1 AND role != $2', [req.params.id, 'super_admin']);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
