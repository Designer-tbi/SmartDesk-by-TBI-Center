import { Router } from 'express';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { requireTenant } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import {
  computeLine, computeTotals, CnssLineInput, CnssAdjustments,
} from '../services/cnssCalc.js';

export const cnssRouter = Router();

cnssRouter.use(...requireTenant);
// Payroll-derived declarations are as sensitive as payslips themselves.
cnssRouter.use(requirePermission('hr.payroll'));

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const splitName = (fullName: string): { prenom: string; nom: string } => {
  const parts = String(fullName || '').trim().split(/\s+/);
  if (parts.length <= 1) return { prenom: parts[0] || '', nom: '' };
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
};

/**
 * Seeds the review table: active employees +, when a payslip already
 * exists for that period, its baseSalary/bonuses as starting values. The
 * accountant reviews/completes/corrects everything (name split, CNSS
 * number, pay components) before generating the official documents —
 * this is deliberately not a blind auto-fill.
 */
cnssRouter.get('/data', async (req, res, next) => {
  try {
    const month = parseInt(String(req.query.month || ''), 10);
    const year = parseInt(String(req.query.year || ''), 10);
    if (!month || month < 1 || month > 12 || !year) {
      return res.status(400).json({ error: 'Paramètres month (1-12) et year requis.' });
    }

    const [empRes, payslipRes, compRes] = await Promise.all([
      req.db.query(
        `SELECT * FROM employees WHERE "companyId" = $1 AND status = 'Active' ORDER BY name ASC`,
        [req.user!.companyId],
      ),
      req.db.query(
        `SELECT * FROM payslips WHERE "companyId" = $1 AND year = $2 AND month::int = $3`,
        [req.user!.companyId, year, month],
      ),
      req.db.query('SELECT * FROM public.companies WHERE id = $1', [req.user!.companyId]),
    ]);

    const payslipByEmployee = new Map<string, any>();
    for (const p of payslipRes.rows) payslipByEmployee.set(p.employeeId, p);

    const lines = empRes.rows.map((e: any) => {
      const { prenom, nom } = splitName(e.name);
      const payslip = payslipByEmployee.get(e.id);
      return {
        employeeId: e.id,
        matriculeSolde: e.matriculeSolde || '',
        cnssNumber: e.cnssNumber || '',
        nom,
        postNom: e.postNom || '',
        prenom,
        workerType: e.workerType === 'Stagiaire' ? 'Stagiaire' : 'Travailleur',
        department: e.department || '',
        joursTravailles: 26,
        heuresTravaillees: 0,
        salaireBase: Number(payslip?.baseSalary ?? e.salary ?? 0),
        indemniteVieChere: 0,
        primes: Number(payslip?.bonuses ?? 0),
        gratifications: 0,
        allocationsConges: 0,
        avantagesNature: 0,
        autresPrimes: 0,
        autresIndemnites: 0,
        // Full employee row, so the frontend can PUT it back to
        // /api/employees/:id (a full-object update) after the accountant
        // edits postNom/cnssNumber/matriculeSolde/workerType/department here.
        employee: {
          ...e,
          documents: e.documents ? JSON.parse(e.documents) : [],
        },
      };
    });

    const company = compRes.rows[0] || {};
    res.json({
      period: { month, year, label: `${MONTHS_FR[month - 1]} ${year}` },
      company: {
        name: company.name || '',
        cnssEmployerNumber: company.cnssEmployerNumber || '',
        address: company.address || '',
        phone: company.phone || '',
        currency: company.currency || 'XAF',
      },
      lines,
    });
  } catch (error) {
    next(error);
  }
});

function parseBody(req: any): { month: number; year: number; lines: CnssLineInput[]; adjustments: Partial<CnssAdjustments> } {
  const { month, year, lines, adjustments } = req.body || {};
  if (!Array.isArray(lines) || lines.length === 0) {
    throw Object.assign(new Error('Aucune ligne employé fournie.'), { status: 400 });
  }
  return {
    month: parseInt(String(month), 10),
    year: parseInt(String(year), 10),
    lines,
    adjustments: adjustments || {},
  };
}

