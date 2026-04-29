import { Router } from 'express';
import { requireAuth, requireCompany } from '../middleware/auth.js';
import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { certifyInvoice } from '../services/fiscalization.js';
import { getMailerForCompany } from '../services/mailer.js';

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth, requireCompany);

invoicesRouter.get('/quote-templates', async (req, res, next) => {
  try {
    const templatesRes = await req.db.query('SELECT * FROM quote_templates WHERE "companyId" = $1', [req.user!.companyId]);
    const templates = templatesRes.rows;
    
    const templatesWithItems = await Promise.all(templates.map(async (tmpl: any) => {
      const itemsRes = await req.db.query('SELECT * FROM quote_template_items WHERE "templateId" = $1 AND "companyId" = $2', [tmpl.id, req.user!.companyId]);
      return { ...tmpl, items: itemsRes.rows };
    }));
    
    res.json(templatesWithItems);
  } catch (error) {
    next(error);
  }
});

invoicesRouter.post('/quote-templates', async (req, res, next) => {
  try {
    const tmpl = req.body;
    
    await req.db.query('BEGIN');
    
    await req.db.query(
      'INSERT INTO quote_templates (id, "companyId", name, notes) VALUES ($1, $2, $3, $4)',
      [tmpl.id, req.user!.companyId, tmpl.name, tmpl.notes || null]
    );
    
    if (Array.isArray(tmpl.items)) {
      for (const item of tmpl.items) {
        const productId = item.productId && item.productId !== '' ? item.productId : null;
        await req.db.query(
          'INSERT INTO quote_template_items ("companyId", "templateId", "productId", name, description, quantity, price, "tvaRate", "tvaAmount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [req.user!.companyId, tmpl.id, productId, item.name, item.description || null, item.quantity, item.price, item.tvaRate, item.tvaAmount]
        );
      }
    }
    
    await req.db.query('COMMIT');
    res.status(201).json(tmpl);
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

invoicesRouter.delete('/quote-templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await req.db.query('BEGIN');
    await req.db.query('DELETE FROM quote_template_items WHERE "templateId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('DELETE FROM quote_templates WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('COMMIT');
    
    res.status(204).send();
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

invoicesRouter.get('/', async (req, res, next) => {
  try {
    const invoicesRes = await req.db.query('SELECT * FROM invoices WHERE "companyId" = $1', [req.user!.companyId]);
    const invoices = invoicesRes.rows;
    
    const invoicesWithItems = await Promise.all(invoices.map(async (inv: any) => {
      const itemsRes = await req.db.query('SELECT * FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2', [inv.id, req.user!.companyId]);
      return { ...inv, items: itemsRes.rows };
    }));
    
    res.json(invoicesWithItems);
  } catch (error) {
    next(error);
  }
});

invoicesRouter.post('/', async (req, res, next) => {
  try {
    const inv = req.body;
    console.log('POST /api/invoices - Request body:', JSON.stringify(inv, null, 2));
    
    if (!req.user?.companyId) {
      console.error('POST /api/invoices - Missing companyId in req.user');
      return res.status(400).json({ error: 'Missing company context' });
    }

    await req.db.query('BEGIN');
    
    try {
      const contactId = inv.contactId && inv.contactId !== '' ? inv.contactId : null;
      
      await req.db.query(
        'INSERT INTO invoices (id, "companyId", type, "contactId", date, "dueDate", "totalHT", "tvaTotal", total, status, notes, "signatureLink", "signedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
        [inv.id, req.user.companyId, inv.type, contactId, inv.date, inv.dueDate, inv.totalHT, inv.tvaTotal, inv.total, inv.status, inv.notes || null, inv.signatureLink || null, inv.signedAt || null]
      );
      
      if (Array.isArray(inv.items)) {
        for (const item of inv.items) {
          const productId = item.productId && item.productId !== '' ? item.productId : null;
          await req.db.query(
            'INSERT INTO invoice_items ("companyId", "invoiceId", "productId", name, description, quantity, price, "tvaRate", "tvaAmount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [req.user.companyId, inv.id, productId, item.name, item.description || null, item.quantity, item.price, item.tvaRate, item.tvaAmount]
          );
        }
      }
      
      await req.db.query('COMMIT');
      console.log('POST /api/invoices - Success');

      // Auto-certify via SFEC for demo companies only. The per-company API
      // key is stored in `companies.fiscalizationApiKey` (seeded on demo
      // creation). Failures are non-fatal — the invoice still saves.
      let certified: any = null;
      try {
        const companyRes = await req.db.query(
          'SELECT id, name, niu, "taxId", currency, type, "fiscalizationApiKey" FROM companies WHERE id = $1',
          [req.user.companyId],
        );
        const company = companyRes.rows[0];
        if (company?.type === 'demo' && inv.type === 'Invoice' && company.fiscalizationApiKey) {
          let buyer: any = { name: null, niu: null, address: null, email: null, phone: null, contactType: 'individual' };
          if (contactId) {
            const cRes = await req.db.query(
              'SELECT name, niu, address, email, phone, "contactType", "foreignCountry" FROM contacts WHERE id = $1 AND "companyId" = $2',
              [contactId, req.user.companyId],
            );
            buyer = cRes.rows[0] || buyer;
          }
          const result = await certifyInvoice({
            invoice: { ...inv, items: inv.items || [] },
            company,
            buyer,
          });
          const payload = {
            source: result.source,
            qrPayload: result.qrPayload,
            qrImage: result.qrImage,
            signature: result.signature,
            shortSignature: result.shortSignature,
          };
          await req.db.query(
            `UPDATE invoices SET
               "certificationNumber" = $1,
               "certifiedAt" = $2,
               "certificationStatus" = $3,
               "certificationPayload" = $4::jsonb
             WHERE id = $5 AND "companyId" = $6`,
            [
              result.certificationNumber,
              result.certifiedAt,
              result.status,
              JSON.stringify(payload),
              inv.id,
              req.user.companyId,
            ],
          );
          certified = {
            certificationNumber: result.certificationNumber,
            certifiedAt: result.certifiedAt,
            certificationStatus: result.status,
            certificationPayload: payload,
          };
        }
      } catch (certErr: any) {
        // 4xx SFEC errors are surfaced to the client as a non-blocking
        // warning — the invoice itself was saved.
        console.error('POST /api/invoices - Certification failed (non-fatal):', certErr?.message || certErr);
        certified = {
          certificationStatus: 'failed',
          certificationError: certErr?.message || 'Échec de la certification SFEC',
          certificationErrorCode: certErr?.errorCode,
        };
      }

      res.status(201).json({ ...inv, ...(certified || {}) });
    } catch (dbError) {
      await req.db.query('ROLLBACK');
      console.error('POST /api/invoices - Database Error:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('POST /api/invoices - Catch Error:', error);
    next(error);
  }
});

/**
 * Manually (re)certify an invoice via DGID. Restricted to demo companies —
 * this is a demo-only feature until the real API is wired.
 */
invoicesRouter.post('/:id/certify', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.user?.companyId) {
      return res.status(400).json({ error: 'Missing company context' });
    }
    const companyRes = await req.db.query(
      'SELECT id, name, niu, "taxId", currency, type, "fiscalizationApiKey" FROM companies WHERE id = $1',
      [req.user.companyId],
    );
    const company = companyRes.rows[0];
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (company.type !== 'demo') {
      return res.status(403).json({ error: 'Certification SFEC réservée aux sociétés démo pour l\'instant.' });
    }
    if (!company.fiscalizationApiKey) {
      return res.status(400).json({ error: "Clé API SFEC absente pour cette entreprise." });
    }

    const invRes = await req.db.query(
      'SELECT * FROM invoices WHERE id = $1 AND "companyId" = $2',
      [id, req.user.companyId],
    );
    const invoice = invRes.rows[0];
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const itemsRes = await req.db.query(
      'SELECT * FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2',
      [id, req.user.companyId],
    );
    let buyer: any = { name: null, niu: null, address: null, email: null, phone: null, contactType: 'individual' };
    if (invoice.contactId) {
      const cRes = await req.db.query(
        'SELECT name, niu, address, email, phone, "contactType", "foreignCountry" FROM contacts WHERE id = $1 AND "companyId" = $2',
        [invoice.contactId, req.user.companyId],
      );
      buyer = cRes.rows[0] || buyer;
    }

    let result;
    try {
      result = await certifyInvoice({
        invoice: { ...invoice, items: itemsRes.rows },
        company,
        buyer,
      });
    } catch (certErr: any) {
      // SFEC 4xx — return the structured error to the user.
      return res.status(certErr?.httpStatus || 422).json({
        error: certErr?.message || 'Échec de la certification SFEC',
        code: certErr?.errorCode,
        field: certErr?.field,
      });
    }

    const payload = {
      source: result.source,
      qrPayload: result.qrPayload,
      qrImage: result.qrImage,
      signature: result.signature,
      shortSignature: result.shortSignature,
    };
    await req.db.query(
      `UPDATE invoices SET
         "certificationNumber" = $1,
         "certifiedAt" = $2,
         "certificationStatus" = $3,
         "certificationPayload" = $4::jsonb
       WHERE id = $5 AND "companyId" = $6`,
      [
        result.certificationNumber,
        result.certifiedAt,
        result.status,
        JSON.stringify(payload),
        id,
        req.user.companyId,
      ],
    );

    res.json({
      certificationNumber: result.certificationNumber,
      certifiedAt: result.certifiedAt,
      certificationStatus: result.status,
      certificationPayload: payload,
    });
  } catch (error) {
    console.error('POST /api/invoices/:id/certify error', error);
    next(error);
  }
});


invoicesRouter.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const inv = req.body;
  try {
    console.log(`PUT /api/invoices/${id} - Request body:`, JSON.stringify(inv, null, 2));

    if (!req.user?.companyId) {
      console.error(`PUT /api/invoices/${id} - Missing companyId in req.user`);
      return res.status(400).json({ error: 'Missing company context' });
    }
    
    await req.db.query('BEGIN');
    
    try {
      // Fetch previous invoice to check status change + certification lock.
      // Certified invoices are frozen: editing them would break the DGID
      // signature. Only a small set of status transitions is allowed.
      const prevInvoiceRes = await req.db.query(
        'SELECT status, "certificationNumber", "certificationStatus" FROM invoices WHERE id = $1 AND "companyId" = $2',
        [id, req.user.companyId],
      );
      const prevInvoice = prevInvoiceRes.rows[0];
      const isLocked = !!prevInvoice?.certificationNumber;
      if (isLocked) {
        const allowedNextStatus = new Set(['Paid', 'Overdue', 'Sent', prevInvoice.status]);
        if (!allowedNextStatus.has(inv.status)) {
          await req.db.query('ROLLBACK');
          return res.status(409).json({
            error: 'Cette facture a été certifiée DGID et ne peut plus être modifiée. Seul le statut de paiement peut évoluer.',
          });
        }
        // Only update the payment-related status, never the content.
        await req.db.query(
          'UPDATE invoices SET status = $1 WHERE id = $2 AND "companyId" = $3',
          [inv.status, id, req.user.companyId],
        );
        await req.db.query('COMMIT');
        const refreshed = await req.db.query(
          'SELECT * FROM invoices WHERE id = $1 AND "companyId" = $2',
          [id, req.user.companyId],
        );
        const itemsRes = await req.db.query(
          'SELECT * FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2',
          [id, req.user.companyId],
        );
        return res.json({ ...refreshed.rows[0], items: itemsRes.rows });
      }

      const contactId = inv.contactId && inv.contactId !== '' ? inv.contactId : null;

      await req.db.query(
        'UPDATE invoices SET type = $1, "contactId" = $2, date = $3, "dueDate" = $4, "totalHT" = $5, "tvaTotal" = $6, total = $7, status = $8, notes = $9, "signatureLink" = $10, "signedAt" = $11 WHERE id = $12 AND "companyId" = $13',
        [inv.type, contactId, inv.date, inv.dueDate, inv.totalHT, inv.tvaTotal, inv.total, inv.status, inv.notes || null, inv.signatureLink || null, inv.signedAt || null, id, req.user.companyId]
      );
      
      await req.db.query('DELETE FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2', [id, req.user.companyId]);
      
      if (Array.isArray(inv.items)) {
        for (const item of inv.items) {
          const productId = item.productId && item.productId !== '' ? item.productId : null;
          await req.db.query(
            'INSERT INTO invoice_items ("companyId", "invoiceId", "productId", name, description, quantity, price, "tvaRate", "tvaAmount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [req.user.companyId, id, productId, item.name, item.description || null, item.quantity, item.price, item.tvaRate, item.tvaAmount]
          );
        }
      }
      
      await req.db.query('COMMIT');
      console.log(`PUT /api/invoices/${id} - Success`);
    
    // If status changed to Signed, send an email with the PDF
    if (prevInvoice && prevInvoice.status !== 'Signed' && inv.status === 'Signed') {
      try {
        // Fetch contact and company
        const contactRes = await req.db.query('SELECT * FROM contacts WHERE id = $1 AND "companyId" = $2', [contactId, req.user!.companyId]);
        const contact = contactRes.rows[0];
        
        const companyRes = await req.db.query('SELECT * FROM companies WHERE id = $1', [req.user!.companyId]);
        const company = companyRes.rows[0];
        
        if (contact && contact.email && company) {
          const doc = new jsPDF();
          
          doc.setFontSize(20);
          doc.text(inv.type === 'Quote' ? 'DEVIS' : 'FACTURE', 14, 22);
          
          doc.setFontSize(10);
          doc.text(`N°: ${inv.id}`, 14, 30);
          doc.text(`Date: ${inv.date}`, 14, 35);
          if (inv.dueDate) doc.text(`Échéance: ${inv.dueDate}`, 14, 40);
          
          doc.text('Émetteur:', 14, 55);
          doc.setFont(undefined, 'bold');
          doc.text(company.name, 14, 60);
          doc.setFont(undefined, 'normal');
          if (company.address) doc.text(company.address, 14, 65);
          if (company.email) doc.text(company.email, 14, 70);
          if (company.phone) doc.text(company.phone, 14, 75);
          
          doc.text('Adressé à:', 120, 55);
          doc.setFont(undefined, 'bold');
          doc.text(contact.name, 120, 60);
          doc.setFont(undefined, 'normal');
          if (contact.email) doc.text(contact.email, 120, 65);
          if (contact.phone) doc.text(contact.phone, 120, 70);
          
          const tableData = (inv.items || []).map((item: any) => [
            item.name + (item.description ? `\n${item.description}` : ''),
            item.quantity.toString(),
            `${item.price.toLocaleString()} ${company.currency}`,
            `${item.tvaRate}%`,
            `${(item.quantity * item.price).toLocaleString()} ${company.currency}`
          ]);
          
          autoTable(doc, {
            startY: 90,
            head: [['Description', 'Qté', 'Prix Unitaire', 'TVA', 'Total HT']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] },
          });
          
          const finalY = (doc as any).lastAutoTable.finalY || 90;
          
          doc.text(`Total HT: ${inv.totalHT.toLocaleString()} ${company.currency}`, 140, finalY + 10);
          doc.text(`TVA: ${inv.tvaTotal.toLocaleString()} ${company.currency}`, 140, finalY + 15);
          doc.setFont(undefined, 'bold');
          doc.text(`Total TTC: ${inv.total.toLocaleString()} ${company.currency}`, 140, finalY + 20);
          
          if (inv.signedAt) {
            doc.setTextColor(34, 197, 94); // Green
            doc.text(`Signé le: ${inv.signedAt}`, 14, finalY + 10);
            doc.text('Signature numérique validée', 14, finalY + 15);
          }

          // DGID certification block (QR + number + timestamp) — only when
          // the invoice has been certified. Placed bottom-left so it doesn't
          // clash with the total TTC on the right.
          if (inv.certificationNumber) {
            try {
              const qrPayload = inv.certificationPayload?.qrPayload || inv.certificationNumber;
              const qrDataUrl = await QRCode.toDataURL(String(qrPayload), {
                margin: 1,
                width: 140,
                errorCorrectionLevel: 'M',
              });
              const qrY = finalY + 25;
              doc.setTextColor(0, 0, 0);
              doc.setFont(undefined, 'bold');
              doc.text('Certification DGID', 14, qrY);
              doc.setFont(undefined, 'normal');
              doc.addImage(qrDataUrl, 'PNG', 14, qrY + 3, 28, 28);
              doc.setFontSize(8);
              doc.text(`N°: ${inv.certificationNumber}`, 46, qrY + 10);
              if (inv.certifiedAt) {
                doc.text(`Certifiée le: ${new Date(inv.certifiedAt).toLocaleString('fr-FR')}`, 46, qrY + 16);
              }
              const source =
                inv.certificationPayload?.source === 'dgid'
                  ? 'API DGID (Congo)'
                  : 'Signature locale (mode démo)';
              doc.text(`Source: ${source}`, 46, qrY + 22);
              doc.setFontSize(10);
            } catch (err) {
              console.error('Failed to embed DGID QR in PDF:', err);
            }
          }
          
          const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
          
          const { transporter, from } = getMailerForCompany(company.type, company.name);
          
          await transporter.sendMail({
            from,
            to: contact.email,
            subject: `Votre ${inv.type === 'Quote' ? 'devis' : 'facture'} signé(e) - ${inv.id}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #4f46e5;">Document Signé</h2>
                <p>Bonjour ${contact.name},</p>
                <p>Nous vous confirmons la signature de votre ${inv.type === 'Quote' ? 'devis' : 'facture'} <strong>${inv.id}</strong>.</p>
                <p>Vous trouverez ci-joint une copie au format PDF pour vos archives.</p>
                <p>Merci pour votre confiance.</p>
                <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;" />
                <p style="font-size: 0.8em; color: #64748b;">
                  ${company.name}<br/>
                  ${company.address || ''}<br/>
                  ${company.phone || ''} | ${company.email || ''}
                </p>
              </div>
            `,
            attachments: [
              {
                filename: `${inv.type === 'Quote' ? 'Devis' : 'Facture'}_${inv.id}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
              }
            ]
          });
        }
      } catch (emailError) {
        console.error('Failed to send signed document email:', emailError);
      }
    }
    
    res.json(inv);
    } catch (dbError) {
      await req.db.query('ROLLBACK');
      console.error(`PUT /api/invoices/${id} - Database Error:`, dbError);
      throw dbError;
    }
  } catch (error) {
    console.error(`PUT /api/invoices/${id} - Catch Error:`, error);
    next(error);
  }
});

invoicesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Block deletion of certified invoices — same fiscal-consistency rule
    // as the PUT handler above.
    const check = await req.db.query(
      'SELECT "certificationNumber" FROM invoices WHERE id = $1 AND "companyId" = $2',
      [id, req.user!.companyId],
    );
    if (check.rows[0]?.certificationNumber) {
      return res.status(409).json({
        error: 'Cette facture a été certifiée DGID et ne peut plus être supprimée.',
      });
    }

    await req.db.query('BEGIN');
    await req.db.query('DELETE FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('DELETE FROM invoices WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    await req.db.query('COMMIT');
    
    res.status(204).send();
  } catch (error) {
    await req.db.query('ROLLBACK');
    next(error);
  }
});

/**
 * Inline PDF download of a single invoice. Embeds the DGID QR + certification
 * block when the invoice has been certified.
 */
invoicesRouter.get('/:id/pdf', async (req, res, next) => {
  try {
    const { id } = req.params;
    const invRes = await req.db.query('SELECT * FROM invoices WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    const invoice = invRes.rows[0];
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const itemsRes = await req.db.query('SELECT * FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    const items = itemsRes.rows;
    const companyRes = await req.db.query('SELECT * FROM companies WHERE id = $1', [req.user!.companyId]);
    const company = companyRes.rows[0];
    let contact: any = null;
    if (invoice.contactId) {
      const cRes = await req.db.query('SELECT * FROM contacts WHERE id = $1 AND "companyId" = $2', [invoice.contactId, req.user!.companyId]);
      contact = cRes.rows[0] || null;
    }

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(invoice.type === 'Quote' ? 'DEVIS' : 'FACTURE', 14, 22);
    doc.setFontSize(10);
    doc.text(`N°: ${invoice.id}`, 14, 30);
    doc.text(`Date: ${invoice.date || '-'}`, 14, 35);
    if (invoice.dueDate) doc.text(`Échéance: ${invoice.dueDate}`, 14, 40);

    doc.text('Émetteur:', 14, 55);
    doc.setFont(undefined, 'bold');
    doc.text(company.name || '', 14, 60);
    doc.setFont(undefined, 'normal');
    if (company.address) doc.text(company.address, 14, 65);
    if (company.email) doc.text(company.email, 14, 70);
    if (company.phone) doc.text(company.phone, 14, 75);
    if (company.niu) doc.text(`NIU: ${company.niu}`, 14, 80);

    if (contact) {
      doc.text('Adressé à:', 120, 55);
      doc.setFont(undefined, 'bold');
      doc.text(contact.name || '', 120, 60);
      doc.setFont(undefined, 'normal');
      if (contact.email) doc.text(contact.email, 120, 65);
      if (contact.phone) doc.text(contact.phone, 120, 70);
      if (contact.niu) doc.text(`NIU: ${contact.niu}`, 120, 75);
    }

    const tableData = items.map((item: any) => [
      (item.name || '') + (item.description ? `\n${item.description}` : ''),
      String(item.quantity ?? 0),
      `${Number(item.price || 0).toLocaleString()} ${company.currency || ''}`,
      `${item.tvaRate ?? 0}%`,
      `${Number((item.quantity || 0) * (item.price || 0)).toLocaleString()} ${company.currency || ''}`,
    ]);

    autoTable(doc, {
      startY: 90,
      head: [['Description', 'Qté', 'Prix Unitaire', 'TVA', 'Total HT']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [198, 40, 40] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 90;
    doc.text(`Total HT: ${Number(invoice.totalHT || 0).toLocaleString()} ${company.currency || ''}`, 140, finalY + 10);
    doc.text(`TVA: ${Number(invoice.tvaTotal || 0).toLocaleString()} ${company.currency || ''}`, 140, finalY + 15);
    doc.setFont(undefined, 'bold');
    doc.text(`Total TTC: ${Number(invoice.total || 0).toLocaleString()} ${company.currency || ''}`, 140, finalY + 20);
    doc.setFont(undefined, 'normal');

    // Manuscript signature block — only for signed quotes. The signature
    // artefact is stored in `signatureLink` as JSON (`{signerName, signatureDataUrl}`)
    // by the public signing endpoint or the in-app "Sign manually" flow.
    if (invoice.type === 'Quote' && invoice.status === 'Signed' && invoice.signatureLink) {
      try {
        let sig: { signerName?: string; signatureDataUrl?: string } | null = null;
        const raw = String(invoice.signatureLink);
        if (raw.startsWith('{')) {
          try { sig = JSON.parse(raw); } catch { sig = null; }
        } else if (raw.startsWith('data:image/')) {
          sig = { signatureDataUrl: raw };
        }
        if (sig?.signatureDataUrl) {
          const sigY = finalY + 32;
          doc.setFont(undefined, 'bold');
          doc.text('Signature électronique', 14, sigY);
          doc.setFont(undefined, 'normal');
          // Detect format from data URL prefix to pass to addImage.
          const fmt = /image\/png/i.test(raw) ? 'PNG' : /image\/jpeg/i.test(raw) ? 'JPEG' : 'PNG';
          doc.addImage(sig.signatureDataUrl, fmt, 14, sigY + 3, 50, 22);
          doc.setFontSize(8);
          if (sig.signerName) doc.text(`Signé par : ${sig.signerName}`, 70, sigY + 10);
          if (invoice.signedAt) {
            doc.text(`Date : ${new Date(invoice.signedAt).toLocaleString('fr-FR')}`, 70, sigY + 16);
          }
          doc.text('Signature à valeur juridique (eIDAS / OHADA)', 70, sigY + 22);
          doc.setFontSize(10);
        }
      } catch (err) {
        console.error('PDF signature embed failed:', err);
      }
    }

    // DGID/SFEC QR block
    if (invoice.certificationNumber) {
      try {
        // Prefer the official QR image returned by SFEC; otherwise generate
        // one locally from the qrPayload string.
        const officialQr = invoice.certificationPayload?.qrImage as string | undefined;
        const qrPayload = invoice.certificationPayload?.qrPayload || invoice.certificationNumber;
        const qrDataUrl = officialQr
          ? officialQr
          : await QRCode.toDataURL(String(qrPayload), { margin: 1, width: 140, errorCorrectionLevel: 'M' });
        const qrY = finalY + 30;
        doc.setFont(undefined, 'bold');
        doc.text('Certification SFEC / DGID', 14, qrY);
        doc.setFont(undefined, 'normal');
        doc.addImage(qrDataUrl, 'PNG', 14, qrY + 3, 28, 28);
        doc.setFontSize(8);
        doc.text(`N°: ${invoice.certificationNumber}`, 46, qrY + 10);
        if (invoice.certifiedAt) {
          doc.text(`Certifiée le: ${new Date(invoice.certifiedAt).toLocaleString('fr-FR')}`, 46, qrY + 16);
        }
        const src = invoice.certificationPayload?.source;
        const source = src === 'sfec' ? 'API SFEC (DGID Congo)' : src === 'dgid' ? 'API DGID (Congo)' : 'Signature locale (mode démo)';
        doc.text(`Source: ${source}`, 46, qrY + 22);
        doc.setFontSize(10);
      } catch (err) {
        console.error('PDF QR embed failed:', err);
      }
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.id}.pdf"`);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('GET /api/invoices/:id/pdf error', error);
    next(error);
  }
});



invoicesRouter.post('/:id/send-email', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 1. Fetch invoice and items
    const invoiceRes = await req.db.query('SELECT * FROM invoices WHERE id = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    const invoice = invoiceRes.rows[0];
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    
    const itemsRes = await req.db.query('SELECT * FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2', [id, req.user!.companyId]);
    const items = itemsRes.rows;
    
    // 2. Fetch contact
    const contactRes = await req.db.query('SELECT * FROM contacts WHERE id = $1 AND "companyId" = $2', [invoice.contactId, req.user!.companyId]);
    const contact = contactRes.rows[0];
    if (!contact || !contact.email) return res.status(400).json({ error: 'Contact email not found' });
    
    // 3. Fetch company
    const companyRes = await req.db.query('SELECT * FROM companies WHERE id = $1', [req.user!.companyId]);
    const company = companyRes.rows[0];
    
    // 4. Configure nodemailer (per-company tenant — demo mailbox for demos)
    const { transporter, from } = getMailerForCompany(company.type, company.name);
    
    const isQuote = invoice.type === 'Quote';
    const subject = isQuote ? `Devis ${invoice.id} - ${company.name}` : `Facture ${invoice.id} - ${company.name}`;
    
    // Use the public-facing base URL of the running deployment so the
    // signature link works in dev / preview / production. The `Origin` /
    // `Referer` of the request that triggered the email is a reliable
    // hint; fallback to env var, then a sensible default.
    const reqOrigin =
      (req.headers.origin as string | undefined) ||
      (req.headers.referer ? new URL(req.headers.referer as string).origin : undefined);
    const signatureBaseUrl =
      reqOrigin ||
      process.env.PUBLIC_BASE_URL ||
      process.env.REACT_APP_BACKEND_URL ||
      'https://smart-desk.pro';
    const signatureLink = invoice.signatureLink || (isQuote ? `${signatureBaseUrl}/sign-quote/${invoice.id}` : null);

    // Preserve user-entered whitespace + newlines (matches the product
    // creation form). HTML emails collapse whitespace by default, so we
    // escape the description and convert \n to <br/>.
    const escapeHtml = (s: string) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const formatDescription = (d: string) => escapeHtml(d).replace(/\r?\n/g, '<br/>');

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; white-space: pre-wrap;">
          <strong>${escapeHtml(item.name)}</strong>
          ${item.description ? `<br/><span style="font-size: 0.85em; color: #666; white-space: pre-wrap;">${formatDescription(item.description)}</span>` : ''}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.price.toLocaleString()} ${company.currency}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.quantity * item.price).toLocaleString()} ${company.currency}</td>
      </tr>
    `).join('');

    const mailOptions = {
      from,
      to: contact.email,
      subject: subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #4f46e5;">${isQuote ? 'Votre Devis' : 'Votre Facture'}</h2>
          <p>Bonjour ${contact.name},</p>
          <p>Veuillez trouver ci-joint les détails de votre ${isQuote ? 'devis' : 'facture'} <strong>${invoice.id}</strong>.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 8px; text-align: left;">Description</th>
                <th style="padding: 8px; text-align: center;">Qté</th>
                <th style="padding: 8px; text-align: right;">Prix Unitaire</th>
                <th style="padding: 8px; text-align: right;">Total HT</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="text-align: right; margin-top: 20px;">
            <p><strong>Total HT:</strong> ${invoice.totalHT.toLocaleString()} ${company.currency}</p>
            <p><strong>TVA:</strong> ${invoice.tvaTotal.toLocaleString()} ${company.currency}</p>
            <p style="font-size: 1.2em; color: #4f46e5;"><strong>Total TTC:</strong> ${invoice.total.toLocaleString()} ${company.currency}</p>
          </div>
          
          ${isQuote && signatureLink ? `
            <div style="margin-top: 30px; text-align: center;">
              <a href="${signatureLink}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Signer le devis en ligne</a>
            </div>
          ` : ''}
          
          <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;" />
          <p style="font-size: 0.8em; color: #64748b;">
            ${company.name}<br/>
            ${company.address || ''}<br/>
            ${company.phone || ''} | ${company.email || ''}
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    // Update status if it was Draft
    if (invoice.status === 'Draft') {
      await req.db.query('UPDATE invoices SET status = $1 WHERE id = $2 AND "companyId" = $3', ['Sent', id, req.user!.companyId]);
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
