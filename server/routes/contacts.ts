import { Router } from 'express';
import { requireTenant } from '../middleware/auth.js';
import { logActivity } from '../activity.js';

export const contactsRouter = Router();

contactsRouter.use(...requireTenant);

const VALID_TYPES = ['particulier', 'professionnel', 'gouvernement', 'etranger'] as const;
type ContactType = (typeof VALID_TYPES)[number];
function normaliseType(input: any): ContactType {
  return (VALID_TYPES as readonly string[]).includes(input) ? input : 'professionnel';
}

const SELECT_COLS = `
  id, "companyId", name, email, phone, company, role, notes, status, "lastContact",
  niu, address, "foreignCountry",
  COALESCE("contactType", 'professionnel') AS "contactType"
`;

contactsRouter.get('/', async (req, res, next) => {
  try {
    const contacts = await req.db.query(
      `SELECT ${SELECT_COLS} FROM contacts WHERE "companyId" = $1`,
      [req.user!.companyId],
    );
    res.json(contacts.rows);
  } catch (error) {
    next(error);
  }
});

contactsRouter.post('/', async (req, res, next) => {
  try {
    const {
      id, name, email, phone, company, role, notes, status, lastContact,
      niu, address, contactType, foreignCountry,
    } = req.body;
    const type = normaliseType(contactType);
    await req.db.query(
      `INSERT INTO contacts
       (id, "companyId", name, email, phone, company, role, notes, status,
        "lastContact", niu, address, "contactType", "foreignCountry")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, req.user!.companyId, name, email, phone, company, role, notes,
       status, lastContact, niu, address, type, foreignCountry || null],
    );

    await logActivity(
      req.db, req.user!.id, req.user!.companyId, 'CREATE_CONTACT',
      `Nouveau contact (${type}) créé: ${name}${company ? ` — ${company}` : ''}`,
    );

    res.status(201).json({
      id, name, email, phone, company, role, notes, status, lastContact,
      niu, address, contactType: type, foreignCountry: foreignCountry || null,
    });
  } catch (error) {
    next(error);
  }
});

contactsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name, email, phone, company, role, notes, status, lastContact,
      niu, address, contactType, foreignCountry,
    } = req.body;
    const type = normaliseType(contactType);
    await req.db.query(
      `UPDATE contacts SET
         name = $1, email = $2, phone = $3, company = $4, role = $5,
         notes = $6, status = $7, "lastContact" = $8, niu = $9,
         address = $10, "contactType" = $11, "foreignCountry" = $12, "updatedAt" = NOW()
       WHERE id = $13 AND "companyId" = $14`,
      [name, email, phone, company, role, notes, status, lastContact,
       niu, address, type, foreignCountry || null, id, req.user!.companyId],
    );

    await logActivity(
      req.db, req.user!.id, req.user!.companyId, 'UPDATE_CONTACT',
      `Contact mis à jour: ${name}`,
    );

    res.json({
      id, name, email, phone, company, role, notes, status, lastContact,
      niu, address, contactType: type, foreignCountry: foreignCountry || null,
    });
  } catch (error) {
    next(error);
  }
});

contactsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    try {
      await req.db.query('BEGIN');
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
