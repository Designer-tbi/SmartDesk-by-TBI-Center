import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Plus, Package, AlertTriangle, ArrowRightLeft, Tag, X, Save, Eye, Pencil, Trash2, Loader2, Calculator, FileText } from 'lucide-react';
import { Product } from '../types';

import { useTranslation } from '../lib/i18n';

import { ConfirmModal } from '../components/ConfirmModal';

export const Inventory = ({ user }: { user: any }) => {
  const { t } = useTranslation();
  const isUS = user?.country === 'USA';
  const currencySymbol = user?.currency === 'USD' ? '$' : user?.currency === 'EUR' ? '€' : user?.currency === 'XAF' ? 'XAF' : (isUS ? '$' : '€');

  const taxLabel = isUS ? t('accounting.salesTax') : t('accounting.tva');
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/products');
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
    setIsSubmitting(true);
    try {
      if (editingProduct) {
        // Update logic (not implemented in server yet, but let's assume PUT)
        const response = await apiFetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProduct),
        });
        if (response.ok) fetchProducts();
        setEditingProduct(null);
      } else {
        const id = Math.random().toString(36).substr(2, 9);
        const response = await apiFetch('/api/products', {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const response = await apiFetch(`/api/products/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchProducts();
        if (viewProduct?.id === id) setViewProduct(null);
        setDeleteConfirmId(null);
      } else {
        setError('Erreur lors de la suppression.');
      }
    } catch (error) {
      console.error('Failed to delete product:', error);
      setError('Erreur de connexion.');
    }
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === movement.productId);
    if (!product) return;

    const newStock = movement.type === 'IN' ? product.stock + movement.quantity : product.stock - movement.quantity;
    const updatedProduct = { ...product, stock: Math.max(0, newStock) };

    try {
      const response = await apiFetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProduct),
      });
      if (response.ok) {
        fetchProducts();
      }
      setIsStockMovementOpen(false);
      setMovement({ productId: '', quantity: 0, type: 'IN' });
    } catch (error) {
      console.error('Failed to update stock:', error);
    }
  };

  const handleDeleteCategory = (cat: string) => {
    setCategories(categories.filter(c => c !== cat));
    setProducts(products.map(p => p.category === cat ? { ...p, category: '' } : p));
    setDeleteCategoryConfirm(null);
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
              <p className="text-2xl font-bold text-slate-900">{products.reduce((sum, p) => sum + (p.price * p.stock), 0).toLocaleString()} {currencySymbol}</p>
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
                    {product.price.toLocaleString()} {currencySymbol}
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
                    <div className="flex justify-end gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-all sm:translate-x-2 sm:group-hover:translate-x-0">
                      <button onClick={() => setViewProduct(product)} className="text-slate-400 hover:text-indigo-600 p-1 hover:bg-white rounded-lg transition-all shadow-sm" title="Voir"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => { setEditingProduct(product); setNewProduct(product); setIsAddProductOpen(true); }} className="text-slate-400 hover:text-amber-600 p-1 hover:bg-white rounded-lg transition-all shadow-sm" title="Modifier"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteConfirmId(product.id)} className="text-slate-400 hover:text-red-600 p-1 hover:bg-white rounded-lg transition-all shadow-sm" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
                </h3>
              </div>
              <button 
                onClick={() => setIsAddProductOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informations Générales */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-3 h-3" />
                    Informations Générales
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 ml-1">Nom du produit</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Ex: Ordinateur Portable" 
                          className="w-full pl-3 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" 
                          value={newProduct.name || ''} 
                          onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
                          required 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 ml-1">Référence (SKU)</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Ex: PROD-001" 
                          className="w-full pl-3 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-mono" 
                          value={newProduct.sku || ''} 
                          onChange={e => setNewProduct({...newProduct, sku: e.target.value})} 
                          required 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Catégorie et Type */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Tag className="w-3 h-3" />
                    Classification
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 ml-1">Catégorie</label>
                      <select 
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm bg-white" 
                        value={newProduct.category || ''} 
                        onChange={e => setNewProduct({...newProduct, category: e.target.value})} 
                        required
                      >
                        <option value="">Sélectionner une catégorie</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 ml-1">Type de ressource</label>
                      <div className="flex gap-4">
                        <label className="flex-1 cursor-pointer">
                          <input 
                            type="radio" 
                            name="type" 
                            className="peer hidden" 
                            checked={newProduct.type === 'product'} 
                            onChange={() => setNewProduct({...newProduct, type: 'product'})} 
                          />
                          <div className="py-2 text-center border border-slate-200 rounded-xl text-sm font-medium text-slate-600 peer-checked:bg-indigo-50 peer-checked:border-indigo-600 peer-checked:text-indigo-700 transition-all">
                            Produit
                          </div>
                        </label>
                        <label className="flex-1 cursor-pointer">
                          <input 
                            type="radio" 
                            name="type" 
                            className="peer hidden" 
                            checked={newProduct.type === 'service'} 
                            onChange={() => setNewProduct({...newProduct, type: 'service'})} 
                          />
                          <div className="py-2 text-center border border-slate-200 rounded-xl text-sm font-medium text-slate-600 peer-checked:bg-indigo-50 peer-checked:border-indigo-600 peer-checked:text-indigo-700 transition-all">
                            Service
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prix et Stock */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calculator className="w-3 h-3" />
                    Prix & Stock
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 ml-1">Prix HT ({currencySymbol})</label>
                        <input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" 
                          value={newProduct.price ?? 0} 
                          onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})} 
                          required 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 ml-1">Taux TVA</label>
                        <select 
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm bg-white" 
                          value={newProduct.tvaRate ?? 0.18} 
                          onChange={e => setNewProduct({...newProduct, tvaRate: parseFloat(e.target.value)})}
                        >
                          <option value={0.20}>20%</option>
                          <option value={0.18}>18%</option>
                          <option value={0.05}>5%</option>
                          <option value={0}>0%</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 ml-1">Stock Initial</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          placeholder="0" 
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" 
                          value={newProduct.stock ?? 0} 
                          onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})} 
                          required 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-4 md:col-span-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 ml-1">Description</label>
                    <textarea 
                      placeholder="Détails du produit, caractéristiques techniques..." 
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm resize-none" 
                      value={newProduct.description || ''} 
                      onChange={e => setNewProduct({...newProduct, description: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-[2] bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {editingProduct ? 'Mettre à jour' : 'Enregistrer le produit'}
                </button>
              </div>
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
                  <button onClick={() => setDeleteCategoryConfirm(cat)} className="text-red-500 hover:bg-red-50 p-1 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input type="text" placeholder="Nouvelle catégorie" className="flex-1 p-2 border rounded-lg" value={newCategory || ''} onChange={e => setNewCategory(e.target.value)} />
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
              <p><strong>Prix:</strong> {viewProduct.price.toLocaleString()} {currencySymbol}</p>
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
      {/* Confirm Modals */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Supprimer le produit"
        message="Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={() => deleteConfirmId && handleDeleteProduct(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <ConfirmModal
        isOpen={!!deleteCategoryConfirm}
        title="Supprimer la catégorie"
        message={`Supprimer la catégorie "${deleteCategoryConfirm}" ? Les produits associés seront sans catégorie.`}
        confirmLabel="Supprimer"
        onConfirm={() => deleteCategoryConfirm && handleDeleteCategory(deleteCategoryConfirm)}
        onCancel={() => setDeleteCategoryConfirm(null)}
      />
    </div>
  );
};
