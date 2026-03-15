import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import bcrypt from 'bcrypt';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireSuperAdmin);

adminRouter.get('/stats', (req, res, next) => {
  try {
    const realCompaniesCount = req.db.prepare("SELECT COUNT(*) as count FROM companies WHERE type = 'real'").get() as any;
    const demoCompaniesCount = req.db.prepare("SELECT COUNT(*) as count FROM companies WHERE type = 'demo'").get() as any;
    const totalUsers = req.db.prepare("SELECT COUNT(*) as count FROM users").get() as any;

    res.json({
      realCompanies: realCompaniesCount?.count || 0,
      demoCompanies: demoCompaniesCount?.count || 0,
      totalUsers: totalUsers?.count || 0
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/companies', (req, res, next) => {
  try {
    const companies = req.db.prepare('SELECT * FROM companies').all();
    res.json(companies);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/companies', (req, res, next) => {
  try {
    const { id, name, type, status } = req.body;
    req.db.prepare('INSERT INTO companies (id, name, type, status, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, type, status || 'active', new Date().toISOString());
    res.status(201).json({ id, name, type, status: status || 'active' });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/companies/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, status } = req.body;
    req.db.prepare('UPDATE companies SET name = ?, type = ?, status = ? WHERE id = ?')
      .run(name, type, status, id);
    res.json({ id, name, type, status });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/companies/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    // Delete all associated data first
    req.db.transaction(() => {
      req.db.prepare('DELETE FROM journal_items WHERE journalEntryId IN (SELECT id FROM journal_entries WHERE companyId = ?)').run(id);
      req.db.prepare('DELETE FROM journal_entries WHERE companyId = ?').run(id);
      req.db.prepare('DELETE FROM transactions WHERE companyId = ?').run(id);
      req.db.prepare('DELETE FROM employees WHERE companyId = ?').run(id);
      req.db.prepare('DELETE FROM projects WHERE companyId = ?').run(id);
      req.db.prepare('DELETE FROM invoice_items WHERE invoiceId IN (SELECT id FROM invoices WHERE companyId = ?)').run(id);
      req.db.prepare('DELETE FROM invoices WHERE companyId = ?').run(id);
      req.db.prepare('DELETE FROM products WHERE companyId = ?').run(id);
      req.db.prepare('DELETE FROM contacts WHERE companyId = ?').run(id);
      req.db.prepare('DELETE FROM users WHERE companyId = ?').run(id);
      req.db.prepare('DELETE FROM companies WHERE id = ?').run(id);
    })();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Manage users for a company
adminRouter.get('/companies/:companyId/users', (req, res, next) => {
  try {
    const users = req.db.prepare('SELECT id, email, role, name FROM users WHERE companyId = ?').all(req.params.companyId);
    res.json(users);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/companies/:companyId/users', async (req, res, next) => {
  try {
    const { id, email, password, role, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    req.db.prepare('INSERT INTO users (id, companyId, email, password, role, name) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, req.params.companyId, email, hashedPassword, role, name);
    res.status(201).json({ id, companyId: req.params.companyId, email, role, name });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/users/:id', (req, res, next) => {
  try {
    req.db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(req.params.id, 'super_admin');
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
