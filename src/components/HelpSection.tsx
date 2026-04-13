import React, { useState } from 'react';
import { useTranslation } from '../lib/i18n';
import { 
  BookOpen, LayoutDashboard, Calendar, Users, ShoppingCart, 
  Package, Clock, Briefcase, UserCheck, Calculator, Shield, 
  SettingsIcon, Bot, Zap, Crown, ListOrdered, CheckCircle2
} from 'lucide-react';

export const HelpSection = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('guide');

  const modules = [
    { key: 'help.dashboard', icon: LayoutDashboard },
    { key: 'help.agenda', icon: Calendar },
    { key: 'help.crm', icon: Users },
    { key: 'help.sales', icon: ShoppingCart },
    { key: 'help.inventory', icon: Package },
    { key: 'help.planning', icon: Clock },
    { key: 'help.projects', icon: Briefcase },
    { key: 'help.hr', icon: UserCheck },
    { key: 'help.accounting', icon: Calculator },
    { key: 'help.users', icon: Shield },
    { key: 'help.settings', icon: SettingsIcon },
    { key: 'help.superAdmin', icon: Crown },
  ];

  const tabs = [
    { id: 'guide', label: t('help.guideTitle'), icon: ListOrdered },
    { id: 'modules', label: t('help.modulesTitle'), icon: BookOpen },
    { id: 'automation', label: t('help.crmAutomationTitle'), icon: Bot },
  ];

  return (
    <div className="space-y-8">
      <div className="flex space-x-4 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 py-4 px-6 font-bold transition-colors ${
              activeTab === tab.id 
                ? 'text-accent-red border-b-2 border-accent-red' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'automation' && (
        <div className="bg-gradient-to-br from-primary-red to-accent-red rounded-3xl p-8 text-white shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-white/20 rounded-2xl">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black">{t('help.crmAutomationTitle')}</h2>
              <p className="text-soft-red">{t('help.crmAutomationSubtitle')}</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: t('help.crmAuto1'), desc: t('help.crmAuto1Desc') },
              { title: t('help.crmAuto2'), desc: t('help.crmAuto2Desc') },
              { title: t('help.crmAuto3'), desc: t('help.crmAuto3Desc') },
              { title: t('help.crmAuto4'), desc: t('help.crmAuto4Desc') },
            ].map((item, i) => (
              <div key={i} className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10">
                <Zap className="w-5 h-5 text-yellow-300 mb-3" />
                <h4 className="font-bold mb-1">{item.title}</h4>
                <p className="text-sm text-soft-red">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'guide' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <div className="mb-8">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ListOrdered className="w-6 h-6 text-accent-red" />
              {t('help.guideTitle')}
            </h3>
            <p className="text-slate-500 mt-2">{t('help.guideDesc')}</p>
          </div>
          
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {[
              { title: t('help.guideStep1Title'), desc: t('help.guideStep1Desc') },
              { title: t('help.guideStep2Title'), desc: t('help.guideStep2Desc') },
              { title: t('help.guideStep3Title'), desc: t('help.guideStep3Desc') },
              { title: t('help.guideStep4Title'), desc: t('help.guideStep4Desc') },
              { title: t('help.guideStep5Title'), desc: t('help.guideStep5Desc') },
            ].map((step, i) => (
              <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-white bg-soft-red text-accent-red shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-5 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <h4 className="font-bold text-slate-900 mb-2">{step.title}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'modules' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <div className="mb-8">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-accent-red" />
              {t('help.modulesTitle')}
            </h3>
            <p className="text-slate-500 mt-2">{t('help.modulesDesc')}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <div key={module.key} className="flex items-start gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-accent-red/20 hover:shadow-md transition-all">
                  <div className="p-2 bg-soft-red rounded-xl">
                    <Icon className="w-5 h-5 text-accent-red" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">{t(`${module.key}Title`)}</h4>
                    <p className="text-sm text-slate-600">{t(module.key)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
