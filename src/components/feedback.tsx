import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { useI18n } from '../i18n';
import { cx } from './ui';

// ---------- toasts ----------
type ToastTone = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; tone: ToastTone }
const ToastCtx = createContext<(message: string, tone?: ToastTone) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

// ---------- confirm ----------
interface ConfirmOpts { title: string; body: ReactNode; confirmLabel?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setToasts((ts) => [...ts.slice(-1), { id, message, tone }]); // at most two visible
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3200);
  }, []);

  const [confirm, setConfirm] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirm({ ...o, resolve })), []);
  const close = (v: boolean) => { confirm?.resolve(v); setConfirm(null); };

  return (
    <ToastCtx.Provider value={push}>
      <ConfirmCtx.Provider value={ask}>
        {children}
        <Modal open={!!confirm} onClose={() => close(false)} title={confirm?.title ?? ''}
          footer={<>
            <button type="button" className="btn-secondary" onClick={() => close(false)}>{t('common.cancel')}</button>
            <button type="button" className={confirm?.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)}>{confirm?.confirmLabel ?? t('common.confirm')}</button>
          </>}>
          <div className="text-sm">{confirm?.body}</div>
        </Modal>
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(3.75rem+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4 md:top-auto md:bottom-6">
          {toasts.map((x) => {
            const Icon = x.tone === 'success' ? CheckCircle2 : x.tone === 'error' ? AlertCircle : Info;
            return (
              <div key={x.id} role={x.tone === 'error' ? 'alert' : 'status'}
                className={cx('pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg animate-fade-in',
                  x.tone === 'error' ? 'bg-red-600 text-white' : 'bg-navy-900 text-white dark:bg-slate-100 dark:text-navy-950')}>
                <Icon aria-hidden className="h-4 w-4 shrink-0" />{x.message}
              </div>
            );
          })}
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}
