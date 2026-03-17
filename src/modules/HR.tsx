import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { MOCK_EMPLOYEES, MOCK_LEAVES, MOCK_PAYSLIPS, MOCK_CONTRACTS, MOCK_CONTRACT_TEMPLATES } from '../constants';
import { 
  Plus, Mail, Phone, MapPin, Briefcase, Calendar, DollarSign, X, Pencil, Trash2, Eye, 
  Users, User, Coffee, CreditCard, BarChart3, Search, Filter, Download, CheckCircle, Clock, AlertCircle,
  FileText, Send, Check, Copy, Layout, Link as LinkIcon, FileSignature, Eraser, Loader2,
  CalendarDays, CalendarRange, LayoutGrid, CheckSquare, AlertTriangle, ChevronLeft, ChevronRight,
  MoreHorizontal, Target
} from 'lucide-react';
import { Employee, LeaveRequest, Payslip, Contract, ContractTemplate, EmployeeTask } from '../types';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addDays, addWeeks, subWeeks, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

import { useTranslation } from '../lib/i18n';

import { ConfirmModal } from '../components/ConfirmModal';

export const HR = ({ user }: { user: any }) => {
  const { t } = useTranslation();
  const isUS = user?.country === 'USA';
  const currencySymbol = user?.currency === 'USD' ? '$' : user?.currency === 'EUR' ? '€' : user?.currency === 'XAF' ? 'XAF' : (isUS ? '$' : '€');

  const taxLabel = isUS ? t('accounting.salesTax') : t('accounting.tva');
  const [activeTab, setActiveTab] = useState<'directory' | 'leaves' | 'payroll' | 'contracts' | 'stats' | 'tasks'>('directory');
  const [contractSubTab, setContractSubTab] = useState<'list' | 'templates' | 'signed'>('list');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  const [taskView, setTaskView] = useState<'day' | 'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [signingContract, setSigningContract] = useState<Contract | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [modalTab, setModalTab] = useState<'info' | 'tasks'>('info');
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({ 
    name: '', role: '', department: '', email: '', phone: '', address: '', 
    status: 'Active', contractType: 'CDI', joinDate: '', salary: 0, 
    profilePicture: '', documents: [] 
  });

  const [newTask, setNewTask] = useState<Partial<EmployeeTask>>({
    employeeId: '', title: '', description: '', date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00', endTime: '10:00', status: 'Todo', priority: 'Medium'
  });

  const [newContract, setNewContract] = useState<Partial<Contract>>({
    employeeId: '', type: 'CDI', startDate: '', salary: 0, content: '', status: 'Draft'
  });

  const [newTemplate, setNewTemplate] = useState<Partial<ContractTemplate>>({
    name: '', type: 'CDI', content: ''
  });

  const [isSending, setIsSending] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [empRes, leavesRes, payslipsRes, contractsRes, templatesRes, tasksRes] = await Promise.all([
        apiFetch('/api/employees'),
        apiFetch('/api/employees/leaves'),
        apiFetch('/api/employees/payslips'),
        apiFetch('/api/employees/contracts'),
        apiFetch('/api/employees/contract-templates'),
        apiFetch('/api/employees/tasks')
      ]);
      
      if (empRes.ok) setEmployees(await empRes.json());
      if (leavesRes.ok) setLeaves(await leavesRes.json());
      if (payslipsRes.ok) setPayslips(await payslipsRes.json());
      if (contractsRes.ok) setContracts(await contractsRes.json());
      if (templatesRes.ok) setTemplates(await templatesRes.json());
      if (tasksRes.ok) setTasks(await tasksRes.json());
    } catch (error) {
      console.error('Failed to fetch HR data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const id = Math.random().toString(36).substr(2, 9);
      const response = await apiFetch('/api/employees/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTask, id }),
      });
      if (response.ok) {
        fetchData();
        setIsTaskModalOpen(false);
        setNewTask({
          employeeId: '', title: '', description: '', date: format(new Date(), 'yyyy-MM-dd'),
          startTime: '09:00', endTime: '10:00', status: 'Todo', priority: 'Medium'
        });
      }
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const response = await apiFetch(`/api/employees/tasks/${id}`, { method: 'DELETE' });
      if (response.ok) fetchData();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || 'Inconnu';

  const openAddModal = () => {
    setEditingEmployee(null);
    setModalTab('info');
    setNewEmployee({ name: '', role: '', department: '', email: '', phone: '', address: '', status: 'Active', contractType: 'CDI', joinDate: '', salary: 0, profilePicture: '', documents: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setModalTab('info');
    setNewEmployee(employee);
    setIsModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'picture' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'picture') {
        setNewEmployee({ ...newEmployee, profilePicture: reader.result as string });
      } else {
        setNewEmployee({ ...newEmployee, documents: [...(newEmployee.documents || []), { name: file.name, url: reader.result as string }] });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingEmployee) {
        const response = await apiFetch(`/api/employees/${editingEmployee.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEmployee),
        });
        if (response.ok) fetchData();
        setEditingEmployee(null);
      } else {
        const id = Math.random().toString(36).substr(2, 9);
        const response = await apiFetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newEmployee, id }),
        });
        if (response.ok) fetchData();
      }
      setIsModalOpen(false);
      setNewEmployee({ name: '', role: '', department: '', email: '', phone: '', address: '', status: 'Active', contractType: 'CDI', joinDate: '', salary: 0, profilePicture: '', documents: [] });
    } catch (error) {
      console.error('Failed to save employee:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      const response = await apiFetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchData();
        setDeleteConfirmId(null);
      } else {
        setError('Erreur lors de la suppression.');
      }
    } catch (error) {
      console.error('Failed to delete employee:', error);
      setError('Erreur de connexion.');
    }
  };

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    const contract: Contract = {
      id: `CTR-${Date.now()}`,
      employeeId: newContract.employeeId || '',
      type: newContract.type as any || 'CDI',
      startDate: newContract.startDate || '',
      salary: newContract.salary || 0,
      status: 'Draft',
      content: newContract.content || '',
      createdAt: new Date().toISOString().split('T')[0]
    };
    try {
      const response = await apiFetch('/api/employees/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contract),
      });
      if (response.ok) {
        fetchData();
        setIsContractModalOpen(false);
        setNewContract({ employeeId: '', type: 'CDI', startDate: '', salary: 0, content: '', status: 'Draft' });
      }
    } catch (error) {
      console.error('Failed to save contract:', error);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const template: ContractTemplate = {
      id: `TMP-${Date.now()}`,
      name: newTemplate.name || '',
      type: newTemplate.type as any || 'CDI',
      content: newTemplate.content || '',
      lastModified: new Date().toISOString().split('T')[0]
    };
    try {
      const response = await apiFetch('/api/employees/contract-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (response.ok) {
        fetchData();
        setIsTemplateModalOpen(false);
        setNewTemplate({ name: '', type: 'CDI', content: '' });
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setNewContract({ ...newContract, content: template.content, type: template.type });
    }
  };

  const handleSendContract = async (id: string) => {
    setIsSending(id);
    const contract = contracts.find(c => c.id === id);
    if (!contract) return;
    
    try {
      const response = await apiFetch(`/api/employees/contracts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contract,
          status: 'Sent',
          signatureLink: `${window.location.origin}/sign/${id}`
        }),
      });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to send contract:', error);
    } finally {
      setIsSending(null);
    }
  };

  const handleSignContract = async (id: string) => {
    const contract = contracts.find(c => c.id === id);
    if (!contract) return;
    
    try {
      const response = await apiFetch(`/api/employees/contracts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contract,
          status: 'Signed',
          signedAt: new Date().toISOString().split('T')[0]
        }),
      });
      if (response.ok) {
        fetchData();
        setSigningContract(null);
        setHasSignature(false);
      }
    } catch (error) {
      console.error('Failed to sign contract:', error);
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Lien copié dans le presse-papier !');
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-fit overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'directory' ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Users className="w-4 h-4" />
            Annuaire
          </button>
          <button
            onClick={() => setActiveTab('contracts')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'contracts' ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <FileText className="w-4 h-4" />
            Contrats
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'leaves' ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Coffee className="w-4 h-4" />
            Congés
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'payroll' ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Paie
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'stats' ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analyses
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'tasks' ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Tâches
          </button>
        </div>
        
        {activeTab === 'directory' && (
          <button 
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nouvel Employé
          </button>
        )}

        {activeTab === 'contracts' && (
          <div className="flex gap-2">
            {contractSubTab === 'list' && (
              <button 
                onClick={() => setIsContractModalOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Nouveau Contrat
              </button>
            )}
            {contractSubTab === 'templates' && (
              <button 
                onClick={() => setIsTemplateModalOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Nouveau Modèle
              </button>
            )}
            {contractSubTab === 'signed' && (
              <label className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 cursor-pointer">
                <Plus className="w-5 h-5" />
                Réceptionner un Contrat
                <input type="file" className="hidden" onChange={(e) => alert('Fichier réceptionné et archivé !')} />
              </label>
            )}
          </div>
        )}
      </div>

      {/* Directory View */}
      {activeTab === 'directory' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isLoading ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-slate-500">Chargement de l'annuaire...</p>
            </div>
          ) : employees.length > 0 ? employees.map((employee) => (
            <div key={employee.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex gap-6 group hover:shadow-md transition-all">
              <div className="w-24 h-24 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl font-bold text-indigo-600 shrink-0 overflow-hidden border border-indigo-100">
                {employee.profilePicture ? <img src={employee.profilePicture} alt="Profile" className="w-full h-full object-cover" /> : employee.name.charAt(0)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-lg font-bold text-slate-900 truncate">{employee.name}</h3>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all sm:translate-x-2 sm:group-hover:translate-x-0">
                    <button onClick={() => setViewEmployee(employee)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all shadow-sm" title="Voir"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openEditModal(employee)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all shadow-sm" title="Modifier"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteConfirmId(employee.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shadow-sm" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <p className="text-sm text-indigo-600 font-semibold mb-4">{employee.role}</p>
                
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{employee.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Arrivée: {employee.joinDate}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    {employee.department}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    {employee.salary.toLocaleString()} {currencySymbol}
                  </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center py-20 text-slate-500">
              Aucun employé trouvé.
            </div>
          )}
        </div>
      )}

      {/* Contracts View */}
      {activeTab === 'contracts' && (
        <div className="space-y-6">
          <div className="flex gap-4 border-b border-slate-200">
            <button 
              onClick={() => setContractSubTab('list')}
              className={`pb-3 text-sm font-bold transition-all border-b-2 ${contractSubTab === 'list' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Liste des Contrats
            </button>
            <button 
              onClick={() => setContractSubTab('templates')}
              className={`pb-3 text-sm font-bold transition-all border-b-2 ${contractSubTab === 'templates' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Modèles de Contrats
            </button>
            <button 
              onClick={() => setContractSubTab('signed')}
              className={`pb-3 text-sm font-bold transition-all border-b-2 ${contractSubTab === 'signed' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Contrats Signés / Réception
            </button>
          </div>

          {contractSubTab === 'list' ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Gestion des Contrats</h3>
                <div className="flex gap-2">
                  <button className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg"><Filter className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">ID / Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Employé</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Salaire</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contracts.map((contract) => (
                      <tr key={contract.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900">{contract.id}</div>
                          <div className="text-[10px] text-slate-400">{contract.createdAt}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900">{getEmployeeName(contract.employeeId)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">{contract.type}</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">
                          {contract.salary.toLocaleString()} {currencySymbol}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 w-fit ${
                            contract.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 
                            contract.status === 'Signed' ? 'bg-blue-50 text-blue-600' :
                            contract.status === 'Sent' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {contract.status === 'Active' ? <Check className="w-3 h-3" /> : 
                             contract.status === 'Signed' ? <FileSignature className="w-3 h-3" /> :
                             contract.status === 'Sent' ? <Send className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {contract.status === 'Active' ? 'Actif' : 
                             contract.status === 'Signed' ? 'Signé' :
                             contract.status === 'Sent' ? 'Envoyé' : 'Brouillon'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {contract.status === 'Sent' && contract.signatureLink && (
                              <button 
                                onClick={() => copyToClipboard(contract.signatureLink!)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Copier le lien de signature"
                              >
                                <LinkIcon className="w-4 h-4" />
                              </button>
                            )}
                            {contract.status === 'Sent' && (
                              <button 
                                onClick={() => setSigningContract(contract)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Signer le contrat (Interne)"
                              >
                                <FileSignature className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleSendContract(contract.id)}
                              disabled={isSending === contract.id}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Envoyer par mail"
                            >
                              {isSending === contract.id ? (
                                <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : contractSubTab === 'templates' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div key={template.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Layout className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Pencil className="w-4 h-4" /></button>
                      <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1">{template.name}</h4>
                  <p className="text-xs text-slate-500 mb-4">Type: <span className="font-bold text-indigo-600">{template.type}</span></p>
                  <div className="p-3 bg-slate-50 rounded-xl mb-4">
                    <p className="text-[10px] text-slate-400 line-clamp-3 font-serif leading-relaxed italic">
                      {template.content}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <span>Modifié le {template.lastModified}</span>
                    <button 
                      onClick={() => {
                        applyTemplate(template.id);
                        setContractSubTab('list');
                        setIsContractModalOpen(true);
                      }}
                      className="flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      <Copy className="w-3 h-3" /> Utiliser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                  <FileSignature className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Espace de Réception</h3>
                <p className="text-slate-500 text-sm max-w-md mb-8">
                  Consultez ici tous les contrats signés numériquement ou téléchargez des contrats signés manuellement pour archivage.
                </p>
                
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Contrat</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Employé</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date Signature</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contracts.filter(c => c.status === 'Signed' || c.status === 'Active').map((contract) => (
                        <tr key={contract.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-900">{contract.id}</div>
                            <div className="text-[10px] text-slate-400">{contract.type}</div>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900">{getEmployeeName(contract.employeeId)}</td>
                          <td className="px-6 py-4 text-sm text-slate-500 font-medium">{contract.signedAt || contract.startDate}</td>
                          <td className="px-6 py-4 text-right">
                            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                              <Download className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {contracts.filter(c => c.status === 'Signed' || c.status === 'Active').length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                            Aucun contrat signé pour le moment.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaves View */}
      {activeTab === 'leaves' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Demandes de Congés</h3>
            <div className="flex gap-2">
              <button className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg"><Filter className="w-4 h-4" /></button>
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm">
                <Plus className="w-4 h-4" /> Nouvelle Demande
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Employé</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Période</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">{getEmployeeName(leave.employeeId)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">{leave.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-600">Du {leave.startDate}</div>
                      <div className="text-xs text-slate-600">Au {leave.endDate}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 w-fit ${
                        leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 
                        leave.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {leave.status === 'Approved' ? <CheckCircle className="w-3 h-3" /> : 
                         leave.status === 'Pending' ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {leave.status === 'Approved' ? 'Approuvé' : leave.status === 'Pending' ? 'En attente' : 'Refusé'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-xs font-bold text-indigo-600 hover:underline">Gérer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll View */}
      {activeTab === 'payroll' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Gestion de la Paie</h3>
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm">
              <Download className="w-4 h-4" /> Générer les Bulletins
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Employé</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Période</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Salaire Net</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payslips.map((payslip) => (
                  <tr key={payslip.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">{getEmployeeName(payslip.employeeId)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {payslip.month} {payslip.year}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {payslip.netSalary.toLocaleString()} {currencySymbol}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        payslip.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {payslip.status === 'Paid' ? 'Payé' : 'Brouillon'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-indigo-600"><Download className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats View */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Users className="w-5 h-5" /></div>
              <span className="text-xs font-bold text-emerald-600">+2 ce mois</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{employees.length}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Effectif Total</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Coffee className="w-5 h-5" /></div>
              <span className="text-xs font-bold text-amber-600">3 actifs</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{leaves.filter(l => l.status === 'Approved').length}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Congés en cours</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign className="w-5 h-5" /></div>
              <span className="text-xs font-bold text-slate-400">Masse salariale</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{(employees.reduce((acc, curr) => acc + curr.salary, 0) / 12).toLocaleString()}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{currencySymbol} / mois</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Briefcase className="w-5 h-5" /></div>
              <span className="text-xs font-bold text-slate-400">Départements</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{new Set(employees.map(e => e.department)).size}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Unités actives</div>
          </div>
        </div>
      )}

      {/* Tasks View */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><ChevronLeft className="w-5 h-5" /></button>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                {format(currentDate, 'MMMM yyyy', { locale: fr })}
              </h3>
              <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
                <Target className="w-4 h-4" />
                {tasks.length} Tâches au total
              </div>
            </div>
          </div>

          {taskView === 'month' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-100">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                  <div key={day} className="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-50 last:border-0">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {eachDayOfInterval({
                  start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
                  end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
                }).map((day, idx) => {
                  const dayTasks = tasks.filter(t => isSameDay(new Date(t.date), day));
                  return (
                    <div key={idx} className={`min-h-[120px] p-2 border-r border-b border-slate-50 last:border-r-0 ${!isSameMonth(day, currentDate) ? 'bg-slate-50/50' : ''}`}>
                      <div className={`text-xs font-bold mb-2 ${isSameDay(day, new Date()) ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayTasks.map(task => (
                          <div 
                            key={task.id} 
                            className={`p-1.5 rounded-lg text-[10px] font-bold truncate cursor-pointer transition-all hover:scale-[1.02] ${
                              task.priority === 'High' ? 'bg-red-50 text-red-600 border border-red-100' :
                              task.priority === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                              'bg-indigo-50 text-indigo-600 border border-indigo-100'
                            }`}
                            title={task.title}
                          >
                            {task.startTime} {task.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {taskView === 'week' && (
            <div className="grid grid-cols-7 gap-4">
              {eachDayOfInterval({
                start: startOfWeek(currentDate, { weekStartsOn: 1 }),
                end: endOfWeek(currentDate, { weekStartsOn: 1 })
              }).map((day, idx) => {
                const dayTasks = tasks.filter(t => isSameDay(new Date(t.date), day));
                return (
                  <div key={idx} className="space-y-4">
                    <div className={`p-3 rounded-2xl text-center border ${isSameDay(day, new Date()) ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-white text-slate-900 border-slate-200 shadow-sm'}`}>
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">{format(day, 'EEE', { locale: fr })}</div>
                      <div className="text-lg font-black">{format(day, 'd')}</div>
                    </div>
                    <div className="space-y-3">
                      {dayTasks.map(task => (
                        <div key={task.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                          <div className={`absolute top-0 left-0 w-1 h-full ${
                            task.priority === 'High' ? 'bg-red-500' :
                            task.priority === 'Medium' ? 'bg-amber-500' : 'bg-indigo-500'
                          }`} />
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-slate-400">{task.startTime} - {task.endTime}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 mb-1 line-clamp-2">{task.title}</h4>
                          <p className="text-[10px] text-slate-500 font-medium truncate">{getEmployeeName(task.employeeId)}</p>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          setNewTask({...newTask, date: format(day, 'yyyy-MM-dd')});
                          setIsTaskModalOpen(true);
                        }}
                        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-300 hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {taskView === 'day' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Tâches du {format(currentDate, 'd MMMM yyyy', { locale: fr })}</h3>
                <button onClick={() => setIsTaskModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all">
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {tasks.filter(t => isSameDay(new Date(t.date), currentDate)).length > 0 ? (
                  tasks.filter(t => isSameDay(new Date(t.date), currentDate)).map(task => (
                    <div key={task.id} className="p-4 flex items-center gap-6 hover:bg-slate-50 transition-all group">
                      <div className="w-20 text-xs font-bold text-slate-400">{task.startTime}</div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-900">{task.title}</h4>
                        <p className="text-xs text-slate-500">{getEmployeeName(task.employeeId)} • {task.description}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          task.priority === 'High' ? 'bg-red-50 text-red-600' :
                          task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {task.priority}
                        </span>
                        <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-slate-400 italic text-sm">
                    Aucune tâche prévue pour ce jour.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Signature Modal */}
      {signingContract && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Signature du Contrat</h3>
                <p className="text-indigo-100 text-xs font-bold mt-1">ID: {signingContract.id} • {getEmployeeName(signingContract.employeeId)}</p>
              </div>
              <button onClick={() => setSigningContract(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X className="w-6 h-6"/>
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 max-h-[400px] overflow-y-auto font-serif text-slate-700 leading-relaxed whitespace-pre-wrap">
                {signingContract.content}
              </div>
              
              <div className="flex flex-col items-center gap-6 pt-6 border-t border-slate-100">
                <div className="w-full max-w-md space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Signature Manuelle</label>
                    <button 
                      onClick={clearSignature}
                      className="flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-widest"
                    >
                      <Eraser className="w-3 h-3" /> Effacer
                    </button>
                  </div>
                  <div className="relative h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-crosshair">
                    <canvas
                      ref={canvasRef}
                      width={448}
                      height={192}
                      className="w-full h-full"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    {!hasSignature && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 italic text-sm">
                        Signez ici avec votre souris ou votre doigt
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-4 w-full">
                  <button onClick={() => { setSigningContract(null); setHasSignature(false); }} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">Annuler</button>
                  <button 
                    onClick={() => handleSignContract(signingContract.id)}
                    disabled={!hasSignature}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-2 ${
                      hasSignature 
                        ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200" 
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    }`}
                  >
                    <FileSignature className="w-5 h-5" />
                    Valider la Signature
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                Nouveau Modèle de Contrat
              </h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X className="w-6 h-6 text-slate-400"/>
              </button>
            </div>
            <form onSubmit={handleSaveTemplate} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nom du Modèle</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" value={newTemplate.name || ''} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} placeholder="Ex: CDI Standard" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Type par défaut</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newTemplate.type || 'CDI'}
                    onChange={e => setNewTemplate({...newTemplate, type: e.target.value as any})}
                    required
                  >
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Stage">Stage</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contenu du Modèle</label>
                <textarea 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[300px] font-serif"
                  placeholder="Rédigez le texte du modèle ici. Utilisez des balises comme [NOM_EMPLOYE]..."
                  value={newTemplate.content || ''}
                  onChange={e => setNewTemplate({...newTemplate, content: e.target.value})}
                  required
                ></textarea>
              </div>
              
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">Annuler</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">Enregistrer le Modèle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contract Modal */}
      {isContractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                Nouveau Contrat
              </h3>
              <button onClick={() => setIsContractModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X className="w-6 h-6 text-slate-400"/>
              </button>
            </div>
            <form onSubmit={handleSaveContract} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Modèle (Optionnel)</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium text-indigo-700"
                    onChange={e => applyTemplate(e.target.value)}
                  >
                    <option value="">Choisir un modèle...</option>
                    {templates.map(tmp => (
                      <option key={tmp.id} value={tmp.id}>{tmp.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Employé</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newContract.employeeId || ''}
                    onChange={e => setNewContract({...newContract, employeeId: e.target.value})}
                    required
                  >
                    <option value="">Sélectionner un employé</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Type de Contrat</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newContract.type || 'CDI'}
                    onChange={e => setNewContract({...newContract, type: e.target.value as any})}
                    required
                  >
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Stage">Stage</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date de début</label>
                  <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" value={newContract.startDate || ''} onChange={e => setNewContract({...newContract, startDate: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Salaire Mensuel ({currencySymbol})</label>
                  <input type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" value={newContract.salary ?? 0} onChange={e => setNewContract({...newContract, salary: parseInt(e.target.value)})} required />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contenu du Contrat</label>
                <textarea 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[200px]"
                  placeholder="Rédigez les termes du contrat ici..."
                  value={newContract.content || ''}
                  onChange={e => setNewContract({...newContract, content: e.target.value})}
                  required
                ></textarea>
              </div>
              
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsContractModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">Annuler</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">Créer le Brouillon</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-indigo-600 p-8 text-white">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <Users className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">
                      {editingEmployee ? 'Modifier' : 'Ajouter'} un employé
                    </h3>
                    <p className="text-indigo-100 text-sm font-bold">Gestion des ressources humaines</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X className="w-8 h-8"/>
                </button>
              </div>

              {editingEmployee && (
                <div className="flex gap-2 bg-black/10 p-1 rounded-2xl w-fit">
                  <button 
                    onClick={() => setModalTab('info')}
                    className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${modalTab === 'info' ? 'bg-white text-indigo-600 shadow-lg' : 'text-white/60 hover:text-white'}`}
                  >
                    Informations
                  </button>
                  <button 
                    onClick={() => setModalTab('tasks')}
                    className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${modalTab === 'tasks' ? 'bg-white text-indigo-600 shadow-lg' : 'text-white/60 hover:text-white'}`}
                  >
                    Tâches & Planning
                  </button>
                </div>
              )}
            </div>

            {modalTab === 'info' ? (
              <form onSubmit={handleSaveEmployee} className="p-8 max-h-[70vh] overflow-y-auto">
                <div className="space-y-10">
                  {/* Section 1: Informations Personnelles */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                      <User className="w-5 h-5 text-indigo-600" />
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Informations Personnelles</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nom complet</label>
                        <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" value={newEmployee.name || ''} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} placeholder="Ex: Jean Dupont" required />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email professionnel</label>
                        <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" value={newEmployee.email || ''} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} placeholder="jean.dupont@entreprise.com" required />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Téléphone</label>
                        <input type="tel" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" value={newEmployee.phone || ''} onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})} placeholder="+33 6 00 00 00 00" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Adresse</label>
                        <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" value={newEmployee.address || ''} onChange={e => setNewEmployee({...newEmployee, address: e.target.value})} placeholder="123 Rue de la Paix, Paris" />
                      </div>
                    </div>
                  </section>

                  {/* Section 2: Poste & Contrat */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Poste & Contrat</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Poste / Rôle</label>
                        <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" value={newEmployee.role || ''} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} placeholder="Ex: Développeur Fullstack" required />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Département</label>
                        <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" value={newEmployee.department || ''} onChange={e => setNewEmployee({...newEmployee, department: e.target.value})} placeholder="Ex: Technique" required />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Type de Contrat</label>
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                          value={newEmployee.contractType || 'CDI'}
                          onChange={e => setNewEmployee({...newEmployee, contractType: e.target.value as any})}
                        >
                          <option value="CDI">CDI</option>
                          <option value="CDD">CDD</option>
                          <option value="Freelance">Freelance</option>
                          <option value="Stage">Stage</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Salaire Annuel ({currencySymbol})</label>
                        <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" value={newEmployee.salary ?? 0} onChange={e => setNewEmployee({...newEmployee, salary: parseInt(e.target.value)})} required />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date d'embauche</label>
                        <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" value={newEmployee.joinDate || ''} onChange={e => setNewEmployee({...newEmployee, joinDate: e.target.value})} required />
                      </div>
                    </div>
                  </section>

                  {/* Section 3: Médias & Documents */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                      <LayoutGrid className="w-5 h-5 text-indigo-600" />
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Médias & Documents</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Photo de Profil</label>
                        <div className="flex items-center gap-6">
                          <div className="w-24 h-24 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                            {newEmployee.profilePicture ? (
                              <img src={newEmployee.profilePicture} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-8 h-8 text-slate-300" />
                            )}
                          </div>
                          <label className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50 transition-all text-center">
                            Changer la photo
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'picture')} />
                          </label>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Documents Administratifs</label>
                        <label className="flex items-center justify-center w-full px-4 py-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-xs font-bold text-slate-400 cursor-pointer hover:border-indigo-300 hover:text-indigo-500 transition-all">
                          <Plus className="w-5 h-5 mr-2" /> Ajouter un document
                          <input type="file" className="hidden" onChange={(e) => handleFileChange(e, 'document')} />
                        </label>
                        {newEmployee.documents && newEmployee.documents.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {newEmployee.documents.map((doc, idx) => (
                              <div key={idx} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-bold flex items-center gap-2 border border-indigo-100">
                                {doc.name}
                                <button type="button" onClick={() => setNewEmployee({...newEmployee, documents: newEmployee.documents?.filter((_, i) => i !== idx)})} className="hover:text-red-500">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </div>

                <div className="flex gap-4 pt-10 mt-10 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">Annuler</button>
                  <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200">
                    {editingEmployee ? 'Mettre à jour' : 'Enregistrer l\'employé'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-8 max-h-[70vh] overflow-y-auto space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-black text-slate-900">Tâches de {editingEmployee?.name}</h4>
                  <button 
                    onClick={() => {
                      setNewTask({ ...newTask, employeeId: editingEmployee?.id });
                      setIsTaskModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Nouvelle Tâche
                  </button>
                </div>

                <div className="space-y-3">
                  {tasks.filter(t => t.employeeId === editingEmployee?.id).length > 0 ? (
                    tasks.filter(t => t.employeeId === editingEmployee?.id).map(task => (
                      <div key={task.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between group hover:border-indigo-200 hover:bg-white transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            task.priority === 'High' ? 'bg-red-100 text-red-600' :
                            task.priority === 'Medium' ? 'bg-amber-100 text-amber-600' :
                            'bg-emerald-100 text-emerald-600'
                          }`}>
                            <CheckSquare className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-sm font-bold text-slate-900">{task.title}</h5>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                                <Calendar className="w-3 h-3" /> {task.date}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                                <Clock className="w-3 h-3" /> {task.startTime} - {task.endTime}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <CheckSquare className="w-8 h-8 text-slate-200" />
                      </div>
                      <p className="text-sm font-bold text-slate-400">Aucune tâche planifiée pour cet employé</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Preview Modal */}
      {viewEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="relative h-32 bg-indigo-600">
              <button 
                onClick={() => setViewEmployee(null)} 
                className="absolute right-4 top-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-md transition-all"
              >
                <X className="w-5 h-5"/>
              </button>
              <div className="absolute -bottom-12 left-8 p-1 bg-white rounded-3xl shadow-lg">
                <div className="w-24 h-24 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl font-bold text-indigo-600 overflow-hidden border border-slate-100">
                  {viewEmployee.profilePicture ? (
                    <img src={viewEmployee.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    viewEmployee.name.charAt(0)
                  )}
                </div>
              </div>
            </div>
            
            <div className="pt-16 p-8 space-y-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900">{viewEmployee.name}</h3>
                <p className="text-indigo-600 font-bold">{viewEmployee.role} • {viewEmployee.department}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium">{viewEmployee.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium">{viewEmployee.phone || 'Non renseigné'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium">{viewEmployee.address || 'Non renseignée'}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium">Arrivée : {viewEmployee.joinDate}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium">Contrat : {viewEmployee.contractType}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-900 font-bold">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm">{viewEmployee.salary.toLocaleString()} {currencySymbol} / an</span>
                  </div>
                </div>
              </div>

              {viewEmployee.documents && viewEmployee.documents.length > 0 && (
                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Documents joints</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {viewEmployee.documents.map((doc, idx) => (
                      <a 
                        key={idx} 
                        href={doc.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all group"
                      >
                        <div className="p-2 bg-white rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors">
                          <Download className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-600 truncate">{doc.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Nouvelle Tâche</h3>
                  <p className="text-indigo-100 text-xs font-bold">Planification employé</p>
                </div>
              </div>
              <button onClick={() => setIsTaskModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X className="w-6 h-6"/>
              </button>
            </div>
            <form onSubmit={handleSaveTask} className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Employé concerné</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                  value={newTask.employeeId || ''}
                  onChange={e => setNewTask({...newTask, employeeId: e.target.value})}
                  required
                >
                  <option value="">Sélectionner un employé</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Titre de la tâche</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" 
                  value={newTask.title || ''} 
                  onChange={e => setNewTask({...newTask, title: e.target.value})} 
                  placeholder="Ex: Formation sécurité"
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" 
                    value={newTask.date || ''} 
                    onChange={e => setNewTask({...newTask, date: e.target.value})} 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Priorité</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                    value={newTask.priority || 'Medium'}
                    onChange={e => setNewTask({...newTask, priority: e.target.value as any})}
                  >
                    <option value="Low">Basse</option>
                    <option value="Medium">Moyenne</option>
                    <option value="High">Haute</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Début</label>
                  <input 
                    type="time" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" 
                    value={newTask.startTime || ''} 
                    onChange={e => setNewTask({...newTask, startTime: e.target.value})} 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Fin</label>
                  <input 
                    type="time" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" 
                    value={newTask.endTime || ''} 
                    onChange={e => setNewTask({...newTask, endTime: e.target.value})} 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description / Notes</label>
                <textarea 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[100px]"
                  value={newTask.description || ''}
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                  placeholder="Détails supplémentaires..."
                ></textarea>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">Annuler</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200">Enregistrer la Tâche</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Supprimer l'employé"
        message="Êtes-vous sûr de vouloir supprimer cet employé ? Cette action est irréversible et supprimera toutes les données associées."
        confirmLabel="Supprimer"
        onConfirm={() => deleteConfirmId && handleDeleteEmployee(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};
