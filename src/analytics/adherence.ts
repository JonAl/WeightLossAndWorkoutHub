import { addDays, dateRange } from '../utils/date';
import { weekStart } from '../utils/date';
import type { Workout } from '../types';
import { weeklyWorkoutCounts } from './workouts';

/** Share of days in [from, to] that have at least one record. */
export function coverage(daysWithData: Set<string>, from: string, to: string): { days: number; total: number; pct: number } {
  const range = dateRange(from, to);
  const days = range.filter((d) => daysWithData.has(d)).length;
  return { days, total: range.length, pct: range.length ? (days / range.length) * 100 : 0 };
}

/**
 * Consecutive days with data ending today — or yesterday, so a streak is not broken
 * just because today has not been logged yet.
 */
export function currentStreak(daysWithData: Set<string>, todayKey: string): number {
  let d = daysWithData.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (daysWithData.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

/** Consecutive *completed* weeks (before the current week) that met the workout target. */
export function workoutWeekStreak(ws: Workout[], target: number, todayKey: string): number {
  const counts = weeklyWorkoutCounts(ws);
  let wk = addDays(weekStart(todayKey), -7);
  let n = 0;
  while ((counts.get(wk) ?? 0) >= target && target > 0) { n++; wk = addDays(wk, -7); }
  return n;
}

export interface WorkoutAdherence { weeks: { weekStart: string; count: number; met: boolean }[]; pct: number | null }

/** Workout adherence for the last `nWeeks` full weeks (current week excluded). */
export function workoutAdherence(ws: Workout[], target: number, todayKey: string, nWeeks: number): WorkoutAdherence {
  const counts = weeklyWorkoutCounts(ws);
  const cur = weekStart(todayKey);
  const weeks = Array.from({ length: nWeeks }, (_, i) => addDays(cur, -7 * (nWeeks - i))).map((w) => {
    const count = counts.get(w) ?? 0;
    return { weekStart: w, count, met: count >= target };
  });
  return { weeks, pct: weeks.length && target > 0 ? (weeks.filter((w) => w.met).length / weeks.length) * 100 : null };
}
