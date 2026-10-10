import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { el } from '../i18n/el';
import { createI18n, interpolate } from '../i18n';
import { RULES } from '../coaching/rules';
import { EQUIPMENT, EXERCISE_CATEGORIES, HEALTH_KINDS, MEAL_CATEGORIES, MEASUREMENT_FIELDS, TABLE_NAMES, WORKOUT_TYPES } from '../types';
import { EXERCISE_LIBRARY } from '../data/exercises';

const dynamicKeys = [
  ...Object.keys(RULES).flatMap((r) => [`coach.${r}.title`, `coach.${r}.body`]),
  ...HEALTH_KINDS.map((k) => `health.kind.${k}`), ...MEAL_CATEGORIES.map((c) => `meal.cat.${c}`),
  ...WORKOUT_TYPES.map((x) => `workout.type.${x}`), ...MEASUREMENT_FIELDS.map((f) => `measure.${f}`), ...TABLE_NAMES.map((t) => `table.${t}`),
  ...['dashboard', 'progress', 'nutrition', 'workouts', 'health', 'coaching', 'reports', 'settings'].map((n) => `nav.${n}`),
  ...['7', '30', '90', '365', 'all'].map((r) => `range.${r}`), ...['under', 'normal', 'over', 'obese1', 'obese2', 'obese3'].map((b) => `bmi.${b}`),
  ...['g', 'ml', 'serving', 'piece'].map((u) => `unit.${u}`), ...['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'].map((n) => `nutrient.${n}`),
  ...['weight', 'protein', 'workouts'].flatMap((m) => ['improved', 'stable', 'attention', 'insufficient'].map((b) => `review.${m}.${b}`)),
  ...EXERCISE_CATEGORIES.map((c) => `exCat.${c}`), ...EQUIPMENT.map((e) => `equip.${e}`),
  ...[...new Set(EXERCISE_LIBRARY.flatMap((e) => [...e.primary, ...e.secondary]))].map((m) => `muscle.${m}`),
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((d) => [`weekday.${d}`, `weekdayShort.${d}`]),
  ...['increase', 'moreReps', 'hold', 'addReps'].map((r) => `hints.sug.${r}`),
  'review.fiber.stable', 'review.fiber.attention', 'review.sleep.stable', 'review.sleep.attention', 'review.coverage.stable', 'review.coverage.attention'
];

describe('dictionaries', () => {
  it('Greek and English have exactly the same keys and no empty strings', () => {
    expect(Object.keys(el).sort()).toEqual(Object.keys(en).sort());
    for (const [k, v] of Object.entries(el)) expect(v.trim(), k).not.toBe('');
  });
  it('contain every dynamically built key', () => {
    for (const k of dynamicKeys) {
      expect(en, k).toHaveProperty([k]);
      expect(el, k).toHaveProperty([k]);
    }
  });
  it('use the same placeholders in both languages', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(ph(el[k]), k).toBe(ph(en[k]));
  });
  it('Greek text uses Greek characters', () => {
    expect(el['nav.nutrition']).toBe('Διατροφή');
    expect(/[Ͱ-Ͽ]/.test(el['dash.emptyBody'])).toBe(true);
  });
});

describe('formatting', () => {
  it('interpolates and formats unit-suffixed params', () => {
    expect(interpolate('Hi {name}', { name: 'Θ' })).toBe('Hi Θ');
    const g = createI18n('el', 'metric');
    expect(g.num(1234.56, 1)).toBe('1.234,6');
    expect(g.weight(145.04)).toBe('145 kg');
    const e = createI18n('en', 'imperial');
    expect(e.weight(100)).toBe('220.5 lb');
    expect(e.t('coach.trendDeclining.body', { rateKg: 0.5 })).toContain('1.1 lb');
  });
});
