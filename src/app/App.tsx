import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { ensureSeed } from '../db/repositories';
import { AppContext } from './AppContext';
import { I18nProvider, createI18n } from '../i18n';
import { FeedbackProvider } from '../components/feedback';
import { QuickAddProvider } from './QuickAdd';
import { DarkContext } from './ThemeContext';
import { useApplyTheme } from '../hooks/useTheme';
import { Layout } from './Layout';
import { Dashboard } from '../features/dashboard/Dashboard';
import { ProgressPage } from '../features/progress/ProgressPage';
import { NutritionPage } from '../features/nutrition/NutritionPage';
import { WorkoutsPage } from '../features/workouts/WorkoutsPage';
import { WorkoutLogger } from '../features/workouts/WorkoutLogger';
import { HealthPage } from '../features/health/HealthPage';
import { CoachingPage } from '../features/coaching/CoachingPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { Onboarding } from '../features/onboarding/Onboarding';
import { lsGet, lsSet } from '../utils/storage';
import type { Language } from '../types';

type Status = { state: 'opening' } | { state: 'ready' } | { state: 'error'; message: string };

/** Opens IndexedDB and handles unavailable/corrupted storage with a recoverable error screen. */
export function App() {
  const [status, setStatus] = useState<Status>({ state: 'opening' });
  const open = useCallback(async () => {
    setStatus({ state: 'opening' });
    try {
      if (typeof indexedDB === 'undefined') throw new Error('IndexedDB not available');
      await db.open();
      await ensureSeed();
      setStatus({ state: 'ready' });
    } catch (e) {
      setStatus({ state: 'error', message: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
    }
  }, []);
  useEffect(() => { open(); }, [open]);

  if (status.state === 'opening') return <Splash />;
  if (status.state === 'error') return <StorageError message={status.message} onRetry={open} />;
  return <ReadyApp />;
}

function Splash() {
  return <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading"><img src={`${import.meta.env.BASE_URL}icons/favicon.svg`} alt="" className="h-16 w-16 animate-pulse" /></div>;
}

function StorageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const lang = lsGet<Language>('wlh:lang', 'el');
  const { t } = createI18n(lang, 'metric');
  const reset = async () => {
    if (!window.confirm(t('storage.resetConfirm'))) return;
    try { db.close(); await Dexie.delete(db.name); } catch { /* ignore */ }
    window.location.reload();
  };
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">{t('storage.errorTitle')}</h1>
      <p className="text-sm">{t('storage.errorBody')}</p>
      <pre className="overflow-auto rounded-xl bg-slate-100 p-3 text-xs dark:bg-navy-800">{message}</pre>
      <button className="btn-primary" onClick={onRetry}>{t('storage.retry')}</button>
      <button className="btn-danger" onClick={reset}>{t('storage.reset')}</button>
    </div>
  );
}

function ReadyApp() {
  const profile = useLiveQuery(() => db.profile.get('profile'));
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const dark = useApplyTheme(settings?.theme ?? 'system');
  useEffect(() => {
    if (!settings) return;
    document.documentElement.lang = settings.language;
    lsSet('wlh:lang', settings.language);
  }, [settings]);
  useEffect(() => { if (profile === undefined || settings === undefined) return; if (!profile || !settings) ensureSeed(); }, [profile, settings]);
  if (!profile || !settings) return <Splash />;

  return (
    <AppContext.Provider value={{ profile, settings }}>
      <I18nProvider lang={settings.language} units={settings.units}>
        <DarkContext.Provider value={dark}>
          <FeedbackProvider>
            {!profile.onboardingComplete ? <Onboarding /> : (
              <QuickAddProvider>
                <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route index element={<Dashboard />} />
                      <Route path="progress" element={<ProgressPage />} />
                      <Route path="nutrition" element={<NutritionPage />} />
                      <Route path="workouts" element={<WorkoutsPage />} />
                      <Route path="workouts/:id" element={<WorkoutLogger />} />
                      <Route path="health" element={<HealthPage />} />
                      <Route path="coaching" element={<CoachingPage />} />
                      <Route path="reports" element={<ReportsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
              </QuickAddProvider>
            )}
          </FeedbackProvider>
        </DarkContext.Provider>
      </I18nProvider>
    </AppContext.Provider>
  );
}
