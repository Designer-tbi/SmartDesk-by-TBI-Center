/**
 * Cross-module business automations.
 *
 * Any time an action in one module should ripple into another
 * (e.g. signing a quote must produce a draft invoice, paying an
 * invoice must produce a journal entry, …), put the logic here so
 * routes stay thin and we keep a single source of truth for the
 * side-effects.
 *
 * Every function takes a `db` client already scoped to the right
 * tenant (via the shared dbMiddleware) and performs its own
 * BEGIN/COMMIT so callers can fire-and-forget without polluting
 * their own transaction semantics.
 */

import { computeInvoiceTotals } from './invoiceTotals.js';

type DB = { query: (...args: any[]) => Promise<any> };

/* -------------------------------------------------------------- */
/* 1.  Quote signed  ->  draft invoice                              */
/* -------------------------------------------------------------- */

/**
 * Automatically convert a freshly signed quote into a draft invoice.
 * Mirrors `POST /api/invoices/:id/convert-to-invoice` but runs from
 * the RLS-bypassed public signature flow, so we must pass the
 * owning `companyId` explicitly.
 *
 * Returns the new invoice id on success, or `null` if the quote
 * was already converted / could not be converted.
 */
export async function autoConvertSignedQuoteToInvoice(
  db: DB,
  quoteId: string,
  companyId: string,
): Promise<string | null> {
  const quoteRes = await db.query(
    `SELECT * FROM invoices WHERE id = $1 AND "companyId" = $2 AND type = 'Quote'`,
    [quoteId, companyId],
  );
  const quote = quoteRes.rows[0];
  if (!quote) return null;
  if (quote.convertedToInvoiceId) return quote.convertedToInvoiceId;

  const itemsRes = await db.query(
    `SELECT * FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2`,
    [quoteId, companyId],
  );
  const items = itemsRes.rows;

  const compRes = await db.query(
    `SELECT country FROM companies WHERE id = $1`,
    [companyId],
  );
  const country = String(compRes.rows[0]?.country || '').toUpperCase();
  const isCG = country === 'CG' || country === 'CONGO';

  const totals = computeInvoiceTotals(items, {
    remise: quote.remise,
    remiseType: quote.remiseType,
    rabais: quote.rabais,
    rabaisType: quote.rabaisType,
    ristourne: quote.ristourne,
    ristourneType: quote.ristourneType,
    escompte: quote.escompte,
    escompteType: quote.escompteType,
  }, { applyCentimesAdditionnels: isCG });

  const newInvoiceId = `INV-${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await db.query('BEGIN');
  try {
    await db.query(
      `INSERT INTO invoices (
         id, "companyId", type, "contactId", date, "dueDate",
         "totalHT", "tvaTotal", total, status, notes,
         "remise", "remiseType", "rabais", "rabaisType",
         "ristourne", "ristourneType", "escompte", "escompteType",
         "centimesAdditionnels", "netCommercial", "netFinancier",
         "convertedFromQuoteId"
       ) VALUES (
         $1, $2, 'Invoice', $3, $4, $5,
         $6, $7, $8, 'Draft', $9,
         $10, $11, $12, $13,
         $14, $15, $16, $17,
         $18, $19, $20,
         $21
       )`,
      [
        newInvoiceId, companyId, quote.contactId, today, dueDate,
        totals.brutHT, totals.tvaTotal, totals.total,
        `Généré automatiquement à la signature du devis ${quoteId}`
          + (quote.notes ? `\n\n${quote.notes}` : ''),
        quote.remise || 0, quote.remiseType || 'amount',
        quote.rabais || 0, quote.rabaisType || 'amount',
        quote.ristourne || 0, quote.ristourneType || 'amount',
        quote.escompte || 0, quote.escompteType || 'percent',
        totals.centimesAdditionnels, totals.netCommercial, totals.netFinancier,
        quoteId,
      ],
    );

    for (const item of items) {
      await db.query(
        `INSERT INTO invoice_items ("companyId", "invoiceId", "productId", name, description, quantity, price, "tvaRate", "tvaAmount")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [companyId, newInvoiceId, item.productId || null, item.name, item.description || null, item.quantity, item.price, item.tvaRate, item.tvaAmount],
      );
    }

    await db.query(
      `UPDATE invoices SET status = 'Converted', "convertedToInvoiceId" = $1, "convertedAt" = NOW()
         WHERE id = $2 AND "companyId" = $3`,
      [newInvoiceId, quoteId, companyId],
    );
    await db.query('COMMIT');
    return newInvoiceId;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

