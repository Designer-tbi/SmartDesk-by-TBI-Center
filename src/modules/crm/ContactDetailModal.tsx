/**
 * Contact detail modal with cross-module tabs.
 *
 * Loads the contact's related documents on open (quotes, invoices,
 * projects) so the CRM becomes a navigation hub into the rest of
 * the app. Each item is clickable and opens the corresponding
 * module route with an `?open=:id` hash so the target page can
 * scroll/highlight the entity.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  X, Mail, Phone, Hash, Calendar, FileText, Receipt, Briefcase,
  ExternalLink, Loader2, CheckCircle, Clock, XCircle,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Contact, Invoice } from '../../types';

interface Project {
  id: string;
  name: string;
  clientId?: string;
  status: string;
  budget?: number;
  deadline?: string;
}

type Tab = 'info' | 'quotes' | 'invoices' | 'projects';

interface Props {
  contact: Contact;
  onClose: () => void;
  onEdit: (c: Contact) => void;
  currencySymbol?: string;
  t: (k: string) => string;
  language: string;
}

export const ContactDetailModal: React.FC<Props> = ({
  contact, onClose, onEdit, currencySymbol = 'XAF', t, language,
}) => {
  const [tab, setTab] = useState<Tab>('info');
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<Invoice[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [invRes, projRes] = await Promise.all([
          apiFetch('/api/invoices'),
          apiFetch('/api/projects'),
        ]);
        const allInvoices: Invoice[] = invRes.ok ? await invRes.json() : [];
        const allProjects: Project[] = projRes.ok ? await projRes.json() : [];
        if (cancelled) return;
        setQuotes(allInvoices.filter((i) => i.contactId === contact.id && i.type === 'Quote'));
        setInvoices(allInvoices.filter((i) => i.contactId === contact.id && i.type === 'Invoice'));
        setProjects(allProjects.filter((p) => p.clientId === contact.id));
      } catch (err) {
        console.error('Contact related data failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [contact.id]);

  const navTo = (path: string) => { onClose(); navigate(path); };

  const totalPaid = invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + Number(i.total || 0), 0);
  const totalOutstanding = invoices.filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled').reduce((s, i) => s + Number(i.total || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-red/20 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-red-100 overflow-hidden max-h-[90vh] flex flex-col"
        data-testid="crm-contact-detail-modal"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-red-50 flex items-center justify-between bg-soft-red/30 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-red to-primary-red flex items-center justify-center text-white text-xl font-bold shadow-md shadow-accent-red/10">
              {contact.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">{contact.name}</h3>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                {contact.role ? `${contact.role} — ` : ''}{contact.company}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all" data-testid="crm-detail-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 shrink-0 overflow-x-auto">
          {[
            { key: 'info' as Tab, label: t('crm.infoTab') || 'Informations', icon: Mail, count: null },
            { key: 'quotes' as Tab, label: t('crm.quotesTab') || 'Devis', icon: FileText, count: quotes.length },
            { key: 'invoices' as Tab, label: t('crm.invoicesTab') || 'Factures', icon: Receipt, count: invoices.length },
            { key: 'projects' as Tab, label: t('crm.projectsTab') || 'Projets', icon: Briefcase, count: projects.length },
          ].map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors ${
                tab === key ? 'border-accent-red text-accent-red' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
              data-testid={`crm-detail-tab-${key}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== null && count > 0 && (
                <span className={`px-1.5 rounded-full text-[10px] ${tab === key ? 'bg-accent-red/10 text-accent-red' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          )}

          {!loading && tab === 'info' && (
            <div className="space-y-4">
              <div className="space-y-3 bg-luxury-gray p-4 rounded-2xl border border-slate-100">
                <a href={`mailto:${contact.email}`} className="flex items-center gap-3 text-sm text-slate-700 hover:text-accent-red">
                  <Mail className="w-4 h-4 text-slate-400" /> {contact.email}
                </a>
                <a href={`tel:${contact.phone}`} className="flex items-center gap-3 text-sm text-slate-700 hover:text-accent-red">
                  <Phone className="w-4 h-4 text-slate-400" /> {contact.phone}
                </a>
                {contact.niu && (
                  <div className="flex items-center gap-3 text-sm text-slate-700"><Hash className="w-4 h-4 text-slate-400" /> {t('crm.niu')} : {contact.niu}</div>
                )}
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {t('crm.lastContact')} : {new Date(contact.lastContact).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                </div>
              </div>
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Chiffre d'affaires encaissé</p>
                  <p className="text-xl font-black text-emerald-700 mt-1">{totalPaid.toLocaleString()} {currencySymbol}</p>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">En attente de paiement</p>
                  <p className="text-xl font-black text-amber-700 mt-1">{totalOutstanding.toLocaleString()} {currencySymbol}</p>
                </div>
              </div>
              {contact.notes && (
                <div>
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('crm.notes')}</h5>
                  <p className="text-sm text-slate-600 bg-luxury-gray p-4 rounded-2xl border border-slate-100 leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
                </div>
              )}
            </div>
          )}

          {!loading && tab === 'quotes' && (
            <RelatedList
              items={quotes}
              empty="Aucun devis pour ce contact."
              renderItem={(q) => (
                <RelatedRow
                  key={q.id}
                  title={q.id}
                  subtitle={`${q.date} • ${Number(q.total || 0).toLocaleString()} ${currencySymbol}`}
                  statusLabel={q.status}
                  statusColor={statusColor(q.status)}
                  onClick={() => navTo(`/sales?open=${q.id}`)}
                  testId={`crm-related-quote-${q.id}`}
                />
              )}
            />
          )}

          {!loading && tab === 'invoices' && (
            <RelatedList
              items={invoices}
              empty="Aucune facture pour ce contact."
              renderItem={(i) => (
                <RelatedRow
                  key={i.id}
                  title={i.id}
                  subtitle={`${i.date} • ${Number(i.total || 0).toLocaleString()} ${currencySymbol}`}
                  statusLabel={i.status}
                  statusColor={statusColor(i.status)}
                  onClick={() => navTo(`/sales?open=${i.id}`)}
                  testId={`crm-related-invoice-${i.id}`}
                />
              )}
            />
          )}

          {!loading && tab === 'projects' && (
            <RelatedList
              items={projects}
              empty="Aucun projet pour ce contact."
              renderItem={(p) => (
                <RelatedRow
                  key={p.id}
                  title={p.name}
                  subtitle={`${p.deadline || '—'}${p.budget ? ` • ${Number(p.budget).toLocaleString()} ${currencySymbol}` : ''}`}
                  statusLabel={p.status}
                  statusColor={statusColor(p.status)}
                  onClick={() => navTo(`/projects?open=${p.id}`)}
                  testId={`crm-related-project-${p.id}`}
                />
              )}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
          <button
            onClick={() => { onClose(); onEdit(contact); }}
            className="flex-1 py-3 bg-accent-red text-white rounded-2xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-accent-red/20 active:scale-95"
            data-testid="crm-detail-edit-btn"
          >
            {t('crm.editContact')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ---------- helpers ---------- */

