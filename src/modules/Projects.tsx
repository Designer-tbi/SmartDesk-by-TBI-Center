import React, { useState, useEffect } from 'react';
import { useTranslation } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { Plus, Calendar, CheckCircle2, Circle, Clock, MoreHorizontal, X, Pencil, Trash2, Eye, Loader2, DollarSign, Flag, Briefcase, User, AlertCircle, Users, Check } from 'lucide-react';
import { Project, Contact, Employee } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

export const Projects = ({ user }: { user?: any }) => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewProject, setViewProject] = useState<Project | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [newProject, setNewProject] = useState<Partial<Project>>({ 
    name: '', 
    client: '', 
    contactId: '',
    status: 'Planning', 
    deadline: '', 
    startDate: new Date().toISOString().split('T')[0],
    progress: 0, 
    description: '', 
    details: '',
    priority: 'Medium',
    budget: 0,
    teamIds: []
  });

  const isUS = user?.country === 'USA';
  const currencySymbol = user?.currency === 'USD' ? '$' : user?.currency === 'EUR' ? '€' : user?.currency === 'XAF' ? 'XAF' : (isUS ? '$' : '€');
  const currencyCode = user?.currency || 'XAF';
  const locale = user?.language === 'en' ? 'en-US' : 'fr-FR';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, { 
      style: 'currency', 
      currency: currencyCode 
    }).format(amount);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [projectsRes, contactsRes, employeesRes] = await Promise.all([
        apiFetch('/api/projects'),
        apiFetch('/api/contacts'),
        apiFetch('/api/employees')
      ]);

      if (projectsRes.ok) setProjects(await projectsRes.json());
      if (contactsRes.ok) setContacts(await contactsRes.json());
      if (employeesRes.ok) setEmployees(await employeesRes.json());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await apiFetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-100 text-emerald-700';
      case 'In Progress': return 'bg-soft-red text-accent-red';
      case 'Planning': return 'bg-slate-100 text-slate-700';
      case 'On Hold': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Completed': return t('projects.completed');
      case 'In Progress': return t('projects.inProgress');
      case 'Planning': return t('projects.planning');
      case 'On Hold': return t('projects.onHold');
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-rose-600 bg-rose-50';
      case 'Medium': return 'text-amber-600 bg-amber-50';
      case 'Low': return 'text-emerald-600 bg-emerald-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'High': return t('projects.priority.high');
      case 'Medium': return t('projects.priority.medium');
      case 'Low': return t('projects.priority.low');
      default: return priority;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (newProject.startDate && newProject.deadline) {
      if (new Date(newProject.deadline) < new Date(newProject.startDate)) {
        setFormError("La date d'échéance ne peut pas être antérieure à la date de début.");
        return;
      }
    }

    try {
      if (editingProject) {
        const response = await apiFetch(`/api/projects/${editingProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProject),
        });
        if (response.ok) fetchProjects();
        setEditingProject(null);
      } else {
        const id = `proj_${Math.random().toString(36).substr(2, 9)}`;
        const response = await apiFetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newProject, id }),
        });
        if (response.ok) fetchProjects();
      }
      setIsModalOpen(false);
      setNewProject({ 
        name: '', 
        client: '', 
        contactId: '',
        status: 'Planning', 
        deadline: '', 
        startDate: new Date().toISOString().split('T')[0],
        progress: 0, 
        description: '', 
        details: '',
        priority: 'Medium',
        budget: 0,
        teamIds: []
      });
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await apiFetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchProjects();
        setDeleteConfirmId(null);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{t('projects.currentProjects')}</h2>
        <button onClick={() => { 
          setEditingProject(null); 
          setNewProject({ 
            name: '', 
            client: '', 
            contactId: '',
            status: 'Planning', 
            deadline: '', 
            startDate: new Date().toISOString().split('T')[0],
            progress: 0, 
            description: '', 
            details: '',
            priority: 'Medium',
            budget: 0,
            teamIds: []
          }); 
          setIsModalOpen(true); 
          setFormError(null);
        }} className="flex items-center gap-2 px-4 py-2 bg-accent-red text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          {t('projects.new')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-accent-red animate-spin" />
            <p className="text-sm font-medium text-slate-500">{t('projects.loading')}</p>
          </div>
        ) : projects.length > 0 ? projects.map((project) => (
          <div key={project.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-red-200 transition-all hover:shadow-md group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(project.status)}`}>
                  {getStatusLabel(project.status)}
                </span>
                {project.priority && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${getPriorityColor(project.priority)}`}>
                    <Flag className="w-3 h-3" />
                    {getPriorityLabel(project.priority)}
                  </span>
                )}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setViewProject(project)} className="p-1.5 text-slate-400 hover:text-accent-red hover:bg-soft-red rounded-lg transition-all" title={t('common.view')}><Eye className="w-4 h-4" /></button>
                <button onClick={() => { setEditingProject(project); setNewProject(project); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title={t('common.edit')}><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setDeleteConfirmId(project.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">{project.name}</h3>
            <p className="text-sm text-slate-500 mb-4 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {project.client}
            </p>

            {project.teamIds && project.teamIds.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex -space-x-2">
                  {project.teamIds.slice(0, 3).map((id) => {
                    const emp = employees.find(e => e.id === id);
                    return (
                      <div key={id} className="w-6 h-6 rounded-full bg-soft-red border-2 border-white flex items-center justify-center overflow-hidden" title={emp?.name}>
                        {emp?.profilePicture ? (
                          <img src={emp.profilePicture} alt={emp.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] font-bold text-accent-red">{emp?.name.charAt(0)}</span>
                        )}
                      </div>
                    );
                  })}
                  {project.teamIds.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-600">
                      +{project.teamIds.length - 3}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('projects.teamLabel')}</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">{t('projects.progress')}</span>
                <span className="font-bold text-accent-red">{project.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-accent-red h-2 rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${project.progress}%` }}
                ></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('projects.deadlineLabel')}</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {project.deadline}
                  </div>
                </div>
                {project.budget !== undefined && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('projects.budgetLabel')}</p>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                      {formatCurrency(project.budget)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full text-center py-20 text-slate-500">
            {t('projects.noProjects')}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl my-8 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900">{editingProject ? t('common.edit') : t('common.add')} {t('projects.title')}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('projects.details')}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400"/>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-sm font-semibold animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Info */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="text-xs font-black text-accent-red uppercase tracking-widest flex items-center gap-2">
                    <Briefcase className="w-3 h-3" />
                    {t('projects.generalInfo')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 ml-1">{t('projects.projectName')}</label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder={t('projects.placeholder.name')} 
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-accent-red transition-all" 
                          value={newProject.name || ''} 
                          onChange={e => setNewProject({...newProject, name: e.target.value})} 
                          required 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 ml-1">{t('projects.client')}</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-accent-red transition-all appearance-none" 
                          value={newProject.contactId || ''} 
                          onChange={e => {
                            const contact = contacts.find(c => c.id === e.target.value);
                            setNewProject({
                              ...newProject, 
                              contactId: e.target.value,
                              client: contact ? contact.name : ''
                            });
                          }} 
                          required 
                        >
                          <option value="">{t('projects.selectClient')}</option>
                          {contacts.map(contact => (
                            <option key={contact.id} value={contact.id}>{contact.name} ({contact.company})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-xs font-black text-accent-red uppercase tracking-widest flex items-center gap-2">
                    <Users className="w-3 h-3" />
                    {t('projects.team')}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {employees.map(emp => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          const currentIds = newProject.teamIds || [];
                          const newIds = currentIds.includes(emp.id)
                            ? currentIds.filter(id => id !== emp.id)
                            : [...currentIds, emp.id];
                          setNewProject({...newProject, teamIds: newIds});
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${
                          (newProject.teamIds || []).includes(emp.id)
                            ? 'bg-soft-red border-red-200 ring-1 ring-red-200'
                            : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                          {emp.profilePicture ? (
                            <img src={emp.profilePicture} alt={emp.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-slate-400">{emp.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-900 truncate">{emp.name}</p>
                          <p className="text-[8px] text-slate-400 truncate">{emp.role}</p>
                        </div>
                        {(newProject.teamIds || []).includes(emp.id) && (
                          <div className="ml-auto bg-accent-red rounded-full p-0.5">
                            <Check className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status & Priority */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-accent-red uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" />
                    {t('projects.statusPriority')}
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 ml-1">{t('projects.status')}</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-accent-red transition-all" 
                        value={newProject.status || 'Planning'} 
                        onChange={e => setNewProject({...newProject, status: e.target.value as any})} 
                        required
                      >
                        <option value="Planning">{t('projects.planning')}</option>
                        <option value="In Progress">{t('projects.inProgress')}</option>
                        <option value="Completed">{t('projects.completed')}</option>
                        <option value="On Hold">{t('projects.onHold')}</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 ml-1">{t('projects.priority')}</label>
                      <div className="flex gap-2">
                        {['Low', 'Medium', 'High'].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setNewProject({...newProject, priority: p as any})}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                              newProject.priority === p 
                                ? getPriorityColor(p) + ' ring-2 ring-current ring-offset-2' 
                                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            {getPriorityLabel(p)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline & Budget */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-accent-red uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {t('projects.timelineBudget')}
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 ml-1">{t('projects.startDate')}</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-accent-red transition-all" 
                          value={newProject.startDate || ''} 
                          onChange={e => setNewProject({...newProject, startDate: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 ml-1">{t('projects.endDate')}</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-accent-red transition-all" 
                          value={newProject.deadline || ''} 
                          onChange={e => setNewProject({...newProject, deadline: e.target.value})} 
                          required 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 ml-1">{t('projects.budgetLabel')} ({currencySymbol})</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="number" 
                          placeholder="0" 
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-accent-red transition-all" 
                          value={newProject.budget || 0} 
                          onChange={e => setNewProject({...newProject, budget: parseFloat(e.target.value) || 0})} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-accent-red uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {t('projects.progress')}
                    </h4>
                    <span className="text-sm font-black text-accent-red">{newProject.progress || 0}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-accent-red"
                    value={newProject.progress || 0} 
                    onChange={e => setNewProject({...newProject, progress: parseInt(e.target.value)})} 
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1">{t('projects.description')}</label>
                  <textarea 
                    placeholder={t('projects.placeholder.description')} 
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-accent-red transition-all resize-none" 
                    value={newProject.description || ''} 
                    onChange={e => setNewProject({...newProject, description: e.target.value})} 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] px-4 py-3 bg-accent-red text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-accent-red/20"
                >
                  {editingProject ? t('projects.update') : t('projects.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {viewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900">{viewProject.name}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('projects.details')}</p>
              </div>
              <button onClick={() => setViewProject(null)} className="p-2 hover:bg-white rounded-xl transition-colors shadow-sm">
                <X className="w-5 h-5 text-slate-400"/>
              </button>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('projects.status')}</p>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(viewProject.status)}`}>
                      {getStatusLabel(viewProject.status)}
                    </span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('projects.priority')}</p>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(viewProject.priority || 'Medium')}`}>
                      {getPriorityLabel(viewProject.priority || 'Medium')}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('projects.progress')}</p>
                    <span className="text-sm font-black text-accent-red">{viewProject.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-accent-red h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${viewProject.progress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-soft-red flex items-center justify-center text-accent-red">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('projects.client')}</p>
                      <p className="font-bold text-slate-700">{viewProject.client}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('projects.budgetLabel')}</p>
                      <p className="font-bold text-slate-700">
                        {formatCurrency(viewProject.budget || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {viewProject.teamIds && viewProject.teamIds.length > 0 && (
                  <div className="space-y-3 pt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('projects.assignedTeam')}</p>
                    <div className="flex flex-wrap gap-2">
                      {viewProject.teamIds.map(id => {
                        const emp = employees.find(e => e.id === id);
                        return (
                          <div key={id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="w-6 h-6 rounded-lg bg-soft-red flex items-center justify-center overflow-hidden">
                              {emp?.profilePicture ? (
                                <img src={emp.profilePicture} alt={emp.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-bold text-accent-red">{emp?.name.charAt(0)}</span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-slate-700">{emp?.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('projects.keyDates')}</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-500">{t('projects.startDate')}</span>
                      <span className="text-xs font-black text-slate-700">{viewProject.startDate || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                      <span className="text-xs font-bold text-rose-500">{t('projects.deadlineLabel')}</span>
                      <span className="text-xs font-black text-rose-700">{viewProject.deadline}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('projects.description')}</p>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 min-h-[100px]">
                    <p className="text-sm text-slate-600 leading-relaxed italic">
                      {viewProject.description || t('projects.noDescription')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setViewProject(null)}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title={t('projects.deleteTitle')}
        message={t('projects.deleteMessage')}
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};
