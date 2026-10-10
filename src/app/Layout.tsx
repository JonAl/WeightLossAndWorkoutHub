import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, Dumbbell, FileText, HeartPulse, LayoutDashboard, Menu, Settings, Sparkles, Utensils, WifiOff, Download, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { useInstallPrompt, useOnline } from '../hooks/usePwa';
import { Modal } from '../components/Modal';
import { cx } from '../components/ui';
import { UpdatePrompt } from './UpdatePrompt';

export interface NavItem { to: string; key: 'dashboard' | 'progress' | 'nutrition' | 'workouts' | 'health' | 'coaching' | 'reports' | 'settings'; icon: LucideIcon }
export const NAV: NavItem[] = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard },
  { to: '/progress', key: 'progress', icon: BarChart3 },
  { to: '/nutrition', key: 'nutrition', icon: Utensils },
  { to: '/workouts', key: 'workouts', icon: Dumbbell },
  { to: '/health', key: 'health', icon: HeartPulse },
  { to: '/coaching', key: 'coaching', icon: Sparkles },
  { to: '/reports', key: 'reports', icon: FileText },
  { to: '/settings', key: 'settings', icon: Settings }
];
const PRIMARY = NAV.slice(0, 4);
const MORE = NAV.slice(4);

function OfflineBadge() {
  const online = useOnline();
  const { t } = useI18n();
  if (online) return null;
  return <span role="status" className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"><WifiOff className="h-3.5 w-3.5" />{t('pwa.offline')}</span>;
}

function InstallButton({ compact }: { compact?: boolean }) {
  const { canInstall, install } = useInstallPrompt();
  const { t } = useI18n();
  if (!canInstall) return null;
  return <button className={compact ? 'btn-icon' : 'btn-secondary w-full'} onClick={install} aria-label={t('pwa.install')}><Download className="h-4 w-4" />{!compact && t('pwa.install')}</button>;
}

export function Layout() {
  const { t, td } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMoreOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const moreActive = MORE.some((n) => loc.pathname.startsWith(n.to));

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">{t('a11y.skip')}</a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-navy-900 text-slate-100 dark:border-navy-800 dark:bg-navy-950 md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <img src={`${import.meta.env.BASE_URL}icons/favicon.svg`} alt="" className="h-9 w-9" />
          <div><p className="font-bold leading-tight">Weight Loss Hub</p><p className="text-xs text-slate-400">{t('app.tagline')}</p></div>
        </div>
        <nav aria-label={t('a11y.mainNav')} className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition', isActive ? 'bg-teal-500/15 text-teal-300' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
              <n.icon aria-hidden className="h-5 w-5" />{td(`nav.${n.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 p-4"><OfflineBadge /><InstallButton /></div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2.5 pt-safe backdrop-blur dark:border-navy-800 dark:bg-navy-950/90 md:hidden">
        <div className="flex items-center gap-2"><img src={`${import.meta.env.BASE_URL}icons/favicon.svg`} alt="" className="h-7 w-7" /><span className="font-bold">Weight Hub</span></div>
        <div className="flex items-center gap-2"><OfflineBadge /><InstallButton compact /></div>
      </header>

      <main id="main" className="px-4 pb-28 pt-4 md:ml-64 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-5xl"><Outlet /></div>
      </main>

      {/* Mobile bottom navigation */}
      <nav aria-label={t('a11y.mainNav')} className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur dark:border-navy-800 dark:bg-navy-950/95 md:hidden">
        <ul className="grid grid-cols-5">
          {PRIMARY.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', isActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400')}>
                <n.icon aria-hidden className="h-5 w-5" />{td(`nav.${n.key}`)}
              </NavLink>
            </li>
          ))}
          <li>
            <button aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)} className={cx('flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium', moreActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400')}>
              <Menu aria-hidden className="h-5 w-5" />{t('nav.more')}
            </button>
          </li>
        </ul>
      </nav>
      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title={t('nav.more')}>
        <ul className="grid grid-cols-2 gap-2">
          {MORE.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} className={({ isActive }) => cx('flex min-h-[64px] items-center gap-3 rounded-2xl border px-4 font-medium', isActive ? 'border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-300' : 'border-slate-200 dark:border-navy-700')}>
                <n.icon aria-hidden className="h-5 w-5" />{td(`nav.${n.key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </Modal>
      <UpdatePrompt />
    </div>
  );
}
