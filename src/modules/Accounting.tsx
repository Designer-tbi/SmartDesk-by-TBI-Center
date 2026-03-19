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
  const { t, language } = useTranslation();
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
  const [isAutomating, setIsAutomating] = useState(false);
  const [newEntry, setNewEntry] = useState<Omit<JournalEntry, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    items: [{ accountId: '', debit: 0, credit: 0 }]
  });

  const handleAutomateFromInvoices = async () => {
    if (!companyInfo?.id) return;
    setIsAutomating(true);
    try {
      const invoicesRes = await apiFetch('/api/invoices');
      if (!invoicesRes.ok) throw new Error('Failed to fetch invoices');
      const invoicesData = await invoicesRes.json();
      
      const paidInvoices = invoicesData.filter((inv: any) => inv.status === 'paid' || inv.status === 'Paiement partiel');
      
      const existingRefs = new Set(journalEntries.map((j: any) => j.reference));
      const newInvoices = paidInvoices.filter((inv: any) => !existingRefs.has(inv.number));

      if (newInvoices.length === 0) {
        alert(t('accounting.noNewInvoices'));
        return;
      }

      let count = 0;
      for (const inv of newInvoices) {
        try {
          const suggestion = await suggestAccountingEntry(
            `Facture client ${inv.number} - ${inv.clientName}`,
            inv.total,
            standard
          );

          if (suggestion) {
            const res = await apiFetch('/api/journal-entries', {
              method: 'POST',
              body: JSON.stringify({
                companyId: companyInfo.id,
                date: inv.date,
                reference: inv.number,
                description: `Auto: ${inv.clientName} (${inv.number})`,
                items: suggestion.items.map((l: any) => ({
                  accountId: l.accountId,
                  debit: l.debit,
                  credit: l.credit
                })),
                status: 'draft'
              })
            });
            if (res.ok) count++;
          }
        } catch (err) {
          console.error(`Failed to automate invoice ${inv.number}:`, err);
        }
      }
      
      if (count > 0) {
        alert(t('accounting.automationSuccess', { count: count.toString() }));
        fetchData();
      } else {
        alert(t('accounting.noNewInvoices'));
      }
    } catch (error) {
      console.error('Automation error:', error);
      alert(t('accounting.automationError'));
    } finally {
      setIsAutomating(false);
    }
  };

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

  const currentMonth = new Date().getMonth();

  // Calculate Bilan and Resultat
  type AccountDetail = { name: string, balance: number, type: string };
  const getAccountType = (code: string) => PCG.find(acc => acc.code === code)?.type;
  const getAccountName = (code: string) => PCG.find(acc => acc.code === code)?.name;

  const bilanDetails: Record<string, AccountDetail> = journalEntries.reduce((acc, entry) => {
    entry.items.forEach(item => {
      const type = getAccountType(item.accountId);
      if (type === 'Asset' || type === 'Liability' || type === 'Equity') {
        if (!acc[item.accountId]) acc[item.accountId] = { name: getAccountName(item.accountId) || t('common.unknown'), balance: 0, type: type || 'Liability' };
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
        if (!acc[item.accountId]) acc[item.accountId] = { name: getAccountName(item.accountId) || t('common.unknown'), balance: 0, type: type || 'Expense' };
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
  const performanceData = Array.from({ length: 6 }, (_, i) => {
    const monthIdx = (currentMonth - 5 + i + 12) % 12;
    const date = new Date();
    date.setMonth(monthIdx);
    const monthName = date.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
    
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
    const date = new Date();
    const month = date.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long' });

    // Header
    doc.setFontSize(18);
    doc.text(t('accounting.pdf.declaration', { taxLabel: taxLabel.toUpperCase() }), 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(companyInfo?.name || t('accounting.enterprise'), 20, 35);
    doc.text(companyInfo?.address || '', 20, 40);
    doc.text(companyInfo?.taxId || '', 20, 45);
    
    doc.text(t('accounting.pdf.period', { month, year: year.toString() }), 150, 35);
    doc.text(t('accounting.pdf.generationDate', { date: new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US') }), 150, 40);

    // TVA Data Table
    autoTable(doc, {
      startY: 60,
      head: [[t('accounting.pdf.label'), t('accounting.pdf.amount') + ' (' + currencySymbol + ')']],
      body: [
        [t('accounting.tvaCollectedJournal', { taxLabel }), (tvaData.collected - tvaFromInvoices).toLocaleString()],
        [t('accounting.taxOnPaidInvoices', { taxLabel }), tvaFromInvoices.toLocaleString()],
        [t('accounting.pdf.totalCollected', { taxLabel: taxLabel.toUpperCase() }), tvaData.collected.toLocaleString()],
        [t('accounting.tvaDeductible', { taxLabel }), tvaData.deductible.toLocaleString()],
        [t('accounting.tvaToPay', { taxLabel }), (tvaData.collected - tvaData.deductible).toLocaleString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`${t('accounting.declarationFileName')}_${taxLabel}_${month}_${year}.pdf`);
  };

  const downloadLiassePDF = () => {
    const doc = new jsPDF();
    const year = new Date().getFullYear();

    // Page 1: Page de Garde
    doc.setFontSize(22);
    doc.text(t('accounting.pdf.liasseTitle', { standard: isUS ? 'US GAAP' : isFR ? 'FRANCE' : 'OHADA' }), 105, 60, { align: 'center' });
    doc.setFontSize(16);
    doc.text(t('accounting.pdf.exerciseClosed', { year: year.toString() }), 105, 75, { align: 'center' });

    doc.setFontSize(12);
    doc.text(t('accounting.pdf.companyInfo'), 20, 120);
    doc.line(20, 122, 80, 122);
    
    doc.text(`${t('accounting.denomination')} : ${companyInfo?.name || t('accounting.enterprise')}`, 20, 135);
    doc.text(`${t('accounting.siege')} : ${companyInfo?.address || ''}`, 20, 145);
    
    if (isFR) {
      doc.text(`${t('accounting.siren')} : ${companyInfo?.siren || '-'}`, 20, 155);
      doc.text(`${t('accounting.siret')} : ${companyInfo?.siret || '-'}`, 20, 165);
      doc.text(`${t('accounting.tva')} : ${companyInfo?.taxId || '-'}`, 20, 175);
    } else if (isUS) {
      doc.text(`EIN : ${companyInfo?.taxId || '-'}`, 20, 155);
    } else {
      doc.text(`${t('accounting.taxId')} : ${companyInfo?.taxId || '-'}`, 20, 155);
      doc.text(`${t('accounting.rccm')} : ${companyInfo?.rccm || '-'}`, 20, 165);
      doc.text(`${t('accounting.idNat')} : ${companyInfo?.idNat || '-'}`, 20, 175);
    }

    // Page 2: Bilan
    doc.addPage();
    doc.setFontSize(18);
    doc.text(t('accounting.pdf.bilanConsolidated'), 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(t('accounting.actif'), 20, 40);
    const actifRows = Object.entries(bilanDetails)
      .filter(([_, v]) => v.type === 'Asset')
      .map(([code, v]) => [code, v.name, v.balance.toLocaleString()]);
    
    autoTable(doc, {
      startY: 45,
      head: [[t('accounting.code'), t('accounting.account'), t('accounting.pdf.amount')]],
      body: [...actifRows, [{ content: t('accounting.totalAssets'), colSpan: 2, styles: { fontStyle: 'bold' } }, { content: bilanTotals.assets.toLocaleString(), styles: { fontStyle: 'bold' } }]],
    });

    doc.text(t('accounting.passif'), 20, (doc as any).lastAutoTable.finalY + 20);
    const passifRows = Object.entries(bilanDetails)
      .filter(([_, v]) => v.type !== 'Asset')
      .map(([code, v]) => [code, v.name, v.balance.toLocaleString()]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 25,
      head: [[t('accounting.code'), t('accounting.account'), t('accounting.pdf.amount')]],
      body: [...passifRows, [{ content: t('accounting.totalLiabilities'), colSpan: 2, styles: { fontStyle: 'bold' } }, { content: bilanTotals.liabilities.toLocaleString(), styles: { fontStyle: 'bold' } }]],
    });

    // Page 3: Compte de Résultat
    doc.addPage();
    doc.setFontSize(18);
    doc.text(t('accounting.pdf.incomeStatement'), 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(t('accounting.produits'), 20, 40);
    const produitRows = Object.entries(resultatDetails)
      .filter(([_, v]) => v.type === 'Revenue')
      .map(([code, v]) => [code, v.name, v.balance.toLocaleString()]);

    autoTable(doc, {
      startY: 45,
      head: [[t('accounting.code'), t('accounting.account'), t('accounting.pdf.amount')]],
      body: [...produitRows, [{ content: t('accounting.totalRevenue'), colSpan: 2, styles: { fontStyle: 'bold' } }, { content: resultatTotals.revenue.toLocaleString(), styles: { fontStyle: 'bold' } }]],
    });

    doc.text(t('accounting.charges'), 20, (doc as any).lastAutoTable.finalY + 20);
    const chargeRows = Object.entries(resultatDetails)
      .filter(([_, v]) => v.type === 'Expense')
      .map(([code, v]) => [code, v.name, v.balance.toLocaleString()]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 25,
      head: [[t('accounting.code'), t('accounting.account'), t('accounting.pdf.amount')]],
      body: [...chargeRows, [{ content: t('accounting.totalExpenses'), colSpan: 2, styles: { fontStyle: 'bold' } }, { content: resultatTotals.expenses.toLocaleString(), styles: { fontStyle: 'bold' } }]],
    });

    const net = resultatTotals.revenue - resultatTotals.expenses;
    doc.setFontSize(14);
    doc.text(`${t('accounting.netResult')} : ${net.toLocaleString()} ${currencySymbol}`, 105, (doc as any).lastAutoTable.finalY + 30, { align: 'center' });

    doc.save(`${t('accounting.liasseFileName')}_${(companyInfo?.name || t('accounting.enterprise')).replace(/\s+/g, '_')}_${year}.pdf`);
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
            <h3 className="text-lg font-bold mb-4">{t('accounting.performance')}</h3>
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
          <div className="flex gap-2">
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> {t('accounting.newEntry')}
            </button>
            <button 
              onClick={handleAutomateFromInvoices} 
              disabled={isAutomating}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {isAutomating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t('accounting.automateFromInvoices')}
            </button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 text-sm font-bold text-slate-600">{t('accounting.date')}</th>
                <th className="p-4 text-sm font-bold text-slate-600">{t('accounting.description')}</th>
                <th className="p-4 text-sm font-bold text-slate-600">{t('accounting.debit')}</th>
                <th className="p-4 text-sm font-bold text-slate-600">{t('accounting.credit')}</th>
                <th className="p-4 text-sm font-bold text-slate-600">{t('accounting.actions')}</th>
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
                            <button onClick={() => openEdit(entry)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-white rounded-lg transition-all shadow-sm" title={t('common.edit')}><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirmId(entry.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all shadow-sm" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
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
                <th className="p-4 text-sm font-bold text-slate-600">{t('accounting.code')}</th>
                <th className="p-4 text-sm font-bold text-slate-600">{t('accounting.name')}</th>
                <th className="p-4 text-sm font-bold text-slate-600">{t('accounting.type')}</th>
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
          <h3 className="text-lg font-bold">{t('accounting.bilan')}</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">{t('accounting.actif')}</h4>
              <ul className="space-y-1">
                {Object.entries(bilanDetails).filter(([_, v]) => v.type === 'Asset').map(([code, v]) => (
                  <li key={code} className="flex justify-between text-sm"><span>{v.name} ({code})</span><span className="font-bold">{v.balance.toLocaleString()}</span></li>
                ))}
              </ul>
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200">{t('common.total')}: {bilanTotals.assets.toLocaleString()} {currencySymbol}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">{t('accounting.passif')}</h4>
              <ul className="space-y-1">
                {Object.entries(bilanDetails).filter(([_, v]) => v.type !== 'Asset').map(([code, v]) => (
                  <li key={code} className="flex justify-between text-sm"><span>{v.name} ({code})</span><span className="font-bold">{v.balance.toLocaleString()}</span></li>
                ))}
              </ul>
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200">{t('common.total')}: {bilanTotals.liabilities.toLocaleString()} {currencySymbol}</p>
            </div>
          </div>
        </div>
      );
      case 'Resultat': return (
        <div className="space-y-6">
          <h3 className="text-lg font-bold">{t('accounting.resultat')}</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">{t('accounting.produits')}</h4>
              <ul className="space-y-1">
                {Object.entries(resultatDetails).filter(([_, v]) => v.type === 'Revenue').map(([code, v]) => (
                  <li key={code} className="flex justify-between text-sm text-emerald-600"><span>{v.name} ({code})</span><span className="font-bold">{v.balance.toLocaleString()}</span></li>
                ))}
              </ul>
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200 text-emerald-600">{t('common.total')}: {resultatTotals.revenue.toLocaleString()} {currencySymbol}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">{t('accounting.charges')}</h4>
              <ul className="space-y-1">
                {Object.entries(resultatDetails).filter(([_, v]) => v.type === 'Expense').map(([code, v]) => (
                  <li key={code} className="flex justify-between text-sm text-rose-600"><span>{v.name} ({code})</span><span className="font-bold">{v.balance.toLocaleString()}</span></li>
                ))}
              </ul>
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200 text-rose-600">{t('common.total')}: {resultatTotals.expenses.toLocaleString()} {currencySymbol}</p>
            </div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg">
            <h4 className="font-bold text-indigo-900 mb-2">{t('accounting.netResult')}</h4>
            <p className="text-3xl font-bold text-indigo-700">{(resultatTotals.revenue - resultatTotals.expenses).toLocaleString()} {currencySymbol}</p>
          </div>
        </div>
      );
      case 'TVA': return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">{t('accounting.tvaDeclaration', { taxLabel })}</h3>
            <button 
              onClick={downloadTVAPDF}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
            >
              <Download className="w-4 h-4" /> {t('accounting.downloadPDF')}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">{t('accounting.tvaCollectedJournal', { taxLabel })}</h4>
              <p className="text-2xl font-bold text-emerald-600">{(tvaData.collected - tvaFromInvoices).toLocaleString()} {currencySymbol}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">{t('accounting.tvaOnPaidInvoices', { taxLabel })}</h4>
              <p className="text-2xl font-bold text-emerald-600">{tvaFromInvoices.toLocaleString()} {currencySymbol}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">{t('accounting.tvaDeductible', { taxLabel })}</h4>
              <p className="text-2xl font-bold text-rose-600">{tvaData.deductible.toLocaleString()} {currencySymbol}</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <h4 className="font-bold text-indigo-900 mb-2">{t('accounting.tvaToPay', { taxLabel })}</h4>
              <p className="text-3xl font-bold text-indigo-700">{(tvaData.collected - tvaData.deductible).toLocaleString()} {currencySymbol}</p>
            </div>
          </div>
        </div>
      );
      case 'Liasses': return (
        <div className="space-y-8">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{t('accounting.liassesTitle')}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('accounting.liassesDesc', { standard: isUS ? 'US GAAP' : isFR ? 'France' : 'OHADA' })}</p>
            </div>
            <button 
              onClick={downloadLiassePDF}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              <Download className="w-5 h-5" /> {t('accounting.downloadLiasse')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600"><Building2 className="w-5 h-5" /></div>
                <h4 className="font-bold text-slate-900 uppercase tracking-tight">{t('accounting.companyInfo')}</h4>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('accounting.denomination')}</label>
                    <p className="text-sm font-bold text-slate-900">{companyInfo?.name || 'Entreprise'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isFR ? t('accounting.vatIntracom') : isUS ? t('accounting.ein') : t('accounting.taxId')}</label>
                    <p className="text-sm font-bold text-slate-900">{companyInfo?.taxId || '-'}</p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('accounting.siege')}</label>
                  <p className="text-sm font-medium text-slate-600">{companyInfo?.address || '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {isFR ? (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('accounting.siren')}</label>
                        <p className="text-sm font-medium text-slate-600">{companyInfo?.siren || '-'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('accounting.siret')}</label>
                        <p className="text-sm font-medium text-slate-600">{companyInfo?.siret || '-'}</p>
                      </div>
                    </>
                  ) : isUS ? (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('accounting.stateOfInc')}</label>
                      <p className="text-sm font-medium text-slate-600">{companyInfo?.country === 'USA' ? t('accounting.delaware') : '-'}</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('accounting.rccm')}</label>
                        <p className="text-sm font-medium text-slate-600">{companyInfo?.rccm || '-'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('accounting.idNat')}</label>
                        <p className="text-sm font-medium text-slate-600">{companyInfo?.idNat || '-'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" /> {t('accounting.includedDocs')}
              </h4>
              <div className="space-y-3">
                {[
                  t('accounting.doc.bilan'),
                  t('accounting.doc.resultat'),
                  t('accounting.doc.cashflow'),
                  t('accounting.doc.notes'),
                  t('accounting.doc.stocks'),
                  t('accounting.doc.amortization')
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
              <h4 className="text-lg font-bold text-indigo-900">{t('accounting.readyForDeclaration')}</h4>
              <p className="text-indigo-700/70 text-sm mt-1">
                {t('accounting.readyForDeclarationDesc', { standard: isUS ? 'US GAAP' : isFR ? t('accounting.pcgFrance') : 'OHADA' })}
              </p>
            </div>
          </div>
        </div>
      );
      default: return <div>{t('accounting.inDevelopment')}</div>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">{t('accounting.title')} {isUS ? 'US GAAP' : isFR ? t('accounting.pcgFrance') : 'OHADA'}</h2>
        <button
          onClick={() => setIsResetConfirmOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-100 transition-all"
        >
          <Trash2 className="w-4 h-4" /> {t('accounting.resetDashboard')}
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
            <p className="text-sm font-medium text-slate-500">{t('accounting.loadingData')}</p>
          </div>
        ) : renderContent()}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">{editingEntryId ? t('accounting.editEntry') : t('accounting.newEntry')}</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleGenerateEntry} className="flex items-center gap-1 text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-200" disabled={isGenerating}>
                  <Sparkles className="w-4 h-4" /> {isGenerating ? t('accounting.generating') : t('accounting.generateIA')}
                </button>
                <button onClick={() => { setIsModalOpen(false); setEditingEntryId(null); }}><X className="w-5 h-5 text-slate-400"/></button>
              </div>
            </div>
            <form onSubmit={handleSaveEntry} className="space-y-4">
              <input type="text" placeholder={t('accounting.description')} className="w-full p-2 border rounded-lg" value={newEntry.description || ''} onChange={e => setNewEntry({...newEntry, description: e.target.value})} required />
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="p-1">{t('accounting.account')}</th>
                    <th className="p-1">{t('accounting.debit')}</th>
                    <th className="p-1">{t('accounting.credit')}</th>
                    <th className="p-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {newEntry.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-1">
                        <select className="w-full p-1 border rounded-lg" value={item.accountId || ''} onChange={e => { const items = [...newEntry.items]; items[idx].accountId = e.target.value; setNewEntry({...newEntry, items}); }} required>
                          <option value="">{t('accounting.account')}</option>
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
                    <td className="p-2 text-right">{t('common.total')}</td>
                    <td className="p-2">{totalDebit.toLocaleString()}</td>
                    <td className="p-2">{totalCredit.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <button type="button" onClick={() => setNewEntry({...newEntry, items: [...newEntry.items, { accountId: '', debit: 0, credit: 0 }]})} className="text-sm text-indigo-600">{t('accounting.addLine')}</button>
              <button type="submit" className={`w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 ${totalDebit === totalCredit && totalDebit > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`} disabled={totalDebit !== totalCredit || totalDebit === 0}><Save className="w-4 h-4" /> {t('accounting.save')}</button>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title={t('accounting.confirmDeleteTitle')}
        message={t('accounting.confirmDeleteMessage')}
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteConfirmId && handleDeleteEntry(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title={t('accounting.resetTitle')}
        message={t('accounting.resetMessage')}
        confirmLabel={isResetting ? t('accounting.resetting') : t('accounting.deleteAll')}
        onConfirm={handleReset}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};
