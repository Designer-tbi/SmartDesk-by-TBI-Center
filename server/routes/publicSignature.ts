import { Router } from 'express';
import crypto from 'crypto';
import { autoCreateFirstPayslip } from '../services/automations.js';
import { broadcast, logActivity } from '../activity.js';
import { createOrder, captureOrder } from '../services/companyPaypal.js';
import { resolvePaypalAmount } from '../services/exchangeRate.js';

/**
 * Public router for quote/contract signing flows.
 *
 * NO login is required — these endpoints are reached by clients via the
 * link emailed to them. The dbMiddleware tags `/api/public/*` paths with
 * `isSuperAdmin=true` so the queries below can read across tenants, which
 * means the document id alone (e.g. DEV-2026-347) is NOT a sufficient
 * secret — it's a short, guessable string. Every request here must also
 * present the unguessable `signingToken` minted when the link was sent
 * (see invoices.ts / employees.ts `send-email`), compared in constant time.
 */
export const publicSignatureRouter = Router();

function timingSafeTokenMatch(expected: string | null | undefined, provided: unknown): boolean {
  if (!expected || typeof provided !== 'string' || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

publicSignatureRouter.get('/quotes/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const invRes = await req.db.query(
      `SELECT id, type, "contactId", "companyId", date, "dueDate",
              "totalHT", "tvaTotal", total, status, notes, "signedAt", "signingToken",
              remise, "remiseType", rabais, "rabaisType",
              ristourne, "ristourneType", escompte, "escompteType",
              "centimesAdditionnels", "netCommercial", "netFinancier"
         FROM invoices
        WHERE id = $1 AND type = 'Quote'`,
      [id],
    );
    const invoice = invRes.rows[0];
    if (!invoice) return res.status(404).json({ error: 'Devis introuvable' });
    if (!timingSafeTokenMatch(invoice.signingToken, req.query.t)) {
      return res.status(404).json({ error: 'Devis introuvable' });
    }
    delete invoice.signingToken;

    const itemsRes = await req.db.query(
      `SELECT name, description, quantity, price, "tvaRate", "tvaAmount"
         FROM invoice_items
        WHERE "invoiceId" = $1`,
      [id],
    );

    const compRes = await req.db.query(
      `SELECT name, address, email, phone, niu, currency, logo
         FROM companies WHERE id = $1`,
      [invoice.companyId],
    );
    const company = compRes.rows[0] || {};

    let contact: any = null;
    if (invoice.contactId) {
      const cRes = await req.db.query(
        `SELECT name, email, address FROM contacts WHERE id = $1`,
        [invoice.contactId],
      );
      contact = cRes.rows[0] || null;
    }

    res.json({
      invoice: { ...invoice, items: itemsRes.rows },
      company,
      contact,
      alreadySigned: !!invoice.signedAt,
    });
  } catch (error) {
    next(error);
  }
});

publicSignatureRouter.post('/quotes/:id/sign', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { signerName, signatureDataUrl, t } = req.body || {};
    if (!signerName || String(signerName).trim().length < 2) {
      return res.status(400).json({ error: 'Nom du signataire requis.' });
    }
    if (!signatureDataUrl || !String(signatureDataUrl).startsWith('data:image/')) {
      return res.status(400).json({ error: 'Signature manuscrite requise.' });
    }

    const exists = await req.db.query(
      `SELECT id, status, "signedAt", "companyId", "signingToken" FROM invoices WHERE id = $1 AND type = 'Quote'`,
      [id],
    );
    const inv = exists.rows[0];
    if (!inv) return res.status(404).json({ error: 'Devis introuvable' });
    if (!timingSafeTokenMatch(inv.signingToken, t ?? req.query.t)) {
      return res.status(404).json({ error: 'Devis introuvable' });
    }
    if (inv.signedAt) {
      return res.status(409).json({ error: 'Ce devis est déjà signé.' });
    }

    const signedAt = new Date().toISOString();
    // Reuse the `signatureLink` column to store the signature artefact
    // (signer name + drawn image) — avoids a schema change for the demo.
    await req.db.query(
      `UPDATE invoices SET status = 'Signed', "signedAt" = $1,
              "signatureLink" = $2
         WHERE id = $3 AND type = 'Quote'`,
      [signedAt, JSON.stringify({ signerName, signatureDataUrl }), id],
    );

    // We no longer auto-convert the signed quote into an invoice — the
    // user must explicitly mark the quote as Paid (POST /api/invoices/
    // :id/mark-quote-paid) before conversion happens. This keeps the
    // workflow auditable and lets the SmartDesk operator validate the
    // payment before billing.
    res.json({ ok: true, signedAt });
  } catch (error) {
    next(error);
  }
});

/* ---------- Online PayPal payment (quotes + invoices) ---------- */

/**
 * Public view of a quote or invoice for the "Payer en ligne" flow
 * (reached via /pay/:id in the frontend). Works for either document
 * type, unlike /quotes/:id above which is signature-flow specific.
 */
