import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth, requireCompany);

invoicesRouter.get('/', (req, res, next) => {
  try {
    const invoices = req.db.prepare('SELECT * FROM invoices WHERE companyId = ?').all(req.user!.companyId);
    const invoicesWithItems = invoices.map((inv: any) => {
      const items = req.db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(inv.id);
      return { ...inv, items };
    });
    res.json(invoicesWithItems);
  } catch (error) {
    next(error);
  }
});

invoicesRouter.post('/', (req, res, next) => {
  try {
    const inv = req.body;
    
    // Use a transaction for creating invoice and items
    const insertInvoiceAndItems = req.db.transaction((invoice) => {
      const insertInvoice = req.db.prepare('INSERT INTO invoices (id, companyId, type, contactId, date, dueDate, totalHT, tvaTotal, total, status, notes, signatureLink) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      insertInvoice.run(invoice.id, req.user!.companyId, invoice.type, invoice.contactId, invoice.date, invoice.dueDate, invoice.totalHT, invoice.tvaTotal, invoice.total, invoice.status, invoice.notes || null, invoice.signatureLink || null);
      
      const insertItem = req.db.prepare('INSERT INTO invoice_items (invoiceId, productId, name, quantity, price, tvaRate, tvaAmount) VALUES (?, ?, ?, ?, ?, ?, ?)');
      if (Array.isArray(invoice.items)) {
        invoice.items.forEach((item: any) => {
          insertItem.run(invoice.id, item.productId, item.name, item.quantity, item.price, item.tvaRate, item.tvaAmount);
        });
      }
    });

    insertInvoiceAndItems(inv);
    res.status(201).json(inv);
  } catch (error) {
    next(error);
  }
});

invoicesRouter.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const inv = req.body;
    
    const updateInvoiceAndItems = req.db.transaction((invoice) => {
      const updateInvoice = req.db.prepare('UPDATE invoices SET type = ?, contactId = ?, date = ?, dueDate = ?, totalHT = ?, tvaTotal = ?, total = ?, status = ?, notes = ?, signatureLink = ? WHERE id = ? AND companyId = ?');
      updateInvoice.run(invoice.type, invoice.contactId, invoice.date, invoice.dueDate, invoice.totalHT, invoice.tvaTotal, invoice.total, invoice.status, invoice.notes || null, invoice.signatureLink || null, id, req.user!.companyId);
      
      // Delete existing items
      req.db.prepare('DELETE FROM invoice_items WHERE invoiceId = ?').run(id);
      
      // Insert new items
      const insertItem = req.db.prepare('INSERT INTO invoice_items (invoiceId, productId, name, quantity, price, tvaRate, tvaAmount) VALUES (?, ?, ?, ?, ?, ?, ?)');
      if (Array.isArray(invoice.items)) {
        invoice.items.forEach((item: any) => {
          insertItem.run(id, item.productId, item.name, item.quantity, item.price, item.tvaRate, item.tvaAmount);
        });
      }
    });

    updateInvoiceAndItems(inv);
    res.json(inv);
  } catch (error) {
    next(error);
  }
});

invoicesRouter.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const deleteInvoiceAndItems = req.db.transaction(() => {
      req.db.prepare('DELETE FROM invoice_items WHERE invoiceId = ?').run(id);
      req.db.prepare('DELETE FROM invoices WHERE id = ? AND companyId = ?').run(id, req.user!.companyId);
    });
    deleteInvoiceAndItems();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
