/**
 * Transparent, rule-based coaching. Every insight lists the recorded data that triggered it
 * (`evidence`) and every threshold lives in this file. No medication advice is ever generated.
 *
 * Param naming convention (used by the UI formatter): keys ending in `Kg` are weights in kg,
 * `Pct` are percentages, `Date` are YYYY-MM-DD dates; anything else is a plain number/string.
 */
import type { CoachingContext } from './context';
import { addDays, dayOf } from '../utils/date';
import { mean, round } from '../utils/stats';
import { proteinAdherence, averageNutrient, calorieAdherence } from '../analytics/nutrition';
import { periodChange, weeklyRate, measurementChange } from '../analytics/weight';
import { workoutsInWeek } from '../analytics/workouts';
import { coverage } from '../analytics/adherence';

export type InsightKind = 'recommendation' | 'observation';
export type InsightTone = 'positive' | 'neutral' | 'attention';
export type Params = Record<string, string | number | undefined>;

export interface Evidence { key: string; params?: Params }

export interface Insight {
  /** Stable per rule and week, so dismiss/complete state survives re-computation. */
  id: string;
  ruleId: string;
  kind: InsightKind;
  tone: InsightTone;
  /** Lower = more important. */
  priority: number;
  params: Params;
  evidence: Evidence[];
}

export const MAX_RECOMMENDATIONS = 3;

type Rule = (c: CoachingContext) => Omit<Insight, 'id'> | null;

const last = (c: CoachingContext, days: number) => ({ from: addDays(c.today, -(days - 1)), to: c.today });

