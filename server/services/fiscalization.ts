/**
 * SFEC (Système de Facturation Électronique Certifié - DGID Congo)
 * Implémentation conforme au guide d'intégration v1.2.1 (2026-03-04).
 *
 *   POST {baseUrl}/invoices/report/api
 *   Header: X-API-Key: <clé entreprise>
 *
 * On retombe sur une signature locale HMAC-SHA256 si :
 *   - aucune URL n'est configurée (DGID_API_URL),
 *   - l'API renvoie une erreur 5xx ou est injoignable.
 *
 * Les erreurs 4xx (données invalides) sont propagées au client : pas de
 * retry automatique conformément à la doc.
 */

import crypto from 'crypto';

export type FiscalizationInput = {
  invoice: {
    id: string;
    type?: 'Invoice' | 'Quote';
    date?: string | null;
    dueDate?: string | null;
    totalHT?: number | null;
    tvaTotal?: number | null;
    total?: number | null;
    discount?: number | null;
    deposit?: number | null;
    contactId?: string | null;
    notes?: string | null;
    items?: Array<{
      description?: string;
      name?: string;
      quantity?: number;
      price?: number;
      tvaRate?: number | string;
      tvaAmount?: number;
    }>;
  };
  company: {
    id: string;
    name?: string | null;
    niu?: string | null;
    taxId?: string | null;
    currency?: string | null;
    fiscalizationApiKey?: string | null;
  };
  buyer: {
    name?: string | null;
    niu?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    contactType?: string | null; // 'particulier' | 'professionnel'
  };
};

export type FiscalizationResult = {
  status: 'certified' | 'failed';
  certificationNumber: string;
  certifiedAt: string; // ISO
  source: 'sfec' | 'local';
  qrPayload: string;       // text encoded into the QR (used by local fallback)
  qrImage?: string;        // data:image/png;base64,... when SFEC returns one
  signature?: string;
  shortSignature?: string;
  raw?: any;
};

export type FiscalizationError = Error & {
  httpStatus: number;
  errorCode?: string;
  field?: string;
};

const SFEC_TAX_RATES = new Set(['0', '5', '18']);

/** Build the payload according to SFEC v1.2.1 specification. */
function buildSfecPayload(input: FiscalizationInput) {
  const { invoice, company, buyer } = input;

  const recipientType =
    buyer.contactType === 'professionnel' ? 'business' :
    buyer.contactType === 'gouvernement' ? 'government' :
    buyer.contactType === 'etranger' ? 'foreign' :
    'individual';

  const items = (invoice.items || []).map((it) => {
    const quantity = Number(it.quantity || 0);
    const unitPrice = Number(it.price || 0);
    const subtotal = +(quantity * unitPrice).toFixed(2);
    const taxRate = String(it.tvaRate ?? 18);
    const safeRate = SFEC_TAX_RATES.has(taxRate) ? taxRate : '18';
    const taxAmount = +(subtotal * (Number(safeRate) / 100)).toFixed(2);
    return {
      type: 'service',
      designation: it.name || it.description || 'Article',
      unit_price: unitPrice,
      quantity,
      subtotal,
      discount_amount: 0,
      discount_type: 'fixed' as const,
      net_amount: subtotal,
      tax_rate: safeRate,
      tax_amount: taxAmount,
      total_amount: +(subtotal + taxAmount).toFixed(2),
    };
  });

  const itemsSubtotal = items.reduce((s, it) => s + it.subtotal, 0);
  const totalTax = items.reduce((s, it) => s + it.tax_amount, 0);
  const totalAmount = +(itemsSubtotal + totalTax).toFixed(2);

  return {
    invoice_id: invoice.id,
    recipient_type: recipientType,
    is_recipient_taxable: recipientType === 'business' || recipientType === 'government',
    recipient_name: buyer.name || 'Client comptoir',
    // SFEC requires NIU + email + address + phone for non-individual
    // recipients. Pass through whatever we have; SFEC will 422 if missing.
    ...(recipientType !== 'individual' && {
      recipient_niu: buyer.niu || '',
      recipient_email: buyer.email || '',
      recipient_address: buyer.address || '',
      recipient_phone: buyer.phone || '',
    }),
    invoice_type: 'salesInvoice',
    invoice_subject: invoice.notes || `Facture ${invoice.id}`,
    currency: (company.currency || 'XAF').toUpperCase(),
    payment_method: 'bank_transfer',
    items,
    subtotal: itemsSubtotal,
    total_line_discount_amount: 0,
    discount_amount: Number(invoice.discount || 0),
    total_tax_t_amount: totalTax,
    total_tax_r_amount: 0,
    total_exempt_amount: 0,
    total_tax_amount: totalTax,
    additional_cent_tax: 0,
    electronic_stamp_duty: 0,
    total_amount: totalAmount,
    amount_due: +(totalAmount - Number(invoice.deposit || 0)).toFixed(2),
  };
}

