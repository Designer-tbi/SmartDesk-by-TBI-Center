/**
 * Phase 4 — Cross-module dashboard widgets.
 *
 * Consumes the extended `/api/stats` payload to surface the most
 * actionable signals across the whole CRM on the dashboard:
 * outstanding & overdue invoices, top 5 clients by revenue,
 * upcoming leaves, contracts expiring soon, low-stock products,
 * pending leave approvals.
 *
 * Each card is clickable and routes into the relevant module.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Clock, Users, Coffee, FileWarning, Package,
  ArrowRight, TrendingUp,
} from 'lucide-react';

interface Stats {
  outstanding?: { count: number; total: number; overdueCount: number; overdueTotal: number };
  topClients?: Array<{ id: string; name: string; company?: string; revenue: number; invoices: number }>;
  upcomingLeaves?: Array<{ id: string; employeeId: string; employeeName: string; type: string; startDate: string; endDate: string }>;
  expiringContracts?: Array<{ id: string; type: string; endDate: string; employeeId: string; employeeName: string }>;
  lowStock?: Array<{ id: string; name: string; stock: number; minStock: number }>;
  pendingLeaves?: number;
}

interface Props {
  stats: Stats;
  currencySymbol: string;
}

export const DashboardWidgets: React.FC<Props> = ({ stats, currencySymbol }) => {
  const navigate = useNavigate();

  const outstanding = stats.outstanding || { count: 0, total: 0, overdueCount: 0, overdueTotal: 0 };
  const topClients = stats.topClients || [];
  const upcomingLeaves = stats.upcomingLeaves || [];
  const expiringContracts = stats.expiringContracts || [];
  const lowStock = stats.lowStock || [];
  const pendingLeaves = stats.pendingLeaves || 0;

  return (
    <div className="space-y-6">
      {/* Alert strip — overdue / pending actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AlertCard
          testId="dash-widget-overdue"
          icon={AlertTriangle}
          color="red"
          title="Factures en retard"
          value={`${outstanding.overdueCount}`}
          subtitle={`${Number(outstanding.overdueTotal).toLocaleString()} ${currencySymbol} à recouvrer`}
          onClick={() => navigate('/sales')}
        />
        <AlertCard
          testId="dash-widget-outstanding"
          icon={Clock}
          color="amber"
          title="En attente de paiement"
          value={`${outstanding.count}`}
          subtitle={`${Number(outstanding.total).toLocaleString()} ${currencySymbol} facturé`}
          onClick={() => navigate('/sales')}
        />
        <AlertCard
          testId="dash-widget-pending-leaves"
          icon={Coffee}
          color="slate"
          title="Congés à valider"
          value={`${pendingLeaves}`}
          subtitle={pendingLeaves > 0 ? "Demandes en attente d'approbation" : 'Rien en attente'}
          onClick={() => navigate('/hr')}
        />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Clients */}
        <Panel
          testId="dash-widget-top-clients"
          title="Top 5 Clients"
          subtitle="Par chiffre d'affaires encaissé"
          icon={TrendingUp}
          onSeeAll={() => navigate('/crm')}
        >
          {topClients.length === 0 ? (
            <EmptyState label="Aucun client pour le moment." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {topClients.map((c, idx) => (
                <li key={c.id}>
                  <button
                    onClick={() => navigate('/crm')}
                    data-testid={`dash-top-client-${c.id}`}
                    className="w-full flex items-center gap-4 py-3 hover:bg-slate-50 rounded-xl px-3 -mx-3 transition-colors text-left"
                  >
                    <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent-red/10 text-accent-red text-xs font-black">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.company || '—'} • {c.invoices} facture(s) payée(s)</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-slate-900">{Number(c.revenue).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">{currencySymbol}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Upcoming leaves */}
        <Panel
          testId="dash-widget-upcoming-leaves"
          title="Congés à venir (14j)"
          subtitle="Planning équipe"
          icon={Users}
          onSeeAll={() => navigate('/hr')}
        >
          {upcomingLeaves.length === 0 ? (
            <EmptyState label="Aucun congé planifié." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingLeaves.map((l) => (
                <li key={l.id} className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{l.employeeName || l.employeeId}</p>
                    <p className="text-xs text-slate-500">{l.type} • Du {l.startDate} au {l.endDate}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Expiring contracts */}
        <Panel
          testId="dash-widget-expiring-contracts"
          title="Contrats arrivant à échéance (30j)"
          subtitle="CDD à renouveler"
          icon={FileWarning}
          onSeeAll={() => navigate('/hr')}
        >
          {expiringContracts.length === 0 ? (
            <EmptyState label="Aucune échéance dans les 30 jours." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {expiringContracts.map((c) => (
                <li key={c.id} className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <FileWarning className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{c.employeeName || c.employeeId}</p>
                    <p className="text-xs text-slate-500">{c.type} • Fin le {c.endDate}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Low stock */}
        <Panel
          testId="dash-widget-low-stock"
          title="Stock à recommander"
          subtitle="Sous le seuil minimum"
          icon={Package}
          onSeeAll={() => navigate('/inventory')}
        >
          {lowStock.length === 0 ? (
            <EmptyState label="Tous les stocks sont au-dessus du seuil." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStock.map((p) => (
                <li key={p.id} className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">Stock : {p.stock} / mini : {p.minStock}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
};

/* -------------------- UI building blocks -------------------- */

const COLOR_CLASS: Record<string, { bg: string; text: string; border: string }> = {
  red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
};

const AlertCard: React.FC<{
  testId?: string;
  icon: React.ComponentType<any>;
  color: keyof typeof COLOR_CLASS;
  title: string;
  value: string;
  subtitle: string;
  onClick: () => void;
}> = ({ testId, icon: Icon, color, title, value, subtitle, onClick }) => {
  const c = COLOR_CLASS[color];
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`text-left p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${c.bg} ${c.text}`}>
          <Icon className="w-5 h-5" />
        </div>
        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
      </div>
      <p className={`text-3xl font-black ${c.text}`}>{value}</p>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </button>
  );
};

const Panel: React.FC<{
  title: string;
  subtitle?: string;
  icon: React.ComponentType<any>;
  onSeeAll?: () => void;
  testId?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, icon: Icon, onSeeAll, testId, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-testid={testId}>
    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent-red/10 text-accent-red rounded-lg">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-sm font-black text-slate-900">{title}</h4>
          {subtitle && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{subtitle}</p>}
        </div>
      </div>
      {onSeeAll && (
        <button onClick={onSeeAll} className="text-[10px] font-bold text-accent-red uppercase tracking-widest hover:underline flex items-center gap-1">
          Voir tout <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <p className="py-6 text-center text-sm text-slate-400">{label}</p>
);
