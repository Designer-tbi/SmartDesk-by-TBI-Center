import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const contactsRouter = Router();

contactsRouter.use(requireAuth, requireCompany);

contactsRouter.get('/', (req, res, next) => {
  try {
    const contacts = req.db.prepare('SELECT * FROM contacts WHERE companyId = ?').all(req.user!.companyId);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

contactsRouter.post('/', (req, res, next) => {
  try {
    const { id, name, email, phone, company, status, lastContact } = req.body;
    req.db.prepare('INSERT INTO contacts (id, companyId, name, email, phone, company, status, lastContact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.user!.companyId, name, email, phone, company, status, lastContact);
    res.status(201).json({ id, name, email, phone, company, status, lastContact });
  } catch (error) {
    next(error);
  }
});

contactsRouter.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company, status, lastContact } = req.body;
    req.db.prepare('UPDATE contacts SET name = ?, email = ?, phone = ?, company = ?, status = ?, lastContact = ? WHERE id = ? AND companyId = ?')
      .run(name, email, phone, company, status, lastContact, id, req.user!.companyId);
    res.json({ id, name, email, phone, company, status, lastContact });
  } catch (error) {
    next(error);
  }
});

contactsRouter.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    req.db.prepare('DELETE FROM contacts WHERE id = ? AND companyId = ?').run(id, req.user!.companyId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
