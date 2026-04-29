/**
 * Regional / locale adaptations for the CRM.
 *
 * Based on the company country (stored on users.country or companies.country)
 * and language preference, we adjust :
 *   - the tax-ID label (NIU, NIF, SIRET, VAT, EIN, …)
 *   - the address field layout hints
 *   - the phone placeholder
 *
 * Works purely client-side — no extra API calls needed.
 */

export type Locale = {
  /** ISO-2 country code */
  country: string;
  /** Continent key used for coarse grouping */
  continent: 'AF' | 'EU' | 'NA' | 'SA' | 'AS' | 'OC' | 'XX';
  /** Primary label for the tax ID on forms */
  taxIdLabel: string;
  /** Placeholder illustrating the local tax ID format */
  taxIdPlaceholder: string;
  /** Expected phone format placeholder (E.164-style) */
  phonePlaceholder: string;
  /** Whether this country is in OHADA zone (Congo, CIV, CMR, GAB…) */
  isOhada: boolean;
  /** Whether this country uses the CEMAC NIU system */
  isCemac: boolean;
};

const COUNTRY_TABLE: Record<string, Partial<Locale>> = {
  // --- Coarse region keys used by the Settings UI ---
  EUROPE: { continent: 'EU', taxIdLabel: 'TVA', taxIdPlaceholder: 'FR00 000000000', phonePlaceholder: '+33 6 XX XX XX XX', isOhada: false, isCemac: false },
  AFRIQUE: { continent: 'AF', taxIdLabel: 'NIF', taxIdPlaceholder: 'P2012345678', phonePlaceholder: '+2XX XX XX XX XX', isOhada: true, isCemac: false },
  USA: { continent: 'NA', taxIdLabel: 'EIN / SSN', taxIdPlaceholder: '00-0000000', phonePlaceholder: '+1 (XXX) XXX-XXXX', isOhada: false, isCemac: false },
  CONTINENT: { continent: 'XX', taxIdLabel: 'ID fiscal', taxIdPlaceholder: '123456789', phonePlaceholder: '+XXX XX XX XX XX', isOhada: false, isCemac: false },
  // France (used as the "Europe / FR" specific bucket in the onboarding wizard).
  FRANCE: { continent: 'EU', taxIdLabel: 'TVA', taxIdPlaceholder: 'FR00 000000000', phonePlaceholder: '+33 6 XX XX XX XX', isOhada: false, isCemac: false },
  FR: { continent: 'EU', taxIdLabel: 'TVA', taxIdPlaceholder: 'FR00 000000000', phonePlaceholder: '+33 6 XX XX XX XX', isOhada: false, isCemac: false },
  // RDC — République Démocratique du Congo (Kinshasa). OHADA member but uses CDF.
  CD: { continent: 'AF', taxIdLabel: 'ID NAT', taxIdPlaceholder: '01-A1-N12345B', phonePlaceholder: '+243 XX XXX XXXX', isOhada: true, isCemac: false },
  RDC: { continent: 'AF', taxIdLabel: 'ID NAT', taxIdPlaceholder: '01-A1-N12345B', phonePlaceholder: '+243 XX XXX XXXX', isOhada: true, isCemac: false },
  // --- CEMAC / Congo zone (OHADA + NIU) ---
  CG: { continent: 'AF', taxIdLabel: 'NIU', taxIdPlaceholder: 'P2012345678', phonePlaceholder: '+242 06 XX XX XXX', isOhada: true, isCemac: true },
  CONGO: { continent: 'AF', taxIdLabel: 'NIU', taxIdPlaceholder: 'P2012345678', phonePlaceholder: '+242 06 XX XX XXX', isOhada: true, isCemac: true },
  CM: { continent: 'AF', taxIdLabel: 'NIU', taxIdPlaceholder: 'M0123456789', phonePlaceholder: '+237 6XX XX XX XX', isOhada: true, isCemac: true },
  GA: { continent: 'AF', taxIdLabel: 'NIF', taxIdPlaceholder: '0123456789', phonePlaceholder: '+241 0X XX XX XX', isOhada: true, isCemac: true },
  CF: { continent: 'AF', taxIdLabel: 'NIF', taxIdPlaceholder: '0123456789', phonePlaceholder: '+236 XX XX XX XX', isOhada: true, isCemac: true },
  TD: { continent: 'AF', taxIdLabel: 'NIF', taxIdPlaceholder: '0123456789', phonePlaceholder: '+235 XX XX XX XX', isOhada: true, isCemac: true },
  GQ: { continent: 'AF', taxIdLabel: 'NIF', taxIdPlaceholder: '0123456789', phonePlaceholder: '+240 XX XXX XX XX', isOhada: true, isCemac: true },
  // --- West Africa (UEMOA, OHADA, NIF) ---
  CI: { continent: 'AF', taxIdLabel: 'CC (N° compte contribuable)', taxIdPlaceholder: '01234567X', phonePlaceholder: '+225 XX XX XX XX XX', isOhada: true, isCemac: false },
  SN: { continent: 'AF', taxIdLabel: 'NINEA', taxIdPlaceholder: '0012345678G', phonePlaceholder: '+221 XX XXX XX XX', isOhada: true, isCemac: false },
  BF: { continent: 'AF', taxIdLabel: 'IFU', taxIdPlaceholder: '00000000X', phonePlaceholder: '+226 XX XX XX XX', isOhada: true, isCemac: false },
  ML: { continent: 'AF', taxIdLabel: 'NIF', taxIdPlaceholder: '012345678X', phonePlaceholder: '+223 XX XX XX XX', isOhada: true, isCemac: false },
  BJ: { continent: 'AF', taxIdLabel: 'IFU', taxIdPlaceholder: '00000000X', phonePlaceholder: '+229 XX XX XX XX', isOhada: true, isCemac: false },
  TG: { continent: 'AF', taxIdLabel: 'NIF', taxIdPlaceholder: '012345678', phonePlaceholder: '+228 XX XX XX XX', isOhada: true, isCemac: false },
  // --- North Africa ---
  MA: { continent: 'AF', taxIdLabel: 'ICE', taxIdPlaceholder: '000000000000000', phonePlaceholder: '+212 6XX XXX XXX', isOhada: false, isCemac: false },
  DZ: { continent: 'AF', taxIdLabel: 'NIF', taxIdPlaceholder: '000000000000000', phonePlaceholder: '+213 X XX XX XX XX', isOhada: false, isCemac: false },
  TN: { continent: 'AF', taxIdLabel: 'Matricule fiscal', taxIdPlaceholder: '1234567/A/B/000', phonePlaceholder: '+216 XX XXX XXX', isOhada: false, isCemac: false },
  // --- Europe (VAT) ---
  FR: { continent: 'EU', taxIdLabel: 'SIRET / TVA', taxIdPlaceholder: 'FR00 000000000', phonePlaceholder: '+33 6 XX XX XX XX', isOhada: false, isCemac: false },
  BE: { continent: 'EU', taxIdLabel: 'TVA', taxIdPlaceholder: 'BE 0000.000.000', phonePlaceholder: '+32 4XX XX XX XX', isOhada: false, isCemac: false },
  DE: { continent: 'EU', taxIdLabel: 'USt-IdNr', taxIdPlaceholder: 'DE000000000', phonePlaceholder: '+49 1XX XXXXXXXX', isOhada: false, isCemac: false },
  ES: { continent: 'EU', taxIdLabel: 'NIF / CIF', taxIdPlaceholder: 'A00000000', phonePlaceholder: '+34 6XX XXX XXX', isOhada: false, isCemac: false },
  IT: { continent: 'EU', taxIdLabel: 'Partita IVA', taxIdPlaceholder: 'IT00000000000', phonePlaceholder: '+39 3XX XXX XXXX', isOhada: false, isCemac: false },
  UK: { continent: 'EU', taxIdLabel: 'VAT Number', taxIdPlaceholder: 'GB 000 0000 00', phonePlaceholder: '+44 7XXX XXXXXX', isOhada: false, isCemac: false },
  GB: { continent: 'EU', taxIdLabel: 'VAT Number', taxIdPlaceholder: 'GB 000 0000 00', phonePlaceholder: '+44 7XXX XXXXXX', isOhada: false, isCemac: false },
  // --- North America ---
  US: { continent: 'NA', taxIdLabel: 'EIN / SSN', taxIdPlaceholder: '00-0000000', phonePlaceholder: '+1 (XXX) XXX-XXXX', isOhada: false, isCemac: false },
  CA: { continent: 'NA', taxIdLabel: 'Business Number', taxIdPlaceholder: '000000000 RT0001', phonePlaceholder: '+1 (XXX) XXX-XXXX', isOhada: false, isCemac: false },
};

const DEFAULT_LOCALE: Locale = {
  country: 'XX',
  continent: 'XX',
  taxIdLabel: 'ID fiscal',
  taxIdPlaceholder: '123456789',
  phonePlaceholder: '+XXX XX XX XX XX',
  isOhada: false,
  isCemac: false,
};

export function resolveLocale(country?: string | null): Locale {
  if (!country) return DEFAULT_LOCALE;
  const key = country.toUpperCase();
  const entry = COUNTRY_TABLE[key];
  if (!entry) return { ...DEFAULT_LOCALE, country: key };
  return { ...DEFAULT_LOCALE, ...entry, country: key };
}

export function formatAddressHint(locale: Locale, language: string): string {
  if (locale.continent === 'EU') {
    return language === 'en'
      ? 'Street, postal code, city'
      : 'Rue, code postal, ville';
  }
  if (locale.continent === 'NA') {
    return 'Street, city, state, ZIP';
  }
  if (locale.isOhada) {
    return language === 'en'
      ? 'Avenue, district, arrondissement, city'
      : 'Avenue, quartier, arrondissement, ville';
  }
  return language === 'en' ? 'Full postal address' : 'Adresse postale complète';
}
