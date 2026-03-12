import React, { useState, useEffect } from 'react';
import { Plus, Package, AlertTriangle, ArrowRightLeft, Tag, X, Save, Eye, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Product } from '../types';

export const Inventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isStockMovementOpen, setIsStockMovementOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ name: '', sku: '', price: 0, stock: 0, category: '', description: '', type: 'product', tvaRate: 0.18 });
  const [newCategory, setNewCategory] = useState('');
  const [movement, setMovement] = useState({ productId: '', quantity: 0, type: 'IN' as 'IN' | 'OUT' });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
        setCategories(Array.from(new Set(data.map((p: Product) => p.category))));
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        // Update logic (not implemented in server yet, but let's assume PUT)
        const response = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProduct),
        });
        if (response.ok) fetchProducts();
        setEditingProduct(null);
      } else {
        const id = Math.random().toString(36).substr(2, 9);
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newProduct, id }),
        });
        if (response.ok) fetchProducts();
      }
      setIsAddProductOpen(false);
      setNewProduct({ name: '', sku: '', price: 0, stock: 0, category: '', description: '', type: 'product', tvaRate: 0.18 });
    } catch (error) {
      console.error('Failed to save product:', error);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      try {
        const response = await fetch(`/api/products/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) fetchProducts();
        if (viewProduct?.id === id) setViewProduct(null);
      } catch (error) {
        console.error('Failed to delete product:', error);
      }
    }
  };

  const handleMovement = (e: React.FormEvent) => {
    e.preventDefault();
    setProducts(products.map(p => {
      if (p.id === movement.productId) {
        const newStock = movement.type === 'IN' ? p.stock + movement.quantity : p.stock - movement.quantity;
        return { ...p, stock: Math.max(0, newStock) };
      }
      return p;
    }));
    setIsStockMovementOpen(false);
    setMovement({ productId: '', quantity: 0, type: 'IN' });
  };

  const handleDeleteCategory = (cat: string) => {
    if (window.confirm(`Supprimer la catégorie "${cat}" ? Les produits associés seront sans catégorie.`)) {
      setCategories(categories.filter(c => c !== cat));
      setProducts(products.map(p => p.category === cat ? { ...p, category: '' } : p));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Produits</p>
              <p className="text-2xl font-bold text-slate-900">{products.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Stock Faible</p>
              <p className="text-2xl font-bold text-slate-900">{products.filter(p => p.stock < 10).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Tag className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Valeur Stock</p>
              <p className="text-2xl font-bold text-slate-900">{products.reduce((sum, p) => sum + (p.price * p.stock), 0).toLocaleString()} XAF</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Catalogue Produits</h2>
        <div className="flex gap-3">
          <button onClick={() => setIsCategoryManagerOpen(true)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Tag className="w-4 h-4" />
            Gérer Catégories
          </button>
          <button onClick={() => setIsStockMovementOpen(true)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <ArrowRightLeft className="w-4 h-4" />
            Mouvement Stock
          </button>
          <button onClick={() => { setEditingProduct(null); setNewProduct({ name: '', sku: '', price: 0, stock: 0, category: '' }); setIsAddProductOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Ajouter Produit
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-sm font-medium text-slate-500">Chargement du catalogue...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produit</th>
                <th className="hidden sm:table-cell px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU</th>
                <th className="hidden md:table-cell px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="hidden lg:table-cell px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Catégorie</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prix Unitaire</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length > 0 ? products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-slate-900">{product.name}</div>
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-sm text-slate-500 font-mono">
                    {product.sku}
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-600 capitalize">
                    {product.type}
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 text-sm text-slate-600">
                    {product.category}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {product.price.toLocaleString()} XAF
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${product.stock < 10 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {product.stock}
                      </span>
                      {product.stock < 10 && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setViewProduct(product)} className="text-slate-400 hover:text-indigo-600"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => { setEditingProduct(product); setNewProduct(product); setIsAddProductOpen(true); }} className="text-slate-400 hover:text-amber-600"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteProduct(product.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500 text-sm">
                    Aucun produit trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">{editingProduct ? 'Modifier' : 'Ajouter'} un produit</h3>
              <button onClick={() => setIsAddProductOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <input type="text" placeholder="Nom" className="w-full p-2 border rounded-lg" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required />
              <input type="text" placeholder="SKU" className="w-full p-2 border rounded-lg" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} required />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Prix" className="w-full p-2 border rounded-lg" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})} required />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Taux TVA</label>
                  <select className="w-full p-2 border rounded-lg text-sm" value={newProduct.tvaRate} onChange={e => setNewProduct({...newProduct, tvaRate: parseFloat(e.target.value)})}>
                    <option value={0.20}>20%</option>
                    <option value={0.18}>18%</option>
                    <option value={0.05}>5%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>
              <input type="number" placeholder="Stock Initial" className="w-full p-2 border rounded-lg" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})} required />
              <textarea placeholder="Description" className="w-full p-2 border rounded-lg" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              
              <div className="space-y-2">
                <select className="w-full p-2 border rounded-lg" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} required>
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="w-full p-2 border rounded-lg" value={newProduct.type} onChange={e => setNewProduct({...newProduct, type: e.target.value as 'product' | 'service'})} required>
                  <option value="product">Produit</option>
                  <option value="service">Service</option>
                </select>
              </div>

              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold">Enregistrer</button>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Gérer les catégories</h3>
              <button onClick={() => setIsCategoryManagerOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat} className="flex justify-between items-center p-2 border rounded-lg">
                  {cat}
                  <button onClick={() => handleDeleteCategory(cat)} className="text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input type="text" placeholder="Nouvelle catégorie" className="flex-1 p-2 border rounded-lg" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
                <button onClick={() => { if(newCategory && !categories.includes(newCategory)) { setCategories([...categories, newCategory]); setNewCategory(''); } }} className="px-3 bg-indigo-600 text-white rounded-lg">Ajouter</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Preview Modal */}
      {viewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Détails Produit</h3>
              <button onClick={() => setViewProduct(null)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <div className="space-y-2">
              <p><strong>Nom:</strong> {viewProduct.name}</p>
              <p><strong>SKU:</strong> {viewProduct.sku}</p>
              <p><strong>Catégorie:</strong> {viewProduct.category}</p>
              <p><strong>Type:</strong> {viewProduct.type === 'product' ? 'Produit' : 'Service'}</p>
              <p><strong>Prix:</strong> {viewProduct.price.toLocaleString()} XAF</p>
              <p><strong>Taux TVA:</strong> {(viewProduct.tvaRate * 100).toFixed(0)}%</p>
              <p><strong>Stock:</strong> {viewProduct.stock}</p>
              <p><strong>Description:</strong> {viewProduct.description || 'Aucune description'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stock Movement Modal */}
      {isStockMovementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Mouvement de stock</h3>
              <button onClick={() => setIsStockMovementOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <form onSubmit={handleMovement} className="space-y-4">
              <select className="w-full p-2 border rounded-lg" onChange={e => setMovement({...movement, productId: e.target.value})} required>
                <option value="">Sélectionner un produit</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" placeholder="Quantité" className="w-full p-2 border rounded-lg" onChange={e => setMovement({...movement, quantity: parseInt(e.target.value)})} required />
              <select className="w-full p-2 border rounded-lg" onChange={e => setMovement({...movement, type: e.target.value as 'IN' | 'OUT'})}>
                <option value="IN">Entrée (Réception)</option>
                <option value="OUT">Sortie (Vente/Perte)</option>
              </select>
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold">Valider Mouvement</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
