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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, demoMode: loginMode === 'demo' })
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error("L'API n'est pas configurée correctement sur le serveur (HTML reçu au lieu de JSON).");
        }
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('demoMode', data.user.isDemo ? 'true' : 'false');
        // Clear selectedCompanyId to ensure the new user's company is used
        localStorage.removeItem('selectedCompanyId');
        onLogin(data.user);
      } else {
        let errorMessage = t('login.invalidCredentials');
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          console.error('Non-JSON error response:', errorText);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@smartdesk.cg', password: 'admin', demoMode: true })
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error("L'API n'est pas configurée correctement sur le serveur (HTML reçu au lieu de JSON).");
        }
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('demoMode', 'true');
        localStorage.removeItem('selectedCompanyId');
        onLogin(data.user);
      } else {
        let errorMessage = t('login.invalidCredentials');
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          console.error('Non-JSON error response:', errorText);
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
        const data = await response.json();
        if (data.code) {
          setSuccessMessage(t('login.accountCreated', { code: data.code }));
        } else {
          setSuccessMessage(t('login.codeSent'));
        }
        setIsRegistering(false);
        setEmail(regForm.email);
      } else {
        const errorData = await response.json();
        setError(errorData.error || t('login.invalidCredentials'));
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
    <div className="h-screen relative flex items-center justify-center p-2 sm:p-4 overflow-hidden bg-primary-red">
      {/* Immersive Background */}
      <div className="fixed inset-0 z-0">
        <motion.img 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.4 }}
          transition={{ duration: 2, ease: "easeOut" }}
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2000" 
          alt="Modern Architecture" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        {/* Layered Gradients for Depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-red/90 via-primary-red/95 to-primary-red"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(153,27,27,0.2),transparent_70%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(185,28,28,0.1),transparent_50%)]"></div>
        
        {/* Animated Mesh Gradients */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent-red/10 blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            x: [0, -50, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-red-400/10 blur-[120px]"
        />
        
        {/* Noise Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      </div>

      <div className="w-full max-w-7xl relative z-10 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 my-auto">
        
        {/* Left Column: Advantages (Hidden on small screens, visible on lg) */}
        <div className="hidden lg:flex flex-col text-white max-w-lg xl:max-w-xl">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-4xl xl:text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-red-200 tracking-tight leading-tight">
              Transformez la gestion de votre entreprise
            </h1>
            <p className="text-lg text-red-100/80 mb-10 leading-relaxed">
              SmartDesk centralise tous vos outils pour une productivité maximale. La solution CRM et ERP conçue pour les PME et grandes entreprises.
            </p>
            
            <div className="space-y-8">
              <div className="flex items-start gap-5">
                <div className="p-3 bg-accent-red/20 rounded-xl border border-accent-red/30 shadow-lg shadow-accent-red/10">
                  <ShieldCheck className="w-7 h-7 text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-xl mb-1">Centralisation Sécurisée</h3>
                  <p className="text-red-200/70 text-sm leading-relaxed">Retrouvez vos clients, ventes, stocks et RH sur une seule plateforme cloud hautement sécurisée.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-5">
                <div className="p-3 bg-red-400/20 rounded-xl border border-red-400/30 shadow-lg shadow-red-400/10">
                  <Zap className="w-7 h-7 text-red-300" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-xl mb-1">Automatisation Intelligente</h3>
                  <p className="text-red-200/70 text-sm leading-relaxed">Gagnez un temps précieux en automatisant vos tâches répétitives, vos factures et vos suivis.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-5">
                <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 shadow-lg shadow-red-500/10">
                  <BarChart3 className="w-7 h-7 text-red-200" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-xl mb-1">Pilotage en Temps Réel</h3>
                  <p className="text-red-200/70 text-sm leading-relaxed">Prenez les meilleures décisions stratégiques grâce à nos tableaux de bord et rapports détaillés.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Form Card */}
        <div className={`w-full transition-all duration-700 ease-in-out ${loginMode === 'demo' && isRegistering ? 'max-w-[95%] sm:max-w-2xl' : 'max-w-[95%] sm:max-w-md'}`}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
            }}
          transition={{ 
            duration: 0.8, 
            ease: [0.22, 1, 0.36, 1] 
          }}
          className="bg-white/95 backdrop-blur-2xl rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] border border-white/60 overflow-hidden flex flex-col"
        >
          <div className="p-3 sm:p-5 pb-1 sm:pb-2 text-center shrink-0 relative">
            <div className="absolute top-4 right-4 flex gap-1.5">
              <button 
                type="button"
                onClick={() => setLanguage('fr')} 
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-md transition-all ${language === 'fr' ? 'bg-accent-red text-white shadow-lg shadow-accent-red/20' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              >
                FR
              </button>
              <button 
                type="button"
                onClick={() => setLanguage('en')} 
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-md transition-all ${language === 'en' ? 'bg-accent-red text-white shadow-lg shadow-accent-red/20' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              >
                EN
              </button>
            </div>
            <motion.div 
              initial={{ rotate: -10, scale: 0.8, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-accent-red via-primary-red to-slate-900 rounded-xl sm:rounded-[1.2rem] flex items-center justify-center text-white text-lg sm:text-xl font-black mx-auto mb-1 sm:mb-2 shadow-2xl shadow-accent-red/30 relative group cursor-pointer"
            >
              <div className="absolute inset-0 bg-white/20 rounded-xl sm:rounded-[1.2rem] opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="text-lg sm:text-xl"
              >
                S
              </motion.span>
            </motion.div>
            <h2 className="text-xl sm:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary-red to-accent-red tracking-tighter uppercase mb-0 sm:mb-1">
              SmartDesk
            </h2>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: 40 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="h-0.5 sm:h-1 bg-accent-red mx-auto rounded-full mb-1 sm:mb-2"
            ></motion.div>
            <p className="text-slate-500 text-[10px] sm:text-xs font-semibold leading-relaxed tracking-wide">
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
                transition={{ duration: 0.4, ease: "easeOut" }}
                onSubmit={handleRegister} 
                className="p-3 sm:p-5 pt-0 space-y-1.5 sm:space-y-2 overflow-hidden flex-1"
              >
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 sm:p-4 bg-red-50 border border-red-100 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 text-red-600 text-xs sm:text-sm"
                >
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <p className="font-semibold">{error}</p>
                </motion.div>
              )}

              <div className="p-3 sm:p-4 bg-soft-red border border-red-100 rounded-xl sm:rounded-2xl text-primary-red text-[10px] sm:text-xs font-semibold text-center leading-relaxed">
                Un mot de passe de connexion vous sera envoyé par mail quelques minutes suivant votre inscription.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Prénom</label>
                  <div className="relative group">
                    <User className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-focus-within:text-accent-red transition-colors" />
                    <input
                      type="text"
                      required
                      className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1 sm:py-2 bg-soft-red/10 border border-red-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red hover:border-accent-red transition-all placeholder:text-slate-400 shadow-sm"
                      placeholder="Prénom"
                      value={regForm.prenom || ''}
                      onChange={(e) => setRegForm({...regForm, prenom: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Nom</label>
                  <div className="relative group">
                    <User className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-focus-within:text-accent-red transition-colors" />
                    <input
                      type="text"
                      required
                      className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1 sm:py-2 bg-soft-red/10 border border-red-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red hover:border-accent-red transition-all placeholder:text-slate-400 shadow-sm"
                      placeholder="Nom"
                      value={regForm.nom || ''}
                      onChange={(e) => setRegForm({...regForm, nom: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Email professionnel</label>
                  <div className="relative group">
                    <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-focus-within:text-accent-red transition-colors" />
                    <input
                      type="email"
                      required
                      className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1 sm:py-2 bg-soft-red/10 border border-red-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red hover:border-accent-red transition-all placeholder:text-slate-400 shadow-sm"
                      placeholder="nom@entreprise.cg"
                      value={regForm.email || ''}
                      onChange={(e) => setRegForm({...regForm, email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Numéro de téléphone</label>
                  <div className="relative group">
                    <Phone className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-focus-within:text-accent-red transition-colors" />
                    <input
                      type="tel"
                      required
                      className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1 sm:py-2 bg-soft-red/10 border border-red-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red hover:border-accent-red transition-all placeholder:text-slate-400 shadow-sm"
                      placeholder="+242 00 000 0000"
                      value={regForm.telephone || ''}
                      onChange={(e) => setRegForm({...regForm, telephone: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Entreprise</label>
                  <div className="relative group">
                    <Building2 className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-focus-within:text-accent-red transition-colors" />
                    <input
                      type="text"
                      required
                      className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1 sm:py-2 bg-soft-red/10 border border-red-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red hover:border-accent-red transition-all placeholder:text-slate-400 shadow-sm"
                      placeholder="Nom de l'entreprise"
                      value={regForm.companyName || ''}
                      onChange={(e) => setRegForm({...regForm, companyName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Pays</label>
                  <div className="relative group">
                    <MapPin className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-focus-within:text-accent-red transition-colors" />
                    <select
                      required
                      className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1 sm:py-2 bg-soft-red/10 border border-red-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red hover:border-accent-red transition-all appearance-none cursor-pointer shadow-sm"
                      value={regForm.country || 'FR'}
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
                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">État (State)</label>
                  <div className="relative group">
                    <MapPin className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-focus-within:text-accent-red transition-colors" />
                    <select
                      required
                      className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1 sm:py-2 bg-soft-red/10 border border-red-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red hover:border-accent-red transition-all appearance-none cursor-pointer shadow-sm"
                      value={regForm.state || ''}
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-1.5 sm:py-2 bg-gradient-to-r from-accent-red via-primary-red to-slate-900 text-white rounded-xl font-bold text-xs sm:text-sm hover:shadow-[0_0_20px_rgba(153,27,27,0.4)] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 relative overflow-hidden group mt-1.5"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {isLoading ? (
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    S'inscrire à la démo
                  </>
                )}
              </button>

              <div className="text-center mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 flex flex-col">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="text-xs sm:text-sm text-slate-500 hover:text-accent-red font-bold transition-colors"
                >
                  J'ai déjà un code d'accès
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode('production')}
                  className="text-xs sm:text-sm text-slate-400 hover:text-accent-red font-medium transition-colors"
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
              transition={{ duration: 0.4, ease: "easeOut" }}
              onSubmit={handleSubmit} 
              className="p-3 sm:p-5 pt-0 space-y-1.5 sm:space-y-2 overflow-hidden flex-1"
            >
              {successMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 sm:p-4 bg-emerald-50 border border-emerald-100 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 text-emerald-700 text-xs sm:text-sm"
                >
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <p className="font-semibold">{successMessage}</p>
                </motion.div>
              )}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="font-semibold">{error}</p>
                </motion.div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Email professionnel</label>
                <div className="relative group">
                  <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-focus-within:text-accent-red transition-colors" />
                  <input
                    type="email"
                    required
                    className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1 sm:py-2 bg-soft-red/10 border border-red-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red hover:border-accent-red transition-all placeholder:text-slate-400 shadow-sm"
                    placeholder="nom@entreprise.cg"
                    value={email || ''}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">
                  {loginMode === 'demo' ? 'Mot de passe / Code' : 'Mot de passe'}
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-focus-within:text-accent-red transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-9 sm:pl-10 pr-10 py-1 sm:py-2 bg-soft-red/10 border border-red-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent-red/20 focus:border-accent-red hover:border-accent-red transition-all placeholder:text-slate-400 shadow-sm"
                    placeholder="••••••••"
                    value={password || ''}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-accent-red transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between px-1 pt-2 sm:pt-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-red-50 border border-red-100 group-hover:bg-red-100 transition-all duration-300">
                    <input 
                      type="checkbox" 
                      className="peer absolute opacity-0 w-full h-full cursor-pointer z-10" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <div className={`w-3.5 h-3.5 bg-accent-red rounded-[4px] transition-all duration-300 ${rememberMe ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
                  </div>
                  <span className="text-sm text-slate-500 font-semibold group-hover:text-slate-700 transition-colors">Se souvenir de moi</span>
                </label>
                <button 
                  type="button" 
                  className="text-sm text-accent-red font-bold hover:text-accent-red/80 transition-colors uppercase tracking-tight"
                  onClick={() => alert('Fonctionnalité de récupération de mot de passe à venir')}
                >
                  OUBLIÉ ?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2 sm:py-3 bg-gradient-to-r from-accent-red via-primary-red to-slate-900 text-white rounded-xl font-bold text-sm hover:shadow-[0_0_20px_rgba(153,27,27,0.4)] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden group mt-2"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    {loginMode === 'demo' ? "Se connecter à la démo" : "Se connecter à l'espace client"}
                  </>
                )}
              </button>

              {loginMode === 'demo' && (
                <div className="text-center mt-2 sm:mt-3">
                  <button
                    type="button"
                    onClick={() => setLoginMode('production')}
                    className="text-xs sm:text-sm text-slate-500 hover:text-accent-red font-bold transition-colors"
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
                  className="p-2 sm:p-3 bg-soft-red/10 border-t border-red-50 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode('demo');
                      setIsRegistering(true);
                    }}
                    disabled={isLoading}
                    className="w-full py-1.5 sm:py-2 bg-white border border-red-100 text-primary-red rounded-xl font-bold text-xs sm:text-sm hover:bg-soft-red/20 hover:border-red-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 shadow-sm"
                  >
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-red" />
                    Demander un accès démo
                  </button>
                  <p className="text-center text-[9px] sm:text-[10px] text-red-300 mt-1.5 sm:mt-2 font-bold uppercase tracking-widest">
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
                  className="p-2 sm:p-3 bg-soft-red/10 border-t border-red-50 space-y-1.5 sm:space-y-2 shrink-0"
                >
                  <button
                    type="button"
                    onClick={handleQuickDemo}
                    disabled={isLoading}
                    className="w-full py-1.5 sm:py-2 bg-soft-red text-accent-red rounded-xl font-bold text-xs sm:text-sm hover:bg-red-100 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3"
                  >
                    <PlayCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Accès rapide démo
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRegistering(true)}
                    disabled={isLoading}
                    className="w-full py-1.5 sm:py-2 bg-white border border-red-100 text-primary-red rounded-xl font-bold text-xs sm:text-sm hover:bg-soft-red/20 hover:border-red-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 shadow-sm"
                  >
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-red" />
                    Demander un accès démo
                  </button>
                  <p className="text-center text-[9px] sm:text-[10px] text-red-300 mt-1.5 sm:mt-2 font-bold uppercase tracking-widest">
                    Inscrivez-vous pour obtenir un code d'accès
                  </p>
                </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        
        <div className="flex items-center justify-center gap-4 mt-3 sm:mt-4 text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <a href="#" className="hover:text-accent-red transition-colors">Aide</a>
          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
          <a href="#" className="hover:text-accent-red transition-colors">Confidentialité</a>
          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
          <a href="#" className="hover:text-accent-red transition-colors">Conditions</a>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-1.5 sm:mt-2 text-center"
        >
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-0.5 sm:mb-1">
            <div className="h-px w-6 sm:w-8 bg-gradient-to-r from-transparent to-slate-700"></div>
            <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em]">
              SmartDesk Enterprise
            </p>
            <div className="h-px w-6 sm:w-8 bg-gradient-to-l from-transparent to-slate-700"></div>
          </div>
          <p className="text-slate-500 text-[10px] sm:text-[11px] font-medium mb-0.5 sm:mb-1">
            &copy; 2026 Tous droits réservés.
          </p>
          <p className="text-slate-600 text-[9px] sm:text-[10px] font-bold tracking-wider">
            Propulsé par <a href="https://tbi-center.fr" target="_blank" rel="noopener noreferrer" className="text-accent-red hover:text-red-400 transition-colors">TBI CENTER</a>
          </p>
        </motion.div>
      </div>
      </div>
    </div>
  );
};
