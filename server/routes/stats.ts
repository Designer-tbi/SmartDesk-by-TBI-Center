import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const statsRouter = Router();

statsRouter.use(requireAuth, requireCompany);

statsRouter.get('/', async (req, res, next) => {
  try {
    const contactsCountRes = await req.db.query('SELECT COUNT(*) as count FROM contacts WHERE "companyId" = $1', [req.user!.companyId]);
    const invoicesTotalRes = await req.db.query("SELECT SUM(total) as total FROM invoices WHERE type = 'Invoice' AND status = 'Paid' AND \"companyId\" = $1", [req.user!.companyId]);
    const invoicesCountRes = await req.db.query('SELECT COUNT(*) as count FROM invoices WHERE "companyId" = $1', [req.user!.companyId]);
    const productsCountRes = await req.db.query('SELECT COUNT(*) as count FROM products WHERE "companyId" = $1', [req.user!.companyId]);

    res.json({
      contacts: parseInt(contactsCountRes.rows[0]?.count || '0', 10),
      revenue: parseFloat(invoicesTotalRes.rows[0]?.total || '0'),
      orders: parseInt(invoicesCountRes.rows[0]?.count || '0', 10),
      products: parseInt(productsCountRes.rows[0]?.count || '0', 10)
    });
  } catch (error) {
    next(error);
  }
});
