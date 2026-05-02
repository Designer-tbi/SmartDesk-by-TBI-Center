import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';
import { getMailerForCompany } from '../services/mailer.js';

export const employeesRouter = Router();

employeesRouter.use(requireAuth, requireCompany);

employeesRouter.get('/leaves', async (req, res, next) => {
  try {
    const leavesRes = await req.db.query('SELECT * FROM leave_requests WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(leavesRes.rows);
  } catch (error) {
    next(error);
  }
});

employeesRouter.post('/leaves', async (req, res, next) => {
  try {
    const leave = req.body;
    await req.db.query(
      'INSERT INTO leave_requests (id, "companyId", "employeeId", type, "startDate", "endDate", status, reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [leave.id, req.user!.companyId, leave.employeeId, leave.type, leave.startDate, leave.endDate, leave.status, leave.reason || null]
    );
    res.status(201).json(leave);
  } catch (error) {
    next(error);
  }
});

employeesRouter.put('/leaves/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const leave = req.body;
    await req.db.query(
      'UPDATE leave_requests SET "employeeId" = $1, type = $2, "startDate" = $3, "endDate" = $4, status = $5, reason = $6 WHERE id = $7 AND "companyId" = $8',
      [leave.employeeId, leave.type, leave.startDate, leave.endDate, leave.status, leave.reason || null, id, req.user!.companyId]
    );
    res.json(leave);
  } catch (error) {
    next(error);
  }
});

employeesRouter.delete('/leaves/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM leave_requests WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

employeesRouter.get('/payslips', async (req, res, next) => {
  try {
    const payslipsRes = await req.db.query('SELECT * FROM payslips WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(payslipsRes.rows);
  } catch (error) {
    next(error);
  }
});

employeesRouter.post('/payslips', async (req, res, next) => {
  try {
    const payslip = req.body;
    await req.db.query(
      'INSERT INTO payslips (id, "companyId", "employeeId", month, year, "baseSalary", bonuses, deductions, "netSalary", status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [payslip.id, req.user!.companyId, payslip.employeeId, payslip.month, payslip.year, payslip.baseSalary, payslip.bonuses, payslip.deductions, payslip.netSalary, payslip.status]
    );
    res.status(201).json(payslip);
  } catch (error) {
    next(error);
  }
});

employeesRouter.put('/payslips/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const payslip = req.body;
    await req.db.query(
      'UPDATE payslips SET "employeeId" = $1, month = $2, year = $3, "baseSalary" = $4, bonuses = $5, deductions = $6, "netSalary" = $7, status = $8 WHERE id = $9 AND "companyId" = $10',
      [payslip.employeeId, payslip.month, payslip.year, payslip.baseSalary, payslip.bonuses, payslip.deductions, payslip.netSalary, payslip.status, id, req.user!.companyId]
    );
    res.json(payslip);
  } catch (error) {
    next(error);
  }
});

