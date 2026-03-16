import React from 'react';
import { Search, Bell, HelpCircle, LogOut, PlayCircle, Menu } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

export const Header = ({ title, onLogout, onMenuClick }: { title: string, onLogout?: () => void, onMenuClick?: () => void }) => {
  const { t } = useTranslation();
  const isDemoMode = localStorage.getItem('demoMode') === 'true';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg lg:text-xl font-semibold text-slate-900 truncate max-w-[150px] sm:max-w-none">{title}</h1>
        {isDemoMode && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider border border-indigo-100">
            <PlayCircle className="w-3.5 h-3.5" />
            {t('header.demoMode')}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 lg:gap-6">
        <div className="relative hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('common.search')} 
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-32 md:w-64 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-1 lg:gap-4">
          <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors hidden sm:block">
            <HelpCircle className="w-5 h-5" />
          </button>
          {onLogout && (
            <button 
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
