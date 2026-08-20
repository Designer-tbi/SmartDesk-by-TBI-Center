/**
 * XAF -> USD conversion, used only to price PayPal transactions.
 *
 * PayPal does not accept XAF as a transaction currency (see
 * server/services/paypal.ts and server/services/companyPaypal.ts), so any
 * amount entered/displayed in XAF must be converted to USD before being
 * sent to PayPal. We fetch a live rate from a free, no-key exchange-rate
 * API and cache it for an hour; if the fetch fails we fall back to a fixed
 * approximation (XAF is pegged to EUR at 655.957, and EUR/USD trades
 * around 1.05-1.10, so ~610 XAF/USD is a reasonable fallback).
 */

const FALLBACK_XAF_PER_USD = 610;
const CACHE_TTL_MS = 60 * 60 * 1000;

let cached: { rate: number; expiresAt: number } | null = null;

export async function getXafPerUsd(): Promise<number> {
  if (cached && cached.expiresAt > Date.now()) return cached.rate;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const json: any = await res.json();
      const rate = json?.rates?.XAF;
      if (typeof rate === 'number' && rate > 0) {
        cached = { rate, expiresAt: Date.now() + CACHE_TTL_MS };
        return rate;
      }
    }
  } catch {
    // Network unavailable — use the fallback below.
  }
  return FALLBACK_XAF_PER_USD;
}

/** Converts an XAF amount to a USD string formatted for PayPal (2 decimals). */
export async function xafToUsdAmount(amountXaf: number): Promise<string> {
  const rate = await getXafPerUsd();
  const usd = amountXaf / rate;
  // PayPal rejects amounts below its minimum for some currencies; clamp to
  // a sane minimum so a tiny XAF test amount still produces a valid order.
  return Math.max(usd, 0.01).toFixed(2);
}
