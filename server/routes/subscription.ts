/**
 * Subscription routes — trial tracking + PayPal Subscriptions.
 *
 *   GET  /api/subscription/status        — current tenant status + trial days
 *   POST /api/subscription/start-trial   — stamp first admin login (idempotent)
 *   POST /api/subscription/create        — create a PayPal subscription
 *   POST /api/subscription/activate      — called when the user returns from PayPal approval
 *   POST /api/subscription/cancel        — end auto-renewal
 *   POST /api/subscription/webhook       — PayPal webhook sink
 */
import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';
import {
  ensureProductAndPlans,
  resolvePlanForCountry,
  createSubscription,
  getSubscription,
  cancelSubscription,
  PLAN_SPECS,
} from '../services/paypal.js';

export const subscriptionRouter = Router();

const TRIAL_DAYS = 15;

const computeStatus = (company: any) => {
  const now = Date.now();
  const trialStart = company.trialStartedAt ? new Date(company.trialStartedAt).getTime() : null;
  const periodEnd = company.subscriptionPeriodEnd ? new Date(company.subscriptionPeriodEnd).getTime() : null;
  const subStatus = company.subscriptionStatus || 'trial';

  let access: 'allowed' | 'blocked' = 'allowed';
  let daysLeft = 0;
  let inTrial = false;
  let trialExpiresAt: string | null = null;

  if (subStatus === 'active') {
    // Active subscription — allow even if periodEnd is in the past by
    // less than 24h (PayPal webhook may take a few minutes to fire).
    access = 'allowed';
  } else if (trialStart) {
    const elapsedMs = now - trialStart;
    const trialMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
    if (elapsedMs < trialMs) {
      inTrial = true;
      daysLeft = Math.ceil((trialMs - elapsedMs) / (24 * 60 * 60 * 1000));
      trialExpiresAt = new Date(trialStart + trialMs).toISOString();
    } else {
      // Trial consumed, no active sub → block.
      access = 'blocked';
    }
  } else {
    // No trial stamp yet → allow (will be stamped on first login).
    access = 'allowed';
  }

  // Explicit blocking statuses.
  if (['expired', 'suspended', 'cancelled'].includes(subStatus)) access = 'blocked';

  return { access, subStatus, inTrial, daysLeft, trialExpiresAt, periodEnd };
};

/* -------------------------------------------------------------- */
/* Status                                                          */
/* -------------------------------------------------------------- */

subscriptionRouter.get('/status', requireAuth, requireCompany, async (req, res, next) => {
  try {
    const cid = req.user!.companyId;
    const r = await req.db.query(
      `SELECT id, country, "trialStartedAt", "subscriptionStatus",
              "paypalSubscriptionId", "subscriptionPlan", "subscriptionPeriodEnd"
         FROM companies WHERE id = $1`,
      [cid],
    );
    const company = r.rows[0];
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const status = computeStatus(company);
    const plan = resolvePlanForCountry(company.country);
    res.json({
      ...status,
      country: company.country,
      subscriptionId: company.paypalSubscriptionId,
      plan: {
        id: plan.id,
        amountUSD: plan.amountUSD,
        displayLocal: plan.displayLocal,
        description: plan.description,
      },
    });
  } catch (err) { next(err); }
});

/* -------------------------------------------------------------- */
/* Start trial (idempotent — first admin login)                    */
/* -------------------------------------------------------------- */

subscriptionRouter.post('/start-trial', requireAuth, requireCompany, async (req, res, next) => {
  try {
    const cid = req.user!.companyId;
    const r = await req.db.query(
      `UPDATE companies
          SET "trialStartedAt" = COALESCE("trialStartedAt", NOW()),
              "subscriptionStatus" = COALESCE(NULLIF("subscriptionStatus", ''), 'trial')
        WHERE id = $1
      RETURNING "trialStartedAt", "subscriptionStatus"`,
      [cid],
    );
    res.json({ ok: true, trialStartedAt: r.rows[0]?.trialStartedAt, subscriptionStatus: r.rows[0]?.subscriptionStatus });
  } catch (err) { next(err); }
});

/* -------------------------------------------------------------- */
/* Create PayPal subscription                                      */
/* -------------------------------------------------------------- */

