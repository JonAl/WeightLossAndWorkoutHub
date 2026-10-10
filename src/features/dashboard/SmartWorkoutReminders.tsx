import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Dumbbell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { useI18n } from '../../i18n';
import { useWorkouts } from '../../hooks/useData';
import { Card, ProgressBar } from '../../components/ui';
import { weeklyWorkoutCounts } from '../../analytics/workouts';
import { isWorkoutReminderDue } from '../../training/workoutReminders';
import { today, weekStart } from '../../utils/date';
import { lsGet, lsSet } from '../../utils/storage';

const STORAGE_KEY = 'wlh:smartWorkoutReminders';
interface ReminderPreferences {
  phoneEnabled: boolean;
  lastNotifiedDate?: string;
}

const DEFAULT_PREFERENCES: ReminderPreferences = { phoneEnabled: false };

/** Smart workout reminder. Preferences and notification history stay on this device. */
export function SmartWorkoutReminders() {
  const { profile } = useApp();
  const { t } = useI18n();
  const nav = useNavigate();
  const workouts = useWorkouts();
  const [preferences, setPreferences] = useState<ReminderPreferences>(() => lsGet(STORAGE_KEY, DEFAULT_PREFERENCES));
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);

  const progress = useMemo(() => {
    if (!workouts) return null;
    const completed = weeklyWorkoutCounts(workouts).get(weekStart(today())) ?? 0;
    const target = profile.weeklyWorkoutTarget;
    return { completed, target, remaining: Math.max(0, target - completed) };
  }, [workouts, profile.weeklyWorkoutTarget]);

  useEffect(() => {
    if (!progress || progress.remaining < 1 || !preferences.phoneEnabled) return;
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const day = today();
    if (!isWorkoutReminderDue(preferences.lastNotifiedDate, day, progress.remaining, now.getHours())) return;

    let cancelled = false;
    void navigator.serviceWorker.getRegistration().then(async (registration) => {
      if (!registration || cancelled) return;
      const body = progress.remaining === 1
        ? t('reminder.notificationOne')
        : t('reminder.notificationMany', { n: progress.remaining });
      await registration.showNotification(t('reminder.notificationTitle'), {
        body,
        icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
        badge: `${import.meta.env.BASE_URL}icons/icon-192.png`,
        tag: `wlh-workout-reminder-${day}`,
        renotify: false
      });
      if (cancelled) return;
      const next = { ...preferences, lastNotifiedDate: day };
      setPreferences(next);
      lsSet(STORAGE_KEY, next);
    }).catch(() => {
      // Notification support varies by browser/device; the in-app reminder remains available.
    });
    return () => { cancelled = true; };
  }, [progress, preferences, t]);

  if (!progress || progress.target < 1 || progress.remaining < 1) return null;

  const enablePhoneNotifications = async () => {
    setPhoneMessage(null);
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setPhoneMessage(t('reminder.phoneUnsupported'));
      return;
    }
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPhoneMessage(t('reminder.phoneDenied'));
      return;
    }
    const next = { ...preferences, phoneEnabled: true };
    setPreferences(next);
    lsSet(STORAGE_KEY, next);
  };

  const disablePhoneNotifications = () => {
    const next = { ...preferences, phoneEnabled: false };
    setPreferences(next);
    lsSet(STORAGE_KEY, next);
    setPhoneMessage(null);
  };

  return (
    <Card title={t('reminder.title')} subtitle={progress.remaining === 1
      ? t('reminder.remainingOne')
      : t('reminder.remainingMany', { n: progress.remaining })}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm muted">
          <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />
          <span>{t('reminder.progress', { done: progress.completed, target: progress.target })}</span>
        </div>
        <ProgressBar value={progress.completed} max={progress.target} label={t('reminder.title')} />
        <button className="btn-primary w-full sm:w-auto" onClick={() => nav('/workouts')}>
          <Dumbbell aria-hidden className="h-4 w-4" />
          {t('reminder.start')}
        </button>
        <div className="border-t border-slate-200 pt-3 dark:border-navy-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium">
              <Bell aria-hidden className="h-4 w-4" />
              <span>{t('reminder.phoneTitle')}</span>
            </div>
            {preferences.phoneEnabled ? (
              <button className="btn-secondary" onClick={disablePhoneNotifications}>{t('reminder.phoneDisable')}</button>
            ) : (
              <button className="btn-secondary" onClick={() => void enablePhoneNotifications()}>{t('reminder.phoneEnable')}</button>
            )}
          </div>
          <p className="mt-2 text-xs muted">{t('reminder.phoneHint')}</p>
          <p className="mt-1 text-xs muted">{t('reminder.phoneBackgroundNote')}</p>
          {phoneMessage && <p role="status" className="mt-2 text-sm">{phoneMessage}</p>}
        </div>
      </div>
    </Card>
  );
}
