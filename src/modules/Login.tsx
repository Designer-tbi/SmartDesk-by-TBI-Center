import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DEMO_ACCOUNTS } from '../constants';
import { Lock, Mail, Eye, EyeOff, AlertCircle, PlayCircle, User, Phone, CheckCircle2, Building2, MapPin, Zap, BarChart3, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface LoginProps {
  onLogin: (user: any) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const { t, language, setLanguage } = useTranslation();
  const [loginMode, setLoginMode] = useState<'production' | 'demo'>('production');
  const [isRegistering, setIsRegistering] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
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
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, demoMode: loginMode === 'demo' })
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error("L'API n'est pas configurée correctement sur le serveur (HTML reçu au lieu de JSON).");
        }
        const data = await response.json();
        // Session is now stored in an HttpOnly cookie set by the server —
        // we only need to hand the user object over to the app shell.
        onLogin(data.user);
      } else {
        const text = await response.text();
        let errorMessage = t('login.invalidCredentials');
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorData.error || errorMessage;
          if (errorData.stack && process.env.NODE_ENV === 'development') {
            console.error('Server Error Stack:', errorData.stack);
          }
        } catch (e) {
          console.error('Non-JSON error response:', text);
          errorMessage = `Erreur serveur (${response.status})`;
        }
        setError(errorMessage);
      }
    } catch (err: any) {
      console.error('Login fetch error:', err);
      setError(err.message || t('login.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@smartdesk.cg', password: 'admin', demoMode: true })
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error("L'API n'est pas configurée correctement sur le serveur (HTML reçu au lieu de JSON).");
        }
        const data = await response.json();
        onLogin(data.user);
      } else {
        const text = await response.text();
        let errorMessage = t('login.invalidCredentials');
        try {
          const data = JSON.parse(text);
          errorMessage = data.error || errorMessage;
        } catch (e) {
          console.error('Non-JSON error response:', text);
          errorMessage = `Erreur serveur (${response.status})`;
        }
        setError(errorMessage);
      }
    } catch (error: any) {
      console.error('Demo login failed:', error);
      setError(error.message || t('login.connectionError'));
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
        const text = await response.text();
        const data = JSON.parse(text);
        if (data.code) {
          setSuccessMessage(t('login.accountCreated', { code: data.code }));
        } else {
          setSuccessMessage(t('login.codeSent'));
        }
        setIsRegistering(false);
        setEmail(regForm.email);
      } else {
        const text = await response.text();
        try {
          const errorData = JSON.parse(text);
          setError(errorData.error || t('login.invalidCredentials'));
        } catch (e) {
          console.error('Non-JSON error response:', text);
          setError(`Erreur serveur (${response.status})`);
        }
      }
    } catch (err) {
      setError(t('login.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderHeader = () => {
    if (loginMode === 'production') {
      return t('login.clientSpace');
    }
    return isRegistering ? t('login.requestDemo') : t('login.demoSpace');
  };

  return (
    <div className="h-screen relative flex items-center justify-center p-4 overflow-hidden bg-slate-950">
      {/* Immersive Background */}
      <div className="fixed inset-0 z-0">
        <motion.img 
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.3 }}
          transition={{ duration: 3, ease: "easeOut" }}
          src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2000" 
          alt="Modern Office" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        {/* Layered Gradients for Depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-primary-red/20 to-slate-950"></div>
        
        {/* Animated Mesh Gradients */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full bg-accent-red/10 blur-[150px]"
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] rounded-full bg-primary-red/10 blur-[150px]"
        />
        
        {/* Noise Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      </div>

      <div className="w-full max-w-7xl relative z-10 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24">
        
        {/* Left Column: Brand Story */}
        <div className="hidden lg:flex flex-col text-white max-w-xl">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="h-px w-12 bg-accent-red"></div>
              <span className="text-accent-red font-bold tracking-[0.3em] text-xs uppercase">SmartDesk Enterprise</span>
            </div>
            
            <h1 className="text-6xl xl:text-7xl font-serif font-bold mb-8 leading-[0.9] tracking-tight">
              L'excellence <br />
              <span className="italic font-normal text-red-200/90">opérationnelle</span> <br />
              au service de <br />
              votre vision.
            </h1>
            
            <p className="text-xl text-slate-300/80 mb-12 leading-relaxed font-light max-w-md">
              Une plateforme unifiée pour piloter votre croissance, automatiser vos processus et libérer le potentiel de vos équipes.
            </p>
            
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-3xl font-serif italic text-white mb-1">99.9%</h4>
                <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Disponibilité</p>
              </div>
              <div>
                <h4 className="text-3xl font-serif italic text-white mb-1">256-bit</h4>
                <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Chiffrement</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Form Card */}
        <div className={`w-full transition-all duration-700 ease-in-out ${loginMode === 'demo' && isRegistering ? 'max-w-2xl' : 'max-w-md'}`}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white/[0.03] backdrop-blur-3xl rounded-[2.5rem] shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden flex flex-col relative"
          >
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none"></div>
            
            <div className="p-8 pb-4 text-center shrink-0 relative">
              <div className="absolute top-6 right-8 flex gap-2">
                <button 
                  type="button"
                  onClick={() => setLanguage('fr')} 
                  className={`text-[10px] font-bold px-2 py-1 rounded-full transition-all border ${language === 'fr' ? 'bg-white text-slate-950 border-white' : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'}`}
                >
                  FR
                </button>
                <button 
                  type="button"
                  onClick={() => setLanguage('en')} 
                  className={`text-[10px] font-bold px-2 py-1 rounded-full transition-all border ${language === 'en' ? 'bg-white text-slate-950 border-white' : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'}`}
                >
                  EN
                </button>
              </div>

              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.3 }}
                className="w-16 h-16 bg-gradient-to-br from-accent-red to-primary-red rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 shadow-2xl shadow-accent-red/20 border border-white/20"
              >
                S
              </motion.div>
              
              <h2 className="text-3xl font-serif font-bold text-white tracking-tight mb-2">
                {loginMode === 'production' ? 'Bienvenue' : 'Espace Démo'}
              </h2>
              <p className="text-slate-400 text-sm font-medium">
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
                  transition={{ duration: 0.5 }}
                  onSubmit={handleRegister} 
                  className="p-8 pt-0 space-y-4 flex-1"
                >
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="font-medium">{error}</p>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Prénom</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red transition-all placeholder:text-slate-600"
                        placeholder="Jean"
                        value={regForm.prenom || ''}
                        onChange={(e) => setRegForm({...regForm, prenom: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Nom</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red transition-all placeholder:text-slate-600"
                        placeholder="Dupont"
                        value={regForm.nom || ''}
                        onChange={(e) => setRegForm({...regForm, nom: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Email Pro</label>
                      <input
                        type="email"
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red transition-all placeholder:text-slate-600"
                        placeholder="jean@entreprise.com"
                        value={regForm.email || ''}
                        onChange={(e) => setRegForm({...regForm, email: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Téléphone</label>
                      <input
                        type="tel"
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red transition-all placeholder:text-slate-600"
                        placeholder="+242..."
                        value={regForm.telephone || ''}
                        onChange={(e) => setRegForm({...regForm, telephone: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Entreprise</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red transition-all placeholder:text-slate-600"
                        placeholder="Nom de société"
                        value={regForm.companyName || ''}
                        onChange={(e) => setRegForm({...regForm, companyName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Pays</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red transition-all appearance-none cursor-pointer"
                        value={regForm.country || 'FR'}
                        onChange={(e) => setRegForm({...regForm, country: e.target.value, state: ''})}
                      >
                        <option value="FR" className="bg-slate-900">France</option>
                        <option value="CG" className="bg-slate-900">Congo</option>
                        <option value="CI" className="bg-slate-900">Côte d'Ivoire</option>
                        <option value="SN" className="bg-slate-900">Sénégal</option>
                        <option value="CM" className="bg-slate-900">Cameroun</option>
                        <option value="CD" className="bg-slate-900">RDC</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-white text-slate-950 rounded-2xl font-bold text-sm hover:bg-red-50 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Confirmer l'inscription
                      </>
                    )}
                  </button>

                  <div className="text-center mt-6">
                    <button
                      type="button"
                      onClick={() => setIsRegistering(false)}
                      className="text-sm text-slate-400 hover:text-white transition-colors font-medium"
                    >
                      J'ai déjà un code d'accès
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.form 
                  key="login"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5 }}
                  onSubmit={handleSubmit} 
                  className="p-8 pt-0 space-y-6 flex-1"
                >
                  {successMessage && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm"
                    >
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <p className="font-medium">{successMessage}</p>
                    </motion.div>
                  )}
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="font-medium">{error}</p>
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Identifiant</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-accent-red transition-colors" />
                      <input
                        type="email"
                        required
                        className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red transition-all placeholder:text-slate-600"
                        placeholder="votre@email.com"
                        value={email || ''}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Mot de passe</label>
                      <button type="button" className="text-[10px] font-bold text-accent-red hover:text-red-400 transition-colors uppercase tracking-widest">Oublié ?</button>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-accent-red transition-colors" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red transition-all placeholder:text-slate-600"
                        placeholder="••••••••"
                        value={password || ''}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-1">
                    <button 
                      type="button"
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${rememberMe ? 'bg-accent-red border-accent-red' : 'bg-white/5 border-white/10'}`}
                    >
                      {rememberMe && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </button>
                    <span className="text-xs text-slate-400 font-medium">Rester connecté</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-gradient-to-r from-accent-red to-primary-red text-white rounded-2xl font-bold text-sm hover:shadow-[0_0_30px_rgba(190,18,60,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5" />
                        {loginMode === 'demo' ? "Accéder à la démo" : "Se connecter"}
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Footer Actions */}
            <div className="p-8 pt-0 border-t border-white/5 bg-white/[0.01]">
              <AnimatePresence mode="wait">
                {loginMode === 'production' ? (
                  <motion.div 
                    key="prod-footer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-4"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMode('demo');
                        setIsRegistering(true);
                      }}
                      className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <PlayCircle className="w-4 h-4 text-accent-red" />
                      Demander un accès démo
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="demo-footer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-3"
                  >
                    <button
                      type="button"
                      onClick={handleQuickDemo}
                      className="w-full py-3 bg-accent-red/20 border border-accent-red/30 text-accent-red rounded-2xl font-bold text-xs hover:bg-accent-red/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      Accès rapide (Invité)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoginMode('production')}
                      className="text-xs text-slate-500 hover:text-white transition-colors font-bold uppercase tracking-widest"
                    >
                      Retour à l'espace client
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          
          {/* Legal Links */}
          <div className="mt-8 flex items-center justify-center gap-6 text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
            <a href="#" className="hover:text-white transition-colors">Aide</a>
            <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-white transition-colors">Conditions</a>
          </div>
        </div>
      </div>

      {/* Floating Decorative Elements */}
      <div className="fixed bottom-12 left-12 z-10 hidden xl:block">
        <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.5em] vertical-text">
          SmartDesk &copy; 2026
        </p>
      </div>
    </div>
  );
};
