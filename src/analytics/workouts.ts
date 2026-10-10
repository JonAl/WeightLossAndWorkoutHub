import type { Workout, WorkoutExercise } from '../types';
import { weekStart } from '../utils/date';

export const normalizeExercise = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Resistance volume = Σ sets × reps × load, counting only completed sets with reps > 0 and load > 0.
 * Bodyweight and cardio exercises have no comparable load volume and return null.
 */
export function exerciseVolume(ex: WorkoutExercise): number | null {
  if (ex.kind !== 'resistance') return null;
  return ex.sets.filter((s) => s.done && (s.reps ?? 0) > 0 && (s.weightKg ?? 0) > 0).reduce((a, s) => a + s.reps! * s.weightKg!, 0);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce((a, e) => a + (exerciseVolume(e) ?? 0), 0);
}

export function completedSets(w: Workout): number {
  return w.exercises.filter((e) => e.kind !== 'cardio').reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
}

export function cardioTotals(w: Workout): { durationMin: number; distanceKm: number } {
  return w.exercises
    .filter((e) => e.kind === 'cardio' && e.cardio)
    .reduce((a, e) => ({ durationMin: a.durationMin + (e.cardio?.durationMin ?? 0), distanceKm: a.distanceKm + (e.cardio?.distanceKm ?? 0) }), { durationMin: 0, distanceKm: 0 });
}

/** Epley estimated one-rep max (estimate, valid mostly for reps ≤ 10). */
export const epley1RM = (weightKg: number, reps: number) => (reps === 1 ? weightKg : weightKg * (1 + reps / 30));

export function completedWorkouts(ws: Workout[]): Workout[] {
  return ws.filter((w) => w.status === 'completed');
}

/** Completed workouts per Monday-start week, keyed by week start. */
export function weeklyWorkoutCounts(ws: Workout[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of completedWorkouts(ws)) {
    const k = weekStart(w.date);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function workoutsInWeek(ws: Workout[], weekStartKey: string): number {
  return weeklyWorkoutCounts(ws).get(weekStartKey) ?? 0;
}

export interface PersonalRecord { exercise: string; maxWeightKg: number; maxWeightReps: number; maxWeightDate: string; best1RM: number; best1RMDate: string; bestVolume: number; bestVolumeDate: string }

export function personalRecords(ws: Workout[]): PersonalRecord[] {
  const m = new Map<string, PersonalRecord>();
  for (const w of completedWorkouts(ws)) {
    for (const ex of w.exercises) {
      if (ex.kind !== 'resistance') continue;
      const key = normalizeExercise(ex.name);
      const cur = m.get(key) ?? { exercise: ex.name.trim(), maxWeightKg: 0, maxWeightReps: 0, maxWeightDate: '', best1RM: 0, best1RMDate: '', bestVolume: 0, bestVolumeDate: '' };
      for (const s of ex.sets) {
        if (!s.done || !(s.weightKg! > 0) || !(s.reps! > 0)) continue;
        if (s.weightKg! > cur.maxWeightKg || (s.weightKg === cur.maxWeightKg && s.reps! > cur.maxWeightReps)) {
          cur.maxWeightKg = s.weightKg!; cur.maxWeightReps = s.reps!; cur.maxWeightDate = w.date;
        }
        const e = epley1RM(s.weightKg!, s.reps!);
        if (e > cur.best1RM) { cur.best1RM = e; cur.best1RMDate = w.date; }
      }
      const vol = exerciseVolume(ex) ?? 0;
      if (vol > cur.bestVolume) { cur.bestVolume = vol; cur.bestVolumeDate = w.date; }
      if (cur.maxWeightKg > 0) m.set(key, cur);
    }
  }
  return [...m.values()].sort((a, b) => a.exercise.localeCompare(b.exercise));
}

export interface ProgressionPoint { date: string; topSetKg: number; est1RM: number; volume: number }

export function exerciseProgression(ws: Workout[], name: string): ProgressionPoint[] {
  const key = normalizeExercise(name);
  const out: ProgressionPoint[] = [];
  for (const w of completedWorkouts(ws).sort((a, b) => a.date.localeCompare(b.date))) {
    for (const ex of w.exercises) {
      if (ex.kind !== 'resistance' || normalizeExercise(ex.name) !== key) continue;
      const sets = ex.sets.filter((s) => s.done && s.weightKg! > 0 && s.reps! > 0);
      if (!sets.length) continue;
      out.push({
        date: w.date,
        topSetKg: Math.max(...sets.map((s) => s.weightKg!)),
        est1RM: Math.max(...sets.map((s) => epley1RM(s.weightKg!, s.reps!))),
        volume: exerciseVolume(ex) ?? 0
      });
    }
  }
  return out;
}

export function exerciseNames(ws: Workout[]): string[] {
  const m = new Map<string, string>();
  for (const w of ws) for (const e of w.exercises) if (e.kind === 'resistance') m.set(normalizeExercise(e.name), e.name.trim());
  return [...m.values()].sort((a, b) => a.localeCompare(b));
}

export function weeklyVolume(ws: Workout[]): { weekStart: string; volume: number; sessions: number }[] {
  const m = new Map<string, { volume: number; sessions: number }>();
  for (const w of completedWorkouts(ws)) {
    const k = weekStart(w.date);
    const cur = m.get(k) ?? { volume: 0, sessions: 0 };
    cur.volume += workoutVolume(w);
    cur.sessions++;
    m.set(k, cur);
  }
  return [...m.entries()].map(([weekStart, v]) => ({ weekStart, ...v })).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
