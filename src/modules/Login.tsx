import React, { useState } from 'react';
import { DEMO_ACCOUNTS, MOCK_COMPANY } from '../constants';
import { Lock, Mail, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: any) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      const user = DEMO_ACCOUNTS.find(u => u.email === email && u.password === password);
      if (user) {
        onLogin(user);
      } else {
        setError('Identifiants incorrects. Veuillez réessayer.');
        setIsLoading(false);
      }
    }, 1000);
  };

  const handleDemoLogin = (demoUser: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(demoUser.email);
    setPassword(demoUser.password);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-8 pb-6 text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 shadow-lg shadow-indigo-200">
              S
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase mb-2">
              {MOCK_COMPANY.name}
            </h1>
            <p className="text-slate-500 text-sm font-medium">Connectez-vous à votre espace de travail</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 pt-0 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email professionnel</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  required
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="nom@entreprise.cg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <div className="p-8 bg-slate-50 border-t border-slate-100">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">Comptes de démonstration</h3>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.email}
                  onClick={() => handleDemoLogin(demo)}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group text-left"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{demo.name}</div>
                    <div className="text-[10px] text-slate-500">{demo.role}</div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-500">
                    {demo.password}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <p className="mt-8 text-center text-slate-400 text-xs">
          &copy; 2024 {MOCK_COMPANY.name}. Tous droits réservés. <br className="mt-1" />
          SmartDesk by <a href="https://tbi-center.fr" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-medium">TBI Center</a>
        </p>
      </div>
    </div>
  );
};
