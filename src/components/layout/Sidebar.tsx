import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Shield,
  Package, 
  FileText, 
  Briefcase, 
  UserCircle, 
  Settings,
  ChevronRight,
  Calculator
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navSections = [
  {
    title: 'Principal',
    items: [
      { icon: LayoutDashboard, label: 'Tableau de bord', path: '/' },
    ]
  },
  {
    title: 'Opérations',
    items: [
      { icon: Users, label: 'CRM / Clients', path: '/crm' },
      { icon: FileText, label: 'Ventes / Factures', path: '/sales' },
      { icon: Package, label: 'Stocks / Produits', path: '/inventory' },
    ]
  },
  {
    title: 'Management',
    items: [
      { icon: Briefcase, label: 'Projets', path: '/projects' },
      { icon: UserCircle, label: 'RH / Employés', path: '/hr' },
      { icon: Calculator, label: 'Comptabilité', path: '/accounting' },
    ]
  },
  {
    title: 'Configuration',
    items: [
      { icon: Shield, label: 'Utilisateurs & Rôles', path: '/users' },
      { icon: Settings, label: 'Paramètres', path: '/settings' },
    ]
  }
];

export const Sidebar = ({ user }: { user?: any }) => {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">SMARTDesk</span>
        </div>
        
        <nav className="space-y-8">
          {navSections.map((section) => (
            <div key={section.title}>
              <h3 className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => cn(
                      "group flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive 
                        ? "bg-indigo-50 text-indigo-700" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn(
                        "w-4 h-4 transition-colors",
                        "group-hover:text-indigo-600"
                      )} />
                      {item.label}
                    </div>
                    <ChevronRight className={cn(
                      "w-3 h-3 transition-all opacity-0 -translate-x-2",
                      "group-hover:opacity-100 group-hover:translate-x-0"
                    )} />
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
      
      <div className="mt-auto p-6 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
            {user?.name?.charAt(0) || 'A'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900">{user?.name || 'Admin SMARTDesk'}</span>
            <span className="text-xs text-slate-500">{user?.role || 'Gérant PME'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
