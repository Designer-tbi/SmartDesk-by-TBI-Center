import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, DollarSign, Package, ArrowUpRight, ArrowDownRight, 
  Loader2, Calendar, Activity, Zap, Target, MoreHorizontal
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../lib/i18n';

const COLORS = ['#2563eb', '#3b82f6', '#1e3a8a', '#60a5fa'];

const StatCard = ({ title, value, change, icon: Icon, trend, delay }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm hover:shadow-xl hover:shadow-accent-blue/5 transition-all group relative overflow-hidden"
  >
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
      <Icon className="w-24 h-24 -mr-8 -mt-8" />
    </div>
    
    <div className="flex items-center justify-between mb-6 relative z-10">
      <div className="p-3 bg-luxury-gray rounded-2xl group-hover:bg-accent-blue group-hover:text-white transition-all shadow-inner">
        <Icon className="w-5 h-5" />
      </div>
      <div className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${trend === 'up' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
        {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {change}
      </div>
    </div>
    
    <div className="relative z-10">
      <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] ml-0.5">{title}</h3>
      <p className="text-3xl font-black text-slate-900 mt-2 tracking-tighter font-mono">{value}</p>
    </div>
  </motion.div>
);

export const Dashboard = ({ user }: { user: any }) => {
  const { t } = useTranslation();
  const currencySymbol = user?.currency || 'XAF';
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
      setIsLoading(true);
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
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 h-full">
        <Loader2 className="w-10 h-10 text-accent-blue animate-spin" />
        <p className="text-sm font-medium text-slate-500 font-mono uppercase tracking-widest">{t('dashboard.loading')}</p>
      </div>
    );
  }

  const chartData = stats.monthlyData?.length > 0 ? stats.monthlyData.map((item: any) => {
    let translatedName = item.name;
    const lowerName = item.name.toLowerCase();
    if (lowerName === 'jan') translatedName = t('dashboard.months.jan');
    else if (lowerName === 'feb' || lowerName === 'fév') translatedName = t('dashboard.months.feb');
    else if (lowerName === 'mar') translatedName = t('dashboard.months.mar');
    else if (lowerName === 'apr' || lowerName === 'avr') translatedName = t('dashboard.months.apr');
    else if (lowerName === 'may' || lowerName === 'mai') translatedName = t('dashboard.months.may');
    else if (lowerName === 'jun' || lowerName === 'juin') translatedName = t('dashboard.months.jun');
    else if (lowerName === 'jul' || lowerName === 'juil') translatedName = t('dashboard.months.jul');
    else if (lowerName === 'aug' || lowerName === 'aoû') translatedName = t('dashboard.months.aug');
    else if (lowerName === 'sep') translatedName = t('dashboard.months.sep');
    else if (lowerName === 'oct') translatedName = t('dashboard.months.oct');
    else if (lowerName === 'nov') translatedName = t('dashboard.months.nov');
    else if (lowerName === 'dec' || lowerName === 'déc') translatedName = t('dashboard.months.dec');
    
    return { ...item, name: translatedName };
  }) : [
    { name: t('dashboard.months.jan'), sales: 0, expenses: 0 },
    { name: t('dashboard.months.feb'), sales: 0, expenses: 0 },
    { name: t('dashboard.months.mar'), sales: 0, expenses: 0 },
    { name: t('dashboard.months.apr'), sales: 0, expenses: 0 },
    { name: t('dashboard.months.may'), sales: 0, expenses: 0 },
    { name: t('dashboard.months.jun'), sales: 0, expenses: 0 },
  ];

  const pieData = stats.categoryData?.length > 0 ? stats.categoryData.map((item: any) => ({
    ...item,
    name: item.name === 'Matériel' ? t('dashboard.categories.hardware') :
          item.name === 'Services' ? t('dashboard.categories.services') :
          item.name === 'Logiciels' ? t('dashboard.categories.software') :
          item.name
  })) : [
    { name: t('dashboard.noData'), value: 0 }
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary-blue tracking-tight">{t('nav.dashboard')}</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">{t('dashboard.welcome', { name: user?.name || 'User' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-100 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-soft-blue transition-colors shadow-sm">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </button>
          <button 
            onClick={() => {
              const fetchStats = async () => {
                setIsLoading(true);
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
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-accent-blue/90 transition-colors shadow-lg shadow-accent-blue/20"
          >
            <Zap className="w-4 h-4" />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t('dashboard.revenue')} value={`${(stats.revenue || 0).toLocaleString()} ${currencySymbol}`} change="+12.5%" icon={DollarSign} trend="up" delay={0.1} />
        <StatCard title={t('dashboard.contacts')} value={(stats.contacts || 0).toString()} change="+3.2%" icon={Users} trend="up" delay={0.2} />
        <StatCard title={t('dashboard.orders')} value={(stats.orders || 0).toString()} change="-1.4%" icon={Package} trend="down" delay={0.3} />
        <StatCard title={t('dashboard.products')} value={(stats.products || 0).toString()} change="+5.7%" icon={TrendingUp} trend="up" delay={0.4} />
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-primary-blue tracking-tight">{t('dashboard.salesPerformance')}</h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">{t('dashboard.monthlyOverview')}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-accent-blue shadow-sm shadow-accent-blue/20"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('dashboard.sales')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('dashboard.expenses')}</span>
              </div>
            </div>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eff6ff" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '20px', 
                    border: '1px solid #f1f5f9', 
                    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                    padding: '16px',
                    fontFamily: 'Inter, sans-serif'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  labelStyle={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#2563eb" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                  animationDuration={2000}
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#e2e8f0" 
                  strokeWidth={2}
                  fill="transparent"
                  animationDuration={2500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm flex flex-col"
        >
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-xl font-black text-primary-blue tracking-tight">{t('dashboard.distribution')}</h3>
            <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
              <MoreHorizontal className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          
          <div className="h-64 relative flex-shrink-0">
            {stats.categoryData?.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={80}
                      outerRadius={105}
                      paddingAngle={10}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('common.total')}</span>
                  <span className="text-2xl font-black text-slate-900 font-mono">{(stats.revenue || 0).toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{currencySymbol}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 italic font-mono text-xs uppercase tracking-widest">
                {t('dashboard.noData')}
              </div>
            )}
          </div>
          
          <div className="space-y-5 mt-10 flex-grow">
            {pieData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between group cursor-default">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full shadow-sm transition-transform group-hover:scale-125" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{item.name}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-black text-slate-900 text-sm font-mono">{item.value.toLocaleString()} {currencySymbol}</span>
                  <div className="w-24 h-1 bg-slate-50 rounded-full mt-1 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-1000" 
                      style={{ 
                        backgroundColor: COLORS[index % COLORS.length],
                        width: `${(item.value / (stats.revenue || 1)) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
      
      {/* Bottom Section: Activity & Quick Actions */}
      <div className="grid grid-cols-1 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-soft-blue text-accent-blue rounded-xl">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-primary-blue tracking-tight">{t('dashboard.recentActivity')}</h3>
            </div>
            <button className="text-[10px] font-black text-accent-blue uppercase tracking-widest hover:underline">
              {t('common.viewAll')}
            </button>
          </div>
          
          <div className="space-y-6">
            {stats.activities?.length > 0 ? (
              stats.activities.slice(0, 5).map((activity: any, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-soft-blue/10 transition-all border border-transparent hover:border-blue-50 group">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-lg shadow-inner group-hover:bg-white group-hover:shadow-md transition-all">
                    {activity.user_name?.charAt(0) || 'A'}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900">
                        {activity.user_name || t('common.system')}
                      </p>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {new Date(activity.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {activity.action} <span className="font-black text-accent-blue tracking-tight">{activity.details}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {new Date(activity.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 italic font-mono text-xs uppercase tracking-widest">
                <Activity className="w-12 h-12 mb-4 opacity-20" />
                {t('dashboard.noRecentActivity')}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

