import React, { useState, useEffect } from 'react';
import { Building2, Mail, Phone, Globe, MapPin, FileText, Save, CheckCircle, Loader2, XCircle, Trash2, BookOpen, User, Shield, Bell, Key, Eye, EyeOff, LogOut, Upload, Check, PlayCircle, Star, HelpCircle, LayoutDashboard, Calendar, Users, ShoppingCart, Package, Clock, Briefcase, UserCheck, Calculator, Settings as SettingsIcon } from 'lucide-react';
import { HelpSection } from '../components/HelpSection';
import { CompanyInfo, User as UserType } from '../types';
import { apiFetch } from '../lib/api';
import { ConfirmModal } from '../components/ConfirmModal';
import { motion, AnimatePresence } from 'motion/react';

import { useTranslation } from '../lib/i18n';

export const Settings = ({ user: globalUser, setUser: setGlobalUser }: { user: any, setUser: any }) => {
  const { t, setLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useState<'company' | 'profile' | 'security' | 'notifications' | 'help'>('company');
  const [company, setCompany] = useState<CompanyInfo>({
    name: '',
    type: 'real',
    status: 'active',
    address: '',
    email: '',
    phone: '',
    website: '',
    taxId: '',
    rccm: '',
    idNat: '',
    siren: '',
    siret: '',
    logo: '',
    language: 'fr',
    currency: 'XAF',
    accountingStandard: 'OHADA',
    country: 'AFRIQUE'
  });
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
  const [copiedKey, setCopiedKey] = useState(false);

  // Generate a stable API key for demo purposes based on company name or just once
  const apiKey = React.useMemo(() => {
    return `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  }, []);

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  useEffect(() => {
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
        setError(t('settings.error.fetch'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [setGlobalUser, t]);

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
        
        // Update global user state to reflect currency/language/country changes
        // so downstream modules (CRM locale, Accounting, etc.) react immediately.
        setGlobalUser((prev: any) => ({
          ...prev,
          currency: company.currency,
          language: company.language,
          country: company.country,
        }));

        setTimeout(() => setIsSaved(false), 3000);
      } else {
        const data = await response.json();
        setError(data.error || t('settings.error.save'));
      }
    } catch (error) {
      console.error('Failed to save company:', error);
      setError(t('settings.error.connection'));
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
        setSuccessMessage(t('settings.success.profileUpdated'));
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || t('settings.error.save'));
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setError(t('settings.error.connection'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setError(t('settings.error.passwordMismatch'));
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
        setSuccessMessage(t('settings.success.passwordUpdated'));
        setPasswords({ current: '', new: '', confirm: '' });
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || t('settings.error.save'));
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      setError(t('settings.error.connection'));
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
        alert(t('settings.resetCRMConfirm'));
      } else {
        alert(t('settings.error.reset'));
      }
    } catch (error) {
      console.error('Failed to reset CRM:', error);
      alert(t('settings.error.connection'));
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
        alert(t('settings.resetAccountingConfirm'));
      } else {
        alert(t('settings.error.reset'));
      }
    } catch (error) {
      console.error('Failed to reset accounting:', error);
      alert(t('settings.error.connection'));
    } finally {
      setIsAccountingResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-accent-red animate-spin" />
        <p className="text-sm font-medium text-slate-500">{t('settings.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 p-1 bg-soft-red/30 rounded-2xl w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'company' 
              ? 'bg-white text-accent-red shadow-sm' 
              : 'text-slate-500 hover:text-accent-red hover:bg-white/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          {t('settings.tab.company')}
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'profile' 
              ? 'bg-white text-accent-red shadow-sm' 
              : 'text-slate-500 hover:text-accent-red hover:bg-white/50'
          }`}
        >
          <User className="w-4 h-4" />
          {t('settings.tab.profile')}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'security' 
              ? 'bg-white text-accent-red shadow-sm' 
              : 'text-slate-500 hover:text-accent-red hover:bg-white/50'
          }`}
        >
          <Shield className="w-4 h-4" />
          {t('settings.tab.security')}
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'notifications' 
              ? 'bg-white text-accent-red shadow-sm' 
              : 'text-slate-500 hover:text-accent-red hover:bg-white/50'
          }`}
        >
          <Bell className="w-4 h-4" />
          {t('settings.tab.notifications')}
        </button>
        <button
          onClick={() => setActiveTab('help')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'help'
              ? 'bg-white text-accent-red shadow-sm' 
              : 'text-slate-500 hover:text-accent-red hover:bg-white/50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          {t('settings.tab.help')}
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
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-red-50 bg-soft-red/10">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-accent-red" />
                  {t('settings.companyInfo')}
                </h3>
                <p className="text-sm text-slate-500 mt-1">{t('settings.companyInfoDesc')}</p>
              </div>

              <form onSubmit={handleCompanySubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.logoUrl')}</label>
                    <div className="flex items-center gap-4">
                      {company.logo ? (
                        <div className="relative w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-white flex-shrink-0 flex items-center justify-center">
                          <img src={company.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => setCompany({ ...company, logo: '' })}
                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <label className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer w-full sm:w-auto">
                          <Upload className="w-4 h-4" />
                          {t('settings.uploadLogo')}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setCompany({ ...company, logo: reader.result as string });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <p className="text-xs text-slate-500 mt-2">{t('settings.logoFormat')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.companyName')}</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={company.name || ''}
                        onChange={(e) => setCompany({ ...company, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.continentRegion')}</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={company.country || 'EUROPE'}
                        onChange={(e) => setCompany({ ...company, country: e.target.value })}
                      >
                        <option value="CONTINENT">{t('settings.continentGeneral')}</option>
                        <option value="AFRIQUE">{t('settings.africa')}</option>
                        <option value="CONGO">{t('settings.congo')}</option>
                        <option value="EUROPE">{t('settings.europe')}</option>
                        <option value="USA">{t('settings.usa')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.accountingSystem')}</label>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={company.accountingStandard || 'OHADA'}
                        onChange={(e) => setCompany({ ...company, accountingStandard: e.target.value as any })}
                      >
                        <option value="OHADA">{t('settings.ohada')}</option>
                        <option value="FRANCE">{t('settings.pcgFrance')}</option>
                        <option value="US_GAAP">{t('settings.usGaap')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.crmLanguage')}</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={company.language || 'fr'}
                        onChange={(e) => setCompany({ ...company, language: e.target.value })}
                      >
                        <option value="fr">{t('settings.langFr')}</option>
                        <option value="en">{t('settings.langEn')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.defaultCurrency')}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {company.currency === 'XAF' ? 'FCFA' : company.currency === 'EUR' ? '€' : '$'}
                      </span>
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={company.currency || 'XAF'}
                        onChange={(e) => setCompany({ ...company, currency: e.target.value })}
                      >
                        <option value="XAF">{t('settings.currencyXaf')}</option>
                        <option value="EUR">{t('settings.currencyEur')}</option>
                        <option value="USD">{t('settings.currencyUsd')}</option>
                      </select>
                    </div>
                  </div>

                  {(company.country === 'AFRIQUE' || company.country === 'CONGO') && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.taxId')}</label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                            value={company.taxId || ''}
                            onChange={(e) => setCompany({ ...company, taxId: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.rccm')}</label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                            value={company.rccm || ''}
                            onChange={(e) => setCompany({ ...company, rccm: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.contactEmail')}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={company.email || ''}
                        onChange={(e) => setCompany({ ...company, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.phone')}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={company.phone || ''}
                        onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.address')}</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <textarea
                        rows={3}
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all resize-none"
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
                        <span className="text-sm font-medium">{t('settings.success.preferencesSaved')}</span>
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
                    className="flex items-center gap-2 px-6 py-2.5 bg-accent-red text-white rounded-xl text-sm font-bold hover:bg-primary-red transition-all shadow-lg shadow-accent-red/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSubmitting ? t('settings.updating') : t('common.save')}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-rose-50 rounded-2xl border border-rose-100 p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-700">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-lg font-bold">{t('settings.dangerZone')}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95"
                >
                  {t('settings.resetCRM')}
                </button>
                <button
                  onClick={() => setIsAccountingResetConfirmOpen(true)}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95"
                >
                  {t('settings.resetAccounting')}
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
            className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-red-50 bg-soft-red/10">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-accent-red" />
                {t('settings.profile')}
              </h3>
              <p className="text-sm text-slate-500 mt-1">{t('settings.profileDesc')}</p>
            </div>

            <form onSubmit={handleProfileSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.fullName')}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                      value={user.name || ''}
                      onChange={(e) => setUser({ ...user, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
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
                    onClick={async () => {
                      try {
                        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                      } catch { /* noop */ }
                      window.location.href = '/';
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-all active:scale-95"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('nav.logout')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-accent-red text-white rounded-xl text-sm font-bold hover:bg-primary-red transition-all shadow-lg shadow-accent-red/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSubmitting ? t('settings.updating') : t('settings.updateProfile')}
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
            className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-red-50 bg-soft-red/10">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent-red" />
                {t('settings.security')}
              </h3>
              <p className="text-sm text-slate-500 mt-1">{t('settings.securityDesc')}</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.currentPassword')}</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      className="w-full pl-10 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.newPassword')}</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      className="w-full pl-10 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.confirmNewPassword')}</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      className="w-full pl-10 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
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
                  className="flex items-center gap-2 px-6 py-2.5 bg-accent-red text-white rounded-xl text-sm font-bold hover:bg-primary-red transition-all shadow-lg shadow-accent-red/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSubmitting ? t('settings.updating') : t('settings.changePassword')}
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
            className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-red-50 bg-soft-red/10">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-accent-red" />
                {t('settings.notifications')}
              </h3>
              <p className="text-sm text-slate-500 mt-1">{t('settings.notificationsDesc')}</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-soft-red/10 rounded-xl border border-red-50">
                  <div>
                    <h4 className="text-sm font-bold text-primary-red">{t('settings.emailReports')}</h4>
                    <p className="text-xs text-slate-500">{t('settings.emailReportsDesc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-red/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-red"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-soft-red/10 rounded-xl border border-red-50">
                  <div>
                    <h4 className="text-sm font-bold text-primary-red">{t('settings.newLead')}</h4>
                    <p className="text-xs text-slate-500">{t('settings.newLeadDesc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-red/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-red"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-soft-red/10 rounded-xl border border-red-50">
                  <div>
                    <h4 className="text-sm font-bold text-primary-red">{t('settings.invoicePaid')}</h4>
                    <p className="text-xs text-slate-500">{t('settings.invoicePaidDesc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-red/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-red"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-soft-red/10 rounded-xl border border-red-50">
                  <div>
                    <h4 className="text-sm font-bold text-primary-red">{t('settings.projectUpdate')}</h4>
                    <p className="text-xs text-slate-500">{t('settings.projectUpdateDesc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-red/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-red"></div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessMessage(t('settings.success.preferencesSaved'));
                    setTimeout(() => setSuccessMessage(null), 3000);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-accent-red text-white rounded-xl text-sm font-bold hover:bg-primary-red transition-all shadow-lg shadow-accent-red/20 active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  {t('settings.savePreferences')}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'help' && (
          <motion.div
            key="help"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <HelpSection />
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title={t('settings.resetCrmTitle')}
        message={t('settings.resetCrmMessage')}
        confirmLabel={isResetting ? t('settings.resetting') : t('settings.deleteAll')}
        onConfirm={handleResetCRM}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={isAccountingResetConfirmOpen}
        title={t('settings.resetAccountingTitle')}
        message={t('settings.resetAccountingMessage')}
        confirmLabel={isAccountingResetting ? t('settings.resetting') : t('settings.deleteAll')}
        onConfirm={handleResetAccounting}
        onCancel={() => setIsAccountingResetConfirmOpen(false)}
      />
    </div>
  );
};
