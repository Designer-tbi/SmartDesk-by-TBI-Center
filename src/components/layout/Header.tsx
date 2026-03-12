import React from 'react';
import { Search, Bell, HelpCircle, LogOut } from 'lucide-react';

export const Header = ({ title, onLogout }: { title: string, onLogout?: () => void }) => {
  return (
    <header className="h-16 bg-white border-bottom border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      
      <div className="flex items-center gap-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher..." 
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">
            <HelpCircle className="w-5 h-5" />
          </button>
          {onLogout && (
            <button 
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Déconnexion"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
