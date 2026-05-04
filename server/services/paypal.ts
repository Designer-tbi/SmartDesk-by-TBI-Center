/**
 * PayPal Subscriptions service.
 *
 * Wraps the live PayPal REST API for the SaaS subscription flow:
 *   - OAuth client_credentials (token cached in memory until expiry).
 *   - Product + 2 monthly billing plans bootstrapped on demand
 *     (idempotent — PayPal objects live forever once created, so we
 *     persist their ids in the `app_config` table).
 *   - Create / fetch / cancel subscription on behalf of a tenant.
 *
 * XAF caveat: PayPal only supports 25 currencies (USD, EUR, GBP…).
 * XAF is NOT accepted, so Republic of Congo (CG) companies are
 * billed in USD at a fixed ~45 000 XAF ≈ 75 USD equivalent; the UI
 * explicitly discloses this to the customer.
 */

import type { Pool, PoolClient } from 'pg';

const MODE = process.env.PAYPAL_MODE || 'live';
const BASE = MODE === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';

/* ------------------------------------------------------------------ */
/* Pricing map                                                         */
/* ------------------------------------------------------------------ */

/**
 * CG and CD are the two countries the user explicitly priced.
 * Everything else falls back to WORLD (40 USD).
 *
 * `displayLocal` is the string we show the customer so they know
 * what they are actually paying in their home currency even though
 * PayPal charges in USD.
 */
export interface PlanSpec {
  id: 'CG_XAF' | 'WORLD';
  country: 'CG' | 'DEFAULT';
  amountUSD: string;   // what PayPal actually bills
  displayLocal: string; // what we display to the customer
  description: string;
}

export const PLAN_SPECS: PlanSpec[] = [
  {
    id: 'CG_XAF',
    country: 'CG',
    amountUSD: '75.00',
    displayLocal: '45 000 XAF',
    description: 'Abonnement mensuel SmartDesk — République du Congo',
  },
  {
    id: 'WORLD',
    country: 'DEFAULT',
    amountUSD: '40.00',
    displayLocal: '$40 USD',
    description: 'Abonnement mensuel SmartDesk — International',
  },
];

export const resolvePlanForCountry = (country?: string | null): PlanSpec => {
  const c = String(country || '').toUpperCase();
  return PLAN_SPECS.find((p) => p.country === c) || PLAN_SPECS[1];
};

/* ------------------------------------------------------------------ */
/* Token cache                                                         */
/* ------------------------------------------------------------------ */

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayPal auth failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in * 1000),
  };
  return json.access_token;
}

const paypalFetch = async (path: string, init: RequestInit = {}) => {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `smartdesk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`PayPal ${init.method || 'GET'} ${path} failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
};

/* ------------------------------------------------------------------ */
/* Products / Plans bootstrap (idempotent)                             */
/* ------------------------------------------------------------------ */

type AppConfigRow = { key: string; value: string };

const configGet = async (db: { query: Pool['query'] | PoolClient['query'] }, key: string) => {
  const r = await db.query('SELECT value FROM app_config WHERE key = $1', [key]);
  return (r.rows[0] as AppConfigRow | undefined)?.value || null;
};

const configSet = async (db: any, key: string, value: string) => {
  await db.query(
    `INSERT INTO app_config (key, value, "updatedAt")
       VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`,
    [key, value],
  );
};

export async function ensureProductAndPlans(db: any): Promise<Record<string, string>> {
  // Product
  let productId = await configGet(db, 'paypal_product_id');
  if (!productId) {
    const product = await paypalFetch('/v1/catalogs/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'SmartDesk ERP',
        description: 'Plateforme ERP/CRM multi-tenant',
        type: 'SERVICE',
        category: 'SOFTWARE',
      }),
    });
    productId = product.id;
    await configSet(db, 'paypal_product_id', productId!);
  }

  // Plans
  const plans: Record<string, string> = {};
  for (const spec of PLAN_SPECS) {
    const cfgKey = `paypal_plan_${spec.id}`;
    let planId = await configGet(db, cfgKey);
    if (!planId) {
      const plan = await paypalFetch('/v1/billing/plans', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productId,
          name: spec.description,
          description: spec.description,
          status: 'ACTIVE',
          billing_cycles: [{
            frequency: { interval_unit: 'MONTH', interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0, // infinite
            pricing_scheme: {
              fixed_price: { value: spec.amountUSD, currency_code: 'USD' },
            },
          }],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee: { value: '0', currency_code: 'USD' },
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 2,
          },
        }),
      });
      planId = plan.id;
      await configSet(db, cfgKey, planId!);
    }
    plans[spec.id] = planId!;
  }
  return plans;
}

/* ------------------------------------------------------------------ */
/* Subscription lifecycle                                              */
/* ------------------------------------------------------------------ */

export async function createSubscription(
  planId: string,
  customData: { companyId: string; userEmail: string },
  returnUrl: string,
  cancelUrl: string,
) {
  return paypalFetch('/v1/billing/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: planId,
      custom_id: customData.companyId,
      subscriber: { email_address: customData.userEmail },
      application_context: {
        brand_name: 'SmartDesk ERP',
        locale: 'fr-FR',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });
}

export async function getSubscription(id: string) {
  return paypalFetch(`/v1/billing/subscriptions/${id}`);
}

export async function cancelSubscription(id: string, reason = 'User requested') {
  await paypalFetch(`/v1/billing/subscriptions/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/* ------------------------------------------------------------------ */
/* Webhook verification                                                */
/* ------------------------------------------------------------------ */

/** Verifies the authenticity of an incoming PayPal webhook payload. */
export async function verifyWebhookSignature(
  headers: Record<string, string | string[] | undefined>,
  webhookId: string,
  body: any,
): Promise<boolean> {
  try {
    const result = await paypalFetch('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: body,
      }),
    });
    return result.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('PayPal webhook verify failed:', err);
    return false;
  }
}
