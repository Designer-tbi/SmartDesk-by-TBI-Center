import React, { useState, useEffect } from 'react';
import { Search, Bell, HelpCircle, LogOut, PlayCircle, Menu, Building2 } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { apiFetch, setApiSession } from '../../lib/api';

export const Header = ({
  title,
  onLogout,
  onMenuClick,
  user,
}: {
  title: string;
  onLogout?: () => void;
  onMenuClick?: () => void;
  user?: any;
}) => {
  const { t } = useTranslation();
  const isDemoMode = !!user?.isDemo;
  const [companies, setCompanies] = useState<any[]>([]);
  // Selected company id for super-admin tenant switcher is persisted as a
  // user preference in the database (users.preferences.selectedCompanyId).
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    user?.preferences?.selectedCompanyId || user?.companyId || '',
  );

  useEffect(() => {
    if (user?.role === 'super_admin') {
      apiFetch('/api/admin/companies')
        .then((res) => res.json())
        .then((data) => {
          setCompanies(data);
          if (!selectedCompanyId && data.length > 0) {
            const firstId = data[0].id;
            setSelectedCompanyId(firstId);
            setApiSession({ companyId: firstId });
            // Persist the default choice the first time.
            fetch('/api/auth/preferences', {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ selectedCompanyId: firstId }),
            }).catch(() => {});
          }
        })
        .catch((err) => console.error('Failed to fetch companies:', err));
    }
  }, [user, selectedCompanyId]);

  const handleCompanyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedCompanyId(newId);
    setApiSession({ companyId: newId });
    try {
      await fetch('/api/auth/preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedCompanyId: newId }),
      });
    } catch { /* noop */ }
    window.location.reload(); // Refresh all data under the new tenant
  };

  return (
    <header className="h-16 bg-white border-b border-red-50 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg lg:text-xl font-bold text-primary-red tracking-tight truncate max-w-[150px] sm:max-w-none">
          {title}
        </h1>
        {isDemoMode && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-soft-red text-accent-red rounded-full text-[10px] font-bold uppercase tracking-wider border border-accent-red/10">
            <PlayCircle className="w-3.5 h-3.5" />
            {t('header.demoMode')}
          </div>
        )}
        {user?.role === 'super_admin' && companies.length > 0 && (
          <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 bg-soft-red/10 rounded-xl border border-red-100">
            <Building2 className="w-4 h-4 text-accent-red" />
            <select
              value={selectedCompanyId}
              onChange={handleCompanyChange}
              data-testid="header-company-selector"
              className="bg-transparent text-xs font-bold text-primary-red outline-none cursor-pointer"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 lg:gap-6">
        <div className="relative hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('common.search')}
            className="pl-10 pr-4 py-2 bg-soft-red/10 border border-red-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/10 focus:border-accent-red w-32 md:w-64 transition-all"
          />
        </div>

        <div className="flex items-center gap-1 lg:gap-4">
          <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative group">
            <Bell className="w-6 h-6 group-hover:text-accent-red transition-colors" />
            <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-accent-red rounded-full border-2 border-white"></span>
          </button>
          <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors hidden sm:block group">
            <HelpCircle className="w-6 h-6 group-hover:text-accent-red transition-colors" />
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              data-testid="header-logout-button"
              className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
              title={t('nav.logout')}
            >
              <LogOut className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
