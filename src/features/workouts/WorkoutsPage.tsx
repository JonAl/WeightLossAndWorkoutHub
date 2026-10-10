import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Dumbbell, Play, Plus, Trash2, Trophy, LayoutTemplate, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { useCustomExercises, useTemplates, useWorkouts } from '../../hooks/useData';
import { workoutFromTemplate, parseTemplateLines } from '../../training/workoutOps';
import { LibraryTab } from './LibraryTab';
import { PlanTab } from './PlanTab';
import { Badge, Card, EmptyState, Field, Input, PageHeader, ProgressBar, Segmented, Select, Textarea } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { TargetBarChart, SimpleLineChart } from '../../components/charts';
import { useConfirm, useToast } from '../../components/feedback';
import { addTemplate, addWorkout, deleteTemplate, deleteWorkout, updateTemplate } from '../../db/repositories';
import { addDays, nowLocal, today, weekStart } from '../../utils/date';
import { uid } from '../../utils/id';
import { cardioTotals, completedSets, exerciseNames, exerciseProgression, personalRecords, weeklyWorkoutCounts, workoutVolume } from '../../analytics/workouts';
import { WORKOUT_TYPES, type Workout, type WorkoutTemplate, type WorkoutType } from '../../types';

export function newSet(prev?: { reps?: number; weightKg?: number }) {
  return { id: uid(), reps: prev?.reps, weightKg: prev?.weightKg, done: false };
}

export function duplicateWorkout(w: Workout): Omit<Workout, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    status: 'active', type: w.type, title: w.title, startedAt: nowLocal(), date: today(), templateId: w.templateId,
      exercises: w.exercises.map((e) => ({ ...e, id: uid(), sets: e.sets.map((s) => ({ ...s, id: uid(), done: false })), cardio: e.cardio ? { ...e.cardio } : undefined }))
  };
}

