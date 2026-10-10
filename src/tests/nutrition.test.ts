import { describe, expect, it } from 'vitest';
import { calorieAdherence, calorieEstimate, dailyNutrition, proteinAdherence, proteinRecommendation, topProteinFoods } from '../analytics/nutrition';
import { toFoodUnit } from '../features/nutrition/MealForm';
import { scaleNutrient } from '../utils/units';
import { meal } from './helpers';

const meals = [
  meal('2026-03-01T08:00', { proteinG: 40, calories: 500, fiberG: 5 }),
  meal('2026-03-01T13:00', { proteinG: 80, calories: 900 }), // fiber missing
  meal('2026-03-02T13:00', { proteinG: 170, calories: 2100, fiberG: 30 }),
  meal('2026-03-04T13:00', { proteinG: 150 }) // calories missing entirely
];

describe('dailyNutrition', () => {
  it('sums recorded values and counts missing ones instead of treating them as zero', () => {
    const d = dailyNutrition(meals).get('2026-03-01')!;
    expect(d.proteinG).toBe(120);
    expect(d.fiberG).toBe(5);
    expect(d.missing.fiberG).toBe(1);
  });
});

describe('proteinAdherence', () => {
  it('only counts logged days; unlogged days are excluded', () => {
    const a = proteinAdherence(dailyNutrition(meals), 160, '2026-03-01', '2026-03-07');
    expect(a.totalDays).toBe(7);
    expect(a.loggedDays).toBe(3);
    expect(a.metDays).toBe(1);
    expect(a.pct).toBeCloseTo(33.333, 2);
    expect(a.average).toBeCloseTo((120 + 170 + 150) / 3, 6);
    expect(a.belowDays).toEqual(['2026-03-01', '2026-03-04']);
  });
  it('returns null percentage for an empty dataset', () => {
    const a = proteinAdherence(new Map(), 160, '2026-03-01', '2026-03-07');
    expect(a.pct).toBeNull();
    expect(a.average).toBeNull();
  });
});

describe('calorieAdherence', () => {
  it('excludes days with no calorie data and uses an 85–105% band', () => {
    const a = calorieAdherence(dailyNutrition(meals), 2000, '2026-03-01', '2026-03-07');
    expect(a.loggedDays).toBe(2); // 03-04 has no calories recorded
    expect(a.metDays).toBe(1); // 2100 is within 105%; 1400 is below 85%
  });
});

describe('estimates', () => {
  it('protein uses a reference weight, not total body weight', () => {
    const r = proteinRecommendation({ heightCm: 182, goalWeightKg: undefined })!;
    expect(r.referenceSource).toBe('bmi25');
    expect(r.referenceKg).toBeCloseTo(82.81, 2);
    expect(r.lowG).toBe(132);
    expect(r.highG).toBe(182);
    expect(proteinRecommendation({ heightCm: 182, goalWeightKg: 100 })!.midG).toBe(190);
  });
  it('calorie estimate follows Mifflin–St Jeor and respects a floor', () => {
    const c = calorieEstimate({ heightCm: 182, sex: 'male', activityLevel: 'sedentary' }, 145, 37)!;
    // BMR = 1450 + 1137.5 − 185 + 5 = 2407.5 → 2410 ; maintenance 2889 → 2890
    expect(c.bmr).toBe(2410);
    expect(c.maintenance).toBe(2890);
    expect(c.suggested).toBe(2390);
    expect(calorieEstimate({ heightCm: 182, sex: 'unspecified', activityLevel: 'sedentary' }, 145, 37)).toBeNull();
    const small = calorieEstimate({ heightCm: 150, sex: 'female', activityLevel: 'sedentary' }, 45, 70)!;
    expect(small.suggested).toBeGreaterThanOrEqual(1200);
  });
});

describe('serving conversions', () => {
  it('scales per-serving nutrients explicitly', () => {
    expect(scaleNutrient(25, 100, 250)).toBe(62.5);
    expect(scaleNutrient(undefined, 100, 250)).toBeUndefined();
    expect(toFoodUnit(2, 'serving', { servingSize: 30, servingUnit: 'g' })).toBe(60);
    expect(toFoodUnit(150, 'g', { servingSize: 100, servingUnit: 'g' })).toBe(150);
    expect(toFoodUnit(150, 'ml', { servingSize: 100, servingUnit: 'g' })).toBeUndefined();
  });
  it('ranks foods by protein contribution', () => {
    const top = topProteinFoods([meal('2026-03-01T08:00', { foodName: 'Whey', proteinG: 25 }), meal('2026-03-02T08:00', { foodName: 'whey ', proteinG: 25 }), meal('2026-03-02T09:00', { foodName: 'Eggs', proteinG: 18 })], '2026-03-01', '2026-03-31');
    expect(top[0]).toMatchObject({ name: 'Whey', proteinG: 50, count: 2 });
  });
});
