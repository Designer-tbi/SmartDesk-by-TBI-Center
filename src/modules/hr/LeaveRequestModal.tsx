import React from 'react';
import { X } from 'lucide-react';
import { Employee, LeaveRequest } from '../../types';

interface Props {
  open: boolean;
  employees: Employee[];
  newLeave: Partial<LeaveRequest>;
  setNewLeave: (l: Partial<LeaveRequest>) => void;
  leaveError: string | null;
  savingLeave: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const LeaveRequestModal: React.FC<Props> = ({
  open,
  employees,
  newLeave,
  setNewLeave,
  leaveError,
  savingLeave,
  onClose,
  onSubmit,
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm"
      data-testid="hr-leave-modal"
    >
      <form onSubmit={onSubmit} className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900">Nouvelle demande de congé</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {leaveError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600" data-testid="hr-leave-error">
              {leaveError}
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Employé</label>
            <select
              required
              className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-accent-red/20 outline-none"
              value={newLeave.employeeId || ''}
              onChange={(e) => setNewLeave({ ...newLeave, employeeId: e.target.value })}
              data-testid="hr-leave-employee-select"
            >
              <option value="">Sélectionner…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.role ? ` — ${e.role}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</label>
            <select
              className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-accent-red/20 outline-none"
              value={newLeave.type}
              onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value })}
            >
              <option>Congé annuel</option>
              <option>Congé maladie</option>
              <option>Congé maternité</option>
              <option>Congé sans solde</option>
              <option>Permission exceptionnelle</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Du</label>
              <input
                type="date"
                required
                className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                value={newLeave.startDate || ''}
                onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Au</label>
              <input
                type="date"
                required
                className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                value={newLeave.endDate || ''}
                onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Motif (optionnel)</label>
            <textarea
              className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[80px] resize-y"
              value={newLeave.reason || ''}
              onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
              placeholder="Vacances familiales…"
            />
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
            type="submit"
            disabled={savingLeave}
            className="px-4 py-2 text-sm font-bold bg-accent-red text-white rounded-xl hover:bg-red-700 disabled:opacity-60"
            data-testid="hr-leave-save-btn"
          >
            {savingLeave ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
};
