import { Router } from 'express';
import { requireTenant } from '../middleware/auth.js';

export const accountingRouter = Router();

accountingRouter.get('/transactions', ...requireTenant, async (req, res, next) => {
  try {
    const transactions = await req.db.query('SELECT * FROM transactions WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(transactions.rows);
  } catch (error) {
    next(error);
  }
});

accountingRouter.get('/journal-entries', ...requireTenant, async (req, res, next) => {
  try {
    const entriesRes = await req.db.query('SELECT * FROM journal_entries WHERE "companyId" = $1', [req.user!.companyId]);
    const entries = entriesRes.rows;
    
    const entriesWithItems = await Promise.all(entries.map(async (entry: any) => {
      const itemsRes = await req.db.query('SELECT * FROM journal_items WHERE "journalEntryId" = $1 AND "companyId" = $2', [entry.id, req.user!.companyId]);
      return { ...entry, items: itemsRes.rows };
    }));
    
    res.json(entriesWithItems);
  } catch (error) {
    next(error);
  }
});

accountingRouter.post('/journal-entries', ...requireTenant, async (req, res, next) => {
  try {
    const entry = req.body;
    
    await req.db.query('BEGIN');
    
    await req.db.query(
      'INSERT INTO journal_entries (id, "companyId", date, description) VALUES ($1, $2, $3, $4)',
      [entry.id, req.user!.companyId, entry.date, entry.description]
    );
    
    if (Array.isArray(entry.items)) {
      for (const item of entry.items) {
        await req.db.query(
          'INSERT INTO journal_items ("companyId", "journalEntryId", "accountId", debit, credit) VALUES ($1, $2, $3, $4, $5)',
          [req.user!.companyId, entry.id, item.accountId, item.debit, item.credit]
        );
      }
    }
    
    await req.db.query('COMMIT');
    res.status(201).json(entry);
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

accountingRouter.put('/journal-entries/:id', ...requireTenant, async (req, res, next) => {
  try {
    const { id } = req.params;
    const entry = req.body;
    
    await req.db.query('BEGIN');
    
    await req.db.query(
      'UPDATE journal_entries SET date = $1, description = $2 WHERE id = $3 AND "companyId" = $4',
      [entry.date, entry.description, id, req.user!.companyId]
    );
    
    await req.db.query('DELETE FROM journal_items WHERE "journalEntryId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    
    if (Array.isArray(entry.items)) {
      for (const item of entry.items) {
        await req.db.query(
          'INSERT INTO journal_items ("companyId", "journalEntryId", "accountId", debit, credit) VALUES ($1, $2, $3, $4, $5)',
          [req.user!.companyId, id, item.accountId, item.debit, item.credit]
        );
      }
    }
    
    await req.db.query('COMMIT');
    res.json(entry);
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

accountingRouter.delete('/journal-entries/:id', ...requireTenant, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await req.db.query('BEGIN');
    await req.db.query('DELETE FROM journal_items WHERE "journalEntryId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('DELETE FROM journal_entries WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('COMMIT');
    
    res.status(204).send();
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

accountingRouter.post('/reset', ...requireTenant, async (req, res, next) => {
  try {
    const companyId = req.user!.companyId;
    
    await req.db.query('BEGIN');
    
    // Delete journal items first due to foreign key
    await req.db.query(`
      DELETE FROM journal_items 
      WHERE "journalEntryId" IN (SELECT id FROM journal_entries WHERE "companyId" = $1)
    `, [companyId]);
    
    await req.db.query('DELETE FROM journal_entries WHERE "companyId" = $1', [companyId]);
    await req.db.query('DELETE FROM transactions WHERE "companyId" = $1', [companyId]);
    
    // Delete invoice items first due to foreign key
    await req.db.query(`
      DELETE FROM invoice_items 
      WHERE "invoiceId" IN (SELECT id FROM invoices WHERE "companyId" = $1)
    `, [companyId]);
    
    await req.db.query('DELETE FROM invoices WHERE "companyId" = $1', [companyId]);
    
    await req.db.query('COMMIT');
    res.json({ message: 'Accounting data reset successfully' });
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});