export function WorkoutsPage() {
  const i = useI18n();
  const { t, td } = i;
  const { profile } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const workouts = useWorkouts(), templates = useTemplates(), custom = useCustomExercises();
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<'history' | 'plan' | 'library' | 'templates' | 'records'>(() => (params.get('tab') as 'library') ?? 'history');
  const [chooser, setChooser] = useState(false);
  const [tplEditor, setTplEditor] = useState<WorkoutTemplate | 'new' | null>(null);
  const [prExercise, setPrExercise] = useState('');

  useEffect(() => {
    if (params.get('start') === '1') { setChooser(true); setParams({}, { replace: true }); }
    const tp = params.get('tab'); if (tp) { setTab(tp as typeof tab); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const stats = useMemo(() => {
    if (!workouts) return null;
    const counts = weeklyWorkoutCounts(workouts);
    const ws = weekStart(today());
    return {
      thisWeek: counts.get(ws) ?? 0,
      weeks: Array.from({ length: 8 }, (_, k) => addDays(ws, -7 * (7 - k))).map((w) => ({ date: w, value: counts.get(w) ?? 0 })),
      completed: workouts.filter((w) => w.status === 'completed').sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt)),
      active: workouts.find((w) => w.status === 'active'),
      prs: personalRecords(workouts),
      names: exerciseNames(workouts)
    };
  }, [workouts]);
  if (!stats || !templates || !custom) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;

  const start = async (w: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (stats.active) { toast(t('workout.alreadyActive'), 'info'); nav(`/workouts/${stats.active.id}`); return; }
    const r = await addWorkout(w);
    setChooser(false);
    nav(`/workouts/${r.id}`);
  };
  const startEmpty = (type: WorkoutType) => start({ status: 'active', type, title: td(`workout.type.${type}`), startedAt: nowLocal(), date: today(), exercises: [] });
  const prEx = prExercise || stats.names[0] || '';
  const prog = prEx && workouts ? exerciseProgression(workouts, prEx) : [];

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.workouts')} actions={stats.active
        ? <button className="btn-primary" onClick={() => nav(`/workouts/${stats.active!.id}`)}><Play className="h-4 w-4" />{t('workout.resume')}</button>
        : <button className="btn-primary" onClick={() => setChooser(true)}><Plus className="h-4 w-4" />{t('workout.start')}</button>} />

      <Card title={t('workout.thisWeek')}>
        <p className="mb-2 text-xl font-bold tabular-nums">{stats.thisWeek} <span className="text-sm font-normal muted">/ {profile.weeklyWorkoutTarget} {t('workout.sessions')}</span></p>
        <ProgressBar value={stats.thisWeek} max={profile.weeklyWorkoutTarget} label={t('workout.thisWeek')} />
      </Card>
      {stats.completed.length > 0 && <TargetBarChart data={stats.weeks} target={profile.weeklyWorkoutTarget} title={t('workout.frequency')} subtitle={t('workout.frequencySub')} unit={t('workout.sessions')} seriesName={t('workout.sessions')} height={180} />}

      <div className="-mx-4 overflow-x-auto px-4"><Segmented label={t('workout.tabs')} value={tab} onChange={setTab} options={[{ value: 'history', label: t('workout.history') }, { value: 'plan', label: t('workout.plan') }, { value: 'library', label: t('workout.library') }, { value: 'templates', label: t('workout.templates') }, { value: 'records', label: t('workout.records') }]} /></div>

      {tab === 'plan' && <PlanTab />}
      {tab === 'library' && <LibraryTab />}

      {tab === 'history' && (stats.completed.length === 0 ? (
        <EmptyState icon={Dumbbell} title={t('workout.emptyTitle')} body={t('workout.emptyBody')} action={<button className="btn-primary" onClick={() => setChooser(true)}>{t('workout.start')}</button>} />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-navy-800">
            {stats.completed.map((w) => {
              const c = cardioTotals(w);
              const vol = workoutVolume(w);
              return (
                <li key={w.id} className="flex items-center gap-2 py-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => nav(`/workouts/${w.id}`)}>
                    <p className="truncate font-medium">{w.title} <Badge>{td(`workout.type.${w.type}`)}</Badge></p>
                    <p className="text-xs muted tabular-nums">{i.date(w.date)} · {t('workout.setsN', { n: completedSets(w) })}{vol > 0 ? ` · ${t('workout.volume')} ${i.weight(vol, 0)}` : ''}{c.durationMin > 0 ? ` · ${t('workout.cardioSummary', { min: i.num(c.durationMin, 0), km: i.num(c.distanceKm) })}` : ''}{w.durationMin ? ` · ${i.num(w.durationMin, 0)} min` : ''}</p>
                  </button>
                  <button className="btn-icon" aria-label={t('workout.duplicate')} title={t('workout.duplicate')} onClick={() => start(duplicateWorkout(w))}><Copy className="h-4 w-4" /></button>
                  <button className="btn-icon text-red-600" aria-label={t('common.delete')} onClick={async () => { if (await confirm({ title: t('confirm.deleteTitle'), body: t('confirm.deleteBody'), danger: true, confirmLabel: t('common.delete') })) { await deleteWorkout(w.id); toast(t('toast.deleted')); } }}><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {tab === 'templates' && (
        <div className="space-y-3">
          <button className="btn-secondary" onClick={() => setTplEditor('new')}><Plus className="h-4 w-4" />{t('workout.newTemplate')}</button>
          {templates.length === 0 ? <EmptyState icon={LayoutTemplate} title={t('workout.noTemplates')} /> : (
            <Card>
              <ul className="divide-y divide-slate-100 dark:divide-navy-800">
                {templates.map((tpl) => (
                  <li key={tpl.id} className="flex items-center gap-2 py-2">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setTplEditor(tpl)}><p className="font-medium">{tpl.name} <Badge>{td(`workout.type.${tpl.type}`)}</Badge></p><p className="truncate text-xs muted">{tpl.exercises.map((e) => e.name).join(' · ')}</p></button>
                    <button className="btn-secondary min-h-[36px] px-3 text-xs" onClick={() => start(workoutFromTemplate(tpl, workouts ?? [], custom))}><Play className="h-3.5 w-3.5" />{t('workout.startShort')}</button>
                    <button className="btn-icon text-red-600" aria-label={t('common.delete')} onClick={async () => { if (await confirm({ title: t('confirm.deleteTitle'), body: t('workout.deleteTemplateBody'), danger: true, confirmLabel: t('common.delete') })) { await deleteTemplate(tpl.id); toast(t('toast.deleted')); } }}><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === 'records' && (stats.prs.length === 0 ? <EmptyState icon={Trophy} title={t('workout.noRecords')} body={t('workout.noRecordsBody')} /> : (
        <div className="space-y-3">
          <Card title={t('workout.records')} subtitle={t('workout.est1RMNote')}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead className="text-left text-xs muted"><tr><th className="py-1 font-medium">{t('workout.exercise')}</th><th className="font-medium">{t('workout.heaviest')}</th><th className="font-medium">{t('workout.est1RM')}</th><th className="font-medium">{t('workout.bestVolume')}</th></tr></thead>
                <tbody className="tabular-nums">{stats.prs.map((p) => (
                  <tr key={p.exercise} className="border-t border-slate-100 dark:border-navy-800">
                    <td className="py-1.5 font-medium">{p.exercise}</td>
                    <td>{i.weight(p.maxWeightKg)} × {p.maxWeightReps}<span className="block text-xs muted">{i.shortDate(p.maxWeightDate)}</span></td>
                    <td>{i.weight(p.best1RM)}<span className="block text-xs muted">{i.shortDate(p.best1RMDate)}</span></td>
                    <td>{i.weight(p.bestVolume, 0)}<span className="block text-xs muted">{i.shortDate(p.bestVolumeDate)}</span></td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title={t('analytics.exerciseProgression')} action={<Select aria-label={t('workout.exercise')} className="min-h-[36px] w-44 py-1 text-sm" value={prEx} onChange={(e) => setPrExercise(e.target.value)}>{stats.names.map((n) => <option key={n}>{n}</option>)}</Select>}>
            {prog.length >= 2 ? <div className="-mx-4 -mb-4"><SimpleLineChart data={prog.map((p) => ({ date: p.date, value: i.weightValue(p.topSetKg) }))} title={`${prEx} · ${t('workout.topSet')}`} unit={i.wUnit} seriesName={t('workout.topSet')} /></div> : <p className="text-sm muted">{t('analytics.progressionInsufficient')}</p>}
          </Card>
        </div>
      ))}

      <Modal open={chooser} onClose={() => setChooser(false)} title={t('workout.start')}>
        <div className="space-y-4">
          {templates.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t('workout.fromTemplate')}</h3>
              <ul className="space-y-2">{templates.map((tpl) => (
                <li key={tpl.id}><button className="btn-secondary w-full justify-between" onClick={() => start(workoutFromTemplate(tpl, workouts ?? [], custom))}><span>{tpl.name} · {tpl.exercises.length}</span><ChevronRight className="h-4 w-4" /></button></li>
              ))}</ul>
            </div>
          )}
          {stats.completed[0] && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t('workout.repeatLast')}</h3>
              <button className="btn-secondary w-full justify-between" onClick={() => start(duplicateWorkout(stats.completed[0]))}><span>{stats.completed[0].title} · {i.shortDate(stats.completed[0].date)}</span><Copy className="h-4 w-4" /></button>
            </div>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t('workout.emptySession')}</h3>
            <div className="grid grid-cols-2 gap-2">{WORKOUT_TYPES.map((ty) => <button key={ty} className="btn-secondary" onClick={() => startEmpty(ty)}>{td(`workout.type.${ty}`)}</button>)}</div>
          </div>
        </div>
      </Modal>
      <TemplateEditor value={tplEditor} onClose={() => setTplEditor(null)} />
    </div>
  );
}

function TemplateEditor({ value, onClose }: { value: WorkoutTemplate | 'new' | null; onClose: () => void }) {
  const { t, td } = useI18n();
  const toast = useToast();
  const custom = useCustomExercises() ?? [];
  const cur = value && value !== 'new' ? value : null;
  const [name, setName] = useState('');
  const [type, setType] = useState<WorkoutType>('fullBody');
  const [lines, setLines] = useState('');
  const [error, setError] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const k = value === null ? null : cur?.id ?? 'new';
  if (k !== key) {
    setKey(k); setError('');
    setName(cur?.name ?? ''); setType(cur?.type ?? 'fullBody');
    setLines(cur ? cur.exercises.map((e) => e.kind === 'cardio' ? `${e.name}; cardio` : `${e.name}, ${e.targetSets}x${e.repMin && e.repMin !== e.targetReps ? `${e.repMin}-` : ''}${e.targetReps ?? 10}`).join('\n') : '');
  }
  const save = async () => {
    const exercises = parseTemplateLines(lines, custom);
    if (!name.trim() || exercises.length === 0) { setError(t('val.required')); return; }
    if (cur) await updateTemplate(cur.id, { name: name.trim(), type, exercises });
    else await addTemplate({ name: name.trim(), type, exercises });
    toast(t('toast.saved'));
    onClose();
  };
  return (
    <Modal open={value !== null} onClose={onClose} title={cur ? t('workout.editTemplate') : t('workout.newTemplate')} footer={<><button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" onClick={save}>{t('common.save')}</button></>}>
      <div className="space-y-3">
        <Field label={t('workout.templateName')} htmlFor="tpl-name" error={error && !name.trim() ? error : undefined}><Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t('workout.type')} htmlFor="tpl-type"><Select id="tpl-type" value={type} onChange={(e) => setType(e.target.value as WorkoutType)}>{WORKOUT_TYPES.map((x) => <option key={x} value={x}>{td(`workout.type.${x}`)}</option>)}</Select></Field>
        <Field label={t('workout.templateExercises')} htmlFor="tpl-lines" hint={t('workout.templateHint')} error={error && name.trim() ? error : undefined}><Textarea id="tpl-lines" rows={7} value={lines} onChange={(e) => setLines(e.target.value)} placeholder={'Bench Press, 4x6-10\nLat Pulldown, 3x8-12\nTreadmill Walk / Run; cardio'} /></Field>
      </div>
    </Modal>
  );
}
