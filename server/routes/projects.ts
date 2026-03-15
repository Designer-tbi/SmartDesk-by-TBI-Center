import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth, requireCompany);

projectsRouter.get('/', async (req, res, next) => {
  try {
    const projects = await req.db.query('SELECT * FROM projects WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(projects.rows);
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/', async (req, res, next) => {
  try {
    const proj = req.body;
    await req.db.query('INSERT INTO projects (id, "companyId", name, client, status, deadline, progress, description, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [proj.id, req.user!.companyId, proj.name, proj.client, proj.status, proj.deadline, proj.progress, proj.description, proj.details]);
    res.status(201).json(proj);
  } catch (error) {
    next(error);
  }
});

projectsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const proj = req.body;
    await req.db.query('UPDATE projects SET name = $1, client = $2, status = $3, deadline = $4, progress = $5, description = $6, details = $7 WHERE id = $8 AND "companyId" = $9',
      [proj.name, proj.client, proj.status, proj.deadline, proj.progress, proj.description, proj.details, id, req.user!.companyId]);
    res.json(proj);
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete('/:id', async (req, res, next) => {
  try {
    await req.db.query('DELETE FROM projects WHERE id = $1 AND "companyId" = $2', [req.params.id, req.user!.companyId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
