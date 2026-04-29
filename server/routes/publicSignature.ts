import { Router } from 'express';

/**
 * Public router for quote signing flows.
 *
 * NO authentication is required — these endpoints are reached by clients
 * via the link emailed to them. The dbMiddleware tags `/api/public/*`
 * paths with `isSuperAdmin=true` so the carefully-scoped queries below
 * can read across tenants. We never expose RLS-bypassed data outside of
 * what's strictly needed to render the signature page.
 */
export const publicSignatureRouter = Router();

publicSignatureRouter.get('/quotes/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const invRes = await req.db.query(
      `SELECT id, type, "contactId", "companyId", date, "dueDate",
              "totalHT", "tvaTotal", total, status, notes, "signedAt"
         FROM invoices
        WHERE id = $1 AND type = 'Quote'`,
      [id],
    );
    const invoice = invRes.rows[0];
    if (!invoice) return res.status(404).json({ error: 'Devis introuvable' });

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
    const { signerName, signatureDataUrl } = req.body || {};
    if (!signerName || String(signerName).trim().length < 2) {
      return res.status(400).json({ error: 'Nom du signataire requis.' });
    }
    if (!signatureDataUrl || !String(signatureDataUrl).startsWith('data:image/')) {
      return res.status(400).json({ error: 'Signature manuscrite requise.' });
    }

    const exists = await req.db.query(
      `SELECT id, status, "signedAt" FROM invoices WHERE id = $1 AND type = 'Quote'`,
      [id],
    );
    const inv = exists.rows[0];
    if (!inv) return res.status(404).json({ error: 'Devis introuvable' });
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

    res.json({ ok: true, signedAt });
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
              salary, status, content, "signedAt"
         FROM contracts WHERE id = $1`,
      [id],
    );
    const contract = cRes.rows[0];
    if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });

    const compRes = await req.db.query(
      `SELECT name, address, email, phone, niu, currency, logo
         FROM companies WHERE id = $1`,
      [contract.companyId],
    );
    const company = compRes.rows[0] || {};

    let employee: any = null;
    if (contract.employeeId) {
      const eRes = await req.db.query(
        `SELECT name, email, position FROM employees WHERE id = $1`,
        [contract.employeeId],
      );
      employee = eRes.rows[0] || null;
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
    const { signerName, signatureDataUrl } = req.body || {};
    if (!signerName || String(signerName).trim().length < 2) {
      return res.status(400).json({ error: 'Nom du signataire requis.' });
    }
    if (!signatureDataUrl || !String(signatureDataUrl).startsWith('data:image/')) {
      return res.status(400).json({ error: 'Signature manuscrite requise.' });
    }

    const exists = await req.db.query(
      `SELECT id, status, "signedAt" FROM contracts WHERE id = $1`,
      [id],
    );
    const c = exists.rows[0];
    if (!c) return res.status(404).json({ error: 'Contrat introuvable' });
    if (c.signedAt) return res.status(409).json({ error: 'Ce contrat est déjà signé.' });

    const signedAt = new Date().toISOString();
    await req.db.query(
      `UPDATE contracts SET status = 'Signed', "signedAt" = $1,
              "signatureLink" = $2
         WHERE id = $3`,
      [signedAt, JSON.stringify({ signerName, signatureDataUrl }), id],
    );

    res.json({ ok: true, signedAt });
  } catch (error) {
    next(error);
  }
});
