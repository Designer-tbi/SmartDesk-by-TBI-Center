import React, { useState, useEffect } from 'react';
import { MOCK_COMPANY } from '../constants';
import { Building2, Mail, Phone, Globe, MapPin, FileText, Save, CheckCircle, Loader2, XCircle, Trash2, BookOpen, User, Shield, Bell, Key, Eye, EyeOff, LogOut } from 'lucide-react';
import { CompanyInfo, User as UserType } from '../types';
import { apiFetch } from '../lib/api';
import { ConfirmModal } from '../components/ConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';

import { useTranslation } from '../lib/i18n';

export const Settings = ({ user: globalUser, setUser: setGlobalUser }: { user: any, setUser: any }) => {
  const { setLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useState<'company' | 'profile' | 'security' | 'notifications'>('company');
  const [company, setCompany] = useState<CompanyInfo>(MOCK_COMPANY);
  const [user, setUser] = useState<Partial<UserType>>(globalUser || { name: '', email: '' });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isAccountingResetting, setIsAccountingResetting] = useState(false);
  const [isAccountingResetConfirmOpen, setIsAccountingResetConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [companyRes, userRes] = await Promise.all([
        apiFetch('/api/company'),
        apiFetch('/api/auth/me')
      ]);
      
      if (companyRes.ok) {
        const data = await companyRes.json();
        if (data) setCompany(data);
      }
      
      if (userRes.ok) {
        const data = await userRes.json();
        if (data) {
          setUser(data);
          setGlobalUser(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings data:', error);
      setError("Erreur lors de la récupération des paramètres.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setIsSaved(false);

    try {
      const response = await apiFetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company),
      });
      
      if (response.ok) {
        setIsSaved(true);
        if (company.language) {
          setLanguage(company.language as any);
        }
        
        // Update global user state to reflect currency/language changes
        setGlobalUser((prev: any) => ({
          ...prev,
          currency: company.currency,
          language: company.language
        }));

        setTimeout(() => setIsSaved(false), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Une erreur est survenue lors de l'enregistrement.");
      }
    } catch (error) {
      console.error('Failed to save company:', error);
      setError("Erreur de connexion au serveur.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await apiFetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.name, email: user.email }),
      });
      
      if (response.ok) {
        const updatedUser = await response.json();
        setGlobalUser(updatedUser);
        setSuccessMessage("Profil mis à jour avec succès !");
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Erreur lors de la mise à jour du profil.");
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setError("Erreur de connexion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await apiFetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentPassword: passwords.current, 
          newPassword: passwords.new 
        }),
      });
      
      if (response.ok) {
        setSuccessMessage("Mot de passe mis à jour avec succès !");
        setPasswords({ current: '', new: '', confirm: '' });
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Erreur lors du changement de mot de passe.");
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      setError("Erreur de connexion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetCRM = async () => {
    setIsResetting(true);
    try {
      const response = await apiFetch('/api/company/reset-crm', { method: 'POST' });
      if (response.ok) {
        setIsResetConfirmOpen(false);
        alert('Toutes les données du CRM ont été réinitialisées.');
      } else {
        alert('Erreur lors de la réinitialisation.');
      }
    } catch (error) {
      console.error('Failed to reset CRM:', error);
      alert('Erreur de connexion.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetAccounting = async () => {
    setIsAccountingResetting(true);
    try {
      const response = await apiFetch('/api/company/reset-accounting', { method: 'POST' });
      if (response.ok) {
        setIsAccountingResetConfirmOpen(false);
        alert('Toutes les données de la comptabilité ont été réinitialisées.');
      } else {
        alert('Erreur lors de la réinitialisation.');
      }
    } catch (error) {
      console.error('Failed to reset accounting:', error);
      alert('Erreur de connexion.');
    } finally {
      setIsAccountingResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Chargement des paramètres...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'company' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Entreprise
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'profile' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <User className="w-4 h-4" />
          Profil
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'security' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <Shield className="w-4 h-4" />
          Sécurité
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'notifications' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <Bell className="w-4 h-4" />
          Notifications
        </button>
        <button
          onClick={() => setActiveTab('help' as any)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === ('help' as any)
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Aide
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'company' && (
          <motion.div
            key="company"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  Informations de l'Entreprise
                </h3>
                <p className="text-sm text-slate-500 mt-1">Ces informations apparaîtront sur vos factures et devis.</p>
              </div>

              <form onSubmit={handleCompanySubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Logo URL</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={company.logo || ''}
                        onChange={(e) => setCompany({ ...company, logo: e.target.value })}
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nom de l'entreprise</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={company.name || ''}
                        onChange={(e) => setCompany({ ...company, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Continent / Région</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={company.country || 'EUROPE'}
                        onChange={(e) => setCompany({ ...company, country: e.target.value })}
                      >
                        <option value="CONTINENT">Continent (Général)</option>
                        <option value="AFRIQUE">Afrique</option>
                        <option value="EUROPE">Europe</option>
                        <option value="USA">États-Unis</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Système Comptable</label>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={company.accountingStandard || 'OHADA'}
                        onChange={(e) => setCompany({ ...company, accountingStandard: e.target.value as any })}
                      >
                        <option value="OHADA">OHADA (Afrique Centrale/Ouest)</option>
                        <option value="FRANCE">PCG France</option>
                        <option value="US_GAAP">US GAAP (États-Unis)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Langue du CRM</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={company.language || 'fr'}
                        onChange={(e) => setCompany({ ...company, language: e.target.value })}
                      >
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Devise par défaut</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {company.currency === 'XAF' ? 'FCFA' : company.currency === 'EUR' ? '€' : '$'}
                      </span>
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={company.currency || 'XAF'}
                        onChange={(e) => setCompany({ ...company, currency: e.target.value })}
                      >
                        <option value="XAF">XAF (Franc CFA)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                  </div>

                  {company.country === 'AFRIQUE' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">NIF</label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            value={company.taxId || ''}
                            onChange={(e) => setCompany({ ...company, taxId: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">RCCM</label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            value={company.rccm || ''}
                            onChange={(e) => setCompany({ ...company, rccm: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email de contact</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={company.email || ''}
                        onChange={(e) => setCompany({ ...company, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Téléphone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={company.phone || ''}
                        onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Adresse complète</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <textarea
                        rows={3}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                        value={company.address || ''}
                        onChange={(e) => setCompany({ ...company, address: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {isSaved && (
                      <div className="flex items-center gap-1.5 text-emerald-600 animate-in fade-in slide-in-from-left-2">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Paramètres enregistrés !</span>
                      </div>
                    )}
                    {error && (
                      <div className="flex items-center gap-1.5 text-red-600 animate-in fade-in slide-in-from-left-2">
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">{error}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-rose-50 rounded-2xl border border-rose-100 p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-700">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-lg font-bold">Zone de Danger</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95"
                >
                  Réinitialiser CRM
                </button>
                <button
                  onClick={() => setIsAccountingResetConfirmOpen(true)}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95"
                >
                  Réinitialiser Comptabilité
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Profil Utilisateur
              </h3>
              <p className="text-sm text-slate-500 mt-1">Gérez vos informations personnelles.</p>
            </div>

            <form onSubmit={handleProfileSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nom Complet</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={user.name || ''}
                      onChange={(e) => setUser({ ...user, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={user.email || ''}
                      onChange={(e) => setUser({ ...user, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {successMessage && (
                    <div className="flex items-center gap-1.5 text-emerald-600 animate-in fade-in slide-in-from-left-2">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">{successMessage}</span>
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center gap-1.5 text-red-600 animate-in fade-in slide-in-from-left-2">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('token');
                      window.location.href = '/login';
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-all active:scale-95"
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSubmitting ? 'Mise à jour...' : 'Mettre à jour le profil'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}

        {activeTab === 'security' && (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Sécurité
              </h3>
              <p className="text-sm text-slate-500 mt-1">Changez votre mot de passe pour sécuriser votre compte.</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-6">
              <div className="space-y-4 max-w-md">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mot de passe actuel</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPasswords.current ? "text" : "password"}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nouveau mot de passe</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPasswords.new ? "text" : "password"}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmer le nouveau mot de passe</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPasswords.confirm ? "text" : "password"}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {successMessage && (
                    <div className="flex items-center gap-1.5 text-emerald-600 animate-in fade-in slide-in-from-left-2">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">{successMessage}</span>
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center gap-1.5 text-red-600 animate-in fade-in slide-in-from-left-2">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSubmitting ? 'Mise à jour...' : 'Changer le mot de passe'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-600" />
                Notifications
              </h3>
              <p className="text-sm text-slate-500 mt-1">Choisissez comment vous souhaitez être informé.</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                {[
                  { id: 'email_reports', label: 'Rapports hebdomadaires par email', desc: 'Recevez un résumé de votre activité chaque lundi.' },
                  { id: 'new_lead', label: 'Nouveaux prospects', desc: 'Soyez alerté dès qu\'un nouveau prospect est créé.' },
                  { id: 'invoice_paid', label: 'Factures payées', desc: 'Recevez une notification quand une facture est réglée.' },
                  { id: 'project_update', label: 'Mises à jour de projet', desc: 'Alertes sur les changements de statut des projets.' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setSuccessMessage("Préférences de notifications enregistrées !");
                    setTimeout(() => setSuccessMessage(null), 3000);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  Enregistrer les préférences
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === ('help' as any) && (
          <motion.div
            key="help"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Centre d'Aide & Ressources
                </h3>
                <p className="text-sm text-slate-500 mt-1">Trouvez des réponses à vos questions et apprenez à utiliser SmartDesk.</p>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'Guide de démarrage', desc: 'Apprenez les bases de SmartDesk en 5 minutes.', icon: BookOpen, link: '#' },
                  { title: 'Documentation API', desc: 'Intégrez SmartDesk à vos propres outils.', icon: FileText, link: '#' },
                  { title: 'Support Technique', desc: 'Contactez notre équipe d\'experts.', icon: Mail, link: 'mailto:support@smartdesk.com' },
                  { title: 'Sécurité & Confidentialité', desc: 'Comment nous protégeons vos données.', icon: Shield, link: '#' },
                ].map((item, idx) => (
                  <a
                    key={idx}
                    href={item.link}
                    className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                  >
                    <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-indigo-100 transition-colors">
                      <item.icon className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div className="bg-indigo-600 rounded-2xl p-8 text-white relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-2xl font-black mb-2">Besoin d'une formation ?</h3>
                <p className="text-indigo-100 mb-6 max-w-md">
                  Nos experts peuvent vous accompagner pour configurer SmartDesk selon les besoins spécifiques de votre entreprise.
                </p>
                <button className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all shadow-xl shadow-indigo-900/20 active:scale-95">
                  Prendre rendez-vous
                </button>
              </div>
              <Building2 className="absolute -right-8 -bottom-8 w-64 h-64 text-white/10 -rotate-12" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Réinitialiser le CRM"
        message="Attention : Cette action va supprimer DÉFINITIVEMENT tous les contacts, produits, factures, projets et plannings de votre entreprise. Voulez-vous continuer ?"
        confirmLabel={isResetting ? "Réinitialisation..." : "Tout supprimer"}
        onConfirm={handleResetCRM}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={isAccountingResetConfirmOpen}
        title="Réinitialiser la Comptabilité"
        message="Attention : Cette action va supprimer DÉFINITIVEMENT toutes les écritures et transactions comptables de votre entreprise. Voulez-vous continuer ?"
        confirmLabel={isAccountingResetting ? "Réinitialisation..." : "Tout supprimer"}
        onConfirm={handleResetAccounting}
        onCancel={() => setIsAccountingResetConfirmOpen(false)}
      />
    </div>
  );
};