async function getCompany(req: any) {
  const compRes = await req.db.query('SELECT * FROM public.companies WHERE id = $1', [req.user!.companyId]);
  return compRes.rows[0] || {};
}

const periodDateStr = (month: number, year: number) => `01/${String(month).padStart(2, '0')}/${year}`;

cnssRouter.post('/export/cnss.xlsx', async (req, res, next) => {
  try {
    const { month, year, lines } = parseBody(req);
    const computed = lines.map(computeLine);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feuil1');
    const headers = [
      'Matricule solde', 'Immatriculation numéro CNSS', 'Noms', 'Post noms', 'Prenoms',
      'Type travailleur (1=Travailleur , 2=Stagiaire)', 'Département ou Commune affectation',
      'Periode Cotisee (jj/mm/aaaa)', 'Salaire brut global', 'Salaire soumis à cotisation CNSS',
      'Montant Cotisation Déclarée', 'Nombre de Jours travaillés', 'Nombre heures travaillées',
    ];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    const periode = periodDateStr(month, year);
    for (const l of computed) {
      sheet.addRow([
        l.matriculeSolde, l.cnssNumber, l.nom, l.postNom, l.prenom,
        l.workerType === 'Stagiaire' ? 2 : 1, l.department,
        periode, l.salaireBrutGlobal, l.salaireSoumisCnss,
        l.montantCotisationCnss, l.joursTravailles, l.heuresTravaillees,
      ]);
    }
    sheet.columns.forEach((col) => { col.width = 22; });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Declaration_Mensuelle_CNSS_${month}-${year}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

cnssRouter.post('/export/tus.xlsx', async (req, res, next) => {
  try {
    const { month, year, lines } = parseBody(req);
    const computed = lines.map(computeLine);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feuil1');
    const headers = [
      'Matricule solde', 'Immatriculation numéro CNSS', 'Noms', 'Post noms', 'Prenoms',
      'Type travailleur (1=Travailleur , 2=Stagiaire)', 'Département ou Commune affectation',
      'Periode Cotisee (jj/mm/aaaa)', 'Salaire brut global', 'Montant Déclaration TUS',
      'Nombre de Jours travaillés',
    ];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    const periode = periodDateStr(month, year);
    for (const l of computed) {
      sheet.addRow([
        l.matriculeSolde, l.cnssNumber, l.nom, l.postNom, l.prenom,
        l.workerType === 'Stagiaire' ? 2 : 1, l.department,
        periode, l.salaireBrutGlobal, l.montantTus, l.joursTravailles,
      ]);
    }
    sheet.columns.forEach((col) => { col.width = 22; });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Declaration_Mensuelle_TUS_${month}-${year}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

cnssRouter.post('/export/detail.pdf', async (req, res, next) => {
  try {
    const { month, year, lines } = parseBody(req);
    const computed = lines.map(computeLine);
    const company = await getCompany(req);

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('ANNEXE : DÉTAILS DE LA FEUILLE DE PAIE', 14, 18);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`${MONTHS_FR[month - 1]} ${year}`, 14, 25);
    doc.text(`Employeur : ${company.name || ''}${company.cnssEmployerNumber ? ` — N° Affiliation : ${company.cnssEmployerNumber}` : ''}`, 14, 31);

    const fmt = (n: number) => Math.round(n || 0).toLocaleString('fr-FR');
    const rows = computed.map((l) => [
      l.matriculeSolde, l.prenom, l.postNom, l.nom,
      fmt(l.salaireBase), fmt(l.indemniteVieChere), fmt(l.primes), fmt(l.gratifications),
      fmt(l.allocationsConges), fmt(l.avantagesNature), fmt(l.autresPrimes), fmt(l.autresIndemnites),
    ]);

    autoTable(doc, {
      startY: 38,
      head: [['Matricule', 'Prénom', 'Post Nom', 'Nom', 'Salaire de Base', 'Indemnités vie chère', 'Primes', 'Gratifications', 'Alloc. congés', 'Avantages nature', 'Autres primes', 'Autres indemnités']],
      body: rows,
      styles: { fontSize: 6.5, cellPadding: 1.5 },
      headStyles: { fillColor: [220, 38, 38], fontSize: 6.5 },
      theme: 'grid',
    });

    doc.setFontSize(7);
    doc.text('*: Sommer les autres indemnités.', 14, (doc as any).lastAutoTable.finalY + 8);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Detail_feuille_de_paie_${month}-${year}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

cnssRouter.post('/export/globale.pdf', async (req, res, next) => {
  try {
    const { month, year, lines, adjustments } = parseBody(req);
    const computed = lines.map(computeLine);
    const totals = computeTotals(computed, adjustments);
    const company = await getCompany(req);
    const cur = company.currency || 'XAF';
    const fmt = (n: number) => `${Math.round(n || 0).toLocaleString('fr-FR')} ${cur}`;

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('DÉCLARATION GLOBALE DE COTISATION', 14, 18);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Période : ${MONTHS_FR[month - 1]} ${year}`, 14, 26);
    doc.text(`Raison sociale : ${company.name || ''}`, 14, 32);
    doc.text(`Matricule employeur : ${company.cnssEmployerNumber || ''}`, 14, 38);
    doc.text(`Effectif déclaré : ${totals.effectif}`, 14, 44);
    doc.text(`Salaire brut déplafonné : ${fmt(totals.salaireBrutDeplafonne)}`, 14, 50);

    autoTable(doc, {
      startY: 58,
      head: [['Rubrique', 'Montant']],
      body: [
        ['TUS (3% du salaire brut déplafonné)', fmt(totals.tus)],
        ['Majoration TUS', fmt(totals.majorationTus)],
        ['Sous-total (1)', fmt(totals.sousTotal1)],
        ['CNSS — Assurance vieillesse (12%, plafond 1 200 000)', fmt(totals.cnssPension)],
        ['CNSS — AT/MP/PF (12,28%, plafond 600 000)', fmt(totals.cnssAtmpPf)],
        ['Majoration CNSS', fmt(totals.majorationCnss)],
        ['Pénalité', fmt(totals.penalite)],
        ['Déduction sur avis de crédit', `- ${fmt(totals.deductionAvisCredit)}`],
        ['Sous-total (2)', fmt(totals.sousTotal2)],
        ['TOTAL À PAYER (1) + (2)', fmt(totals.totalAPayer)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [220, 38, 38] },
      columnStyles: { 1: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.row.index === 2 || data.row.index === 8 || data.row.index === 9) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    doc.setFontSize(9);
    doc.text(`Adresse : ${company.address || ''}`, 14, finalY + 12);
    doc.text(`N° téléphone : ${company.phone || ''}`, 14, finalY + 18);
    if (totals.acompte) doc.text(`Montant de l'acompte : ${fmt(totals.acompte)}`, 14, finalY + 24);

    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(
      'NB : Joindre impérativement l\'état nominatif des salaires (Annexe) ou effectuer la télédéclaration.',
      14, finalY + 34, { maxWidth: 180 },
    );

    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.text(`Fait à ${company.city || ''}, le ${new Date().toLocaleDateString('fr-FR')}`, 14, finalY + 48);
    doc.text('Signature et cachet', 140, finalY + 48);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Declaration_Globale_Cotisation_${month}-${year}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

/** Live totals preview (no file generation) — used by the frontend summary panel. */
cnssRouter.post('/preview', async (req, res, next) => {
  try {
    const { lines, adjustments } = parseBody(req);
    const computed = lines.map(computeLine);
    const totals = computeTotals(computed, adjustments);
    res.json({ lines: computed, totals });
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});
