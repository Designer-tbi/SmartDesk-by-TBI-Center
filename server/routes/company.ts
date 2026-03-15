import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const companyRouter = Router();

companyRouter.use(requireAuth, requireCompany);

companyRouter.get('/', (req, res, next) => {
  try {
    const company = req.db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user!.companyId);
    res.json(company);
  } catch (error) {
    next(error);
  }
});

companyRouter.put('/', (req, res, next) => {
  try {
    const { name, taxId, rccm, idNat, email, phone, website, address, country, state } = req.body;
    req.db.prepare('UPDATE companies SET name = ?, taxId = ?, rccm = ?, idNat = ?, email = ?, phone = ?, website = ?, address = ?, country = ?, state = ? WHERE id = ?')
      .run(name, taxId, rccm, idNat, email, phone, website, address, country || 'FR', state, req.user!.companyId);
    
    const updatedCompany = req.db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user!.companyId);
    res.json(updatedCompany);
  } catch (error) {
    next(error);
  }
});