publicSignatureRouter.get('/invoices/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const invRes = await req.db.query(
      `SELECT id, type, "contactId", "companyId", date, "dueDate",
              "totalHT", "tvaTotal", total, status, "signingToken",
              "paypalPaymentStatus"
         FROM invoices WHERE id = $1`,
      [id],
    );
    const invoice = invRes.rows[0];
    if (!invoice) return res.status(404).json({ error: 'Document introuvable' });
    if (!timingSafeTokenMatch(invoice.signingToken, req.query.t)) {
      return res.status(404).json({ error: 'Document introuvable' });
    }
    delete invoice.signingToken;

    const itemsRes = await req.db.query(
      `SELECT name, description, quantity, price FROM invoice_items WHERE "invoiceId" = $1`,
      [id],
    );

    const compRes = await req.db.query(
      `SELECT name, address, email, phone, niu, currency, logo, "paypalClientId", "paypalClientSecret"
         FROM companies WHERE id = $1`,
      [invoice.companyId],
    );
    const companyRow = compRes.rows[0] || {};
    const hasPaypalConfig = !!(companyRow.paypalClientId && companyRow.paypalClientSecret);

    let contact: any = null;
    if (invoice.contactId) {
      const cRes = await req.db.query(`SELECT name, email, address FROM contacts WHERE id = $1`, [invoice.contactId]);
      contact = cRes.rows[0] || null;
    }

    res.json({
      invoice: { ...invoice, items: itemsRes.rows },
      company: {
        name: companyRow.name, address: companyRow.address, email: companyRow.email,
        phone: companyRow.phone, niu: companyRow.niu, currency: companyRow.currency,
        logo: companyRow.logo, hasPaypalConfig,
      },
      contact,
      alreadyPaid: invoice.paypalPaymentStatus === 'paid' || invoice.status === 'Paid',
    });
  } catch (error) {
    next(error);
  }
});

/** Creates a real PayPal order for the document's total (converted to
 *  USD when the company's currency isn't accepted by PayPal). */
publicSignatureRouter.post('/invoices/:id/paypal/create', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { t } = req.body || {};

    const invRes = await req.db.query(
      `SELECT id, "companyId", total, status, "signingToken", "paypalPaymentStatus" FROM invoices WHERE id = $1`,
      [id],
    );
    const invoice = invRes.rows[0];
    if (!invoice) return res.status(404).json({ error: 'Document introuvable' });
    if (!timingSafeTokenMatch(invoice.signingToken, t ?? req.query.t)) {
      return res.status(404).json({ error: 'Document introuvable' });
    }
    if (invoice.status === 'Paid' || invoice.paypalPaymentStatus === 'paid') {
      return res.status(409).json({ error: 'Ce document est déjà payé.' });
    }

    const compRes = await req.db.query(
      `SELECT name, currency, "paypalClientId", "paypalClientSecret" FROM companies WHERE id = $1`,
      [invoice.companyId],
    );
    const company = compRes.rows[0];
    if (!company?.paypalClientId || !company?.paypalClientSecret) {
      return res.status(400).json({ error: "Le paiement en ligne n'est pas disponible pour cette société." });
    }

    const { value, currencyCode } = await resolvePaypalAmount(Number(invoice.total || 0), company.currency);

    const base =
      process.env.PUBLIC_BASE_URL ||
      process.env.REACT_APP_BACKEND_URL ||
      `${req.protocol}://${req.get('host')}`;
    const order = await createOrder(
      { paypalClientId: company.paypalClientId, paypalClientSecret: company.paypalClientSecret },
      {
        amountUsd: value,
        currencyCode,
        description: `${company.name} — Paiement ${id}`,
        returnUrl: `${base}/pay/${id}?t=${encodeURIComponent(invoice.signingToken)}&paypalReturn=1`,
        cancelUrl: `${base}/pay/${id}?t=${encodeURIComponent(invoice.signingToken)}&paypalCancel=1`,
        referenceId: id,
      },
    );

    await req.db.query(
      `UPDATE invoices SET "paypalOrderId" = $1, "paypalPaymentStatus" = 'pending' WHERE id = $2`,
      [order.id, id],
    );

    const approveUrl = (order.links || []).find((l: any) => l.rel === 'approve')?.href || null;
    res.json({ orderId: order.id, approveUrl, amount: value, currency: currencyCode });
  } catch (error) {
    next(error);
  }
});

