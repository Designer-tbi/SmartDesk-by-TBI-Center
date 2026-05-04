import { Router } from 'express';
import { requireTenant } from '../middleware/auth.js';

export const statsRouter = Router();

statsRouter.use(...requireTenant);

statsRouter.get('/', async (req, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const contactsCountRes = await req.db.query('SELECT COUNT(*) as count FROM contacts WHERE "companyId" = $1', [companyId]);
    const invoicesTotalRes = await req.db.query("SELECT SUM(total) as total FROM invoices WHERE type = 'Invoice' AND status = 'Paid' AND \"companyId\" = $1", [companyId]);
    const invoicesCountRes = await req.db.query('SELECT COUNT(*) as count FROM invoices WHERE "companyId" = $1', [companyId]);
    const productsCountRes = await req.db.query('SELECT COUNT(*) as count FROM products WHERE "companyId" = $1', [companyId]);

    // 12-month revenue trend (was 6 months).
    const monthlyDataRes = await req.db.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', current_date) - interval '11 months',
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

    // Revenue split by product category (Paid invoices only).
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

    /* ---------------- Phase 4 widgets ---------------- */

    // Outstanding & overdue invoices. `dueDate` is stored as TEXT so
    // we cast it before comparing to current_date.
    const outstandingRes = await req.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('Paid', 'Cancelled', 'Draft')) as count,
        COALESCE(SUM(total) FILTER (WHERE status NOT IN ('Paid', 'Cancelled', 'Draft')), 0) as total,
        COUNT(*) FILTER (WHERE status NOT IN ('Paid', 'Cancelled', 'Draft') AND "dueDate" IS NOT NULL AND "dueDate"::date < current_date) as overdue_count,
        COALESCE(SUM(total) FILTER (WHERE status NOT IN ('Paid', 'Cancelled', 'Draft') AND "dueDate" IS NOT NULL AND "dueDate"::date < current_date), 0) as overdue_total
      FROM invoices
      WHERE "companyId" = $1 AND type = 'Invoice'
    `, [companyId]);
    const outstanding = outstandingRes.rows[0] || {};

    // Top 5 clients by paid revenue.
    const topClientsRes = await req.db.query(`
      SELECT
        c.id, c.name, c.company,
        COALESCE(SUM(i.total), 0) as revenue,
        COUNT(i.id) as invoices
      FROM contacts c
      LEFT JOIN invoices i ON i."contactId" = c.id AND i.status = 'Paid' AND i.type = 'Invoice' AND i."companyId" = c."companyId"
      WHERE c."companyId" = $1
      GROUP BY c.id, c.name, c.company
      ORDER BY revenue DESC
      LIMIT 5
    `, [companyId]);

    // Upcoming approved leaves starting within the next 14 days.
    // `startDate` / `endDate` are TEXT — cast to date before comparing.
    const upcomingLeavesRes = await req.db.query(`
      SELECT l.id, l."employeeId", l.type, l."startDate", l."endDate", e.name as employee_name
      FROM leave_requests l
      LEFT JOIN employees e ON e.id = l."employeeId" AND e."companyId" = l."companyId"
      WHERE l."companyId" = $1
        AND l.status = 'Approved'
        AND l."startDate"::date >= current_date
        AND l."startDate"::date <= current_date + interval '14 days'
      ORDER BY l."startDate"::date ASC
      LIMIT 5
    `, [companyId]);

    // Contracts ending within the next 30 days (CDD expiries).
    const expiringContractsRes = await req.db.query(`
      SELECT c.id, c.type, c."endDate", c."employeeId", e.name as employee_name
      FROM contracts c
      LEFT JOIN employees e ON e.id = c."employeeId" AND e."companyId" = c."companyId"
      WHERE c."companyId" = $1
        AND c."endDate" IS NOT NULL
        AND c."endDate" <> ''
        AND c."endDate"::date >= current_date
        AND c."endDate"::date <= current_date + interval '30 days'
        AND c.status IN ('Signed', 'Active')
      ORDER BY c."endDate"::date ASC
      LIMIT 5
    `, [companyId]);

    // Low-stock products (stock <= 5 — we don't have a minStock column).
    const lowStockRes = await req.db.query(`
      SELECT id, name, stock
      FROM products
      WHERE "companyId" = $1
        AND COALESCE(stock, 0) <= 5
      ORDER BY stock ASC NULLS FIRST
      LIMIT 5
    `, [companyId]);

    // Pending leave approvals count.
    const pendingLeavesRes = await req.db.query(`
      SELECT COUNT(*) as count FROM leave_requests
      WHERE "companyId" = $1 AND status = 'Pending'
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
      activities: activitiesRes.rows,
      // Phase 4
      outstanding: {
        count: parseInt(outstanding.count || '0', 10),
        total: parseFloat(outstanding.total || '0'),
        overdueCount: parseInt(outstanding.overdue_count || '0', 10),
        overdueTotal: parseFloat(outstanding.overdue_total || '0'),
      },
      topClients: topClientsRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        company: r.company,
        revenue: parseFloat(r.revenue || '0'),
        invoices: parseInt(r.invoices || '0', 10),
      })),
      upcomingLeaves: upcomingLeavesRes.rows.map(r => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employee_name,
        type: r.type,
        startDate: r.startDate,
        endDate: r.endDate,
      })),
      expiringContracts: expiringContractsRes.rows.map(r => ({
        id: r.id,
        type: r.type,
        endDate: r.endDate,
        employeeId: r.employeeId,
        employeeName: r.employee_name,
      })),
      lowStock: lowStockRes.rows,
      pendingLeaves: parseInt(pendingLeavesRes.rows[0]?.count || '0', 10),
    });
  } catch (error) {
    next(error);
  }
});
