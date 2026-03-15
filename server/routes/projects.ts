import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth, requireCompany);

projectsRouter.get('/', (req, res, next) => {
  try {
    const projects = req.db.prepare('SELECT * FROM projects WHERE companyId = ?').all(req.user!.companyId);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/', (req, res, next) => {
  try {
    const proj = req.body;
    req.db.prepare('INSERT INTO projects (id, companyId, name, client, status, deadline, progress, description, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(proj.id, req.user!.companyId, proj.name, proj.client, proj.status, proj.deadline, proj.progress, proj.description, proj.details);
    res.status(201).json(proj);
  } catch (error) {
    next(error);
  }
});

projectsRouter.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const proj = req.body;
    req.db.prepare('UPDATE projects SET name = ?, client = ?, status = ?, deadline = ?, progress = ?, description = ?, details = ? WHERE id = ? AND companyId = ?')
      .run(proj.name, proj.client, proj.status, proj.deadline, proj.progress, proj.description, proj.details, id, req.user!.companyId);
    res.json(proj);
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete('/:id', (req, res, next) => {
  try {
    req.db.prepare('DELETE FROM projects WHERE id = ? AND companyId = ?').run(req.params.id, req.user!.companyId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
