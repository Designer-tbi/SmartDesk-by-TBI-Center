import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './modules/Dashboard';
import { CRM } from './modules/CRM';
import { Sales } from './modules/Sales';
import { Inventory } from './modules/Inventory';
import { Projects } from './modules/Projects';
import { HR } from './modules/HR';
import { Accounting } from './modules/Accounting';
import { Settings } from './modules/Settings';
import { Users } from './modules/Users';
import { Agenda } from './modules/Agenda';
import { Planning } from './modules/Planning';
import { Login } from './modules/Login';
import { SuperAdmin } from './modules/SuperAdmin';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch } from './lib/api';

const PageWrapper = ({ children, onLogout, user }: { children: React.ReactNode, onLogout?: () => void, user: any }) => {
  const location = useLocation();
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  
  const getTitle = (path: string) => {
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
  };

  React.useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={getTitle(location.pathname)} onLogout={onLogout} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="p-4 lg:p-8 max-w-7xl mx-auto w-full flex-1 min-w-0">
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
        </main>
        <footer className="py-4 text-center text-sm text-slate-500 border-t border-slate-200">
          SmartDesk by <a href="https://tbi-center.fr" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-medium">TBI Center</a>
        </footer>
      </div>
    </div>
  );
};

import { I18nProvider, useTranslation } from './lib/i18n';

const AppContent = ({ user, setUser, isLoading, setIsLoading }: any) => {
  const { setLanguage } = useTranslation();

  React.useEffect(() => {
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
    return <Login onLogin={(u: any) => {
      setUser(u);
      if (u.language) setLanguage(u.language);
    }} />;
  }

  return (
    <Router>
      <PageWrapper onLogout={() => { localStorage.removeItem('token'); setUser(null); }} user={user}>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/crm" element={<CRM user={user} />} />
          <Route path="/sales" element={<Sales user={user} />} />
          <Route path="/inventory" element={<Inventory user={user} />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/hr" element={<HR user={user} />} />
          <Route path="/accounting" element={<Accounting user={user} />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings user={user} setUser={setUser} />} />
          {user?.role === 'super_admin' && <Route path="/super-admin" element={<SuperAdmin />} />}
        </Routes>
      </PageWrapper>
    </Router>
  );
};

export default function App() {
  const [user, setUser] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  return (
    <I18nProvider>
      <AppContent user={user} setUser={setUser} isLoading={isLoading} setIsLoading={setIsLoading} />
    </I18nProvider>
  );
}
