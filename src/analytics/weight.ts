/**
 * Weight analytics.
 *
 * Trend method (documented): calendar-day **trailing 7-day mean**.
 *  1. Multiple weigh-ins on one day are averaged into a single daily observation.
 *  2. For each day that has an observation, the trend value is the mean of all daily
 *     observations in the window [day − 6, day]. Days without data are skipped, never zero.
 *  3. Each trend point carries `n` (observations in its window) so the UI can show reliability.
 *
 * Rates (kg/week) use an ordinary least-squares regression over daily observations, which is
 * robust to single-day water-weight swings. A single day's change is never treated as fat change.
 */
import type { MeasurementField, WeightEntry } from '../types';
import { addDays, dayOf, diffDays } from '../utils/date';
import { linearRegression, mean, pctChange } from '../utils/stats';

export interface DailyWeight { date: string; weightKg: number; count: number }
export interface TrendPoint { date: string; observedKg: number; trendKg: number; n: number }

export function dailyWeights(entries: WeightEntry[]): DailyWeight[] {
  const byDay = new Map<string, number[]>();
  for (const e of entries) {
    if (!Number.isFinite(e.weightKg) || e.weightKg <= 0) continue;
    const d = dayOf(e.dateTime);
    const arr = byDay.get(d) ?? [];
    arr.push(e.weightKg);
    byDay.set(d, arr);
  }
  return [...byDay.entries()]
    .map(([date, ws]) => ({ date, weightKg: mean(ws)!, count: ws.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const TREND_WINDOW_DAYS = 7;

export function weightTrend(daily: DailyWeight[], windowDays = TREND_WINDOW_DAYS): TrendPoint[] {
  return daily.map((d, i) => {
    const from = addDays(d.date, -(windowDays - 1));
    const win: number[] = [];
    for (let j = i; j >= 0 && daily[j].date >= from; j--) win.push(daily[j].weightKg);
    return { date: d.date, observedKg: d.weightKg, trendKg: mean(win)!, n: win.length };
  });
}

export function latestEntry(entries: WeightEntry[]): WeightEntry | undefined {
  return [...entries].sort((a, b) => b.dateTime.localeCompare(a.dateTime))[0];
}

export function totalLost(startKg: number, currentKg: number): { kg: number; pct: number } {
  const kg = startKg - currentKg;
  return { kg, pct: startKg > 0 ? (kg / startKg) * 100 : 0 };
}

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(heightCm > 0) || !(weightKg > 0)) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export type BmiCategory = 'under' | 'normal' | 'over' | 'obese1' | 'obese2' | 'obese3';
export function bmiCategory(b: number): BmiCategory {
  if (b < 18.5) return 'under';
  if (b < 25) return 'normal';
  if (b < 30) return 'over';
  if (b < 35) return 'obese1';
  if (b < 40) return 'obese2';
  return 'obese3';
}

export interface RateResult { kgPerWeek: number; seKgPerWeek: number | null; n: number; spanDays: number }

/** Minimum data for a weekly rate: 4 daily observations spanning at least 7 days. */
export const RATE_MIN_POINTS = 4;
export const RATE_MIN_SPAN = 7;

/** Regression-based rate of change over the window ending at `endDate` (inclusive). */
export function weeklyRate(daily: DailyWeight[], endDate: string, windowDays: number): RateResult | null {
  const from = addDays(endDate, -(windowDays - 1));
  const pts = daily.filter((d) => d.date >= from && d.date <= endDate);
  if (pts.length < RATE_MIN_POINTS) return null;
  const spanDays = diffDays(pts[0].date, pts[pts.length - 1].date);
  if (spanDays < RATE_MIN_SPAN) return null;
  const reg = linearRegression(pts.map((p) => ({ x: diffDays(from, p.date), y: p.weightKg })));
  if (!reg) return null;
  return { kgPerWeek: reg.slope * 7, seKgPerWeek: reg.slopeSE === null ? null : reg.slopeSE * 7, n: pts.length, spanDays };
}

export interface PeriodChange { fromDate: string; toDate: string; fromKg: number; toKg: number; absKg: number; pct: number; n: number }

/**
 * Change of the *trend* value over the last `days` days. Uses the trend point closest to the
 * period start (within half the period, at least 3 days) so isolated days don't dominate.
 */
export function periodChange(trend: TrendPoint[], endDate: string, days: number): PeriodChange | null {
  const inWin = trend.filter((t) => t.date <= endDate);
  if (inWin.length < 2) return null;
  const last = inWin[inWin.length - 1];
  const target = addDays(endDate, -days);
  const tolerance = Math.max(3, Math.floor(days / 2));
  let best: TrendPoint | null = null;
  for (const t of inWin) {
    if (t === last) continue;
    const dist = Math.abs(diffDays(target, t.date));
    if (dist <= tolerance && (!best || dist < Math.abs(diffDays(target, best.date)))) best = t;
  }
  if (!best) return null;
  const n = inWin.filter((t) => t.date >= best!.date).length;
  return {
    fromDate: best.date,
    toDate: last.date,
    fromKg: best.trendKg,
    toKg: last.trendKg,
    absKg: last.trendKg - best.trendKg,
    pct: pctChange(best.trendKg, last.trendKg) ?? 0,
    n
  };
}

export interface WeeklyAverage { weekStart: string; avgKg: number; n: number }
export function weeklyAverages(daily: DailyWeight[], weekStartFn: (d: string) => string): WeeklyAverage[] {
  const m = new Map<string, number[]>();
  for (const d of daily) {
    const w = weekStartFn(d.date);
    m.set(w, [...(m.get(w) ?? []), d.weightKg]);
  }
  return [...m.entries()].map(([weekStart, xs]) => ({ weekStart, avgKg: mean(xs)!, n: xs.length })).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface MeasurementChange { field: MeasurementField; first: number; last: number; change: number; firstDate: string; lastDate: string; n: number }

/** First vs last recorded value for a body measurement within [from, to]. Needs ≥ 2 records. */
export function measurementChange(entries: WeightEntry[], field: MeasurementField, from?: string, to?: string): MeasurementChange | null {
  const recs = entries
    .filter((e) => typeof e[field] === 'number' && (!from || dayOf(e.dateTime) >= from) && (!to || dayOf(e.dateTime) <= to))
    .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  if (recs.length < 2) return null;
  const f = recs[0], l = recs[recs.length - 1];
  return { field, first: f[field]!, last: l[field]!, change: l[field]! - f[field]!, firstDate: dayOf(f.dateTime), lastDate: dayOf(l.dateTime), n: recs.length };
}
