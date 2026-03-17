import { Router } from 'express';
import { requireTenant } from '../middleware/auth.js';

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
    `;
    
    const params: any[] = [];
    
    if (!isAdmin) {
      // Non-admins see:
      // 1. Events they created
      // 2. Events assigned to them
      // 3. Public events NOT created by admins (as per previous requirement)
      query += ` WHERE (
        e."userId" = $1 
        OR e."assignedTo" = $1 
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
      `INSERT INTO events (id, "userId", "assignedTo", title, description, "startDate", "endDate", category, "isPrivate", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [eventId, req.user!.id, assignedTo || null, title, description, startDate, endDate, category, isPrivate || false, new Date().toISOString()]
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
    
    // Check ownership or admin
    const eventRes = await req.db.query('SELECT "userId" FROM events WHERE id = $1', [id]);
    const event = eventRes.rows[0];
    
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (event.userId !== req.user!.id && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await req.db.query(
      `UPDATE events SET title = $1, description = $2, "startDate" = $3, "endDate" = $4, category = $5, "isPrivate" = $6, "assignedTo" = $7
       WHERE id = $8`,
      [title, description, startDate, endDate, category, isPrivate, assignedTo || null, id]
    );
    
    res.json({ id, title, description, startDate, endDate, category, isPrivate, assignedTo });
  } catch (error) {
    next(error);
  }
});

eventsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check ownership or admin
    const eventRes = await req.db.query('SELECT "userId" FROM events WHERE id = $1', [id]);
    const event = eventRes.rows[0];
    
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (event.userId !== req.user!.id && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await req.db.query('DELETE FROM events WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
