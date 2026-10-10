/**
 * Progression helpers (documented, deterministic):
 *  - lastPerformance: the most recent *completed* workout containing the exercise (by normalized name),
 *    excluding the workout currently being logged.
 *  - suggestNext ("double progression"): if every completed working set of the last session reached
 *    the top of the rep range → add the exercise's load increment; if any set fell below the bottom of
 *    the range → keep the weight; otherwise keep the weight and aim for more reps.
 *    Bodyweight exercises get a rep suggestion instead. Suggestions are hints, never automatic changes.
 */
import type { Workout, WorkoutSet } from '../types';
import { normalizeExercise } from '../analytics/workouts';

export interface LastPerformance { date: string; workoutId: string; sets: Pick<WorkoutSet, 'reps' | 'weightKg'>[] }

export function lastPerformance(workouts: Workout[], name: string, excludeWorkoutId?: string): LastPerformance | null {
  const key = normalizeExercise(name);
  const done = workouts
    .filter((w) => w.status === 'completed' && w.id !== excludeWorkoutId)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt));
  for (const w of done) {
    const ex = w.exercises.find((e) => normalizeExercise(e.name) === key);
    const sets = ex?.sets.filter((s) => s.done && (s.reps ?? 0) > 0) ?? [];
    if (sets.length) return { date: w.date, workoutId: w.id, sets: sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg })) };
  }
  return null;
}

export type SuggestionReason = 'increase' | 'moreReps' | 'hold' | 'addReps';
export interface Suggestion { weightKg?: number; reps?: number; reason: SuggestionReason }

export function suggestNext(last: LastPerformance | null, repMin: number, repMax: number, incrementKg: number, bodyweight = false): Suggestion | null {
  if (!last || !last.sets.length) return null;
  const reps = last.sets.map((s) => s.reps ?? 0);
  if (bodyweight || !last.sets.some((s) => (s.weightKg ?? 0) > 0)) {
    return { reps: Math.max(...reps) + 1, reason: 'addReps' };
  }
  const top = Math.max(...last.sets.map((s) => s.weightKg ?? 0));
  const working = last.sets.filter((s) => (s.weightKg ?? 0) === top);
  if (working.every((s) => (s.reps ?? 0) >= repMax) && incrementKg > 0) return { weightKg: round(top + incrementKg), reps: repMin, reason: 'increase' };
  if (working.some((s) => (s.reps ?? 0) < repMin)) return { weightKg: top, reps: repMin, reason: 'hold' };
  return { weightKg: top, reps: Math.min(repMax, Math.max(...working.map((s) => s.reps ?? 0)) + 1), reason: 'moreReps' };
}

const round = (x: number) => Math.round(x * 100) / 100;

/** Compact "3×8 @ 70" style summary. Groups consecutive identical sets. */
export function summarizeSets(sets: Pick<WorkoutSet, 'reps' | 'weightKg'>[], fmtWeight: (kg: number) => string): string {
  const groups: { reps?: number; w?: number; n: number }[] = [];
  for (const s of sets) {
    const g = groups[groups.length - 1];
    if (g && g.reps === s.reps && g.w === s.weightKg) g.n++;
    else groups.push({ reps: s.reps, w: s.weightKg, n: 1 });
  }
  return groups.map((g) => `${g.n}×${g.reps ?? '?'}${g.w ? ` @ ${fmtWeight(g.w)}` : ''}`).join(', ');
}
