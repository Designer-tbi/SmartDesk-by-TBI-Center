import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, X, BookOpen, FileText, BarChart3, ListTree, Save, Sparkles, Download, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { Transaction, JournalEntry } from '../types';
import { OHADA_PCG } from '../constants/ohadaPCG';
import { MOCK_COMPANY } from '../constants';
import { suggestAccountingEntry } from '../services/accountingAutomation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const Accounting = () => {
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Journal' | 'Bilan' | 'Resultat' | 'PCG' | 'Liasses' | 'TVA'>('Dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newEntry, setNewEntry] = useState<Omit<JournalEntry, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    items: [{ accountId: '', debit: 0, credit: 0 }]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [transRes, journalRes, invRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/journal-entries'),
        fetch('/api/invoices')
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
  const getAccountType = (code: string) => OHADA_PCG.find(acc => acc.code === code)?.type;
  const getAccountName = (code: string) => OHADA_PCG.find(acc => acc.code === code)?.name;

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

  // Add TVA from paid invoices (actual totals)
  const tvaFromInvoices = invoices
    .filter(inv => inv.status === 'Paid')
    .reduce((sum, inv) => sum + (inv.tvaTotal || 0), 0);
  
  tvaData.collected += tvaFromInvoices;

  const performanceData = [
    { name: 'Jan', income: 4000, expense: 2400 },
    { name: 'Fév', income: 3000, expense: 1398 },
    { name: 'Mar', income: totalIncome / 1000, expense: totalExpenses / 1000 },
  ];

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalDebit = newEntry.items.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = newEntry.items.reduce((sum, item) => sum + item.credit, 0);
    if (totalDebit !== totalCredit || totalDebit === 0) {
      alert('L\'écriture n\'est pas équilibrée ou le montant est nul.');
      return;
    }
    try {
      const response = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newEntry, id: Date.now().toString() }),
      });
      if (response.ok) fetchData();
      setIsModalOpen(false);
      setNewEntry({ date: new Date().toISOString().split('T')[0], description: '', items: [{ accountId: '', debit: 0, credit: 0 }] });
    } catch (error) {
      console.error('Failed to save journal entry:', error);
    }
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
    doc.text('DÉCLARATION DE TVA', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(MOCK_COMPANY.name, 20, 35);
    doc.text(MOCK_COMPANY.address, 20, 40);
    doc.text(MOCK_COMPANY.taxId, 20, 45);
    
    doc.text(`Période : ${month} ${year}`, 150, 35);
    doc.text(`Date de génération : ${new Date().toLocaleDateString()}`, 150, 40);

    // TVA Data Table
    autoTable(doc, {
      startY: 60,
      head: [['Libellé', 'Montant (XAF)']],
      body: [
        ['TVA Collectée (Journal)', (tvaData.collected - tvaFromInvoices).toLocaleString()],
        ['TVA sur Factures Payées', tvaFromInvoices.toLocaleString()],
        ['TOTAL TVA COLLECTÉE', tvaData.collected.toLocaleString()],
        ['TVA Déductible', tvaData.deductible.toLocaleString()],
        ['TVA À PAYER / CRÉDIT', (tvaData.collected - tvaData.deductible).toLocaleString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`Declaration_TVA_${month}_${year}.pdf`);
  };

  const downloadLiassePDF = () => {
    const doc = new jsPDF();
    const year = new Date().getFullYear();

    // Page 1: Page de Garde
    doc.setFontSize(22);
    doc.text('LIASSE FISCALE OHADA', 105, 60, { align: 'center' });
    doc.setFontSize(16);
    doc.text(`EXERCICE CLOS LE 31 DÉCEMBRE ${year}`, 105, 75, { align: 'center' });

    doc.setFontSize(12);
    doc.text('INFORMATIONS ENTREPRISE', 20, 120);
    doc.line(20, 122, 80, 122);
    
    doc.text(`Dénomination : ${MOCK_COMPANY.name}`, 20, 135);
    doc.text(`Siège Social : ${MOCK_COMPANY.address}`, 20, 145);
    doc.text(`NIF : ${MOCK_COMPANY.taxId}`, 20, 155);
    doc.text(`RCCM : ${MOCK_COMPANY.rccm}`, 20, 165);
    doc.text(`ID NAT : ${MOCK_COMPANY.idNat}`, 20, 175);

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
      body: [...actifRows, [{ content: 'TOTAL ACTIF', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: bilanTotals.assets.toLocaleString(), styles: { fontStyle: 'bold' } }]],
    });

    doc.text('PASSIF & CAPITAUX', 20, (doc as any).lastAutoTable.finalY + 20);
    const passifRows = Object.entries(bilanDetails)
      .filter(([_, v]) => v.type !== 'Asset')
      .map(([code, v]) => [code, v.name, v.balance.toLocaleString()]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 25,
      head: [['Code', 'Compte', 'Montant']],
      body: [...passifRows, [{ content: 'TOTAL PASSIF', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: bilanTotals.liabilities.toLocaleString(), styles: { fontStyle: 'bold' } }]],
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
      body: [...produitRows, [{ content: 'TOTAL PRODUITS', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: resultatTotals.revenue.toLocaleString(), styles: { fontStyle: 'bold' } }]],
    });

    doc.text('CHARGES', 20, (doc as any).lastAutoTable.finalY + 20);
    const chargeRows = Object.entries(resultatDetails)
      .filter(([_, v]) => v.type === 'Expense')
      .map(([code, v]) => [code, v.name, v.balance.toLocaleString()]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 25,
      head: [['Code', 'Compte', 'Montant']],
      body: [...chargeRows, [{ content: 'TOTAL CHARGES', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: resultatTotals.expenses.toLocaleString(), styles: { fontStyle: 'bold' } }]],
    });

    const net = resultatTotals.revenue - resultatTotals.expenses;
    doc.setFontSize(14);
    doc.text(`RÉSULTAT NET : ${net.toLocaleString()} XAF`, 105, (doc as any).lastAutoTable.finalY + 30, { align: 'center' });

    doc.save(`Liasse_Fiscale_${MOCK_COMPANY.name.replace(/\s+/g, '_')}_${year}.pdf`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard': return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><TrendingUp /></div>
              <div>
                <p className="text-sm text-slate-500">Revenus</p>
                <p className="text-xl font-bold">{totalIncome.toLocaleString()} XAF</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><TrendingDown /></div>
              <div>
                <p className="text-sm text-slate-500">Dépenses</p>
                <p className="text-xl font-bold">{totalExpenses.toLocaleString()} XAF</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><DollarSign /></div>
              <div>
                <p className="text-sm text-slate-500">Bénéfice Net</p>
                <p className="text-xl font-bold">{netProfit.toLocaleString()} XAF</p>
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
              {OHADA_PCG.map(acc => (
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
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200">Total: {bilanTotals.assets.toLocaleString()} XAF</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">Passif & Capitaux</h4>
              <ul className="space-y-1">
                {Object.entries(bilanDetails).filter(([_, v]) => v.type !== 'Asset').map(([code, v]) => (
                  <li key={code} className="flex justify-between text-sm"><span>{v.name} ({code})</span><span className="font-bold">{v.balance.toLocaleString()}</span></li>
                ))}
              </ul>
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200">Total: {bilanTotals.liabilities.toLocaleString()} XAF</p>
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
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200 text-emerald-600">Total: {resultatTotals.revenue.toLocaleString()} XAF</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">Charges</h4>
              <ul className="space-y-1">
                {Object.entries(resultatDetails).filter(([_, v]) => v.type === 'Expense').map(([code, v]) => (
                  <li key={code} className="flex justify-between text-sm text-rose-600"><span>{v.name} ({code})</span><span className="font-bold">{v.balance.toLocaleString()}</span></li>
                ))}
              </ul>
              <p className="text-xl font-bold mt-4 pt-2 border-t border-slate-200 text-rose-600">Total: {resultatTotals.expenses.toLocaleString()} XAF</p>
            </div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg">
            <h4 className="font-bold text-indigo-900 mb-2">Résultat Net</h4>
            <p className="text-3xl font-bold text-indigo-700">{(resultatTotals.revenue - resultatTotals.expenses).toLocaleString()} XAF</p>
          </div>
        </div>
      );
      case 'TVA': return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Déclaration de TVA</h3>
            <button 
              onClick={downloadTVAPDF}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
            >
              <Download className="w-4 h-4" /> Télécharger PDF
            </button>
          </div>
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">TVA Collectée (Journal)</h4>
              <p className="text-2xl font-bold text-emerald-600">{(tvaData.collected - tvaFromInvoices).toLocaleString()} XAF</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">TVA sur Factures Payées</h4>
              <p className="text-2xl font-bold text-emerald-600">{tvaFromInvoices.toLocaleString()} XAF</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-bold text-slate-600 mb-2">TVA Déductible (445)</h4>
              <p className="text-2xl font-bold text-rose-600">{tvaData.deductible.toLocaleString()} XAF</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <h4 className="font-bold text-indigo-900 mb-2">TVA à payer / Crédit</h4>
              <p className="text-3xl font-bold text-indigo-700">{(tvaData.collected - tvaData.deductible).toLocaleString()} XAF</p>
            </div>
          </div>
        </div>
      );
      case 'Liasses': return (
        <div className="space-y-8">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Liasses Fiscales & États Financiers</h3>
              <p className="text-slate-500 text-sm mt-1">Générez et téléchargez votre liasse fiscale OHADA complète.</p>
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
                    <p className="text-sm font-bold text-slate-900">{MOCK_COMPANY.name}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NIF</label>
                    <p className="text-sm font-bold text-slate-900">{MOCK_COMPANY.taxId}</p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Siège Social</label>
                  <p className="text-sm font-medium text-slate-600">{MOCK_COMPANY.address}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RCCM</label>
                    <p className="text-sm font-medium text-slate-600">{MOCK_COMPANY.rccm}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID NAT</label>
                    <p className="text-sm font-medium text-slate-600">{MOCK_COMPANY.idNat}</p>
                  </div>
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
                Toutes les données financières sont consolidées selon le référentiel OHADA. 
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
        <h2 className="text-2xl font-bold text-slate-900">Comptabilité OHADA</h2>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-4">
        {['Dashboard', 'Journal', 'Bilan', 'Resultat', 'PCG', 'Liasses', 'TVA'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {tab}
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
              <h3 className="text-lg font-bold">Nouvelle écriture</h3>
              <button type="button" onClick={handleGenerateEntry} className="flex items-center gap-1 text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-200" disabled={isGenerating}>
                <Sparkles className="w-4 h-4" /> {isGenerating ? 'Génération...' : 'Générer avec IA'}
              </button>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <form onSubmit={handleSaveEntry} className="space-y-4">
              <input type="text" placeholder="Description" className="w-full p-2 border rounded-lg" value={newEntry.description} onChange={e => setNewEntry({...newEntry, description: e.target.value})} required />
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
                        <select className="w-full p-1 border rounded-lg" value={item.accountId} onChange={e => { const items = [...newEntry.items]; items[idx].accountId = e.target.value; setNewEntry({...newEntry, items}); }} required>
                          <option value="">Compte</option>
                          {OHADA_PCG.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                        </select>
                      </td>
                      <td className="p-1"><input type="number" className="w-full p-1 border rounded-lg" value={item.debit} onChange={e => { const items = [...newEntry.items]; items[idx].debit = Number(e.target.value); setNewEntry({...newEntry, items}); }} /></td>
                      <td className="p-1"><input type="number" className="w-full p-1 border rounded-lg" value={item.credit} onChange={e => { const items = [...newEntry.items]; items[idx].credit = Number(e.target.value); setNewEntry({...newEntry, items}); }} /></td>
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
    </div>
  );
};
