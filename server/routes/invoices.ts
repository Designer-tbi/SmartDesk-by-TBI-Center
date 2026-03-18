import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';
import nodemailer from 'nodemailer';

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth, requireCompany);

invoicesRouter.get('/quote-templates', async (req, res, next) => {
  try {
    const templatesRes = await req.db.query('SELECT * FROM quote_templates WHERE "companyId" = $1', [req.user!.companyId]);
    const templates = templatesRes.rows;
    
    const templatesWithItems = await Promise.all(templates.map(async (tmpl: any) => {
      const itemsRes = await req.db.query('SELECT * FROM quote_template_items WHERE "templateId" = $1 AND "companyId" = $2', [tmpl.id, req.user!.companyId]);
      return { ...tmpl, items: itemsRes.rows };
    }));
    
    res.json(templatesWithItems);
  } catch (error) {
    next(error);
  }
});

invoicesRouter.post('/quote-templates', async (req, res, next) => {
  try {
    const tmpl = req.body;
    
    await req.db.query('BEGIN');
    
    await req.db.query(
      'INSERT INTO quote_templates (id, "companyId", name, notes) VALUES ($1, $2, $3, $4)',
      [tmpl.id, req.user!.companyId, tmpl.name, tmpl.notes || null]
    );
    
    if (Array.isArray(tmpl.items)) {
      for (const item of tmpl.items) {
        await req.db.query(
          'INSERT INTO quote_template_items ("companyId", "templateId", "productId", name, description, quantity, price, "tvaRate", "tvaAmount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [req.user!.companyId, tmpl.id, item.productId, item.name, item.description || null, item.quantity, item.price, item.tvaRate, item.tvaAmount]
        );
      }
    }
    
    await req.db.query('COMMIT');
    res.status(201).json(tmpl);
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

invoicesRouter.delete('/quote-templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await req.db.query('BEGIN');
    await req.db.query('DELETE FROM quote_template_items WHERE "templateId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('DELETE FROM quote_templates WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('COMMIT');
    
    res.status(204).send();
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

invoicesRouter.get('/', async (req, res, next) => {
  try {
    const invoicesRes = await req.db.query('SELECT * FROM invoices WHERE "companyId" = $1', [req.user!.companyId]);
    const invoices = invoicesRes.rows;
    
    const invoicesWithItems = await Promise.all(invoices.map(async (inv: any) => {
      const itemsRes = await req.db.query('SELECT * FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2', [inv.id, req.user!.companyId]);
      return { ...inv, items: itemsRes.rows };
    }));
    
    res.json(invoicesWithItems);
  } catch (error) {
    next(error);
  }
});

invoicesRouter.post('/', async (req, res, next) => {
  try {
    const inv = req.body;
    
    await req.db.query('BEGIN');
    
    await req.db.query(
      'INSERT INTO invoices (id, "companyId", type, "contactId", date, "dueDate", "totalHT", "tvaTotal", total, status, notes, "signatureLink", "signedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
      [inv.id, req.user!.companyId, inv.type, inv.contactId, inv.date, inv.dueDate, inv.totalHT, inv.tvaTotal, inv.total, inv.status, inv.notes || null, inv.signatureLink || null, inv.signedAt || null]
    );
    
    if (Array.isArray(inv.items)) {
      for (const item of inv.items) {
        await req.db.query(
          'INSERT INTO invoice_items ("companyId", "invoiceId", "productId", name, description, quantity, price, "tvaRate", "tvaAmount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [req.user!.companyId, inv.id, item.productId, item.name, item.description || null, item.quantity, item.price, item.tvaRate, item.tvaAmount]
        );
      }
    }
    
    await req.db.query('COMMIT');
    res.status(201).json(inv);
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

invoicesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const inv = req.body;
    
    await req.db.query('BEGIN');
    
    await req.db.query(
      'UPDATE invoices SET type = $1, "contactId" = $2, date = $3, "dueDate" = $4, "totalHT" = $5, "tvaTotal" = $6, total = $7, status = $8, notes = $9, "signatureLink" = $10, "signedAt" = $11 WHERE id = $12 AND "companyId" = $13',
      [inv.type, inv.contactId, inv.date, inv.dueDate, inv.totalHT, inv.tvaTotal, inv.total, inv.status, inv.notes || null, inv.signatureLink || null, inv.signedAt || null, id, req.user!.companyId]
    );
    
    await req.db.query('DELETE FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    
    if (Array.isArray(inv.items)) {
      for (const item of inv.items) {
        await req.db.query(
          'INSERT INTO invoice_items ("companyId", "invoiceId", "productId", name, description, quantity, price, "tvaRate", "tvaAmount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [req.user!.companyId, id, item.productId, item.name, item.description || null, item.quantity, item.price, item.tvaRate, item.tvaAmount]
        );
      }
    }
    
    await req.db.query('COMMIT');
    res.json(inv);
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

invoicesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await req.db.query('BEGIN');
    await req.db.query('DELETE FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('DELETE FROM invoices WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('COMMIT');
    
    res.status(204).send();
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

invoicesRouter.post('/:id/send-email', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 1. Fetch invoice and items
    const invoiceRes = await req.db.query('SELECT * FROM invoices WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    const invoice = invoiceRes.rows[0];
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    
    const itemsRes = await req.db.query('SELECT * FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    const items = itemsRes.rows;
    
    // 2. Fetch contact
    const contactRes = await req.db.query('SELECT * FROM contacts WHERE id = $1 AND "companyId" = $2', [invoice.contactId, req.user!.companyId]);
    const contact = contactRes.rows[0];
    if (!contact || !contact.email) return res.status(400).json({ error: 'Contact email not found' });
    
    // 3. Fetch company
    const companyRes = await req.db.query('SELECT * FROM companies WHERE id = $1', [req.user!.companyId]);
    const company = companyRes.rows[0];
    
    // 4. Configure nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "mail.tbi-center.fr",
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER || "demo@tbi-center.fr",
        pass: process.env.SMTP_PASS || "loub@ki2014D",
      },
    });
    
    const isQuote = invoice.type === 'Quote';
    const subject = isQuote ? `Devis ${invoice.id} - ${company.name}` : `Facture ${invoice.id} - ${company.name}`;
    
    const signatureBaseUrl = "https://smart-desk.pro";
    const signatureLink = invoice.signatureLink || (isQuote ? `${signatureBaseUrl}/sign-quote/${invoice.id}` : null);

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.price.toLocaleString()} ${company.currency}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.quantity * item.price).toLocaleString()} ${company.currency}</td>
      </tr>
    `).join('');

    const mailOptions = {
      from: `"${company.name}" <${process.env.SMTP_USER || "demo@tbi-center.fr"}>`,
      to: contact.email,
      subject: subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #4f46e5;">${isQuote ? 'Votre Devis' : 'Votre Facture'}</h2>
          <p>Bonjour ${contact.name},</p>
          <p>Veuillez trouver ci-joint les détails de votre ${isQuote ? 'devis' : 'facture'} <strong>${invoice.id}</strong>.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 8px; text-align: left;">Description</th>
                <th style="padding: 8px; text-align: center;">Qté</th>
                <th style="padding: 8px; text-align: right;">Prix Unitaire</th>
                <th style="padding: 8px; text-align: right;">Total HT</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="text-align: right; margin-top: 20px;">
            <p><strong>Total HT:</strong> ${invoice.totalHT.toLocaleString()} ${company.currency}</p>
            <p><strong>TVA:</strong> ${invoice.tvaTotal.toLocaleString()} ${company.currency}</p>
            <p style="font-size: 1.2em; color: #4f46e5;"><strong>Total TTC:</strong> ${invoice.total.toLocaleString()} ${company.currency}</p>
          </div>
          
          ${isQuote && signatureLink ? `
            <div style="margin-top: 30px; text-align: center;">
              <a href="${signatureLink}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Signer le devis en ligne</a>
            </div>
          ` : ''}
          
          <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;" />
          <p style="font-size: 0.8em; color: #64748b;">
            ${company.name}<br/>
            ${company.address || ''}<br/>
            ${company.phone || ''} | ${company.email || ''}
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    // Update status if it was Draft
    if (invoice.status === 'Draft') {
      await req.db.query('UPDATE invoices SET status = $1 WHERE id = $2 AND "companyId" = $3', ['Sent', id, req.user!.companyId]);
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
