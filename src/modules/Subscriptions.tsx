import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, CheckCircle2, Clock3, CreditCard, Loader2, PackageCheck, ShieldCheck, X } from 'lucide-react';
import { Button, Card, PageHeader } from '../components/ui';
import { apiFetch } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { toast } from '../lib/toast';
import { MyOptions } from './MyOptions';
import { MyAgents } from './MyAgents';

type SubscriptionStatus = {
  access: 'allowed' | 'blocked';
  subStatus: string;
  inTrial: boolean;
  daysLeft: number;
  trialExpiresAt: string | null;
  plan: { displayLocal: string; description: string };
};

export const Subscriptions = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') === 'agents' ? 'agents' : 'options';
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/subscription/status')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!cancelled) setStatus(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selectTab = (tab: 'options' | 'agents') => setParams({ tab });
  const statusLabel = status?.inTrial
    ? `${status.daysLeft} jour${status.daysLeft > 1 ? 's' : ''} d’essai restant${status.daysLeft > 1 ? 's' : ''}`
    : status?.subStatus === 'active' ? 'Abonnement actif' : 'Abonnement à renouveler';

  const subscribe = async () => {
    setIsSubscribing(true);
    try {
      const response = await apiFetch('/api/subscription/create', { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.approveUrl) window.location.href = data.approveUrl;
      else toast.error(data?.error || "Impossible de démarrer l’abonnement.");
    } catch {
      toast.error('Erreur réseau pendant la création de l’abonnement.');
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="subscriptions-page">
      <PageHeader
        title={t('nav.subscriptions')}
        description="Retrouvez l’abonnement SmartDesk de votre entreprise, ses options et ses agents au même endroit."
      />

      <Card interactive onClick={() => setIsPlanOpen(true)} className="cursor-pointer overflow-hidden border-0 bg-gradient-to-br from-primary-red via-[#7a1231] to-[#32101d] text-white shadow-xl" data-testid="main-subscription-card">
        <div className="flex flex-col gap-5 p-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
              <PackageCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">SmartDesk entreprise</p>
              <h2 className="mt-1 text-xl font-black">Votre abonnement principal</h2>
              <p className="mt-1 max-w-xl text-sm text-white/75">{status?.plan.description || 'Accès aux outils de gestion de votre entreprise.'}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/15 sm:text-right">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                <p className="text-2xl font-black">{status?.plan.displayLocal || 'SmartDesk'}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/75 sm:justify-end">
                  {status?.subStatus === 'active' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                  {statusLabel}
                </p>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:w-auto" role="tablist" aria-label="Contenu des abonnements">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'options'}
          onClick={() => selectTab('options')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition sm:flex-none ${activeTab === 'options' ? 'bg-primary-red text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <CreditCard className="h-4 w-4" /> Mes options
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'agents'}
          onClick={() => selectTab('agents')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition sm:flex-none ${activeTab === 'agents' ? 'bg-primary-red text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Bot className="h-4 w-4" /> Mes agents
        </button>
      </div>

      <section role="tabpanel">
        <div className="mb-4">
          <h2 className="text-lg font-black text-slate-900">{activeTab === 'options' ? t('myOptions.title') : t('myAgents.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{activeTab === 'options' ? t('myOptions.desc') : t('myAgents.desc')}</p>
        </div>
        {activeTab === 'options' ? <MyOptions embedded /> : <MyAgents embedded />}
      </section>

      {isPlanOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsPlanOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="main-subscription-title" className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="relative bg-gradient-to-br from-primary-red to-[#32101d] px-6 py-7 text-white sm:px-8">
              <button type="button" onClick={() => setIsPlanOpen(false)} aria-label="Fermer" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 hover:bg-white/20"><X className="h-4 w-4" /></button>
              <PackageCheck className="mb-4 h-10 w-10" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">SmartDesk entreprise</p>
              <h2 id="main-subscription-title" className="mt-1 text-2xl font-black">Abonnement principal</h2>
              <p className="mt-2 text-sm text-white/75">{status?.plan.description}</p>
            </div>
            <div className="space-y-5 p-6 sm:p-8">
              <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
                <span className="text-3xl font-black text-slate-900">{status?.plan.displayLocal}</span><span className="text-sm text-slate-500"> / mois</span>
                <p className="mt-2 text-xs font-semibold text-slate-600">{statusLabel}</p>
              </div>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />Tous les modules SmartDesk pour votre entreprise.</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-red" />Paiement PayPal sécurisé et renouvellement automatique.</li>
              </ul>
              {status?.subStatus === 'active' ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Votre abonnement est actif.</div>
              ) : (
                <Button onClick={subscribe} loading={isSubscribing} className="w-full" icon={<CreditCard className="h-4 w-4" />} data-testid="main-subscription-modal-subscribe">Souscrire maintenant</Button>
              )}
              <p className="text-center text-[11px] text-slate-400">Vous serez redirigé vers PayPal uniquement après avoir confirmé dans cette fenêtre.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
