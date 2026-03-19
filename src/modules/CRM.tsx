import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, MoreVertical, Mail, Phone, ExternalLink, X, User, Building2, Globe, Tag, Briefcase, Check, Pencil, Trash2, Eye, Calendar, Loader2, AlertCircle, Search, Users, UserPlus, TrendingUp } from 'lucide-react';
import { Contact, Company } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

import { useTranslation } from '../lib/i18n';

export const CRM = ({ user }: { user?: any }) => {
  const { t, language } = useTranslation();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Client' | 'Lead'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'alpha'>('recent');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [viewContact, setViewContact] = useState<Contact | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch Company Info
        const companyRes = await apiFetch('/api/company');
        if (companyRes.ok) {
          const companyData = await companyRes.json();
          setSelectedCompany(companyData);
          
          // 2. Fetch Contacts for this company
          const contactsRes = await apiFetch('/api/contacts');
          if (contactsRes.ok) {
            setContacts(await contactsRes.json());
          } else {
            setContacts([]);
            if (contactsRes.status !== 404) {
              setError(t('crm.error.load'));
            }
          }
        } else {
          setError(t('crm.errorLoading'));
        }
      } catch (err) {
        console.error('CRM load error:', err);
        setError(t('crm.error.connection'));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [user, t]);
  
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    name: '',
    email: '',
    phone: '',
    company: '',
    companyId: '',
    role: '',
    notes: '',
    status: 'Lead',
    lastContact: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (selectedCompany) {
      setNewContact(prev => ({
        ...prev,
        company: selectedCompany.name,
        companyId: selectedCompany.id
      }));
    }
  }, [selectedCompany]);

  const fetchContacts = async () => {
    if (!selectedCompany) return;
    try {
      const response = await apiFetch(`/api/contacts`);
      if (response.ok) {
        setContacts(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
  };

  const filteredContacts = contacts
    .filter(contact => {
      const matchesFilter = filter === 'All' ? true : contact.status === filter;
      const matchesSearch = (contact.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                           (contact.company?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                           (contact.email?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'alpha') {
        return a.name.localeCompare(b.name);
      }
      return new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime();
    });

  const stats = {
    total: contacts.length,
    leads: contacts.filter(c => c.status === 'Lead').length,
    clients: contacts.filter(c => c.status === 'Client').length,
    conversion: contacts.length > 0 ? Math.round((contacts.filter(c => c.status === 'Client').length / contacts.length) * 100) : 0
  };

  const resetForm = () => {
    setNewContact({
      name: '', 
      email: '', 
      phone: '', 
      company: selectedCompany?.name || '', 
      companyId: selectedCompany?.id || '',
      role: '', 
      notes: '', 
      status: 'Lead', 
      lastContact: new Date().toISOString().split('T')[0]
    });
    setEditingContactId(null);
    setIsModalOpen(false);
    setError(null);
  };

  const handleAddOrUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setIsSubmitting(true);
    setError(null);
    
    try {
      const contactToSave = {
        ...newContact,
        companyId: selectedCompany.id,
        company: newContact.company || selectedCompany.name
      };

      if (editingContactId) {
        const response = await apiFetch(`/api/contacts/${editingContactId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contactToSave),
        });
        if (response.ok) {
          fetchContacts();
          resetForm();
        } else {
          setError(t('crm.error.update'));
        }
      } else {
        const id = `cnt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const response = await apiFetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...contactToSave, id }),
        });
        if (response.ok) {
          fetchContacts();
          resetForm();
        } else {
          setError(t('crm.error.create'));
        }
      }
    } catch (error) {
      console.error('Failed to save contact:', error);
      setError(t('crm.error.connection'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      const response = await apiFetch(`/api/contacts/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchContacts();
        setDeleteConfirmId(null);
      } else {
        setError(t('crm.error.delete'));
      }
    } catch (error) {
      console.error('Failed to delete contact:', error);
      setError(t('crm.error.connection'));
    }
  };

  const openEdit = (contact: Contact) => {
    setNewContact(contact);
    setEditingContactId(contact.id);
    setIsModalOpen(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Company Header */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-4 bg-indigo-50 rounded-2xl">
          <Building2 className="w-8 h-8 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedCompany?.name || t('common.loading')}</h2>
          <p className="text-sm font-bold text-slate-500">{t('crm.manageContacts')}</p>
        </div>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('crm.stats.total'), value: stats.total, icon: Users, color: 'bg-blue-500' },
          { label: t('crm.stats.leads'), value: stats.leads, icon: UserPlus, color: 'bg-amber-500' },
          { label: t('crm.stats.clients'), value: stats.clients, icon: Check, color: 'bg-emerald-500' },
          { label: t('crm.stats.conversion'), value: `${stats.conversion}%`, icon: TrendingUp, color: 'bg-indigo-500' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-2xl ${stat.color} text-white shadow-lg shadow-current/20 group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="font-medium">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder={t('crm.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
            {(['All', 'Client', 'Lead'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-sm font-bold rounded-xl transition-all ${
                  filter === f 
                    ? "bg-slate-900 text-white shadow-md" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {f === 'All' ? t('crm.filter.all') : t(`crm.filter.${f.toLowerCase()}s`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Filter className="w-4 h-4" />
              {t('crm.sort')}
            </button>
            
            <AnimatePresence>
              {isFilterMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-10"
                >
                  <div className="p-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">{t('crm.sortBy')}</h4>
                    <div className="space-y-1">
                      <button 
                        onClick={() => { setSortBy('recent'); setIsFilterMenuOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-colors ${sortBy === 'recent' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t('crm.recent')}
                        {sortBy === 'recent' && <Check className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => { setSortBy('alpha'); setIsFilterMenuOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-colors ${sortBy === 'alpha' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t('crm.alphabetical')}
                        {sortBy === 'alpha' && <Check className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            {t('crm.newContact')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-slate-500">{t('crm.loading')}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('crm.contact')}</th>
                  <th className="hidden sm:table-cell px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('common.status')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('crm.details')}</th>
                  <th className="hidden md:table-cell px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('crm.lastActivity')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">{t('crm.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContacts.length > 0 ? filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50/80 transition-all group">
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-lg group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                          {contact.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{contact.name}</div>
                          <div className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-wider mt-0.5">
                            <Building2 className="w-3 h-3" />
                            {contact.company}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        contact.status === 'Client' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                        contact.status === 'Lead' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
                        'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        {t(`crm.status.${contact.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="px-6 py-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold tracking-tight">
                          <Mail className="w-3.5 h-3.5 text-slate-300" />
                          {contact.email}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold tracking-tight">
                          <Phone className="w-3.5 h-3.5 text-slate-300" />
                          {contact.phone}
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-6">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-600 uppercase tracking-tighter">
                        <Calendar className="w-4 h-4 text-slate-300" />
                        {contact.lastContact ? new Date(contact.lastContact).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewContact(contact)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title={t('crm.viewDetails')}>
                          <Eye className="w-4.5 h-4.5" />
                        </button>
                        <button onClick={() => openEdit(contact)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title={t('common.edit')}>
                          <Pencil className="w-4.5 h-4.5" />
                        </button>
                        <button onClick={() => setDeleteConfirmId(contact.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title={t('common.delete')}>
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                          <Search className="w-8 h-8" />
                        </div>
                        <p className="text-slate-500 font-bold">{t('crm.noContacts')}</p>
                        <button onClick={() => { setSearchQuery(''); setFilter('All'); }} className="text-indigo-600 text-sm font-bold hover:underline">{t('crm.resetFilters')}</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Slide-over Nouveau Contact */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-all">
            <div className="absolute inset-0" onClick={resetForm}></div>
            
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md sm:max-w-lg md:max-w-xl bg-white h-full shadow-2xl flex flex-col"
            >
            <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{editingContactId ? t('crm.editContact') : t('crm.newContact')}</h3>
                <p className="text-sm text-slate-500">{editingContactId ? t('crm.updateInfo') : t('crm.addInfo')}</p>
              </div>
              <button 
                onClick={resetForm}
                className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="new-contact-form" onSubmit={handleAddOrUpdateContact} className="space-y-6">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-indigo-300">
                    <User className="w-8 h-8" />
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('crm.fullName')} *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        type="text" 
                        placeholder={t('crm.placeholder.name')}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={newContact.name || ''}
                        onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('crm.jobTitle')}</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder={t('crm.placeholder.role')}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={newContact.role || ''}
                        onChange={(e) => setNewContact({...newContact, role: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('crm.email')} *</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          required
                          type="email" 
                          placeholder={t('crm.placeholder.email')}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          value={newContact.email || ''}
                          onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('crm.phone')} *</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          required
                          type="tel" 
                          placeholder={t('crm.placeholder.phone')}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          value={newContact.phone || ''}
                          onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('crm.company')} *</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        type="text" 
                        placeholder={t('crm.placeholder.company')}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={newContact.company || ''}
                        onChange={(e) => setNewContact({...newContact, company: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('common.status')} *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Lead', 'Client'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewContact({...newContact, status: s as any})}
                          className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border transition-all ${
                            newContact.status === s 
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700 ring-2 ring-indigo-500/10" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Tag className="w-4 h-4" />
                          {t(`crm.status.${s.toLowerCase()}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('crm.notes')}</label>
                    <div className="relative">
                      <textarea 
                        rows={3} 
                        placeholder={t('crm.placeholder.notes')}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                        value={newContact.notes || ''}
                        onChange={(e) => setNewContact({...newContact, notes: e.target.value})}
                      ></textarea>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button 
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all active:scale-95"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit"
                  form="new-contact-form"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingContactId ? t('crm.update') : t('common.save'))}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {viewContact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
            >
            <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">{t('crm.contactDetails')}</h3>
              <button 
                onClick={() => setViewContact(null)}
                className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-indigo-100">
                  {viewContact.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{viewContact.name}</h4>
                  <p className="text-sm font-medium text-slate-500">
                    {viewContact.role ? `${viewContact.role}${t('crm.at')}` : ''}{viewContact.company}
                  </p>
                  <span className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    viewContact.status === 'Client' ? 'bg-emerald-100 text-emerald-700' : 
                    viewContact.status === 'Lead' ? 'bg-amber-100 text-amber-700' : 
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {t(`crm.status.${viewContact.status.toLowerCase()}`)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <a 
                  href={`mailto:${viewContact.email}`}
                  className="flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                >
                  <Mail className="w-4 h-4 text-slate-400" />
                  {viewContact.email}
                </a>
                <a 
                  href={`tel:${viewContact.phone}`}
                  className="flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                >
                  <Phone className="w-4 h-4 text-slate-400" />
                  {viewContact.phone}
                </a>
                <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {t('crm.lastContact')} : {new Date(viewContact.lastContact).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                </div>
              </div>
              
              {viewContact.notes && (
                <div>
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('crm.notes')}</h5>
                  <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100 leading-relaxed">
                    {viewContact.notes}
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button 
                onClick={() => { setViewContact(null); openEdit(viewContact); }}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
              >
                {t('crm.editContact')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title={t('crm.deleteTitle')}
        message={t('crm.deleteMessage')}
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteConfirmId && handleDeleteContact(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </motion.div>
  );
};
