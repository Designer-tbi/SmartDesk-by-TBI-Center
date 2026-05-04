import React from 'react';
import { Filter, Plus, CheckCircle, Clock, AlertCircle, X } from 'lucide-react';
import { LeaveRequest } from '../../types';

interface Props {
  leaves: LeaveRequest[];
  getEmployeeName: (id: string) => string;
  manageLeaveId: string | null;
  setManageLeaveId: (id: string | null) => void;
  onOpenLeaveModal: () => void;
  onUpdateStatus: (leave: LeaveRequest, status: 'Approved' | 'Rejected' | 'Pending') => void;
  onDelete: (id: string) => void;
}

export const LeavesTab: React.FC<Props> = ({
  leaves,
  getEmployeeName,
  manageLeaveId,
  setManageLeaveId,
  onOpenLeaveModal,
  onUpdateStatus,
  onDelete,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">Demandes de Congés</h3>
        <div className="flex gap-2">
          <button className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenLeaveModal}
            className="flex items-center gap-2 px-4 py-2 bg-accent-red text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all shadow-sm"
            data-testid="hr-add-leave-btn"
          >
            <Plus className="w-4 h-4" /> Nouvelle Demande
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Employé</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Période</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Statut</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leaves.map((leave) => (
              <tr key={leave.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-slate-900">{getEmployeeName(leave.employeeId)}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">{leave.type}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs text-slate-600">Du {leave.startDate}</div>
                  <div className="text-xs text-slate-600">Au {leave.endDate}</div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 w-fit ${
                      leave.status === 'Approved'
                        ? 'bg-emerald-50 text-emerald-600'
                        : leave.status === 'Pending'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {leave.status === 'Approved' ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : leave.status === 'Pending' ? (
                      <Clock className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    {leave.status === 'Approved' ? 'Approuvé' : leave.status === 'Pending' ? 'En attente' : 'Refusé'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setManageLeaveId(manageLeaveId === leave.id ? null : leave.id);
                    }}
                    className="text-xs font-bold text-accent-red hover:underline"
                    data-testid={`hr-leave-manage-${leave.id}`}
                  >
                    Gérer
                  </button>
                  {manageLeaveId === leave.id && (
                    <div
                      className="absolute right-4 top-12 z-30 w-48 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`hr-leave-manage-menu-${leave.id}`}
                    >
                      {leave.status !== 'Approved' && (
                        <button
                          onClick={() => onUpdateStatus(leave, 'Approved')}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" /> Approuver
                        </button>
                      )}
                      {leave.status !== 'Rejected' && (
                        <button
                          onClick={() => onUpdateStatus(leave, 'Rejected')}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <AlertCircle className="w-4 h-4" /> Refuser
                        </button>
                      )}
                      {leave.status !== 'Pending' && (
                        <button
                          onClick={() => onUpdateStatus(leave, 'Pending')}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                        >
                          <Clock className="w-4 h-4" /> Remettre en attente
                        </button>
                      )}
                      <div className="border-t border-slate-100" />
                      <button
                        onClick={() => onDelete(leave.id)}
                        className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" /> Supprimer
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
