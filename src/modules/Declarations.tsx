import React, { useMemo, useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  Link,
} from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Landmark,
  HeartHandshake,
  BarChart3,
  FileBadge,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Construction,
  TrendingUp,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useTranslation } from '../lib/i18n';

/* ------------------------------------------------------------------ *
 * Data model — 2026 Congo Finance Law declarations
 * ------------------------------------------------------------------ */

type Category = 'DGID' | 'CNSS' | 'INS' | 'Greffe';
type Status = 'done' | 'pending' | 'upcoming' | 'late';

type Declaration = {
  id: string;
  title: string;
  category: Category;
  dueDate: string; // ISO YYYY-MM-DD
  description?: string;
  legalRef?: string;
};

/**
 * Échéances fiscales et sociales de la République du Congo — année 2026.
 * Sources : Loi de Finances 2026, CGI révisé, Code CNSS, LOI-2026 Greffe.
 *
 * Les dates récurrentes mensuelles (TVA, IRPP, cotisations CNSS) sont
 * générées programmatiquement.
 */
const DECLARATIONS_2026: Declaration[] = (() => {
  const list: Declaration[] = [];
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];

  // Monthly — DGID: TVA + IRPP (salaires), due le 20 du mois suivant
  for (let m = 0; m < 12; m++) {
    const periodMonth = monthNames[m];
    const dueMonth = (m + 1) % 12;
    const dueYear = m + 1 === 12 ? 2027 : 2026;
    const dd = String(20).padStart(2, '0');
    const mm = String(dueMonth + 1).padStart(2, '0');
    list.push({
      id: `tva-${m}`,
      title: `TVA ${periodMonth}`,
      category: 'DGID',
      dueDate: `${dueYear}-${mm}-${dd}`,
      description:
        "Taxe sur la Valeur Ajoutée : déclaration et paiement de la TVA collectée le mois précédent.",
      legalRef: 'CGI art. 373 / LF 2026 art. 14',
    });
    list.push({
      id: `irpp-${m}`,
      title: `IRPP & IAS — salaires ${periodMonth}`,
      category: 'DGID',
      dueDate: `${dueYear}-${mm}-${dd}`,
      description:
        "Retenue à la source IRPP / IAS sur les salaires versés le mois précédent.",
      legalRef: 'CGI art. 46 / LF 2026 art. 17',
    });
  }

  // Patente — 30 janvier 2026
  list.push({
    id: 'patente-2026',
    title: 'Patente 2026',
    category: 'DGID',
    dueDate: '2026-01-30',
    description:
      "Déclaration annuelle de la contribution des patentes — activité commerciale et professionnelle.",
    legalRef: 'CGI art. 178 / LF 2026 art. 22',
  });

  // IS — acomptes provisionnels trimestriels (Congo: 20/03, 20/06, 20/09, 20/12)
  const isDates = [
    { d: '2026-03-20', q: 'T1' },
    { d: '2026-06-20', q: 'T2' },
    { d: '2026-09-20', q: 'T3' },
    { d: '2026-12-20', q: 'T4' },
  ];
  for (const { d, q } of isDates) {
    list.push({
      id: `is-${q.toLowerCase()}`,
      title: `IS — acompte ${q}`,
      category: 'DGID',
      dueDate: d,
      description:
        "Acompte provisionnel d'Impôt sur les Sociétés (25% du solde N-1).",
      legalRef: 'CGI art. 118 / LF 2026 art. 26',
    });
  }

  // IS — Déclaration annuelle et solde : 20 mai 2026 (exercice 2025)
  list.push({
    id: 'is-annuel',
    title: 'IS — Déclaration annuelle & solde (exercice 2025)',
    category: 'DGID',
    dueDate: '2026-05-20',
    description:
      "Dépôt de la liasse fiscale, bilan et compte de résultat. Paiement du solde IS.",
    legalRef: 'CGI art. 124 / LF 2026 art. 28',
  });

  // TOL / TSS — 30 avril
  list.push({
    id: 'tol-2026',
    title: 'TOL — Taxe sur Occupation des Locaux',
    category: 'DGID',
    dueDate: '2026-04-30',
    description: "Taxe due par tout occupant de locaux à usage professionnel.",
    legalRef: 'CGI art. 205 / LF 2026 art. 31',
  });

  // CNSS — cotisations mensuelles (due le 15 du mois suivant)
  for (let m = 0; m < 12; m++) {
    const periodMonth = monthNames[m];
    const dueMonth = (m + 1) % 12;
    const dueYear = m + 1 === 12 ? 2027 : 2026;
    list.push({
      id: `cnss-m-${m}`,
      title: `CNSS — cotisations ${periodMonth}`,
      category: 'CNSS',
      dueDate: `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}-15`,
      description:
        "Versement des cotisations sociales (part employeur + part salariale).",
      legalRef: 'Code CNSS art. 38',
    });
  }

  // CNSS — DNT trimestrielle (fin du mois suivant chaque trimestre)
  const dntDates = [
    { d: '2026-04-30', q: 'T1' },
    { d: '2026-07-31', q: 'T2' },
    { d: '2026-10-31', q: 'T3' },
    { d: '2027-01-31', q: 'T4' },
  ];
  for (const { d, q } of dntDates) {
    list.push({
      id: `cnss-dnt-${q.toLowerCase()}`,
      title: `CNSS — DNT ${q}`,
      category: 'CNSS',
      dueDate: d,
      description:
        "Déclaration Nominative Trimestrielle : liste des salariés et salaires cotisables.",
      legalRef: 'Code CNSS art. 42',
    });
  }

  // INS — Enquête annuelle
  list.push({
    id: 'ins-enquete',
    title: 'INS — Enquête annuelle des entreprises',
    category: 'INS',
    dueDate: '2026-03-31',
    description:
      "Déclaration statistique obligatoire : effectif, chiffre d'affaires, investissements.",
    legalRef: 'Arrêté INS n°12/MPPD/2025',
  });

  // INS — Enquête emploi semestrielle
  list.push({
    id: 'ins-emploi-s1',
    title: 'INS — Enquête emploi S1',
    category: 'INS',
    dueDate: '2026-07-15',
    description: "Déclaration des mouvements de personnel du 1er semestre.",
    legalRef: 'Arrêté INS n°12/MPPD/2025',
  });

  // Greffe — Dépôt des comptes annuels (exercice 2025)
  list.push({
    id: 'greffe-comptes',
    title: 'Greffe — Dépôt des comptes annuels 2025',
    category: 'Greffe',
    dueDate: '2026-06-30',
    description:
      "Dépôt obligatoire au Greffe du Tribunal de Commerce : bilan, compte de résultat, annexes.",
    legalRef: 'Acte uniforme OHADA / LF 2026',
  });

  // Greffe — Renouvellement RCCM
  list.push({
    id: 'greffe-rccm',
    title: 'Greffe — Renouvellement RCCM',
    category: 'Greffe',
    dueDate: '2026-12-31',
    description: 'Renouvellement annuel du Registre du Commerce et du Crédit Mobilier.',
    legalRef: 'Acte uniforme OHADA art. 35',
  });

  return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
})();

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const TODAY = new Date();