employeesRouter.delete('/payslips/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM payslips WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

employeesRouter.get('/contracts', async (req, res, next) => {
  try {
    const contractsRes = await req.db.query('SELECT * FROM contracts WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(contractsRes.rows);
  } catch (error) {
    next(error);
  }
});

employeesRouter.post('/contracts', async (req, res, next) => {
  try {
    const contract = req.body;
    await req.db.query(
      'INSERT INTO contracts (id, "companyId", "employeeId", type, "startDate", "endDate", salary, status, content, "createdAt", "signatureLink", "signedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [contract.id, req.user!.companyId, contract.employeeId, contract.type, contract.startDate, contract.endDate || null, contract.salary, contract.status, contract.content, contract.createdAt, contract.signatureLink || null, contract.signedAt || null]
    );
    res.status(201).json(contract);
  } catch (error) {
    next(error);
  }
});

employeesRouter.put('/contracts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const contract = req.body;
    await req.db.query(
      'UPDATE contracts SET "employeeId" = $1, type = $2, "startDate" = $3, "endDate" = $4, salary = $5, status = $6, content = $7, "signatureLink" = $8, "signedAt" = $9 WHERE id = $10 AND "companyId" = $11',
      [contract.employeeId, contract.type, contract.startDate, contract.endDate || null, contract.salary, contract.status, contract.content, contract.signatureLink || null, contract.signedAt || null, id, req.user!.companyId]
    );
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

employeesRouter.delete('/contracts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM contracts WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Send the contract to the employee by email with a public signature link.
 *
 * Mirrors the invoice "Envoyer" flow: builds the public URL from the
 * request's Origin (so it works in dev / preview / production), updates the
 * contract status to 'Sent', and dispatches the message via the per-tenant
 * mailer (OVH SMTP for demo accounts, regular SMTP for production).
 */
employeesRouter.post('/contracts/:id/send-email', async (req, res, next) => {
  try {
    const { id } = req.params;

    const cRes = await req.db.query(
      'SELECT * FROM contracts WHERE id = $1 AND "companyId" = $2',
      [id, req.user!.companyId],
    );
    const contract = cRes.rows[0];
    if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });

    const eRes = await req.db.query(
      'SELECT * FROM employees WHERE id = $1 AND "companyId" = $2',
      [contract.employeeId, req.user!.companyId],
    );
    const employee = eRes.rows[0];
    if (!employee) return res.status(404).json({ error: 'Employé introuvable' });
    if (!employee.email) {
      return res.status(400).json({ error: 'Aucune adresse email pour cet employé.' });
    }

    const compRes = await req.db.query(
      'SELECT * FROM companies WHERE id = $1',
      [req.user!.companyId],
    );
    const company = compRes.rows[0];

    const reqOrigin =
      (req.headers.origin as string | undefined) ||
      (req.headers.referer ? new URL(req.headers.referer as string).origin : undefined);
    const baseUrl =
      reqOrigin ||
      process.env.PUBLIC_BASE_URL ||
      process.env.REACT_APP_BACKEND_URL ||
      'https://smart-desk.pro';
    const signatureLink = `${baseUrl}/sign-contract/${id}`;

    const { transporter, from } = getMailerForCompany(company.type, company.name);
    const fmt = (n: number) => `${Number(n || 0).toLocaleString()} ${company.currency || ''}`;

    // Validate the recipient before flipping the contract to "Sent" and
    // before incurring an SMTP round-trip. A simple syntactic check is
    // enough — the mail server still has the final word.
    const emailLooksValid = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(employee.email);
    if (!emailLooksValid) {
      return res.status(400).json({
        error: `Adresse email invalide pour ${employee.name} : "${employee.email}". Mettez à jour la fiche employé avant d'envoyer.`,
      });
    }

    // Stamp the contract as "Sent" + link FIRST so that even if the SMTP
    // server is slow, the recipient still sees a Sent contract when the
    // email is finally delivered. We rollback the status if delivery
    // fails outright (e.g. domain rejected) so the user can fix the
    // email and retry.
    await req.db.query(
      `UPDATE contracts
          SET status = 'Sent', "signatureLink" = $1
        WHERE id = $2 AND "companyId" = $3`,
      [signatureLink, id, req.user!.companyId],
    );

    const subject = `Contrat ${contract.type} – ${company.name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color: #111827; margin-bottom: 4px;">Contrat à signer</h2>
        <p style="color: #6b7280; margin-top: 0;">Émis par <strong>${company.name}</strong></p>
        <p>Bonjour <strong>${employee.name}</strong>,</p>
        <p>
          Veuillez trouver ci-dessous votre contrat de travail
          (<strong>${contract.type}</strong>). Pour le valider, cliquez sur
          le bouton ci-dessous et apposez votre signature manuscrite.
        </p>
        <table style="border-collapse: collapse; margin: 18px 0; font-size: 14px;">
          <tr>
            <td style="padding: 4px 12px 4px 0; color: #6b7280;">Type</td>
            <td style="padding: 4px 0; font-weight: bold;">${contract.type}</td>
          </tr>
          <tr>
            <td style="padding: 4px 12px 4px 0; color: #6b7280;">Date d'effet</td>
            <td style="padding: 4px 0; font-weight: bold;">${contract.startDate || '—'}</td>
          </tr>
          ${contract.endDate ? `<tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Date de fin</td><td style="padding: 4px 0; font-weight: bold;">${contract.endDate}</td></tr>` : ''}
          <tr>
            <td style="padding: 4px 12px 4px 0; color: #6b7280;">Rémunération</td>
            <td style="padding: 4px 0; font-weight: bold;">${fmt(contract.salary)}</td>
          </tr>
        </table>
        <p style="margin: 24px 0; text-align: center;">
          <a href="${signatureLink}"
             style="display: inline-block; padding: 14px 28px; background: #dc2626;
                    color: #ffffff; border-radius: 12px; text-decoration: none;
                    font-weight: bold;">
            Consulter & signer mon contrat
          </a>
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Cet email a été envoyé automatiquement. Si vous n'attendiez pas
          ce contrat, merci de contacter ${company.email || company.name}.
        </p>
      </div>
    `;
    const text =
      `Bonjour ${employee.name},\n\n` +
      `Vous avez un nouveau contrat ${contract.type} à signer.\n` +
      `Lien de signature : ${signatureLink}\n\n` +
      `${company.name}`;

    try {
      await transporter.sendMail({
        from,
        to: employee.email,
        subject,
        html,
        text,
      });
    } catch (mailErr: any) {
      // Mail server rejected the recipient (typo, sandbox domain…).
      // Rollback the status so the user can fix the address and retry.
      await req.db.query(
        `UPDATE contracts SET status = $1 WHERE id = $2 AND "companyId" = $3`,
        [contract.status || 'Draft', id, req.user!.companyId],
      );
      console.error('Contract email delivery failed:', mailErr?.message || mailErr);
      const detail = mailErr?.response || mailErr?.message || 'Échec de l’envoi.';
      return res.status(502).json({
        error: `Le serveur de messagerie a refusé la livraison à ${employee.email}.`,
        detail,
      });
    }

    res.json({ ok: true, signatureLink });
  } catch (error) {
    console.error('POST /contracts/:id/send-email failed', error);
    next(error);
  }
});

employeesRouter.get('/contract-templates', async (req, res, next) => {
  try {
    const templatesRes = await req.db.query('SELECT * FROM contract_templates WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(templatesRes.rows);
  } catch (error) {
    next(error);
  }
});

employeesRouter.post('/contract-templates', async (req, res, next) => {
  try {
    const template = req.body;
    await req.db.query(
      'INSERT INTO contract_templates (id, "companyId", name, type, content, "lastModified") VALUES ($1, $2, $3, $4, $5, $6)',
      [template.id, req.user!.companyId, template.name, template.type, template.content, template.lastModified]
    );
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

employeesRouter.put('/contract-templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = req.body;
    await req.db.query(
      'UPDATE contract_templates SET name = $1, type = $2, content = $3, "lastModified" = $4 WHERE id = $5 AND "companyId" = $6',
      [template.name, template.type, template.content, template.lastModified, id, req.user!.companyId]
    );
    res.json(template);
  } catch (error) {
    next(error);
  }
});

employeesRouter.delete('/contract-templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM contract_templates WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

employeesRouter.get('/tasks', async (req, res, next) => {
  try {
    const tasksRes = await req.db.query('SELECT * FROM employee_tasks WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(tasksRes.rows);
  } catch (error) {
    next(error);
  }
});

employeesRouter.post('/tasks', async (req, res, next) => {
  try {
    const task = req.body;
    await req.db.query(
      'INSERT INTO employee_tasks (id, "companyId", "employeeId", title, description, date, "startTime", "endTime", status, priority) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [task.id, req.user!.companyId, task.employeeId, task.title, task.description || null, task.date, task.startTime || null, task.endTime || null, task.status || 'Todo', task.priority || 'Medium']
    );
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

employeesRouter.put('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = req.body;
    await req.db.query(
      'UPDATE employee_tasks SET "employeeId" = $1, title = $2, description = $3, date = $4, "startTime" = $5, "endTime" = $6, status = $7, priority = $8 WHERE id = $9 AND "companyId" = $10',
      [task.employeeId, task.title, task.description || null, task.date, task.startTime || null, task.endTime || null, task.status || 'Todo', task.priority || 'Medium', id, req.user!.companyId]
    );
    res.json(task);
  } catch (error) {
    next(error);
  }
});

employeesRouter.delete('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM employee_tasks WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

employeesRouter.get('/', async (req, res, next) => {
  try {
    const employeesRes = await req.db.query('SELECT * FROM employees WHERE "companyId" = $1', [req.user!.companyId]);
    const employees = employeesRes.rows.map((emp: any) => ({
      ...emp,
      documents: emp.documents ? JSON.parse(emp.documents) : []
    }));
    res.json(employees);
  } catch (error) {
    next(error);
  }
});

employeesRouter.post('/', async (req, res, next) => {
  try {
    const emp = req.body;
    const documentsStr = emp.documents ? JSON.stringify(emp.documents) : null;
    await req.db.query('INSERT INTO employees (id, "companyId", name, role, department, email, phone, address, status, "contractType", "joinDate", salary, "profilePicture", documents) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
      [emp.id, req.user!.companyId, emp.name, emp.role, emp.department, emp.email, emp.phone, emp.address, emp.status, emp.contractType, emp.joinDate, emp.salary, emp.profilePicture || null, documentsStr]);
    res.status(201).json(emp);
  } catch (error) {
    next(error);
  }
});

employeesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const emp = req.body;
    const documentsStr = emp.documents ? JSON.stringify(emp.documents) : null;
    await req.db.query('UPDATE employees SET name = $1, role = $2, department = $3, email = $4, phone = $5, address = $6, status = $7, "contractType" = $8, "joinDate" = $9, salary = $10, "profilePicture" = $11, documents = $12 WHERE id = $13 AND "companyId" = $14',
      [emp.name, emp.role, emp.department, emp.email, emp.phone, emp.address, emp.status, emp.contractType, emp.joinDate, emp.salary, emp.profilePicture || null, documentsStr, id, req.user!.companyId]);
    res.json(emp);
  } catch (error) {
    next(error);
  }
});

employeesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    try {
      await req.db.query('BEGIN');
      
      // Delete child records first to avoid NO ACTION foreign key constraints
      const tablesReferencingEmployees = [
        'employee_tasks',
        'leave_requests',
        'payslips',
        'contracts'
      ];
      
      for (const table of tablesReferencingEmployees) {
        await req.db.query(`DELETE FROM public.${table} WHERE "employeeId" = $1`, [id]);
      }

      await req.db.query('DELETE FROM employees WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
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
