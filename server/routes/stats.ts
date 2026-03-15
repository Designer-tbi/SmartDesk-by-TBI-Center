import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const statsRouter = Router();

statsRouter.use(requireAuth, requireCompany);

statsRouter.get('/', (req, res, next) => {
  try {
    const contactsCount = req.db.prepare("SELECT COUNT(*) as count FROM contacts WHERE companyId = ?").get(req.user!.companyId) as any;
    const invoicesTotal = req.db.prepare("SELECT SUM(total) as total FROM invoices WHERE type = 'Invoice' AND status = 'Paid' AND companyId = ?").get(req.user!.companyId) as any;
    const invoicesCount = req.db.prepare("SELECT COUNT(*) as count FROM invoices WHERE companyId = ?").get(req.user!.companyId) as any;
    const productsCount = req.db.prepare("SELECT COUNT(*) as count FROM products WHERE companyId = ?").get(req.user!.companyId) as any;

    res.json({
      contacts: contactsCount?.count || 0,
      revenue: invoicesTotal?.total || 0,
      orders: invoicesCount?.count || 0,
      products: productsCount?.count || 0
    });
  } catch (error) {
    next(error);
  }
});
