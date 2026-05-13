/**
 * Invoice / quote PDF builder.
 *
 * Centralised because both the GET /:id/pdf endpoint and the "mark
 * quote as paid → email PDF to client" automation need it.
 *
 * Returns a Node Buffer ready to write as a Response body or attach
 * to a nodemailer mailOptions.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

type DB = { query: (...args: any[]) => Promise<any> };

export async function buildInvoicePdfBuffer(
  db: DB,
  invoiceId: string,
  companyId: string,
): Promise<{ buffer: Buffer; invoice: any; company: any; contact: any | null } | null> {
  const invRes = await db.query(
    'SELECT * FROM invoices WHERE id = $1 AND "companyId" = $2',
    [invoiceId, companyId],
  );
  const invoice = invRes.rows[0];
  if (!invoice) return null;

  const itemsRes = await db.query(
    'SELECT * FROM invoice_items WHERE "invoiceId" = $1 AND "companyId" = $2',
    [invoiceId, companyId],
  );
  const items = itemsRes.rows;
  const companyRes = await db.query('SELECT * FROM companies WHERE id = $1', [companyId]);
  const company = companyRes.rows[0] || {};
  let contact: any = null;
  if (invoice.contactId) {
    const cRes = await db.query(
      'SELECT * FROM contacts WHERE id = $1 AND "companyId" = $2',
      [invoice.contactId, companyId],
    );
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
  let yCursor = finalY + 10;
  const cur = company.currency || '';
  const fmtAmount = (n: number) => `${Math.round(Number(n || 0)).toLocaleString()} ${cur}`;
  doc.text(`Brut HT: ${fmtAmount(invoice.totalHT)}`, 140, yCursor); yCursor += 5;

  const reductions: Array<[string, number, string]> = [
    ['Rabais', invoice.rabais, invoice.rabaisType],
    ['Remise', invoice.remise || invoice.discount, invoice.remiseType],
    ['Ristourne', invoice.ristourne, invoice.ristourneType],
    ['Escompte', invoice.escompte, invoice.escompteType],
  ];
  for (const [label, value, type] of reductions) {
    const v = Number(value) || 0;
    if (v > 0) {
      const display = type === 'percent' ? `${v}%` : fmtAmount(v);
      doc.text(`${label}: -${display}`, 140, yCursor); yCursor += 5;
    }
  }
  if (invoice.netCommercial && invoice.netCommercial !== invoice.totalHT) {
    doc.text(`Net commercial: ${fmtAmount(invoice.netCommercial)}`, 140, yCursor); yCursor += 5;
  }
  if (invoice.netFinancier && invoice.netFinancier !== invoice.netCommercial) {
    doc.text(`Net financier: ${fmtAmount(invoice.netFinancier)}`, 140, yCursor); yCursor += 5;
  }
  doc.text(`TVA: ${fmtAmount(invoice.tvaTotal)}`, 140, yCursor); yCursor += 5;
  if (Number(invoice.centimesAdditionnels) > 0) {
    doc.text(`Centimes additionnels (5% TVA): ${fmtAmount(invoice.centimesAdditionnels)}`, 140, yCursor);
    yCursor += 5;
  }
  doc.setFont(undefined, 'bold');
  doc.text(`Total TTC: ${fmtAmount(invoice.total)}`, 140, yCursor);
  doc.setFont(undefined, 'normal');

  // Manuscript signature block (signed quotes)
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
  return { buffer: pdfBuffer, invoice, company, contact };
}
