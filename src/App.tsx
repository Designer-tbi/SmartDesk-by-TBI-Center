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
import { Login } from './modules/Login';

const PageWrapper = ({ children, onLogout, user }: { children: React.ReactNode, onLogout?: () => void, user: any }) => {
  const location = useLocation();
  
  const getTitle = (path: string) => {
    switch (path) {
      case '/': return 'Tableau de Bord';
      case '/crm': return 'Gestion de la Relation Client';
      case '/sales': return 'Ventes & Facturation';
      case '/inventory': return 'Gestion des Stocks';
      case '/projects': return 'Gestion de Projets';
      case '/hr': return 'Ressources Humaines';
      case '/accounting': return 'Comptabilité';
      case '/users': return 'Utilisateurs & Permissions';
      case '/settings': return 'Paramètres Système';
      default: return 'SMARTDesk';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col">
        <Header title={getTitle(location.pathname)} onLogout={onLogout} />
        <main className="p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = React.useState<any>(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Router>
      <PageWrapper onLogout={() => setUser(null)} user={user}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/hr" element={<HR />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </PageWrapper>
    </Router>
  );
}
