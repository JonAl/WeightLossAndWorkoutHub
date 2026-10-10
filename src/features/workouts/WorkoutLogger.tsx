import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, CheckCircle2, Plus, Save, Trash2, X, LayoutTemplate, ArrowLeft, Timer } from 'lucide-react';
import { useI18n } from '../../i18n';
import { db } from '../../db/schema';
import { addTemplate, deleteWorkout, saveWorkout } from '../../db/repositories';
import { useWorkouts } from '../../hooks/useData';
import { Card, Field, Input, Select, Textarea, cx, parseOptNum } from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { uid } from '../../utils/id';
import { parseLocalDateTime, nowLocal } from '../../utils/date';
import { exerciseNames, exerciseVolume, workoutVolume } from '../../analytics/workouts';
import { WORKOUT_TYPES, type ExerciseKind, type Workout, type WorkoutExercise, type WorkoutSet } from '../../types';
import { weightFromDisplay, weightToDisplay } from '../../utils/units';
import { newSet } from './WorkoutsPage';

/** Phone-first logger. Every change is persisted to IndexedDB (debounced), so leaving the page never loses input. */
export function WorkoutLogger() {
  const { id } = useParams();
  const i = useI18n();
  const { t, td, units } = i;
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const all = useWorkouts();
  const [w, setW] = useState<Workout | null | undefined>(undefined);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<ExerciseKind>('resistance');
  const [now, setNow] = useState(Date.now());
  const loaded = useRef(false);
  const saveTimer = useRef<number>();

  useEffect(() => { db.workouts.get(id!).then((x) => { setW(x ?? null); loaded.current = true; }); }, [id]);
  useEffect(() => {
    if (!w || !loaded.current) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { saveWorkout(w).catch(() => toast(t('toast.saveFailed'), 'error')); }, 400);
  }, [w, t, toast]);
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);
  useEffect(() => { if (w?.status !== 'active') return; const h = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(h); }, [w?.status]);

  if (w === undefined) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;
  if (w === null) return <div className="space-y-3 p-2"><p>{t('workout.notFound')}</p><button className="btn-secondary" onClick={() => nav('/workouts')}>{t('common.back')}</button></div>;

  const known = all ? exerciseNames(all) : [];
  const upd = (patch: Partial<Workout>) => setW({ ...w, ...patch });
  const updEx = (exId: string, f: (e: WorkoutExercise) => WorkoutExercise) => upd({ exercises: w.exercises.map((e) => (e.id === exId ? f(e) : e)) });
  const updSet = (exId: string, setId: string, patch: Partial<WorkoutSet>) => updEx(exId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));
  const elapsedMin = Math.max(0, Math.round((now - parseLocalDateTime(w.startedAt).getTime()) / 60000));
  const disp = (kg?: number) => (kg === undefined ? '' : String(Math.round(weightToDisplay(kg, units) * 100) / 100));

  const addExercise = () => {
    if (!newName.trim()) return;
    upd({ exercises: [...w.exercises, { id: uid(), name: newName.trim(), kind: newKind, sets: newKind === 'cardio' ? [] : [newSet()], cardio: newKind === 'cardio' ? {} : undefined }] });
    setNewName('');
  };

  const complete = async () => {
    const done = w.exercises.some((e) => e.sets.some((s) => s.done) || (e.kind === 'cardio' && (e.cardio?.durationMin ?? 0) > 0));
    if (!done && !(await confirm({ title: t('workout.completeEmptyTitle'), body: t('workout.completeEmptyBody') }))) return;
    const finished: Workout = { ...w, status: 'completed', completedAt: nowLocal(), durationMin: w.durationMin ?? elapsedMin };
    window.clearTimeout(saveTimer.current);
    await saveWorkout(finished);
    toast(t('workout.completed'));
    nav('/workouts');
  };
  const discard = async () => {
    if (!(await confirm({ title: t('workout.discardTitle'), body: t('workout.discardBody'), danger: true, confirmLabel: t('common.delete') }))) return;
    window.clearTimeout(saveTimer.current);
    await deleteWorkout(w.id);
    toast(t('toast.deleted'));
    nav('/workouts');
  };
  const saveAsTemplate = async () => {
    await addTemplate({ name: w.title, type: w.type, exercises: w.exercises.map((e) => ({ name: e.name, kind: e.kind, targetSets: e.sets.length, targetReps: e.sets[0]?.reps })) });
    toast(t('workout.templateSaved'));
  };

  return (
    <div className="space-y-3 pb-24">
      <div className="flex items-center gap-2">
        <button className="btn-icon" aria-label={t('common.back')} onClick={() => nav('/workouts')}><ArrowLeft className="h-5 w-5" /></button>
        <Input aria-label={t('workout.title')} value={w.title} onChange={(e) => upd({ title: e.target.value })} className="text-lg font-semibold" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select aria-label={t('workout.type')} className="w-auto min-h-[36px] py-1 text-sm" value={w.type} onChange={(e) => upd({ type: e.target.value as Workout['type'] })}>{WORKOUT_TYPES.map((x) => <option key={x} value={x}>{td(`workout.type.${x}`)}</option>)}</Select>
        <input type="date" aria-label={t('common.date')} className="input w-auto min-h-[36px] py-1 text-sm" value={w.date} onChange={(e) => e.target.value && upd({ date: e.target.value })} />
        {w.status === 'active'
          ? <span className="inline-flex items-center gap-1 muted"><Timer className="h-4 w-4" />{t('workout.elapsed', { min: elapsedMin })}</span>
          : <label className="inline-flex items-center gap-1">{t('workout.duration')}<input className="input w-20 min-h-[36px] py-1 text-sm" inputMode="numeric" value={w.durationMin ?? ''} onChange={(e) => upd({ durationMin: parseOptNum(e.target.value) })} /> min</label>}
        <span className="muted">· {t('workout.volume')} {i.weight(workoutVolume(w), 0)}</span>
      </div>

      {w.exercises.map((ex) => (
        <Card key={ex.id} title={ex.name} subtitle={`${td(`workout.kind.${ex.kind}`)}${ex.kind === 'resistance' ? ` · ${t('workout.volume')} ${i.weight(exerciseVolume(ex) ?? 0, 0)}` : ''}`}
          action={<button className="btn-icon text-red-600" aria-label={t('workout.removeExercise', { name: ex.name })} onClick={async () => { if (await confirm({ title: t('workout.removeExerciseTitle'), body: ex.name, danger: true, confirmLabel: t('common.delete') })) upd({ exercises: w.exercises.filter((e) => e.id !== ex.id) }); }}><Trash2 className="h-4 w-4" /></button>}>
          {ex.kind === 'cardio' ? (
            <div className="grid grid-cols-3 gap-2">
              <Field label={t('workout.cardioType')} htmlFor={`ct-${ex.id}`}><Input id={`ct-${ex.id}`} value={ex.cardio?.cardioType ?? ''} onChange={(e) => updEx(ex.id, (x) => ({ ...x, cardio: { ...x.cardio, cardioType: e.target.value } }))} /></Field>
              <Field label={t('workout.durationMin')} htmlFor={`cd-${ex.id}`}><Input id={`cd-${ex.id}`} inputMode="decimal" value={ex.cardio?.durationMin ?? ''} onChange={(e) => updEx(ex.id, (x) => ({ ...x, cardio: { ...x.cardio, durationMin: parseOptNum(e.target.value) } }))} /></Field>
              <Field label={t('workout.distanceKm')} htmlFor={`ck-${ex.id}`}><Input id={`ck-${ex.id}`} inputMode="decimal" value={ex.cardio?.distanceKm ?? ''} onChange={(e) => updEx(ex.id, (x) => ({ ...x, cardio: { ...x.cardio, distanceKm: parseOptNum(e.target.value) } }))} /></Field>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[2rem_1fr_1fr_3.5rem_3rem_2.75rem] items-center gap-1.5 text-xs font-medium muted">
                <span>#</span><span>{t('workout.reps')}</span><span>{ex.kind === 'resistance' ? i.wUnit : t('workout.addedLoad')}</span><span>RPE</span><span>{t('workout.restShort')}</span><span className="sr-only">{t('workout.done')}</span>
              </div>
              {ex.sets.map((s, idx) => (
                <div key={s.id} className={cx('mt-1.5 grid grid-cols-[2rem_1fr_1fr_3.5rem_3rem_2.75rem] items-center gap-1.5', s.done && 'opacity-70')}>
                  <button className="text-sm font-semibold text-slate-500 hover:text-red-600" aria-label={t('workout.removeSet', { n: idx + 1 })} onClick={() => updEx(ex.id, (x) => ({ ...x, sets: x.sets.filter((y) => y.id !== s.id) }))}>{idx + 1}</button>
                  <input className="input min-h-[44px] px-2 text-center" aria-label={`${t('workout.reps')} ${idx + 1}`} inputMode="numeric" value={s.reps ?? ''} onChange={(e) => updSet(ex.id, s.id, { reps: parseOptNum(e.target.value) })} />
                  <input className="input min-h-[44px] px-2 text-center" aria-label={`${i.wUnit} ${idx + 1}`} inputMode="decimal" defaultValue={disp(s.weightKg)} onBlur={(e) => { const v = parseOptNum(e.target.value); updSet(ex.id, s.id, { weightKg: v === undefined || !Number.isFinite(v) ? undefined : weightFromDisplay(v, units) }); }} />
                  <input className="input min-h-[44px] px-1 text-center" aria-label={`RPE ${idx + 1}`} inputMode="decimal" value={s.rpe ?? ''} onChange={(e) => updSet(ex.id, s.id, { rpe: parseOptNum(e.target.value) })} />
                  <input className="input min-h-[44px] px-1 text-center" aria-label={`${t('workout.rest')} ${idx + 1}`} inputMode="numeric" value={s.restSec ?? ''} onChange={(e) => updSet(ex.id, s.id, { restSec: parseOptNum(e.target.value) })} />
                  <button aria-label={t('workout.markDone', { n: idx + 1 })} aria-pressed={s.done} onClick={() => updSet(ex.id, s.id, { done: !s.done })}
                    className={cx('flex h-11 w-11 items-center justify-center rounded-xl border', s.done ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 dark:border-navy-600')}><Check className="h-5 w-5" /></button>
                </div>
              ))}
              <button className="btn-ghost mt-2 w-full" onClick={() => updEx(ex.id, (x) => ({ ...x, sets: [...x.sets, newSet(x.sets[x.sets.length - 1])] }))}><Plus className="h-4 w-4" />{t('workout.addSet')}</button>
              <p className="text-xs muted">{t('workout.restHint')}</p>
            </>
          )}
        </Card>
      ))}

      <Card title={t('workout.addExercise')}>
        <div className="flex flex-wrap gap-2">
          <Input aria-label={t('workout.exerciseName')} list="exercise-names" placeholder={t('workout.exerciseName')} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExercise(); } }} className="flex-1 min-w-[10rem]" />
          <datalist id="exercise-names">{known.map((n) => <option key={n} value={n} />)}</datalist>
          <Select aria-label={t('workout.kind')} className="w-auto" value={newKind} onChange={(e) => setNewKind(e.target.value as ExerciseKind)}>{(['resistance', 'bodyweight', 'cardio'] as const).map((k) => <option key={k} value={k}>{td(`workout.kind.${k}`)}</option>)}</Select>
          <button className="btn-secondary" onClick={addExercise} disabled={!newName.trim()}><Plus className="h-4 w-4" />{t('common.add')}</button>
        </div>
      </Card>

      <Field label={t('common.notes')} htmlFor="wk-notes"><Textarea id="wk-notes" value={w.notes ?? ''} onChange={(e) => upd({ notes: e.target.value })} /></Field>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={saveAsTemplate}><LayoutTemplate className="h-4 w-4" />{t('workout.saveAsTemplate')}</button>
        <button className="btn-ghost text-red-600" onClick={discard}><X className="h-4 w-4" />{w.status === 'active' ? t('workout.discard') : t('common.delete')}</button>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-navy-700 dark:bg-navy-900/95 md:bottom-0 md:left-64">
        {w.status === 'active'
          ? <button className="btn-primary w-full" onClick={complete}><CheckCircle2 className="h-5 w-5" />{t('workout.complete')}</button>
          : <button className="btn-primary w-full" onClick={async () => { window.clearTimeout(saveTimer.current); await saveWorkout(w); toast(t('toast.saved')); nav('/workouts'); }}><Save className="h-5 w-5" />{t('common.saveClose')}</button>}
      </div>
    </div>
  );
}
