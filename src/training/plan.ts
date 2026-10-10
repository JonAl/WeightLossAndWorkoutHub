import type { TrainingProgram, Workout, WorkoutTemplate } from '../types';
import { parseDateKey } from '../utils/date';

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (dateKey: string) => (parseDateKey(dateKey).getDay() + 6) % 7;

export function activeProgram(programs: TrainingProgram[]): TrainingProgram | undefined {
  return programs.find((p) => p.active) ?? programs[0];
}

export function plannedTemplate(program: TrainingProgram | undefined, templates: WorkoutTemplate[], dateKey: string): WorkoutTemplate | null {
  if (!program) return null;
  const id = program.days[weekdayIndex(dateKey)];
  return (id && templates.find((t) => t.id === id)) || null;
}

/** Number of training days in the weekly plan. */
export const plannedDaysPerWeek = (p: TrainingProgram | undefined) => (p ? p.days.filter(Boolean).length : 0);

/**
 * Rough session length: each set ≈ 40 s of work + rest (template rest or default),
 * cardio uses its rep range upper value as minutes.
 */
export function estimateMinutes(t: WorkoutTemplate, defaultRestSec: number): number {
  let sec = 0;
  for (const e of t.exercises) {
    if (e.kind === 'cardio') sec += (e.targetReps ?? 20) * 60;
    else sec += e.targetSets * (40 + (e.restSec ?? defaultRestSec));
  }
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

export function workoutsByDate(ws: Workout[]): Map<string, Workout[]> {
  const m = new Map<string, Workout[]>();
  for (const w of ws) if (w.status === 'completed') m.set(w.date, [...(m.get(w.date) ?? []), w]);
  return m;
}

/** Calendar grid (Monday-first) for the month containing `anchor`. Null = padding cell. */
export function monthGrid(anchor: string): (string | null)[] {
  const d = parseDateKey(anchor);
  const first = new Date(d.getFullYear(), d.getMonth(), 1, 12);
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).getDate();
  const pad = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array(pad).fill(null);
  const p2 = (n: number) => String(n).padStart(2, '0');
  for (let i = 1; i <= days; i++) cells.push(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(i)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
