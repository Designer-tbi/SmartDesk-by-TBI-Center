import { Router } from 'express';
import { requireTenant } from '../middleware/auth.js';
import { logActivity } from '../../server.js';

export const productsRouter = Router();

productsRouter.use(...requireTenant);

productsRouter.get('/', async (req, res, next) => {
  try {
    const products = await req.db.query('SELECT * FROM products');
    res.json(products.rows);
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/', async (req, res, next) => {
  try {
    const { id, name, sku, price, stock, category, description, type, tvaRate } = req.body;
    await req.db.query('INSERT INTO products (id, name, sku, price, stock, category, description, type, "tvaRate") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, name, sku, price, stock, category, description, type, tvaRate]);
    
    await logActivity(req.db, req.user!.id, 'CREATE_PRODUCT', `Nouveau produit ajouté: ${name} (SKU: ${sku})`);
    
    res.status(201).json({ id, name, sku, price, stock, category, description, type, tvaRate });
  } catch (error) {
    next(error);
  }
});

productsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, sku, price, stock, category, description, type, tvaRate } = req.body;
    await req.db.query('UPDATE products SET name = $1, sku = $2, price = $3, stock = $4, category = $5, description = $6, type = $7, "tvaRate" = $8 WHERE id = $9',
      [name, sku, price, stock, category, description, type, tvaRate, id]);
    
    await logActivity(req.db, req.user!.id, 'UPDATE_PRODUCT', `Produit mis à jour: ${name}`);
    
    res.json({ id, name, sku, price, stock, category, description, type, tvaRate });
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM products WHERE id = $1', [id]);
    
    await logActivity(req.db, req.user!.id, 'DELETE_PRODUCT', `Produit supprimé (ID: ${id})`);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
