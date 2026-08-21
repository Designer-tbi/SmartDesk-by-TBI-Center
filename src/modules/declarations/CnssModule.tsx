import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartHandshake, Download, RefreshCw, Save, ChevronLeft, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

interface CnssLine {
  employeeId: string;
  matriculeSolde: string;
  cnssNumber: string;
  nom: string;
  postNom: string;
  prenom: string;
  workerType: 'Travailleur' | 'Stagiaire';
  department: string;
  joursTravailles: number;
  heuresTravaillees: number;
  salaireBase: number;
  indemniteVieChere: number;
  primes: number;
  gratifications: number;
  allocationsConges: number;
  avantagesNature: number;
  autresPrimes: number;
  autresIndemnites: number;
  employee: any;
}

interface CnssTotals {
  effectif: number;
  salaireBrutDeplafonne: number;
  tus: number;
  majorationTus: number;
  sousTotal1: number;
  cnssPension: number;
  cnssAtmpPf: number;
  majorationCnss: number;
  penalite: number;
  deductionAvisCredit: number;
  sousTotal2: number;
  totalAPayer: number;
  acompte: number;
}

interface Adjustments {
  majorationTus: number;
  majorationCnss: number;
  penalite: number;
  deductionAvisCredit: number;
  acompte: number;
}

const NUMBER_FIELDS: Array<{ key: keyof CnssLine; label: string }> = [
  { key: 'salaireBase', label: 'Salaire de base' },
  { key: 'indemniteVieChere', label: 'Indemnités vie chère' },
  { key: 'primes', label: 'Primes' },
  { key: 'gratifications', label: 'Gratifications' },
  { key: 'allocationsConges', label: 'Alloc. congés' },
  { key: 'avantagesNature', label: 'Avantages nature' },
  { key: 'autresPrimes', label: 'Autres primes' },
  { key: 'autresIndemnites', label: 'Autres indemnités' },
];

const stripLineForApi = (l: CnssLine) => {
  const { employee, ...rest } = l;
  return rest;
};

const fmt = (n: number, cur = 'XAF') => `${Math.round(n || 0).toLocaleString('fr-FR')} ${cur}`;

