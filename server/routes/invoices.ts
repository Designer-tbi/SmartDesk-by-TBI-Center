import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth, requireCompany);

invoicesRouter.get('/quote-templates', async (req, res, next) => {
  try {
    const templatesRes = await req.db.query('SELECT * FROM quote_templates WHERE "companyId" = $1', [req.user!.companyId]);
    const templates = templatesRes.rows;
    
    const templatesWithItems = await Promise.all(templates.map(async (tmpl: any) => {
      const itemsRes = await req.db.query('SELECT * FROM quote_template_items WHERE "templateId" = $1', [tmpl.id]);
      return { ...tmpl, items: itemsRes.rows };
    }));
    
    res.json(templatesWithItems);
  } catch (error) {
    next(error);
  }
});

invoicesRouter.post('/quote-templates', async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const tmpl = req.body;
    
    await client.query('BEGIN');
    
    await client.query(
      'INSERT INTO quote_templates (id, "companyId", name, notes) VALUES ($1, $2, $3, $4)',
      [tmpl.id, req.user!.companyId, tmpl.name, tmpl.notes || null]
    );
    
    if (Array.isArray(tmpl.items)) {
      for (const item of tmpl.items) {
        await client.query(
          'INSERT INTO quote_template_items ("templateId", "productId", name, description, quantity, price, "tvaRate", "tvaAmount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [tmpl.id, item.productId, item.name, item.description || null, item.quantity, item.price, item.tvaRate, item.tvaAmount]
        );
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(tmpl);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

invoicesRouter.delete('/quote-templates/:id', async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    await client.query('DELETE FROM quote_template_items WHERE "templateId" = $1', [id]);
    await client.query('DELETE FROM quote_templates WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await client.query('COMMIT');
    
    res.status(204).send();
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

invoicesRouter.get('/', async (req, res, next) => {
  try {
    const invoicesRes = await req.db.query('SELECT * FROM invoices WHERE "companyId" = $1', [req.user!.companyId]);
    const invoices = invoicesRes.rows;
    
    const invoicesWithItems = await Promise.all(invoices.map(async (inv: any) => {
      const itemsRes = await req.db.query('SELECT * FROM invoice_items WHERE "invoiceId" = $1', [inv.id]);
      return { ...inv, items: itemsRes.rows };
    }));
    
    res.json(invoicesWithItems);
  } catch (error) {
    next(error);
  }
});

invoicesRouter.post('/', async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const inv = req.body;
    
    await client.query('BEGIN');
    
    await client.query(
      'INSERT INTO invoices (id, "companyId", type, "contactId", date, "dueDate", "totalHT", "tvaTotal", total, status, notes, "signatureLink", "signedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
      [inv.id, req.user!.companyId, inv.type, inv.contactId, inv.date, inv.dueDate, inv.totalHT, inv.tvaTotal, inv.total, inv.status, inv.notes || null, inv.signatureLink || null, inv.signedAt || null]
    );
    
    if (Array.isArray(inv.items)) {
      for (const item of inv.items) {
        await client.query(
          'INSERT INTO invoice_items ("invoiceId", "productId", name, description, quantity, price, "tvaRate", "tvaAmount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [inv.id, item.productId, item.name, item.description || null, item.quantity, item.price, item.tvaRate, item.tvaAmount]
        );
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(inv);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

invoicesRouter.put('/:id', async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const { id } = req.params;
    const inv = req.body;
    
    await client.query('BEGIN');
    
    await client.query(
      'UPDATE invoices SET type = $1, "contactId" = $2, date = $3, "dueDate" = $4, "totalHT" = $5, "tvaTotal" = $6, total = $7, status = $8, notes = $9, "signatureLink" = $10, "signedAt" = $11 WHERE id = $12 AND "companyId" = $13',
      [inv.type, inv.contactId, inv.date, inv.dueDate, inv.totalHT, inv.tvaTotal, inv.total, inv.status, inv.notes || null, inv.signatureLink || null, inv.signedAt || null, id, req.user!.companyId]
    );
    
    await client.query('DELETE FROM invoice_items WHERE "invoiceId" = $1', [id]);
    
    if (Array.isArray(inv.items)) {
      for (const item of inv.items) {
        await client.query(
          'INSERT INTO invoice_items ("invoiceId", "productId", name, description, quantity, price, "tvaRate", "tvaAmount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [id, item.productId, item.name, item.description || null, item.quantity, item.price, item.tvaRate, item.tvaAmount]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json(inv);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

invoicesRouter.delete('/:id', async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    await client.query('DELETE FROM invoice_items WHERE "invoiceId" = $1', [id]);
    await client.query('DELETE FROM invoices WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await client.query('COMMIT');
    
    res.status(204).send();
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});
