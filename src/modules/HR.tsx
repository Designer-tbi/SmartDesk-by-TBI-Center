import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { MOCK_EMPLOYEES, MOCK_LEAVES, MOCK_PAYSLIPS, MOCK_CONTRACTS, MOCK_CONTRACT_TEMPLATES } from '../constants';
import { 
  Plus, Mail, Phone, MapPin, Briefcase, Calendar, DollarSign, X, Pencil, Trash2, Eye, 
  Users, Coffee, CreditCard, BarChart3, Search, Filter, Download, CheckCircle, Clock, AlertCircle,
  FileText, Send, Check, Copy, Layout, Link as LinkIcon, FileSignature, Eraser, Loader2
} from 'lucide-react';
import { Employee, LeaveRequest, Payslip, Contract, ContractTemplate } from '../types';

import { useTranslation } from '../lib/i18n';

import { ConfirmModal } from '../components/ConfirmModal';

export const HR = ({ user }: { user: any }) => {
  const { t } = useTranslation();
  const isUS = user?.country === 'USA';
  const currencySymbol = user?.currency === 'USD' ? '$' : user?.currency === 'EUR' ? '€' : user?.currency === 'XAF' ? 'XAF' : (isUS ? '$' : '€');

  const taxLabel = isUS ? t('accounting.salesTax') : t('accounting.tva');
  const [activeTab, setActiveTab] = useState<'directory' | 'leaves' | 'payroll' | 'contracts' | 'stats'>('directory');
  const [contractSubTab, setContractSubTab] = useState<'list' | 'templates' | 'signed'>('list');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [signingContract, setSigningContract] = useState<Contract | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({ 
    name: '', role: '', department: '', email: '', phone: '', address: '', 
    status: 'Active', contractType: 'CDI', joinDate: '', salary: 0, 
    profilePicture: '', documents: [] 
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
      const [empRes, leavesRes, payslipsRes, contractsRes, templatesRes] = await Promise.all([
        apiFetch('/api/employees'),
        apiFetch('/api/employees/leaves'),
        apiFetch('/api/employees/payslips'),
        apiFetch('/api/employees/contracts'),
        apiFetch('/api/employees/contract-templates')
      ]);
      
      if (empRes.ok) setEmployees(await empRes.json());
      if (leavesRes.ok) setLeaves(await leavesRes.json());
      if (payslipsRes.ok) setPayslips(await payslipsRes.json());
      if (contractsRes.ok) setContracts(await contractsRes.json());
      if (templatesRes.ok) setTemplates(await templatesRes.json());
    } catch (error) {
      console.error('Failed to fetch HR data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || t('hr.unknown');

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
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      const response = await apiFetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchData();
        setDeleteConfirmId(null);
      } else {
        setError(t('hr.deleteError'));
      }
    } catch (error) {
      console.error('Failed to delete employee:', error);
      setError(t('hr.connectionError'));
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
    alert(t('hr.linkCopied'));
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         emp.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = departmentFilter === 'All' || emp.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const departments = ['All', ...new Set(employees.map(e => e.department))];

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
            {t('hr.directory')}
          </button>
          <button
            onClick={() => setActiveTab('contracts')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'contracts' ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <FileText className="w-4 h-4" />
            {t('hr.contracts')}
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'leaves' ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Coffee className="w-4 h-4" />
            {t('hr.leaves')}
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'payroll' ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            {t('hr.payroll')}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'stats' ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {t('hr.stats')}
          </button>
        </div>
        
        {activeTab === 'directory' && (
          <button 
            onClick={() => { setEditingEmployee(null); setNewEmployee({ name: '', role: '', department: '', email: '', joinDate: '', salary: 0 }); setIsModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            {t('hr.newEmployee')}
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
                {t('hr.newContract')}
              </button>
            )}
            {contractSubTab === 'templates' && (
              <button 
                onClick={() => setIsTemplateModalOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                {t('hr.newTemplate')}
              </button>
            )}
            {contractSubTab === 'signed' && (
              <label className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 cursor-pointer">
                <Plus className="w-5 h-5" />
                {t('hr.receiveContract')}
                <input type="file" className="hidden" onChange={(e) => alert(t('hr.fileReceived'))} />
              </label>
            )}
          </div>
        )}
      </div>

      {/* Directory View */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder={t('hr.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
                {departments.map(dept => (
                  <button
                    key={dept}
                    onClick={() => setDepartmentFilter(dept)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      departmentFilter === dept 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-200'
                    }`}
                  >
                    {dept === 'All' ? t('common.all') : dept}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {isLoading ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-sm font-medium text-slate-500">{t('hr.loadingDirectory')}</p>
              </div>
            ) : filteredEmployees.length > 0 ? filteredEmployees.map((employee) => (
              <div key={employee.id} className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 sm:gap-6 group hover:shadow-md transition-all relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl sm:text-3xl font-bold text-indigo-600 shrink-0 overflow-hidden border border-indigo-100 mx-auto sm:mx-0">
                  {employee.profilePicture ? <img src={employee.profilePicture} alt="Profile" className="w-full h-full object-cover" /> : employee.name.charAt(0)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-lg font-bold text-slate-900 truncate pr-8 sm:pr-0">{employee.name}</h3>
                    <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all sm:translate-x-2 sm:group-hover:translate-x-0 absolute top-4 right-4 sm:static">
                      <button onClick={() => setViewEmployee(employee)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all shadow-sm" title={t('hr.view')}><Eye className="w-4 h-4" /></button>
                      <button onClick={() => { setEditingEmployee(employee); setNewEmployee(employee); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all shadow-sm" title={t('hr.edit')}><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteConfirmId(employee.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shadow-sm" title={t('hr.delete')}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="text-sm text-indigo-600 font-semibold mb-4 text-center sm:text-left">{employee.role}</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{employee.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{t('hr.joined')}: {employee.joinDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{employee.department}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {employee.salary.toLocaleString()} {currencySymbol}
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="col-span-full text-center py-20 text-slate-500">
                {t('hr.noEmployeeFound')}
              </div>
            )}
          </div>
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
              {t('hr.contractList')}
            </button>
            <button 
              onClick={() => setContractSubTab('templates')}
              className={`pb-3 text-sm font-bold transition-all border-b-2 ${contractSubTab === 'templates' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              {t('hr.contractTemplates')}
            </button>
            <button 
              onClick={() => setContractSubTab('signed')}
              className={`pb-3 text-sm font-bold transition-all border-b-2 ${contractSubTab === 'signed' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              {t('hr.signedContracts')}
            </button>
          </div>

          {contractSubTab === 'list' ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">{t('hr.contractManagement')}</h3>
                <div className="flex gap-2">
                  <button className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg"><Filter className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">ID / Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.employee')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.contractType')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.salary')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.status')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">{t('inventory.actions')}</th>
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
                            {contract.status === 'Active' ? t('hr.active') : 
                             contract.status === 'Signed' ? t('hr.signed') :
                             contract.status === 'Sent' ? t('hr.sent') : t('hr.draft')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {contract.status === 'Sent' && contract.signatureLink && (
                              <button 
                                onClick={() => copyToClipboard(contract.signatureLink!)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title={t('hr.copyLink')}
                              >
                                <LinkIcon className="w-4 h-4" />
                              </button>
                            )}
                            {contract.status === 'Sent' && (
                              <button 
                                onClick={() => setSigningContract(contract)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title={t('hr.signContract')}
                              >
                                <FileSignature className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleSendContract(contract.id)}
                              disabled={isSending === contract.id}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title={t('hr.sendEmail')}
                            >
                              {isSending === contract.id ? (
                                <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title={t('hr.download')}>
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
                  <p className="text-xs text-slate-500 mb-4">{t('hr.contractType')}: <span className="font-bold text-indigo-600">{template.type}</span></p>
                  <div className="p-3 bg-slate-50 rounded-xl mb-4">
                    <p className="text-[10px] text-slate-400 line-clamp-3 font-serif leading-relaxed italic">
                      {template.content}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <span>{t('hr.modifiedOn')} {template.lastModified}</span>
                    <button 
                      onClick={() => {
                        applyTemplate(template.id);
                        setContractSubTab('list');
                        setIsContractModalOpen(true);
                      }}
                      className="flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      <Copy className="w-3 h-3" /> {t('hr.useTemplate')}
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
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">{t('hr.receptionSpace')}</h3>
                <p className="text-slate-500 text-sm max-w-md mb-8">
                  {t('hr.receptionDescription')}
                </p>
                
                <div className="w-full overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.contract')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.employee')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.signedAt')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">{t('inventory.actions')}</th>
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
                            {t('hr.noSignedContracts')}
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
            <h3 className="font-bold text-slate-900">{t('hr.leaveRequests')}</h3>
            <div className="flex gap-2">
              <button className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg"><Filter className="w-4 h-4" /></button>
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm">
                <Plus className="w-4 h-4" /> {t('hr.newRequest')}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.employee')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.type')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.period')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.status')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">{t('inventory.actions')}</th>
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
                      <div className="text-xs text-slate-600">{t('common.from')} {leave.startDate}</div>
                      <div className="text-xs text-slate-600">{t('common.to')} {leave.endDate}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 w-fit ${
                        leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 
                        leave.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {leave.status === 'Approved' ? <CheckCircle className="w-3 h-3" /> : 
                         leave.status === 'Pending' ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {leave.status === 'Approved' ? t('hr.approved') : leave.status === 'Pending' ? t('hr.pending') : t('hr.rejected')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-xs font-bold text-indigo-600 hover:underline">{t('common.manage')}</button>
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
            <h3 className="font-bold text-slate-900">{t('hr.payrollManagement')}</h3>
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm">
              <Download className="w-4 h-4" /> {t('hr.generatePayslips')}
            </button>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.employee')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.period')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.netSalary')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('hr.status')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">{t('inventory.actions')}</th>
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
                        {payslip.status === 'Paid' ? t('hr.paid') : t('hr.draft')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-indigo-600" title={t('hr.download')}><Download className="w-4 h-4" /></button>
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
              <span className="text-xs font-bold text-emerald-600">{t('hr.newThisMonth')}</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{employees.length}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('hr.totalStaff')}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Coffee className="w-5 h-5" /></div>
              <span className="text-xs font-bold text-amber-600">{leaves.filter(l => l.status === 'Approved').length} {t('hr.active')}</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{leaves.filter(l => l.status === 'Approved').length}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('hr.activeLeaves')}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign className="w-5 h-5" /></div>
              <span className="text-xs font-bold text-slate-400">{t('hr.payrollTotal')}</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{(employees.reduce((acc, curr) => acc + curr.salary, 0) / 12).toLocaleString()}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{currencySymbol} / {t('common.month')}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Briefcase className="w-5 h-5" /></div>
              <span className="text-xs font-bold text-slate-400">{t('hr.departments')}</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{new Set(employees.map(e => e.department)).size}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('hr.activeUnits')}</div>
          </div>
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
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" value={newTemplate.name} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} placeholder="Ex: CDI Standard" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Type par défaut</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newTemplate.type}
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
                  value={newTemplate.content}
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
                    value={newContract.employeeId}
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
                    value={newContract.type}
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
                  <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" value={newContract.startDate} onChange={e => setNewContract({...newContract, startDate: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Salaire Mensuel ({currencySymbol})</label>
                  <input type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" value={newContract.salary} onChange={e => setNewContract({...newContract, salary: parseInt(e.target.value)})} required />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contenu du Contrat</label>
                <textarea 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[200px]"
                  placeholder="Rédigez les termes du contrat ici..."
                  value={newContract.content}
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

      {/* Employee Modal (Same as before but integrated) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {editingEmployee ? 'Modifier' : 'Ajouter'} un employé
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X className="w-6 h-6 text-slate-400"/>
              </button>
            </div>
            <form onSubmit={handleSaveEmployee} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nom complet</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email professionnel</label>
                  <input type="email" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Poste / Rôle</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Département</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" value={newEmployee.department} onChange={e => setNewEmployee({...newEmployee, department: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Salaire Annuel ({currencySymbol})</label>
                  <input type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold" value={newEmployee.salary} onChange={e => setNewEmployee({...newEmployee, salary: parseInt(e.target.value)})} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date d'embauche</label>
                  <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" value={newEmployee.joinDate} onChange={e => setNewEmployee({...newEmployee, joinDate: e.target.value})} required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Photo de Profil</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                      {newEmployee.profilePicture ? (
                        <img src={newEmployee.profilePicture} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <label className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50 transition-all">
                      Choisir une photo
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'picture')} />
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Documents (Contrat, ID, etc.)</label>
                  <label className="flex items-center justify-center w-full px-4 py-3 bg-white border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 cursor-pointer hover:border-indigo-300 hover:text-indigo-500 transition-all">
                    <Plus className="w-4 h-4 mr-2" /> Ajouter un document
                    <input type="file" className="hidden" onChange={(e) => handleFileChange(e, 'document')} />
                  </label>
                  {newEmployee.documents && newEmployee.documents.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newEmployee.documents.map((doc, idx) => (
                        <div key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold flex items-center gap-1">
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
              
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">Annuler</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">Enregistrer l'employé</button>
              </div>
            </form>
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
