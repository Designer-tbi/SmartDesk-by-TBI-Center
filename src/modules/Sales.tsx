import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_INVOICES, MOCK_CONTACTS, MOCK_PRODUCTS, MOCK_COMPANY, MOCK_QUOTE_TEMPLATES } from '../constants';
import { 
  Plus, Download, FileText, CheckCircle, Clock, AlertCircle, Eye, Pencil, Trash2, Mail, X, 
  FileEdit, User, Calendar, Tag, Building2, PlusCircle, Link as LinkIcon, FileSignature, Eraser,
  Copy, Layout, Send, Check
} from 'lucide-react';
import { Invoice, Contact, Product, QuoteTemplate } from '../types';

import { useTranslation } from '../lib/i18n';

import { ConfirmModal } from '../components/ConfirmModal';

export const Sales = ({ user }: { user: any }) => {
  const { t } = useTranslation();
  const isUS = user?.country === 'USA';
  const currencySymbol = user?.currency === 'USD' ? '$' : user?.currency === 'EUR' ? '€' : user?.currency === 'XAF' ? 'XAF' : (isUS ? '$' : '€');

  const taxLabel = isUS ? t('accounting.salesTax') : t('accounting.tva');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'Tous' | 'Invoice' | 'Quote'>('Tous');
  const [quoteSubTab, setQuoteSubTab] = useState<'list' | 'templates' | 'signed'>('list');
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [signingQuote, setSigningQuote] = useState<Invoice | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSending, setIsSending] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [invRes, conRes, prodRes, tmplRes] = await Promise.all([
        apiFetch('/api/invoices'),
        apiFetch('/api/contacts'),
        apiFetch('/api/products'),
        apiFetch('/api/invoices/quote-templates')
      ]);
      if (invRes.ok) setInvoices(await invRes.json());
      if (conRes.ok) setContacts(await conRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (tmplRes.ok) setTemplates(await tmplRes.json());
    } catch (error) {
      console.error('Failed to fetch sales data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    type: 'Invoice',
    contactId: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [],
    totalHT: 0,
    tvaTotal: 0,
    total: 0,
    status: 'Draft',
    notes: '',
    signedAt: '',
    description: ''
  });

  const filteredInvoices = invoices.filter(inv => filter === 'Tous' ? true : inv.type === filter);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Paid': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'Sent': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'Overdue': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'Accepted': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'Rejected': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      default: return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Paid': return 'Payée';
      case 'Sent': return 'Envoyée';
      case 'Overdue': return 'En retard';
      case 'Draft': return 'Brouillon';
      case 'Accepted': return 'Accepté';
      case 'Rejected': return 'Refusé';
      default: return status;
    }
  };

  const resetForm = () => {
    setNewInvoice({
      type: 'Invoice',
      contactId: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [],
      totalHT: 0,
      tvaTotal: 0,
      total: 0,
      status: 'Draft',
      notes: ''
    });
    setEditingInvoiceId(null);
    setIsModalOpen(false);
  };

  const calculateTotals = (items: any[]) => {
    const totalHT = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const tvaTotal = items.reduce((sum, item) => sum + (item.tvaAmount || 0), 0);
    return {
      totalHT,
      tvaTotal,
      total: totalHT + tvaTotal
    };
  };

  const handleAddItem = () => {
    setNewInvoice({
      ...newInvoice,
      items: [...(newInvoice.items || []), { productId: '', name: '', quantity: 1, price: 0 }]
    });
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...(newInvoice.items || [])];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        updatedItems[index].price = product.price;
        updatedItems[index].name = product.name;
        updatedItems[index].description = product.description;
        updatedItems[index].tvaRate = product.tvaRate;
      }
    }

    // Recalculate TVA for this item
    if (updatedItems[index].price && updatedItems[index].quantity && updatedItems[index].tvaRate !== undefined) {
      updatedItems[index].tvaAmount = updatedItems[index].price * updatedItems[index].quantity * updatedItems[index].tvaRate;
    }
    
    const totals = calculateTotals(updatedItems);
    setNewInvoice({
      ...newInvoice,
      items: updatedItems,
      ...totals
    });
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = (newInvoice.items || []).filter((_, i) => i !== index);
    const totals = calculateTotals(updatedItems);
    setNewInvoice({
      ...newInvoice,
      items: updatedItems,
      ...totals
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.contactId || (newInvoice.items || []).length === 0) {
      alert("Veuillez sélectionner un client et ajouter au moins un article.");
      return;
    }

    try {
      if (editingInvoiceId) {
        const response = await apiFetch(`/api/invoices/${editingInvoiceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newInvoice),
        });
        if (response.ok) {
          fetchData();
          resetForm();
        } else {
          setError('Erreur lors de la mise à jour.');
        }
      } else {
        const prefix = newInvoice.type === 'Invoice' ? 'INV' : 'DEV';
        const id = `${prefix}-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        const response = await apiFetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newInvoice, id }),
        });
        if (response.ok) {
          fetchData();
          resetForm();
        } else {
          setError('Erreur lors de la création.');
        }
      }
    } catch (error) {
      console.error('Failed to save invoice:', error);
      setError('Erreur de connexion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await apiFetch(`/api/invoices/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchData();
        if (viewInvoice?.id === id) setViewInvoice(null);
      } else {
        setError('Erreur lors de la suppression.');
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      setError('Erreur de connexion.');
    }
  };

  const openEdit = (invoice: Invoice) => {
    setNewInvoice(invoice);
    setEditingInvoiceId(invoice.id);
    setIsModalOpen(true);
  };

  const handleSendEmail = (invoice: Invoice) => {
    setIsSending(invoice.id);
    setTimeout(() => {
      const updatedStatus = invoice.status === 'Draft' ? 'Sent' : invoice.status;
      const signatureLink = invoice.type === 'Quote' ? `${window.location.origin}/sign-quote/${invoice.id}` : undefined;
      
      setInvoices(invoices.map(inv => inv.id === invoice.id ? { 
        ...inv, 
        status: updatedStatus,
        signatureLink
      } : inv));
      
      if (viewInvoice?.id === invoice.id) {
        setViewInvoice({ ...viewInvoice, status: updatedStatus, signatureLink });
      }
      setIsSending(null);
      alert(`Le document ${invoice.id} a été envoyé par email au client.`);
    }, 1500);
  };

  const handleSignQuote = (id: string) => {
    setInvoices(invoices.map(inv => 
      inv.id === id ? { 
        ...inv, 
        status: 'Signed', 
        signedAt: new Date().toISOString().split('T')[0] 
      } : inv
    ));
    setSigningQuote(null);
    setHasSignature(false);
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Lien de signature copié !');
  };

  const applyTemplate = (template: QuoteTemplate) => {
    const totals = calculateTotals(template.items);
    setNewInvoice({
      ...newInvoice,
      type: 'Quote',
      items: template.items,
      notes: template.notes,
      ...totals
    });
    setIsModalOpen(true);
  };

  const getContactName = (id: string) => contacts.find(c => c.id === id)?.name || 'Client inconnu';
  const getContact = (id: string) => contacts.find(c => c.id === id);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {(['Tous', 'Invoice', 'Quote'] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  if (f !== 'Quote') setQuoteSubTab('list');
                }}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                  filter === f 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {f === 'Tous' ? 'Tous' : f === 'Invoice' ? 'Factures' : 'Devis'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex gap-2">
          {filter === 'Quote' && quoteSubTab === 'templates' ? (
            <button 
              onClick={() => setIsTemplateModalOpen(true)}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Nouveau Modèle
            </button>
          ) : filter === 'Quote' && quoteSubTab === 'signed' ? (
            <label className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 cursor-pointer">
              <Plus className="w-5 h-5" />
              Réceptionner un Devis
              <input type="file" className="hidden" onChange={() => alert('Devis réceptionné !')} />
            </label>
          ) : (
            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Nouveau {filter === 'Quote' ? 'Devis' : filter === 'Invoice' ? 'Facture' : 'Document'}
            </button>
          )}
        </div>
      </div>

      {filter === 'Quote' && (
        <div className="flex gap-4 border-b border-slate-200">
          <button 
            onClick={() => setQuoteSubTab('list')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${quoteSubTab === 'list' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Liste des Devis
          </button>
          <button 
            onClick={() => setQuoteSubTab('templates')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${quoteSubTab === 'templates' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Modèles de Devis
          </button>
          <button 
            onClick={() => setQuoteSubTab('signed')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${quoteSubTab === 'signed' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Devis Signés / Réception
          </button>
        </div>
      )}

      {quoteSubTab === 'list' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Factures Payées</p>
                <p className="text-lg font-bold text-slate-900">
                  {invoices.filter(i => i.type === 'Invoice' && i.status === 'Paid').reduce((sum, i) => sum + i.total, 0).toLocaleString()} {currencySymbol}
                </p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">En attente</p>
                <p className="text-lg font-bold text-slate-900">
                  {invoices.filter(i => i.status === 'Sent').reduce((sum, i) => sum + i.total, 0).toLocaleString()} {currencySymbol}
                </p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-2 bg-rose-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">En retard</p>
                <p className="text-lg font-bold text-slate-900">
                  {invoices.filter(i => i.status === 'Overdue').reduce((sum, i) => sum + i.total, 0).toLocaleString()} {currencySymbol}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type / N°</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date / Échéance</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${invoice.type === 'Invoice' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'}`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{invoice.id}</div>
                            <div className="text-xs font-medium text-slate-500">{invoice.type === 'Invoice' ? 'Facture' : 'Devis'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                        {getContactName(invoice.contactId)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900">{new Date(invoice.date).toLocaleDateString('fr-FR')}</div>
                        <div className="text-xs text-slate-500">{new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">
                        {invoice.total.toLocaleString()} {currencySymbol}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 w-fit ${
                            invoice.status === 'Paid' || invoice.status === 'Accepted' ? 'bg-emerald-50 text-emerald-600' : 
                            invoice.status === 'Signed' ? 'bg-blue-50 text-blue-600' :
                            invoice.status === 'Sent' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {getStatusIcon(invoice.status)}
                            {getStatusText(invoice.status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all sm:translate-x-2 sm:group-hover:translate-x-0">
                          {invoice.type === 'Quote' && invoice.status === 'Sent' && invoice.signatureLink && (
                            <button onClick={() => copyToClipboard(invoice.signatureLink!)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md" title="Copier lien signature">
                              <LinkIcon className="w-4 h-4" />
                            </button>
                          )}
                          {invoice.type === 'Quote' && invoice.status === 'Sent' && (
                            <button onClick={() => setSigningQuote(invoice)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md" title="Signer manuellement">
                              <FileSignature className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => setViewInvoice(invoice)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md" title="Prévisualiser">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleSendEmail(invoice)} disabled={isSending === invoice.id} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md" title="Envoyer par email">
                            {isSending === invoice.id ? <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" /> : <Mail className="w-4 h-4" />}
                          </button>
                          <button onClick={() => openEdit(invoice)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md" title="Modifier">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteConfirmId(invoice.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : quoteSubTab === 'templates' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Layout className="w-5 h-5" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Pencil className="w-4 h-4" /></button>
                  <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h4 className="font-bold text-slate-900 mb-1">{template.name}</h4>
              <div className="p-3 bg-slate-50 rounded-xl mb-4">
                <p className="text-xs text-slate-500 mb-1">{template.items.length} articles</p>
                <p className="text-sm font-bold text-indigo-600">
                  {template.items.reduce((sum, i) => sum + (i.price * i.quantity), 0).toLocaleString()} {currencySymbol}
                </p>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <span>Modifié le {template.lastModified}</span>
                <button 
                  onClick={() => applyTemplate(template)}
                  className="flex items-center gap-1 text-indigo-600 hover:underline"
                >
                  <Copy className="w-3 h-3" /> Utiliser
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-6">
              <FileSignature className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Espace de Réception Devis</h3>
            <p className="text-slate-500 text-sm max-w-md mb-8">
              Consultez ici tous les devis signés numériquement ou téléchargez des devis signés manuellement pour archivage.
            </p>
            
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Devis</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Client</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date Signature</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.filter(i => i.type === 'Quote' && (i.status === 'Signed' || i.status === 'Accepted')).map((quote) => (
                    <tr key={quote.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-900">{quote.id}</div>
                        <div className="text-[10px] text-slate-400">{quote.total.toLocaleString()} {currencySymbol}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{getContactName(quote.contactId)}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-medium">{quote.signedAt || quote.date}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                          <Download className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {invoices.filter(i => i.type === 'Quote' && (i.status === 'Signed' || i.status === 'Accepted')).length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                        Aucun devis signé pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      <AnimatePresence>
        {signingQuote && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Signature du Devis</h3>
                  <p className="text-indigo-100 text-xs font-bold mt-1">ID: {signingQuote.id} • {getContactName(signingQuote.contactId)}</p>
                </div>
                <button onClick={() => setSigningQuote(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X className="w-6 h-6"/>
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 max-h-[400px] overflow-y-auto">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">DEVIS {signingQuote.id}</h4>
                      <p className="text-xs text-slate-500 font-bold">Date: {signingQuote.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{MOCK_COMPANY.name}</p>
                      <p className="text-[10px] text-slate-500">{MOCK_COMPANY.address}</p>
                    </div>
                  </div>
                  
                  <table className="w-full text-left mb-6">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
                        <th className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {signingQuote.items.map((item, i) => (
                        <tr key={i}>
                          <td className="py-3">
                            <p className="text-sm font-bold text-slate-900">{item.name}</p>
                            <p className="text-[10px] text-slate-500">{item.quantity} x {item.price.toLocaleString()} {currencySymbol}</p>
                          </td>
                          <td className="py-3 text-sm font-bold text-slate-900 text-right">
                            {(item.quantity * item.price).toLocaleString()} {currencySymbol}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <div className="flex justify-end pt-4 border-t border-slate-200">
                    <div className="w-48 space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <span>Total HT</span>
                        <span>{signingQuote.totalHT.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-lg font-black text-indigo-600 uppercase tracking-tight">
                        <span>Total TTC</span>
                        <span>{signingQuote.total.toLocaleString()} {currencySymbol}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-center gap-6 pt-6 border-t border-slate-100">
                  <div className="w-full max-w-md space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Signature Client</label>
                      <button 
                        onClick={clearSignature}
                        className="flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-widest"
                      >
                        <Eraser className="w-3 h-3" /> Effacer
                      </button>
                    </div>
                    <div className="relative h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-crosshair">
                      <canvas
                        ref={canvasRef}
                        width={448}
                        height={192}
                        className="w-full h-full"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                      {!hasSignature && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 italic text-sm">
                          Signez ici avec votre souris ou votre doigt
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-4 w-full">
                    <button onClick={() => { setSigningQuote(null); setHasSignature(false); }} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">Annuler</button>
                    <button 
                      onClick={() => handleSignQuote(signingQuote.id)}
                      disabled={!hasSignature}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-2 ${
                        hasSignature 
                          ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200" 
                          : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                      }`}
                    >
                      <FileSignature className="w-5 h-5" />
                      Valider le Devis
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-over Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-all">
            <div className="absolute inset-0" onClick={resetForm}></div>
            
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col"
            >
            <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{editingInvoiceId ? 'Modifier le Document' : 'Nouveau Document'}</h3>
                <p className="text-sm text-slate-500">Créez une facture ou un devis.</p>
              </div>
              <button onClick={resetForm} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="invoice-form" onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Type de document</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={newInvoice.type || 'Invoice'}
                      onChange={(e) => setNewInvoice({...newInvoice, type: e.target.value as 'Invoice' | 'Quote'})}
                    >
                      <option value="Invoice">Facture</option>
                      <option value="Quote">Devis</option>
                    </select>
                  </div>
                  {newInvoice.type === 'Quote' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Utiliser un modèle</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        onChange={(e) => {
                          const template = templates.find(t => t.id === e.target.value);
                          if (template) applyTemplate(template);
                        }}
                      >
                        <option value="">Choisir un modèle...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Statut</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={newInvoice.status || 'Draft'}
                      onChange={(e) => setNewInvoice({...newInvoice, status: e.target.value as any})}
                    >
                      <option value="Draft">Brouillon</option>
                      <option value="Sent">Envoyé</option>
                      {newInvoice.type === 'Invoice' && <option value="Paid">Payé</option>}
                      {newInvoice.type === 'Invoice' && <option value="Overdue">En retard</option>}
                      {newInvoice.type === 'Quote' && <option value="Accepted">Accepté</option>}
                      {newInvoice.type === 'Quote' && <option value="Rejected">Refusé</option>}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Client *</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={newInvoice.contactId || ''}
                    onChange={(e) => setNewInvoice({...newInvoice, contactId: e.target.value})}
                  >
                    <option value="">Sélectionner un client</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date</label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={newInvoice.date || ''}
                      onChange={(e) => setNewInvoice({...newInvoice, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Échéance</label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={newInvoice.dueDate || ''}
                      onChange={(e) => setNewInvoice({...newInvoice, dueDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={newInvoice.description || ''}
                    onChange={(e) => setNewInvoice({...newInvoice, description: e.target.value})}
                    placeholder="Description du document..."
                  />
                </div>

                {newInvoice.type === 'Quote' && newInvoice.status === 'Accepted' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date de signature</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={newInvoice.signedAt || ''}
                      onChange={(e) => setNewInvoice({...newInvoice, signedAt: e.target.value})}
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Articles *</label>
                    <button type="button" onClick={handleAddItem} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                      <PlusCircle className="w-3 h-3" /> Ajouter
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {(newInvoice.items || []).map((item, index) => (
                      <div key={index} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex-1">
                          <select 
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            value={item.productId || ''}
                            onChange={(e) => handleUpdateItem(index, 'productId', e.target.value)}
                          >
                            <option value="">Sélectionner un produit</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name} - {p.price} {currencySymbol}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <input 
                            type="number" 
                            min="1"
                            placeholder="Qté"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            value={item.quantity ?? 0}
                            onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="w-32">
                          <input 
                            type="number" 
                            placeholder="Prix"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            value={item.price ?? 0}
                            onChange={(e) => handleUpdateItem(index, 'price', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="w-20 text-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">TVA</div>
                          <div className="text-sm font-semibold text-slate-700">
                            {item.tvaRate !== undefined ? `${(item.tvaRate * 100).toFixed(0)}%` : '-'}
                          </div>
                        </div>
                        <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(newInvoice.items || []).length === 0 && (
                      <div className="text-center py-6 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-sm text-slate-500">
                        Aucun article ajouté. Cliquez sur "Ajouter" pour commencer.
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end pt-2 space-y-1">
                    <div className="text-sm text-slate-500">
                      Total HT : {newInvoice.totalHT?.toLocaleString()} {currencySymbol}
                    </div>
                    <div className="text-sm text-slate-500">
                      TVA : {newInvoice.tvaTotal?.toLocaleString()} {currencySymbol}
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      Total TTC : {newInvoice.total?.toLocaleString()} {currencySymbol}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Notes / Conditions</label>
                  <textarea 
                    rows={3} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                    value={newInvoice.notes || ''}
                    onChange={(e) => setNewInvoice({...newInvoice, notes: e.target.value})}
                  ></textarea>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button type="button" onClick={resetForm} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all active:scale-95">
                Annuler
              </button>
              <button type="submit" form="invoice-form" className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95">
                {editingInvoiceId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {viewInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${viewInvoice.type === 'Invoice' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{viewInvoice.type === 'Invoice' ? 'Facture' : 'Devis'} {viewInvoice.id}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(viewInvoice.status)}
                    <span className="text-xs font-medium text-slate-600">{getStatusText(viewInvoice.status)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleSendEmail(viewInvoice)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                  <Mail className="w-4 h-4" /> Envoyer
                </button>
                <button onClick={() => { setViewInvoice(null); openEdit(viewInvoice); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm">
                  <Pencil className="w-4 h-4" /> Modifier
                </button>
                <button onClick={() => setViewInvoice(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all ml-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-8 overflow-y-auto bg-slate-50 flex-1">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
                <div className="flex justify-between items-start mb-12">
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
                      {viewInvoice.type === 'Invoice' ? 'FACTURE' : 'DEVIS'}
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">{viewInvoice.id}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-lg">{MOCK_COMPANY.name}</div>
                    <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">
                      {MOCK_COMPANY.address}<br/>
                      {MOCK_COMPANY.email}<br/>
                      {MOCK_COMPANY.taxId} | {MOCK_COMPANY.rccm}<br/>
                      {MOCK_COMPANY.idNat}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-12">
                  <div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Facturé à</h3>
                    <div className="font-bold text-slate-900 text-lg">{getContact(viewInvoice.contactId)?.name}</div>
                    <div className="text-sm text-slate-600 mt-1">{getContact(viewInvoice.contactId)?.company}</div>
                    <div className="text-sm text-slate-600 mt-1">{getContact(viewInvoice.contactId)?.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-slate-500 font-medium">Date d'émission :</div>
                      <div className="font-bold text-slate-900">{new Date(viewInvoice.date).toLocaleDateString('fr-FR')}</div>
                      <div className="text-slate-500 font-medium">Date d'échéance :</div>
                      <div className="font-bold text-slate-900">{new Date(viewInvoice.dueDate).toLocaleDateString('fr-FR')}</div>
                    </div>
                  </div>
                </div>

                <table className="w-full mb-8">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <th className="py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">Description</th>
                      <th className="py-3 text-center text-xs font-bold text-slate-900 uppercase tracking-wider">Qté</th>
                      <th className="py-3 text-right text-xs font-bold text-slate-900 uppercase tracking-wider">Prix Unitaire</th>
                      <th className="py-3 text-center text-xs font-bold text-slate-900 uppercase tracking-wider">TVA %</th>
                      <th className="py-3 text-right text-xs font-bold text-slate-900 uppercase tracking-wider">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-4 text-sm font-medium text-slate-900">
                          <div>{item.name || 'Article'}</div>
                          {item.description && <div className="text-xs text-slate-500 font-normal">{item.description}</div>}
                        </td>
                        <td className="py-4 text-sm text-slate-600 text-center">{item.quantity}</td>
                        <td className="py-4 text-sm text-slate-600 text-right">{item.price.toLocaleString()} {currencySymbol}</td>
                        <td className="py-4 text-sm text-slate-600 text-center">{item.tvaRate !== undefined ? `${(item.tvaRate * 100).toFixed(0)}%` : '0%'}</td>
                        <td className="py-4 text-sm font-bold text-slate-900 text-right">{(item.quantity * item.price).toLocaleString()} {currencySymbol}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end mb-12">
                  <div className="w-64 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Sous-total HT</span>
                      <span className="font-bold text-slate-900">{viewInvoice.totalHT.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">TVA</span>
                      <span className="font-bold text-slate-900">{viewInvoice.tvaTotal.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between text-lg pt-3 border-t-2 border-slate-900">
                      <span className="font-black text-slate-900">Total TTC</span>
                      <span className="font-black text-indigo-600">{viewInvoice.total.toLocaleString()} {currencySymbol}</span>
                    </div>
                  </div>
                </div>

                {viewInvoice.notes && (
                  <div className="pt-8 border-t border-slate-200">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notes & Conditions</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{viewInvoice.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Supprimer le document"
        message="Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </motion.div>
  );
};
