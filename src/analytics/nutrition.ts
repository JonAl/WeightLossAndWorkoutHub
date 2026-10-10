import type { MealEntry, Nutrients, Profile } from '../types';
import { dateRange, dayOf } from '../utils/date';
import { mean } from '../utils/stats';

export interface DayNutrition {
  date: string;
  entries: number;
  calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number;
  /** Count of entries where a nutrient was not recorded (so totals may be understated). */
  missing: { calories: number; proteinG: number; fiberG: number };
}

const NUTRIENT_KEYS = ['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'] as const;

export function dailyNutrition(meals: MealEntry[]): Map<string, DayNutrition> {
  const out = new Map<string, DayNutrition>();
  for (const m of meals) {
    const d = dayOf(m.dateTime);
    const cur = out.get(d) ?? { date: d, entries: 0, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, missing: { calories: 0, proteinG: 0, fiberG: 0 } };
    cur.entries++;
    for (const k of NUTRIENT_KEYS) {
      const v = m[k];
      if (typeof v === 'number' && Number.isFinite(v)) cur[k] += v;
      else if (k === 'calories' || k === 'proteinG' || k === 'fiberG') cur.missing[k]++;
    }
    out.set(d, cur);
  }
  return out;
}

export function sumNutrients(items: Nutrients[]): Required<Nutrients> {
  const t = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  for (const it of items) for (const k of NUTRIENT_KEYS) if (typeof it[k] === 'number') t[k] += it[k]!;
  return t;
}

export interface AdherenceResult {
  /** Days in range that had at least one meal logged — the sample size. */
  loggedDays: number;
  totalDays: number;
  metDays: number;
  pct: number | null;
  average: number | null;
  belowDays: string[];
}

/**
 * Protein adherence: a logged day "meets" the target if protein ≥ target × threshold.
 * Days with no meals logged are excluded (missing ≠ zero).
 */
export function proteinAdherence(days: Map<string, DayNutrition>, target: number, from: string, to: string, threshold = 1): AdherenceResult {
  const range = dateRange(from, to);
  const logged = range.map((d) => days.get(d)).filter((x): x is DayNutrition => !!x);
  const met = logged.filter((d) => d.proteinG >= target * threshold);
  return {
    loggedDays: logged.length,
    totalDays: range.length,
    metDays: met.length,
    pct: logged.length ? (met.length / logged.length) * 100 : null,
    average: mean(logged.map((d) => d.proteinG)),
    belowDays: logged.filter((d) => d.proteinG < target * threshold).map((d) => d.date)
  };
}

/** Calorie adherence: within [85 %, 105 %] of target. Days missing calorie data on every entry are excluded. */
export const CAL_LOW = 0.85;
export const CAL_HIGH = 1.05;
export function calorieAdherence(days: Map<string, DayNutrition>, target: number, from: string, to: string): AdherenceResult {
  const range = dateRange(from, to);
  const logged = range.map((d) => days.get(d)).filter((x): x is DayNutrition => !!x && x.missing.calories < x.entries);
  const ok = (d: DayNutrition) => d.calories >= target * CAL_LOW && d.calories <= target * CAL_HIGH;
  return {
    loggedDays: logged.length,
    totalDays: range.length,
    metDays: logged.filter(ok).length,
    pct: logged.length ? (logged.filter(ok).length / logged.length) * 100 : null,
    average: mean(logged.map((d) => d.calories)),
    belowDays: logged.filter((d) => d.calories < target * CAL_LOW).map((d) => d.date)
  };
}

export function averageNutrient(days: Map<string, DayNutrition>, key: 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG', from: string, to: string): { avg: number | null; n: number } {
  const xs = dateRange(from, to).map((d) => days.get(d)).filter((x): x is DayNutrition => !!x).map((d) => d[key]);
  return { avg: mean(xs), n: xs.length };
}

/** Rank logged foods by total protein contributed in the range. */
export function topProteinFoods(meals: MealEntry[], from: string, to: string, limit = 5): { name: string; proteinG: number; count: number }[] {
  const m = new Map<string, { name: string; proteinG: number; count: number }>();
  for (const x of meals) {
    const d = dayOf(x.dateTime);
    if (d < from || d > to || typeof x.proteinG !== 'number') continue;
    const k = x.foodName.trim().toLowerCase();
    const cur = m.get(k) ?? { name: x.foodName.trim(), proteinG: 0, count: 0 };
    cur.proteinG += x.proteinG;
    cur.count++;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.proteinG - a.proteinG).slice(0, limit);
}

// ---------- estimates ----------

export interface ProteinRecommendation { referenceKg: number; referenceSource: 'goal' | 'bmi25'; lowG: number; midG: number; highG: number }

/**
 * Protein target estimate. With substantial excess body fat, grams per kg of *total* body weight
 * overestimates needs, so we use a reference weight: the goal weight if set, otherwise the weight
 * at BMI 25 for the user's height. Range 1.6–2.2 g/kg of reference weight (commonly cited range for
 * preserving lean mass during a deficit). This is an estimate, not a prescription.
 */
export function proteinRecommendation(p: Pick<Profile, 'heightCm' | 'goalWeightKg'>): ProteinRecommendation | null {
  if (!(p.heightCm > 0)) return null;
  const bmi25 = 25 * (p.heightCm / 100) ** 2;
  const useGoal = typeof p.goalWeightKg === 'number' && p.goalWeightKg > 0;
  const ref = useGoal ? p.goalWeightKg! : bmi25;
  return { referenceKg: ref, referenceSource: useGoal ? 'goal' : 'bmi25', lowG: Math.round(ref * 1.6), midG: Math.round(ref * 1.9), highG: Math.round(ref * 2.2) };
}

export const ACTIVITY_FACTORS: Record<Profile['activityLevel'], number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };

export interface CalorieEstimate { bmr: number; maintenance: number; suggested: number; floor: number; deficit: number }

/**
 * Calorie estimate via Mifflin–St Jeor. Requires age and sex. Suggested intake applies a moderate
 * deficit of the smaller of 500 kcal or 20 % of maintenance and never goes below a safety floor
 * (1500 kcal male / 1200 kcal female). Estimates only — real needs vary.
 */
export function calorieEstimate(p: Pick<Profile, 'heightCm' | 'sex' | 'activityLevel'>, weightKg: number, age: number | undefined): CalorieEstimate | null {
  if (p.sex === 'unspecified' || !age || !(weightKg > 0) || !(p.heightCm > 0)) return null;
  const bmr = 10 * weightKg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161);
  const maintenance = bmr * ACTIVITY_FACTORS[p.activityLevel];
  const deficit = Math.min(500, maintenance * 0.2);
  const floor = p.sex === 'male' ? 1500 : 1200;
  const suggested = Math.max(floor, maintenance - deficit);
  const r = (x: number) => Math.round(x / 10) * 10;
  return { bmr: r(bmr), maintenance: r(maintenance), suggested: r(suggested), floor, deficit: r(deficit) };
}
