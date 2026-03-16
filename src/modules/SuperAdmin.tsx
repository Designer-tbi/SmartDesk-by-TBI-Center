import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { useWebSocket } from '../lib/websocket';
import { Building2, Users, Activity, Trash2, Edit2, Plus, CheckCircle2, XCircle, X, Search, Clock } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

export const SuperAdmin = () => {
  const [activeTab, setActiveTab] = useState<'companies' | 'users' | 'activity'>('companies');
  const [stats, setStats] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { lastMessage } = useWebSocket();

  // ... existing state ...
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    type: 'real', 
    status: 'active',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPhone: ''
  });

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'admin' });

  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (lastMessage?.type === 'ACTIVITY') {
      setActivityLog(prev => [lastMessage.data, ...prev].slice(0, 100));
      fetchData(); // Refresh stats if needed
    }
  }, [lastMessage]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [statsRes, companiesRes, usersRes, activityRes] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/companies'),
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/activity')
      ]);

      if (statsRes.ok && companiesRes.ok && usersRes.ok && activityRes.ok) {
        setStats(await statsRes.json());
        setCompanies(await companiesRes.json());
        setAllUsers(await usersRes.json());
        setActivityLog(await activityRes.json());
      } else {
        setError('Erreur lors du chargement des données.');
      }
    } catch (err) {
      setError('Erreur de connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchCompanyUsers = async (companyId: string) => {
    try {
      const res = await apiFetch(`/api/admin/companies/${companyId}/users`);
      if (res.ok) {
        setCompanyUsers(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenUserModal = (company: any) => {
    setSelectedCompany(company);
    fetchCompanyUsers(company.id);
    setIsUserModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/admin/companies/${selectedCompany.id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newUserForm,
          id: `user_${Date.now()}`
        })
      });

      if (res.ok) {
        setNewUserForm({ name: '', email: '', password: '', role: 'admin' });
        fetchCompanyUsers(selectedCompany.id);
        fetchData(); // Update total users count
      } else {
        alert('Erreur lors de la création de l\'utilisateur.');
      }
    } catch (err) {
      alert('Erreur de connexion.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setUserToDelete(userId);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await apiFetch(`/api/admin/users/${userToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedCompany) fetchCompanyUsers(selectedCompany.id);
        fetchData();
      }
    } catch (err) {
      alert('Erreur de connexion.');
    } finally {
      setUserToDelete(null);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    setCompanyToDelete(id);
  };

  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    try {
      const res = await apiFetch(`/api/admin/companies/${companyToDelete}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchData();
      } else {
        alert('Erreur lors de la suppression.');
      }
    } catch (err) {
      alert('Erreur de connexion.');
    } finally {
      setCompanyToDelete(null);
    }
  };

  const handleOpenModal = (company?: any) => {
    if (company) {
      setEditingCompany(company);
      setFormData({ 
        name: company.name, 
        type: company.type, 
        status: company.status,
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        adminPhone: ''
      });
    } else {
      setEditingCompany(null);
      setFormData({ 
        name: '', 
        type: 'real', 
        status: 'active',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        adminPhone: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingCompany 
        ? `/api/admin/companies/${editingCompany.id}`
        : '/api/admin/companies';
      
      const method = editingCompany ? 'PUT' : 'POST';
      
      const body = {
        ...formData,
        id: editingCompany ? editingCompany.id : `company_${Date.now()}`
      };

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert('Erreur lors de l\'enregistrement.');
      }
    } catch (err) {
      alert('Erreur de connexion.');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Chargement...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Tableau de Bord Super Admin</h1>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('companies')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === 'companies' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Entreprises
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Utilisateurs
          </button>
          <button 
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === 'activity' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Activité
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {/* ... existing stats ... */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Entreprises Réelles</p>
              <h3 className="text-2xl font-bold text-slate-900">{stats?.realCompanies || 0}</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Entreprises Démo</p>
              <h3 className="text-2xl font-bold text-slate-900">{stats?.demoCompanies || 0}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Utilisateurs</p>
              <h3 className="text-2xl font-bold text-slate-900">{stats?.totalUsers || 0}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <AnimatePresence mode="wait">
        {activeTab === 'companies' && (
          <motion.div
            key="companies"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Liste des Entreprises</h2>
              <button 
                onClick={() => handleOpenModal()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nouvelle Entreprise
              </button>
            </div>
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">Nom</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4">Création</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {companies.map((company) => (
                    <tr key={company.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{company.name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          company.type === 'real' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {company.type === 'real' ? 'Réelle' : 'Démo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          company.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {company.status === 'active' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {company.status === 'active' ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(company.createdAt || company.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenUserModal(company)}
                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                            title="Gérer les utilisateurs"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenModal(company)}
                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                            title="Modifier l'entreprise"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteCompany(company.id)}
                            className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Supprimer l'entreprise"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Tous les Utilisateurs</h2>
            </div>
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left text-sm min-w-[1000px]">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">Nom</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Entreprise</th>
                    <th className="px-6 py-4">Rôle</th>
                    <th className="px-6 py-4">Dernière Connexion</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{user.name}</td>
                      <td className="px-6 py-4 text-slate-500">{user.email}</td>
                      <td className="px-6 py-4 text-slate-500">{user.companyName || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          user.role === 'super_admin' ? 'bg-purple-100 text-purple-800' : 
                          user.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString('fr-FR') : 'Jamais'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          disabled={user.role === 'super_admin'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'activity' && (
          <motion.div
            key="activity"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Journal d'Activité en Temps Réel</h2>
              <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Live
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {activityLog.map((log, index) => (
                  <div key={log.id} className="flex gap-4 relative">
                    {index !== activityLog.length - 1 && (
                      <div className="absolute left-[11px] top-8 bottom-[-24px] w-px bg-slate-100" />
                    )}
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-medium text-slate-900">
                          {log.userName || 'Système'}
                          <span className="mx-2 text-slate-300">•</span>
                          <span className="text-slate-500 font-normal">{log.action}</span>
                        </p>
                        <span className="text-xs text-slate-400 shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{log.details}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 text-slate-500 text-[10px] font-medium border border-slate-100">
                          {log.companyName || 'Global'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {activityLog.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    Aucune activité récente.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users Modal */}
      {isUserModalOpen && selectedCompany && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
              <h2 className="text-lg font-bold text-slate-900">
                Utilisateurs : {selectedCompany.name}
              </h2>
              <button 
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Add User Form */}
              <form onSubmit={handleCreateUser} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Ajouter un utilisateur</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Nom complet</label>
                    <input
                      type="text"
                      required
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Email</label>
                    <input
                      type="email"
                      required
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Mot de passe</label>
                    <input
                      type="password"
                      required
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Rôle</label>
                    <select
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    >
                      <option value="admin">Administrateur</option>
                      <option value="user">Utilisateur</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Ajouter
                  </button>
                </div>
              </form>

              {/* Users List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto scrollbar-hide">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-4 py-3">Nom</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Rôle</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {companyUsers.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                        <td className="px-4 py-3 text-slate-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            u.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {u.role === 'admin' ? 'Admin' : 'User'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {companyUsers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          Aucun utilisateur trouvé.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Company Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingCompany ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Informations de l'entreprise</h3>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Nom de l'entreprise</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Ex: Acme Corp"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    >
                      <option value="real">Réelle</option>
                      <option value="demo">Démo</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Statut</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    >
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </div>
                </div>
              </div>

              {!editingCompany && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Compte Administrateur</h3>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Nom complet de l'admin</label>
                    <input
                      type="text"
                      required={!editingCompany}
                      value={formData.adminName}
                      onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Ex: Jean Dupont"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Email / Identifiant</label>
                      <input
                        type="email"
                        required={!editingCompany}
                        value={formData.adminEmail}
                        onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="admin@entreprise.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Téléphone</label>
                      <input
                        type="tel"
                        value={formData.adminPhone}
                        onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="+242 ..."
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Mot de passe admin</label>
                    <input
                      type="password"
                      required={!editingCompany}
                      value={formData.adminPassword}
                      onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  {editingCompany ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Confirm Modals */}
      <ConfirmModal
        isOpen={!!userToDelete}
        title="Supprimer l'utilisateur"
        message="Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={confirmDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!companyToDelete}
        title="Supprimer l'entreprise"
        message="Êtes-vous sûr de vouloir supprimer cette entreprise et toutes ses données ? Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        onConfirm={confirmDeleteCompany}
        onCancel={() => setCompanyToDelete(null)}
      />
    </motion.div>
  );
};
