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
          "fixed inset-0 bg-primary-blue/20 backdrop-blur-sm z-40 transition-opacity lg:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <aside className={cn(
        "bg-primary-blue flex flex-col h-screen sticky top-0 left-0 transition-all duration-300 z-50 shadow-2xl",
        "fixed lg:sticky", // Fixed on mobile, sticky on desktop
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0", // Toggle on mobile
        isCollapsed ? "w-20 shrink-0" : "w-64 shrink-0"
      )}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 bg-white border border-blue-100 rounded-full p-1 text-slate-400 hover:text-accent-blue hover:border-accent-blue shadow-lg transition-colors z-30 hidden lg:block"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className="p-6 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className={cn("flex items-center justify-between mb-10", isCollapsed ? "lg:justify-center" : "")}>
            <div className={cn("flex items-center gap-3", isCollapsed ? "lg:justify-center" : "")}>
              <div className="w-9 h-9 shrink-0 bg-accent-blue rounded-xl flex items-center justify-center text-white font-bold overflow-hidden shadow-lg shadow-accent-blue/20">
                {user?.companyLogo ? (
                  <img 
                    src={user.companyLogo} 
                    alt={user?.companyName || "SmartDesk Logo"} 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  user?.companyName?.charAt(0) || 'S'
                )}
              </div>
              {(!isCollapsed || isOpen) && (
                <span className="text-xl font-bold text-white tracking-tight whitespace-nowrap">
                  {user?.companyName || 'SmartDesk'}
                </span>
              )}
            </div>
            {isOpen && (
              <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        
        <nav className="space-y-8">
          {sectionsToRender.map((section) => (
            <div key={section.title}>
              {!isCollapsed ? (
                <h3 className="px-3 text-[10px] font-bold text-blue-300/60 uppercase tracking-widest mb-3 whitespace-nowrap">
                  {section.title}
                </h3>
              ) : (
                <div className="h-px mb-3 bg-white/10 mx-4"></div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) => cn(
                      "group flex items-center justify-between py-2.5 rounded-xl text-sm font-medium transition-all",
                      isCollapsed ? "px-0 justify-center" : "px-3",
                      isActive 
                        ? "bg-accent-blue text-white shadow-lg shadow-accent-blue/20" 
                        : "text-blue-100/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
                          <item.icon className={cn(
                            "w-5 h-5 transition-colors shrink-0",
                            isActive ? "text-white" : "text-blue-300 group-hover:text-white"
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
      
      <div className={cn("mt-auto p-6 border-t border-white/5", isCollapsed ? "lg:flex lg:justify-center lg:px-2" : "")}>
        <div className={cn("flex items-center", isCollapsed ? "lg:justify-center" : "gap-3")}>
          <div className="w-10 h-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white font-bold border border-white/10" title={isCollapsed ? (user?.name || 'Admin') : undefined}>
            {user?.name?.charAt(0) || 'A'}
          </div>
          {(!isCollapsed || isOpen) && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-white truncate">{user?.name || 'Admin SmartDesk'}</span>
              <span className="text-xs text-blue-300/50 truncate">{user?.role || 'Gérant PME'}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
};
