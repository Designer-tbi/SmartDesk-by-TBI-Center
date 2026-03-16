import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEMO_ACCOUNTS, MOCK_COMPANY } from '../constants';
import { Lock, Mail, Eye, EyeOff, AlertCircle, PlayCircle, User, Phone, CheckCircle2, Building2, MapPin } from 'lucide-react';

interface LoginProps {
  onLogin: (user: any) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [loginMode, setLoginMode] = useState<'production' | 'demo'>('production');
  const [isRegistering, setIsRegistering] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [regForm, setRegForm] = useState({ nom: '', prenom: '', email: '', telephone: '', companyName: '', country: 'FR', state: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, demoMode: loginMode === 'demo' })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('demoMode', loginMode === 'demo' ? 'true' : 'false');
        onLogin(data.user);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Identifiants incorrects. Veuillez réessayer.');
      }
    } catch (err) {
      setError("Erreur de connexion au serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      const response = await fetch('/api/auth/send-demo-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...regForm, code })
      });
      
      if (response.ok) {
        setSuccessMessage('Un code de connexion a été envoyé à votre adresse email.');
        setIsRegistering(false);
        setEmail(regForm.email);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Erreur lors de l'envoi de l'email.");
      }
    } catch (err) {
      setError("Erreur de connexion au serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderHeader = () => {
    if (loginMode === 'production') {
      return "Connectez-vous à votre espace client";
    }
    return isRegistering ? "Demander un accès démo" : "Connectez-vous à l'espace démo";
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* World Map Background */}
      <div className="absolute inset-0 opacity-50">
        <img 
          src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop" 
          alt="World Map" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        {/* Glowing Points */}
        <motion.div className="absolute top-[20%] left-[20%] w-3 h-3 bg-indigo-400 rounded-full shadow-[0_0_20px_#818cf8]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 3, repeat: Infinity }} />
        <motion.div className="absolute top-[60%] left-[50%] w-4 h-4 bg-emerald-400 rounded-full shadow-[0_0_20px_#34d399]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} />
        <motion.div className="absolute bottom-[30%] right-[30%] w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_20px_#fbbf24]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl shadow-2xl shadow-indigo-900/20 border border-slate-100 overflow-hidden"
        >
          <div className="p-8 pb-6 text-center">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
              className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 shadow-lg shadow-indigo-200"
            >
              S
            </motion.div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase mb-2">
              {MOCK_COMPANY.name}
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              {renderHeader()}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {loginMode === 'demo' && isRegistering ? (
              <motion.form 
                key="register"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleRegister} 
                className="p-8 pt-0 space-y-5"
              >
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800 text-sm font-medium text-center">
                Un mot de passe de connexion vous sera envoyé par mail quelques minutes suivant votre inscription.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Prénom</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Prénom"
                      value={regForm.prenom}
                      onChange={(e) => setRegForm({...regForm, prenom: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nom</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Nom"
                      value={regForm.nom}
                      onChange={(e) => setRegForm({...regForm, nom: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email professionnel</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="nom@entreprise.cg"
                    value={regForm.email}
                    onChange={(e) => setRegForm({...regForm, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Entreprise</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Nom de l'entreprise"
                      value={regForm.companyName}
                      onChange={(e) => setRegForm({...regForm, companyName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pays</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select
                      required
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                      value={regForm.country}
                      onChange={(e) => setRegForm({...regForm, country: e.target.value, state: ''})}
                    >
                      <option value="FR">France</option>
                      <option value="CA">Canada</option>
                      <option value="US">United States</option>
                      <option value="GB">United Kingdom</option>
                      <option value="BE">Belgique</option>
                      <option value="CH">Suisse</option>
                      <option value="CI">Côte d'Ivoire</option>
                      <option value="SN">Sénégal</option>
                      <option value="CM">Cameroun</option>
                      <option value="CG">Congo</option>
                      <option value="CD">RDC</option>
                    </select>
                  </div>
                </div>
              </div>

              {regForm.country === 'US' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">État (State)</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select
                      required
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                      value={regForm.state}
                      onChange={(e) => setRegForm({...regForm, state: e.target.value})}
                    >
                      <option value="">Sélectionner un état</option>
                      <option value="CA">California</option>
                      <option value="NY">New York</option>
                      <option value="TX">Texas</option>
                      <option value="FL">Florida</option>
                      <option value="IL">Illinois</option>
                      <option value="PA">Pennsylvania</option>
                      <option value="OH">Ohio</option>
                      <option value="GA">Georgia</option>
                      <option value="NC">North Carolina</option>
                      <option value="MI">Michigan</option>
                      <option value="WA">Washington</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Numéro de téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="+242 00 000 0000"
                    value={regForm.telephone}
                    onChange={(e) => setRegForm({...regForm, telephone: e.target.value})}
                  />
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
                  "S'inscrire à la démo"
                )}
              </button>

              <div className="text-center mt-4 space-y-2 flex flex-col">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors"
                >
                  J'ai déjà un code d'accès
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode('production')}
                  className="text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors"
                >
                  Retour à l'espace client
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.form 
              key="login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSubmit} 
              className="p-8 pt-0 space-y-5"
            >
              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700 text-sm animate-in fade-in slide-in-from-top-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <p className="font-medium">{successMessage}</p>
                </div>
              )}
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                  {loginMode === 'demo' ? 'Mot de passe / Code' : 'Mot de passe'}
                </label>
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
                  loginMode === 'demo' ? "Se connecter à la démo" : "Se connecter à l'espace client"
                )}
              </button>
              
              {loginMode === 'demo' && (
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setLoginMode('production')}
                    className="text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors"
                  >
                    Retour à l'espace client
                  </button>
                </div>
              )}
            </motion.form>
          )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {loginMode === 'production' && (
              <motion.div 
                key="prod-footer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-8 bg-slate-50 border-t border-slate-100"
              >
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('demo');
                    setIsRegistering(true);
                  }}
                  disabled={isLoading}
                  className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-100 hover:border-slate-300 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <PlayCircle className="w-5 h-5 text-indigo-600" />
                  Accéder à l'espace démo
                </button>
                <p className="text-center text-[10px] text-slate-400 mt-3">
                  Explorez l'application avec des données fictives
                </p>
              </motion.div>
            )}
            
            {loginMode === 'demo' && !isRegistering && (
              <motion.div 
                key="demo-footer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-8 bg-slate-50 border-t border-slate-100"
              >
                <button
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  disabled={isLoading}
                  className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-100 hover:border-slate-300 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <User className="w-5 h-5 text-indigo-600" />
                  Demander un accès démo
                </button>
                <p className="text-center text-[10px] text-slate-400 mt-3">
                  Inscrivez-vous pour obtenir un code d'accès
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        
        <p className="mt-8 text-center text-slate-400 text-xs">
          &copy; 2026 {MOCK_COMPANY.name}. Tous droits réservés. <br className="mt-1" />
          SmartDesk by <a href="https://tbi-center.fr" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-medium">TBI Center</a>
        </p>
      </div>
    </div>
  );
};
