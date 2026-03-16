import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar,
  Clock,
  Users, 
  Shield,
  Package, 
  FileText, 
  Briefcase, 
  UserCircle, 
  Settings,
  ChevronRight,
  ChevronLeft,
  Calculator,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { I18nProvider, useTranslation } from '../../lib/i18n';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Sidebar = ({ user, isOpen, onClose }: { user?: any, isOpen?: boolean, onClose?: () => void }) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navSections = [
    {
      title: t('nav.section.main'),
      items: [
        { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/' },
        { icon: Calendar, label: t('nav.agenda'), path: '/agenda' },
      ]
    },
    {
      title: t('nav.section.operations'),
      items: [
        { icon: Users, label: t('nav.crm'), path: '/crm' },
        { icon: FileText, label: t('nav.sales'), path: '/sales' },
        { icon: Package, label: t('nav.inventory'), path: '/inventory' },
      ]
    },
    {
      title: t('nav.section.management'),
      items: [
        { icon: Clock, label: t('nav.planning'), path: '/planning' },
        { icon: Briefcase, label: t('nav.projects'), path: '/projects' },
        { icon: UserCircle, label: t('nav.hr'), path: '/hr' },
        { icon: Calculator, label: t('nav.accounting'), path: '/accounting' },
      ]
    },
    {
      title: t('nav.section.config'),
      items: [
        { icon: Shield, label: t('nav.users'), path: '/users' },
        { icon: Settings, label: t('nav.settings'), path: '/settings' },
      ]
    }
  ];

  const superAdminSection = {
    title: t('nav.superAdmin'),
    items: [
      { icon: Shield, label: t('nav.saDashboard'), path: '/super-admin' },
    ]
  };

  const sectionsToRender = user?.role === 'super_admin' 
    ? [superAdminSection, ...navSections] 
    : navSections;

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-slate-900/50 z-40 transition-opacity lg:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <aside className={cn(
        "bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 left-0 transition-all duration-300 z-50",
        "fixed lg:sticky", // Fixed on mobile, sticky on desktop
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0", // Toggle on mobile
        isCollapsed ? "w-20 shrink-0" : "w-64 shrink-0"
      )}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 bg-white border border-slate-200 rounded-full p-1 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 shadow-sm transition-colors z-30 hidden lg:block"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className="p-6 flex-1 overflow-y-auto overflow-x-hidden">
          <div className={cn("flex items-center justify-between mb-10", isCollapsed ? "lg:justify-center" : "")}>
            <div className={cn("flex items-center gap-3", isCollapsed ? "lg:justify-center" : "")}>
              <div className="w-8 h-8 shrink-0 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold overflow-hidden">
                {user?.companyLogo ? (
                  <img 
                    src={user.companyLogo} 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  user?.companyName?.charAt(0) || 'S'
                )}
              </div>
              {(!isCollapsed || isOpen) && (
                <span className="text-xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
                  {user?.companyName || 'SmartDesk'}
                </span>
              )}
            </div>
            {isOpen && (
              <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        
        <nav className="space-y-8">
          {sectionsToRender.map((section) => (
            <div key={section.title}>
              {!isCollapsed ? (
                <h3 className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 whitespace-nowrap">
                  {section.title}
                </h3>
              ) : (
                <div className="h-px mb-3 bg-slate-100 mx-4"></div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) => cn(
                      "group flex items-center justify-between py-2 rounded-lg text-sm font-medium transition-all",
                      isCollapsed ? "px-0 justify-center" : "px-3",
                      isActive 
                        ? "bg-indigo-50 text-indigo-700" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
                          <item.icon className={cn(
                            "w-5 h-5 transition-colors shrink-0",
                            isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-600"
                          )} />
                          {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                        </div>
                        {!isCollapsed && (
                          <ChevronRight className={cn(
                            "w-4 h-4 transition-all opacity-0 -translate-x-2 shrink-0",
                            "group-hover:opacity-100 group-hover:translate-x-0"
                          )} />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
      
      <div className={cn("mt-auto p-6 border-t border-slate-100", isCollapsed ? "lg:flex lg:justify-center lg:px-2" : "")}>
        <div className={cn("flex items-center", isCollapsed ? "lg:justify-center" : "gap-3")}>
          <div className="w-10 h-10 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold" title={isCollapsed ? (user?.name || 'Admin') : undefined}>
            {user?.name?.charAt(0) || 'A'}
          </div>
          {(!isCollapsed || isOpen) && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-slate-900 truncate">{user?.name || 'Admin SmartDesk'}</span>
              <span className="text-xs text-slate-500 truncate">{user?.role || 'Gérant PME'}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
};
