import { EXERCISE_LIBRARY, LIBRARY_BY_ID } from '../data/exercises';
import type { CustomExercise, LibraryExercise } from '../types';
import { normalizeExercise } from '../analytics/workouts';

/** Built-in + custom exercises. Custom ones override built-ins with the same id. */
export function allExercises(custom: CustomExercise[] = []): LibraryExercise[] {
  const ids = new Set(custom.map((c) => c.id));
  return [...EXERCISE_LIBRARY.filter((e) => !ids.has(e.id)), ...custom].sort((a, b) => a.name.localeCompare(b.name));
}

export function findExercise(nameOrId: string | undefined, custom: CustomExercise[] = []): LibraryExercise | undefined {
  if (!nameOrId) return undefined;
  const byId = custom.find((c) => c.id === nameOrId) ?? LIBRARY_BY_ID.get(nameOrId);
  if (byId) return byId;
  const n = normalizeExercise(nameOrId);
  return allExercises(custom).find((e) => normalizeExercise(e.name) === n);
}

export function searchExercises(list: LibraryExercise[], query: string, category: string, muscleLabel: (m: string) => string): LibraryExercise[] {
  const q = query.trim().toLowerCase();
  return list.filter((e) =>
    (category === 'all' || e.category === category) &&
    (!q || e.name.toLowerCase().includes(q) || [...e.primary, ...e.secondary].some((m) => muscleLabel(m).toLowerCase().includes(q)))
  );
}
