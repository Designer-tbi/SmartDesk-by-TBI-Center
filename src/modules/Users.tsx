import React, { useState, useEffect } from 'react';
import { MOCK_ROLES, MOCK_PERMISSIONS } from '../constants';
import { User, Role, Permission } from '../types';
import { Users as UsersIcon, Shield, Lock, Plus, Search, MoreVertical, Mail, ShieldCheck, UserPlus, X, Check, Trash2, Edit2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

export const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  const [newUser, setNewUser] = useState({ name: '', email: '', roleId: '', password: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiFetch('/api/company/users'),
        apiFetch('/api/company/roles')
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
        if (rolesData.length > 0 && !newUser.roleId) {
          setNewUser(prev => ({ ...prev, roleId: rolesData[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = Math.random().toString(36).substr(2, 9);
      const response = await apiFetch('/api/company/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newUser, id, role: newUser.roleId })
      });
      if (response.ok) {
        fetchData();
        setIsUserModalOpen(false);
        setNewUser({ name: '', email: '', roleId: roles[0]?.id || '', password: '' });
      }
    } catch (error) {
      console.error('Failed to add user:', error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      try {
        const response = await apiFetch(`/api/company/users/${id}`, { method: 'DELETE' });
        if (response.ok) {
          fetchData();
        }
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
  };

  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || roleId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'users' 
                ? "bg-indigo-600 text-white shadow-md" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            Utilisateurs
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'roles' 
                ? "bg-indigo-600 text-white shadow-md" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Shield className="w-4 h-4" />
            Rôles & Permissions
          </button>
        </div>
        
        <button 
          onClick={() => activeTab === 'users' ? setIsUserModalOpen(true) : setIsRoleModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          {activeTab === 'users' ? 'Nouvel Utilisateur' : 'Nouveau Rôle'}
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Utilisateur</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rôle</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dernière Connexion</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                        {getRoleName(user.roleId)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        user.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {user.status === 'Active' ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {user.lastLogin || 'Jamais'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((role) => (
            <div key={role.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button className="p-2 text-slate-400 hover:text-indigo-600">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">{role.name}</h4>
              <p className="text-sm text-slate-500 mb-4">
                {role.permissions.includes('all') 
                  ? 'Accès complet à tous les modules du système.' 
                  : `${role.permissions.length} permissions accordées.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {role.permissions.includes('all') ? (
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">Tout voir</span>
                ) : (
                  role.permissions.slice(0, 3).map(p => (
                    <span key={p} className="px-2 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">{p}</span>
                  ))
                )}
                {!role.permissions.includes('all') && role.permissions.length > 3 && (
                  <span className="px-2 py-1 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">+{role.permissions.length - 3}</span>
                )}
              </div>
            </div>
          ))}
          <button 
            onClick={() => setIsRoleModalOpen(true)}
            className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
          >
            <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-white transition-all">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm">Créer un nouveau rôle</span>
          </button>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleAddUser} className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Nouvel Utilisateur</h3>
              <button type="button" onClick={() => setIsUserModalOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Nom complet</label>
                <input type="text" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Ex: Jean Mvoula" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="email@exemple.cg" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Mot de passe</label>
                <input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Rôle</label>
                <select value={newUser.roleId} onChange={e => setNewUser({...newUser, roleId: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold mt-4">Créer l'utilisateur</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