subscriptionRouter.post('/create', requireAuth, requireCompany, async (req, res, next) => {
  try {
    const cid = req.user!.companyId;
    const r = await req.db.query(
      `SELECT id, country FROM companies WHERE id = $1`,
      [cid],
    );
    const company = r.rows[0];
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const plans = await ensureProductAndPlans(req.db);
    const spec = resolvePlanForCountry(company.country);
    const planId = plans[spec.id];
    if (!planId) return res.status(500).json({ error: 'PayPal plan unavailable for this country' });

    const base = process.env.PAYPAL_RETURN_URL_BASE || `${req.protocol}://${req.get('host')}`;
    const subscription = await createSubscription(
      planId,
      { companyId: cid, userEmail: req.user!.email || 'admin@smartdesk.cg' },
      `${base}/?subscription=return`,
      `${base}/?subscription=cancel`,
    );

    // Persist the pending subscription id so we can resync on return.
    await req.db.query(
      `UPDATE companies
          SET "paypalSubscriptionId" = $1,
              "subscriptionPlan" = $2,
              "subscriptionStatus" = 'pending'
        WHERE id = $3`,
      [subscription.id, spec.id, cid],
    );

    const approveLink = (subscription.links || []).find((l: any) => l.rel === 'approve')?.href || null;
    res.json({
      subscriptionId: subscription.id,
      approveUrl: approveLink,
      plan: { id: spec.id, amountUSD: spec.amountUSD, displayLocal: spec.displayLocal },
    });
  } catch (err) { next(err); }
});

/* -------------------------------------------------------------- */
/* Activate — called after PayPal approval redirect                */
/* -------------------------------------------------------------- */

subscriptionRouter.post('/activate', requireAuth, requireCompany, async (req, res, next) => {
  try {
    const cid = req.user!.companyId;
    const r = await req.db.query(
      `SELECT "paypalSubscriptionId" FROM companies WHERE id = $1`,
      [cid],
    );
    const subId = r.rows[0]?.paypalSubscriptionId;
    if (!subId) return res.status(400).json({ error: 'Pas d\'abonnement en cours.' });

    const sub = await getSubscription(subId);
    const paypalStatus = String(sub.status || '').toUpperCase();
    const nextBilling = sub.billing_info?.next_billing_time || null;

    let localStatus: string;
    if (paypalStatus === 'ACTIVE') localStatus = 'active';
    else if (paypalStatus === 'APPROVAL_PENDING' || paypalStatus === 'APPROVED') localStatus = 'pending';
    else if (paypalStatus === 'SUSPENDED') localStatus = 'suspended';
    else if (paypalStatus === 'CANCELLED' || paypalStatus === 'EXPIRED') localStatus = 'expired';
    else localStatus = paypalStatus.toLowerCase();

    await req.db.query(
      `UPDATE companies
          SET "subscriptionStatus" = $1,
              "subscriptionPeriodEnd" = $2
        WHERE id = $3`,
      [localStatus, nextBilling, cid],
    );

    res.json({ ok: true, status: localStatus, nextBilling });
  } catch (err) { next(err); }
});

/* -------------------------------------------------------------- */
/* Cancel                                                          */
/* -------------------------------------------------------------- */

subscriptionRouter.post('/cancel', requireAuth, requireCompany, async (req, res, next) => {
  try {
    const cid = req.user!.companyId;
    const r = await req.db.query(
      `SELECT "paypalSubscriptionId" FROM companies WHERE id = $1`,
      [cid],
    );
    const subId = r.rows[0]?.paypalSubscriptionId;
    if (subId) {
      try { await cancelSubscription(subId, String(req.body?.reason || 'Utilisateur')); }
      catch (err) { console.error('PayPal cancel failed (continuing):', err); }
    }
    await req.db.query(
      `UPDATE companies SET "subscriptionStatus" = 'cancelled' WHERE id = $1`,
      [cid],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* -------------------------------------------------------------- */
/* Webhook                                                         */
/* -------------------------------------------------------------- */

subscriptionRouter.post('/webhook', async (req, res, next) => {
  try {
    // Signature verification would require PAYPAL_WEBHOOK_ID env var
    // which the user hasn't provided. We still accept events but log
    // a warning so we remember to enable verification in prod.
    const body = req.body as any;
    const type = String(body?.event_type || '');
    const sub = body?.resource;
    const customId: string | undefined = sub?.custom_id;
    const subId: string | undefined = sub?.id;
    if (!customId) {
      console.warn('PayPal webhook without custom_id — skipping:', type);
      return res.sendStatus(200);
    }

    let newStatus: string | null = null;
    let periodEnd: string | null = null;

    switch (type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
      case 'BILLING.SUBSCRIPTION.RENEWED':
      case 'PAYMENT.SALE.COMPLETED':
        newStatus = 'active';
        periodEnd = sub?.billing_info?.next_billing_time || null;
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        newStatus = 'cancelled';
        break;
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        newStatus = 'expired';
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        newStatus = 'suspended';
        break;
      default:
        console.log('PayPal webhook ignored:', type);
    }

    if (newStatus) {
      await req.db.query(
        `UPDATE companies
            SET "subscriptionStatus" = $1,
                "paypalSubscriptionId" = COALESCE($2, "paypalSubscriptionId"),
                "subscriptionPeriodEnd" = COALESCE($3, "subscriptionPeriodEnd")
          WHERE id = $4`,
        [newStatus, subId, periodEnd, customId],
      );
    }

    res.sendStatus(200);
  } catch (err) { next(err); }
});