export const CnssModule: React.FC = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<{ name: string; cnssEmployerNumber: string; currency: string } | null>(null);
  const [lines, setLines] = useState<CnssLine[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustments>({
    majorationTus: 0, majorationCnss: 0, penalite: 0, deductionAvisCredit: 0, acompte: 0,
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch(`/api/declarations/cnss/data?month=${month}&year=${year}`);
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || `Échec du chargement (HTTP ${r.status}).`);
      }
      const data = await r.json();
      setCompany(data.company);
      setLines(data.lines);
    } catch (err: any) {
      setError(err.message || 'Échec du chargement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cur = company?.currency || 'XAF';

  const computedTotals: CnssTotals = useMemo(() => {
    const computed = lines.map((l) => {
      const salaireBrutGlobal = Math.round(
        Number(l.salaireBase || 0) + Number(l.indemniteVieChere || 0) + Number(l.primes || 0) +
        Number(l.gratifications || 0) + Number(l.allocationsConges || 0) + Number(l.avantagesNature || 0) +
        Number(l.autresPrimes || 0) + Number(l.autresIndemnites || 0),
      );
      return salaireBrutGlobal;
    });
    const salaireBrutDeplafonne = computed.reduce((a, b) => a + b, 0);
    const tus = Math.round(computed.reduce((a, b) => a + b * 0.03, 0));
    const cnssPension = Math.round(computed.reduce((a, b) => a + Math.min(b, 1_200_000) * 0.12, 0));
    const cnssAtmpPf = Math.round(computed.reduce((a, b) => a + Math.min(b, 600_000) * 0.1228, 0));
    const sousTotal1 = Math.round(tus + adjustments.majorationTus);
    const sousTotal2 = Math.round(cnssPension + cnssAtmpPf + adjustments.majorationCnss + adjustments.penalite - adjustments.deductionAvisCredit);
    const totalAPayer = Math.round(sousTotal1 + sousTotal2);
    return {
      effectif: lines.length,
      salaireBrutDeplafonne,
      tus,
      majorationTus: adjustments.majorationTus,
      sousTotal1,
      cnssPension,
      cnssAtmpPf,
      majorationCnss: adjustments.majorationCnss,
      penalite: adjustments.penalite,
      deductionAvisCredit: adjustments.deductionAvisCredit,
      sousTotal2,
      totalAPayer,
      acompte: adjustments.acompte,
    };
  }, [lines, adjustments]);

  const updateLine = (employeeId: string, patch: Partial<CnssLine>) => {
    setLines((prev) => prev.map((l) => (l.employeeId === employeeId ? { ...l, ...patch } : l)));
  };

  const handleSaveEmployees = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const l of lines) {
        const fullName = [l.prenom, l.nom].filter(Boolean).join(' ').trim() || l.employee.name;
        await apiFetch(`/api/employees/${l.employeeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...l.employee,
            name: fullName,
            department: l.department,
            postNom: l.postNom,
            cnssNumber: l.cnssNumber,
            matriculeSolde: l.matriculeSolde,
            workerType: l.workerType,
          }),
        });
      }
    } catch (err: any) {
      setError(err.message || 'Échec de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (kind: 'cnss.xlsx' | 'tus.xlsx' | 'detail.pdf' | 'globale.pdf') => {
    setExporting(kind);
    setError(null);
    try {
      const r = await apiFetch(`/api/declarations/cnss/export/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, lines: lines.map(stripLineForApi), adjustments }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || `Échec de l'export (HTTP ${r.status}).`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = r.headers.get('content-disposition') || '';
      const m = cd.match(/filename="([^"]+)"/);
      a.download = m ? m[1] : `cnss-${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Échec de l'export.");
    } finally {
      setExporting(null);
    }
  };

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-6" data-testid="declarations-cnss-module">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/declarations')}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors"
            data-testid="declarations-cnss-back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 rounded-2xl bg-accent-red/10 flex items-center justify-center">
            <HeartHandshake className="w-5 h-5 text-accent-red" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Déclaration Mensuelle CNSS &amp; TUS</h1>
            <p className="text-xs text-slate-400">{company?.name || ''}{company?.cnssEmployerNumber ? ` — Matricule employeur : ${company.cnssEmployerNumber}` : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            data-testid="declarations-cnss-month"
          >
            {MONTHS_FR.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            data-testid="declarations-cnss-year"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            data-testid="declarations-cnss-load"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Charger
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {!company && !loading && !error && (
        <div className="p-8 text-center text-slate-400 text-sm">Sélectionnez une période puis cliquez sur « Charger ».</div>
      )}

      {company && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">Annexe — Détail de la feuille de paie ({lines.length} salarié{lines.length > 1 ? 's' : ''})</h2>
              <button
                onClick={handleSaveEmployees}
                disabled={saving || lines.length === 0}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50"
                data-testid="declarations-cnss-save-employees"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Enregistrer les fiches employés
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="px-3 py-2 text-left">Matricule solde</th>
                    <th className="px-3 py-2 text-left">N° CNSS</th>
                    <th className="px-3 py-2 text-left">Prénom</th>
                    <th className="px-3 py-2 text-left">Post-nom</th>
                    <th className="px-3 py-2 text-left">Nom</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Département</th>
                    <th className="px-3 py-2 text-right">Jours</th>
                    {NUMBER_FIELDS.map((f) => (
                      <th key={f.key} className="px-3 py-2 text-right">{f.label}</th>
                    ))}
                    <th className="px-3 py-2 text-right bg-slate-100">Brut global</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => {
                    const brut = NUMBER_FIELDS.reduce((acc, f) => acc + Number(l[f.key] as number || 0), 0);
                    return (
                      <tr key={l.employeeId} className="hover:bg-slate-50">
                        <td className="px-2 py-1.5">
                          <input className="w-24 px-2 py-1 rounded border border-slate-200" value={l.matriculeSolde}
                            onChange={(e) => updateLine(l.employeeId, { matriculeSolde: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-28 px-2 py-1 rounded border border-slate-200" value={l.cnssNumber}
                            onChange={(e) => updateLine(l.employeeId, { cnssNumber: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-24 px-2 py-1 rounded border border-slate-200" value={l.prenom}
                            onChange={(e) => updateLine(l.employeeId, { prenom: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-24 px-2 py-1 rounded border border-slate-200" value={l.postNom}
                            onChange={(e) => updateLine(l.employeeId, { postNom: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-24 px-2 py-1 rounded border border-slate-200" value={l.nom}
                            onChange={(e) => updateLine(l.employeeId, { nom: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <select className="px-2 py-1 rounded border border-slate-200" value={l.workerType}
                            onChange={(e) => updateLine(l.employeeId, { workerType: e.target.value as CnssLine['workerType'] })}>
                            <option value="Travailleur">Travailleur</option>
                            <option value="Stagiaire">Stagiaire</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-28 px-2 py-1 rounded border border-slate-200" value={l.department}
                            onChange={(e) => updateLine(l.employeeId, { department: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" className="w-14 px-2 py-1 rounded border border-slate-200 text-right" value={l.joursTravailles}
                            onChange={(e) => updateLine(l.employeeId, { joursTravailles: Number(e.target.value) })} />
                        </td>
                        {NUMBER_FIELDS.map((f) => (
                          <td key={f.key} className="px-2 py-1.5">
                            <input type="number" className="w-24 px-2 py-1 rounded border border-slate-200 text-right"
                              value={l[f.key] as number}
                              onChange={(e) => updateLine(l.employeeId, { [f.key]: Number(e.target.value) } as Partial<CnssLine>)} />
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right font-bold bg-slate-50">{fmt(brut, cur)}</td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr><td colSpan={9 + NUMBER_FIELDS.length} className="px-3 py-8 text-center text-slate-400">Aucun employé actif pour cette période.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-slate-700 mb-4">Déclaration Globale de Cotisation — {MONTHS_FR[month - 1]} {year}</h2>
              <dl className="text-sm space-y-2">
                <div className="flex justify-between"><dt className="text-slate-500">Effectif déclaré</dt><dd className="font-medium">{computedTotals.effectif}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Salaire brut déplafonné</dt><dd className="font-medium">{fmt(computedTotals.salaireBrutDeplafonne, cur)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">TUS (3%)</dt><dd className="font-medium">{fmt(computedTotals.tus, cur)}</dd></div>
                <AdjustmentRow label="Majoration TUS" value={adjustments.majorationTus} onChange={(v) => setAdjustments((a) => ({ ...a, majorationTus: v }))} />
                <div className="flex justify-between pt-1 border-t border-slate-100"><dt className="font-bold text-slate-700">Sous-total (1)</dt><dd className="font-bold">{fmt(computedTotals.sousTotal1, cur)}</dd></div>
                <div className="flex justify-between pt-2"><dt className="text-slate-500">CNSS vieillesse (12%, plafond 1 200 000)</dt><dd className="font-medium">{fmt(computedTotals.cnssPension, cur)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">CNSS AT/MP/PF (12,28%, plafond 600 000)</dt><dd className="font-medium">{fmt(computedTotals.cnssAtmpPf, cur)}</dd></div>
                <AdjustmentRow label="Majoration CNSS" value={adjustments.majorationCnss} onChange={(v) => setAdjustments((a) => ({ ...a, majorationCnss: v }))} />
                <AdjustmentRow label="Pénalité" value={adjustments.penalite} onChange={(v) => setAdjustments((a) => ({ ...a, penalite: v }))} />
                <AdjustmentRow label="Déduction sur avis de crédit" value={adjustments.deductionAvisCredit} onChange={(v) => setAdjustments((a) => ({ ...a, deductionAvisCredit: v }))} />
                <div className="flex justify-between pt-1 border-t border-slate-100"><dt className="font-bold text-slate-700">Sous-total (2)</dt><dd className="font-bold">{fmt(computedTotals.sousTotal2, cur)}</dd></div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-base"><dt className="font-black text-slate-900">Total à payer (1)+(2)</dt><dd className="font-black text-accent-red">{fmt(computedTotals.totalAPayer, cur)}</dd></div>
                <AdjustmentRow label="Montant de l'acompte (optionnel)" value={adjustments.acompte} onChange={(v) => setAdjustments((a) => ({ ...a, acompte: v }))} />
              </dl>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-slate-700 mb-4">Exports officiels</h2>
              <div className="space-y-3">
                <ExportButton
                  icon={FileSpreadsheet}
                  label="Model Déclaration Mensuelle CNSS (.xlsx)"
                  loading={exporting === 'cnss.xlsx'}
                  disabled={lines.length === 0}
                  onClick={() => handleExport('cnss.xlsx')}
                  testid="declarations-cnss-export-cnss"
                />
                <ExportButton
                  icon={FileSpreadsheet}
                  label="Model Déclaration Mensuelle TUS (.xlsx)"
                  loading={exporting === 'tus.xlsx'}
                  disabled={lines.length === 0}
                  onClick={() => handleExport('tus.xlsx')}
                  testid="declarations-cnss-export-tus"
                />
                <ExportButton
                  icon={FileText}
                  label="Détail de la feuille de paie (.pdf)"
                  loading={exporting === 'detail.pdf'}
                  disabled={lines.length === 0}
                  onClick={() => handleExport('detail.pdf')}
                  testid="declarations-cnss-export-detail"
                />
                <ExportButton
                  icon={FileText}
                  label="Déclaration Globale de Cotisation (.pdf)"
                  loading={exporting === 'globale.pdf'}
                  disabled={lines.length === 0}
                  onClick={() => handleExport('globale.pdf')}
                  testid="declarations-cnss-export-globale"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-4">
                Enregistrez le PDF « Détail de la feuille de paie » avant de le charger sur la plateforme de télédéclaration CNSS, avec les deux fichiers .xlsx et la Déclaration Globale de Cotisation.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const AdjustmentRow: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="flex justify-between items-center">
    <dt className="text-slate-500">{label}</dt>
    <dd>
      <input
        type="number"
        className="w-28 px-2 py-1 text-right rounded border border-slate-200 text-sm"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </dd>
  </div>
);

const ExportButton: React.FC<{
  icon: any; label: string; loading: boolean; disabled: boolean; onClick: () => void; testid: string;
}> = ({ icon: Icon, label, loading, disabled, onClick, testid }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    data-testid={testid}
    className="w-full inline-flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-luxury-gray hover:bg-slate-100 text-slate-700 text-sm font-medium transition-colors disabled:opacity-50"
  >
    <span className="inline-flex items-center gap-2"><Icon className="w-4 h-4 text-accent-red" />{label}</span>
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
  </button>
);
