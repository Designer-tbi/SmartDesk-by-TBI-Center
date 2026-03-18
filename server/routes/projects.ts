import { Router } from 'express';
import { requireTenant } from '../middleware/auth.js';
import { logActivity } from '../../server.js';

export const projectsRouter = Router();

projectsRouter.use(...requireTenant);

projectsRouter.get('/', async (req, res, next) => {
  try {
    const projects = await req.db.query('SELECT * FROM projects WHERE "companyId" = $1', [req.user!.companyId]);
    const parsedProjects = projects.rows.map(p => ({
      ...p,
      teamIds: p.teamIds ? JSON.parse(p.teamIds) : []
    }));
    res.json(parsedProjects);
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/', async (req, res, next) => {
  try {
    const proj = req.body;
    await req.db.query('INSERT INTO projects (id, "companyId", name, client, "contactId", status, deadline, "startDate", progress, description, details, priority, budget, "teamIds") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
      [proj.id, req.user!.companyId, proj.name, proj.client, proj.contactId, proj.status, proj.deadline, proj.startDate, proj.progress, proj.description, proj.details, proj.priority, proj.budget, JSON.stringify(proj.teamIds || [])]);
    
    await logActivity(req.db, req.user!.id, req.user!.companyId, 'CREATE_PROJECT', `Nouveau projet créé: ${proj.name}`);
    
    res.status(201).json(proj);
  } catch (error) {
    next(error);
  }
});

projectsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const proj = req.body;
    await req.db.query('UPDATE projects SET name = $1, client = $2, "contactId" = $3, status = $4, deadline = $5, "startDate" = $6, progress = $7, description = $8, details = $9, priority = $10, budget = $11, "teamIds" = $12 WHERE id = $13 AND "companyId" = $14',
      [proj.name, proj.client, proj.contactId, proj.status, proj.deadline, proj.startDate, proj.progress, proj.description, proj.details, proj.priority, proj.budget, JSON.stringify(proj.teamIds || []), id, req.user!.companyId]);
    
    await logActivity(req.db, req.user!.id, req.user!.companyId, 'UPDATE_PROJECT', `Projet mis à jour: ${proj.name}`);
    
    res.json(proj);
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM projects WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    
    await logActivity(req.db, req.user!.id, req.user!.companyId, 'DELETE_PROJECT', `Projet supprimé (ID: ${id})`);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
