import { describe, expect, it } from 'vitest';
import { lastPerformance, suggestNext, summarizeSets } from '../training/progression';
import { platesPerSide, warmupSets } from '../training/plates';
import { activeProgram, estimateMinutes, monthGrid, plannedTemplate, weekdayIndex } from '../training/plan';
import { remainingSec, fmtClock } from '../training/restTimer';
import { getTraining } from '../training/settings';
import { allExercises, findExercise, searchExercises } from '../training/exercises';
import { shoppingList, plannedDay } from '../analytics/mealPlan';
import { EXERCISE_LIBRARY } from '../data/exercises';
import { starterProgram, starterTemplates } from '../db/defaults';
import { workout } from './helpers';
import type { CustomExercise, MealPlanEntry, SavedMeal } from '../types';

describe('progression', () => {
  const ws = [
    workout('2026-03-02', [[8, 70], [8, 70], [7, 70]]),
    workout('2026-03-05', [[12, 72.5], [12, 72.5], [12, 72.5]]),
    workout('2026-03-09', [[5, 60]], 'active')
  ];
  it('finds the latest completed session, skipping the active one', () => {
    const lp = lastPerformance(ws, 'bench press ', ws[2].id)!;
    expect(lp.date).toBe('2026-03-05');
    expect(lp.sets).toHaveLength(3);
    expect(lastPerformance(ws, 'Squat')).toBeNull();
  });
  it('double progression: increase when all working sets hit the top of the range', () => {
    expect(suggestNext(lastPerformance(ws, 'Bench Press')!, 8, 12, 2.5)).toEqual({ weightKg: 75, reps: 8, reason: 'increase' });
  });
  it('holds the weight when a set fell below the range, otherwise aims for more reps', () => {
    const below = { date: 'x', workoutId: 'w', sets: [{ reps: 8, weightKg: 70 }, { reps: 5, weightKg: 70 }] };
    expect(suggestNext(below, 6, 10, 2.5)).toEqual({ weightKg: 70, reps: 6, reason: 'hold' });
    const mid = { date: 'x', workoutId: 'w', sets: [{ reps: 8, weightKg: 70 }, { reps: 7, weightKg: 70 }] };
    expect(suggestNext(mid, 6, 10, 2.5)).toEqual({ weightKg: 70, reps: 9, reason: 'moreReps' });
    expect(suggestNext(null, 6, 10, 2.5)).toBeNull();
  });
  it('bodyweight exercises suggest one more rep', () => {
    expect(suggestNext({ date: 'x', workoutId: 'w', sets: [{ reps: 10 }, { reps: 8 }] }, 8, 20, 0, true)).toEqual({ reps: 11, reason: 'addReps' });
  });
  it('summarizes sets compactly', () => {
    expect(summarizeSets([{ reps: 8, weightKg: 70 }, { reps: 8, weightKg: 70 }, { reps: 6, weightKg: 70 }], (w) => `${w} kg`)).toBe('2×8 @ 70 kg, 1×6 @ 70 kg');
  });
});

describe('plate & warm-up calculators', () => {
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  it('loads plates greedily per side', () => {
    expect(platesPerSide(100, 20, plates)).toEqual({ perSide: [25, 15], loaded: 100, remainder: 0 });
    expect(platesPerSide(72.5, 20, plates)).toEqual({ perSide: [25, 1.25], loaded: 72.5, remainder: 0 });
    expect(platesPerSide(21, 20, plates)).toEqual({ perSide: [], loaded: 20, remainder: 1 });
    expect(platesPerSide(15, 20, plates).perSide).toEqual([]);
  });
  it('ramps warm-ups from the bar, rounded to loadable steps', () => {
    expect(warmupSets(100, 20, 1.25)).toEqual([
      { weight: 20, reps: 10, label: 'bar' }, { weight: 40, reps: 5, label: 'pct' }, { weight: 60, reps: 3, label: 'pct' }, { weight: 80, reps: 2, label: 'pct' }
    ]);
    expect(warmupSets(30, 20, 1.25).map((s) => s.weight)).toEqual([20, 22.5]); // 40 % and 60 % round to the bar and are skipped
    expect(warmupSets(20, 20, 1.25)).toEqual([]);
  });
});

describe('weekly plan', () => {
  const tpls = starterTemplates();
  const prog = starterProgram(tpls);
  it('maps dates to Monday-first weekdays and planned templates', () => {
    expect(weekdayIndex('2026-03-09')).toBe(0); // Monday
    expect(weekdayIndex('2026-03-15')).toBe(6); // Sunday
    expect(plannedTemplate(prog, tpls, '2026-03-09')?.name).toBe('Push');
    expect(plannedTemplate(prog, tpls, '2026-03-12')).toBeNull(); // Thursday rest
    expect(activeProgram([{ ...prog, active: false }, prog])).toBe(prog);
  });
  it('estimates session length from sets and rest', () => {
    const push = tpls.find((t) => t.name === 'Push')!;
    // sets: 4,3,3,3,3 ; rest 150,120,120,60,60 → (4*190 + 3*160 + 3*160 + 3*100 + 3*100) s = 2320 s ≈ 39 → 40 min
    expect(estimateMinutes(push, 90)).toBe(40);
  });
  it('builds a Monday-first month grid', () => {
    const g = monthGrid('2026-03-15');
    expect(g.length % 7).toBe(0);
    expect(g[6]).toBe('2026-03-01'); // March 1 2026 is a Sunday
    expect(g.filter(Boolean)).toHaveLength(31);
  });
});