const statusColor = (status: string): string => {
  const s = String(status).toLowerCase();
  if (s === 'paid' || s === 'signed' || s === 'active' || s === 'completed') return 'emerald';
  if (s === 'draft' || s === 'pending') return 'slate';
  if (s === 'sent' || s === 'in progress' || s === 'converted') return 'blue';
  if (s === 'cancelled' || s === 'rejected' || s === 'overdue') return 'red';
  return 'amber';
};

const STATUS_CLASS: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  slate: 'bg-slate-100 text-slate-500 border-slate-200',
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  red: 'bg-red-50 text-red-600 border-red-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
};

const RelatedList = <T,>({ items, empty, renderItem }: { items: T[]; empty: string; renderItem: (x: T) => React.ReactNode }) => {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
        {empty}
      </div>
    );
  }
  return <div className="space-y-2">{items.map(renderItem)}</div>;
};

const RelatedRow: React.FC<{
  title: string;
  subtitle: string;
  statusLabel: string;
  statusColor: string;
  onClick: () => void;
  testId?: string;
}> = ({ title, subtitle, statusLabel, statusColor: sc, onClick, testId }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className="w-full flex items-center justify-between gap-3 p-4 bg-white border border-slate-200 hover:border-accent-red hover:shadow-md rounded-2xl text-left transition-all group"
  >
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-slate-900 truncate">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
    </div>
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${STATUS_CLASS[sc] || STATUS_CLASS.amber}`}>{statusLabel}</span>
    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-accent-red transition-colors shrink-0" />
  </button>
);
