import { Router } from 'express';
import { requireTenant } from '../middleware/auth';

export const statsRouter = Router();

statsRouter.use(...requireTenant);

statsRouter.get('/', async (req, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const contactsCountRes = await req.db.query('SELECT COUNT(*) as count FROM contacts WHERE "companyId" = $1', [companyId]);
    const invoicesTotalRes = await req.db.query("SELECT SUM(total) as total FROM invoices WHERE type = 'Invoice' AND status = 'Paid' AND \"companyId\" = $1", [companyId]);
    const invoicesCountRes = await req.db.query('SELECT COUNT(*) as count FROM invoices WHERE "companyId" = $1', [companyId]);
    const productsCountRes = await req.db.query('SELECT COUNT(*) as count FROM products WHERE "companyId" = $1', [companyId]);

    // Monthly data for the last 6 months
    const monthlyDataRes = await req.db.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', current_date) - interval '5 months',
          date_trunc('month', current_date),
          interval '1 month'
        )::date as month
      )
      SELECT 
        to_char(m.month, 'Mon') as name,
        COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.total ELSE 0 END), 0) as sales,
        COALESCE((
          SELECT SUM(amount) 
          FROM transactions t 
          WHERE t.type = 'Expense' 
          AND t."companyId" = $1
          AND date_trunc('month', t.date::date) = m.month
        ), 0) as expenses
      FROM months m
      LEFT JOIN invoices i ON date_trunc('month', i.date::date) = m.month AND i."companyId" = $1
      GROUP BY m.month
      ORDER BY m.month ASC
    `, [companyId]);

    // Category data
    const categoryDataRes = await req.db.query(`
      SELECT 
        COALESCE(p.category, 'Autres') as name,
        SUM(ii.price * ii.quantity) as value
      FROM invoice_items ii
      JOIN invoices i ON ii."invoiceId" = i.id
      JOIN products p ON ii."productId" = p.id
      WHERE i.status = 'Paid' AND i."companyId" = $1 AND p."companyId" = $1
      GROUP BY p.category
    `, [companyId]);

    // Recent activities
    const activitiesRes = await req.db.query(`
      SELECT a.*, u.name as user_name
      FROM activity_log a
      LEFT JOIN public.users u ON a."userId" = u.id
      WHERE a."companyId" = $1 AND (u.role != 'super_admin' OR u.role IS NULL)
      ORDER BY a."createdAt" DESC
      LIMIT 5
    `, [companyId]);

    res.json({
      contacts: parseInt(contactsCountRes.rows[0]?.count || '0', 10),
      revenue: parseFloat(invoicesTotalRes.rows[0]?.total || '0'),
      orders: parseInt(invoicesCountRes.rows[0]?.count || '0', 10),
      products: parseInt(productsCountRes.rows[0]?.count || '0', 10),
      monthlyData: monthlyDataRes.rows.map(row => ({
        name: row.name,
        sales: parseFloat(row.sales),
        expenses: parseFloat(row.expenses)
      })),
      categoryData: categoryDataRes.rows.map(row => ({
        name: row.name,
        value: parseFloat(row.value)
      })),
      activities: activitiesRes.rows
    });
  } catch (error) {
    next(error);
  }
});
