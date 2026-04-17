import { Router } from 'express';
import { requireTenant } from '../middleware/auth';
import { logActivity } from '../activity';

export const contactsRouter = Router();

contactsRouter.use(...requireTenant);

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
    const { id, name, email, phone, company, role, notes, status, lastContact, niu } = req.body;
    await req.db.query('INSERT INTO contacts (id, "companyId", name, email, phone, company, role, notes, status, "lastContact", niu) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [id, req.user!.companyId, name, email, phone, company, role, notes, status, lastContact, niu]);
    
    await logActivity(req.db, req.user!.id, req.user!.companyId, 'CREATE_CONTACT', `Nouveau contact créé: ${name} (${company})`);
    
    res.status(201).json({ id, name, email, phone, company, role, notes, status, lastContact, niu });
  } catch (error) {
    next(error);
  }
});

contactsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company, role, notes, status, lastContact, niu } = req.body;
    await req.db.query('UPDATE contacts SET name = $1, email = $2, phone = $3, company = $4, role = $5, notes = $6, status = $7, "lastContact" = $8, niu = $9, "updatedAt" = NOW() WHERE id = $10 AND "companyId" = $11',
      [name, email, phone, company, role, notes, status, lastContact, niu, id, req.user!.companyId]);
    
    await logActivity(req.db, req.user!.id, req.user!.companyId, 'UPDATE_CONTACT', `Contact mis à jour: ${name}`);
    
    res.json({ id, name, email, phone, company, role, notes, status, lastContact, niu });
  } catch (error) {
    next(error);
  }
});

contactsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    try {
      await req.db.query('BEGIN');
      
      // Set contactId to NULL in referencing tables to avoid NO ACTION foreign key constraints
      await req.db.query('UPDATE public.invoices SET "contactId" = NULL WHERE "contactId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
      await req.db.query('UPDATE public.projects SET "contactId" = NULL WHERE "contactId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);

      await req.db.query('DELETE FROM contacts WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
      await req.db.query('COMMIT');
    } catch (e) {
      await req.db.query('ROLLBACK');
      throw e;
    }
    
    await logActivity(req.db, req.user!.id, req.user!.companyId, 'DELETE_CONTACT', `Contact supprimé (ID: ${id})`);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