describe('rest timer & settings', () => {
  it('computes remaining seconds from timestamps', () => {
    expect(remainingSec(10_000, 0)).toBe(10);
    expect(remainingSec(10_000, 9_001)).toBe(1);
    expect(remainingSec(10_000, 12_000)).toBe(0);
    expect(remainingSec(null, 0)).toBe(0);
    expect(fmtClock(95)).toBe('01:35');
  });
  it('fills training defaults per unit system', () => {
    expect(getTraining({}, 'metric')).toMatchObject({ defaultRestSec: 90, barWeight: 20, autoStartRest: true });
    expect(getTraining({}, 'imperial').barWeight).toBe(45);
    expect(getTraining({ training: { defaultRestSec: 120 } }, 'metric').defaultRestSec).toBe(120);
  });
});

describe('exercise library', () => {
  it('has unique ids, valid rep ranges and cues in both languages', () => {
    expect(new Set(EXERCISE_LIBRARY.map((e) => e.id)).size).toBe(EXERCISE_LIBRARY.length);
    for (const e of EXERCISE_LIBRARY) {
      expect(e.repMin, e.id).toBeLessThanOrEqual(e.repMax);
      expect(e.cues!.el.length, e.id).toBe(e.cues!.en.length);
      expect(e.cues!.el.join(' '), e.id).toMatch(/[Ͱ-Ͽ]/);
    }
    expect(EXERCISE_LIBRARY.length).toBeGreaterThanOrEqual(40);
  });
  it('finds by id or name and merges custom exercises', () => {
    const custom: CustomExercise = { ...EXERCISE_LIBRARY[0], id: 'my-press', name: 'Landmine Press', custom: true, createdAt: '', updatedAt: '' };
    expect(findExercise('bench press')?.id).toBe('bench');
    expect(findExercise('Landmine press', [custom])?.id).toBe('my-press');
    expect(allExercises([custom]).length).toBe(EXERCISE_LIBRARY.length + 1);
    expect(searchExercises(allExercises(), '', 'arms', (m) => m).every((e) => e.category === 'arms')).toBe(true);
    expect(searchExercises(allExercises(), 'triceps', 'all', (m) => m).length).toBeGreaterThan(3);
  });
  it('starter templates reference real library exercises', () => {
    for (const t of starterTemplates()) for (const e of t.exercises) expect(findExercise(e.exerciseId)?.name).toBe(e.name);
  });
});

describe('meal plan', () => {
  const saved: SavedMeal[] = [
    { id: 'b', name: 'Yogurt bowl', category: 'breakfast', createdAt: '', updatedAt: '', items: [{ foodName: 'Greek yogurt', quantity: 300, unit: 'g', proteinG: 30, calories: 225 }, { foodName: 'Oats', quantity: 40, unit: 'g', proteinG: 5, calories: 150 }] },
    { id: 'l', name: 'Chicken rice', category: 'lunch', createdAt: '', updatedAt: '', items: [{ foodName: 'Chicken breast', quantity: 200, unit: 'g', proteinG: 46 }, { foodName: 'greek yogurt ', quantity: 100, unit: 'g', proteinG: 10 }] }
  ];
  const plan: MealPlanEntry[] = [
    { id: '0-breakfast', weekday: 0, category: 'breakfast', savedMealId: 'b', updatedAt: '' },
    { id: '1-breakfast', weekday: 1, category: 'breakfast', savedMealId: 'b', updatedAt: '' },
    { id: '0-lunch', weekday: 0, category: 'lunch', savedMealId: 'l', updatedAt: '' },
    { id: '2-lunch', weekday: 2, category: 'lunch', savedMealId: 'deleted', updatedAt: '' }
  ];
  it('aggregates a shopping list by food and unit', () => {
    const list = shoppingList(plan, saved);
    expect(list.find((x) => x.name === 'Greek yogurt')).toMatchObject({ quantity: 700, unit: 'g', uses: 3 });
    expect(list.find((x) => x.name === 'Oats')?.quantity).toBe(80);
    expect(list).toHaveLength(3);
  });
  it('computes planned day totals and ignores deleted meals', () => {
    expect(plannedDay(plan, saved, 0).totals.proteinG).toBe(91);
    expect(plannedDay(plan, saved, 2).meals).toHaveLength(0);
  });
});

import { parseTemplateLines, workoutFromTemplate } from '../training/workoutOps';
describe('workout building', () => {
  it('parses template lines with ranges and links library exercises', () => {
    const r = parseTemplateLines('Bench Press, 4x6-10\nMy Move, 3x12\nTreadmill Walk / Run; cardio\nLat Pulldown');
    expect(r[0]).toMatchObject({ name: 'Bench Press', targetSets: 4, repMin: 6, targetReps: 10, exerciseId: 'bench' });
    expect(r[1]).toMatchObject({ name: 'My Move', targetSets: 3, repMin: 12, targetReps: 12, exerciseId: undefined });
    expect(r[2]).toMatchObject({ kind: 'cardio', exerciseId: 'treadmill' });
    expect(r[3]).toMatchObject({ exerciseId: 'lat-pulldown', targetSets: 3, repMin: 8, targetReps: 12 });
  });
  it('pre-fills sets from the progression suggestion', () => {
    const tpl = starterTemplates().find((t) => t.name === 'Push')!;
    const history = [workout('2026-03-05', [[10, 80], [10, 80], [10, 80], [10, 80]])]; // bench 6–10 → all at top
    const w = workoutFromTemplate(tpl, history);
    const bench = w.exercises[0];
    expect(bench.target).toMatchObject({ sets: 4, repMin: 6, repMax: 10, restSec: 150 });
    expect(bench.sets.map((s) => s.weightKg)).toEqual([82.5, 82.5, 82.5, 82.5]);
    expect(bench.sets[0].reps).toBe(6);
    expect(w.exercises[1].sets[0].weightKg).toBeUndefined(); // no history for OHP
  });
});
