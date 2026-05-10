import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Globe, MapPin, Building2, KeyRound, ShieldCheck, Loader2, Radar,
  Check, AlertCircle, Eye, EyeOff, Upload, FileText, Phone, Mail, User,
  Briefcase, Wallet, Percent, ChevronRight, ChevronLeft, SkipForward,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { fetchDetectedLocale } from '../lib/geo';

/**
 * First-login onboarding wizard — extended.
 *
 * Steps:
 *   1. Country / city (auto-detect IP supported).
 *   2. Company identity (logo, name, legal form, RCCM, NIU/ID NAT, capital).
 *   3. Contact + legal representative (address, phone, email, website).
 *   4. CNSS rates (only when accountingStandard === OHADA).
 *   5. SFEC API key (CONGO ONLY — optional, can be skipped).
 *
 * Only shown once per company (`companies.onboardingCompleted=false`).
 */

type Country = {
  code: 'FR' | 'CG' | 'CD';
  label: string;
  flag: string;
  defaultCurrency: string;
  defaultStandard: 'OHADA' | 'FRANCE' | 'US_GAAP';
  defaultLanguage: 'fr' | 'en';
  cities: string[];
  /** Default CNSS employer % */
  cnssEmployer: number;
  /** Default CNSS employee % */
  cnssEmployee: number;
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
    cnssEmployer: 42, // URSSAF approx
    cnssEmployee: 22,
  },
  {
    code: 'CG',
    label: 'République du Congo',
    flag: '🇨🇬',
    defaultCurrency: 'XAF',
    defaultStandard: 'OHADA',
    defaultLanguage: 'fr',
    cities: ['Brazzaville', 'Pointe-Noire', 'Dolisie', 'Nkayi', 'Owando', 'Ouesso'],
    cnssEmployer: 16, // CNSS Congo (8% prestations familiales + 8% retraite)
    cnssEmployee: 4,
  },
  {
    code: 'CD',
    label: 'République Démocratique du Congo (RDC)',
    flag: '🇨🇩',
    defaultCurrency: 'CDF',
    defaultStandard: 'OHADA',
    defaultLanguage: 'fr',
    cities: ['Kinshasa', 'Lubumbashi', 'Goma', 'Bukavu', 'Mbuji-Mayi', 'Kisangani', 'Kananga', 'Matadi'],
    cnssEmployer: 13, // CNSS RDC: 9% pension + 1.5% AT + 6.5% prestations familiales
    cnssEmployee: 5,
  },
];

const LEGAL_FORMS = [
  'SARL — Société à Responsabilité Limitée',
  'SARLU — SARL Unipersonnelle',
  'SA — Société Anonyme',
  'SAS — Société par Actions Simplifiée',
  'SASU — SAS Unipersonnelle',
  'SNC — Société en Nom Collectif',
  'SCS — Société en Commandite Simple',
  'EI — Entreprise Individuelle',
  'EURL — Entreprise Unipersonnelle à Responsabilité Limitée',
  'GIE — Groupement d\'Intérêt Économique',
  'Coopérative',
  'Association',
  'Autre',
];

const REPRESENTATIVE_ROLES = [
  'Gérant', 'Co-Gérant', 'Président', 'Président-Directeur Général',
  'Directeur Général', 'Directeur', 'Administrateur', 'Associé Unique', 'Autre',
];

type Props = {
  onCompleted: () => void;
};

type Step = 1 | 2 | 3 | 4 | 5;

