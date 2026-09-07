import React, { useEffect, useState } from 'react';
import { CreditCard, Smartphone, CheckCircle2, X, ShieldCheck, RefreshCw } from 'lucide-react';
import { PageHeader, Card, Badge, Button } from '../components/ui';
import { apiFetch } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { toast } from '../lib/toast';

/**
 * Payment methods hub, shown as cards. PayPal reflects the company's real
 * subscription state and opens checkout in-place; the Mobile
 * Money providers aren't wired up on the backend yet, so they're shown as
 * "coming soon" placeholders.
 */
export const MyOptions = ({ embedded = false }: { embedded?: boolean }) => {
  const { t } = useTranslation();
  const [hasPaypalConfig, setHasPaypalConfig] = useState(false);
  const [optionStatus, setOptionStatus] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/api/company').then((res) => res.ok ? res.json() : null),
      apiFetch('/api/subscription/paypal-option/status').then((res) => res.ok ? res.json() : null),
    ])
      .then(([company, subscription]) => {
        if (!cancelled) {
          setHasPaypalConfig(!!company?.hasPaypalConfig);
          setOptionStatus(subscription);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const subscribe = async () => {
    setIsSubscribing(true);
    try {
      const response = await apiFetch('/api/subscription/paypal-option/create', { method: 'POST' });
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
    <div className="space-y-6">
      {!embedded && <PageHeader title={t('myOptions.title')} description={t('myOptions.desc')} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card
          interactive
          onClick={() => setIsModalOpen(true)}
          className="cursor-pointer flex flex-col gap-4"
          data-testid="my-options-paypal-card"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-[#0070ba]/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-[#0070ba]" />
            </div>
            <Badge tone={optionStatus?.active ? 'success' : 'neutral'} dot>
              {optionStatus?.active ? (
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{t('myOptions.configured')}</span>
              ) : 'Abonnement requis'}
            </Badge>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{t('myOptions.paypal')}</h3>
            <p className="text-sm text-slate-500 mt-1">{t('myOptions.paypalDesc')}</p>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 opacity-70" data-testid="my-options-mtn-card">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-amber-600" />
            </div>
            <Badge tone="neutral">{t('myOptions.comingSoon')}</Badge>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{t('myOptions.mobileMoneyMtn')}</h3>
            <p className="text-sm text-slate-500 mt-1">{t('myOptions.mobileMoneyDesc')}</p>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 opacity-70" data-testid="my-options-airtel-card">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-red-600" />
            </div>
            <Badge tone="neutral">{t('myOptions.comingSoon')}</Badge>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{t('myOptions.mobileMoneyAirtel')}</h3>
            <p className="text-sm text-slate-500 mt-1">{t('myOptions.mobileMoneyDesc')}</p>
          </div>
        </Card>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="paypal-option-title" className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="relative bg-gradient-to-br from-[#0070ba] to-[#003f72] px-6 py-7 text-white sm:px-8">
              <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Fermer" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 hover:bg-white/20"><X className="h-4 w-4" /></button>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><CreditCard className="h-6 w-6" /></div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Option SmartDesk</p>
              <h2 id="paypal-option-title" className="mt-1 text-2xl font-black">Paiements PayPal</h2>
              <p className="mt-2 text-sm text-white/80">Encaissez les règlements de vos factures et devis depuis leur lien sécurisé.</p>
            </div>
            <div className="space-y-5 p-6 sm:p-8">
              <div className="flex items-end justify-between rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div><span className="text-3xl font-black text-slate-900">3 000 XAF</span><span className="text-sm text-slate-500"> / mois</span></div>
                <Badge tone={optionStatus?.active ? 'success' : 'info'} dot>{optionStatus?.active ? 'Actif' : 'Disponible'}</Badge>
              </div>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2"><RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-[#0070ba]" />Renouvellement mensuel automatique.</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0070ba]" />Paiement sécurisé par PayPal, à l’équivalent de 5 USD.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />Activation immédiate après confirmation.</li>
              </ul>
              {optionStatus?.active ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="font-bold">Votre option PayPal est active.</p>
                  <p className="mt-1">{hasPaypalConfig ? 'Vos identifiants PayPal sont configurés.' : 'Vous pouvez maintenant renseigner vos identifiants PayPal dans la configuration de l’entreprise.'}</p>
                </div>
              ) : (
                <Button onClick={subscribe} loading={isSubscribing} className="w-full bg-[#0070ba] hover:bg-[#005f9e]" icon={<CreditCard className="h-4 w-4" />} data-testid="paypal-option-modal-subscribe">
                  Souscrire maintenant
                </Button>
              )}
              <p className="text-center text-[11px] text-slate-400">Vous pouvez annuler l’abonnement à tout moment.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
