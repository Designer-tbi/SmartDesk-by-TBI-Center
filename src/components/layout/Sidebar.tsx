import React, { useState, useEffect } from 'react';
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
  ChevronDown,
  Calculator,
  Landmark,
  HeartHandshake,
  BarChart3,
  ScrollText,
  FileBadge,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { I18nProvider, useTranslation } from '../../lib/i18n';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLLAPSED_SECTIONS_KEY = 'sidebarCollapsedSections';

export const Sidebar = ({ user, isOpen, onClose }: { user?: any, isOpen?: boolean, onClose?: () => void }) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(
    () => user?.preferences?.[COLLAPSED_SECTIONS_KEY] || {},
  );

  // Sync with the user preferences once the /api/auth/me payload arrives.
  useEffect(() => {
    if (user?.preferences?.[COLLAPSED_SECTIONS_KEY]) {
      setCollapsedSections(user.preferences[COLLAPSED_SECTIONS_KEY]);
    }
  }, [user?.preferences]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Fire-and-forget: persist to DB.
      try {
        fetch('/api/auth/preferences', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [COLLAPSED_SECTIONS_KEY]: next }),
        }).catch(() => {});
      } catch {
        /* noop */
      }
      return next;
    });
  };

  const navSections = [
    {
      key: 'main',
      title: t('nav.section.main'),
      items: [
        { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/' },
        { icon: Calendar, label: t('nav.agenda'), path: '/agenda' },
      ]
    },
    {
      key: 'operations',
      title: t('nav.section.operations'),
      items: [
        { icon: Users, label: t('nav.crm'), path: '/crm' },
        { icon: FileText, label: t('nav.sales'), path: '/sales' },
        { icon: Package, label: t('nav.inventory'), path: '/inventory' },
      ]
    },
    {
      key: 'management',
      title: t('nav.section.management'),
      items: [
        { icon: Clock, label: t('nav.planning'), path: '/planning' },
        { icon: Briefcase, label: t('nav.projects'), path: '/projects' },
        { icon: UserCircle, label: t('nav.hr'), path: '/hr' },
        { icon: Calculator, label: t('nav.accounting'), path: '/accounting' },
      ]
    },
    {
      key: 'declarations',
      title: t('nav.section.declarations'),
      items: [
        { icon: LayoutDashboard, label: t('nav.declarations.dashboard'), path: '/declarations' },
        { icon: Calendar, label: t('nav.declarations.calendar'), path: '/declarations/calendar' },
        { icon: Landmark, label: t('nav.declarations.dgid'), path: '/declarations/dgid' },
        { icon: HeartHandshake, label: t('nav.declarations.cnss'), path: '/declarations/cnss' },
        { icon: BarChart3, label: t('nav.declarations.ins'), path: '/declarations/ins' },
        { icon: FileBadge, label: t('nav.declarations.greffe'), path: '/declarations/greffe' },
      ]
    },
    {
      key: 'config',
      title: t('nav.section.config'),
      items: [
        { icon: Shield, label: t('nav.users'), path: '/users' },
        { icon: Settings, label: t('nav.settings'), path: '/settings' },
      ]
    }
  ];

  const superAdminSection = {
    key: 'super-admin',
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
          "fixed inset-0 bg-primary-red/20 backdrop-blur-sm z-40 transition-opacity lg:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <aside className={cn(
        "bg-primary-red flex flex-col h-screen sticky top-0 left-0 transition-all duration-300 z-50 shadow-2xl",
        "fixed lg:sticky", // Fixed on mobile, sticky on desktop
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0", // Toggle on mobile
        isCollapsed ? "w-20 shrink-0" : "w-64 shrink-0"
      )}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          data-testid="sidebar-collapse-toggle"
          className="absolute -right-3 top-8 bg-white border border-red-100 rounded-full p-1 text-slate-400 hover:text-accent-red hover:border-accent-red shadow-lg transition-colors z-30 hidden lg:block"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className="p-6 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className={cn("flex items-center justify-between mb-10", isCollapsed ? "lg:justify-center" : "")}>
            <div className={cn("flex items-center gap-3", isCollapsed ? "lg:justify-center" : "")}>
              <div className="w-9 h-9 shrink-0 bg-accent-red rounded-xl flex items-center justify-center text-white font-bold overflow-hidden shadow-lg shadow-accent-red/20">
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
        
        <nav className="space-y-6">
          {sectionsToRender.map((section) => {
            const isSectionCollapsed = !isCollapsed && !!collapsedSections[section.key];
            return (
              <div key={section.key}>
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    aria-expanded={!isSectionCollapsed}
                    data-testid={`sidebar-section-toggle-${section.key}`}
                    className="group w-full flex items-center justify-between px-3 mb-2 rounded-md text-[10px] font-bold text-red-300/60 uppercase tracking-widest whitespace-nowrap hover:text-white hover:bg-white/5 py-1.5 transition-colors"
                  >
                    <span>{section.title}</span>
                    <ChevronDown className={cn(
                      "w-3.5 h-3.5 transition-transform duration-200 shrink-0",
                      isSectionCollapsed && "-rotate-90"
                    )} />
                  </button>
                ) : (
                  <div className="h-px mb-3 bg-white/10 mx-4"></div>
                )}
                <div
                  className={cn(
                    "space-y-1 overflow-hidden transition-all duration-300 ease-out",
                    // When collapsed we animate the height + opacity.
                    isSectionCollapsed ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100"
                  )}
                >
                  {section.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      title={isCollapsed ? item.label : undefined}
                      data-testid={`sidebar-link-${item.path.replace(/\//g, '') || 'dashboard'}`}
                      className={({ isActive }) => cn(
                        "group flex items-center justify-between py-2.5 rounded-xl text-sm font-medium transition-all",
                        isCollapsed ? "px-0 justify-center" : "px-3",
                        isActive 
                          ? "bg-accent-red text-white shadow-lg shadow-accent-red/20" 
                          : "text-red-100/70 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
                            <item.icon className={cn(
                              "w-5 h-5 transition-colors shrink-0",
                              isActive ? "text-white" : "text-red-300 group-hover:text-white"
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
            );
          })}
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
              <span className="text-xs text-red-300/50 truncate">{user?.role || 'Gérant PME'}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
};
