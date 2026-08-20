/**
 * Currency conversion used only to price PayPal transactions.
 *
 * PayPal does not accept every currency this app supports as a company
 * currency — notably XAF, XOF and CDF are rejected (see
 * server/services/paypal.ts and server/services/companyPaypal.ts). We fetch
 * live rates from a free, no-key exchange-rate API and cache them for an
 * hour; if the fetch fails we fall back to fixed approximations (XAF/XOF are
 * pegged to EUR at 655.957, and EUR/USD trades around 1.05-1.10, so ~610
 * XAF or XOF per USD is a reasonable fallback; CDF is far more volatile but
 * ~2800/USD is a reasonable order-of-magnitude fallback).
 */

const FALLBACK_RATES_PER_USD: Record<string, number> = {
  XAF: 610,
  XOF: 610,
  CDF: 2800,
};

const CACHE_TTL_MS = 60 * 60 * 1000;

let cached: { rates: Record<string, number>; expiresAt: number } | null = null;

async function getRatesFromUsd(): Promise<Record<string, number>> {
  if (cached && cached.expiresAt > Date.now()) return cached.rates;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const json: any = await res.json();
      if (json?.rates && typeof json.rates === 'object') {
        cached = { rates: json.rates, expiresAt: Date.now() + CACHE_TTL_MS };
        return json.rates;
      }
    }
  } catch {
    // Network unavailable — use the fallback below.
  }
  return FALLBACK_RATES_PER_USD;
}

/** PayPal doesn't accept XAF, XOF or CDF as a transaction currency — these
 *  must always be converted to USD. USD and EUR are charged directly. */
const PAYPAL_DIRECT_CURRENCIES = new Set(['USD', 'EUR']);

/**
 * Resolves the amount + currency to actually send to PayPal for a given
 * amount priced in a company's local currency. USD/EUR pass through
 * unchanged; anything else (XAF, XOF, CDF…) is converted to USD.
 */
export async function resolvePaypalAmount(
  amount: number,
  currency: string | null | undefined,
): Promise<{ value: string; currencyCode: string }> {
  const cur = String(currency || 'XAF').toUpperCase();
  if (PAYPAL_DIRECT_CURRENCIES.has(cur)) {
    return { value: Math.max(amount, 0.01).toFixed(2), currencyCode: cur };
  }
  const rates = await getRatesFromUsd();
  const rate = rates[cur] || FALLBACK_RATES_PER_USD[cur] || FALLBACK_RATES_PER_USD.XAF;
  const usd = amount / rate;
  // PayPal rejects amounts below its minimum for some currencies; clamp to
  // a sane minimum so a small local-currency amount still produces a valid
  // order.
  return { value: Math.max(usd, 0.01).toFixed(2), currencyCode: 'USD' };
}

/** Convenience wrapper used by the Settings "test payment" flow (always XAF). */
export async function xafToUsdAmount(amountXaf: number): Promise<string> {
  const { value } = await resolvePaypalAmount(amountXaf, 'XAF');
  return value;
}
