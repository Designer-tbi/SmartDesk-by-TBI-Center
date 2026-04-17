import { Router } from 'express';
import { requireTenant } from '../middleware/auth';
import { logActivity } from '../activity';

export const productsRouter = Router();

productsRouter.use(...requireTenant);

productsRouter.get('/', async (req, res, next) => {
  try {
    const products = await req.db.query('SELECT * FROM products WHERE "companyId" = $1', [req.user!.companyId]);
    res.json(products.rows);
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/', async (req, res, next) => {
  try {
    const { id, name, sku, price, stock, category, description, type, tvaRate } = req.body;
    await req.db.query('INSERT INTO products (id, "companyId", name, sku, price, stock, category, description, type, "tvaRate") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [id, req.user!.companyId, name, sku, price, stock, category, description, type, tvaRate]);
    
    await logActivity(req.db, req.user!.id, req.user!.companyId, 'CREATE_PRODUCT', `Nouveau produit ajouté: ${name} (SKU: ${sku})`);
    
    res.status(201).json({ id, name, sku, price, stock, category, description, type, tvaRate });
  } catch (error) {
    next(error);
  }
});

productsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, sku, price, stock, category, description, type, tvaRate } = req.body;
    await req.db.query('UPDATE products SET name = $1, sku = $2, price = $3, stock = $4, category = $5, description = $6, type = $7, "tvaRate" = $8 WHERE id = $9 AND "companyId" = $10',
      [name, sku, price, stock, category, description, type, tvaRate, id, req.user!.companyId]);
    
    await logActivity(req.db, req.user!.id, req.user!.companyId, 'UPDATE_PRODUCT', `Produit mis à jour: ${name}`);
    
    res.json({ id, name, sku, price, stock, category, description, type, tvaRate });
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM products WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    
    await logActivity(req.db, req.user!.id, req.user!.companyId, 'DELETE_PRODUCT', `Produit supprimé (ID: ${id})`);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
