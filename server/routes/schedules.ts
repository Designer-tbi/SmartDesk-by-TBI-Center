import { Router } from 'express';
import { requireTenant } from '../middleware/auth.js';

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
    `;
    
    const params: any[] = [];
    
    if (!isAdmin) {
      // Users only see their own schedules
      query += ` WHERE s."userId" = $1`;
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
      `INSERT INTO schedules (id, "userId", "createdBy", title, description, "startDate", "endDate", type, status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [scheduleId, userId, req.user!.id, title, description, startDate, endDate, type, status || 'published', new Date().toISOString()]
    );
    
    res.status(201).json({ id: scheduleId, userId, title, description, startDate, endDate, type, status });
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
       WHERE id = $8`,
      [userId, title, description, startDate, endDate, type, status, id]
    );
    
    res.json({ id, userId, title, description, startDate, endDate, type, status });
  } catch (error) {
    next(error);
  }
});

schedulesRouter.delete('/:id', async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin' || req.user!.role === 'rh';
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    await req.db.query('DELETE FROM schedules WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
