import { Router } from 'express';
import { requireTenant } from '../middleware/auth.js';

export const schedulesRouter = Router();

schedulesRouter.use(...requireTenant);

// SmartDesk roles are keyed per-company (e.g. `role_admin_demo-1`,
// `role_rh_demo-2`) so we match by prefix here, plus the legacy plain
// values used by super-admin and seeded fixtures.
const isManagerRole = (role?: string | null) => {
  if (!role) return false;
  if (role === 'admin' || role === 'super_admin' || role === 'rh') return true;
  if (role.startsWith('role_admin_') || role.startsWith('role_rh_') || role.startsWith('role_super_admin_')) return true;
  return false;
};

schedulesRouter.get('/', async (req, res, next) => {
  try {
    const isAdmin = isManagerRole(req.user!.role);
    
    // Resolve `userName` from either the linked login user OR the HR
    // employee row (when the schedule was created for an employee that
    // doesn't have a SmartDesk login account).
    let query = `
      SELECT s.*,
             COALESCE(u.name, e.name) as "userName",
             creator.name as "creatorName"
      FROM schedules s
      LEFT JOIN public.users u ON s."userId" = u.id
      LEFT JOIN public.employees e ON s."employeeId" = e.id
      JOIN public.users creator ON s."createdBy" = creator.id
      WHERE s."companyId" = $1
    `;
    
    const params: any[] = [req.user!.companyId];
    
    if (!isAdmin) {
      // Non-admin users only see their own user-bound schedules.
      query += ` AND s."userId" = $2`;
      params.push(req.user!.id);
    }
    
    query += ` ORDER BY s."startDate" ASC`;
    
    const result = await req.db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

schedulesRouter.post('/', async (req, res, next) => {
  try {
    const isAdmin = isManagerRole(req.user!.role);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id, userId, employeeId, title, description, startDate, endDate, type, status } = req.body;
    if (!userId && !employeeId) {
      return res.status(400).json({ error: 'userId ou employeeId requis' });
    }
    const scheduleId = id || `sch_${Date.now()}`;
    
    await req.db.query(
      `INSERT INTO schedules (id, "companyId", "userId", "employeeId", "createdBy", title, description, "startDate", "endDate", type, status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [scheduleId, req.user!.companyId, userId || null, employeeId || null, req.user!.id, title, description, startDate, endDate, type, status || 'published', new Date().toISOString()]
    );
    
    res.status(201).json({ id: scheduleId, companyId: req.user!.companyId, userId: userId || null, employeeId: employeeId || null, title, description, startDate, endDate, type, status });
  } catch (error) {
    next(error);
  }
});

schedulesRouter.put('/:id', async (req, res, next) => {
  try {
    const isAdmin = isManagerRole(req.user!.role);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const { userId, employeeId, title, description, startDate, endDate, type, status } = req.body;
    
    await req.db.query(
      `UPDATE schedules SET "userId" = $1, "employeeId" = $2, title = $3, description = $4, "startDate" = $5, "endDate" = $6, type = $7, status = $8
       WHERE id = $9 AND "companyId" = $10`,
      [userId || null, employeeId || null, title, description, startDate, endDate, type, status, id, req.user!.companyId]
    );
    
    res.json({ id, companyId: req.user!.companyId, userId: userId || null, employeeId: employeeId || null, title, description, startDate, endDate, type, status });
  } catch (error) {
    next(error);
  }
});

schedulesRouter.delete('/:id', async (req, res, next) => {
  try {
    const isAdmin = isManagerRole(req.user!.role);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    await req.db.query('DELETE FROM schedules WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
