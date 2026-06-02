/**
 * Install-this-app entry shown in the SmartDesk sidebar.
 *
 * Behaviour:
 *  - Hidden once the app is already installed (display-mode: standalone).
 *  - Calls the native install prompt on Chrome / Edge / Android.
 *  - Opens an inline instructions panel on Safari iOS (where the
 *    `beforeinstallprompt` event is unavailable).
 *  - Falls back to a "share / add to home screen" hint on any other
 *    browser that hasn't fired the prompt yet.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, X, Share, PlusSquare } from 'lucide-react';
import { useInstallPrompt } from '../lib/useInstallPrompt';

export const InstallAppButton: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  const { canInstall, isInstalled, isIOS, install } = useInstallPrompt();
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [showFallbackHelp, setShowFallbackHelp] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (canInstall) {
      await install();
      return;
    }
    if (isIOS) {
      setShowIOSHelp(true);
      return;
    }
    setShowFallbackHelp(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        title="Installer SmartDesk sur cet appareil"
        data-testid="install-app-button"
        className={`w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-br from-accent-red to-[#9c1429] hover:from-primary-red hover:to-[#7a0e1c] text-white rounded-xl shadow-md hover:shadow-lg transition-all ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        {!collapsed && (
          <span className="text-[11px] font-black uppercase tracking-wider truncate">
            Installer l'application
          </span>
        )}
      </button>

      {showIOSHelp && (
        <InstallHelpModal onClose={() => setShowIOSHelp(false)} variant="ios" />
      )}
      {showFallbackHelp && (
        <InstallHelpModal onClose={() => setShowFallbackHelp(false)} variant="other" />
      )}
    </>
  );
};

const InstallHelpModal: React.FC<{ onClose: () => void; variant: 'ios' | 'other' }> = ({
  onClose,
  variant,
}) => {
  // Render at the document body — the sidebar parent uses a CSS
  // transform for its slide-in animation, which would otherwise
  // create a containing block for our `position: fixed` panel and
  // squash it into a column.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="install-help-modal"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 bg-gradient-to-br from-[#7a0e1c] to-accent-red text-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em] opacity-80">
                {variant === 'ios' ? 'iPhone / iPad (Safari)' : 'Installation'}
              </span>
            </div>
            <h3 className="text-lg font-black tracking-tight">
              Installer SmartDesk en 3 gestes
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {variant === 'ios' ? (
            <>
              <Step n={1} icon={<Share className="w-4 h-4" />} title="Touchez l'icône Partage">
                Le carré avec une flèche vers le haut, en bas de Safari (ou en haut sur iPad).
              </Step>
              <Step n={2} icon={<PlusSquare className="w-4 h-4" />} title="« Sur l'écran d'accueil »">
                Faites défiler la liste des actions et choisissez{' '}
                <strong>« Sur l'écran d'accueil »</strong>.
              </Step>
              <Step n={3} icon={<Download className="w-4 h-4" />} title="Ajouter">
                Confirmez avec <strong>« Ajouter »</strong>. SmartDesk apparaît sur l'écran d'accueil comme une vraie app.
              </Step>
            </>
          ) : (
            <>
              <Step n={1} icon={<Download className="w-4 h-4" />} title="Cherchez l'icône Installer">
                Dans la barre d'adresse de Chrome / Edge / Brave (PC ou Android), une petite icône «&nbsp;Installer&nbsp;» apparaît à droite de l'URL après quelques secondes.
              </Step>
              <Step n={2} icon={<Share className="w-4 h-4" />} title="Menu du navigateur">
                Sinon, ouvrez le menu (⋮) de votre navigateur et choisissez{' '}
                <strong>« Installer SmartDesk »</strong> ou{' '}
                <strong>« Ajouter à l'écran d'accueil »</strong>.
              </Step>
              <Step n={3} icon={<Smartphone className="w-4 h-4" />} title="C'est tout">
                L'application apparaît dans le menu Démarrer (PC), le tiroir d'applications (Android) ou le Dock (Mac).
              </Step>
            </>
          )}

          <div className="rounded-2xl bg-soft-red/40 border border-red-100 p-3 text-[11px] text-slate-600 leading-relaxed">
            ℹ️ Une fois installée, SmartDesk se lance en plein écran, fonctionne hors-ligne pour l'interface, et reçoit les mises à jour automatiquement.
          </div>
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800"
            data-testid="install-help-close-btn"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const Step: React.FC<{ n: number; icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  n,
  icon,
  title,
  children,
}) => (
  <div className="flex gap-3">
    <div className="shrink-0 w-9 h-9 rounded-xl bg-soft-red flex items-center justify-center text-accent-red font-black">
      {n}
    </div>
    <div className="flex-1 text-sm text-slate-700 leading-relaxed">
      <div className="font-black text-slate-900 flex items-center gap-1.5 mb-0.5">
        {icon} {title}
      </div>
      <div className="text-[13px]">{children}</div>
    </div>
  </div>
);
