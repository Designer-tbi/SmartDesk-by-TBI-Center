import React, { useState, useEffect } from 'react';
import { MOCK_COMPANY } from '../constants';
import { Building2, Mail, Phone, Globe, MapPin, FileText, Save, CheckCircle, Loader2, XCircle, Trash2, BookOpen } from 'lucide-react';
import { CompanyInfo } from '../types';
import { apiFetch } from '../lib/api';
import { ConfirmModal } from '../components/ConfirmModal';

import { useTranslation } from '../lib/i18n';

export const Settings = ({ user, setUser }: { user: any, setUser: (user: any) => void }) => {
  const { t, setLanguage } = useTranslation();
  const [company, setCompany] = useState<CompanyInfo>(MOCK_COMPANY);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isAccountingResetting, setIsAccountingResetting] = useState(false);
  const [isAccountingResetConfirmOpen, setIsAccountingResetConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    try {
      const response = await apiFetch('/api/company');
      if (response.ok) {
        const data = await response.json();
        if (data) setCompany(data);
      } else if (response.status === 403) {
        setError("Vous n'avez pas les permissions nécessaires pour modifier les paramètres de l'entreprise.");
      }
    } catch (error) {
      console.error('Failed to fetch company:', error);
      setError("Erreur lors de la récupération des informations de l'entreprise.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
        const updatedCompany = await response.json();
        setIsSaved(true);
        
        // Update global user state with new company info
        setUser({
          ...user,
          country: updatedCompany.country,
          state: updatedCompany.state,
          language: updatedCompany.language,
          currency: updatedCompany.currency
        });

        if (updatedCompany.language) {
          setLanguage(updatedCompany.language as any);
        }
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
        <p className="text-sm font-medium text-slate-500">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            {t('settings.companyInfo')}
          </h3>
          <p className="text-sm text-slate-500 mt-1">{t('settings.companyInfoDesc')}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.logoUrl')}</label>
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.companyName')}</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={company.name}
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.accountingSystem')}</label>
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.crmLanguage')}</label>
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.defaultCurrency')}</label>
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

            {/* Champs conditionnels selon le continent */}
            {company.country === 'AFRIQUE' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.taxId')}</label>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.rccm')}</label>
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

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.idNat')}</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={company.idNat || ''}
                      onChange={(e) => setCompany({ ...company, idNat: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {company.country === 'EUROPE' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.siren')}</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={company.siren || ''}
                      onChange={(e) => setCompany({ ...company, siren: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.siret')}</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={company.siret || ''}
                      onChange={(e) => setCompany({ ...company, siret: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.vatNumber')}</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={company.taxId || ''}
                      onChange={(e) => setCompany({ ...company, taxId: e.target.value })}
                      placeholder="FR 00 000000000"
                    />
                  </div>
                </div>
              </>
            )}

            {company.country === 'USA' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">EIN (Employer Identification Number)</label>
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
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.contactEmail')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={company.email}
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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.website')}</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="url"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={company.website}
                  onChange={(e) => setCompany({ ...company, website: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t('settings.address')}</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <textarea
                  rows={3}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  value={company.address}
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
                  <span className="text-sm font-medium">{t('settings.saveSuccess')}</span>
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
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSubmitting ? t('settings.saving') : t('settings.saveChanges')}
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
          <div className="space-y-3">
            <p className="text-sm text-rose-600/80">
              {t('settings.resetCrmDesc')}
            </p>
            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="w-full px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95"
            >
              {t('settings.resetCrmBtn')}
            </button>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-rose-600/80">
              {t('settings.resetAccountingDesc')}
            </p>
            <button
              onClick={() => setIsAccountingResetConfirmOpen(true)}
              className="w-full px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95"
            >
              {t('settings.resetAccountingBtn')}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">{t('settings.headerPreview')}</h3>
        <div className="p-6 border border-slate-100 rounded-xl bg-slate-50/30">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xl font-black text-slate-900 tracking-tight uppercase">{company.name}</div>
              <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{company.address}</p>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-700">{company.email}</p>
              <p>{company.phone}</p>
              <p>{company.website}</p>
              <div className="pt-2 font-bold text-slate-900 space-y-0.5">
                {company.country === 'EUROPE' ? (
                  <>
                    <p>SIREN: {company.siren}</p>
                    <p>SIRET: {company.siret}</p>
                    <p>TVA: {company.taxId}</p>
                  </>
                ) : company.country === 'USA' ? (
                  <p>EIN: {company.taxId}</p>
                ) : (
                  <>
                    <p>{company.taxId}</p>
                    <p>{company.rccm}</p>
                    <p>{company.idNat}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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
