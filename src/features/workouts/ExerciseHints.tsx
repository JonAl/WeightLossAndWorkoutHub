import { History, TrendingUp } from 'lucide-react';
import { useI18n } from '../../i18n';
import { findExercise } from '../../training/exercises';
import { lastPerformance, suggestNext, summarizeSets } from '../../training/progression';
import type { CustomExercise, Workout, WorkoutExercise } from '../../types';

/** "Last time" + progression suggestion for one exercise in the logger. */
export function ExerciseHints({ ex, history, excludeId, custom }: { ex: WorkoutExercise; history: Workout[]; excludeId: string; custom: CustomExercise[] }) {
  const i = useI18n();
  const { t, td } = i;
  if (ex.kind === 'cardio') return null;
  const lib = findExercise(ex.exerciseId ?? ex.name, custom);
  const last = lastPerformance(history, ex.name, excludeId);
  const repMin = ex.target?.repMin ?? lib?.repMin, repMax = ex.target?.repMax ?? lib?.repMax;
  const sug = repMin !== undefined && repMax !== undefined ? suggestNext(last, repMin, repMax, lib?.incrementKg ?? 2.5, ex.kind === 'bodyweight') : null;
  if (!last && !ex.target) return null;
  return (
    <div className="space-y-0.5 text-xs">
      {ex.target?.sets !== undefined && repMin !== undefined && <p className="muted">{t('hints.target', { sets: ex.target.sets, min: repMin, max: repMax ?? repMin })}{ex.target.restSec ? ` · ${t('lib.rest', { s: ex.target.restSec })}` : ''}</p>}
      {last && <p className="muted"><History aria-hidden className="mr-1 inline h-3.5 w-3.5" />{t('hints.last', { date: i.shortDate(last.date), sets: summarizeSets(last.sets, (w) => i.weight(w)) })}</p>}
      {sug && (
        <p className="font-medium text-teal-700 dark:text-teal-400">
          <TrendingUp aria-hidden className="mr-1 inline h-3.5 w-3.5" />
          {td(`hints.sug.${sug.reason}`, { w: sug.weightKg !== undefined ? i.weight(sug.weightKg) : '', reps: sug.reps })}
        </p>
      )}
    </div>
  );
}