function computeStatus(dueIso: string): Status {
  const due = new Date(dueIso);
  const diffDays = Math.floor((due.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < -1) return 'late';
  if (diffDays < 0) return 'pending';
  if (diffDays <= 30) return 'upcoming';
  return 'pending';
}

const CATEGORY_META: Record<Category, { icon: any; color: string; softBg: string }> = {
  DGID: { icon: Landmark, color: '#B91C1C', softBg: '#FEE2E2' },
  CNSS: { icon: HeartHandshake, color: '#059669', softBg: '#D1FAE5' },
  INS: { icon: BarChart3, color: '#2563EB', softBg: '#DBEAFE' },
  Greffe: { icon: FileBadge, color: '#7C3AED', softBg: '#EDE9FE' },
};

const STATUS_META: Record<Status, { label: string; badgeCls: string; icon: any; dotCls: string }> = {
  done: {
    label: 'Terminée',
    badgeCls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    icon: CheckCircle2,
    dotCls: 'bg-emerald-500',
  },
  upcoming: {
    label: 'À venir',
    badgeCls: 'bg-amber-50 text-amber-700 border border-amber-200',
    icon: Clock,
    dotCls: 'bg-amber-500',
  },
  pending: {
    label: 'En attente',
    badgeCls: 'bg-slate-50 text-slate-700 border border-slate-200',
    icon: Clock,
    dotCls: 'bg-slate-400',
  },
  late: {
    label: 'En retard',
    badgeCls: 'bg-red-50 text-red-700 border border-red-200',
    icon: AlertCircle,
    dotCls: 'bg-red-600',
  },
};

function formatFr(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/* ------------------------------------------------------------------ *
 * Shared UI bits
 * ------------------------------------------------------------------ */

const StatusBadge = ({ status }: { status: Status }) => {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.badgeCls}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  );
};

