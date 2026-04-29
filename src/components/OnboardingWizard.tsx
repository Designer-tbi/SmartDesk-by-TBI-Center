import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Globe, MapPin, Building2, KeyRound, ShieldCheck, Loader2, Radar, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { fetchDetectedLocale } from '../lib/geo';

/**
 * First-login onboarding wizard.
 *
 * Asks the user to:
 *   1. Pick (or auto-detect) their country/region.
 *   2. Provide a city.
 *   3. Paste their SFEC / DGID API key (mandatory — replaces the placeholder).
 *
 * Only shown once per company (`companies.onboardingCompleted=false`).
 */

type Country = {
  code: 'FR' | 'CG' | 'CD';
  label: string;
  flag: string;
  defaultCurrency: string;
  defaultStandard: string;
  defaultLanguage: 'fr' | 'en';
  cities: string[];
};

const COUNTRIES: Country[] = [
  {
    code: 'FR',
    label: 'France',
    flag: '🇫🇷',
    defaultCurrency: 'EUR',
    defaultStandard: 'FRANCE',
    defaultLanguage: 'fr',
    cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nice'],
  },
  {
    code: 'CG',
    label: 'République du Congo',
    flag: '🇨🇬',
    defaultCurrency: 'XAF',
    defaultStandard: 'OHADA',
    defaultLanguage: 'fr',
    cities: ['Brazzaville', 'Pointe-Noire', 'Dolisie', 'Nkayi', 'Owando', 'Ouesso'],
  },
  {
    code: 'CD',
    label: 'République Démocratique du Congo (RDC)',
    flag: '🇨🇩',
    defaultCurrency: 'CDF',
    defaultStandard: 'OHADA',
    defaultLanguage: 'fr',
    cities: ['Kinshasa', 'Lubumbashi', 'Goma', 'Bukavu', 'Mbuji-Mayi', 'Kisangani', 'Kananga', 'Matadi'],
  },
];

type Props = {
  onCompleted: () => void;
};