/** Captures the order once the customer approved it on PayPal's site. */
publicSignatureRouter.post('/invoices/:id/paypal/capture', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { t, orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId manquant.' });

    const invRes = await req.db.query(
      `SELECT id, "companyId", type, status, "signingToken", "paypalOrderId" FROM invoices WHERE id = $1`,
      [id],
    );
    const invoice = invRes.rows[0];
    if (!invoice) return res.status(404).json({ error: 'Document introuvable' });
    if (!timingSafeTokenMatch(invoice.signingToken, t ?? req.query.t)) {
      return res.status(404).json({ error: 'Document introuvable' });
    }
    if (invoice.paypalOrderId !== orderId) {
      return res.status(400).json({ error: 'Commande PayPal invalide pour ce document.' });
    }

    const compRes = await req.db.query(
      `SELECT "paypalClientId", "paypalClientSecret" FROM companies WHERE id = $1`,
      [invoice.companyId],
    );
    const company = compRes.rows[0];
    if (!company?.paypalClientId || !company?.paypalClientSecret) {
      return res.status(400).json({ error: "Le paiement en ligne n'est pas disponible pour cette société." });
    }

    const capture = await captureOrder(
      { paypalClientId: company.paypalClientId, paypalClientSecret: company.paypalClientSecret },
      orderId,
    );
    if (capture.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Le paiement PayPal n\'a pas été finalisé.', status: capture.status });
    }

    // For a real invoice, a completed PayPal payment settles it outright.
    // For a quote, we only record the payment here — converting it into a
    // Paid invoice (with journal entry + SFEC certification) stays a
    // deliberate action the operator takes from the Sales UI
    // (POST /api/invoices/:id/mark-quote-paid), not something an
    // unauthenticated customer payment silently triggers.
    const isInvoice = invoice.type === 'Invoice';
    await req.db.query(
      `UPDATE invoices SET "paypalPaymentStatus" = 'paid', "paypalPaidAt" = NOW()
         ${isInvoice ? `, status = 'Paid', "paidAt" = NOW()` : ''}
       WHERE id = $1`,
      [id],
    );

    const capturedAmount = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
    res.json({ ok: true, status: capture.status, amount: capturedAmount || null });
  } catch (error) {
    next(error);
  }
});

/* ---------- HR Contracts ---------- */

publicSignatureRouter.get('/contracts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const cRes = await req.db.query(
      `SELECT id, type, "employeeId", "companyId", "startDate", "endDate",
              salary, status, content, "signedAt", "signingToken"
         FROM contracts WHERE id = $1`,
      [id],
    );
    const contract = cRes.rows[0];
    if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });
    if (!timingSafeTokenMatch(contract.signingToken, req.query.t)) {
      return res.status(404).json({ error: 'Contrat introuvable' });
    }
    delete contract.signingToken;

    const compRes = await req.db.query(
      `SELECT name, address, email, phone, niu, currency, logo
         FROM companies WHERE id = $1`,
      [contract.companyId],
    );
    const company = compRes.rows[0] || {};

    let employee: any = null;
    if (contract.employeeId) {
      const eRes = await req.db.query(
        `SELECT name, email, role, department FROM employees WHERE id = $1`,
        [contract.employeeId],
      );
      const row = eRes.rows[0];
      // Normalise to a `position` field for the frontend (the public page
      // expects `employee.position`).
      employee = row
        ? { name: row.name, email: row.email, position: row.role || row.department || '' }
        : null;
    }

    res.json({
      kind: 'contract',
      contract,
      company,
      employee,
      alreadySigned: !!contract.signedAt,
    });
  } catch (error) {
    next(error);
  }
});

publicSignatureRouter.post('/contracts/:id/sign', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { signerName, signatureDataUrl, t } = req.body || {};
    if (!signerName || String(signerName).trim().length < 2) {
      return res.status(400).json({ error: 'Nom du signataire requis.' });
    }
    if (!signatureDataUrl || !String(signatureDataUrl).startsWith('data:image/')) {
      return res.status(400).json({ error: 'Signature manuscrite requise.' });
    }

    const exists = await req.db.query(
      `SELECT id, status, "signedAt", "companyId", "signingToken" FROM contracts WHERE id = $1`,
      [id],
    );
    const c = exists.rows[0];
    if (!c) return res.status(404).json({ error: 'Contrat introuvable' });
    if (!timingSafeTokenMatch(c.signingToken, t ?? req.query.t)) {
      return res.status(404).json({ error: 'Contrat introuvable' });
    }
    if (c.signedAt) return res.status(409).json({ error: 'Ce contrat est déjà signé.' });

    const signedAt = new Date().toISOString();
    await req.db.query(
      `UPDATE contracts SET status = 'Signed', "signedAt" = $1,
              "signatureLink" = $2
         WHERE id = $3`,
      [signedAt, JSON.stringify({ signerName, signatureDataUrl }), id],
    );

    // Automation: seed the current-month payslip as Draft so the HR
    // admin simply has to review & mark it Paid when they process
    // the next payroll cycle.
    let autoPayslipId: string | null = null;
    try {
      autoPayslipId = await autoCreateFirstPayslip(req.db, id, c.companyId);
      if (autoPayslipId) {
        broadcast({
          type: 'PAYSLIP_AUTO_CREATED',
          data: { contractId: id, payslipId: autoPayslipId, companyId: c.companyId },
        });
        await logActivity(req.db, undefined, c.companyId, 'AUTO_PAYSLIP',
          `Bulletin de paie brouillon créé pour le contrat ${id}.`).catch(() => {});
      }
    } catch (err) {
      console.error('auto-create first payslip failed', err);
    }

    res.json({ ok: true, signedAt, autoPayslipId });
  } catch (error) {
    next(error);
  }
});
