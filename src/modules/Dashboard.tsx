import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, Users, DollarSign, Package, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';

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

const StatCard = ({ title, value, change, icon: Icon, trend }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className="p-2 bg-slate-50 rounded-lg">
        <Icon className="w-5 h-5 text-indigo-600" />
      </div>
      <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
        {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {change}
      </div>
    </div>
    <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
  </div>
);

export const Dashboard = () => {
  const [stats, setStats] = useState({ contacts: 0, revenue: 0, orders: 0, products: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
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
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Chargement du tableau de bord...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Chiffre d'Affaires" value={`${stats.revenue.toLocaleString()} XAF`} change="+12.5%" icon={DollarSign} trend="up" />
        <StatCard title="Nouveaux Clients" value={stats.contacts.toString()} change="+3.2%" icon={Users} trend="up" />
        <StatCard title="Commandes" value={stats.orders.toString()} change="-2.4%" icon={Package} trend="down" />
        <StatCard title="Produits" value={stats.products.toString()} change="+1.1%" icon={TrendingUp} trend="up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Performance des Ventes</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="sales" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Répartition par Catégorie</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-4">
            {pieData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-medium text-slate-900">{item.value} XAF</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Activités Récentes</h3>
        <div className="space-y-6">
          {[
            { user: 'Jean Dupont', action: 'a payé la facture', target: 'INV-2024-001', time: 'Il y a 2 heures', amount: '1,200 XAF' },
            { user: 'Alice Bernard', action: 'a mis à jour le projet', target: 'Refonte Site Web', time: 'Il y a 4 heures' },
            { user: 'Marie Curie', action: 'nouveau lead enregistré', target: 'Labo X', time: 'Il y a 6 heures' },
          ].map((activity, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium">
                  {activity.user.charAt(0)}
                </div>
                <div>
                  <p className="text-sm">
                    <span className="font-semibold text-slate-900">{activity.user}</span>
                    <span className="text-slate-500 mx-1">{activity.action}</span>
                    <span className="font-medium text-indigo-600">{activity.target}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{activity.time}</p>
                </div>
              </div>
              {activity.amount && <span className="text-sm font-bold text-emerald-600">+{activity.amount}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
