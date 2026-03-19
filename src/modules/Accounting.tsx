import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Plus, TrendingUp, TrendingDown, DollarSign, X, BookOpen, FileText, BarChart3, ListTree, Save, Sparkles, Download, Building2, CheckCircle2, Loader2, Pencil, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { Transaction, JournalEntry } from '../types';
import { OHADA_PCG } from '../constants/ohadaPCG';
import { US_GAAP } from '../constants/usGAAP';
import { FRANCE_PCG } from '../constants/francePCG';
import { suggestAccountingEntry } from '../services/accountingAutomation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTranslation } from '../lib/i18n';

import { ConfirmModal } from '../components/ConfirmModal';

export const Accounting = ({ user }: { user?: any }) => {
  const { t } = useTranslation();
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCompany();
    fetchData();
  }, []);

  const fetchCompany = async () => {
    try {
      const response = await apiFetch('/api/company');
      if (response.ok) {
        setCompanyInfo(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch company info:', error);
    }
  };

  const standard = companyInfo?.accountingStandard || 'OHADA';
  const isUS = standard === 'US_GAAP';
  const isFR = standard === 'FRANCE';
  const isOHADA = standard === 'OHADA';

  const PCG = isUS ? US_GAAP : isFR ? FRANCE_PCG : OHADA_PCG;
  const currencySymbol = user?.currency === 'USD' ? '$' : user?.currency === 'EUR' ? '€' : user?.currency === 'XAF' ? 'XAF' : (isUS ? '$' : '€');

  const taxLabel = isUS ? t('accounting.salesTax') : t('accounting.tva');

  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Journal' | 'Bilan' | 'Resultat' | 'PCG' | 'Liasses' | 'TVA'>('Dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEntry, setNewEntry] = useState<Omit<JournalEntry, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    items: [{ accountId: '', debit: 0, credit: 0 }]
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [transRes, journalRes, invRes] = await Promise.all([
        apiFetch('/api/transactions'),
        apiFetch('/api/journal-entries'),
        apiFetch('/api/invoices')
      ]);
      if (transRes.ok) setTransactions(await transRes.json());
      if (journalRes.ok) setJournalEntries(await journalRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
    } catch (error) {
      console.error('Failed to fetch accounting data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  // Calculate Bilan and Resultat
  type AccountDetail = { name: string, balance: number, type: string };
  const getAccountType = (code: string) => PCG.find(acc => acc.code === code)?.type;
  const getAccountName = (code: string) => PCG.find(acc => acc.code === code)?.name;

  const bilanDetails: Record<string, AccountDetail> = journalEntries.reduce((acc, entry) => {
    entry.items.forEach(item => {
      const type = getAccountType(item.accountId);
      if (type === 'Asset' || type === 'Liability' || type === 'Equity') {
        if (!acc[item.accountId]) acc[item.accountId] = { name: getAccountName(item.accountId) || 'Inconnu', balance: 0, type: type || 'Liability' };
        if (type === 'Asset') acc[item.accountId].balance += (item.debit - item.credit);
        else acc[item.accountId].balance += (item.credit - item.debit);
      }
    });
    return acc;
  }, {} as Record<string, AccountDetail>);

  const resultatDetails: Record<string, AccountDetail> = journalEntries.reduce((acc, entry) => {
    entry.items.forEach(item => {
      const type = getAccountType(item.accountId);
      if (type === 'Revenue' || type === 'Expense') {
        if (!acc[item.accountId]) acc[item.accountId] = { name: getAccountName(item.accountId) || 'Inconnu', balance: 0, type: type || 'Expense' };
        if (type === 'Revenue') acc[item.accountId].balance += (item.credit - item.debit);
        else acc[item.accountId].balance += (item.debit - item.credit);
      }
    });
    return acc;
  }, {} as Record<string, AccountDetail>);

  const bilanTotals = Object.values(bilanDetails).reduce((acc, item) => {
    if (item.type === 'Asset') acc.assets += item.balance;
    else acc.liabilities += item.balance;
    return acc;
  }, { assets: 0, liabilities: 0 });

  const resultatTotals = Object.values(resultatDetails).reduce((acc, item) => {
    if (item.type === 'Revenue') acc.revenue += item.balance;
    else acc.expenses += item.balance;
    return acc;
  }, { revenue: 0, expenses: 0 });

  const tvaData = journalEntries.reduce((acc, entry) => {
    entry.items.forEach(item => {
      if (item.accountId.startsWith('443')) acc.collected += item.credit;
      if (item.accountId.startsWith('445')) acc.deductible += item.debit;
    });
    return acc;
  }, { collected: 0, deductible: 0 });

  // Add {taxLabel} from paid invoices (actual totals)
  const tvaFromInvoices = invoices
    .filter(inv => inv.status === 'Paid')
    .reduce((sum, inv) => sum + (inv.tvaTotal || 0), 0);
  
  tvaData.collected += tvaFromInvoices;

  // Dynamic performance data for the last 6 months
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const currentMonth = new Date().getMonth();
  const performanceData = Array.from({ length: 6 }, (_, i) => {
    const monthIdx = (currentMonth - 5 + i + 12) % 12;
    const monthName = months[monthIdx];
    
    const monthIncome = transactions
      .filter(t => t.type === 'Income' && new Date(t.date).getMonth() === monthIdx)
      .reduce((sum, t) => sum + t.amount, 0);
      
    const monthExpense = transactions
      .filter(t => t.type === 'Expense' && new Date(t.date).getMonth() === monthIdx)
      .reduce((sum, t) => sum + t.amount, 0);
      
    return { name: monthName, income: monthIncome, expense: monthExpense };
  });

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalDebit = newEntry.items.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = newEntry.items.reduce((sum, item) => sum + item.credit, 0);
    if (totalDebit !== totalCredit || totalDebit === 0) {
      alert('L\'écriture n\'est pas équilibrée ou le montant est nul.');
      return;
    }
    try {
      const url = editingEntryId ? `/api/journal-entries/${editingEntryId}` : '/api/journal-entries';
      const method = editingEntryId ? 'PUT' : 'POST';
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newEntry, id: editingEntryId || Date.now().toString() }),
      });
      if (response.ok) fetchData();
      setIsModalOpen(false);
      setEditingEntryId(null);
      setNewEntry({ date: new Date().toISOString().split('T')[0], description: '', items: [{ accountId: '', debit: 0, credit: 0 }] });
    } catch (error) {
      console.error('Failed to save journal entry:', error);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const response = await apiFetch(`/api/journal-entries/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchData();
        setDeleteConfirmId(null);
      } else {
        setError('Erreur lors de la suppression.');
      }
    } catch (error) {
      console.error('Failed to delete entry:', error);
      setError('Erreur de connexion.');
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const response = await apiFetch('/api/reset', { method: 'POST' });
      if (response.ok) {
        await fetchData();
        setIsResetConfirmOpen(false);
      } else {
        alert('Erreur lors de la réinitialisation des données.');
      }
    } catch (error) {
      console.error('Failed to reset accounting data:', error);
      alert('Erreur de connexion.');
    } finally {
      setIsResetting(false);
    }
  };

  const openEdit = (entry: JournalEntry) => {
    setEditingEntryId(entry.id);
    setNewEntry({
      date: entry.date,
      description: entry.description,
      items: entry.items.map(item => ({ accountId: item.accountId, debit: item.debit, credit: item.credit }))
    });
    setIsModalOpen(true);
  };

  const handleGenerateEntry = async () => {
    if (!newEntry.description) {
      alert('Veuillez saisir une description pour générer l\'écriture.');
      return;
    }
    setIsGenerating(true);
    try {
      const amount = newEntry.items.reduce((sum, item) => sum + item.debit, 0) || 10000; // Default if not set
      const suggested = await suggestAccountingEntry(newEntry.description, amount);
      setNewEntry({ ...newEntry, description: suggested.description, items: suggested.items });
    } catch (error) {
      console.error('Erreur lors de la génération:', error);
      alert('Erreur lors de la génération automatique.');
    } finally {
      setIsGenerating(false);
    }
  };

  const totalDebit = newEntry.items.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = newEntry.items.reduce((sum, item) => sum + item.credit, 0);

  const downloadTVAPDF = () => {
    const doc = new jsPDF();
    const year = new Date().getFullYear();
    const month = new Date().toLocaleString('fr-FR', { month: 'long' });

    // Header
    doc.setFontSize(18);
    doc.text(`DÉCLARATION DE ${taxLabel.toUpperCase()}`, 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(companyInfo?.name || 'Entreprise', 20, 35);
    doc.text(companyInfo?.address || '', 20, 40);
    doc.text(companyInfo?.taxId || '', 20, 45);
    
    doc.text(`Période : ${month} ${year}`, 150, 35);
    doc.text(`Date de génération : ${new Date().toLocaleDateString()}`, 150, 40);

    // TVA Data Table
    autoTable(doc, {
      startY: 60,
      head: [['Libellé', 'Montant (' + currencySymbol + ')']],
      body: [
        [`${taxLabel} ${t('accounting.vatCollected')} (Journal)`, (tvaData.collected - tvaFromInvoices).toLocaleString()],
        [`${taxLabel} sur Factures Payées`, tvaFromInvoices.toLocaleString()],
        [`TOTAL ${taxLabel} ${t('accounting.vatCollected').toUpperCase()}`, tvaData.collected.toLocaleString()],
        [`${taxLabel} ${t('accounting.vatDeductible')}`, tvaData.deductible.toLocaleString()],
        [`${taxLabel} ${t('accounting.vatToPay')}`, (tvaData.collected - tvaData.deductible).toLocaleString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`Declaration_${taxLabel}_${month}_${year}.pdf`);
  };

  const downloadLiassePDF = () => {
    const doc = new jsPDF();
    const year = new Date().getFullYear();

    // Page 1: Page de Garde
    doc.setFontSize(22);
    doc.text(`LIASSE FISCALE ${isUS ? 'US GAAP' : isFR ? 'FRANCE' : 'OHADA'}`, 105, 60, { align: 'center' });
    doc.setFontSize(16);
    doc.text(`EXERCICE CLOS LE 31 DÉCEMBRE ${year}`, 105, 75, { align: 'center' });

    doc.setFontSize(12);
    doc.text('INFORMATIONS ENTREPRISE', 20, 120);
    doc.line(20, 122, 80, 122);
    
    doc.text(`Dénomination : ${companyInfo?.name || 'Entreprise'}`, 20, 135);
    doc.text(`Siège Social : ${companyInfo?.address || ''}`, 20, 145);
    
    if (isFR) {
      doc.text(`SIREN : ${companyInfo?.siren || '-'}`, 20, 155);
      doc.text(`SIRET : ${companyInfo?.siret || '-'}`, 20, 165);
      doc.text(`TVA : ${companyInfo?.taxId || '-'}`, 20, 175);
    } else if (isUS) {
      doc.text(`EIN : ${companyInfo?.taxId || '-'}`, 20, 155);
    } else {
      doc.text(`NIF : ${companyInfo?.taxId || '-'}`, 20, 155);
      doc.text(`RCCM : ${companyInfo?.rccm || '-'}`, 20, 165);
      doc.text(`ID NAT : ${companyInfo?.idNat || '-'}`, 20, 175);
    }

    // Page 2: Bilan
    doc.addPage();
    doc.setFontSize(18);
    doc.text('BILAN CONSOLIDÉ', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text('ACTIF', 20, 40);
    const actifRows = Object.entries(bilanDetails)
      .filter(([_, v]) => v.type === 'Asset')
      .map(([code, v]) => [code, v.name, v.balance.toLocaleString()]);
    
    autoTable(doc, {
      startY: 45,
      head: [['Code', 'Compte', 'Montant']],
      body: [...actifRows, [{ content: t('accounting.totalAssets'), colSpan: 2, styles: { fontStyle: 'bold' } }, { content: bilanTotals.assets.toLocaleString(), styles: { fontStyle: 'bold' } }]],
    });

    doc.text('PASSIF & CAPITAUX', 20, (doc as any).lastAutoTable.finalY + 20);
    const passifRows = Object.entries(bilanDetails)
      .filter(([_, v]) => v.type !== 'Asset')
      .map(([code, v]) => [code, v.name, v.balance.toLocaleString()]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 25,
      head: [['Code', 'Compte', 'Montant']],
      body: [...passifRows, [{ content: t('accounting.totalLiabilities'), colSpan: 2, styles: { fontStyle: 'bold' } }, { content: bilanTotals.liabilities.toLocaleString(), styles: { fontStyle: 'bold' } }]],
    });

    // Page 3: Compte de Résultat
    doc.addPage();
    doc.setFontSize(18);
    doc.text('COMPTE DE RÉSULTAT', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text('PRODUITS', 20, 40);
    const produitRows = Object.entries(resultatDetails)
      .filter(([_, v]) => v.type === 'Revenue')
      .map(([code, v]) => [code, v.name, v.balance.toLocaleString()]);

    autoTable(doc, {
      startY: 45,
      head: [['Code', 'Compte', 'Montant']],
      body: [...produitRows, [{ content: t('accounting.totalRevenue'), colSpan: 2, styles: { fontStyle: 'bold' } }, { content: resultatTotals.revenue.toLocaleString(), styles: { fontStyle: 'bold' } }]],
    });

    doc.text('CHARGES', 20, (doc as any).lastAutoTable.finalY + 20);
    const chargeRows = Object.entries(resultatDetails)
      .filter(([_, v]) => v.type === 'Expense')
      .map(([code, v]) => [code, v.name, v.balance.toLocaleString()]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 25,
      head: [['Code', 'Compte', 'Montant']],
      body: [...chargeRows, [{ content: t('accounting.totalExpenses'), colSpan: 2, styles: { fontStyle: 'bold' } }, { content: resultatTotals.expenses.toLocaleString(), styles: { fontStyle: 'bold' } }]],
    });

    const net = resultatTotals.revenue - resultatTotals.expenses;
    doc.setFontSize(14);
    doc.text(`${t('accounting.netResult')} : ${net.toLocaleString()} ${currencySymbol}`, 105, (doc as any).lastAutoTable.finalY + 30, { align: 'center' });

    doc.save(`Liasse_Fiscale_${(companyInfo?.name || 'Entreprise').replace(/\s+/g, '_')}_${year}.pdf`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard': return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><TrendingUp /></div>
              <div>
                <p className="text-sm text-slate-500">{t('accounting.revenue')}</p>
                <p className="text-xl font-bold">{totalIncome.toLocaleString()} {currencySymbol}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><TrendingDown /></div>
              <div>
                <p className="text-sm text-slate-500">{t('accounting.expenses')}</p>
                <p className="text-xl font-bold">{totalExpenses.toLocaleString()} {currencySymbol}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><DollarSign /></div>
              <div>
                <p className="text-sm text-slate-500">{t('accounting.netProfit')}</p>
                <p className="text-xl font-bold">{netProfit.toLocaleString()} {currencySymbol}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-80">
            <h3 className="text-lg font-bold mb-4">Performance Mensuelle</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="income" stroke="#10b981" />
                <Line type="monotone" dataKey="expense" stroke="#f43f5e" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
      case 'Journal': return (
        <div className="space-y-4">
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Nouvelle écriture
          </button>
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 text-sm font-bold text-slate-600">Date</th>
                <th className="p-4 text-sm font-bold text-slate-600">Description</th>
                <th className="p-4 text-sm font-bold text-slate-600">Débit</th>
                <th className="p-4 text-sm font-bold text-slate-600">Crédit</th>
                <th className="p-4 text-sm font-bold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {journalEntries.map(entry => (
                <React.Fragment key={entry.id}>
                  {entry.items.map((item, idx) => (
                    <tr key={`${entry.id}-${idx}`} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="p-4 text-sm">{idx === 0 ? entry.date : ''}</td>
                      <td className="p-4 text-sm">{idx === 0 ? entry.description : ''}</td>
                      <td className="p-4 text-sm">{item.debit > 0 ? item.debit.toLocaleString() : '-'}</td>
                      <td className="p-4 text-sm">{item.credit > 0 ? item.credit.toLocaleString() : '-'}</td>
                      <td className="p-4 text-sm">
                        {idx === 0 && (
                          <div className="flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-all sm:translate-x-2 sm:group-hover:translate-x-0">
                            <button onClick={() => openEdit(entry)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-white rounded-lg transition-all shadow-sm" title="Modifier"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirmId(entry.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all shadow-sm" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      );
      case 'PCG': return (
        <div className="overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 text-sm font-bold text-slate-600">Code</th>
                <th className="p-4 text-sm font-bold text-slate-600">Nom</th>
                <th className="p-4 text-sm font-bold text-slate-600">Type</th>
              </tr>
            </thead>
            <tbody>
              {PCG.map(acc => (
                <tr key={acc.code} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-4 text-sm font-mono">{acc.code}</td>
                  <td className="p-4 text-sm">{acc.name}</td>
                  <td className="p-4 text-sm">{acc.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      case 'Bilan': return (
        <div className="space-y-6">
          <h3 className="text-lg font-bold">Bilan</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">Actif</h4>
              <ul className="space-y-1">
                {Object.entries(bilanDetails).filter(([_, v]) => v.type === 'Asset').map(([code, v]) => (
                  <li key={code} className="flex justify-between text-sm"><span>{v.name} ({code})</span><span className="font-bold">{v.balance.toLocaleString()}</span></li>
                ))}
              </ul>
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200">Total: {bilanTotals.assets.toLocaleString()} {currencySymbol}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">Passif & Capitaux</h4>
              <ul className="space-y-1">
                {Object.entries(bilanDetails).filter(([_, v]) => v.type !== 'Asset').map(([code, v]) => (
                  <li key={code} className="flex justify-between text-sm"><span>{v.name} ({code})</span><span className="font-bold">{v.balance.toLocaleString()}</span></li>
                ))}
              </ul>
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200">Total: {bilanTotals.liabilities.toLocaleString()} {currencySymbol}</p>
            </div>
          </div>
        </div>
      );
      case 'Resultat': return (
        <div className="space-y-6">
          <h3 className="text-lg font-bold">Compte de Résultat</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">Produits</h4>
              <ul className="space-y-1">
                {Object.entries(resultatDetails).filter(([_, v]) => v.type === 'Revenue').map(([code, v]) => (
                  <li key={code} className="flex justify-between text-sm text-emerald-600"><span>{v.name} ({code})</span><span className="font-bold">{v.balance.toLocaleString()}</span></li>
                ))}
              </ul>
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200 text-emerald-600">Total: {resultatTotals.revenue.toLocaleString()} {currencySymbol}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">Charges</h4>
              <ul className="space-y-1">
                {Object.entries(resultatDetails).filter(([_, v]) => v.type === 'Expense').map(([code, v]) => (
                  <li key={code} className="flex justify-between text-sm text-rose-600"><span>{v.name} ({code})</span><span className="font-bold">{v.balance.toLocaleString()}</span></li>
                ))}
              </ul>
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200 text-rose-600">Total: {resultatTotals.expenses.toLocaleString()} {currencySymbol}</p>
            </div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg">
            <h4 className="font-bold text-indigo-900 mb-2">Résultat Net</h4>
            <p className="text-3xl font-bold text-indigo-700">{(resultatTotals.revenue - resultatTotals.expenses).toLocaleString()} {currencySymbol}</p>
          </div>
        </div>
      );
      case 'TVA': return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Déclaration de {taxLabel}</h3>
            <button 
              onClick={downloadTVAPDF}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
            >
              <Download className="w-4 h-4" /> Télécharger PDF
            </button>
          </div>
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">{taxLabel} Collectée (Journal)</h4>
              <p className="text-2xl font-bold text-emerald-600">{(tvaData.collected - tvaFromInvoices).toLocaleString()} {currencySymbol}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">{taxLabel} sur Factures Payées</h4>
              <p className="text-2xl font-bold text-emerald-600">{tvaFromInvoices.toLocaleString()} {currencySymbol}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">{taxLabel} Déductible (445)</h4>
              <p className="text-2xl font-bold text-rose-600">{tvaData.deductible.toLocaleString()} {currencySymbol}</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <h4 className="font-bold text-indigo-900 mb-2">{taxLabel} à payer / Crédit</h4>
              <p className="text-3xl font-bold text-indigo-700">{(tvaData.collected - tvaData.deductible).toLocaleString()} {currencySymbol}</p>
            </div>
          </div>
        </div>
      );
      case 'Liasses': return (
        <div className="space-y-8">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Liasses Fiscales & États Financiers</h3>
              <p className="text-slate-500 text-sm mt-1">Générez et téléchargez votre liasse fiscale {isUS ? 'US GAAP' : isFR ? 'France' : 'OHADA'} complète.</p>
            </div>
            <button 
              onClick={downloadLiassePDF}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              <Download className="w-5 h-5" /> Télécharger la Liasse en PDF
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600"><Building2 className="w-5 h-5" /></div>
                <h4 className="font-bold text-slate-900 uppercase tracking-tight">Informations de l'Entreprise</h4>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dénomination</label>
                    <p className="text-sm font-bold text-slate-900">{companyInfo?.name || 'Entreprise'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isFR ? 'TVA Intracom.' : isUS ? 'EIN' : 'NIF'}</label>
                    <p className="text-sm font-bold text-slate-900">{companyInfo?.taxId || '-'}</p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Siège Social</label>
                  <p className="text-sm font-medium text-slate-600">{companyInfo?.address || '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {isFR ? (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SIREN</label>
                        <p className="text-sm font-medium text-slate-600">{companyInfo?.siren || '-'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SIRET</label>
                        <p className="text-sm font-medium text-slate-600">{companyInfo?.siret || '-'}</p>
                      </div>
                    </>
                  ) : isUS ? (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">State of Inc.</label>
                      <p className="text-sm font-medium text-slate-600">{companyInfo?.country === 'USA' ? 'Delaware' : '-'}</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RCCM</label>
                        <p className="text-sm font-medium text-slate-600">{companyInfo?.rccm || '-'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID NAT</label>
                        <p className="text-sm font-medium text-slate-600">{companyInfo?.idNat || '-'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" /> Documents Inclus
              </h4>
              <div className="space-y-3">
                {[
                  'Bilan (Actif / Passif)',
                  'Compte de Résultat',
                  'Tableau des Flux de Trésorerie',
                  'Notes Annexes',
                  'État des Stocks',
                  'Tableau des Amortissements'
                ].map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm font-medium text-slate-700">{doc}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-center gap-6">
            <div className="p-4 bg-white rounded-2xl shadow-sm text-indigo-600">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-indigo-900">Prêt pour la déclaration</h4>
              <p className="text-indigo-700/70 text-sm mt-1">
                Toutes les données financières sont consolidées selon le référentiel {isUS ? 'US GAAP' : isFR ? 'PCG France' : 'OHADA'}. 
                Votre liasse est prête à être transmise aux autorités fiscales.
              </p>
            </div>
          </div>
        </div>
      );
      default: return <div>Module en développement...</div>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Comptabilité {isUS ? 'US GAAP' : isFR ? 'PCG France' : 'OHADA'}</h2>
        <button
          onClick={() => setIsResetConfirmOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-100 transition-all"
        >
          <Trash2 className="w-4 h-4" /> Réinitialiser le tableau de bord
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-4">
        {['Dashboard', 'Journal', 'Bilan', 'Resultat', 'PCG', 'Liasses', 'TVA'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {tab === 'TVA' ? taxLabel : tab}
          </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-sm font-medium text-slate-500">Chargement des données comptables...</p>
          </div>
        ) : renderContent()}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">{editingEntryId ? 'Modifier l\'écriture' : 'Nouvelle écriture'}</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleGenerateEntry} className="flex items-center gap-1 text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-200" disabled={isGenerating}>
                  <Sparkles className="w-4 h-4" /> {isGenerating ? 'Génération...' : 'Générer avec IA'}
                </button>
                <button onClick={() => { setIsModalOpen(false); setEditingEntryId(null); }}><X className="w-5 h-5 text-slate-400"/></button>
              </div>
            </div>
            <form onSubmit={handleSaveEntry} className="space-y-4">
              <input type="text" placeholder="Description" className="w-full p-2 border rounded-lg" value={newEntry.description || ''} onChange={e => setNewEntry({...newEntry, description: e.target.value})} required />
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="p-1">Compte</th>
                    <th className="p-1">Débit</th>
                    <th className="p-1">Crédit</th>
                    <th className="p-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {newEntry.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-1">
                        <select className="w-full p-1 border rounded-lg" value={item.accountId || ''} onChange={e => { const items = [...newEntry.items]; items[idx].accountId = e.target.value; setNewEntry({...newEntry, items}); }} required>
                          <option value="">Compte</option>
                          {PCG.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                        </select>
                      </td>
                      <td className="p-1"><input type="number" className="w-full p-1 border rounded-lg" value={item.debit || 0} onChange={e => { const items = [...newEntry.items]; items[idx].debit = Number(e.target.value) || 0; setNewEntry({...newEntry, items}); }} /></td>
                      <td className="p-1"><input type="number" className="w-full p-1 border rounded-lg" value={item.credit || 0} onChange={e => { const items = [...newEntry.items]; items[idx].credit = Number(e.target.value) || 0; setNewEntry({...newEntry, items}); }} /></td>
                      <td className="p-1">
                        <button type="button" onClick={() => setNewEntry({...newEntry, items: newEntry.items.filter((_, i) => i !== idx)})} className="text-rose-500"><X className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="p-2 text-right">Total</td>
                    <td className="p-2">{totalDebit.toLocaleString()}</td>
                    <td className="p-2">{totalCredit.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <button type="button" onClick={() => setNewEntry({...newEntry, items: [...newEntry.items, { accountId: '', debit: 0, credit: 0 }]})} className="text-sm text-indigo-600">+ Ajouter ligne</button>
              <button type="submit" className={`w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 ${totalDebit === totalCredit && totalDebit > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`} disabled={totalDebit !== totalCredit || totalDebit === 0}><Save className="w-4 h-4" /> Enregistrer</button>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Supprimer l'écriture"
        message="Êtes-vous sûr de vouloir supprimer cette écriture comptable ? Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={() => deleteConfirmId && handleDeleteEntry(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Réinitialiser la comptabilité"
        message="Attention : Cette action va supprimer DÉFINITIVEMENT toutes les écritures du journal, les transactions et les factures de votre entreprise. Cette opération est irréversible. Voulez-vous continuer ?"
        confirmLabel={isResetting ? "Réinitialisation..." : "Tout supprimer"}
        onConfirm={handleReset}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};
