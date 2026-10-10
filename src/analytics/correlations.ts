import type { HealthEntry } from '../types';
import { dayOf } from '../utils/date';
import { mean, pearson, type Correlation } from '../utils/stats';
import type { DayNutrition } from './nutrition';

export const CORRELATION_MIN_N = 10;

function dailyHealthMean(entries: HealthEntry[], kind: HealthEntry['kind']): Map<string, number> {
  const m = new Map<string, number[]>();
  for (const e of entries) if (e.kind === kind && typeof e.value === 'number') m.set(dayOf(e.dateTime), [...(m.get(dayOf(e.dateTime)) ?? []), e.value]);
  return new Map([...m.entries()].map(([k, v]) => [k, mean(v)!]));
}

function pair(a: Map<string, number>, b: Map<string, number>): [number, number][] {
  const out: [number, number][] = [];
  for (const [k, v] of a) if (b.has(k)) out.push([v, b.get(k)!]);
  return out;
}

export interface CorrelationResult { id: 'sleepEnergy' | 'proteinHunger' | 'caloriesHunger' | 'stepsEnergy'; result: Correlation | null; n: number }

/** Same-day correlations between recorded metrics. Only days where *both* were recorded count. */
export function computeCorrelations(health: HealthEntry[], nutrition: Map<string, DayNutrition>, steps: Map<string, number>): CorrelationResult[] {
  const sleep = dailyHealthMean(health, 'sleep');
  const energy = dailyHealthMean(health, 'energy');
  const hunger = dailyHealthMean(health, 'hunger');
  const protein = new Map([...nutrition.entries()].map(([k, v]) => [k, v.proteinG]));
  const calories = new Map([...nutrition.entries()].filter(([, v]) => v.missing.calories < v.entries).map(([k, v]) => [k, v.calories]));
  const defs: [CorrelationResult['id'], Map<string, number>, Map<string, number>][] = [
    ['sleepEnergy', sleep, energy],
    ['proteinHunger', protein, hunger],
    ['caloriesHunger', calories, hunger],
    ['stepsEnergy', steps, energy]
  ];
  return defs.map(([id, a, b]) => {
    const p = pair(a, b);
    return { id, result: pearson(p, CORRELATION_MIN_N), n: p.length };
  });
}

export function correlationStrength(r: number): 'weak' | 'moderate' | 'strong' {
  const a = Math.abs(r);
  return a < 0.3 ? 'weak' : a < 0.6 ? 'moderate' : 'strong';
}
