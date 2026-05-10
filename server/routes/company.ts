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
    const {
      country, city, currency, accountingStandard, language, fiscalizationApiKey,
      // Extended company profile
      name, logo, taxId, rccm, idNat, niu, legalForm, capital,
      address, phone, email, website,
      representativeName, representativeRole,
      cnssEmployerRate, cnssEmployeeRate,
    } = req.body || {};

    const isCongo = String(country || '').toUpperCase() === 'CG';
    // SFEC key is Congo-specific (DGID Congo) and now OPTIONAL — users can
    // skip it during onboarding and configure it later from Settings.
    // For RDC (CD) and France (FR) we never ask for one.
    const trimmedKey = fiscalizationApiKey ? String(fiscalizationApiKey).trim() : '';
    if (isCongo && trimmedKey && trimmedKey.length < 16) {
      return res.status(400).json({ error: 'Clé API SFEC invalide (16+ caractères requis).' });
    }

    await req.db.query(
      `UPDATE public.companies SET
         country = COALESCE($1, country),
         city = COALESCE($2, city),
         currency = COALESCE($3, currency),
         "accountingStandard" = COALESCE($4, "accountingStandard"),
         language = COALESCE($5, language),
         "fiscalizationApiKey" = CASE WHEN $6 = '' THEN "fiscalizationApiKey" ELSE $6 END,
         name = COALESCE($7, name),
         logo = COALESCE($8, logo),
         "taxId" = COALESCE($9, "taxId"),
         rccm = COALESCE($10, rccm),
         "idNat" = COALESCE($11, "idNat"),
         niu = COALESCE($12, niu),
         "legalForm" = COALESCE($13, "legalForm"),
         capital = COALESCE($14, capital),
         address = COALESCE($15, address),
         phone = COALESCE($16, phone),
         email = COALESCE($17, email),
         website = COALESCE($18, website),
         "representativeName" = COALESCE($19, "representativeName"),
         "representativeRole" = COALESCE($20, "representativeRole"),
         "cnssEmployerRate" = COALESCE($21, "cnssEmployerRate"),
         "cnssEmployeeRate" = COALESCE($22, "cnssEmployeeRate"),
         "onboardingCompleted" = TRUE
       WHERE id = $23`,
      [
        country || null,
        city || null,
        currency || null,
        accountingStandard || null,
        language || null,
        trimmedKey,
        name || null,
        logo || null,
        taxId || null,
        rccm || null,
        idNat || null,
        niu || null,
        legalForm || null,
        Number.isFinite(Number(capital)) && capital !== '' ? Number(capital) : null,
        address || null,
        phone || null,
        email || null,
        website || null,
        representativeName || null,
        representativeRole || null,
        Number.isFinite(Number(cnssEmployerRate)) && cnssEmployerRate !== '' ? Number(cnssEmployerRate) : null,
        Number.isFinite(Number(cnssEmployeeRate)) && cnssEmployeeRate !== '' ? Number(cnssEmployeeRate) : null,
        req.user!.companyId,
      ],
    );
    const r = await req.db.query('SELECT * FROM public.companies WHERE id = $1', [req.user!.companyId]);
    const { fiscalizationApiKey: storedKey, ...safe } = r.rows[0] || {};
    res.json({ ...safe, hasFiscalizationKey: !!storedKey, onboardingCompleted: true });
  } catch (error) {
    next(error);
  }
});

companyRouter.put('/', async (req, res, next) => {
  try {
    const {
      name, taxId, rccm, idNat, niu, siren, siret, email, phone, website, address,
      country, state, city, logo, accountingStandard, language, currency,
      legalForm, capital, representativeName, representativeRole,
      cnssEmployerRate, cnssEmployeeRate,
    } = req.body;
    console.log('Updating company for user:', req.user!.id, 'companyId:', req.user!.companyId);
    const result = await req.db.query(
      `UPDATE public.companies SET
        name = $1, "taxId" = $2, rccm = $3, "idNat" = $4, niu = $5, siren = $6, siret = $7,
        email = $8, phone = $9, website = $10, address = $11, country = $12, state = $13,
        logo = $14, "accountingStandard" = $15, language = $16, currency = $17, city = $18,
        "legalForm" = $19, capital = $20,
        "representativeName" = $21, "representativeRole" = $22,
        "cnssEmployerRate" = $23, "cnssEmployeeRate" = $24
      WHERE id = $25`,
      [
        name, taxId, rccm, idNat, niu, siren, siret, email, phone, website, address,
        country || 'AFRIQUE', state, logo || null, accountingStandard || 'OHADA',
        language || 'fr', currency || 'XAF', city || null,
        legalForm || null,
        Number.isFinite(Number(capital)) && capital !== '' && capital !== null ? Number(capital) : null,
        representativeName || null, representativeRole || null,
        Number.isFinite(Number(cnssEmployerRate)) && cnssEmployerRate !== '' && cnssEmployerRate !== null ? Number(cnssEmployerRate) : null,
        Number.isFinite(Number(cnssEmployeeRate)) && cnssEmployeeRate !== '' && cnssEmployeeRate !== null ? Number(cnssEmployeeRate) : null,
        req.user!.companyId,
      ],
    );
    
    console.log('Update result rows affected:', result.rowCount);

    const updatedCompanyRes = await req.db.query('SELECT * FROM public.companies WHERE id = $1', [req.user!.companyId]);
    const updatedCompany = updatedCompanyRes.rows[0];
    if (!updatedCompany) {
      console.error('Company not found after update for id:', req.user!.companyId);
      return res.status(404).json({ error: 'Company not found' });
    }
    // Never echo the raw fiscalization API key.
    const { fiscalizationApiKey, ...safe } = updatedCompany;
    res.json({ ...safe, hasFiscalizationKey: !!fiscalizationApiKey });
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