const CategoryChip = ({ cat }: { cat: Category }) => {
  const { icon: Icon, color, softBg } = CATEGORY_META[cat];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ background: softBg, color }}
    >
      <Icon className="w-3 h-3" />
      {cat}
    </span>
  );
};

/* ------------------------------------------------------------------ *
 * Dashboard — graphs + KPIs
 * ------------------------------------------------------------------ */

const DeclarationsDashboard = () => {
  const [filterCat, setFilterCat] = useState<Category | 'ALL'>('ALL');

  const declarations = useMemo(
    () =>
      DECLARATIONS_2026.filter((d) => filterCat === 'ALL' || d.category === filterCat).map((d) => ({
        ...d,
        status: computeStatus(d.dueDate),
      })),
    [filterCat],
  );

  const counts = useMemo(() => {
    const c = { total: declarations.length, done: 0, pending: 0, upcoming: 0, late: 0 };
    for (const d of declarations) {
      c[d.status as keyof typeof c]++;
    }
    return c;
  }, [declarations]);

  // Monthly distribution for bar chart
  const monthlyData = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      month: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'][i],
      DGID: 0,
      CNSS: 0,
      INS: 0,
      Greffe: 0,
    }));
    for (const d of declarations) {
      const due = new Date(d.dueDate);
      if (due.getFullYear() === 2026) {
        buckets[due.getMonth()][d.category] += 1;
      }
    }
    return buckets;
  }, [declarations]);

  // Status pie chart data
  const pieData = useMemo(
    () => [
      { name: 'En retard', value: counts.late, color: '#DC2626' },
      { name: 'En attente', value: counts.pending, color: '#94A3B8' },
      { name: 'À venir (30j)', value: counts.upcoming, color: '#F59E0B' },
      { name: 'Terminées', value: counts.done, color: '#10B981' },
    ].filter((s) => s.value > 0),
    [counts],
  );

  const nextSix = useMemo(
    () =>
      [...declarations]
        .filter((d) => d.status === 'upcoming' || d.status === 'late' || d.status === 'pending')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 6),
    [declarations],
  );

  return (
    <div className="space-y-8" data-testid="declarations-dashboard">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Tableau de bord — Déclarations
          </h1>
          <p className="text-slate-500 mt-2 max-w-2xl">
            Analyse complète de vos obligations 2026 : DGID, CNSS, INS et Greffe —
            calibré sur la Loi de Finances de la République du Congo.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          <Filter className="w-4 h-4 text-slate-400 ml-2" />
          {(['ALL', 'DGID', 'CNSS', 'INS', 'Greffe'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              data-testid={`declarations-filter-${c}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterCat === c
                  ? 'bg-accent-red text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {c === 'ALL' ? 'Toutes' : c}
            </button>
          ))}
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total déclarations"
          value={counts.total}
          trend="Loi de Finances 2026"
          icon={LayoutDashboard}
          tone="neutral"
        />
        <KpiCard
          label="En retard"
          value={counts.late}
          trend="Action immédiate"
          icon={AlertCircle}
          tone="danger"
          testid="kpi-late"
        />
        <KpiCard
          label="À venir (30 jours)"
          value={counts.upcoming}
          trend="À préparer"
          icon={Clock}
          tone="warning"
          testid="kpi-upcoming"
        />
        <KpiCard
          label="En attente"
          value={counts.pending}
          trend="Planifiées"
          icon={TrendingUp}
          tone="info"
          testid="kpi-pending"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section
          className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6"
          data-testid="chart-monthly"
        >
          <h2 className="font-semibold text-slate-900 mb-1">Charge déclarative mensuelle</h2>
          <p className="text-xs text-slate-500 mb-4">
            Nombre d'obligations par mois et par organisme (échéances 2026).
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barCategoryGap={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="DGID" stackId="a" fill={CATEGORY_META.DGID.color} radius={[0, 0, 0, 0]} />
                <Bar dataKey="CNSS" stackId="a" fill={CATEGORY_META.CNSS.color} />
                <Bar dataKey="INS" stackId="a" fill={CATEGORY_META.INS.color} />
                <Bar dataKey="Greffe" stackId="a" fill={CATEGORY_META.Greffe.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section
          className="bg-white border border-slate-200 rounded-2xl p-6"
          data-testid="chart-status"
        >
          <h2 className="font-semibold text-slate-900 mb-1">Statut global</h2>
          <p className="text-xs text-slate-500 mb-4">
            Répartition en retard / à venir / en attente.
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Next 6 deadlines */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900">Prochaines échéances</h2>
            <p className="text-xs text-slate-500">Les 6 plus urgentes — priorisées par date</p>
          </div>
          <Link
            to="/declarations/calendar"
            data-testid="link-to-calendar"
            className="text-xs font-semibold text-accent-red hover:underline inline-flex items-center gap-1"
          >
            Voir le calendrier complet
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {nextSix.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Aucune échéance à traiter dans les prochains jours.
            </p>
          ) : (
            nextSix.map((d) => {
              const { icon: Icon, softBg, color } = CATEGORY_META[d.category];
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
                      style={{ background: softBg }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{d.title}</p>
                      <p className="text-xs text-slate-500 truncate">
                        Échéance : {formatFr(d.dueDate)} • {d.legalRef}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

const KpiCard = ({
  label,
  value,
  trend,
  icon: Icon,
  tone,
  testid,
}: {
  label: string;
  value: number;
  trend: string;
  icon: any;
  tone: 'danger' | 'warning' | 'info' | 'neutral';
  testid?: string;
}) => {
  const toneCls = {
    danger: 'bg-red-50 text-red-600',
    warning: 'bg-amber-50 text-amber-600',
    info: 'bg-blue-50 text-blue-600',
    neutral: 'bg-slate-50 text-slate-600',
  }[tone];
  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-5"
      data-testid={testid}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${toneCls}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
      <p className="text-xs font-medium text-slate-500 mt-1">{label}</p>
      <p className="text-[10px] text-slate-400 mt-1">{trend}</p>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Calendar — Congo 2026 Finance Law driven
 * ------------------------------------------------------------------ */

const DeclarationsCalendar = () => {
  const [month, setMonth] = useState(0); // 0 = Jan 2026
  const [catFilter, setCatFilter] = useState<Category | 'ALL'>('ALL');

  const monthNames = [
    'Janvier 2026', 'Février 2026', 'Mars 2026', 'Avril 2026',
    'Mai 2026', 'Juin 2026', 'Juillet 2026', 'Août 2026',
    'Septembre 2026', 'Octobre 2026', 'Novembre 2026', 'Décembre 2026',
  ];

  const eventsInMonth = useMemo(() => {
    return DECLARATIONS_2026.filter((d) => {
      const dt = new Date(d.dueDate);
      if (dt.getFullYear() !== 2026) return false;
      if (dt.getMonth() !== month) return false;
      if (catFilter !== 'ALL' && d.category !== catFilter) return false;
      return true;
    }).map((d) => ({ ...d, status: computeStatus(d.dueDate) }));
  }, [month, catFilter]);

  // Build calendar grid (weeks x days) for the selected month.
  const { weeks, year, monthIdx } = useMemo(() => {
    const year = 2026;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstWeekday = (firstDay.getDay() + 6) % 7; // Monday=0
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { weeks, year, monthIdx: month };
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map: Record<number, Declaration[]> = {};
    for (const ev of eventsInMonth) {
      const day = new Date(ev.dueDate).getDate();
      if (!map[day]) map[day] = [];
      map[day].push(ev);
    }
    return map;
  }, [eventsInMonth]);

  return (
    <div className="space-y-6" data-testid="declarations-calendar">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <CalendarIcon className="w-7 h-7 text-accent-red" />
            Calendrier 2026
          </h1>
          <p className="text-slate-500 mt-2 max-w-2xl">
            Échéances fiscales, sociales et statutaires basées sur la{' '}
            <strong>Loi de Finances de la République du Congo 2026</strong>.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          <Filter className="w-4 h-4 text-slate-400 ml-2" />
          {(['ALL', 'DGID', 'CNSS', 'INS', 'Greffe'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              data-testid={`calendar-filter-${c}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                catFilter === c
                  ? 'bg-accent-red text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {c === 'ALL' ? 'Toutes' : c}
            </button>
          ))}
        </div>
      </header>

      {/* Month nav */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4">
        <button
          onClick={() => setMonth((m) => Math.max(0, m - 1))}
          disabled={month === 0}
          data-testid="calendar-prev-month"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Précédent
        </button>
        <h2 className="text-lg font-semibold text-slate-900" data-testid="calendar-month-label">
          {monthNames[month]}
        </h2>
        <button
          onClick={() => setMonth((m) => Math.min(11, m + 1))}
          disabled={month === 11}
          data-testid="calendar-next-month"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Suivant
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 overflow-x-auto">
        <div className="grid grid-cols-7 gap-1 min-w-[700px]">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
            <div
              key={d}
              className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center py-2"
            >
              {d}
            </div>
          ))}
          {weeks.flat().map((day, i) => {
            if (day === null) return <div key={i} className="h-24" />;
            const dayEvents = eventsByDay[day] || [];
            const isToday =
              TODAY.getFullYear() === year &&
              TODAY.getMonth() === monthIdx &&
              TODAY.getDate() === day;
            return (
              <div
                key={i}
                data-testid={`calendar-day-${day}`}
                className={`h-24 border rounded-lg p-1.5 overflow-hidden transition-all hover:border-accent-red/40 ${
                  isToday
                    ? 'border-accent-red bg-accent-red/5'
                    : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`text-xs font-semibold ${
                      isToday ? 'text-accent-red' : 'text-slate-600'
                    }`}
                  >
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[9px] font-bold text-slate-400">
                      {dayEvents.length}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((ev) => {
                    const { color } = CATEGORY_META[ev.category];
                    return (
                      <div
                        key={ev.id}
                        title={ev.title}
                        className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white font-medium"
                        style={{ background: color }}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <div className="text-[9px] text-slate-500 font-medium pl-1">
                      +{dayEvents.length - 2} autres
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event list for the month */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-900 mb-4">
          Détails — {monthNames[month]}{' '}
          <span className="text-sm font-normal text-slate-500">
            ({eventsInMonth.length} échéance{eventsInMonth.length > 1 ? 's' : ''})
          </span>
        </h2>
        {eventsInMonth.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            Aucune échéance ce mois-ci avec le filtre actuel.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {eventsInMonth.map((ev) => {
              const { icon: Icon, color, softBg } = CATEGORY_META[ev.category];
              return (
                <div
                  key={ev.id}
                  data-testid={`calendar-event-${ev.id}`}
                  className="py-3 first:pt-0 last:pb-0 flex items-start gap-3"
                >
                  <span
                    className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
                    style={{ background: softBg }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{ev.title}</p>
                      <CategoryChip cat={ev.category} />
                      <StatusBadge status={ev.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Échéance : <strong>{formatFr(ev.dueDate)}</strong>
                      {ev.legalRef && <> • Réf. : {ev.legalRef}</>}
                    </p>
                    {ev.description && (
                      <p className="text-xs text-slate-600 mt-1">{ev.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Coming-soon placeholder for DGID / CNSS / INS / Greffe
 * ------------------------------------------------------------------ */

const ComingSoonModule = ({
  title,
  icon: Icon,
  description,
  testid,
}: {
  title: string;
  icon: any;
  description: string;
  testid: string;
}) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex items-center justify-center" data-testid={testid}>
      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-3xl p-10 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-accent-red/10 flex items-center justify-center mb-6">
          <Icon className="w-8 h-8 text-accent-red" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-widest mb-4">
          <Construction className="w-3.5 h-3.5" />
          Bientôt disponible
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-3">{title}</h1>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">{description}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/declarations')}
            data-testid={`${testid}-back-dashboard`}
            className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-medium transition-colors"
          >
            ← Tableau de bord
          </button>
          <button
            onClick={() => navigate('/declarations/calendar')}
            data-testid={`${testid}-to-calendar`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-red text-white text-sm font-medium hover:bg-accent-red/90 transition-colors"
          >
            Voir le calendrier
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

export const Declarations = () => {
  const location = useLocation();
  void location.pathname;

  return (
    <Routes>
      <Route index element={<DeclarationsDashboard />} />
      <Route path="calendar" element={<DeclarationsCalendar />} />
      <Route
        path="dgid"
        element={
          <ComingSoonModule
            title="DGID — Direction Générale des Impôts et des Domaines"
            icon={Landmark}
            description="Ce module permettra bientôt de gérer et transmettre vos déclarations TVA, IRPP, IS et patente directement depuis SmartDesk, avec génération automatique des formulaires et paiements en ligne."
            testid="declarations-dgid-coming-soon"
          />
        }
      />
      <Route
        path="cnss"
        element={
          <ComingSoonModule
            title="CNSS — Caisse Nationale de Sécurité Sociale"
            icon={HeartHandshake}
            description="Préparez, signez et transmettez vos Déclarations Nominatives Trimestrielles (DNT) et cotisations mensuelles employeur/salarié. Module en cours de développement."
            testid="declarations-cnss-coming-soon"
          />
        }
      />
      <Route
        path="ins"
        element={
          <ComingSoonModule
            title="INS — Institut National de la Statistique"
            icon={BarChart3}
            description="Enquêtes annuelles et semestrielles : effectif, chiffre d'affaires, investissements. Transmission automatisée prévue dans la prochaine version."
            testid="declarations-ins-coming-soon"
          />
        }
      />
      <Route
        path="greffe"
        element={
          <ComingSoonModule
            title="Greffe — Tribunal de Commerce"
            icon={FileBadge}
            description="Dépôt des comptes annuels, renouvellement RCCM, modifications statutaires OHADA. Intégration avec le portail du Greffe de Brazzaville à venir."
            testid="declarations-greffe-coming-soon"
          />
        }
      />
      <Route path="*" element={<Navigate to="/declarations" replace />} />
    </Routes>
  );
};
