import { Router } from 'express';
import { requireTenant } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

export const companyRouter = Router();

companyRouter.use(...requireTenant);

companyRouter.get('/', async (req, res, next) => {
  try {
    const companyRes = await req.db.query('SELECT * FROM public.companies WHERE id = $1', [req.user!.companyId]);
    const company = companyRes.rows[0];
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    // Never echo the raw fiscalization API key — return only a flag.
    const { fiscalizationApiKey, ...safe } = company;
    res.json({ ...safe, hasFiscalizationKey: !!fiscalizationApiKey });
  } catch (error) {
    next(error);
  }
});

/**
 * First-login onboarding wizard. Persists the company's preferred country,
 * city, currency, accounting standard, language and DGID/SFEC API key, and
 * marks `onboardingCompleted = true` so the wizard no longer shows up.
 *
 * The API key is stored verbatim — it isolates each company even when
 * multiple admins share the platform.
 */
companyRouter.post('/onboarding', async (req, res, next) => {
  try {
    const { country, city, currency, accountingStandard, language, fiscalizationApiKey } = req.body || {};
    if (!fiscalizationApiKey || String(fiscalizationApiKey).trim().length < 16) {
      return res.status(400).json({ error: 'Clé API SFEC requise (32+ caractères).' });
    }
    await req.db.query(
      `UPDATE public.companies SET
         country = COALESCE($1, country),
         city = COALESCE($2, city),
         currency = COALESCE($3, currency),
         "accountingStandard" = COALESCE($4, "accountingStandard"),
         language = COALESCE($5, language),
         "fiscalizationApiKey" = $6,
         "onboardingCompleted" = TRUE
       WHERE id = $7`,
      [
        country || null,
        city || null,
        currency || null,
        accountingStandard || null,
        language || null,
        String(fiscalizationApiKey).trim(),
        req.user!.companyId,
      ],
    );
    const r = await req.db.query('SELECT * FROM public.companies WHERE id = $1', [req.user!.companyId]);
    const { fiscalizationApiKey: _drop, ...safe } = r.rows[0] || {};
    res.json({ ...safe, hasFiscalizationKey: true, onboardingCompleted: true });
  } catch (error) {
    next(error);
  }
});

companyRouter.put('/', async (req, res, next) => {
  try {
    const { name, taxId, rccm, idNat, niu, siren, siret, email, phone, website, address, country, state, city, logo, accountingStandard, language, currency } = req.body;
    console.log('Updating company for user:', req.user!.id, 'companyId:', req.user!.companyId);
    const result = await req.db.query('UPDATE public.companies SET name = $1, "taxId" = $2, rccm = $3, "idNat" = $4, niu = $5, siren = $6, siret = $7, email = $8, phone = $9, website = $10, address = $11, country = $12, state = $13, logo = $14, "accountingStandard" = $15, language = $16, currency = $17, city = $18 WHERE id = $19',
      [name, taxId, rccm, idNat, niu, siren, siret, email, phone, website, address, country || 'AFRIQUE', state, logo || null, accountingStandard || 'OHADA', language || 'fr', currency || 'XAF', city || null, req.user!.companyId]);
    
    console.log('Update result rows affected:', result.rowCount);

    const updatedCompanyRes = await req.db.query('SELECT * FROM public.companies WHERE id = $1', [req.user!.companyId]);
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
  try {
    await req.db.query('BEGIN');
    
    // Delete data for the current company only
    await req.db.query('DELETE FROM invoice_items WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM invoices WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM contacts WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM products WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM projects WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM events WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM schedules WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM activity_log WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM employee_tasks WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM employees WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM leave_requests WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM payslips WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM contracts WHERE "companyId" = $1', [req.user!.companyId]);
    
    await req.db.query('COMMIT');
    res.json({ message: 'CRM data reset successfully' });
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

companyRouter.post('/reset-accounting', async (req, res, next) => {
  try {
    await req.db.query('BEGIN');
    
    // Delete accounting data for the current company only
    await req.db.query('DELETE FROM journal_items WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM journal_entries WHERE "companyId" = $1', [req.user!.companyId]);
    await req.db.query('DELETE FROM transactions WHERE "companyId" = $1', [req.user!.companyId]);
    
    await req.db.query('COMMIT');
    res.json({ message: 'Accounting data reset successfully' });
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
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
  try {
    const role = req.body;
    await req.db.query('BEGIN');
    
    await req.db.query('INSERT INTO roles (id, name, "companyId") VALUES ($1, $2, $3)', [role.id, role.name, req.user!.companyId]);
    
    if (Array.isArray(role.permissions)) {
      for (const permId of role.permissions) {
        await req.db.query('INSERT INTO role_permissions ("roleId", "permissionId") VALUES ($1, $2)', [role.id, permId]);
      }
    }
    
    await req.db.query('COMMIT');
    res.status(201).json(role);
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

companyRouter.put('/roles/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body;
    await req.db.query('BEGIN');
    
    const roleCheck = await req.db.query('SELECT id FROM roles WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    if (roleCheck.rows.length === 0) {
      await req.db.query('ROLLBACK');
      return res.status(404).json({ error: 'Role not found' });
    }
    
    await req.db.query('UPDATE roles SET name = $1 WHERE id = $2 AND "companyId" = $3', [name, id, req.user!.companyId]);
    await req.db.query('DELETE FROM role_permissions WHERE "roleId" = $1', [id]);
    
    if (Array.isArray(permissions)) {
      for (const permId of permissions) {
        await req.db.query('INSERT INTO role_permissions ("roleId", "permissionId") VALUES ($1, $2)', [id, permId]);
      }
    }
    
    await req.db.query('COMMIT');
    res.json({ id, name, permissions });
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

companyRouter.delete('/roles/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('BEGIN');
    // Ensure role belongs to company
    const roleCheck = await req.db.query('SELECT id FROM roles WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    if (roleCheck.rows.length === 0) {
      await req.db.query('ROLLBACK');
      return res.status(404).json({ error: 'Role not found' });
    }
    
    await req.db.query('DELETE FROM role_permissions WHERE "roleId" = $1', [id]);
    await req.db.query('DELETE FROM roles WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('COMMIT');
    res.status(204).send();
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

companyRouter.get('/users', async (req, res, next) => {
  try {
    const usersRes = await req.db.query('SELECT id, email, role, name, status, "lastLogin" FROM public.users WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(usersRes.rows);
  } catch (error) {
    next(error);
  }
});

companyRouter.post('/users', async (req, res, next) => {
  try {
    const { id, email, password, role, name, status } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await req.db.query('INSERT INTO public.users (id, "companyId", email, password, role, name, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
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
    await req.db.query('UPDATE public.users SET email = $1, role = $2, name = $3, status = $4 WHERE id = $5 AND "companyId" = $6',
      [email, role, name, status, id, req.user!.companyId]);
    res.json({ id, companyId: req.user!.companyId, email, role, name, status });
  } catch (error) {
    next(error);
  }
});

companyRouter.delete('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
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
        if (table === 'events') {
          await req.db.query(`DELETE FROM public.events WHERE "userId" = $1 OR "assignedTo" = $1`, [id]);
        } else if (table === 'schedules') {
          await req.db.query(`DELETE FROM public.schedules WHERE "userId" = $1 OR "createdBy" = $1`, [id]);
        } else {
          await req.db.query(`DELETE FROM public.${table} WHERE "userId" = $1`, [id]);
        }
      }

      await req.db.query('DELETE FROM public.users WHERE id = $1 AND "companyId" = $2 AND role != $3', [id, req.user!.companyId, 'super_admin']);
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
