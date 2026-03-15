import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const employeesRouter = Router();

employeesRouter.use(requireAuth, requireCompany);

employeesRouter.get('/', (req, res, next) => {
  try {
    const employees = req.db.prepare('SELECT * FROM employees WHERE companyId = ?').all(req.user!.companyId);
    res.json(employees);
  } catch (error) {
    next(error);
  }
});

employeesRouter.post('/', (req, res, next) => {
  try {
    const emp = req.body;
    req.db.prepare('INSERT INTO employees (id, companyId, name, role, department, email, phone, address, status, contractType, joinDate, salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(emp.id, req.user!.companyId, emp.name, emp.role, emp.department, emp.email, emp.phone, emp.address, emp.status, emp.contractType, emp.joinDate, emp.salary);
    res.status(201).json(emp);
  } catch (error) {
    next(error);
  }
});

employeesRouter.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const emp = req.body;
    req.db.prepare('UPDATE employees SET name = ?, role = ?, department = ?, email = ?, phone = ?, address = ?, status = ?, contractType = ?, joinDate = ?, salary = ? WHERE id = ? AND companyId = ?')
      .run(emp.name, emp.role, emp.department, emp.email, emp.phone, emp.address, emp.status, emp.contractType, emp.joinDate, emp.salary, id, req.user!.companyId);
    res.json(emp);
  } catch (error) {
    next(error);
  }
});

employeesRouter.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    req.db.prepare('DELETE FROM employees WHERE id = ? AND companyId = ?').run(id, req.user!.companyId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
