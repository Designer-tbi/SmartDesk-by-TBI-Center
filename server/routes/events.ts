import { Router } from 'express';
import { requireTenant } from '../middleware/auth';

export const eventsRouter = Router();

eventsRouter.use(...requireTenant);

eventsRouter.get('/', async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    
    let query = `
      SELECT e.*, u.name as "userName", u.role as "userRole", target.name as "assignedToName"
      FROM events e
      JOIN public.users u ON e."userId" = u.id
      LEFT JOIN public.users target ON e."assignedTo" = target.id
      WHERE e."companyId" = $1
    `;
    
    const params: any[] = [req.user!.companyId];
    
    if (!isAdmin) {
      // Non-admins see:
      // 1. Events they created
      // 2. Events assigned to them
      // 3. Public events NOT created by admins (as per previous requirement)
      query += ` AND (
        e."userId" = $2 
        OR e."assignedTo" = $2 
        OR (u.role NOT IN ('admin', 'super_admin') AND e."isPrivate" = FALSE)
      )`;
      params.push(req.user!.id);
    }
    
    query += ` ORDER BY e."startDate" ASC`;
    
    const result = await req.db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

eventsRouter.post('/', async (req, res, next) => {
  try {
    const { id, title, description, startDate, endDate, category, isPrivate, assignedTo } = req.body;
    const eventId = id || `evt_${Date.now()}`;
    
    await req.db.query(
      `INSERT INTO events (id, "companyId", "userId", "assignedTo", title, description, "startDate", "endDate", category, "isPrivate", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [eventId, req.user!.companyId, req.user!.id, assignedTo || null, title, description, startDate, endDate, category, isPrivate || false, new Date().toISOString()]
    );
    
    res.status(201).json({ id: eventId, title, description, startDate, endDate, category, isPrivate, assignedTo });
  } catch (error) {
    next(error);
  }
});

eventsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, startDate, endDate, category, isPrivate, assignedTo } = req.body;
    
    // Check ownership or admin — scoped to current tenant
    const eventRes = await req.db.query(
      'SELECT "userId" FROM events WHERE id = $1 AND "companyId" = $2',
      [id, req.user!.companyId]
    );
    const event = eventRes.rows[0];
    
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (event.userId !== req.user!.id && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await req.db.query(
      `UPDATE events SET title = $1, description = $2, "startDate" = $3, "endDate" = $4, category = $5, "isPrivate" = $6, "assignedTo" = $7
       WHERE id = $8 AND "companyId" = $9`,
      [title, description, startDate, endDate, category, isPrivate, assignedTo || null, id, req.user!.companyId]
    );
    
    res.json({ id, title, description, startDate, endDate, category, isPrivate, assignedTo });
  } catch (error) {
    next(error);
  }
});

eventsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check ownership or admin — scoped to current tenant
    const eventRes = await req.db.query(
      'SELECT "userId" FROM events WHERE id = $1 AND "companyId" = $2',
      [id, req.user!.companyId]
    );
    const event = eventRes.rows[0];
    
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (event.userId !== req.user!.id && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await req.db.query(
      'DELETE FROM events WHERE id = $1 AND "companyId" = $2',
      [id, req.user!.companyId]
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
