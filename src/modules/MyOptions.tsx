import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Smartphone, CheckCircle2 } from 'lucide-react';
import { PageHeader, Card, Badge } from '../components/ui';
import { apiFetch } from '../lib/api';
import { useTranslation } from '../lib/i18n';

/**
 * Payment methods hub, shown as cards. PayPal reflects the company's real
 * configuration state (Settings → Paiements) and links there; the Mobile
 * Money providers aren't wired up on the backend yet, so they're shown as
 * "coming soon" placeholders.
 */
export const MyOptions = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hasPaypalConfig, setHasPaypalConfig] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/company')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setHasPaypalConfig(!!data.hasPaypalConfig);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title={t('myOptions.title')} description={t('myOptions.desc')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card
          interactive
          onClick={() => navigate('/settings?tab=company')}
          className="cursor-pointer flex flex-col gap-4"
          data-testid="my-options-paypal-card"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-[#0070ba]/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-[#0070ba]" />
            </div>
            <Badge tone={hasPaypalConfig ? 'success' : 'neutral'} dot>
              {hasPaypalConfig ? (
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{t('myOptions.configured')}</span>
              ) : t('myOptions.notConfigured')}
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
    </div>
  );
};
