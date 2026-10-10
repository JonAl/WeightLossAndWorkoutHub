import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Info, TriangleAlert } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Card({ title, action, children, className, subtitle }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('card animate-fade-in', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {subtitle && <p className="text-xs muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function MetricCard({ label, value, sub, icon: Icon, tone = 'neutral', badge }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon; tone?: 'neutral' | 'good' | 'warn'; badge?: ReactNode }) {
  return (
    <div className="card flex flex-col gap-1 p-3.5 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide muted">{label}</span>
        {Icon && <Icon aria-hidden className={cx('h-4 w-4', tone === 'good' ? 'text-teal-600 dark:text-teal-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')} />}
      </div>
      <div className="text-xl font-bold leading-tight tabular-nums">{value}</div>
      {sub && <div className="text-xs muted">{sub}</div>}
      {badge}
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-navy-700">
      <div className={cx('h-full rounded-full transition-all', pct >= 100 ? 'bg-teal-500' : 'bg-teal-600 dark:bg-teal-400')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-navy-600">
      <Icon aria-hidden className="h-8 w-8 text-teal-600 dark:text-teal-400" />
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  const Icon = tone === 'warn' ? TriangleAlert : Info;
  return (
    <div role="note" className={cx('flex gap-2 rounded-xl p-3 text-sm', tone === 'warn' ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-navy-50 text-navy-800 dark:bg-navy-800 dark:text-slate-200')}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'info' }) {
  const cls = { neutral: 'bg-slate-100 text-slate-700 dark:bg-navy-700 dark:text-slate-200', good: 'bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300', warn: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', info: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300' }[tone];
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cls)}>{children}</span>;
}

export function Field({ label, error, children, hint, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs muted">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input ref={ref} {...props} className={cx('input', props.className)} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
  return <select ref={ref} {...props} className={cx('input pr-8', props.className)} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  return <textarea ref={ref} rows={2} {...props} className={cx('input py-2', props.className)} />;
});

export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-navy-800">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={cx('min-h-[36px] rounded-lg px-3 text-sm font-medium transition', o.value === value ? 'bg-white text-navy-900 shadow-sm dark:bg-navy-600 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
      <span>
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="block text-xs muted">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-teal-600 dark:bg-teal-500' : 'bg-slate-300 dark:bg-navy-600')}>
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

/** Parse an optional numeric input: '' → undefined, invalid → NaN (caught by validation). */
export function parseOptNum(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return n;
}
