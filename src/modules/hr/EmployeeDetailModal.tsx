/**
 * Employee detail modal with cross-module tabs.
 *
 * Surfaces all records attached to the employee (contracts, payslips,
 * leave requests, tasks) with clickable entries that navigate to the
 * correct module tab, so the HR admin gets a 360° view without
 * having to jump between tabs manually.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Mail, Phone, MapPin, Calendar, Briefcase, DollarSign,
  FileText, Receipt, Coffee, CheckSquare, Loader2, ExternalLink,
  Download,
} from 'lucide-react';
import { Employee, Contract, Payslip, LeaveRequest, EmployeeTask } from '../../types';

type Tab = 'info' | 'contracts' | 'payslips' | 'leaves' | 'tasks';

interface Props {
  employee: Employee;
  contracts: Contract[];
  payslips: Payslip[];
  leaves: LeaveRequest[];
  tasks: EmployeeTask[];
  currencySymbol: string;
  onClose: () => void;
  onOpenContract?: (id: string) => void;
}

const STATUS_CLASS: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  slate: 'bg-slate-100 text-slate-500 border-slate-200',
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  red: 'bg-red-50 text-red-600 border-red-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
};

const statusColor = (status: string): keyof typeof STATUS_CLASS => {
  const s = String(status).toLowerCase();
  if (s === 'paid' || s === 'signed' || s === 'active' || s === 'approved' || s === 'completed') return 'emerald';
  if (s === 'draft' || s === 'todo') return 'slate';
  if (s === 'in progress' || s === 'sent') return 'blue';
  if (s === 'rejected' || s === 'cancelled') return 'red';
  return 'amber';
};

export const EmployeeDetailModal: React.FC<Props> = ({
  employee, contracts, payslips, leaves, tasks, currencySymbol, onClose, onOpenContract,
}) => {
  const [tab, setTab] = useState<Tab>('info');
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { setReady(true); }, []);

  const empContracts = contracts.filter((c) => c.employeeId === employee.id);
  const empPayslips = payslips.filter((p) => p.employeeId === employee.id);
  const empLeaves = leaves.filter((l) => l.employeeId === employee.id);
  const empTasks = tasks.filter((t) => t.employeeId === employee.id);

  const navTo = (path: string) => { onClose(); navigate(path); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" data-testid="hr-employee-detail-modal">
      <div className={`bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col transition-all ${ready ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {/* Banner + avatar */}
        <div className="relative h-28 bg-accent-red shrink-0">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-md transition-all"
            data-testid="hr-detail-close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute -bottom-10 left-8 p-1 bg-white rounded-3xl shadow-lg">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl font-black text-accent-red overflow-hidden border border-slate-100">
              {employee.profilePicture ? (
                <img src={employee.profilePicture} alt="" className="w-full h-full object-cover" />
              ) : (
                employee.name.charAt(0)
              )}
            </div>
          </div>
        </div>

        <div className="pt-12 px-8 pb-3 shrink-0">
          <h3 className="text-xl font-black text-slate-900">{employee.name}</h3>
          <p className="text-accent-red font-bold text-sm">{employee.role} • {employee.department}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-8 shrink-0 overflow-x-auto">
          {[
            { key: 'info' as Tab, label: 'Informations', icon: Mail, count: null },
            { key: 'contracts' as Tab, label: 'Contrats', icon: FileText, count: empContracts.length },
            { key: 'payslips' as Tab, label: 'Bulletins', icon: Receipt, count: empPayslips.length },
            { key: 'leaves' as Tab, label: 'Congés', icon: Coffee, count: empLeaves.length },
            { key: 'tasks' as Tab, label: 'Tâches', icon: CheckSquare, count: empTasks.length },
          ].map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors ${
                tab === key ? 'border-accent-red text-accent-red' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
              data-testid={`hr-detail-tab-${key}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== null && count > 0 && (
                <span className={`px-1.5 rounded-full text-[10px] ${tab === key ? 'bg-accent-red/10 text-accent-red' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {tab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Row icon={Mail} text={employee.email} />
                <Row icon={Phone} text={employee.phone || 'Non renseigné'} />
                <Row icon={MapPin} text={employee.address || 'Non renseignée'} />
              </div>
              <div className="space-y-3">
                <Row icon={Calendar} text={`Arrivée : ${employee.joinDate}`} />
                <Row icon={Briefcase} text={`Contrat : ${employee.contractType}`} />
                <Row icon={DollarSign} text={`${Number(employee.salary || 0).toLocaleString()} ${currencySymbol} / an`} emphasis />
              </div>
              {employee.documents && employee.documents.length > 0 && (
                <div className="md:col-span-2 pt-4 border-t border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Documents joints</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {employee.documents.map((doc, idx) => (
                      <a
                        key={idx}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all group"
                      >
                        <div className="p-2 bg-white rounded-lg text-slate-400 group-hover:text-accent-red transition-colors">
                          <Download className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-600 truncate">{doc.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'contracts' && (
            <List items={empContracts} empty="Aucun contrat.">
              {(c) => (
                <RelatedRow
                  key={c.id}
                  title={`${c.type} — ${c.id}`}
                  subtitle={`Du ${c.startDate}${c.endDate ? ` au ${c.endDate}` : ''} • ${Number(c.salary || 0).toLocaleString()} ${currencySymbol}`}
                  statusLabel={c.status}
                  statusColor={statusColor(c.status)}
                  onClick={() => onOpenContract ? onOpenContract(c.id) : navTo('/hr')}
                  testId={`hr-related-contract-${c.id}`}
                />
              )}
            </List>
          )}

          {tab === 'payslips' && (
            <List items={empPayslips} empty="Aucun bulletin.">
              {(p) => (
                <RelatedRow
                  key={p.id}
                  title={`${p.month}/${p.year}`}
                  subtitle={`Net : ${Number(p.netSalary || 0).toLocaleString()} ${currencySymbol}`}
                  statusLabel={p.status}
                  statusColor={statusColor(p.status)}
                  onClick={() => navTo('/hr')}
                  testId={`hr-related-payslip-${p.id}`}
                />
              )}
            </List>
          )}

          {tab === 'leaves' && (
            <List items={empLeaves} empty="Aucune demande de congé.">
              {(l) => (
                <RelatedRow
                  key={l.id}
                  title={l.type}
                  subtitle={`Du ${l.startDate} au ${l.endDate}`}
                  statusLabel={l.status}
                  statusColor={statusColor(l.status)}
                  onClick={() => navTo('/hr')}
                  testId={`hr-related-leave-${l.id}`}
                />
              )}
            </List>
          )}

          {tab === 'tasks' && (
            <List items={empTasks} empty="Aucune tâche.">
              {(tk) => (
                <RelatedRow
                  key={tk.id}
                  title={tk.title}
                  subtitle={tk.date ? `Le ${tk.date}` : '—'}
                  statusLabel={tk.status}
                  statusColor={statusColor(tk.status)}
                  onClick={() => navTo('/hr')}
                  testId={`hr-related-task-${tk.id}`}
                />
              )}
            </List>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- helpers ---------- */

const Row: React.FC<{ icon: React.ComponentType<any>; text: string; emphasis?: boolean }> = ({ icon: Icon, text, emphasis }) => (
  <div className={`flex items-center gap-3 ${emphasis ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
    <Icon className={`w-4 h-4 ${emphasis ? 'text-emerald-500' : 'text-slate-400'}`} />
    <span className="text-sm font-medium">{text}</span>
  </div>
);

function List<T>({ items, empty, children }: { items: T[]; empty: string; children: (x: T) => React.ReactNode }) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
        {empty}
      </div>
    );
  }
  return <div className="space-y-2">{items.map(children)}</div>;
}

const RelatedRow: React.FC<{
  title: string;
  subtitle: string;
  statusLabel: string;
  statusColor: keyof typeof STATUS_CLASS;
  onClick: () => void;
  testId?: string;
}> = ({ title, subtitle, statusLabel, statusColor: sc, onClick, testId }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className="w-full flex items-center justify-between gap-3 p-4 bg-white border border-slate-200 hover:border-accent-red hover:shadow-md rounded-2xl text-left transition-all group"
  >
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-slate-900 truncate">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
    </div>
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${STATUS_CLASS[sc]}`}>{statusLabel}</span>
    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-accent-red transition-colors shrink-0" />
  </button>
);