export const OnboardingWizard = ({ onCompleted }: Props) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [country, setCountry] = useState<Country>(COUNTRIES[1]); // Congo by default
  const [city, setCity] = useState<string>(COUNTRIES[1].cities[0]);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAutoDetect = async () => {
    setAutoDetecting(true);
    setAutoMessage(null);
    try {
      const loc = await fetchDetectedLocale();
      const iso = (loc.country || '').toUpperCase();
      // Map detected ISO-2 to one of our 3 supported countries.
      let target: Country | undefined;
      if (iso === 'FR') target = COUNTRIES[0];
      else if (iso === 'CG') target = COUNTRIES[1];
      else if (iso === 'CD') target = COUNTRIES[2];

      if (target) {
        setCountry(target);
        setCity(target.cities[0]);
        setAutoMessage(`Détecté : ${target.flag} ${target.label}`);
      } else {
        setAutoMessage(`Pays détecté (${iso}) hors liste — sélection manuelle.`);
      }
      setTimeout(() => setAutoMessage(null), 4500);
    } catch {
      setAutoMessage('Détection impossible — sélection manuelle.');
      setTimeout(() => setAutoMessage(null), 3000);
    } finally {
      setAutoDetecting(false);
    }
  };

  const handlePickCountry = (c: Country) => {
    setCountry(c);
    setCity(c.cities[0]);
  };

  const handleSubmit = async () => {
    if (apiKey.trim().length < 16) {
      setError('La clé API SFEC doit contenir au moins 16 caractères.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await apiFetch('/api/company/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: country.code,
          city,
          currency: country.defaultCurrency,
          accountingStandard: country.defaultStandard,
          language: country.defaultLanguage,
          fiscalizationApiKey: apiKey.trim(),
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.error || `Échec (HTTP ${r.status})`);
      }
      onCompleted();
    } catch (e: any) {
      setError(e?.message || 'Erreur inattendue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" data-testid="onboarding-wizard">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 pt-7 pb-5 bg-gradient-to-br from-[#7a0e1c] via-accent-red to-[#c1232a] text-white">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black tracking-[0.25em] uppercase opacity-80">
              SmartDesk · Onboarding
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            Bienvenue ! Configurons votre espace.
          </h2>
          <p className="text-sm text-white/85 mt-1">
            Quelques infos seulement — vous pourrez tout modifier dans Paramètres après.
          </p>

          <div className="flex items-center gap-2 mt-5 text-[11px] font-bold tracking-widest uppercase">
            <span className={`px-2.5 py-1 rounded-full ${step >= 1 ? 'bg-white text-accent-red' : 'bg-white/20 text-white/70'}`}>
              1 · Localisation
            </span>
            <span className="text-white/40">→</span>
            <span className={`px-2.5 py-1 rounded-full ${step >= 2 ? 'bg-white text-accent-red' : 'bg-white/20 text-white/70'}`}>
              2 · Clé API SFEC
            </span>
          </div>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Globe className="w-4 h-4 text-accent-red" />
                    Pays & ville
                  </h3>
                  <button
                    type="button"
                    onClick={handleAutoDetect}
                    disabled={autoDetecting}
                    data-testid="onboarding-auto-detect-btn"
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent-red hover:text-primary-red transition-colors disabled:opacity-50"
                  >
                    {autoDetecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />}
                    {autoDetecting ? 'Détection…' : 'Auto-détecter (IP)'}
                  </button>
                </div>

                {autoMessage && (
                  <div className="px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 font-semibold">
                    {autoMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {COUNTRIES.map((c) => {
                    const active = c.code === country.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handlePickCountry(c)}
                        data-testid={`onboarding-country-${c.code}`}
                        className={`text-left p-4 rounded-2xl border transition-all ${
                          active
                            ? 'bg-soft-red border-accent-red shadow-sm ring-2 ring-accent-red/15'
                            : 'bg-white border-slate-200 hover:border-accent-red/40 hover:bg-soft-red/30'
                        }`}
                      >
                        <div className="text-2xl mb-1.5">{c.flag}</div>
                        <div className={`text-sm font-black ${active ? 'text-accent-red' : 'text-slate-900'}`}>
                          {c.label}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
                          {c.defaultCurrency} · {c.defaultStandard}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    Ville principale
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      list="onboarding-cities"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="ex. Brazzaville"
                      data-testid="onboarding-city-input"
                      className="w-full pl-10 pr-4 py-3 bg-luxury-gray border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                    />
                    <datalist id="onboarding-cities">
                      {country.cities.map((cityName) => (
                        <option key={cityName} value={cityName} />
                      ))}
                    </datalist>
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1">
                    Suggestions {country.flag} {country.label} : {country.cities.slice(0, 4).join(' · ')}
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    data-testid="onboarding-next-btn"
                    className="px-6 py-3 bg-accent-red text-white rounded-2xl text-sm font-black uppercase tracking-wider hover:bg-primary-red shadow-lg shadow-accent-red/20 transition-all"
                  >
                    Continuer →
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent-red" />
                  Clé API SFEC (DGID)
                </h3>

                <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 leading-relaxed">
                  Cette clé authentifie vos factures auprès de la <strong>DGID Congo</strong> via le système SFEC.
                  Toutes vos factures émises seront automatiquement signées et certifiées avec cette clé — elle est
                  isolée à votre entreprise et n'est <strong>jamais partagée</strong> avec d'autres comptes.
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    Clé API SFEC *
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="97ecc28...943c"
                      data-testid="onboarding-api-key-input"
                      className="w-full pl-10 pr-12 py-3 bg-luxury-gray border border-slate-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1">
                    Copiez la clé reçue par e-mail de la part de la DGID Congo.
                  </p>
                </div>

                {error && (
                  <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 font-semibold flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                  </div>
                )}

                <div className="rounded-2xl bg-soft-red/40 border border-red-100 p-4 space-y-2">
                  <div className="text-[10px] font-bold text-accent-red uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Récapitulatif
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase tracking-wider">Pays</div>
                      <div className="font-bold text-slate-900">{country.flag} {country.label}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase tracking-wider">Ville</div>
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {city}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase tracking-wider">Devise</div>
                      <div className="font-bold text-slate-900">{country.defaultCurrency}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase tracking-wider">Comptabilité</div>
                      <div className="font-bold text-slate-900">{country.defaultStandard}</div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
                  >
                    ← Retour
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    data-testid="onboarding-submit-btn"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-accent-red text-white rounded-2xl text-sm font-black uppercase tracking-wider hover:bg-primary-red shadow-lg shadow-accent-red/20 transition-all disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {submitting ? 'Configuration…' : 'Activer mon espace'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
