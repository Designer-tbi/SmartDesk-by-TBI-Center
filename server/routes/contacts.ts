import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';
import { logActivity } from '../../server.js';

export const contactsRouter = Router();

contactsRouter.use(requireAuth, requireCompany);

contactsRouter.get('/', async (req, res, next) => {
  try {
    const contacts = await req.db.query('SELECT * FROM contacts WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(contacts.rows);
  } catch (error) {
    next(error);
  }
});

contactsRouter.post('/', async (req, res, next) => {
  try {
    const { id, name, email, phone, company, role, notes, status, lastContact } = req.body;
    await req.db.query('INSERT INTO contacts (id, "companyId", name, email, phone, company, role, notes, status, "lastContact") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [id, req.user!.companyId, name, email, phone, company, role, notes, status, lastContact]);
    
    await logActivity(req.user!.id, req.user!.companyId, 'CREATE_CONTACT', `Nouveau contact créé: ${name} (${company})`);
    
    res.status(201).json({ id, name, email, phone, company, role, notes, status, lastContact });
  } catch (error) {
    next(error);
  }
});

contactsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company, role, notes, status, lastContact } = req.body;
    await req.db.query('UPDATE contacts SET name = $1, email = $2, phone = $3, company = $4, role = $5, notes = $6, status = $7, "lastContact" = $8 WHERE id = $9 AND "companyId" = $10',
      [name, email, phone, company, role, notes, status, lastContact, id, req.user!.companyId]);
    
    await logActivity(req.user!.id, req.user!.companyId, 'UPDATE_CONTACT', `Contact mis à jour: ${name}`);
    
    res.json({ id, name, email, phone, company, role, notes, status, lastContact });
  } catch (error) {
    next(error);
  }
});

contactsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM contacts WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    
    await logActivity(req.user!.id, req.user!.companyId, 'DELETE_CONTACT', `Contact supprimé (ID: ${id})`);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
