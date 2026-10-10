import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n';

/** Accessible dialog: bottom sheet on mobile, centered on desktop. Esc closes; focus is trapped. */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl animate-fade-in dark:bg-navy-900 sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-navy-700">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button data-close type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')}><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 pb-safe dark:border-navy-700">{footer}</div>}
      </div>
    </div>
  );
}
