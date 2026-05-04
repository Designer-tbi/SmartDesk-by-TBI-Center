import React from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Payslip } from '../../types';

interface Props {
  payslips: Payslip[];
  currencySymbol: string;
  getEmployeeName: (id: string) => string;
  downloadingPayslipId: string | null;
  t: (key: string) => string;
  onOpenPayrollModal: () => void;
  onDownload: (payslip: Payslip) => void;
  onToggleStatus: (payslip: Payslip) => void;
  onDelete: (id: string) => void;
}

export const PayrollTab: React.FC<Props> = ({
  payslips,
  currencySymbol,
  getEmployeeName,
  downloadingPayslipId,
  t,
  onOpenPayrollModal,
  onDownload,
  onToggleStatus,
  onDelete,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">Gestion de la Paie</h3>
        <button
          onClick={onOpenPayrollModal}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm"
          data-testid="hr-generate-payroll-btn"
        >
          <Download className="w-4 h-4" /> Générer les Bulletins
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.employee')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.period')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.netSalary')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.status')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">{t('hr.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payslips.map((payslip) => (
              <tr key={payslip.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-slate-900">{getEmployeeName(payslip.employeeId)}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {payslip.month} {payslip.year}
                </td>
                <td className="px-6 py-4 font-bold text-slate-900">
                  {payslip.netSalary.toLocaleString()} {currencySymbol}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onToggleStatus(payslip)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold hover:opacity-80 transition-opacity ${
                      payslip.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}
                    title="Cliquer pour changer le statut"
                    data-testid={`hr-payslip-toggle-${payslip.id}`}
                  >
                    {payslip.status === 'Paid' ? t('hr.paid') : t('hr.draft')}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onDownload(payslip)}
                      disabled={downloadingPayslipId === payslip.id}
                      className="p-2 text-slate-400 hover:text-accent-red hover:bg-soft-red rounded-lg transition-all"
                      title="Télécharger le bulletin"
                      data-testid={`hr-payslip-download-${payslip.id}`}
                    >
                      {downloadingPayslipId === payslip.id ? (
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-accent-red rounded-full animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => onDelete(payslip.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Supprimer"
                      data-testid={`hr-payslip-delete-${payslip.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
