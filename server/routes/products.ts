import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';

export const productsRouter = Router();

productsRouter.use(requireAuth, requireCompany);

productsRouter.get('/', (req, res, next) => {
  try {
    const products = req.db.prepare('SELECT * FROM products WHERE companyId = ?').all(req.user!.companyId);
    res.json(products);
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/', (req, res, next) => {
  try {
    const { id, name, sku, price, stock, category, description, type, tvaRate } = req.body;
    req.db.prepare('INSERT INTO products (id, companyId, name, sku, price, stock, category, description, type, tvaRate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.user!.companyId, name, sku, price, stock, category, description, type, tvaRate);
    res.status(201).json({ id, name, sku, price, stock, category, description, type, tvaRate });
  } catch (error) {
    next(error);
  }
});

productsRouter.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, sku, price, stock, category, description, type, tvaRate } = req.body;
    req.db.prepare('UPDATE products SET name = ?, sku = ?, price = ?, stock = ?, category = ?, description = ?, type = ?, tvaRate = ? WHERE id = ? AND companyId = ?')
      .run(name, sku, price, stock, category, description, type, tvaRate, id, req.user!.companyId);
    res.json({ id, name, sku, price, stock, category, description, type, tvaRate });
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    req.db.prepare('DELETE FROM products WHERE id = ? AND companyId = ?').run(id, req.user!.companyId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
