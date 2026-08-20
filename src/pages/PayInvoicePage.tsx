import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, CreditCard, ExternalLink } from 'lucide-react';

/**
 * Public "pay online" page for a quote or invoice.
 *
 * Reached via the link emailed to the recipient: `/pay/:id?t=<signingToken>`.
 * No authentication is required; the URL itself acts as the access token
 * (see server/routes/publicSignature.ts `/invoices/:id`).
 *
 * The customer clicks "Payer par PayPal", is redirected to PayPal's own
 * site to approve the payment on the company's PayPal account, then comes
 * back here (PayPal appends `paypalReturn=1` to our return_url) where we
 * capture the order and show the result.
 */
export default function PayInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const signingToken = searchParams.get('t') || '';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [paidConfirmation, setPaidConfirmation] = useState<{ amount?: string; currency?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/public/invoices/${id}?t=${encodeURIComponent(signingToken)}`, { credentials: 'omit' });
        if (!r.ok) {
          const e = await r.json().catch(() => null);
          throw new Error(e?.error || `HTTP ${r.status}`);
        }
        const json = await r.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur inconnue');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, signingToken]);

  // Capture automatically if we're coming back from PayPal's approval flow.
  useEffect(() => {
    const orderId = searchParams.get('token');
    const isReturn = searchParams.get('paypalReturn') === '1';
    if (!isReturn || !orderId || !id) return;
    setIsCapturing(true);
    (async () => {
      try {
        const r = await fetch(`/api/public/invoices/${id}/paypal/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'omit',
          body: JSON.stringify({ orderId, t: signingToken }),
        });
        const json = await r.json().catch(() => null);
        if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
        setPaidConfirmation({ amount: json.amount?.value, currency: json.amount?.currency_code });
      } catch (e: any) {
        setError(e?.message || 'Échec de la capture du paiement');
      } finally {
        setIsCapturing(false);
      }
    })();
    // Only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    setError(null);
    setIsStarting(true);
    try {
      const r = await fetch(`/api/public/invoices/${id}/paypal/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ t: signingToken }),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
      if (json.approveUrl) {
        window.location.href = json.approveUrl;
      } else {
        throw new Error('Lien de paiement PayPal indisponible.');
      }
    } catch (e: any) {
      setError(e?.message || 'Impossible de démarrer le paiement.');
      setIsStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-soft-red/30">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-accent-red" />
          Chargement du document…
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-soft-red/30 p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-accent-red mx-auto mb-3" />
          <h1 className="text-xl font-black text-slate-900">Lien invalide</h1>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const inv = data?.invoice;
  const company = data?.company;
  const contact = data?.contact;
  const currency = company?.currency || '';
  const fmt = (n: number) => `${Number(n || 0).toLocaleString()} ${currency}`;
  const docLabel = inv?.type === 'Quote' ? 'Devis' : 'Facture';
  const showSuccess = paidConfirmation || data?.alreadyPaid;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-soft-red/30 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 bg-gradient-to-br from-[#7a0e1c] via-accent-red to-[#c1232a] text-white">
          <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.25em] uppercase opacity-80">
            <CreditCard className="w-3.5 h-3.5" />
            Paiement en ligne
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
            {docLabel} n° {inv?.id}
          </h1>
          <p className="text-sm text-white/85 mt-1">
            Émis par <strong>{company?.name}</strong>
          </p>
        </div>

        <div className="p-8 space-y-7">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Émetteur</div>
              <div className="text-sm font-black text-slate-900">{company?.name}</div>
              <div className="text-xs text-slate-500 whitespace-pre-line">{company?.address || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Destinataire</div>
              <div className="text-sm font-black text-slate-900">{contact?.name || '—'}</div>
              <div className="text-xs text-slate-500">{contact?.email || ''}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Total HT</span>
              <span>{fmt(inv?.totalHT)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>TVA</span>
              <span>{fmt(inv?.tvaTotal)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-accent-red border-t border-slate-200 pt-2 mt-1">
              <span>Total TTC</span>
              <span>{fmt(inv?.total)}</span>
            </div>
          </div>

          {showSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex items-start gap-4" data-testid="pay-invoice-success">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-black text-emerald-900 uppercase tracking-widest">Paiement reçu</h3>
                <p className="text-sm text-slate-700 mt-1">
                  {paidConfirmation
                    ? `Merci, votre paiement de ${paidConfirmation.amount || ''} ${paidConfirmation.currency || ''} a bien été reçu.`
                    : `Ce ${docLabel.toLowerCase()} a déjà été payé.`}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Vous pouvez fermer cette page. {company?.name} a été notifié automatiquement.
                </p>
              </div>
            </div>
          ) : isCapturing ? (
            <div className="flex items-center justify-center gap-3 py-6 text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin text-accent-red" />
              Confirmation du paiement en cours…
            </div>
          ) : !company?.hasPaypalConfig ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              Le paiement en ligne n'est pas disponible pour ce document.
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              <button
                type="button"
                onClick={handlePay}
                disabled={isStarting}
                data-testid="pay-invoice-paypal-btn"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0070ba] text-white rounded-2xl text-sm font-black uppercase tracking-wider hover:bg-[#005ea6] shadow-lg shadow-[#0070ba]/20 transition-all disabled:opacity-60"
              >
                {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {isStarting ? 'Redirection vers PayPal…' : 'Payer par PayPal'}
              </button>
            </div>
          )}
        </div>

        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center">
          Document propulsé par <strong className="text-slate-700">SmartDesk</strong>.
        </div>
      </div>
    </div>
  );
}
