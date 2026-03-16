import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Plus, Package, AlertTriangle, ArrowRightLeft, Tag, X, Save, Eye, Pencil, Trash2, Loader2, Search } from 'lucide-react';
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
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'Hardware' | 'Service' | 'Software'>('all');
  
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
        setError(t('inventory.error.delete'));
      }
    } catch (error) {
      console.error('Failed to delete product:', error);
      setError(t('inventory.error.connection'));
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 sm:p-3 bg-indigo-50 rounded-xl">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-slate-500 font-medium uppercase tracking-wider">{t('inventory.totalProducts')}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{products.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 sm:p-3 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-slate-500 font-medium uppercase tracking-wider">{t('inventory.lowStock')}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{products.filter(p => p.stock < 10).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-4">
            <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-xl">
              <Tag className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-slate-500 font-medium uppercase tracking-wider">{t('inventory.stockValue')}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{products.reduce((sum, p) => sum + (p.price * p.stock), 0).toLocaleString()} {currencySymbol}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 flex-1">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder={t('inventory.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm overflow-x-auto scrollbar-hide">
            {(['all', 'Hardware', 'Service', 'Software'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                  filter === f 
                    ? "bg-slate-900 text-white shadow-md" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {f === 'all' ? t('inventory.all') : f === 'Hardware' ? t('inventory.hardware') : f === 'Service' ? t('inventory.services') : t('inventory.software')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => setIsCategoryManagerOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <Tag className="w-4 h-4" />
            <span className="hidden sm:inline">{t('inventory.manageCategories')}</span>
          </button>
          <button onClick={() => setIsStockMovementOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <ArrowRightLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t('inventory.stockMovement')}</span>
          </button>
          <button onClick={() => { setEditingProduct(null); setNewProduct({ name: '', sku: '', price: 0, stock: 0, category: '' }); setIsAddProductOpen(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95">
            <Plus className="w-5 h-5" />
            <span className="whitespace-nowrap">{t('inventory.addProduct')}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-slate-500">{t('inventory.loadingCatalog')}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('inventory.product')}</th>
                <th className="hidden sm:table-cell px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('inventory.sku')}</th>
                <th className="hidden md:table-cell px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('inventory.type')}</th>
                <th className="hidden lg:table-cell px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('inventory.category')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('inventory.unitPrice')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('inventory.stock')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">{t('inventory.actions')}</th>
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
                    {product.type === 'product' ? t('inventory.product') : t('inventory.service')}
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
                    {t('inventory.noProductFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">{editingProduct ? t('common.edit') : t('common.add')} {t('inventory.product').toLowerCase()}</h3>
              <button onClick={() => setIsAddProductOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <input type="text" placeholder={t('common.name')} className="w-full p-2 border rounded-lg" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required />
              <input type="text" placeholder={t('inventory.sku')} className="w-full p-2 border rounded-lg" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} required />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder={t('inventory.unitPrice')} className="w-full p-2 border rounded-lg" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})} required />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('inventory.tvaRate')}</label>
                  <select className="w-full p-2 border rounded-lg text-sm" value={newProduct.tvaRate} onChange={e => setNewProduct({...newProduct, tvaRate: parseFloat(e.target.value)})}>
                    <option value={0.20}>20%</option>
                    <option value={0.18}>18%</option>
                    <option value={0.05}>5%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>
              <input type="number" placeholder={t('inventory.initialStock')} className="w-full p-2 border rounded-lg" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})} required />
              <textarea placeholder={t('common.description')} className="w-full p-2 border rounded-lg" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              
              <div className="space-y-2">
                <select className="w-full p-2 border rounded-lg" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} required>
                  <option value="">{t('inventory.category')}</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="w-full p-2 border rounded-lg" value={newProduct.type} onChange={e => setNewProduct({...newProduct, type: e.target.value as 'product' | 'service'})} required>
                  <option value="product">{t('inventory.product')}</option>
                  <option value="service">{t('inventory.service')}</option>
                </select>
              </div>

              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold">{t('common.save')}</button>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">{t('inventory.manageCategories')}</h3>
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
                <input type="text" placeholder={t('inventory.newCategory')} className="flex-1 p-2 border rounded-lg" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
                <button onClick={() => { if(newCategory && !categories.includes(newCategory)) { setCategories([...categories, newCategory]); setNewCategory(''); } }} className="px-3 bg-indigo-600 text-white rounded-lg">{t('common.add')}</button>
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
              <h3 className="text-lg font-bold">{t('inventory.productDetails')}</h3>
              <button onClick={() => setViewProduct(null)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <div className="space-y-2">
              <p><strong>{t('common.name')}:</strong> {viewProduct.name}</p>
              <p><strong>{t('inventory.sku')}:</strong> {viewProduct.sku}</p>
              <p><strong>{t('inventory.category')}:</strong> {viewProduct.category}</p>
              <p><strong>{t('inventory.type')}:</strong> {viewProduct.type === 'product' ? t('inventory.product') : t('inventory.service')}</p>
              <p><strong>{t('inventory.unitPrice')}:</strong> {viewProduct.price.toLocaleString()} {currencySymbol}</p>
              <p><strong>{t('inventory.tvaRate')}:</strong> {(viewProduct.tvaRate * 100).toFixed(0)}%</p>
              <p><strong>{t('inventory.stock')}:</strong> {viewProduct.stock}</p>
              <p><strong>{t('common.description')}:</strong> {viewProduct.description || t('inventory.noDescription')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stock Movement Modal */}
      {isStockMovementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">{t('inventory.stockMovementTitle')}</h3>
              <button onClick={() => setIsStockMovementOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <form onSubmit={handleMovement} className="space-y-4">
              <select className="w-full p-2 border rounded-lg" onChange={e => setMovement({...movement, productId: e.target.value})} required>
                <option value="">{t('inventory.selectProduct')}</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" placeholder={t('inventory.quantity')} className="w-full p-2 border rounded-lg" onChange={e => setMovement({...movement, quantity: parseInt(e.target.value)})} required />
              <select className="w-full p-2 border rounded-lg" onChange={e => setMovement({...movement, type: e.target.value as 'IN' | 'OUT'})}>
                <option value="IN">{t('inventory.in')}</option>
                <option value="OUT">{t('inventory.out')}</option>
              </select>
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold">{t('inventory.validateMovement')}</button>
            </form>
          </div>
        </div>
      )}
      {/* Confirm Modals */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title={t('common.delete') + ' ' + t('inventory.product').toLowerCase()}
        message={t('inventory.confirmDeleteProduct')}
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteConfirmId && handleDeleteProduct(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <ConfirmModal
        isOpen={!!deleteCategoryConfirm}
        title={t('common.delete') + ' ' + t('inventory.category').toLowerCase()}
        message={t('inventory.confirmDeleteCategory', { category: deleteCategoryConfirm || '' })}
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteCategoryConfirm && handleDeleteCategory(deleteCategoryConfirm)}
        onCancel={() => setDeleteCategoryConfirm(null)}
      />
    </div>
  );
};
