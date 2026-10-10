import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Captures the browser's install prompt (Chromium/Android). Null when unsupported or already installed. */
export function useInstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent); };
    const i = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', h);
    window.addEventListener('appinstalled', i);
    return () => { window.removeEventListener('beforeinstallprompt', h); window.removeEventListener('appinstalled', i); };
  }, []);
  const install = async () => {
    if (!evt) return false;
    await evt.prompt();
    const r = await evt.userChoice;
    setEvt(null);
    return r.outcome === 'accepted';
  };
  return { canInstall: !!evt, installed, install };
}
