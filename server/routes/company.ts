import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const companyRouter = Router();

companyRouter.use(requireAuth, requireCompany);

companyRouter.get('/', async (req, res, next) => {
  try {
    const companyRes = await req.db.query('SELECT * FROM companies WHERE id = $1', [req.user!.companyId]);
    const company = companyRes.rows[0];
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    next(error);
  }
});

companyRouter.put('/', async (req, res, next) => {
  try {
    const { name, taxId, rccm, idNat, siren, siret, email, phone, website, address, country, state, logo, accountingStandard, language, currency } = req.body;
    console.log('Updating company for user:', req.user!.id, 'companyId:', req.user!.companyId);
    const result = await req.db.query('UPDATE companies SET name = $1, "taxId" = $2, rccm = $3, "idNat" = $4, siren = $5, siret = $6, email = $7, phone = $8, website = $9, address = $10, country = $11, state = $12, logo = $13, "accountingStandard" = $14, language = $15, currency = $16 WHERE id = $17',
      [name, taxId, rccm, idNat, siren, siret, email, phone, website, address, country || 'AFRIQUE', state, logo || null, accountingStandard || 'OHADA', language || 'fr', currency || 'XAF', req.user!.companyId]);
    
    console.log('Update result rows affected:', result.rowCount);

    const updatedCompanyRes = await req.db.query('SELECT * FROM companies WHERE id = $1', [req.user!.companyId]);
    const updatedCompany = updatedCompanyRes.rows[0];
    if (!updatedCompany) {
      console.error('Company not found after update for id:', req.user!.companyId);
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(updatedCompany);
  } catch (error) {
    console.error('Error updating company:', error);
    next(error);
  }
});

companyRouter.post('/reset-crm', async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const companyId = req.user!.companyId;
    await client.query('BEGIN');
    
    // Delete invoice items first
    await client.query(`
      DELETE FROM invoice_items 
      WHERE "invoiceId" IN (SELECT id FROM invoices WHERE "companyId" = $1)
    `, [companyId]);
    
    await client.query('DELETE FROM invoices WHERE "companyId" = $1', [companyId]);
    await client.query('DELETE FROM contacts WHERE "companyId" = $1', [companyId]);
    await client.query('DELETE FROM products WHERE "companyId" = $1', [companyId]);
    await client.query('DELETE FROM projects WHERE "companyId" = $1', [companyId]);
    await client.query('DELETE FROM events WHERE "companyId" = $1', [companyId]);
    await client.query('DELETE FROM schedules WHERE "companyId" = $1', [companyId]);
    await client.query('DELETE FROM activity_log WHERE "companyId" = $1', [companyId]);
    
    await client.query('COMMIT');
    res.json({ message: 'CRM data reset successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

companyRouter.post('/reset-accounting', async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const companyId = req.user!.companyId;
    await client.query('BEGIN');
    
    // Delete accounting data
    await client.query('DELETE FROM journal_entries WHERE "companyId" = $1', [companyId]);
    await client.query('DELETE FROM transactions WHERE "companyId" = $1', [companyId]);
    
    await client.query('COMMIT');
    res.json({ message: 'Accounting data reset successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

companyRouter.get('/roles', async (req, res, next) => {
  try {
    const rolesRes = await req.db.query('SELECT * FROM roles WHERE "companyId" = $1', [req.user!.companyId]);
    const roles = rolesRes.rows;
    
    const rolesWithPermissions = await Promise.all(roles.map(async (role: any) => {
      const permsRes = await req.db.query('SELECT "permissionId" FROM role_permissions WHERE "roleId" = $1', [role.id]);
      return { ...role, permissions: permsRes.rows.map((p: any) => p.permissionId) };
    }));
    
    res.json(rolesWithPermissions);
  } catch (error) {
    next(error);
  }
});

companyRouter.post('/roles', async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const role = req.body;
    await client.query('BEGIN');
    
    await client.query('INSERT INTO roles (id, "companyId", name) VALUES ($1, $2, $3)', [role.id, req.user!.companyId, role.name]);
    
    if (Array.isArray(role.permissions)) {
      for (const permId of role.permissions) {
        await client.query('INSERT INTO role_permissions ("roleId", "permissionId") VALUES ($1, $2)', [role.id, permId]);
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(role);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

companyRouter.delete('/roles/:id', async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    await client.query('DELETE FROM role_permissions WHERE "roleId" = $1', [id]);
    await client.query('DELETE FROM roles WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await client.query('COMMIT');
    res.status(204).send();
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

companyRouter.get('/users', async (req, res, next) => {
  try {
    const usersRes = await req.db.query('SELECT id, email, role, name, status, "lastLogin" FROM users WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(usersRes.rows);
  } catch (error) {
    next(error);
  }
});

companyRouter.post('/users', async (req, res, next) => {
  try {
    const { id, email, password, role, name, status } = req.body;
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    await req.db.query('INSERT INTO users (id, "companyId", email, password, role, name, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, req.user!.companyId, email, hashedPassword, role, name, status || 'Active']);
    res.status(201).json({ id, companyId: req.user!.companyId, email, role, name, status: status || 'Active' });
  } catch (error) {
    next(error);
  }
});

companyRouter.put('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, role, name, status } = req.body;
    await req.db.query('UPDATE users SET email = $1, role = $2, name = $3, status = $4 WHERE id = $5 AND "companyId" = $6',
      [email, role, name, status, id, req.user!.companyId]);
    res.json({ id, companyId: req.user!.companyId, email, role, name, status });
  } catch (error) {
    next(error);
  }
});

companyRouter.delete('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM users WHERE id = $1 AND "companyId" = $2 AND role != $3', [id, req.user!.companyId, 'super_admin']);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
