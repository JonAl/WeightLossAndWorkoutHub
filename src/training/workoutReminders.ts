import { diffDays } from '../utils/date';

/** One reminder each morning for a heavier backlog; every other morning for a small backlog. */
export function reminderIntervalDays(remainingWorkouts: number): number {
  return remainingWorkouts >= 3 ? 1 : 2;
}

export function isMorningReminderTime(hour: number): boolean {
  return hour >= 7 && hour < 11;
}

export function isWorkoutReminderDue(
  lastNotifiedDate: string | undefined,
  todayKey: string,
  remainingWorkouts: number,
  localHour: number
): boolean {
  if (remainingWorkouts < 1 || !isMorningReminderTime(localHour)) return false;
  if (!lastNotifiedDate) return true;
  return diffDays(lastNotifiedDate, todayKey) >= reminderIntervalDays(remainingWorkouts);
}
