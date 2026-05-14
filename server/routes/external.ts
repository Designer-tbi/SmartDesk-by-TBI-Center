/**
 * Partner-platform provisioning API.
 *
 * Authenticated via a static `EXTERNAL_API_KEY` (X-API-Key header or
 * Bearer token). Lets an external SaaS console create SmartDesk
 * tenants programmatically.
 *
 * Companies created through this route are marked:
 *   - `origin = 'external'`
 *   - `subscriptionStatus = 'active'` (the partner handles billing)
 *   - `onboardingCompleted = true` (no in-app wizard required)
 *
 * They show up in the existing super-admin dashboard with an
 * "Origine : externe" badge.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireExternalApiKey } from '../middleware/requireExternalApiKey.js';
import { db as rootPool, seedDefaultRoles } from '../../db.js';

export const externalRouter = Router();
externalRouter.use(requireExternalApiKey);

// Generate a strong, easily-typable password for the auto-created
// admin user. 16 chars from an unambiguous alphabet.
const generatePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
  let out = '';
  const buf = new Uint8Array(16);
  // Node's webcrypto is available in modern runtimes; fall back to
  // Math.random when not (acceptable here because the password is
  // returned to the partner ONCE — they can rotate immediately).
  try {
    require('crypto').webcrypto.getRandomValues(buf);
  } catch {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < buf.length; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
};

/**
 * POST /api/external/companies
 *
 * Body (JSON):
 *   Required:
 *     name        — Company display name
 *     adminEmail  — Email of the initial admin user (login)
 *     country     — ISO-2 (CG, CD, FR, …)
 *     city        — Free-text city
 *   Optional (Settings page fields, all nullable):
 *     externalRef                 — Partner's internal reference (audit)
 *     adminName                   — Display name for the admin user
 *     currency, accountingStandard, language
 *     taxId, rccm, idNat, niu, siren, siret
 *     legalForm, capital
 *     address, phone, email, website
 *     representativeName, representativeRole
 *     cnssEmployerRate, cnssEmployeeRate
 *     logo (base64 data URL or http URL)
 *
 * Response (201):
 *     { company: {...}, admin: { id, email, password } }
 *
 *   The plaintext `password` is returned **once** and must be
 *   surfaced/stored by the partner — SmartDesk never echoes it again.
 */
