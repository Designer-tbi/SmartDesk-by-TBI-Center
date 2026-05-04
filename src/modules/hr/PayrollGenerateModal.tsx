import React from 'react';
import { X } from 'lucide-react';
import { Employee, Payslip } from '../../types';

interface Props {
  open: boolean;
  employees: Employee[];
  payslips: Payslip[];
  payrollMonth: number;
  setPayrollMonth: (m: number) => void;
  payrollYear: number;
  setPayrollYear: (y: number) => void;
  payrollError: string | null;
  generatingPayroll: boolean;
  onClose: () => void;
  onGenerate: () => void;
}

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export const PayrollGenerateModal: React.FC<Props> = ({
  open,
  employees,
  payslips,
  payrollMonth,
  setPayrollMonth,
  payrollYear,
  setPayrollYear,
  payrollError,
  generatingPayroll,
  onClose,
  onGenerate,
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm"
      data-testid="hr-payroll-modal"
    >
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900">Générer les bulletins</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {payrollError && (
            <div
              className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600"
              data-testid="hr-payroll-error"
            >
              {payrollError}
            </div>
          )}
          <p className="text-sm text-slate-600 leading-relaxed">
            Un bulletin sera généré automatiquement pour chaque employé, à partir du salaire de son contrat actif. Pour
            les sociétés congolaises, les retenues CNSS (4 %) et IRPP (barème 2025) sont calculées automatiquement.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mois</label>
              <select
                className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(Number(e.target.value))}
                data-testid="hr-payroll-month"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Année</label>
              <input
                type="number"
                className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                value={payrollYear}
                onChange={(e) => setPayrollYear(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
            Employés éligibles : <strong className="text-slate-900">{employees.length}</strong>
            {' • '}Déjà traités pour cette période :{' '}
            <strong className="text-slate-900">
              {payslips.filter((p) => p.month === payrollMonth && p.year === payrollYear).length}
            </strong>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generatingPayroll}
            className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60"
            data-testid="hr-payroll-confirm-btn"
          >
            {generatingPayroll ? 'Génération…' : 'Générer'}
          </button>
        </div>
      </div>
    </div>
  );
};
