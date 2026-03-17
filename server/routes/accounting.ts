import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const accountingRouter = Router();

accountingRouter.get('/transactions', requireAuth, requireCompany, async (req, res, next) => {
  try {
    const transactions = await req.db.query('SELECT * FROM transactions WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(transactions.rows);
  } catch (error) {
    next(error);
  }
});

accountingRouter.get('/journal-entries', requireAuth, requireCompany, async (req, res, next) => {
  try {
    const entriesRes = await req.db.query('SELECT * FROM journal_entries WHERE "companyId" = $1', [req.user!.companyId]);
    const entries = entriesRes.rows;
    
    const entriesWithItems = await Promise.all(entries.map(async (entry: any) => {
      const itemsRes = await req.db.query('SELECT * FROM journal_items WHERE "journalEntryId" = $1', [entry.id]);
      return { ...entry, items: itemsRes.rows };
    }));
    
    res.json(entriesWithItems);
  } catch (error) {
    next(error);
  }
});

accountingRouter.post('/journal-entries', requireAuth, requireCompany, async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const entry = req.body;
    
    await client.query('BEGIN');
    
    await client.query(
      'INSERT INTO journal_entries (id, "companyId", date, description) VALUES ($1, $2, $3, $4)',
      [entry.id, req.user!.companyId, entry.date, entry.description]
    );
    
    if (Array.isArray(entry.items)) {
      for (const item of entry.items) {
        await client.query(
          'INSERT INTO journal_items ("companyId", "journalEntryId", "accountId", debit, credit) VALUES ($1, $2, $3, $4, $5)',
          [req.user!.companyId, entry.id, item.accountId, item.debit, item.credit]
        );
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(entry);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

accountingRouter.put('/journal-entries/:id', requireAuth, requireCompany, async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const { id } = req.params;
    const entry = req.body;
    
    await client.query('BEGIN');
    
    await client.query(
      'UPDATE journal_entries SET date = $1, description = $2 WHERE id = $3 AND "companyId" = $4',
      [entry.date, entry.description, id, req.user!.companyId]
    );
    
    await client.query('DELETE FROM journal_items WHERE "journalEntryId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    
    if (Array.isArray(entry.items)) {
      for (const item of entry.items) {
        await client.query(
          'INSERT INTO journal_items ("companyId", "journalEntryId", "accountId", debit, credit) VALUES ($1, $2, $3, $4, $5)',
          [req.user!.companyId, id, item.accountId, item.debit, item.credit]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json(entry);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

accountingRouter.delete('/journal-entries/:id', requireAuth, requireCompany, async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    await client.query('DELETE FROM journal_items WHERE "journalEntryId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await client.query('DELETE FROM journal_entries WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await client.query('COMMIT');
    
    res.status(204).send();
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

accountingRouter.post('/reset', requireAuth, requireCompany, async (req, res, next) => {
  const client = await req.db.connect();
  try {
    const companyId = req.user!.companyId;
    
    await client.query('BEGIN');
    
    // Delete journal items first due to foreign key
    await client.query(`
      DELETE FROM journal_items 
      WHERE "journalEntryId" IN (SELECT id FROM journal_entries WHERE "companyId" = $1)
    `, [companyId]);
    
    await client.query('DELETE FROM journal_entries WHERE "companyId" = $1', [companyId]);
    await client.query('DELETE FROM transactions WHERE "companyId" = $1', [companyId]);
    
    // Delete invoice items first due to foreign key
    await client.query(`
      DELETE FROM invoice_items 
      WHERE "invoiceId" IN (SELECT id FROM invoices WHERE "companyId" = $1)
    `, [companyId]);
    
    await client.query('DELETE FROM invoices WHERE "companyId" = $1', [companyId]);
    
    await client.query('COMMIT');
    res.json({ message: 'Accounting data reset successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});