/* -------------------------------------------------------------- */
/* 2.  Invoice paid  ->  journal entry                              */
/* -------------------------------------------------------------- */

/**
 * Post a cash-basis (comptabilité de trésorerie) journal entry for
 * a paid invoice using the OHADA chart of accounts:
 *
 *   Débit  521   Banques        total TTC
 *   Crédit 701   Ventes         total HT
 *   Crédit 445   TVA facturée   TVA + centimes additionnels
 *
 * Idempotent: if an entry already exists with `sourceRef` set to the
 * invoice id, does nothing and returns `null`.
 */
export async function autoPostPaidInvoiceJournal(
  db: DB,
  invoiceId: string,
  companyId: string,
): Promise<string | null> {
  // Guard: idempotent.
  const already = await db.query(
    `SELECT id FROM journal_entries WHERE "companyId" = $1 AND "sourceRef" = $2`,
    [companyId, invoiceId],
  );
  if (already.rows.length > 0) return null;

  const invRes = await db.query(
    `SELECT id, "totalHT", "tvaTotal", total, "centimesAdditionnels", "contactId"
       FROM invoices WHERE id = $1 AND "companyId" = $2 AND type = 'Invoice'`,
    [invoiceId, companyId],
  );
  const inv = invRes.rows[0];
  if (!inv) return null;

  const totalHT = Number(inv.totalHT) || 0;
  const tvaTotal = Number(inv.tvaTotal) || 0;
  const centimes = Number(inv.centimesAdditionnels) || 0;
  const total = Number(inv.total) || 0;
  if (total <= 0) return null;

  // Resolve client display name (nice-to-have for the description).
  let clientName = '';
  if (inv.contactId) {
    const cRes = await db.query(
      `SELECT name FROM contacts WHERE id = $1 AND "companyId" = $2`,
      [inv.contactId, companyId],
    );
    clientName = cRes.rows[0]?.name || '';
  }

  const entryId = `je_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const today = new Date().toISOString().slice(0, 10);
  const description = `Encaissement facture ${invoiceId}${clientName ? ` — ${clientName}` : ''}`;

  await db.query('BEGIN');
  try {
    await db.query(
      `INSERT INTO journal_entries (id, "companyId", date, description, "sourceRef")
       VALUES ($1, $2, $3, $4, $5)`,
      [entryId, companyId, today, description, invoiceId],
    );

    const rows: Array<[string, number, number]> = [
      ['521', total, 0], // Banques (débit)
      ['701', 0, totalHT], // Ventes (crédit)
    ];
    if (tvaTotal + centimes > 0) {
      rows.push(['445', 0, tvaTotal + centimes]); // TVA facturée + CAC
    }
    for (const [acc, debit, credit] of rows) {
      await db.query(
        `INSERT INTO journal_items ("companyId", "journalEntryId", "accountId", debit, credit)
         VALUES ($1, $2, $3, $4, $5)`,
        [companyId, entryId, acc, debit, credit],
      );
    }

    await db.query('COMMIT');
    return entryId;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

/* -------------------------------------------------------------- */
/* 3.  Contract signed  ->  first draft payslip                     */
/* -------------------------------------------------------------- */

const computeCongoPayrollBreakdown = (base: number) => {
  const cnss = Math.round(base * 0.04);
  let irpp = 0;
  const taxable = Math.max(0, base - cnss);
  const brackets: Array<[number, number]> = [
    [54_166, 0],
    [125_000, 0.08],
    [291_666, 0.15],
    [500_000, 0.2],
    [Number.POSITIVE_INFINITY, 0.4],
  ];
  let remaining = taxable;
  let floor = 0;
  for (const [ceil, rate] of brackets) {
    const slab = Math.min(remaining, ceil - floor);
    if (slab <= 0) break;
    irpp += slab * rate;
    remaining -= slab;
    floor = ceil;
    if (remaining <= 0) break;
  }
  irpp = Math.round(irpp);
  return { cnss, irpp, deductions: cnss + irpp, net: base - cnss - irpp };
};

/**
 * On contract signature, seed the current-month payslip as a Draft
 * so the HR admin only has to review & validate instead of typing it
 * from scratch. Skips if a payslip already exists for that period.
 *
 * Returns the new payslip id (or `null` if skipped).
 */
export async function autoCreateFirstPayslip(
  db: DB,
  contractId: string,
  companyId: string,
): Promise<string | null> {
  const cRes = await db.query(
    `SELECT id, "employeeId", salary FROM contracts WHERE id = $1 AND "companyId" = $2`,
    [contractId, companyId],
  );
  const contract = cRes.rows[0];
  if (!contract || !contract.employeeId) return null;
  const base = Number(contract.salary) || 0;
  if (base <= 0) return null;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const dupe = await db.query(
    `SELECT id FROM payslips
      WHERE "companyId" = $1 AND "employeeId" = $2
        AND month::int = $3 AND year = $4`,
    [companyId, contract.employeeId, month, year],
  );
  if (dupe.rows.length > 0) return null;

  const comp = await db.query(
    `SELECT country FROM companies WHERE id = $1`,
    [companyId],
  );
  const country = String(comp.rows[0]?.country || '').toUpperCase();
  const isCG = country === 'CG' || country === 'CONGO';
  const { deductions, net } = isCG
    ? computeCongoPayrollBreakdown(base)
    : { deductions: 0, net: base };

  const payslipId = `pay_${contract.employeeId}_${year}${String(month).padStart(2, '0')}_${Date.now()}`;
  await db.query(
    `INSERT INTO payslips (id, "companyId", "employeeId", month, year,
        "baseSalary", bonuses, deductions, "netSalary", status)
     VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, 'Draft')`,
    [payslipId, companyId, contract.employeeId, String(month), year, base, deductions, net],
  );
  return payslipId;
}

/* -------------------------------------------------------------- */
/* 4.  New employee  ->  default CDI draft contract                 */
/* -------------------------------------------------------------- */

/**
 * After an employee is created, spin up a minimal Draft CDI contract
 * so the HR manager can jump straight into editing & sending instead
 * of starting from a blank page.
 *
 * Skips silently if the employee already has any contract attached.
 */
export async function autoCreateDefaultContract(
  db: DB,
  employeeId: string,
  companyId: string,
): Promise<string | null> {
  const empRes = await db.query(
    `SELECT id, "contractType", salary, "joinDate" FROM employees
      WHERE id = $1 AND "companyId" = $2`,
    [employeeId, companyId],
  );
  const emp = empRes.rows[0];
  if (!emp) return null;

  const existing = await db.query(
    `SELECT id FROM contracts WHERE "employeeId" = $1 AND "companyId" = $2 LIMIT 1`,
    [employeeId, companyId],
  );
  if (existing.rows.length > 0) return null;

  const contractId = `CTR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const type = String(emp.contractType || 'CDI');
  const startDate = emp.joinDate || new Date().toISOString().slice(0, 10);
  const salary = Number(emp.salary) || 0;
  await db.query(
    `INSERT INTO contracts (
        id, "companyId", "employeeId", type, "startDate", salary,
        content, status, "createdAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', $8)`,
    [contractId, companyId, employeeId, type, startDate, salary,
     'Contrat généré automatiquement — à compléter puis envoyer pour signature.',
     new Date().toISOString().slice(0, 10)],
  );
  return contractId;
}
