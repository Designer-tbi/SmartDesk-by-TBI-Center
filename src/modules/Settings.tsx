import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Mail, Phone, Globe, MapPin, FileText, Save, CheckCircle, Loader2, XCircle, Trash2, BookOpen, User, Shield, Bell, Key, Eye, EyeOff, LogOut, Upload, Check, PlayCircle, Star, HelpCircle, LayoutDashboard, Calendar, Users, ShoppingCart, Package, Clock, Briefcase, UserCheck, Calculator, Settings as SettingsIcon, Radar, Wallet, Percent, Server, Lock, Hash, CreditCard, ExternalLink } from 'lucide-react';
import { HelpSection } from '../components/HelpSection';
import { CompanyInfo, User as UserType } from '../types';
import { apiFetch } from '../lib/api';
import { ConfirmModal } from '../components/ConfirmModal';
import { motion, AnimatePresence } from 'motion/react';
import { fetchDetectedLocale, mapIsoToRegion } from '../lib/geo';

import { useTranslation } from '../lib/i18n';
import { isManagerRole } from '../lib/roles';

export const Settings = ({ user: globalUser, setUser: setGlobalUser }: { user: any, setUser: any }) => {
  const { t, setLanguage } = useTranslation();
  // PUT /api/company and the CRM/accounting reset routes are all
  // requireManager server-side — hide those actions for non-managers so
  // they aren't left filling out a form that will just 403 on submit.
  const canManageCompany = isManagerRole(globalUser?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ['company', 'profile', 'security', 'notifications', 'help'] as const;
  type SettingsTab = (typeof VALID_TABS)[number];
  const requestedTab = searchParams.get('tab');
  const initialTab: SettingsTab = (VALID_TABS as readonly string[]).includes(requestedTab || '')
    ? (requestedTab as SettingsTab)
    : 'company';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
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
    niu: '',
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
  const [isDetectingGeo, setIsDetectingGeo] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailReports: true,
    newLead: true,
    invoicePaid: true,
    projectUpdate: true,
    ...(globalUser?.preferences?.notifications || {}),
  });
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  // Write-only: never pre-filled from the server (the real key is never
  // echoed back). Left empty, the backend keeps whatever key is already
  // stored — only a non-empty value here rotates it.
  const [fiscalizationKeyInput, setFiscalizationKeyInput] = useState('');
  // Same write-only pattern as the SFEC key: never pre-filled from the
  // server, blank on save = keep the currently stored SMTP password.
  const [smtpPassInput, setSmtpPassInput] = useState('');
  // Same write-only pattern for the PayPal client secret.
  const [paypalSecretInput, setPaypalSecretInput] = useState('');
  const [isTestingPaypal, setIsTestingPaypal] = useState(false);
  const [paypalTestStatus, setPaypalTestStatus] = useState<'idle' | 'awaiting' | 'capturing' | 'success' | 'error' | 'cancelled'>('idle');
  const [paypalTestMessage, setPaypalTestMessage] = useState<string | null>(null);

  const handleDetectCountry = async () => {
    setIsDetectingGeo(true);
    setGeoMessage(null);
    try {
      const loc = await fetchDetectedLocale();
      const region = mapIsoToRegion(loc.country);
      // The backend already returns optimal currency / accounting standard /
      // language per country. Apply them in one shot so the user doesn't
      // have to configure each dropdown manually.
      setCompany((prev) => ({
        ...prev,
        country: region,
        currency: loc.currency || prev.currency || 'XAF',
        accountingStandard: (loc.accountingStandard as any) || prev.accountingStandard || 'OHADA',
        language: loc.language || prev.language || 'fr',
      }));
      if (loc.language && (loc.language === 'fr' || loc.language === 'en')) {
        setLanguage(loc.language as any);
      }
      const bits: string[] = [loc.country, `→ ${region}`];
      if (loc.currency) bits.push(loc.currency);
      if (loc.accountingStandard) bits.push(loc.accountingStandard);
      setGeoMessage(bits.join(' · '));
      setTimeout(() => setGeoMessage(null), 5000);
    } catch {
      setGeoMessage('Détection impossible');
      setTimeout(() => setGeoMessage(null), 3000);
    } finally {
      setIsDetectingGeo(false);
    }
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
            // notificationPrefs was seeded from `globalUser` at mount time,
            // before this fetch resolved — sync it now that the persisted
            // preferences have actually arrived, otherwise the toggles
            // always show the hardcoded defaults instead of what was last
            // saved (looked like saving silently did nothing).
            if (data.preferences?.notifications) {
              setNotificationPrefs((prev) => ({ ...prev, ...data.preferences.notifications }));
            }
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
    // Only run once on mount. `t` would otherwise change every time the
    // language is toggled and re-fetch the company, silently clobbering
    // any unsaved edits the user just made (including auto-detect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handles the redirect back from PayPal's own site after the user
  // approves (or cancels) the test payment — PayPal appends `token`
  // (the order id) to our return_url automatically.
  useEffect(() => {
    const paypalTest = searchParams.get('paypalTest');
    if (paypalTest === 'return') {
      const orderId = searchParams.get('token');
      if (orderId) {
        setPaypalTestStatus('capturing');
        (async () => {
          try {
            const res = await apiFetch('/api/company/paypal/test-payment/capture', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId }),
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.status === 'COMPLETED') {
              setPaypalTestStatus('success');
              setPaypalTestMessage(
                `${t('settings.paypalTestSuccess')} (${data.amount?.value || ''} ${data.amount?.currency_code || 'USD'})`,
              );
            } else {
              setPaypalTestStatus('error');
              setPaypalTestMessage(data?.error || t('settings.paypalTestError'));
            }
          } catch {
            setPaypalTestStatus('error');
            setPaypalTestMessage(t('settings.paypalTestError'));
          }
        })();
      }
      setSearchParams({ tab: 'company' }, { replace: true });
    } else if (paypalTest === 'cancel') {
      setPaypalTestStatus('cancelled');
      setPaypalTestMessage(t('settings.paypalTestCancelled'));
      setSearchParams({ tab: 'company' }, { replace: true });
    }
    // Only run once on mount, once searchParams has settled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePaypalTestPayment = async () => {
    setIsTestingPaypal(true);
    setPaypalTestStatus('idle');
    setPaypalTestMessage(null);
    try {
      const res = await apiFetch('/api/company/paypal/test-payment', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.approveUrl) {
        // Same-tab redirect — the PayPal return_url brings the browser back
        // to this exact page, so the effect below that captures the order
        // fires here. Opening in a new tab (window.open) would leave this
        // tab's status stuck on "awaiting" forever since the capture would
        // run in the other tab's own component instance instead.
        window.location.href = data.approveUrl;
      } else {
        setPaypalTestStatus('error');
        setPaypalTestMessage(data?.error || t('settings.paypalTestError'));
      }
    } catch {
      setPaypalTestStatus('error');
      setPaypalTestMessage(t('settings.paypalTestError'));
    } finally {
      setIsTestingPaypal(false);
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
        body: JSON.stringify({
          ...company,
          fiscalizationApiKey: fiscalizationKeyInput || undefined,
          smtpPass: smtpPassInput || undefined,
          paypalClientSecret: paypalSecretInput || undefined,
        }),
      });

      if (response.ok) {
        // Never keep the plaintext SFEC key around client-side once saved —
        // the server never echoes it back either.
        const updated = await response.json().catch(() => null);
        if (updated) setCompany(updated);
        setFiscalizationKeyInput('');
        setSmtpPassInput('');
        setPaypalSecretInput('');
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
          hasFiscalizationKey: updated?.hasFiscalizationKey,
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

  const handleSaveNotificationPrefs = async () => {
    setIsSavingPrefs(true);
    try {
      const response = await apiFetch('/api/auth/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: notificationPrefs }),
      });
      if (response.ok) {
        setGlobalUser((prev: any) => prev ? {
          ...prev,
          preferences: { ...prev.preferences, notifications: notificationPrefs },
        } : prev);
        setSuccessMessage(t('settings.success.preferencesSaved'));
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(t('settings.error.save'));
      }
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      setError(t('settings.error.connection'));
    } finally {
      setIsSavingPrefs(false);
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
      <div className="flex items-center gap-1 p-1 bg-soft-red/30 rounded-2xl max-w-full overflow-x-auto">
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
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.continentRegion')}</label>
                      <button
                        type="button"
                        onClick={handleDetectCountry}
                        disabled={isDetectingGeo}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-accent-red hover:text-primary-red uppercase tracking-widest transition-colors disabled:opacity-50"
                        data-testid="settings-auto-detect-country-btn"
                      >
                        {isDetectingGeo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />}
                        {isDetectingGeo ? 'Détection…' : 'Auto-détecter (IP)'}
                      </button>
                    </div>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={company.country || 'EUROPE'}
                        onChange={(e) => setCompany({ ...company, country: e.target.value })}
                      >
                        <option value="FR">🇫🇷 France</option>
                        <option value="CG">🇨🇬 République du Congo</option>
                        <option value="CD">🇨🇩 République Démocratique du Congo (RDC)</option>
                        <option disabled>──────────</option>
                        <option value="CONTINENT">{t('settings.continentGeneral')}</option>
                        <option value="AFRIQUE">{t('settings.africa')}</option>
                        <option value="CONGO">{t('settings.congo')}</option>
                        <option value="EUROPE">{t('settings.europe')}</option>
                        <option value="USA">{t('settings.usa')}</option>
                      </select>
                    </div>
                    {geoMessage && (
                      <p className="text-xs text-emerald-600 font-medium pl-1 animate-in fade-in slide-in-from-left-1">
                        IP détectée : {geoMessage}
                      </p>
                    )}
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
                        {company.currency === 'XAF' ? 'FCFA' : company.currency === 'XOF' ? 'FCFA' : company.currency === 'CDF' ? 'FC' : company.currency === 'EUR' ? '€' : '$'}
                      </span>
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={company.currency || 'XAF'}
                        onChange={(e) => setCompany({ ...company, currency: e.target.value })}
                      >
                        <option value="XAF">{t('settings.currencyXaf')}</option>
                        <option value="XOF">XOF — Franc CFA UEMOA</option>
                        <option value="CDF">CDF — Franc Congolais</option>
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
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.niu')}</label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="P2012345678"
                            className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                            value={company.niu || ''}
                            onChange={(e) => setCompany({ ...company, niu: e.target.value })}
                            data-testid="settings-company-niu-input"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.idNat')}</label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="01-123-A4567B"
                            className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                            value={company.idNat || ''}
                            onChange={(e) => setCompany({ ...company, idNat: e.target.value })}
                            data-testid="settings-company-idnat-input"
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

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Forme juridique</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={(company as any).legalForm || ''}
                        onChange={(e) => setCompany({ ...company, legalForm: e.target.value } as any)}
                        data-testid="settings-legal-form"
                      >
                        <option value="">— Sélectionner —</option>
                        <option value="SARL — Société à Responsabilité Limitée">SARL</option>
                        <option value="SARLU — SARL Unipersonnelle">SARLU</option>
                        <option value="SA — Société Anonyme">SA</option>
                        <option value="SAS — Société par Actions Simplifiée">SAS</option>
                        <option value="SASU — SAS Unipersonnelle">SASU</option>
                        <option value="SNC — Société en Nom Collectif">SNC</option>
                        <option value="SCS — Société en Commandite Simple">SCS</option>
                        <option value="EI — Entreprise Individuelle">EI</option>
                        <option value="EURL — Entreprise Unipersonnelle à Responsabilité Limitée">EURL</option>
                        <option value="GIE — Groupement d'Intérêt Économique">GIE</option>
                        <option value="Coopérative">Coopérative</option>
                        <option value="Association">Association</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                      Capital social ({company.currency || 'XAF'})
                    </label>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number" min="0"
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={(company as any).capital ?? ''}
                        onChange={(e) => setCompany({ ...company, capital: e.target.value === '' ? undefined : Number(e.target.value) } as any)}
                        data-testid="settings-capital"
                        placeholder="1000000"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Représentant légal</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={(company as any).representativeName || ''}
                        onChange={(e) => setCompany({ ...company, representativeName: e.target.value } as any)}
                        data-testid="settings-rep-name"
                        placeholder="Nom complet"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Qualité du représentant</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                        value={(company as any).representativeRole || ''}
                        onChange={(e) => setCompany({ ...company, representativeRole: e.target.value } as any)}
                        data-testid="settings-rep-role"
                      >
                        <option value="">— Sélectionner —</option>
                        <option value="Gérant">Gérant</option>
                        <option value="Co-Gérant">Co-Gérant</option>
                        <option value="Président">Président</option>
                        <option value="Président-Directeur Général">Président-Directeur Général</option>
                        <option value="Directeur Général">Directeur Général</option>
                        <option value="Directeur">Directeur</option>
                        <option value="Administrateur">Administrateur</option>
                        <option value="Associé Unique">Associé Unique</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                  </div>

                  {company.country === 'CG' && (
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        {t('settings.fiscalizationApiKey')}
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder={company.hasFiscalizationKey ? '••••••••••••••••' : t('settings.fiscalizationApiKeyPlaceholder')}
                          className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                          value={fiscalizationKeyInput}
                          onChange={(e) => setFiscalizationKeyInput(e.target.value)}
                          data-testid="settings-company-fiscalization-key-input"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 ml-1">
                        {company.hasFiscalizationKey
                          ? t('settings.fiscalizationApiKeyConfiguredHint')
                          : t('settings.fiscalizationApiKeyMissingHint')}
                      </p>
                    </div>
                  )}

                  {company.accountingStandard === 'OHADA' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CNSS — part patronale (%)</label>
                        <div className="relative">
                          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="number" min="0" max="100" step="0.01"
                            className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                            value={(company as any).cnssEmployerRate ?? ''}
                            onChange={(e) => setCompany({ ...company, cnssEmployerRate: e.target.value === '' ? undefined : Number(e.target.value) } as any)}
                            data-testid="settings-cnss-employer"
                            placeholder="16"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CNSS — part salariale (%)</label>
                        <div className="relative">
                          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="number" min="0" max="100" step="0.01"
                            className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                            value={(company as any).cnssEmployeeRate ?? ''}
                            onChange={(e) => setCompany({ ...company, cnssEmployeeRate: e.target.value === '' ? undefined : Number(e.target.value) } as any)}
                            data-testid="settings-cnss-employee"
                            placeholder="4"
                          />
                        </div>
                      </div>
                    </>
                  )}

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

                <div className="pt-6 mt-2 border-t border-slate-100 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-accent-red" />
                      {t('settings.smtpTitle')}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">{t('settings.smtpDesc')}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.smtpHost')}</label>
                      <div className="relative">
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                          value={(company as any).smtpHost || ''}
                          onChange={(e) => setCompany({ ...company, smtpHost: e.target.value } as any)}
                          data-testid="settings-smtp-host"
                          placeholder="smtp.exemple.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.smtpPort')}</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="number" min="1" max="65535"
                          className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                          value={(company as any).smtpPort ?? ''}
                          onChange={(e) => setCompany({ ...company, smtpPort: e.target.value === '' ? undefined : Number(e.target.value) } as any)}
                          data-testid="settings-smtp-port"
                          placeholder="465"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.smtpUser')}</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                          value={(company as any).smtpUser || ''}
                          onChange={(e) => setCompany({ ...company, smtpUser: e.target.value } as any)}
                          data-testid="settings-smtp-user"
                          placeholder="contact@monentreprise.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.smtpPass')}</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder={(company as any).hasSmtpConfig ? '••••••••••••••••' : t('settings.smtpPassPlaceholder')}
                          className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                          value={smtpPassInput}
                          onChange={(e) => setSmtpPassInput(e.target.value)}
                          data-testid="settings-smtp-pass"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.smtpFromName')}</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                          value={(company as any).smtpFromName || ''}
                          onChange={(e) => setCompany({ ...company, smtpFromName: e.target.value } as any)}
                          data-testid="settings-smtp-from-name"
                          placeholder={company.name || 'Mon Entreprise'}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="smtp-secure"
                        checked={(company as any).smtpSecure !== false}
                        onChange={(e) => setCompany({ ...company, smtpSecure: e.target.checked } as any)}
                        className="w-4 h-4 rounded border-red-200 text-accent-red focus:ring-accent-red/20"
                        data-testid="settings-smtp-secure"
                      />
                      <label htmlFor="smtp-secure" className="text-sm text-slate-600">{t('settings.smtpSecure')}</label>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 ml-1">
                    {(company as any).hasSmtpConfig
                      ? t('settings.smtpConfiguredHint')
                      : t('settings.smtpMissingHint')}
                  </p>
                </div>

                <div className="pt-6 mt-2 border-t border-slate-100 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-accent-red" />
                      {t('settings.paypalTitle')}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">{t('settings.paypalDesc')}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.paypalClientId')}</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                          value={(company as any).paypalClientId || ''}
                          onChange={(e) => setCompany({ ...company, paypalClientId: e.target.value } as any)}
                          data-testid="settings-paypal-client-id"
                          placeholder="AeA1xy..."
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.paypalClientSecret')}</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder={(company as any).hasPaypalConfig ? '••••••••••••••••' : t('settings.paypalClientSecretPlaceholder')}
                          className="w-full pl-10 pr-4 py-2.5 bg-luxury-gray border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                          value={paypalSecretInput}
                          onChange={(e) => setPaypalSecretInput(e.target.value)}
                          data-testid="settings-paypal-client-secret"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 ml-1">
                    {(company as any).hasPaypalConfig
                      ? t('settings.paypalConfiguredHint')
                      : t('settings.paypalMissingHint')}
                  </p>

                  {(company as any).hasPaypalConfig && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-soft-red/20 rounded-xl p-4">
                      <button
                        type="button"
                        onClick={handlePaypalTestPayment}
                        disabled={isTestingPaypal}
                        data-testid="settings-paypal-test-payment-btn"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-red-100 rounded-xl text-sm font-bold text-accent-red hover:bg-soft-red transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {isTestingPaypal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                        {t('settings.paypalTestButton')}
                      </button>
                      {paypalTestMessage && (
                        <p className={`text-sm font-medium ${
                          paypalTestStatus === 'success' ? 'text-emerald-600'
                            : paypalTestStatus === 'error' ? 'text-red-600'
                            : 'text-slate-500'
                        }`}>
                          {paypalTestStatus === 'capturing' ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                          {paypalTestMessage}
                        </p>
                      )}
                    </div>
                  )}
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
                  {canManageCompany && (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-accent-red text-white rounded-xl text-sm font-bold hover:bg-primary-red transition-all shadow-lg shadow-accent-red/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSubmitting ? t('settings.updating') : t('common.save')}
                  </button>
                  )}
                </div>
              </form>
            </div>

            {canManageCompany && (
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
            )}
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

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-slate-100">
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
                <div className="flex flex-wrap items-center gap-3">
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
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={notificationPrefs.emailReports}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, emailReports: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-red/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-red"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-soft-red/10 rounded-xl border border-red-50">
                  <div>
                    <h4 className="text-sm font-bold text-primary-red">{t('settings.newLead')}</h4>
                    <p className="text-xs text-slate-500">{t('settings.newLeadDesc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={notificationPrefs.newLead}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, newLead: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-red/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-red"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-soft-red/10 rounded-xl border border-red-50">
                  <div>
                    <h4 className="text-sm font-bold text-primary-red">{t('settings.invoicePaid')}</h4>
                    <p className="text-xs text-slate-500">{t('settings.invoicePaidDesc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={notificationPrefs.invoicePaid}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, invoicePaid: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-red/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-red"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-soft-red/10 rounded-xl border border-red-50">
                  <div>
                    <h4 className="text-sm font-bold text-primary-red">{t('settings.projectUpdate')}</h4>
                    <p className="text-xs text-slate-500">{t('settings.projectUpdateDesc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={notificationPrefs.projectUpdate}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, projectUpdate: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-red/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-red"></div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingPrefs}
                  onClick={handleSaveNotificationPrefs}
                  className="flex items-center gap-2 px-6 py-2.5 bg-accent-red text-white rounded-xl text-sm font-bold hover:bg-primary-red transition-all shadow-lg shadow-accent-red/20 active:scale-95 disabled:opacity-50"
                >
                  {isSavingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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
