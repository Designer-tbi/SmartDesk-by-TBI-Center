import React from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';

/**
 * "Mes déclarations" — central place to manage the administrative
 * obligations of the company (DGID, CNSS, INS, Greffe).
 *
 * For now every sub-module is a functional placeholder that explains
 * what will live there. It wires up the sidebar navigation, routing
 * and tab-aware header. Real integrations (DGID e-Impôts, CNSS portal…)
 * will slot in later as dedicated services.
 */

type DeclarationModule = {
  key: string;
  path: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  deadlines?: { label: string; due: string; status: 'ok' | 'soon' | 'late' }[];
};

const MODULES: DeclarationModule[] = [
  {
    key: 'dgid',
    path: '/declarations/dgid',
    labelKey: 'nav.declarations.dgid',
    icon: Landmark,
    description:
      "Déclarations fiscales auprès de la Direction Générale des Impôts et des Domaines : TVA, IS, IRPP, retenues à la source.",
    deadlines: [
      { label: 'TVA mensuelle', due: '15 du mois suivant', status: 'soon' },
      { label: 'Acompte IS', due: '15 mars / 15 juin / 15 sept. / 15 déc.', status: 'ok' },
      { label: 'IRPP employés', due: '15 du mois suivant', status: 'ok' },
    ],
  },
  {
    key: 'cnss',
    path: '/declarations/cnss',
    labelKey: 'nav.declarations.cnss',
    icon: HeartHandshake,
    description:
      "Caisse Nationale de Sécurité Sociale : cotisations employeur / salarié, déclarations nominatives trimestrielles.",
    deadlines: [
      { label: 'DNT trimestrielle', due: '15 du mois suivant le trimestre', status: 'ok' },
      { label: 'Cotisations sociales', due: '15 du mois suivant', status: 'soon' },
    ],
  },
  {
    key: 'ins',
    path: '/declarations/ins',
    labelKey: 'nav.declarations.ins',
    icon: BarChart3,
    description:
      "Institut National de la Statistique : enquêtes annuelles de branche, déclarations statistiques d'emploi.",
    deadlines: [
      { label: 'Enquête annuelle', due: '31 mars', status: 'ok' },
    ],
  },
  {
    key: 'greffe',
    path: '/declarations/greffe',
    labelKey: 'nav.declarations.greffe',
    icon: FileBadge,
    description:
      "Greffe du Tribunal de commerce : dépôt des comptes annuels, modifications statutaires, extraits RCCM.",
    deadlines: [
      { label: 'Dépôt des comptes annuels', due: '30 juin', status: 'ok' },
    ],
  },
];

const STATUS_STYLES: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  soon: 'bg-amber-50 text-amber-700 border border-amber-200',
  late: 'bg-red-50 text-red-700 border border-red-200',
};

const StatusBadge = ({ status }: { status: 'ok' | 'soon' | 'late' }) => {
  const Icon = status === 'ok' ? CheckCircle2 : status === 'soon' ? Clock : AlertCircle;
  const label = status === 'ok' ? 'À jour' : status === 'soon' ? 'À venir' : 'En retard';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};

const DeclarationsDashboard = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-8" data-testid="declarations-dashboard">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          {t('nav.section.declarations')}
        </h1>
        <p className="text-slate-500 mt-2">
          Centralisez toutes vos obligations déclaratives : impôts, charges sociales,
          statistiques et dépôts légaux.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {MODULES.map((m) => (
          <Link
            key={m.key}
            to={m.path}
            data-testid={`declarations-card-${m.key}`}
            className="group relative bg-white border border-slate-200 rounded-2xl p-5 hover:border-accent-red hover:shadow-xl hover:shadow-accent-red/5 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-accent-red/10 flex items-center justify-center">
                <m.icon className="w-5 h-5 text-accent-red" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-accent-red group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1.5">{t(m.labelKey)}</h3>
            <p className="text-xs text-slate-500 line-clamp-3">{m.description}</p>
          </Link>
        ))}
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-accent-red" />
          Prochaines échéances
        </h2>
        <div className="divide-y divide-slate-100">
          {MODULES.flatMap((m) =>
            (m.deadlines || []).map((d, i) => (
              <div
                key={`${m.key}-${i}`}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 shrink-0 rounded-lg bg-slate-50 flex items-center justify-center">
                    <m.icon className="w-4 h-4 text-slate-500" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {d.label}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {t(m.labelKey)} — Échéance : {d.due}
                    </p>
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </div>
            )),
          )}
        </div>
      </section>
    </div>
  );
};

const DeclarationsCalendar = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6" data-testid="declarations-calendar">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <CalendarIcon className="w-7 h-7 text-accent-red" />
          {t('nav.declarations.calendar')}
        </h1>
        <p className="text-slate-500 mt-2">
          Vue chronologique des échéances fiscales, sociales et statutaires.
        </p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <ol className="relative border-l-2 border-slate-100 ml-3 space-y-6">
          {MODULES.flatMap((m) =>
            (m.deadlines || []).map((d, i) => (
              <li key={`${m.key}-${i}`} className="ml-6">
                <span className="absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full bg-accent-red ring-4 ring-white" />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{d.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t(m.labelKey)} — {d.due}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              </li>
            )),
          )}
        </ol>
      </div>
    </div>
  );
};

const DeclarationPage = ({ module }: { module: DeclarationModule }) => {
  const { t } = useTranslation();
  const Icon = module.icon;
  return (
    <div className="space-y-6" data-testid={`declarations-page-${module.key}`}>
      <header className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-accent-red/10 flex items-center justify-center shrink-0">
          <Icon className="w-7 h-7 text-accent-red" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {t(module.labelKey)}
          </h1>
          <p className="text-slate-500 mt-1 max-w-3xl">{module.description}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Déclarations en cours</h2>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
            <p className="text-sm text-slate-500">
              Aucune déclaration enregistrée pour l'instant.
            </p>
            <button
              type="button"
              data-testid={`declarations-new-${module.key}`}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-red text-white text-sm font-medium hover:bg-accent-red/90 transition-colors"
            >
              Nouvelle déclaration
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        <aside className="bg-white border border-slate-200 rounded-2xl p-6 h-fit">
          <h2 className="font-semibold text-slate-900 mb-4">Échéances types</h2>
          <ul className="space-y-3">
            {(module.deadlines || []).map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{d.label}</p>
                  <p className="text-xs text-slate-500">{d.due}</p>
                </div>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
};

export const Declarations = () => {
  const location = useLocation();
  // Force a remount on sub-route change so exit/enter animations play nicely.
  void location.pathname;

  return (
    <Routes>
      <Route index element={<DeclarationsDashboard />} />
      <Route path="calendar" element={<DeclarationsCalendar />} />
      {MODULES.map((m) => (
        <Route
          key={m.key}
          path={m.key}
          element={<DeclarationPage module={m} />}
        />
      ))}
      <Route path="*" element={<Navigate to="/declarations" replace />} />
    </Routes>
  );
};
