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

  const currentTvaRate = newProduct.tvaRate ?? 0.18;
  const tvaAmount = (newProduct.price || 0) * currentTvaRate;
  const totalTTC = (newProduct.price || 0) + tvaAmount;

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
        setError(t('inventory.error.delete'));
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
        <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-soft-red rounded-xl">
              <Package className="w-6 h-6 text-accent-red" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">{t('inventory.totalProducts')}</p>
              <p className="text-2xl font-bold text-accent-red">{products.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">{t('inventory.lowStock')}</p>
              <p className="text-2xl font-bold text-slate-900">{products.filter(p => p.stock < 10).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Tag className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">{t('inventory.stockValue')}</p>
              <p className="text-2xl font-bold text-slate-900">{products.reduce((sum, p) => sum + (p.price * p.stock), 0).toLocaleString()} {currencySymbol}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{t('inventory.productCatalog')}</h2>
        <div className="flex gap-3">
          <button onClick={() => setIsCategoryManagerOpen(true)} className="flex items-center gap-2 px-4 py-2 border border-red-100 rounded-lg text-sm font-medium text-accent-red hover:bg-soft-red transition-colors">
            <Tag className="w-4 h-4" />
            {t('inventory.manageCategories')}
          </button>
          <button onClick={() => setIsStockMovementOpen(true)} className="flex items-center gap-2 px-4 py-2 border border-red-100 rounded-lg text-sm font-medium text-accent-red hover:bg-soft-red transition-colors">
            <ArrowRightLeft className="w-4 h-4" />
            {t('inventory.stockMovement')}
          </button>
          <button onClick={() => { setEditingProduct(null); setNewProduct({ name: '', sku: '', price: 0, stock: 0, category: '', description: '', type: 'product', tvaRate: 0.18 }); setIsAddProductOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-accent-red text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm shadow-accent-red/20">
            <Plus className="w-4 h-4" />
            {t('inventory.addProduct')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-accent-red animate-spin" />
            <p className="text-sm font-medium text-slate-500">{t('inventory.loadingCatalog')}</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-soft-red/30 border-b border-red-100">
                <th className="px-6 py-4 text-xs font-semibold text-accent-red uppercase tracking-wider">{t('inventory.product')}</th>
                <th className="hidden sm:table-cell px-6 py-4 text-xs font-semibold text-accent-red uppercase tracking-wider">{t('inventory.sku')}</th>
                <th className="hidden md:table-cell px-6 py-4 text-xs font-semibold text-accent-red uppercase tracking-wider">{t('inventory.type')}</th>
                <th className="hidden lg:table-cell px-6 py-4 text-xs font-semibold text-accent-red uppercase tracking-wider">{t('inventory.category')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-accent-red uppercase tracking-wider">{t('inventory.unitPrice')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-accent-red uppercase tracking-wider">{t('inventory.stock')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-accent-red uppercase tracking-wider text-right">{t('inventory.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-50">
              {products.length > 0 ? products.map((product) => (
                <tr key={product.id} className="hover:bg-soft-red/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-accent-red group-hover:text-red-700 transition-colors">{product.name}</div>
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-sm text-slate-500 font-mono">
                    {product.sku}
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-600 capitalize">
                    {product.type === 'product' ? t('inventory.productType') : t('inventory.serviceType')}
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 text-sm text-slate-600">
                    <span className="px-2 py-1 bg-luxury-gray rounded-md text-xs font-medium text-slate-600">
                      {product.category}
                    </span>
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
                      <button onClick={() => setViewProduct(product)} className="text-slate-400 hover:text-accent-red p-1.5 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-red-100" title={t('common.view')}><Eye className="w-4 h-4" /></button>
                      <button onClick={() => { setEditingProduct(product); setNewProduct(product); setIsAddProductOpen(true); }} className="text-slate-400 hover:text-amber-600 p-1.5 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-amber-100" title={t('common.edit')}><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteConfirmId(product.id)} className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-rose-100" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
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

      {/* Add/Edit Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-accent-red/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[95vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-red-100">
            <div className="px-6 py-5 border-b border-red-50 flex justify-between items-center bg-soft-red/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-red-100">
                  <Package className="w-5 h-5 text-accent-red" />
                </div>
                <h3 className="text-xl font-bold text-accent-red">
                  {editingProduct ? t('inventory.editProduct') : t('inventory.newProduct')}
                </h3>
              </div>
              <button 
                onClick={() => setIsAddProductOpen(false)}
                className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-rose-500 hover:shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex flex-col overflow-hidden">
              <div className="p-6 sm:p-8 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Informations Générales */}
                  <div className="space-y-5 lg:col-span-2">
                  <h4 className="text-xs font-bold text-accent-red uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    {t('inventory.generalInfo')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">{t('inventory.productName')}</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Ordinateur Portable" 
                        className="w-full px-4 py-2.5 bg-luxury-gray border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red outline-none transition-all text-sm" 
                        value={newProduct.name || ''} 
                        onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">{t('inventory.skuRef')}</label>
                      <input 
                        type="text" 
                        placeholder="Ex: PROD-001" 
                        className="w-full px-4 py-2.5 bg-luxury-gray border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red outline-none transition-all text-sm font-mono" 
                        value={newProduct.sku || ''} 
                        onChange={e => setNewProduct({...newProduct, sku: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                </div>

                {/* Catégorie et Type */}
                <div className="space-y-5">
                  <h4 className="text-xs font-bold text-accent-red uppercase tracking-widest flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5" />
                    {t('inventory.classification')}
                  </h4>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">{t('inventory.category')}</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-luxury-gray border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red outline-none transition-all text-sm appearance-none cursor-pointer" 
                        value={newProduct.category || ''} 
                        onChange={e => setNewProduct({...newProduct, category: e.target.value})} 
                        required
                      >
                        <option value="">{t('inventory.selectCategory')}</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">{t('inventory.resourceType')}</label>
                      <div className="flex gap-4">
                        <label className="flex-1 cursor-pointer">
                          <input 
                            type="radio" 
                            name="type" 
                            className="peer hidden" 
                            checked={newProduct.type === 'product'} 
                            onChange={() => setNewProduct({...newProduct, type: 'product'})} 
                          />
                          <div className="py-2.5 text-center border border-transparent bg-luxury-gray rounded-xl text-sm font-medium text-slate-600 peer-checked:bg-soft-red peer-checked:border-accent-red peer-checked:text-accent-red peer-checked:ring-2 peer-checked:ring-accent-red/10 transition-all">
                            {t('inventory.productType')}
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
                          <div className="py-2.5 text-center border border-transparent bg-luxury-gray rounded-xl text-sm font-medium text-slate-600 peer-checked:bg-soft-red peer-checked:border-accent-red peer-checked:text-accent-red peer-checked:ring-2 peer-checked:ring-accent-red/10 transition-all">
                            {t('inventory.serviceType')}
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prix et Stock */}
                <div className="space-y-5">
                  <h4 className="text-xs font-bold text-accent-red uppercase tracking-widest flex items-center gap-2">
                    <Calculator className="w-3.5 h-3.5" />
                    {t('inventory.priceAndStock')}
                  </h4>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">{t('inventory.priceHT')} ({currencySymbol})</label>
                        <input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          className="w-full px-4 py-2.5 bg-luxury-gray border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red outline-none transition-all text-sm" 
                          value={newProduct.price || 0} 
                          onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value) || 0})} 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">{t('inventory.tvaRate')}</label>
                        <select 
                          className="w-full px-4 py-2.5 bg-luxury-gray border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red outline-none transition-all text-sm appearance-none cursor-pointer" 
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
                    
                    <div className="grid grid-cols-2 gap-4 p-4 bg-soft-red/20 rounded-2xl border border-red-100/50">
                      <div>
                        <p className="text-[10px] font-bold text-accent-red uppercase tracking-widest mb-1">{t('inventory.taxAmount', { taxLabel })}</p>
                        <p className="text-sm font-bold text-accent-red">{tvaAmount.toLocaleString()} {currencySymbol}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-accent-red uppercase tracking-widest mb-1">{t('inventory.totalTTC')}</p>
                        <p className="text-sm font-bold text-accent-red">{totalTTC.toLocaleString()} {currencySymbol}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">{t('inventory.initialStock')}</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        className="w-full px-4 py-2.5 bg-luxury-gray border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red outline-none transition-all text-sm" 
                        value={newProduct.stock || 0} 
                        onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})} 
                        required 
                      />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-5 lg:col-span-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">{t('inventory.description')}</label>
                    <textarea 
                      placeholder={t('inventory.descriptionPlaceholder')} 
                      rows={3}
                      className="w-full px-4 py-3 bg-luxury-gray border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red outline-none transition-all text-sm resize-none" 
                      value={newProduct.description || ''} 
                      onChange={e => setNewProduct({...newProduct, description: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
              </div>

              <div className="p-6 sm:p-8 border-t border-red-50 bg-gray-50 flex gap-4 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="flex-1 px-6 py-3 border border-red-100 text-slate-600 rounded-xl font-bold hover:bg-soft-red transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-[2] bg-accent-red text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-accent-red/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {editingProduct ? t('common.update') : t('inventory.saveProduct')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-accent-red/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-2xl p-8 space-y-6 border border-red-100">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-accent-red">{t('inventory.manageCategories')}</h3>
              <button onClick={() => setIsCategoryManagerOpen(false)} className="p-2 hover:bg-soft-red rounded-full transition-colors text-slate-400 hover:text-rose-500">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {categories.map(cat => (
                <div key={cat} className="flex justify-between items-center p-3 bg-luxury-gray rounded-xl border border-transparent hover:border-red-100 transition-all group">
                  <span className="text-sm font-medium text-slate-700">{cat}</span>
                  <button onClick={() => setDeleteCategoryConfirm(cat)} className="text-slate-400 hover:text-rose-500 p-1.5 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100 shadow-sm">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <input 
                type="text" 
                placeholder={t('inventory.newCategory')} 
                className="flex-1 px-4 py-2.5 bg-luxury-gray border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red outline-none transition-all text-sm" 
                value={newCategory || ''} 
                onChange={e => setNewCategory(e.target.value)} 
              />
              <button 
                onClick={() => { if(newCategory && !categories.includes(newCategory)) { setCategories([...categories, newCategory]); setNewCategory(''); } }} 
                className="px-6 bg-accent-red text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-md shadow-accent-red/20"
              >
                {t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Preview Modal */}
      {viewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-accent-red/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-red-100">
            <div className="px-6 py-5 bg-soft-red/30 border-b border-red-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-accent-red">{t('inventory.productDetails')}</h3>
              <button onClick={() => setViewProduct(null)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-rose-500">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-accent-red uppercase tracking-widest">{t('inventory.productName')}</p>
                  <p className="text-base font-semibold text-slate-900">{viewProduct.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-accent-red uppercase tracking-widest">{t('inventory.sku')}</p>
                  <p className="text-base font-mono text-slate-600">{viewProduct.sku}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-accent-red uppercase tracking-widest">{t('inventory.category')}</p>
                  <p className="text-base font-medium text-slate-700">{viewProduct.category}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-accent-red uppercase tracking-widest">{t('inventory.type')}</p>
                  <p className="text-base font-medium text-slate-700">{viewProduct.type === 'product' ? t('inventory.productType') : t('inventory.serviceType')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-accent-red uppercase tracking-widest">{t('inventory.priceHT')}</p>
                  <p className="text-base font-bold text-accent-red">{viewProduct.price.toLocaleString()} {currencySymbol}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-accent-red uppercase tracking-widest">{t('inventory.tvaRate')}</p>
                  <p className="text-base font-medium text-slate-700">{(viewProduct.tvaRate * 100).toFixed(0)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-accent-red uppercase tracking-widest">{t('inventory.stock')}</p>
                  <p className={`text-base font-bold ${viewProduct.stock < 10 ? 'text-rose-600' : 'text-emerald-600'}`}>{viewProduct.stock}</p>
                </div>
              </div>
              <div className="space-y-1 pt-4 border-t border-red-50">
                <p className="text-[10px] font-bold text-accent-red uppercase tracking-widest">{t('inventory.description')}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{viewProduct.description || t('inventory.noDescription')}</p>
              </div>
              <div className="pt-4">
                <button 
                  onClick={() => setViewProduct(null)}
                  className="w-full py-3 bg-luxury-gray text-slate-700 rounded-xl font-bold hover:bg-soft-red transition-all"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Movement Modal */}
      {isStockMovementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-accent-red/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-2xl p-8 space-y-6 border border-red-100">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-accent-red">{t('inventory.stockMovementTitle')}</h3>
              <button onClick={() => setIsStockMovementOpen(false)} className="p-2 hover:bg-soft-red rounded-full transition-colors text-slate-400 hover:text-rose-500">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <form onSubmit={handleMovement} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">{t('inventory.selectProduct')}</label>
                <select 
                  className="w-full px-4 py-2.5 bg-luxury-gray border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red outline-none transition-all text-sm appearance-none cursor-pointer" 
                  onChange={e => setMovement({...movement, productId: e.target.value})} 
                  required
                >
                  <option value="">{t('inventory.selectProduct')}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">{t('inventory.quantity')}</label>
                <input 
                  type="number" 
                  placeholder={t('inventory.quantity')} 
                  className="w-full px-4 py-2.5 bg-luxury-gray border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red outline-none transition-all text-sm" 
                  onChange={e => setMovement({...movement, quantity: parseInt(e.target.value)})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">{t('inventory.movementType')}</label>
                <div className="flex gap-4">
                  <label className="flex-1 cursor-pointer">
                    <input 
                      type="radio" 
                      name="moveType" 
                      className="peer hidden" 
                      checked={movement.type === 'IN'} 
                      onChange={() => setMovement({...movement, type: 'IN'})} 
                    />
                    <div className="py-2.5 text-center border border-transparent bg-luxury-gray rounded-xl text-sm font-medium text-slate-600 peer-checked:bg-emerald-50 peer-checked:border-emerald-500 peer-checked:text-emerald-700 peer-checked:ring-2 peer-checked:ring-emerald-500/10 transition-all">
                      {t('inventory.in')}
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input 
                      type="radio" 
                      name="moveType" 
                      className="peer hidden" 
                      checked={movement.type === 'OUT'} 
                      onChange={() => setMovement({...movement, type: 'OUT'})} 
                    />
                    <div className="py-2.5 text-center border border-transparent bg-luxury-gray rounded-xl text-sm font-medium text-slate-600 peer-checked:bg-rose-50 peer-checked:border-rose-500 peer-checked:text-rose-700 peer-checked:ring-2 peer-checked:ring-rose-500/10 transition-all">
                      {t('inventory.out')}
                    </div>
                  </label>
                </div>
              </div>
              <button 
                type="submit" 
                className="w-full bg-accent-red text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-accent-red/20 mt-4"
              >
                {t('inventory.validateMovement')}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Confirm Modals */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title={t('inventory.deleteProduct')}
        message={t('inventory.confirmDeleteProduct')}
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteConfirmId && handleDeleteProduct(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <ConfirmModal
        isOpen={!!deleteCategoryConfirm}
        title={t('inventory.deleteCategory')}
        message={t('inventory.confirmDeleteCategory', { category: deleteCategoryConfirm || '' })}
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteCategoryConfirm && handleDeleteCategory(deleteCategoryConfirm)}
        onCancel={() => setDeleteCategoryConfirm(null)}
      />
    </div>
  );
};
