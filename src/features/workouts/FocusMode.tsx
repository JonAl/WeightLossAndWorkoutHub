import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Calculator } from 'lucide-react';
import { useI18n } from '../../i18n';
import { ExerciseFigure } from '../../components/ExerciseFigure';
import { findExercise } from '../../training/exercises';
import type { CustomExercise, Workout, WorkoutExercise, WorkoutSet } from '../../types';
import { weightFromDisplay, weightToDisplay } from '../../utils/units';
import { ExerciseHints } from './ExerciseHints';

/**
 * GymApp-style "live workout": one exercise at a time, big steppers, "Set X of Y",
 * and a single large Complete-set button. Data is the same workout as the list view.
 */
export function FocusMode({ w, history, custom, updSet, onSetDone, onPlates }: {
  w: Workout; history: Workout[]; custom: CustomExercise[];
  updSet: (exId: string, setId: string, patch: Partial<WorkoutSet>) => void;
  onSetDone: (ex: WorkoutExercise, setIndex: number) => void;
  onPlates: (displayWeight?: number) => void;
}) {
  const i = useI18n();
  const { t, units } = i;
  const firstOpen = Math.max(0, w.exercises.findIndex((e) => e.kind !== 'cardio' && e.sets.some((s) => !s.done)));
  const [idx, setIdx] = useState(firstOpen);
  const ex = w.exercises[Math.min(idx, w.exercises.length - 1)];
  if (!ex) return <p className="text-sm muted">{t('focus.empty')}</p>;
  const lib = findExercise(ex.exerciseId ?? ex.name, custom);
  const setIndex = ex.sets.findIndex((s) => !s.done);
  const cur = setIndex >= 0 ? ex.sets[setIndex] : undefined;
  const stepW = units === 'imperial' ? 5 : lib && lib.incrementKg > 0 ? Math.min(lib.incrementKg, 2.5) : 2.5;
  const dispW = cur?.weightKg !== undefined ? Math.round(weightToDisplay(cur.weightKg, units) * 100) / 100 : 0;
  const setWeight = (v: number) => cur && updSet(ex.id, cur.id, { weightKg: v <= 0 ? undefined : weightFromDisplay(v, units) });
  const setReps = (v: number) => cur && updSet(ex.id, cur.id, { reps: Math.max(0, v) });
  const target = ex.target;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button className="btn-icon" aria-label={t('focus.prev')} disabled={idx <= 0} onClick={() => setIdx(idx - 1)}><ChevronLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">{t('focus.exerciseOf', { n: idx + 1, total: w.exercises.length })}</p>
          <h2 className="truncate text-2xl font-bold">{ex.name}</h2>
          {ex.kind !== 'cardio' && <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">{cur ? t('focus.setOf', { n: setIndex + 1, total: ex.sets.length }) : t('focus.allDone')}</p>}
        </div>
        <button className="btn-icon" aria-label={t('focus.next')} disabled={idx >= w.exercises.length - 1} onClick={() => setIdx(idx + 1)}><ChevronRight className="h-5 w-5" /></button>
      </div>

      <ExerciseFigure pattern={lib?.pattern ?? (ex.kind === 'cardio' ? 'cardio' : 'curl')} size="lg" label={ex.name} />
      <ExerciseHints ex={ex} history={history} excludeId={w.id} custom={custom} />

      {ex.kind === 'cardio' ? (
        <p className="text-sm muted">{t('focus.cardioHint')}</p>
      ) : cur ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stepper label={i.wUnit.toUpperCase()} value={dispW ? i.num(dispW, 2) : '—'} onMinus={() => setWeight(Math.max(0, dispW - stepW))} onPlus={() => setWeight(dispW + stepW)} step={i.num(stepW, 2)} minusLabel={t('focus.lessWeight')} plusLabel={t('focus.moreWeight')} />
            <Stepper label={t('focus.reps')} value={String(cur.reps ?? 0)} onMinus={() => setReps((cur.reps ?? 0) - 1)} onPlus={() => setReps((cur.reps ?? 0) + 1)} step="1" minusLabel={t('focus.lessReps')} plusLabel={t('focus.moreReps')} />
          </div>
          {target?.repMin !== undefined && <p className="text-center text-xs muted">{t('focus.target', { min: target.repMin, max: target.repMax ?? target.repMin })}</p>}
          <div className="flex gap-2">
            {ex.kind === 'resistance' && <button className="btn-secondary" onClick={() => onPlates(dispW || undefined)} aria-label={t('plates.title')}><Calculator className="h-4 w-4" /></button>}
            <button className="btn-primary h-14 flex-1 text-base" onClick={() => {
              updSet(ex.id, cur.id, { done: true });
              // Carry weight/reps into the next set if it is still empty, like GymApp's stepper flow.
              const next = ex.sets[setIndex + 1];
              if (next && !next.done && next.weightKg === undefined && cur.weightKg !== undefined) updSet(ex.id, next.id, { weightKg: cur.weightKg, reps: next.reps ?? cur.reps });
              onSetDone(ex, setIndex);
              if (setIndex === ex.sets.length - 1 && idx < w.exercises.length - 1) setIdx(idx + 1);
            }}>
              <Check className="h-5 w-5" />{setIndex < ex.sets.length - 1 ? t('focus.completeSet') : t('focus.finishExercise')}
            </button>
          </div>
        </>
      ) : (
        <p className="rounded-xl bg-teal-50 p-3 text-center text-sm font-medium text-teal-900 dark:bg-teal-500/10 dark:text-teal-200">{t('focus.exerciseDone')}</p>
      )}
      <div className="flex justify-center gap-1.5" aria-hidden>
        {w.exercises.map((e, k) => <span key={e.id} className={`h-2 rounded-full transition-all ${k === idx ? 'w-6 bg-teal-500' : e.sets.length && e.sets.every((s) => s.done) ? 'w-2 bg-teal-300' : 'w-2 bg-slate-300 dark:bg-navy-600'}`} />)}
      </div>
    </div>
  );
}

function Stepper({ label, value, onMinus, onPlus, step, minusLabel, plusLabel }: { label: string; value: string; onMinus: () => void; onPlus: () => void; step: string; minusLabel: string; plusLabel: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 p-3">
      <span className="text-xs font-semibold tracking-wide muted">{label}</span>
      <span className="text-3xl font-bold tabular-nums" aria-live="polite">{value}</span>
      <div className="flex w-full gap-2">
        <button className="btn-secondary h-12 flex-1" aria-label={`${minusLabel} (${step})`} onClick={onMinus}><Minus className="h-5 w-5" /></button>
        <button className="btn-secondary h-12 flex-1" aria-label={`${plusLabel} (${step})`} onClick={onPlus}><Plus className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
