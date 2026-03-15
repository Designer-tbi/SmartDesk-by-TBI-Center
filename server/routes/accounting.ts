import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const accountingRouter = Router();

accountingRouter.get('/transactions', requireAuth, requireCompany, (req, res, next) => {
  try {
    const transactions = req.db.prepare('SELECT * FROM transactions WHERE companyId = ?').all(req.user!.companyId);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

accountingRouter.get('/journal-entries', requireAuth, requireCompany, (req, res, next) => {
  try {
    const entries = req.db.prepare('SELECT * FROM journal_entries WHERE companyId = ?').all(req.user!.companyId);
    const entriesWithItems = entries.map((entry: any) => {
      const items = req.db.prepare('SELECT * FROM journal_items WHERE journalEntryId = ?').all(entry.id);
      return { ...entry, items };
    });
    res.json(entriesWithItems);
  } catch (error) {
    next(error);
  }
});

accountingRouter.post('/journal-entries', requireAuth, requireCompany, (req, res, next) => {
  try {
    const entry = req.body;
    
    // Use transaction
    const insertEntryAndItems = req.db.transaction((entryData) => {
      req.db.prepare('INSERT INTO journal_entries (id, companyId, date, description) VALUES (?, ?, ?, ?)')
        .run(entryData.id, req.user!.companyId, entryData.date, entryData.description);
      
      const insertItem = req.db.prepare('INSERT INTO journal_items (journalEntryId, accountId, debit, credit) VALUES (?, ?, ?, ?)');
      if (Array.isArray(entryData.items)) {
        entryData.items.forEach((item: any) => {
          insertItem.run(entryData.id, item.accountId, item.debit, item.credit);
        });
      }
    });

    insertEntryAndItems(entry);
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

accountingRouter.put('/journal-entries/:id', requireAuth, requireCompany, (req, res, next) => {
  try {
    const { id } = req.params;
    const entry = req.body;
    
    const updateEntryAndItems = req.db.transaction((entryData) => {
      req.db.prepare('UPDATE journal_entries SET date = ?, description = ? WHERE id = ? AND companyId = ?')
        .run(entryData.date, entryData.description, id, req.user!.companyId);
      
      // Delete existing items
      req.db.prepare('DELETE FROM journal_items WHERE journalEntryId = ?').run(id);
      
      // Insert new items
      const insertItem = req.db.prepare('INSERT INTO journal_items (journalEntryId, accountId, debit, credit) VALUES (?, ?, ?, ?)');
      if (Array.isArray(entryData.items)) {
        entryData.items.forEach((item: any) => {
          insertItem.run(id, item.accountId, item.debit, item.credit);
        });
      }
    });

    updateEntryAndItems(entry);
    res.json(entry);
  } catch (error) {
    next(error);
  }
});

accountingRouter.delete('/journal-entries/:id', requireAuth, requireCompany, (req, res, next) => {
  try {
    const { id } = req.params;
    const deleteEntryAndItems = req.db.transaction(() => {
      req.db.prepare('DELETE FROM journal_items WHERE journalEntryId = ?').run(id);
      req.db.prepare('DELETE FROM journal_entries WHERE id = ? AND companyId = ?').run(id, req.user!.companyId);
    });
    deleteEntryAndItems();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