export const RULES: Record<string, Rule> = {
  caloriesVeryLow: (c) => {
    const p = c.profile;
    if (!p.calorieTrackingEnabled || !p.calorieTargetKcal) return null;
    const { from, to } = last(c, 7);
    const a = calorieAdherence(c.nutrition, p.calorieTargetKcal, from, to);
    if (a.loggedDays < 3 || a.average === null || a.average >= p.calorieTargetKcal * 0.7) return null;
    return { ruleId: 'caloriesVeryLow', kind: 'recommendation', tone: 'attention', priority: 1,
      params: { avg: Math.round(a.average), target: p.calorieTargetKcal },
      evidence: [{ key: 'ev.avgCalories', params: { avg: Math.round(a.average), n: a.loggedDays } }, { key: 'ev.calorieTarget', params: { target: p.calorieTargetKcal } }] };
  },

  proteinLow: (c) => {
    const { from, to } = last(c, 7);
    const a = proteinAdherence(c.nutrition, c.profile.proteinTargetG, from, to);
    if (a.loggedDays < 3 || a.belowDays.length < 3) return null;
    return { ruleId: 'proteinLow', kind: 'recommendation', tone: 'attention', priority: 1,
      params: { below: a.belowDays.length, logged: a.loggedDays, target: c.profile.proteinTargetG },
      evidence: [{ key: 'ev.proteinAvg', params: { avg: Math.round(a.average!), n: a.loggedDays } }, { key: 'ev.proteinBelowDays', params: { below: a.belowDays.length, logged: a.loggedDays } }] };
  },

  lossTooFast: (c) => {
    const r = weeklyRate(c.daily, c.today, 28);
    const cur = c.daily[c.daily.length - 1]?.weightKg;
    if (!r || r.n < 8 || !cur) return null;
    const pctPerWeek = (-r.kgPerWeek / cur) * 100;
    if (pctPerWeek <= 1.0) return null;
    return { ruleId: 'lossTooFast', kind: 'recommendation', tone: 'attention', priority: 2,
      params: { rateKg: round(-r.kgPerWeek, 2), ratePct: round(pctPerWeek, 1) },
      evidence: [{ key: 'ev.rate28', params: { rateKg: round(r.kgPerWeek, 2), n: r.n } }] };
  },

  workoutsBelowTarget: (c) => {
    const target = c.profile.weeklyWorkoutTarget;
    if (!target || c.data.workouts.length === 0) return null;
    const prevWeek = addDays(c.weekStart, -7);
    const n = workoutsInWeek(c.data.workouts, prevWeek);
    if (n >= target) return null;
    return { ruleId: 'workoutsBelowTarget', kind: 'recommendation', tone: 'attention', priority: 2,
      params: { count: n, target }, evidence: [{ key: 'ev.workoutsLastWeek', params: { count: n, target } }] };
  },

  sleepPoor: (c) => {
    const { from, to } = last(c, 14);
    const sleep = c.health.filter((h) => h.kind === 'sleep' && typeof h.value === 'number' && dayOf(h.dateTime) >= from && dayOf(h.dateTime) <= to).map((h) => h.value!);
    const energy = c.health.filter((h) => h.kind === 'energy' && typeof h.value === 'number' && dayOf(h.dateTime) >= from && dayOf(h.dateTime) <= to).map((h) => h.value!);
    const s = mean(sleep), e = mean(energy);
    const poorSleep = sleep.length >= 4 && s !== null && s < 6.5;
    const lowEnergy = energy.length >= 4 && e !== null && e <= 2.2;
    if (!poorSleep && !lowEnergy) return null;
    const evidence = [];
    if (sleep.length) evidence.push({ key: 'ev.sleepAvg', params: { avg: round(s!, 1), n: sleep.length } });
    if (energy.length) evidence.push({ key: 'ev.energyAvg', params: { avg: round(e!, 1), n: energy.length } });
    return { ruleId: 'sleepPoor', kind: 'recommendation', tone: 'attention', priority: 2, params: {}, evidence };
  },

  weightLogging: (c) => {
    const { from, to } = last(c, 14);
    const cov = coverage(c.weightDays, from, to);
    if (cov.days >= 4) return null;
    return { ruleId: 'weightLogging', kind: 'recommendation', tone: 'neutral', priority: 3,
      params: { days: cov.days, total: cov.total }, evidence: [{ key: 'ev.weightCoverage', params: { days: cov.days, total: cov.total } }] };
  },

  nutritionLogging: (c) => {
    if (c.data.meals.length === 0) return null;
    const { from, to } = last(c, 7);
    const cov = coverage(c.mealDays, from, to);
    if (cov.days >= 4) return null;
    return { ruleId: 'nutritionLogging', kind: 'recommendation', tone: 'neutral', priority: 4,
      params: { days: cov.days, total: cov.total }, evidence: [{ key: 'ev.mealCoverage', params: { days: cov.days, total: cov.total } }] };
  },

  fiberLow: (c) => {
    const { from, to } = last(c, 7);
    const f = averageNutrient(c.nutrition, 'fiberG', from, to);
    const target = c.profile.fiberTargetG || 30;
    if (f.n < 4 || f.avg === null || f.avg >= target * 0.8) return null;
    return { ruleId: 'fiberLow', kind: 'recommendation', tone: 'neutral', priority: 4,
      params: { avg: Math.round(f.avg), target }, evidence: [{ key: 'ev.fiberAvg', params: { avg: Math.round(f.avg), n: f.n } }] };
  },

  backup: (c) => {
    const total = c.data.weights.length + c.data.meals.length + c.data.workouts.length + c.data.health.length;
    if (total < 10) return null;
    const lb = c.settings.lastBackupAt;
    const days = lb ? Math.floor((Date.parse(c.today) - Date.parse(lb.slice(0, 10))) / 86400000) : null;
    if (days !== null && days < 14) return null;
    return { ruleId: 'backup', kind: 'recommendation', tone: 'neutral', priority: 5,
      params: { days: days ?? -1 }, evidence: [{ key: days === null ? 'ev.neverBackedUp' : 'ev.lastBackup', params: { days: days ?? 0, records: total } }] };
  },

  // ---------- observations ----------
  trendDeclining: (c) => {
    const r = weeklyRate(c.daily, c.today, 28);
    if (!r || r.n < 6 || r.kgPerWeek > -0.1) return null;
    return { ruleId: 'trendDeclining', kind: 'observation', tone: 'positive', priority: 10,
      params: { rateKg: round(-r.kgPerWeek, 2) }, evidence: [{ key: 'ev.rate28', params: { rateKg: round(r.kgPerWeek, 2), n: r.n } }] };
  },

  trendRising: (c) => {
    const r = weeklyRate(c.daily, c.today, 28);
    if (!r || r.n < 8 || r.kgPerWeek < 0.2) return null;
    return { ruleId: 'trendRising', kind: 'observation', tone: 'attention', priority: 11,
      params: { rateKg: round(r.kgPerWeek, 2) }, evidence: [{ key: 'ev.rate28', params: { rateKg: round(r.kgPerWeek, 2), n: r.n } }] };
  },

  plateau: (c) => {
    const ch = periodChange(c.trend, c.today, 21);
    if (!ch || ch.n < 6 || Math.abs(ch.absKg) >= 0.3) return null;
    const cov = coverage(c.weightDays, addDays(c.today, -20), c.today);
    return { ruleId: 'plateau', kind: 'observation', tone: 'neutral', priority: 12,
      params: { changeKg: round(ch.absKg, 1), coveragePct: Math.round(cov.pct) },
      evidence: [{ key: 'ev.trendChange21', params: { changeKg: round(ch.absKg, 1), n: ch.n } }, { key: 'ev.weightCoverage', params: { days: cov.days, total: cov.total } }] };
  },

  workoutsImproved: (c) => {
    const prev = workoutsInWeek(c.data.workouts, addDays(c.weekStart, -7));
    const prev2 = workoutsInWeek(c.data.workouts, addDays(c.weekStart, -14));
    if (prev <= prev2 || prev === 0) return null;
    return { ruleId: 'workoutsImproved', kind: 'observation', tone: 'positive', priority: 13,
      params: { count: prev, before: prev2 }, evidence: [{ key: 'ev.workoutsCompare', params: { count: prev, before: prev2 } }] };
  },

  waistDown: (c) => {
    const m = measurementChange(c.data.weights, 'waistCm', addDays(c.today, -60), c.today);
    if (!m || m.change > -1) return null;
    return { ruleId: 'waistDown', kind: 'observation', tone: 'positive', priority: 14,
      params: { changeCm: round(-m.change, 1) }, evidence: [{ key: 'ev.waistChange', params: { changeCm: round(m.change, 1), n: m.n } }] };
  },

  proteinOnTarget: (c) => {
    const { from, to } = last(c, 7);
    const a = proteinAdherence(c.nutrition, c.profile.proteinTargetG, from, to);
    if (a.loggedDays < 4 || (a.pct ?? 0) < 80) return null;
    return { ruleId: 'proteinOnTarget', kind: 'observation', tone: 'positive', priority: 15,
      params: { met: a.metDays, logged: a.loggedDays }, evidence: [{ key: 'ev.proteinBelowDays', params: { below: a.belowDays.length, logged: a.loggedDays } }] };
  }
};

export function evaluateRules(c: CoachingContext): Insight[] {
  const out: Insight[] = [];
  for (const rule of Object.values(RULES)) {
    const r = rule(c);
    if (r) out.push({ ...r, id: `${r.ruleId}:${c.weekStart}` });
  }
  return out.sort((a, b) => a.priority - b.priority);
}

export interface CoachingResult { recommendations: Insight[]; observations: Insight[]; hidden: Insight[] }

/** Top recommendations (max 3) that the user has not dismissed or completed this week. */
export function selectInsights(all: Insight[], states: Map<string, string>): CoachingResult {
  const recs = all.filter((i) => i.kind === 'recommendation');
  const visible = recs.filter((i) => !states.has(i.id));
  return {
    recommendations: visible.slice(0, MAX_RECOMMENDATIONS),
    observations: all.filter((i) => i.kind === 'observation'),
    hidden: recs.filter((i) => states.has(i.id))
  };
}
