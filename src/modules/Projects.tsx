import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Plus, Calendar, CheckCircle2, Circle, Clock, MoreHorizontal, X, Pencil, Trash2, Eye, Loader2 } from 'lucide-react';
import { Project } from '../types';

export const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewProject, setViewProject] = useState<Project | null>(null);
  const [newProject, setNewProject] = useState<Partial<Project>>({ name: '', client: '', status: 'Planning', deadline: '', progress: 0, description: '', details: '' });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-100 text-emerald-700';
      case 'In Progress': return 'bg-blue-100 text-blue-700';
      case 'Planning': return 'bg-slate-100 text-slate-700';
      case 'On Hold': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
        const id = Math.random().toString(36).substr(2, 9);
        const response = await apiFetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newProject, id }),
        });
        if (response.ok) fetchProjects();
      }
      setIsModalOpen(false);
      setNewProject({ name: '', client: '', status: 'Planning', deadline: '', progress: 0, description: '', details: '' });
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      try {
        const response = await apiFetch(`/api/projects/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) fetchProjects();
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Projets en cours</h2>
        <button onClick={() => { setEditingProject(null); setNewProject({ name: '', client: '', status: 'Planning', deadline: '', progress: 0, description: '', details: '' }); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Nouveau Projet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-sm font-medium text-slate-500">Chargement des projets...</p>
          </div>
        ) : projects.length > 0 ? projects.map((project) => (
          <div key={project.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setViewProject(project)} className="text-slate-400 hover:text-indigo-600"><Eye className="w-4 h-4" /></button>
                <button onClick={() => { setEditingProject(project); setNewProject(project); setIsModalOpen(true); }} className="text-slate-400 hover:text-amber-600"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(project.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-1">{project.name}</h3>
            <p className="text-sm text-slate-500 mb-6">Client: {project.client}</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Progression</span>
                <span className="font-semibold text-slate-900">{project.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${project.progress}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  {project.deadline}
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full text-center py-20 text-slate-500">
            Aucun projet trouvé.
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">{editingProject ? 'Modifier' : 'Ajouter'} un projet</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <input type="text" placeholder="Nom" className="w-full p-2 border rounded-lg" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} required />
              <input type="text" placeholder="Client" className="w-full p-2 border rounded-lg" value={newProject.client} onChange={e => setNewProject({...newProject, client: e.target.value})} required />
              <select className="w-full p-2 border rounded-lg" value={newProject.status} onChange={e => setNewProject({...newProject, status: e.target.value as any})} required>
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
              <input type="date" className="w-full p-2 border rounded-lg" value={newProject.deadline} onChange={e => setNewProject({...newProject, deadline: e.target.value})} required />
              <input type="number" placeholder="Progression (%)" className="w-full p-2 border rounded-lg" value={newProject.progress} onChange={e => setNewProject({...newProject, progress: parseInt(e.target.value)})} required />
              <textarea placeholder="Description" className="w-full p-2 border rounded-lg" value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} />
              <textarea placeholder="Détails" className="w-full p-2 border rounded-lg" value={newProject.details} onChange={e => setNewProject({...newProject, details: e.target.value})} />
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold">Enregistrer</button>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {viewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md sm:max-w-lg md:max-w-xl rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Détails Projet</h3>
              <button onClick={() => setViewProject(null)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <div className="space-y-2">
              <p><strong>Nom:</strong> {viewProject.name}</p>
              <p><strong>Client:</strong> {viewProject.client}</p>
              <p><strong>Status:</strong> {viewProject.status}</p>
              <p><strong>Deadline:</strong> {viewProject.deadline}</p>
              <p><strong>Progression:</strong> {viewProject.progress}%</p>
              <p><strong>Description:</strong> {viewProject.description}</p>
              <p><strong>Détails:</strong> {viewProject.details}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
