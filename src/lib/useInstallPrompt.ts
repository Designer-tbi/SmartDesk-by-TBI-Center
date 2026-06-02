/**
 * `useInstallPrompt` — captures the browser's `beforeinstallprompt`
 * event (Chrome / Edge / Android) and exposes a one-call `install()`
 * function plus heuristics for unsupported browsers (Safari iOS).
 *
 * Usage:
 *
 *   const { canInstall, isInstalled, isIOS, install } = useInstallPrompt();
 *   <button onClick={install} hidden={isInstalled || (!canInstall && !isIOS)}>
 *     Installer
 *   </button>
 *
 * "Installed" is detected via the `display-mode: standalone` media
 * query, the `navigator.standalone` flag (iOS), and the
 * `appinstalled` event.
 */
import { useCallback, useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export const useInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  // Detect Safari iOS: no `beforeinstallprompt` support — user must
  // tap Share → "Ajouter à l'écran d'accueil" manually.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua) && !/(CriOS|FxiOS|EdgiOS)/i.test(ua);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already running in standalone? (PWA launched from home screen.)
    const checkInstalled = () => {
      const standalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(!!standalone);
    };
    checkInstalled();

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome; // 'accepted' | 'dismissed'
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
};
