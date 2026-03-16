import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, Users, DollarSign, Package, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const data = [
  { name: 'Jan', sales: 4000, expenses: 2400 },
  { name: 'Fév', sales: 3000, expenses: 1398 },
  { name: 'Mar', sales: 2000, expenses: 9800 },
  { name: 'Avr', sales: 2780, expenses: 3908 },
  { name: 'Mai', sales: 1890, expenses: 4800 },
  { name: 'Juin', sales: 2390, expenses: 3800 },
];

const pieData = [
  { name: 'Matériel', value: 400 },
  { name: 'Services', value: 300 },
  { name: 'Logiciels', value: 300 },
];

const COLORS = ['#4f46e5', '#10b981', '#f59e0b'];

const StatCard = ({ title, value, change, icon: Icon, trend, delay }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
  >
    <div className="flex items-center justify-between mb-4 sm:mb-6">
      <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl sm:rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div className={`flex items-center gap-1 text-[9px] sm:text-[10px] font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full uppercase tracking-wider ${trend === 'up' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
        {trend === 'up' ? <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
        {change}
      </div>
    </div>
    <h3 className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] ml-0.5">{title}</h3>
    <p className="text-2xl sm:text-4xl font-black text-slate-900 mt-1 sm:mt-2 tracking-tighter">{value}</p>
  </motion.div>
);

import { useTranslation } from '../lib/i18n';

export const Dashboard = ({ user }: { user: any }) => {
  const { t } = useTranslation();
  const isUS = user?.country === 'USA';
  const currencySymbol = user?.currency === 'USD' ? '$' : user?.currency === 'EUR' ? '€' : user?.currency === 'XAF' ? 'XAF' : (isUS ? '$' : '€');

  const taxLabel = isUS ? t('accounting.salesTax') : t('accounting.tva');
  const [stats, setStats] = useState({ 
    contacts: 0, 
    revenue: 0, 
    orders: 0, 
    products: 0,
    monthlyData: [],
    categoryData: [],
    activities: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiFetch('/api/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 h-full">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">{t('dashboard.loading')}</p>
      </div>
    );
  }

  const chartData = stats.monthlyData.length > 0 ? stats.monthlyData : [
    { name: t('dashboard.months.jan'), sales: 0, expenses: 0 },
    { name: t('dashboard.months.feb'), sales: 0, expenses: 0 },
    { name: t('dashboard.months.mar'), sales: 0, expenses: 0 },
    { name: t('dashboard.months.apr'), sales: 0, expenses: 0 },
    { name: t('dashboard.months.may'), sales: 0, expenses: 0 },
    { name: t('dashboard.months.jun'), sales: 0, expenses: 0 },
  ];

  const pieData = stats.categoryData.length > 0 ? stats.categoryData.map(item => ({
    ...item,
    name: item.name === 'Matériel' ? t('dashboard.categories.hardware') :
          item.name === 'Services' ? t('dashboard.categories.services') :
          item.name === 'Logiciels' ? t('dashboard.categories.software') :
          item.name
  })) : [
    { name: t('dashboard.noData'), value: 0 }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard title={t('dashboard.revenue')} value={`${stats.revenue.toLocaleString()} ${currencySymbol}`} change="0%" icon={DollarSign} trend="up" delay={0.1} />
        <StatCard title={t('dashboard.contacts')} value={stats.contacts.toString()} change="0%" icon={Users} trend="up" delay={0.2} />
        <StatCard title={t('dashboard.orders')} value={stats.orders.toString()} change="0%" icon={Package} trend="up" delay={0.3} />
        <StatCard title={t('dashboard.products')} value={stats.products.toString()} change="0%" icon={TrendingUp} trend="up" delay={0.4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="lg:col-span-2 bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{t('dashboard.salesPerformance')}</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.sales')}</span>
              </div>
              <div className="flex items-center gap-1.5 ml-4">
                <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.expenses')}</span>
              </div>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '16px', 
                    border: '1px solid #f1f5f9', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="sales" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="expenses" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-slate-200 shadow-sm"
        >
          <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">{t('dashboard.distribution')}</h3>
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('common.total')}</span>
              <span className="text-2xl font-black text-slate-900">{stats.revenue.toLocaleString()} {currencySymbol}</span>
            </div>
          </div>
          <div className="space-y-4 mt-8">
            {pieData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shadow-sm transition-transform group-hover:scale-150" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">{item.name}</span>
                </div>
                <span className="font-black text-slate-900 text-sm">{item.value.toLocaleString()} {currencySymbol}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
      >
        <h3 className="text-lg font-bold text-slate-900 mb-6">{t('dashboard.recentActivity')}</h3>
        <div className="space-y-4">
          {stats.activities.length > 0 ? (
            stats.activities.map((activity: any, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shadow-sm">
                    {activity.user_name?.charAt(0) || 'A'}
                  </div>
                  <div>
                    <p className="text-sm">
                      <span className="font-bold text-slate-900">{activity.user_name || t('common.system')}</span>
                      <span className="text-slate-500 mx-1.5">{activity.action}</span>
                      <span className="font-semibold text-indigo-600">{activity.details}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      {new Date(activity.createdAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-slate-500 italic">
              {t('dashboard.noRecentActivity')}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
