/**
 * IP → country helpers.
 *
 * `fetchDetectedCountry` asks the backend which country the visitor is
 * coming from (edge headers → ipapi.co fallback → 'FR' default).
 *
 * `mapIsoToRegion` normalises an ISO-2 country code into one of the coarse
 * region buckets used by the Settings dropdown
 * (AFRIQUE / CONGO / EUROPE / USA / CONTINENT).
 */

const AFRICA_ISO = new Set([
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CV', 'CF', 'TD',
  'KM', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM',
  'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML',
  'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN',
  'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG',
  'EH', 'ZM', 'ZW', 'CD',
]);

const EUROPE_ISO = new Set([
  'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ',
  'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT',
  'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK',
  'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES',
  'SE', 'CH', 'UA', 'GB', 'UK', 'VA',
]);

export async function fetchDetectedCountry(): Promise<string> {
  try {
    const res = await fetch('/api/auth/geolocate', { credentials: 'include' });
    if (!res.ok) return 'FR';
    const data = await res.json();
    return (data?.country || 'FR').toUpperCase();
  } catch {
    return 'FR';
  }
}

/**
 * Map an ISO-2 country code to one of the Settings-level region keys.
 * Congo (CG) gets its own bucket because the app has dedicated CEMAC/NIU
 * handling there.
 */
export function mapIsoToRegion(iso: string | null | undefined): 'CONGO' | 'AFRIQUE' | 'EUROPE' | 'USA' | 'CONTINENT' {
  const code = (iso || '').toUpperCase();
  if (!code) return 'CONTINENT';
  if (code === 'CG') return 'CONGO';
  if (code === 'US') return 'USA';
  if (AFRICA_ISO.has(code)) return 'AFRIQUE';
  if (EUROPE_ISO.has(code)) return 'EUROPE';
  return 'CONTINENT';
}
