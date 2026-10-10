import { describe, expect, it } from 'vitest';
import { buildContext } from '../coaching/context';
import { evaluateRules, RULES, selectInsights, MAX_RECOMMENDATIONS } from '../coaching/rules';
import { reviewForWeek } from '../coaching/weeklyReview';
import { addDays } from '../utils/date';
import { hl, meal, profile, settings, w, workout } from './helpers';

const TODAY = '2026-03-18'; // Wednesday; week starts 2026-03-16
const empty = { weights: [], meals: [], workouts: [], health: [] };

describe('coaching rules', () => {
  it('produces nothing alarming for empty data (only logging nudges)', () => {
    const ins = evaluateRules(buildContext(empty, profile(), settings(), TODAY));
    expect(ins.map((i) => i.ruleId)).toEqual(['weightLogging']);
  });

  it('flags low protein only with enough logged days, and lists the evidence', () => {
    const meals = [0, 1, 2, 3].map((k) => meal(`${addDays(TODAY, -k)}T13:00`, { proteinG: 90 }));
    const ins = evaluateRules(buildContext({ ...empty, meals }, profile({ proteinTargetG: 160 }), settings(), TODAY));
    const p = ins.find((i) => i.ruleId === 'proteinLow')!;
    expect(p.kind).toBe('recommendation');
    expect(p.params).toMatchObject({ below: 4, logged: 4, target: 160 });
    expect(p.evidence.length).toBeGreaterThan(0);

    const two = evaluateRules(buildContext({ ...empty, meals: meals.slice(0, 2) }, profile(), settings(), TODAY));
    expect(two.some((i) => i.ruleId === 'proteinLow')).toBe(false);
  });

  it('observes a declining trend despite daily noise', () => {
    const weights = Array.from({ length: 28 }, (_, i) => w(`${addDays(TODAY, -27 + i)}T07:00`, 145 - i * 0.08 + (i % 2 ? 0.6 : -0.6)));
    const ins = evaluateRules(buildContext({ ...empty, weights }, profile(), settings(), TODAY));
    expect(ins.find((i) => i.ruleId === 'trendDeclining')?.kind).toBe('observation');
    expect(ins.some((i) => i.ruleId === 'trendRising')).toBe(false);
  });

  it('respects disabled health categories', () => {
    const health = [0, 1, 2, 3, 4].map((k) => hl(`${addDays(TODAY, -k)}T07:00`, 'sleep', 5));
    expect(evaluateRules(buildContext({ ...empty, health }, profile(), settings(), TODAY)).some((i) => i.ruleId === 'sleepPoor')).toBe(true);
    expect(evaluateRules(buildContext({ ...empty, health }, profile(), settings({ enabledHealthKinds: [] }), TODAY)).some((i) => i.ruleId === 'sleepPoor')).toBe(false);
  });

  it('shows at most three recommendations and hides dismissed ones', () => {
    const meals = [0, 1, 2, 3].map((k) => meal(`${addDays(TODAY, -k)}T13:00`, { proteinG: 50, calories: 800, fiberG: 5 }));
    const health = [0, 1, 2, 3].map((k) => hl(`${addDays(TODAY, -k)}T07:00`, 'sleep', 5));
    const workouts = [workout(addDays(TODAY, -20))];
    const all = evaluateRules(buildContext({ weights: [], meals, workouts, health }, profile({ calorieTargetKcal: 2400 }), settings(), TODAY));
    expect(all.filter((i) => i.kind === 'recommendation').length).toBeGreaterThan(MAX_RECOMMENDATIONS);
    const sel = selectInsights(all, new Map());
    expect(sel.recommendations).toHaveLength(3);
    expect(sel.recommendations[0].priority).toBeLessThanOrEqual(sel.recommendations[2].priority);
    const dismissed = selectInsights(all, new Map([[sel.recommendations[0].id, 'dismissed']]));
    expect(dismissed.recommendations.map((r) => r.id)).not.toContain(sel.recommendations[0].id);
    expect(dismissed.hidden).toHaveLength(1);
  });

  it('never generates medication advice', () => {
    expect(Object.keys(RULES).some((k) => /medic|dose/i.test(k))).toBe(false);
  });
});

describe('weekly review', () => {
  it('classifies improved / attention / insufficient with sample sizes', () => {
    const weights = [
      w('2026-03-02T07:00', 146), w('2026-03-04T07:00', 146.4), // previous week mean 146.2
      w('2026-03-09T07:00', 145.5), w('2026-03-11T07:00', 145.1), w('2026-03-13T07:00', 145.0) // review week
    ];
    const meals = ['2026-03-09', '2026-03-10', '2026-03-11'].map((d) => meal(`${d}T12:00`, { proteinG: 100 }));
    const workouts = [workout('2026-03-02'), workout('2026-03-10'), workout('2026-03-12')];
    const r = reviewForWeek({ weights, meals, workouts, health: [] }, profile({ proteinTargetG: 160, weeklyWorkoutTarget: 5 }), settings(), '2026-03-09');
    expect(r.improved.map((i) => i.metric)).toContain('weight');
    expect(r.improved.find((i) => i.metric === 'workouts')?.params).toMatchObject({ count: 2, before: 1 });
    expect(r.attention.map((i) => i.metric)).toContain('protein');
    expect(r.attention.map((i) => i.metric)).toContain('coverage');
    expect(r.priorities.length).toBeLessThanOrEqual(3);
  });
  it('reports insufficient data for an empty week', () => {
    const r = reviewForWeek(empty, profile(), settings(), '2026-03-09');
    expect(r.insufficient.map((i) => i.metric).sort()).toEqual(['protein', 'weight', 'workouts']);
  });
});
