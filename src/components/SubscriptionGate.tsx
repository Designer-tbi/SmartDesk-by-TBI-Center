/**
 * SubscriptionGate — renders children normally when the tenant is
 * within their trial or has an active PayPal subscription. When the
 * trial is expired with no active subscription, replaces the whole
 * app surface with the upgrade modal so the user can ONLY subscribe
 * or log out. During trial, a discrete banner reminds them of the
 * remaining days.
 */
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { toast } from '../lib/toast';
import { Loader2, LogOut, Check, CreditCard } from 'lucide-react';

interface Status {
  access: 'allowed' | 'blocked';
  subStatus: string;
  inTrial: boolean;
  daysLeft: number;
  trialExpiresAt: string | null;
  country: string;
  plan: { id: string; amountUSD: string; displayLocal: string; description: string };
  subscriptionId?: string | null;
}

interface Props { children: React.ReactNode }

export const SubscriptionGate: React.FC<Props> = ({ children }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const { user, logout } = useAuth();

  const fetchStatus = async () => {
    try {
      const r = await apiFetch('/api/subscription/status');
      if (r.ok) setStatus(await r.json());
    } catch (err) {
      console.error('sub status failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    // Super admins are never gated — skip the status fetch entirely.
    if (user.role === 'super_admin') { setLoading(false); return; }
    // Stamp trial on the first request (idempotent).
    apiFetch('/api/subscription/start-trial', { method: 'POST' })
      .catch(() => {})
      .finally(() => fetchStatus());
  }, [user]);

  // If we land back from PayPal approval (URL query ?subscription=return),
  // call /activate to refresh the local status.
  useEffect(() => {
    const url = new URL(window.location.href);
    const flag = url.searchParams.get('subscription');
    if (flag === 'return') {
      apiFetch('/api/subscription/activate', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => {
          if (d.status === 'active') toast.success('Abonnement activé — merci !');
          else toast.info('Abonnement en attente de confirmation PayPal.');
          url.searchParams.delete('subscription');
          window.history.replaceState(null, '', url.pathname + url.search);
          fetchStatus();
        })
        .catch(() => {});
    }
    if (flag === 'cancel') {
      toast.error('Abonnement annulé.');
      url.searchParams.delete('subscription');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, []);

  const startSubscribe = async () => {
    setSubscribing(true);
    try {
      const r = await apiFetch('/api/subscription/create', { method: 'POST' });
      const data = await r.json();
      if (r.ok && data.approveUrl) {
        // Append landing_page=BILLING so PayPal Checkout opens directly
        // on the credit-card form (guest payment) instead of the
        // PayPal login screen. The button copy in the UI reflects this.
        const target = new URL(data.approveUrl);
        if (!target.searchParams.has('landing_page')) {
          target.searchParams.set('landing_page', 'BILLING');
        }
        window.location.href = target.toString();
      } else {
        toast.error(data?.error || 'Impossible de démarrer l\'abonnement.');
        setSubscribing(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur réseau pendant la création de l\'abonnement.');
      setSubscribing(false);
    }
  };

  if (!user) return <>{children}</>;
  // Super admins are never gated — they manage other tenants and must
  // remain operational regardless of any individual company's trial /
  // subscription state. The backend already bypasses enforceSubscription
  // for super_admin tokens; this short-circuit keeps the UI consistent.
  if (user.role === 'super_admin') return <>{children}</>;
  if (loading) return <>{children}</>;
  if (!status) return <>{children}</>;

  // Pricing copy (specific to CG)
  const isCG = status.country?.toUpperCase() === 'CG';
  const priceBlock = (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-accent-red to-primary-red text-white">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black">{status.plan.displayLocal}</span>
        <span className="text-sm opacity-80">/ mois</span>
      </div>
      {isCG ? (
        <p className="text-xs opacity-90 mt-3 leading-relaxed">
          Votre carte sera débitée en XAF
          (équivalent <strong>{status.plan.amountUSD} USD</strong>) selon
          le taux de change du jour appliqué par votre banque — le coût
          final reste <strong> {status.plan.displayLocal} </strong>.
        </p>
      ) : (
        <p className="text-xs opacity-90 mt-3">Renouvellement mensuel automatique par carte.</p>
      )}
    </div>
  );

  const features = [
    'Devis, factures, OHADA, signature électronique',
    'RH : contrats, bulletins, congés, paie automatique',
    'Comptabilité multi-tenant avec journal OHADA',
    'Tableau de bord temps réel + dashboard centralisé',
    'Accès illimité utilisateurs pour l\'entreprise',
  ];

  if (status.access === 'blocked') {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6" data-testid="subscription-blocker">
        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
          <div className="px-8 py-6 bg-slate-900 text-white">
            <h2 className="text-2xl font-black">Votre période d'essai est terminée</h2>
            <p className="text-sm text-slate-300 mt-1">Activez votre abonnement pour continuer à utiliser SmartDesk.</p>
          </div>
          <div className="p-8 space-y-6">
            {priceBlock}
            <ul className="space-y-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={startSubscribe}
                disabled={subscribing}
                className="flex-1 py-4 bg-accent-red text-white rounded-2xl font-bold hover:bg-red-700 shadow-xl shadow-accent-red/20 disabled:opacity-60 flex items-center justify-center gap-2"
                data-testid="subscription-pay-btn"
              >
                {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {subscribing ? 'Redirection sécurisée…' : 'S\'abonner par carte bancaire'}
              </button>
              <button
                onClick={logout}
                className="py-4 px-6 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 flex items-center justify-center gap-2"
                data-testid="subscription-logout-btn"
              >
                <LogOut className="w-4 h-4" /> Déconnexion
              </button>
            </div>
            <p className="text-[11px] text-center text-slate-400">
              Paiement sécurisé par carte bancaire (Visa, Mastercard). Vous pouvez annuler à tout moment depuis les paramètres.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {status.inTrial && status.daysLeft <= 7 && (
        <div
          className={`sticky top-0 z-40 px-6 py-2 text-sm font-semibold flex items-center justify-between ${
            status.daysLeft <= 3 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
          }`}
          data-testid="subscription-trial-banner"
        >
          <span>
            {status.daysLeft <= 1
              ? 'Dernier jour d\'essai — activez votre abonnement maintenant.'
              : `Il vous reste ${status.daysLeft} jours d'essai sur SmartDesk.`}
          </span>
          <button
            onClick={startSubscribe}
            disabled={subscribing}
            className="px-3 py-1 bg-white border border-current rounded-lg text-xs font-bold hover:bg-black/5 disabled:opacity-60"
            data-testid="subscription-upgrade-now-btn"
          >
            {subscribing ? '…' : 'S\'abonner'}
          </button>
        </div>
      )}
      {children}
    </>
  );
};
