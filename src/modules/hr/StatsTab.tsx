import React from 'react';
import { Users, Coffee, DollarSign, Briefcase } from 'lucide-react';
import { Employee, LeaveRequest } from '../../types';

interface Props {
  employees: Employee[];
  leaves: LeaveRequest[];
  currencySymbol: string;
  t: (key: string) => string;
}

export const StatsTab: React.FC<Props> = ({ employees, leaves, currencySymbol, t }) => {
  const activeLeaves = leaves.filter((l) => l.status === 'Approved').length;
  const monthlyPayroll = employees.reduce((acc, curr) => acc + curr.salary, 0) / 12;
  const departments = new Set(employees.map((e) => e.department)).size;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-soft-red text-accent-red rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-emerald-600">{t('hr.newThisMonth')}</span>
        </div>
        <div className="text-2xl font-black text-slate-900">{employees.length}</div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('hr.totalEffectif')}</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <Coffee className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-amber-600">3 {t('hr.status.active').toLowerCase()}s</span>
        </div>
        <div className="text-2xl font-black text-slate-900">{activeLeaves}</div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('hr.currentLeaves')}</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-400">{t('hr.payrollMass')}</span>
        </div>
        <div className="text-2xl font-black text-slate-900">{monthlyPayroll.toLocaleString()}</div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
          {currencySymbol} {t('hr.perMonth')}
        </div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-soft-red text-accent-red rounded-lg">
            <Briefcase className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-400">{t('nav.section.management')}</span>
        </div>
        <div className="text-2xl font-black text-slate-900">{departments}</div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('hr.activeUnits')}</div>
      </div>
    </div>
  );
};
