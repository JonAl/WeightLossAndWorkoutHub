import type { HealthEntry, MealEntry, WeightEntry, Workout } from '../types';
import { initialProfile, initialSettings } from '../db/defaults';

let n = 0;
const id = () => `id-${++n}`;
const ts = '2026-01-01T00:00:00.000Z';

export const w = (dateTime: string, weightKg: number, extra: Partial<WeightEntry> = {}): WeightEntry => ({ id: id(), dateTime, weightKg, createdAt: ts, updatedAt: ts, ...extra });
export const meal = (dateTime: string, n: Partial<MealEntry> = {}): MealEntry => ({ id: id(), dateTime, category: 'lunch', foodName: 'Food', quantity: 1, unit: 'serving', createdAt: ts, updatedAt: ts, ...n });
export const hl = (dateTime: string, kind: HealthEntry['kind'], value?: number): HealthEntry => ({ id: id(), dateTime, kind, value, createdAt: ts, updatedAt: ts });
export function workout(date: string, sets: [number, number][] = [[10, 50]], status: Workout['status'] = 'completed', name = 'Bench Press'): Workout {
  return {
    id: id(), status, type: 'push', title: 'Push', startedAt: `${date}T18:00`, date, createdAt: ts, updatedAt: ts,
    exercises: [{ id: id(), name, kind: 'resistance', sets: sets.map(([reps, weightKg]) => ({ id: id(), reps, weightKg, done: true })) }]
  };
}
export const profile = (p = {}) => ({ ...initialProfile(), onboardingComplete: true, ...p });
export const settings = (s = {}) => ({ ...initialSettings(), ...s });