export const OnboardingWizard = ({ onCompleted }: Props) => {
  const [step, setStep] = useState<Step>(1);
  // Pre-select the country already stored on the company (set at signup
  // time from the IP geolocation) so the user doesn't have to re-pick it.
  const initialCountry = React.useMemo<Country>(() => {
    if (typeof window === 'undefined') return COUNTRIES[1];
    // Read from a cached /api/auth/me payload if anything has already
    // populated it (Login or App's bootstrap effect). Otherwise default
    // to Congo — historical default for SmartDesk demos.
    try {
      const cached = (window as any).__SMARTDESK_USER__;
      const iso = String(cached?.country || '').toUpperCase();
      const m = COUNTRIES.find(c => c.code === iso);
      if (m) return m;
    } catch { /* noop */ }
    return COUNTRIES[1];
  }, []);
  const [country, setCountry] = useState<Country>(initialCountry);
  const [city, setCity] = useState<string>(initialCountry.cities[0]);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 — identity
  const [logo, setLogo] = useState('');
  const [name, setName] = useState('');
  const [legalForm, setLegalForm] = useState('SARL — Société à Responsabilité Limitée');
  const [rccm, setRccm] = useState('');
  const [niu, setNiu] = useState(''); // for CG
  const [idNat, setIdNat] = useState(''); // for CG/CD
  const [taxId, setTaxId] = useState(''); // generic NIF / SIREN / VAT
  const [capital, setCapital] = useState('');

  // Step 3 — contact & rep
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [representativeRole, setRepresentativeRole] = useState('Gérant');

  // Step 4 — CNSS
  const [cnssEmployerRate, setCnssEmployerRate] = useState<string>(String(COUNTRIES[1].cnssEmployer));
  const [cnssEmployeeRate, setCnssEmployeeRate] = useState<string>(String(COUNTRIES[1].cnssEmployee));

  // Step 5 — SFEC (Congo only, optional)
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const isOhada = country.defaultStandard === 'OHADA';
  const isCongo = country.code === 'CG';
  const lastStep: Step = isCongo ? 5 : isOhada ? 4 : 3;

  const handleAutoDetect = async () => {
    setAutoDetecting(true);
    setAutoMessage(null);
    try {
      const loc = await fetchDetectedLocale();
      const iso = (loc.country || '').toUpperCase();
      const target = COUNTRIES.find(c => c.code === iso);
      if (target) {
        applyCountry(target);
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

  const applyCountry = (c: Country) => {
    setCountry(c);
    setCity(c.cities[0]);
    setCnssEmployerRate(String(c.cnssEmployer));
    setCnssEmployeeRate(String(c.cnssEmployee));
  };

  const handleLogoFile = (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo trop volumineux (max 2 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setLogo(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const stepValid = (s: Step): boolean => {
    if (s === 1) return !!country && !!city.trim();
    if (s === 2) return !!name.trim();
    if (s === 3) return !!address.trim() && !!phone.trim() && !!email.trim();
    if (s === 4) {
      const a = Number(cnssEmployerRate), b = Number(cnssEmployeeRate);
      return Number.isFinite(a) && a >= 0 && a <= 100 && Number.isFinite(b) && b >= 0 && b <= 100;
    }
    return true; // step 5 always valid (optional)
  };

  const goNext = () => {
    setError(null);
    if (!stepValid(step)) {
      setError('Merci de compléter les champs requis.');
      return;
    }
    setStep((s) => Math.min(lastStep, (s + 1)) as Step);
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(1, (s - 1)) as Step);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Validate SFEC if user provided one (Congo only)
      const trimmedKey = apiKey.trim();
      if (isCongo && trimmedKey && trimmedKey.length < 16) {
        setError('Clé API SFEC invalide (16 caractères minimum).');
        setSubmitting(false);
        return;
      }

      const payload: Record<string, unknown> = {
        country: country.code,
        city,
        currency: country.defaultCurrency,
        accountingStandard: country.defaultStandard,
        language: country.defaultLanguage,
        // identity
        name: name.trim() || null,
        logo: logo || null,
        legalForm,
        rccm: rccm.trim() || null,
        niu: niu.trim() || null,
        idNat: idNat.trim() || null,
        taxId: taxId.trim() || null,
        capital: capital ? Number(capital) : null,
        // contact + rep
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        representativeName: representativeName.trim() || null,
        representativeRole,
        // cnss
        cnssEmployerRate: cnssEmployerRate !== '' ? Number(cnssEmployerRate) : null,
        cnssEmployeeRate: cnssEmployeeRate !== '' ? Number(cnssEmployeeRate) : null,
        // SFEC (only persisted for Congo, empty otherwise)
        fiscalizationApiKey: isCongo ? trimmedKey : '',
      };

      const r = await apiFetch('/api/company/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  // ---- Renderers ----
  const stepLabels: Record<Step, string> = {
    1: 'Localisation',
    2: 'Identité',
    3: 'Contact',
    4: 'Cotisations',
    5: 'Clé SFEC',
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      data-testid="onboarding-wizard"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-white w-full max-w-3xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-4"
      >
        {/* Header */}
        <div className="px-5 sm:px-8 pt-6 pb-5 bg-gradient-to-br from-[#7a0e1c] via-accent-red to-[#c1232a] text-white">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black tracking-[0.25em] uppercase opacity-80">
              SmartDesk · Onboarding
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Configurons votre espace.
          </h2>
          <p className="text-xs sm:text-sm text-white/85 mt-1">
            {step}/{lastStep} — {stepLabels[step]} · Tout reste modifiable depuis Paramètres.
          </p>

          {/* Stepper bar */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
            {Array.from({ length: lastStep }).map((_, i) => {
              const s = (i + 1) as Step;
              const active = step >= s;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <span className="text-white/30 text-xs shrink-0">→</span>}
                  <span
                    className={`px-2 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[11px] font-bold tracking-widest uppercase shrink-0 ${
                      active ? 'bg-white text-accent-red' : 'bg-white/20 text-white/70'
                    }`}
                  >
                    {s} · {stepLabels[s]}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="p-5 sm:p-8 max-h-[70vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* ============ STEP 1 — Country / city ============ */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Globe className="w-4 h-4 text-accent-red" /> Pays & ville
                  </h3>
                  <button
                    type="button"
                    onClick={handleAutoDetect}
                    disabled={autoDetecting}
                    data-testid="onboarding-auto-detect-btn"
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent-red hover:text-primary-red disabled:opacity-50"
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {COUNTRIES.map((c) => {
                    const active = c.code === country.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => applyCountry(c)}
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

                <FieldLabel>Ville principale</FieldLabel>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    list="onboarding-cities"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    data-testid="onboarding-city-input"
                    className="w-full pl-10 pr-4 py-3 bg-luxury-gray border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red"
                  />
                  <datalist id="onboarding-cities">
                    {country.cities.map((cn) => <option key={cn} value={cn} />)}
                  </datalist>
                </div>
              </motion.div>
            )}

            {/* ============ STEP 2 — Identity ============ */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-accent-red" /> Identité de l'entreprise
                </h3>

                {/* Logo upload */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {logo ? (
                      <img src={logo} alt="logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Building2 className="w-7 h-7 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> Téléverser un logo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        data-testid="onboarding-logo-upload"
                        onChange={(e) => handleLogoFile(e.target.files?.[0])}
                      />
                    </label>
                    <input
                      type="url"
                      placeholder="ou collez une URL d'image…"
                      value={logo.startsWith('data:') ? '' : logo}
                      onChange={(e) => setLogo(e.target.value)}
                      data-testid="onboarding-logo-url"
                      className="w-full px-3 py-2 bg-luxury-gray border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    />
                  </div>
                </div>

                <Grid2>
                  <Field icon={Building2} label="Nom de la société *">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="onboarding-name"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    />
                  </Field>
                  <Field icon={Briefcase} label="Forme juridique">
                    <select
                      value={legalForm}
                      onChange={(e) => setLegalForm(e.target.value)}
                      data-testid="onboarding-legal-form"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    >
                      {LEGAL_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>
                  <Field icon={FileText} label="RCCM (Registre du Commerce)">
                    <input
                      type="text" value={rccm} onChange={(e) => setRccm(e.target.value)}
                      placeholder={country.code === 'CG' ? 'CG-BZV-01-2024-B12-00099' : country.code === 'CD' ? 'CD/KIN/RCCM/24-B-01234' : 'FR12345678901234'}
                      data-testid="onboarding-rccm"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    />
                  </Field>
                  {country.code === 'CG' && (
                    <Field icon={FileText} label="NIU (CEMAC)">
                      <input
                        type="text" value={niu} onChange={(e) => setNiu(e.target.value)}
                        placeholder="P2012345678"
                        data-testid="onboarding-niu"
                        className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                      />
                    </Field>
                  )}
                  {(country.code === 'CG' || country.code === 'CD') && (
                    <Field icon={FileText} label={country.code === 'CD' ? 'ID NAT (RDC)' : 'ID NAT'}>
                      <input
                        type="text" value={idNat} onChange={(e) => setIdNat(e.target.value)}
                        placeholder={country.code === 'CD' ? '01-A1-N12345B' : '01-123-A4567B'}
                        data-testid="onboarding-idnat"
                        className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                      />
                    </Field>
                  )}
                  {country.code === 'FR' && (
                    <Field icon={FileText} label="N° TVA / SIREN">
                      <input
                        type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)}
                        placeholder="FR12345678901"
                        data-testid="onboarding-taxid"
                        className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                      />
                    </Field>
                  )}
                  <Field icon={Wallet} label={`Capital social (${country.defaultCurrency})`}>
                    <input
                      type="number" min="0" value={capital} onChange={(e) => setCapital(e.target.value)}
                      placeholder="1000000"
                      data-testid="onboarding-capital"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    />
                  </Field>
                </Grid2>
              </motion.div>
            )}

            {/* ============ STEP 3 — Contact + representative ============ */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Phone className="w-4 h-4 text-accent-red" /> Coordonnées & représentant légal
                </h3>

                <Grid2>
                  <Field icon={Mail} label="Email entreprise *">
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      data-testid="onboarding-email"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    />
                  </Field>
                  <Field icon={Phone} label="Téléphone *">
                    <input
                      type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder={country.code === 'CG' ? '+242 06 XX XX XXX' : country.code === 'CD' ? '+243 XX XXX XXXX' : '+33 6 XX XX XX XX'}
                      data-testid="onboarding-phone"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    />
                  </Field>
                  <Field icon={Globe} label="Site web">
                    <input
                      type="url" value={website} onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://exemple.com"
                      data-testid="onboarding-website"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    />
                  </Field>
                  <Field icon={MapPin} label="Adresse complète *">
                    <input
                      type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                      placeholder="Avenue, quartier, arrondissement"
                      data-testid="onboarding-address"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    />
                  </Field>
                  <Field icon={User} label="Représentant légal">
                    <input
                      type="text" value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)}
                      placeholder="Nom complet"
                      data-testid="onboarding-rep-name"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    />
                  </Field>
                  <Field icon={Briefcase} label="Qualité du représentant">
                    <select
                      value={representativeRole}
                      onChange={(e) => setRepresentativeRole(e.target.value)}
                      data-testid="onboarding-rep-role"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    >
                      {REPRESENTATIVE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                </Grid2>
              </motion.div>
            )}

            {/* ============ STEP 4 — CNSS rates (OHADA) ============ */}
            {step === 4 && isOhada && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Percent className="w-4 h-4 text-accent-red" /> Taux de cotisation CNSS
                </h3>

                <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 leading-relaxed">
                  Ces taux sont appliqués automatiquement lors de la <strong>génération des bulletins de paie</strong> (module RH).
                  Les valeurs par défaut suivent les barèmes officiels {country.flag} {country.code === 'CG' ? 'Congo' : 'RDC'} 2025 — modifiez si votre régime déroge.
                </div>

                <Grid2>
                  <Field icon={Percent} label="Part patronale (employeur) %">
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={cnssEmployerRate}
                      onChange={(e) => setCnssEmployerRate(e.target.value)}
                      data-testid="onboarding-cnss-employer"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    />
                  </Field>
                  <Field icon={Percent} label="Part salariale %">
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={cnssEmployeeRate}
                      onChange={(e) => setCnssEmployeeRate(e.target.value)}
                      data-testid="onboarding-cnss-employee"
                      className="w-full pl-10 pr-3 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                    />
                  </Field>
                </Grid2>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600">
                  <strong className="text-slate-900">Exemple :</strong> sur un brut de 500 000, la cotisation salariale ({cnssEmployeeRate || 0} %) sera retenue sur le bulletin et la cotisation patronale ({cnssEmployerRate || 0} %) sera supportée par l'entreprise.
                </div>
              </motion.div>
            )}

            {/* ============ STEP 5 — SFEC (Congo only, optional) ============ */}
            {step === 5 && isCongo && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent-red" /> Clé API SFEC (DGID Congo) <span className="ml-1 text-[10px] text-slate-400 normal-case font-bold">— optionnel</span>
                </h3>

                <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 leading-relaxed">
                  Cette clé authentifie vos factures auprès de la <strong>DGID Congo</strong> via le système SFEC.
                  <br /><strong>Vous pouvez sauter cette étape</strong> et la renseigner plus tard depuis Paramètres → Entreprise lorsque la DGID vous l'aura délivrée.
                </div>

                <Field icon={KeyRound} label="Clé API SFEC (optionnel)">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Coller la clé reçue par email…"
                    data-testid="onboarding-api-key-input"
                    className="w-full pl-10 pr-12 py-2.5 bg-luxury-gray border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-red/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </Field>

                <Recap
                  country={country} city={city} name={name}
                  email={email} phone={phone}
                  cnssEmployerRate={cnssEmployerRate} cnssEmployeeRate={cnssEmployeeRate}
                  isOhada={isOhada}
                />
              </motion.div>
            )}

            {/* RECAP at last step when no SFEC step */}
            {step === lastStep && !isCongo && (
              <motion.div
                key="recap"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="mt-5"
              >
                <Recap
                  country={country} city={city} name={name}
                  email={email} phone={phone}
                  cnssEmployerRate={cnssEmployerRate} cnssEmployeeRate={cnssEmployeeRate}
                  isOhada={isOhada}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="mt-4 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 sm:px-8 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1}
            data-testid="onboarding-back-btn"
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-100 transition-all disabled:opacity-40 inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex gap-2">
            {step === 5 && isCongo && !apiKey.trim() && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                data-testid="onboarding-skip-btn"
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-100 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <SkipForward className="w-4 h-4" /> Sauter cette étape
              </button>
            )}
            {step < lastStep && (
              <button
                type="button"
                onClick={goNext}
                data-testid="onboarding-next-btn"
                className="px-5 py-2.5 bg-accent-red text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider hover:bg-primary-red shadow-lg shadow-accent-red/20 inline-flex items-center gap-1"
              >
                Continuer <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === lastStep && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                data-testid="onboarding-submit-btn"
                className="px-5 py-2.5 bg-accent-red text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider hover:bg-primary-red shadow-lg shadow-accent-red/20 inline-flex items-center gap-2 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {submitting ? 'Configuration…' : 'Activer mon espace'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ---- helpers ----

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5">
    {children}
  </label>
);

const Grid2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
);

const Field: React.FC<{ icon: any; label: string; children: React.ReactNode }> = ({ icon: Icon, label, children }) => (
  <div className="space-y-1.5">
    <FieldLabel>{label}</FieldLabel>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      {children}
    </div>
  </div>
);

const Recap: React.FC<{
  country: Country; city: string; name: string;
  email: string; phone: string;
  cnssEmployerRate: string; cnssEmployeeRate: string;
  isOhada: boolean;
}> = ({ country, city, name, email, phone, cnssEmployerRate, cnssEmployeeRate, isOhada }) => (
  <div className="rounded-2xl bg-soft-red/40 border border-red-100 p-4 space-y-3">
    <div className="text-[10px] font-bold text-accent-red uppercase tracking-widest flex items-center gap-1.5">
      <Sparkles className="w-3 h-3" /> Récapitulatif
    </div>
    <div className="grid grid-cols-2 gap-3 text-xs">
      <RecapRow label="Pays" value={`${country.flag} ${country.label}`} />
      <RecapRow label="Ville" value={city} />
      <RecapRow label="Société" value={name || '—'} />
      <RecapRow label="Devise" value={country.defaultCurrency} />
      <RecapRow label="Email" value={email || '—'} />
      <RecapRow label="Téléphone" value={phone || '—'} />
      <RecapRow label="Comptabilité" value={country.defaultStandard} />
      {isOhada && <RecapRow label="CNSS" value={`Patronale ${cnssEmployerRate || 0}% / Salariale ${cnssEmployeeRate || 0}%`} />}
    </div>
  </div>
);

const RecapRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</div>
    <div className="font-bold text-slate-900 break-words">{value}</div>
  </div>
);
