/**
 * Weight projection as a *range*, never a single promised number.
 *
 * Assumptions (shown to the user):
 *  - Uses the regression rate over the last 28 days (needs ≥ 10 daily observations over ≥ 21 days).
 *  - Uncertainty band = rate ± max(2 × standard error, 0.25 kg/week).
 *  - The slower bound is additionally reduced by 25 % for horizons over 8 weeks, because loss
 *    usually slows as body weight drops and adherence varies.
 *  - A projection never goes beyond the goal weight, and gaining rates are not extrapolated as loss.
 */
import type { DailyWeight } from './weight';
import { weeklyRate } from './weight';

export const PROJECTION_WINDOW_DAYS = 28;
export const PROJECTION_MIN_POINTS = 10;
export const PROJECTION_MIN_SPAN = 21;

export interface ProjectionPoint { weeks: number; lowKg: number; highKg: number }
export interface Projection {
  rateKgPerWeek: number;
  fastRate: number; // most negative
  slowRate: number; // least negative (may be ≥ 0)
  n: number;
  spanDays: number;
  startKg: number;
  points: ProjectionPoint[];
  /** Range of weeks to goal, if the whole rate band is a loss. */
  weeksToGoal: { min: number; max: number } | null;
}

export function projectWeight(daily: DailyWeight[], endDate: string, startKg: number, goalKg?: number, horizons = [4, 8, 12, 26]): Projection | null {
  const r = weeklyRate(daily, endDate, PROJECTION_WINDOW_DAYS);
  if (!r || r.n < PROJECTION_MIN_POINTS || r.spanDays < PROJECTION_MIN_SPAN) return null;
  const band = Math.max(2 * (r.seKgPerWeek ?? 0), 0.25);
  const fastRate = r.kgPerWeek - band;
  const slowRate = r.kgPerWeek + band;
  const clamp = (kg: number) => (goalKg !== undefined && kg < goalKg ? goalKg : kg);
  const points = horizons.map((weeks) => {
    const slowAdj = weeks > 8 && slowRate < 0 ? slowRate * 0.75 : slowRate;
    const a = clamp(startKg + fastRate * weeks);
    const b = clamp(startKg + slowAdj * weeks);
    return { weeks, lowKg: Math.min(a, b), highKg: Math.max(a, b) };
  });
  let weeksToGoal: Projection['weeksToGoal'] = null;
  if (goalKg !== undefined && goalKg < startKg && slowRate < 0) {
    const remaining = startKg - goalKg;
    weeksToGoal = { min: Math.ceil(remaining / -fastRate), max: Math.ceil(remaining / -(slowRate * 0.75)) };
  }
  return { rateKgPerWeek: r.kgPerWeek, fastRate, slowRate, n: r.n, spanDays: r.spanDays, startKg, points, weeksToGoal };
}