function localSign(input: FiscalizationInput, iso: string) {
  const key = input.company.fiscalizationApiKey || '';
  const body = JSON.stringify(buildSfecPayload(input)) + '|' + iso;
  const hmac = crypto.createHmac('sha256', key).update(body).digest('hex');
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    String(d.getUTCFullYear()).slice(-2) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    '-' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes());
  return `SFEC-${stamp}-${hmac.slice(0, 10).toUpperCase()}`;
}

const SFEC_BASE_URL =
  process.env.DGID_API_URL || 'https://sandbox-pgsfec.akieni.tech/api';

export async function certifyInvoice(
  input: FiscalizationInput,
): Promise<FiscalizationResult> {
  const now = new Date().toISOString();
  const apiKey = input.company.fiscalizationApiKey;

  if (apiKey) {
    const endpoint = `${SFEC_BASE_URL.replace(/\/$/, '')}/invoices/report/api`;
    const payload = buildSfecPayload(input);
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const data = await r.json().catch(() => null);

      // SFEC sandbox returns HTTP 201 with `certification_number` (no
      // `sfec_` prefix). Accept both spellings to be future-proof.
      const certNumber: string | undefined =
        data?.sfec_certification_number ||
        data?.certification_number ||
        data?.identifier;

      if ((r.status === 200 || r.status === 201) && certNumber) {
        return {
          status: 'certified',
          certificationNumber: certNumber,
          certifiedAt: data.certification_date || now,
          source: 'sfec',
          qrPayload: certNumber,
          qrImage: data.qr_code,
          signature: data.certification_signature || data.signature,
          shortSignature: data.certification_short_signature || data.short_signature,
          raw: data,
        };
      }

      // 4xx → propagate (data error, no retry)
      if (r.status >= 400 && r.status < 500) {
        const err = new Error(
          (data?.error?.message as string) ||
            `SFEC certification failed (HTTP ${r.status})`,
        ) as FiscalizationError;
        err.httpStatus = r.status;
        err.errorCode = data?.error?.code;
        err.field = data?.error?.field;
        throw err;
      }

      // 5xx → fall through to local fallback
      console.log('[fiscalization] SFEC HTTP', r.status, data);
    } catch (err: any) {
      if ((err as FiscalizationError).httpStatus) {
        // Already a structured 4xx → propagate.
        throw err;
      }
      console.log(
        '[fiscalization] SFEC network/5xx error, falling back to local signature:',
        err?.message,
      );
    }
  }

  // Local fallback — clearly tagged so auditors can distinguish.
  const certificationNumber = localSign(input, now);
  const qrPayload = JSON.stringify({
    n: certificationNumber,
    inv: input.invoice.id,
    seller: input.company.niu,
    amount: input.invoice.total,
    ts: now,
  });
  return {
    status: 'certified',
    certificationNumber,
    certifiedAt: now,
    source: 'local',
    qrPayload,
  };
}
