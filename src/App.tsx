import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AnimatePresence, motion } from 'motion/react';
import { apiFetch } from './lib/api';
import { I18nProvider, useTranslation } from './lib/i18n';

// Lazy load modules for better initial load time
const Dashboard = lazy(() => import('./modules/Dashboard').then(m => ({ default: m.Dashboard })));
const CRM = lazy(() => import('./modules/CRM').then(m => ({ default: m.CRM })));
const Sales = lazy(() => import('./modules/Sales').then(m => ({ default: m.Sales })));
const Inventory = lazy(() => import('./modules/Inventory').then(m => ({ default: m.Inventory })));
const Projects = lazy(() => import('./modules/Projects').then(m => ({ default: m.Projects })));
const HR = lazy(() => import('./modules/HR').then(m => ({ default: m.HR })));
const Accounting = lazy(() => import('./modules/Accounting').then(m => ({ default: m.Accounting })));
const Settings = lazy(() => import('./modules/Settings').then(m => ({ default: m.Settings })));
const Users = lazy(() => import('./modules/Users').then(m => ({ default: m.Users })));
const Agenda = lazy(() => import('./modules/Agenda').then(m => ({ default: m.Agenda })));
const Planning = lazy(() => import('./modules/Planning').then(m => ({ default: m.Planning })));
const Login = lazy(() => import('./modules/Login').then(m => ({ default: m.Login })));
const SuperAdmin = lazy(() => import('./modules/SuperAdmin').then(m => ({ default: m.SuperAdmin })));

const PageWrapper = ({ children, onLogout, user }: { children: React.ReactNode, onLogout?: () => void, user: any }) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const { t } = useTranslation();
  
  const getTitle = useCallback((path: string) => {
    switch (path) {
      case '/': return t('header.dashboard');
      case '/crm': return t('header.crm');
      case '/sales': return t('header.sales');
      case '/inventory': return t('header.inventory');
      case '/projects': return t('header.projects');
      case '/hr': return t('header.hr');
      case '/accounting': return t('header.accounting');
      case '/users': return t('header.users');
      case '/settings': return t('header.settings');
      case '/super-admin': return t('header.superAdmin');
      case '/agenda': return t('header.agenda');
      case '/planning': return t('header.planning');
      default: return 'SmartDesk';
    }
  }, [t]);

  useEffect(() => {
    const title = getTitle(location.pathname);
    document.title = `${title} | SmartDesk by TBI Center`;
  }, [location.pathname, getTitle]);

  return (
    <div className="flex h-screen bg-luxury-gray overflow-hidden">
      <Sidebar user={user} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={getTitle(location.pathname)} onLogout={onLogout} user={user} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        <footer className="py-4 text-center text-sm text-slate-500 border-t border-red-50 bg-white">
          SmartDesk by <a href="https://tbi-center.fr" target="_blank" rel="noopener noreferrer" className="text-accent-red hover:underline font-medium">TBI Center</a>
        </footer>
      </div>
    </div>
  );
};

const AppContent = ({ user, setUser, isLoading, setIsLoading }: any) => {
  const { setLanguage } = useTranslation();

  useEffect(() => {
    const handleAuthError = () => {
      localStorage.removeItem('token');
      setUser(null);
    };

    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, [setUser]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      apiFetch('/api/auth/me')
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Invalid token');
        })
        .then(userData => {
          setUser(userData);
          if (userData.language) {
            setLanguage(userData.language);
          }
          setIsLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [setUser, setIsLoading, setLanguage]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  if (!user) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement...</div>}>
        <Login onLogin={(u: any) => {
          setUser(u);
          if (u.language) setLanguage(u.language);
        }} />
      </Suspense>
    );
  }

  return (
    <Router>
      <PageWrapper onLogout={() => { localStorage.removeItem('token'); setUser(null); }} user={user}>
        <Suspense fallback={<div className="flex items-center justify-center h-64">Chargement du module...</div>}>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/crm" element={<CRM user={user} />} />
            <Route path="/sales" element={<Sales user={user} />} />
            <Route path="/inventory" element={<Inventory user={user} />} />
            <Route path="/projects" element={<Projects user={user} />} />
            <Route path="/hr" element={<HR user={user} />} />
            <Route path="/accounting" element={<Accounting user={user} />} />
            <Route path="/agenda" element={<Agenda user={user} />} />
            <Route path="/planning" element={<Planning user={user} />} />
            <Route path="/users" element={<Users user={user} />} />
            <Route path="/settings" element={<Settings user={user} setUser={setUser} />} />
            {user?.role === 'super_admin' && <Route path="/super-admin" element={<SuperAdmin />} />}
          </Routes>
        </Suspense>
      </PageWrapper>
    </Router>
  );
};

import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <ErrorBoundary>
      <I18nProvider>
        <AppContent user={user} setUser={setUser} isLoading={isLoading} setIsLoading={setIsLoading} />
      </I18nProvider>
    </ErrorBoundary>
  );
}
