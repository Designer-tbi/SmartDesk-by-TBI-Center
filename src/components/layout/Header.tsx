import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg lg:text-xl font-bold text-slate-900 tracking-tight truncate max-w-[150px] sm:max-w-none">
          {title}
        </h1>
        {isDemoMode && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-soft-red text-accent-red rounded-full text-[10px] font-bold uppercase tracking-wider border border-accent-red/10 shrink-0">
            <PlayCircle className="w-3.5 h-3.5" />
            {t('header.demoMode')}
          </div>
        )}
        {user?.role === 'super_admin' && companies.length > 0 && (
          <div className="hidden md:flex items-center gap-2 ml-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 shrink-0">
            <Building2 className="w-4 h-4 text-accent-red" />
            <select
              value={selectedCompanyId}
              onChange={handleCompanyChange}
              data-testid="header-company-selector"
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[160px] truncate"
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

      <div className="flex items-center gap-2 lg:gap-4 shrink-0">
        <div className="relative hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('common.search')}
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/10 focus:border-accent-red w-32 md:w-64 transition-all"
          />
        </div>

        <div className="flex items-center gap-1 pl-1 lg:pl-3 lg:border-l border-slate-100">
          <button
            onClick={() => navigate('/settings?tab=help')}
            className="p-2 text-slate-500 hover:bg-slate-100 hover:text-accent-red rounded-full transition-colors hidden sm:block"
            title={t('header.help')}
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <button
            className="p-2 text-slate-500 hover:bg-slate-100 hover:text-accent-red rounded-full transition-colors"
            title={t('header.notifications')}
          >
            <Bell className="w-5 h-5" />
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              data-testid="header-logout-button"
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title={t('nav.logout')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