externalRouter.post('/companies', async (req, res, next) => {
  // Use the root pool directly: this endpoint has no tenant context
  // (no JWT) so the regular req.db middleware is bypassed.
  const db = rootPool;
  await db.query('BEGIN');
  try {
    const {
      name,
      adminEmail,
      country,
      city,
      externalRef = null,
      adminName = null,
      currency = null,
      accountingStandard = null,
      language = 'fr',
      taxId = null,
      rccm = null,
      idNat = null,
      niu = null,
      siren = null,
      siret = null,
      legalForm = null,
      capital = null,
      address = null,
      phone = null,
      email = null,
      website = null,
      representativeName = null,
      representativeRole = null,
      cnssEmployerRate = null,
      cnssEmployeeRate = null,
      logo = null,
    } = req.body || {};

    // Required field validation.
    const missing: string[] = [];
    if (!name) missing.push('name');
    if (!adminEmail) missing.push('adminEmail');
    if (!country) missing.push('country');
    if (!city) missing.push('city');
    if (missing.length) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        error: 'Missing required fields',
        fields: missing,
      });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(adminEmail))) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'adminEmail is not a valid email' });
    }

    // Reject if an existing user already owns this email — partners
    // can re-issue the same admin email otherwise, which would
    // silently shadow logins.
    const existing = await db.query('SELECT 1 FROM public.users WHERE email = $1 LIMIT 1', [adminEmail]);
    if (existing.rowCount && existing.rowCount > 0) {
      await db.query('ROLLBACK');
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const cIso = String(country).toUpperCase();
    const inferredCurrency =
      currency ||
      (cIso === 'CG' ? 'XAF' : cIso === 'CD' ? 'CDF' : cIso === 'FR' ? 'EUR' : 'XAF');
    const inferredStandard =
      accountingStandard ||
      (cIso === 'FR' ? 'FRANCE' : 'OHADA');

    const companyId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const schemaName = `tenant_${companyId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;

    await db.query(
      `INSERT INTO public.companies (
         id, name, type, status, origin, "externalRef",
         country, city, currency, "accountingStandard", language,
         "taxId", rccm, "idNat", niu, siren, siret,
         "legalForm", capital, address, phone, email, website, logo,
         "representativeName", "representativeRole",
         "cnssEmployerRate", "cnssEmployeeRate",
         "subscriptionStatus", "onboardingCompleted",
         "createdAt", "schemaName"
       ) VALUES (
         $1, $2, 'real', 'active', 'external', $3,
         $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14,
         $15, $16, $17, $18, $19, $20, $21,
         $22, $23,
         $24, $25,
         'active', TRUE,
         NOW(), $26
       )`,
      [
        companyId, name, externalRef,
        cIso, city, inferredCurrency, inferredStandard, language,
        taxId, rccm, idNat, niu, siren, siret,
        legalForm,
        Number.isFinite(Number(capital)) && capital !== '' ? Number(capital) : null,
        address, phone, email, website, logo,
        representativeName, representativeRole,
        Number.isFinite(Number(cnssEmployerRate)) && cnssEmployerRate !== '' ? Number(cnssEmployerRate) : null,
        Number.isFinite(Number(cnssEmployeeRate)) && cnssEmployeeRate !== '' ? Number(cnssEmployeeRate) : null,
        schemaName,
      ],
    );

    // NB: we intentionally do NOT call initializeTenantSchema here.
    // SmartDesk uses RLS-based multi-tenancy on the `public` schema —
    // every table is already provisioned, isolation is enforced by
    // `set_config('app.current_company_id', ...)`. The per-tenant
    // PostgreSQL schema referenced by `companies.schemaName` is a
    // vestigial column kept for legacy compatibility.

    // Seed default roles. Set the tenant RLS context first so the
    // INSERT WITH CHECK rules pass.
    await db.query(`SELECT set_config('app.current_company_id', $1, false)`, [companyId]);
    await seedDefaultRoles(db, companyId);

    const plainPassword = generatePassword();
    const hashed = await bcrypt.hash(plainPassword, 10);
    const userId = `user-ext-${Date.now()}`;
    const adminRoleId = `role_admin_${companyId}`;

    await db.query(
      `INSERT INTO public.users (id, "companyId", email, password, role, name, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Active')`,
      [userId, companyId, adminEmail, hashed, adminRoleId, adminName || name],
    );

    await db.query('COMMIT');

    // Reset the RLS context so subsequent requests on this pooled
    // connection don't leak our tenant id.
    try {
      await db.query(`SELECT set_config('app.current_company_id', '', false)`);
    } catch { /* noop */ }

    // Fetch the fresh company row — exclude internal flags + the
    // fiscalization key, never the raw password.
    const compRes = await db.query(
      `SELECT id, name, type, origin, "externalRef",
              country, city, currency, "accountingStandard", language,
              "taxId", rccm, "idNat", niu, "legalForm", capital,
              address, phone, email, website, logo,
              "representativeName", "representativeRole",
              "cnssEmployerRate", "cnssEmployeeRate",
              "subscriptionStatus", "onboardingCompleted", "createdAt"
         FROM public.companies WHERE id = $1`,
      [companyId],
    );

    res.status(201).json({
      company: compRes.rows[0],
      admin: {
        id: userId,
        email: adminEmail,
        name: adminName || name,
        password: plainPassword,
        note: 'This password is shown ONCE. Store it now — SmartDesk will never disclose it again.',
      },
    });
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch { /* noop */ }
    next(error);
  }
});

/**
 * GET /api/external/companies
 *
 * Lists all companies created via this API. Useful for the partner
 * to reconcile their own dashboard with SmartDesk.
 */
externalRouter.get('/companies', async (_req, res, next) => {
  try {
    const r = await rootPool.query(
      `SELECT id, name, origin, "externalRef",
              country, city, currency, language,
              "subscriptionStatus", "createdAt"
         FROM public.companies
        WHERE origin = 'external'
        ORDER BY "createdAt" DESC NULLS LAST`,
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});
