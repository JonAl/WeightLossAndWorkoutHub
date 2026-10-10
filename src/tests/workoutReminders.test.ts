import { describe, expect, it } from 'vitest';
import { isMorningReminderTime, isWorkoutReminderDue, reminderIntervalDays } from '../training/workoutReminders';

describe('smart workout reminder cadence', () => {
  it('reminds daily when at least three workouts remain and every other day for one or two', () => {
    expect(reminderIntervalDays(5)).toBe(1);
    expect(reminderIntervalDays(3)).toBe(1);
    expect(reminderIntervalDays(2)).toBe(2);
    expect(reminderIntervalDays(1)).toBe(2);
  });

  it('uses the local morning window from 07:00 inclusive to 11:00 exclusive', () => {
    expect(isMorningReminderTime(6)).toBe(false);
    expect(isMorningReminderTime(7)).toBe(true);
    expect(isMorningReminderTime(10)).toBe(true);
    expect(isMorningReminderTime(11)).toBe(false);
  });

  it('sends the first eligible reminder immediately, then respects adaptive cadence', () => {
    expect(isWorkoutReminderDue(undefined, '2026-10-12', 4, 8)).toBe(true);
    expect(isWorkoutReminderDue('2026-10-12', '2026-10-13', 4, 8)).toBe(true);
    expect(isWorkoutReminderDue('2026-10-12', '2026-10-13', 2, 8)).toBe(false);
    expect(isWorkoutReminderDue('2026-10-12', '2026-10-14', 2, 8)).toBe(true);
  });

  it('never schedules a reminder outside the morning or after the weekly target', () => {
    expect(isWorkoutReminderDue(undefined, '2026-10-12', 2, 11)).toBe(false);
    expect(isWorkoutReminderDue(undefined, '2026-10-12', 0, 8)).toBe(false);
  });
});
