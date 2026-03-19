import { Router } from 'express';
import { requireTenant } from '../middleware/auth';

export const schedulesRouter = Router();

schedulesRouter.use(...requireTenant);

schedulesRouter.get('/', async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin' || req.user!.role === 'rh';
    
    let query = `
      SELECT s.*, u.name as "userName", creator.name as "creatorName"
      FROM schedules s
      JOIN public.users u ON s."userId" = u.id
      JOIN public.users creator ON s."createdBy" = creator.id
      WHERE s."companyId" = $1
    `;
    
    const params: any[] = [req.user!.companyId];
    
    if (!isAdmin) {
      // Users only see their own schedules
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
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin' || req.user!.role === 'rh';
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id, userId, title, description, startDate, endDate, type, status } = req.body;
    const scheduleId = id || `sch_${Date.now()}`;
    
    await req.db.query(
      `INSERT INTO schedules (id, "companyId", "userId", "createdBy", title, description, "startDate", "endDate", type, status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [scheduleId, req.user!.companyId, userId, req.user!.id, title, description, startDate, endDate, type, status || 'published', new Date().toISOString()]
    );
    
    res.status(201).json({ id: scheduleId, companyId: req.user!.companyId, userId, title, description, startDate, endDate, type, status });
  } catch (error) {
    next(error);
  }
});

schedulesRouter.put('/:id', async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin' || req.user!.role === 'rh';
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const { userId, title, description, startDate, endDate, type, status } = req.body;
    
    await req.db.query(
      `UPDATE schedules SET "userId" = $1, title = $2, description = $3, "startDate" = $4, "endDate" = $5, type = $6, status = $7
       WHERE id = $8 AND "companyId" = $9`,
      [userId, title, description, startDate, endDate, type, status, id, req.user!.companyId]
    );
    
    res.json({ id, companyId: req.user!.companyId, userId, title, description, startDate, endDate, type, status });
  } catch (error) {
    next(error);
  }
});

schedulesRouter.delete('/:id', async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin' || req.user!.role === 'rh';
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    await req.db.query('DELETE FROM schedules WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
