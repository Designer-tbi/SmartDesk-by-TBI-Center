import React from 'react';
import { UserCheck, Calculator } from 'lucide-react';
import { PageHeader, Card, Badge } from '../components/ui';
import { useTranslation } from '../lib/i18n';

/**
 * Placeholder hub for upcoming specialized agents — cards only for now,
 * no functionality wired up yet.
 */
export const MyAgents = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageHeader title={t('myAgents.title')} description={t('myAgents.desc')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card className="flex flex-col gap-4 opacity-70" data-testid="my-agents-hr-card">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-soft-red flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-accent-red" />
            </div>
            <Badge tone="neutral">{t('myOptions.comingSoon')}</Badge>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{t('myAgents.hr')}</h3>
            <p className="text-sm text-slate-500 mt-1">{t('myAgents.hrDesc')}</p>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 opacity-70" data-testid="my-agents-accounting-card">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-soft-red flex items-center justify-center">
              <Calculator className="w-6 h-6 text-accent-red" />
            </div>
            <Badge tone="neutral">{t('myOptions.comingSoon')}</Badge>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{t('myAgents.accounting')}</h3>
            <p className="text-sm text-slate-500 mt-1">{t('myAgents.accountingDesc')}</p>
          </div>
        </Card>
      </div>
    </div>
  );
};
