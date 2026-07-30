import { Router, Request, Response, NextFunction } from 'express';
import { requireTenant } from '../middleware/auth.js';
import { isManagerRole } from '../utils/roles.js';
import { suggestAccountingEntry } from '../services/accountingAI.js';

export const accountingRouter = Router();

// Editing/deleting journal entries and wiping accounting data are
// admin-only — any authenticated tenant member could previously do both.
const requireManager = (req: Request, res: Response, next: NextFunction) => {
  if (!isManagerRole(req.user!.role)) {
    return res.status(403).json({ error: 'Forbidden: réservé aux administrateurs.' });
  }
  next();
};

accountingRouter.post('/journal-entries/suggest', ...requireTenant, async (req, res, next) => {
  try {
    const { description, amount, standard } = req.body || {};
    if (!description || !Number.isFinite(Number(amount))) {
      return res.status(400).json({ error: 'description et amount sont requis.' });
    }
    const suggestion = await suggestAccountingEntry(String(description), Number(amount), standard);
    res.json(suggestion);
  } catch (error: any) {
    if (error?.message?.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ error: 'Suggestion IA indisponible (clé API non configurée).' });
    }
    next(error);
  }
});

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

/**
 * A journal entry that doesn't balance (sum(debit) !== sum(credit)) is not
 * a valid double-entry bookkeeping record — it would silently corrupt the
 * trial balance / bilan. Reject it instead of persisting it.
 */
function assertBalanced(items: any[]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('Une écriture doit contenir au moins une ligne.'), { status: 400 });
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totalDebit = round2(items.reduce((s, it) => s + (Number(it.debit) || 0), 0));
  const totalCredit = round2(items.reduce((s, it) => s + (Number(it.credit) || 0), 0));
  if (totalDebit !== totalCredit) {
    throw Object.assign(
      new Error(`Écriture déséquilibrée : débit ${totalDebit} ≠ crédit ${totalCredit}.`),
      { status: 400 },
    );
  }
}

accountingRouter.post('/journal-entries', ...requireTenant, requireManager, async (req, res, next) => {
  try {
    const entry = req.body;
    assertBalanced(entry.items);

    await req.db.query('BEGIN');

    await req.db.query(
      'INSERT INTO journal_entries (id, "companyId", date, description, "sourceRef") VALUES ($1, $2, $3, $4, $5)',
      [entry.id, req.user!.companyId, entry.date, entry.description, entry.sourceRef || null]
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
  } catch (error: any) {
    await req.db.query('ROLLBACK');
    if (error?.status === 400) return res.status(400).json({ error: error.message });
    next(error);
  }
});

accountingRouter.put('/journal-entries/:id', ...requireTenant, requireManager, async (req, res, next) => {
  try {
    const { id } = req.params;
    const entry = req.body;
    assertBalanced(entry.items);

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
  } catch (error: any) {
    await req.db.query('ROLLBACK');
    if (error?.status === 400) return res.status(400).json({ error: error.message });
    next(error);
  }
});

accountingRouter.delete('/journal-entries/:id', ...requireTenant, requireManager, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await req.db.query('BEGIN');
    
    // Ensure journal entry belongs to company
    const entryCheck = await req.db.query('SELECT id FROM journal_entries WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    if (entryCheck.rows.length === 0) {
      await req.db.query('ROLLBACK');
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    
    await req.db.query('DELETE FROM journal_items WHERE "journalEntryId" = $1', [id]);
    await req.db.query('DELETE FROM journal_entries WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('COMMIT');
    
    res.status(204).send();
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

accountingRouter.post('/reset', ...requireTenant, requireManager, async (req, res, next) => {
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
