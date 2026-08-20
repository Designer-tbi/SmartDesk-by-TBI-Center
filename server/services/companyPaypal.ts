/**
 * Per-company PayPal Orders (v2) service.
 *
 * Separate from server/services/paypal.ts, which uses ONE platform-level
 * PayPal app to bill tenant companies for their SmartDesk subscription.
 * This service instead uses EACH COMPANY'S OWN PayPal live credentials
 * (Settings → Paiements) so a company can collect one-off payments from
 * its own customers (e.g. a quote/invoice paid online) directly into its
 * own PayPal account.
 *
 * Company-configured credentials always target the live PayPal API —
 * there is no sandbox toggle here, matching what was actually requested
 * (the company enters its real, live PayPal app credentials).
 */

const BASE = 'https://api-m.paypal.com';

export type CompanyPaypalConfig = {
  paypalClientId?: string | null;
  paypalClientSecret?: string | null;
};

const tokenCache = new Map<string, { value: string; expiresAt: number }>();

function requireConfig(config: CompanyPaypalConfig): asserts config is Required<CompanyPaypalConfig> {
  if (!config.paypalClientId || !config.paypalClientSecret) {
    throw new Error('PayPal non configuré pour cette société.');
  }
}

async function getAccessToken(config: CompanyPaypalConfig): Promise<string> {
  requireConfig(config);
  const cacheKey = config.paypalClientId;
  const existing = tokenCache.get(cacheKey);
  if (existing && existing.expiresAt > Date.now() + 30_000) {
    return existing.value;
  }

  const auth = Buffer.from(`${config.paypalClientId}:${config.paypalClientSecret}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`Authentification PayPal échouée (${res.status}): ${json?.error_description || text}`);
  }
  tokenCache.set(cacheKey, { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 });
  return json.access_token;
}

async function paypalFetch(config: CompanyPaypalConfig, path: string, init: RequestInit = {}) {
  const token = await getAccessToken(config);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`PayPal ${init.method || 'GET'} ${path} a échoué (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

export async function createOrder(
  config: CompanyPaypalConfig,
  opts: { amountUsd: string; description: string; returnUrl: string; cancelUrl: string; referenceId?: string },
) {
  return paypalFetch(config, '/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: opts.referenceId,
        description: opts.description,
        amount: { currency_code: 'USD', value: opts.amountUsd },
      }],
      application_context: {
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: opts.returnUrl,
        cancel_url: opts.cancelUrl,
      },
    }),
  });
}

export async function captureOrder(config: CompanyPaypalConfig, orderId: string) {
  return paypalFetch(config, `/v2/checkout/orders/${orderId}/capture`, { method: 'POST' });
}

export async function getOrder(config: CompanyPaypalConfig, orderId: string) {
  return paypalFetch(config, `/v2/checkout/orders/${orderId}`);
}
