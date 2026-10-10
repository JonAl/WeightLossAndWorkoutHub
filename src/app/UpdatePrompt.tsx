import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { useI18n } from '../i18n';

/** Shows "offline ready" and "update available" notices from the service worker. */
export function UpdatePrompt() {
  const { t } = useI18n();
  const { offlineReady: [offlineReady, setOfflineReady], needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError: () => { /* SW unsupported or blocked (e.g. plain HTTP): app still works online */ }
  });
  // "Ready offline" is not shown as a banner (the offline badge covers connectivity); only updates are announced.
  useEffect(() => { if (offlineReady) setOfflineReady(false); }, [offlineReady, setOfflineReady]);
  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-4 top-[calc(3.75rem+env(safe-area-inset-top))] z-[55] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-navy-900 p-3 text-sm text-white shadow-xl md:top-auto md:bottom-6 dark:bg-slate-100 dark:text-navy-950">
      <span className="flex-1">{t('pwa.updateAvailable')}</span>
      {<button className="btn min-h-[36px] bg-teal-500 px-3 text-navy-950" onClick={() => updateServiceWorker(true)}><RefreshCw className="h-4 w-4" />{t('pwa.reload')}</button>}
      <button className="btn-icon h-9 w-9 text-inherit" aria-label={t('common.close')} onClick={() => { setOfflineReady(false); setNeedRefresh(false); }}><X className="h-4 w-4" /></button>
    </div>
  );
}
