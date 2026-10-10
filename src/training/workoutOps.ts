import type { CustomExercise, LibraryExercise, TemplateExercise, Workout, WorkoutExercise, WorkoutTemplate } from '../types';
import { uid } from '../utils/id';
import { nowLocal, today } from '../utils/date';
import { findExercise } from './exercises';
import { lastPerformance, suggestNext } from './progression';

type Base = Pick<LibraryExercise, 'name' | 'kind'> & Partial<Pick<LibraryExercise, 'id' | 'repMin' | 'repMax' | 'restSec' | 'incrementKg' | 'defaultSets'>>;

/**
 * Build a workout exercise with planned targets. Sets are pre-filled with the progression
 * suggestion from history (weight & reps) — a starting point the user can change.
 */
export function makeExercise(base: Base, history: Workout[], opts: { sets?: number; repMin?: number; repMax?: number; restSec?: number } = {}): WorkoutExercise {
  const repMax = opts.repMax ?? base.repMax;
  const repMin = opts.repMin ?? base.repMin ?? repMax;
  const nSets = opts.sets ?? base.defaultSets ?? 3;
  const target = { sets: nSets, repMin, repMax, restSec: opts.restSec ?? base.restSec };
  if (base.kind === 'cardio') return { id: uid(), name: base.name, kind: 'cardio', exerciseId: base.id, sets: [], cardio: {}, target };
  const sug = repMin !== undefined && repMax !== undefined
    ? suggestNext(lastPerformance(history, base.name), repMin, repMax, base.incrementKg ?? 2.5, base.kind === 'bodyweight')
    : null;
  return {
    id: uid(), name: base.name, kind: base.kind, exerciseId: base.id, target,
    sets: Array.from({ length: Math.max(1, nSets) }, () => ({ id: uid(), reps: sug?.reps ?? repMax, weightKg: sug?.weightKg, done: false }))
  };
}

export function fromTemplateExercise(e: TemplateExercise, history: Workout[], custom: CustomExercise[] = []): WorkoutExercise {
  const lib = findExercise(e.exerciseId ?? e.name, custom);
  return makeExercise({ ...lib, name: e.name, kind: e.kind, id: lib?.id ?? e.exerciseId }, history, { sets: e.targetSets, repMin: e.repMin ?? e.targetReps, repMax: e.targetReps, restSec: e.restSec ?? lib?.restSec });
}

export function workoutFromTemplate(tpl: WorkoutTemplate, history: Workout[] = [], custom: CustomExercise[] = []): Omit<Workout, 'id' | 'createdAt' | 'updatedAt'> {
  return { status: 'active', type: tpl.type, title: tpl.name, startedAt: nowLocal(), date: today(), templateId: tpl.id, exercises: tpl.exercises.map((e) => fromTemplateExercise(e, history, custom)) };
}

/** Parse template lines: "Name, 4x8", "Name, 4x8-12", "Name; cardio". Names matching the library keep their id. */
export function parseTemplateLines(text: string, custom: CustomExercise[] = []): TemplateExercise[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const cardio = /;\s*(cardio|καρδιο)/i.test(l);
    const m = l.match(/^(.*?)[,;]\s*(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*$/i);
    const name = (m ? m[1] : l.replace(/[;,].*$/, '')).trim();
    const lib = findExercise(name, custom);
    const kind = cardio ? 'cardio' : lib?.kind ?? 'resistance';
    if (m) {
      const lo = Number(m[3]), hi = m[4] ? Number(m[4]) : lo;
      return { name, kind, targetSets: Number(m[2]), repMin: Math.min(lo, hi), targetReps: Math.max(lo, hi), exerciseId: lib?.id, restSec: lib?.restSec };
    }
    return { name, kind, targetSets: cardio ? 0 : lib?.defaultSets ?? 3, repMin: lib?.repMin, targetReps: lib?.repMax, exerciseId: lib?.id, restSec: lib?.restSec };
  });
}
