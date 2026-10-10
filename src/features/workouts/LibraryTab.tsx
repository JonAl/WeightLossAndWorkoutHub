import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Dumbbell, Pencil, Plus, Search, Trash2, Play, ListPlus } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useCustomExercises, useTemplates, useWorkouts } from '../../hooks/useData';
import { Badge, Card, EmptyState, Field, Input, Select, Textarea, cx } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { ExerciseFigure } from '../../components/ExerciseFigure';
import { useConfirm, useToast } from '../../components/feedback';
import { allExercises, searchExercises } from '../../training/exercises';
import { lastPerformance, summarizeSets } from '../../training/progression';
import { makeExercise } from '../../training/workoutOps';
import { personalRecords, normalizeExercise } from '../../analytics/workouts';
import { addWorkout, deleteCustomExercise, saveCustomExercise, saveWorkout, updateTemplate } from '../../db/repositories';
import { EQUIPMENT, EXERCISE_CATEGORIES, type CustomExercise, type ExerciseCategory, type LibraryExercise, type Muscle, type MovementPattern } from '../../types';
import { nowLocal, today } from '../../utils/date';

const MUSCLES: Muscle[] = ['chest', 'upperBack', 'lats', 'traps', 'frontDelts', 'sideDelts', 'rearDelts', 'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abs', 'obliques', 'lowerBack', 'fullBody', 'cardio'];
const PATTERN_BY_CATEGORY: Record<ExerciseCategory, MovementPattern> = { chest: 'pushH', back: 'pullH', shoulders: 'pushV', legs: 'squat', arms: 'curl', core: 'core', cardio: 'cardio' };

export function LibraryTab() {
  const i = useI18n();
  const { t, td } = i;
  const custom = useCustomExercises();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | ExerciseCategory>('all');
  const [open, setOpen] = useState<LibraryExercise | null>(null);
  const [edit, setEdit] = useState<CustomExercise | 'new' | null>(null);
  const list = useMemo(() => searchExercises(allExercises(custom ?? []), q, cat, (m) => `${td(`muscle.${m}`)} ${m}`), [custom, q, cat, td]);
  if (!custom) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input aria-label={t('lib.search')} placeholder={t('lib.search')} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label={t('lib.category')}>
        {(['all', ...EXERCISE_CATEGORIES] as const).map((c) => (
          <button key={c} role="radio" aria-checked={cat === c} onClick={() => setCat(c)}
            className={cx('chip shrink-0', cat === c ? 'border-teal-600 bg-teal-600 text-white dark:border-teal-400 dark:bg-teal-500 dark:text-navy-950' : 'border-slate-300 dark:border-navy-600')}>
            {c === 'all' ? t('common.all') : td(`exCat.${c}`)}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs muted">{t('lib.count', { n: list.length })}</p>
        <button className="btn-secondary min-h-[36px] px-3 text-xs" onClick={() => setEdit('new')}><Plus className="h-3.5 w-3.5" />{t('lib.addCustom')}</button>
      </div>
      {list.length === 0 ? <EmptyState icon={Dumbbell} title={t('lib.none')} /> : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id}>
              <button className="card flex w-full items-center gap-3 p-2.5 text-left transition hover:border-teal-400" onClick={() => setOpen(e)}>
                <ExerciseFigure pattern={e.pattern} size="sm" animate={false} label={e.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.name} {e.custom && <Badge tone="info">{t('lib.custom')}</Badge>}</p>
                  <p className="truncate text-xs muted">{e.primary.map((m) => td(`muscle.${m}`)).join(' • ')}</p>
                  <p className="text-xs font-medium text-teal-700 dark:text-teal-400">{e.kind === 'cardio' ? t('lib.cardioMinutes', { min: e.repMin, max: e.repMax }) : `${e.defaultSets} × ${e.repMin}–${e.repMax}`} · {td(`equip.${e.equipment}`)}</p>
                </div>
                <ChevronRight aria-hidden className="h-5 w-5 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <ExerciseDetail ex={open} onClose={() => setOpen(null)} onEdit={(c) => { setOpen(null); setEdit(c); }} />}
      <CustomExerciseEditor value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function ExerciseDetail({ ex, onClose, onEdit }: { ex: LibraryExercise; onClose: () => void; onEdit: (c: CustomExercise) => void }) {
  const i = useI18n();
  const { t, td, lang } = i;
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const workouts = useWorkouts() ?? [];
  const templates = useTemplates() ?? [];
  const [tplId, setTplId] = useState('');
  const active = workouts.find((w) => w.status === 'active');
  const last = lastPerformance(workouts, ex.name, active?.id);
  const pr = personalRecords(workouts).find((p) => normalizeExercise(p.exercise) === normalizeExercise(ex.name));
  const cues = ex.cues?.[lang] ?? [];

  const addToActive = async () => {
    if (!active) return;
    await saveWorkout({ ...active, exercises: [...active.exercises, makeExercise(ex, workouts)] });
    toast(t('lib.addedToWorkout'));
    onClose();
    nav(`/workouts/${active.id}`);
  };
  const startWith = async () => {
    const r = await addWorkout({ status: 'active', type: 'custom', title: ex.name, startedAt: nowLocal(), date: today(), exercises: [makeExercise(ex, workouts)] });
    onClose();
    nav(`/workouts/${r.id}`);
  };
  const addToTemplate = async () => {
    const tpl = templates.find((x) => x.id === tplId);
    if (!tpl) return;
    await updateTemplate(tpl.id, { exercises: [...tpl.exercises, { name: ex.name, kind: ex.kind, targetSets: ex.kind === 'cardio' ? 0 : ex.defaultSets, repMin: ex.repMin, targetReps: ex.repMax, restSec: ex.restSec, exerciseId: ex.id }] });
    toast(t('lib.addedToTemplate', { name: tpl.name }));
  };

  return (
    <Modal open onClose={onClose} title={ex.name} wide
      footer={active
        ? <button className="btn-primary w-full" onClick={addToActive}><ListPlus className="h-4 w-4" />{t('lib.addToActive')}</button>
        : <button className="btn-primary w-full" onClick={startWith}><Play className="h-4 w-4" />{t('lib.startExercise')}</button>}>
      <div className="space-y-4">
        <ExerciseFigure pattern={ex.pattern} size="lg" label={t('lib.illustration', { name: ex.name })} />
        <div className="flex flex-wrap gap-2">
          <Badge tone="good">{td(`exCat.${ex.category}`)}</Badge>
          <Badge>{td(`equip.${ex.equipment}`)}</Badge>
          <Badge>{ex.kind === 'cardio' ? t('lib.cardioMinutes', { min: ex.repMin, max: ex.repMax }) : `${ex.defaultSets} × ${ex.repMin}–${ex.repMax}`}</Badge>
          {ex.restSec > 0 && <Badge>{t('lib.rest', { s: ex.restSec })}</Badge>}
        </div>
        <p className="text-sm"><span className="font-semibold">{t('lib.primary')}:</span> {ex.primary.map((m) => td(`muscle.${m}`)).join(', ')}{ex.secondary.length > 0 && <><br /><span className="font-semibold">{t('lib.secondary')}:</span> {ex.secondary.map((m) => td(`muscle.${m}`)).join(', ')}</>}</p>
        {cues.length > 0 && (
          <div>
            <h3 className="mb-1 font-semibold">{t('lib.howTo')}</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm">{cues.map((c, k) => <li key={k}>{c}</li>)}</ol>
          </div>
        )}
        {(ex as CustomExercise).notes && <p className="text-sm muted">{(ex as CustomExercise).notes}</p>}
        <Card title={t('lib.yourHistory')}>
          {last ? <p className="text-sm">{t('lib.lastTime', { date: i.date(last.date), sets: summarizeSets(last.sets, (w) => i.weight(w)) })}</p> : <p className="text-sm muted">{t('lib.noHistory')}</p>}
          {pr && <p className="mt-1 text-sm">{t('lib.pr', { w: i.weight(pr.maxWeightKg), reps: pr.maxWeightReps, e1rm: i.weight(pr.best1RM) })}</p>}
        </Card>
        {templates.length > 0 && (
          <div className="flex gap-2">
            <Select aria-label={t('lib.chooseTemplate')} value={tplId} onChange={(e) => setTplId(e.target.value)}>
              <option value="">{t('lib.chooseTemplate')}</option>
              {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
            <button className="btn-secondary whitespace-nowrap" disabled={!tplId} onClick={addToTemplate}><Plus className="h-4 w-4" />{t('lib.addToTemplate')}</button>
          </div>
        )}
        {ex.custom && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => onEdit(ex as CustomExercise)}><Pencil className="h-4 w-4" />{t('common.edit')}</button>
            <button className="btn-ghost text-red-600" onClick={async () => { if (await confirm({ title: t('confirm.deleteTitle'), body: t('lib.deleteBody'), danger: true, confirmLabel: t('common.delete') })) { await deleteCustomExercise(ex.id); toast(t('toast.deleted')); onClose(); } }}><Trash2 className="h-4 w-4" />{t('common.delete')}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function CustomExerciseEditor({ value, onClose }: { value: CustomExercise | 'new' | null; onClose: () => void }) {
  const { t, td } = useI18n();
  const toast = useToast();
  const cur = value && value !== 'new' ? value : null;
  const blank = { name: '', category: 'chest' as ExerciseCategory, kind: 'resistance' as LibraryExercise['kind'], equipment: 'dumbbell' as LibraryExercise['equipment'], primary: 'chest' as Muscle, sets: '3', repMin: '8', repMax: '12', rest: '90', inc: '2.5', notes: '' };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const k = value === null ? null : cur?.id ?? 'new';
  if (k !== key) {
    setKey(k); setErr('');
    setF(cur ? { name: cur.name, category: cur.category, kind: cur.kind, equipment: cur.equipment, primary: cur.primary[0] ?? 'chest', sets: String(cur.defaultSets), repMin: String(cur.repMin), repMax: String(cur.repMax), rest: String(cur.restSec), inc: String(cur.incrementKg), notes: cur.notes ?? '' } : blank);
  }
  const save = async () => {
    const n = (s: string) => Number(s.replace(',', '.'));
    if (!f.name.trim()) { setErr(t('val.required')); return; }
    if (![n(f.sets), n(f.repMin), n(f.repMax), n(f.rest), n(f.inc)].every((x) => Number.isFinite(x) && x >= 0) || n(f.repMin) > n(f.repMax)) { setErr(t('val.range')); return; }
    await saveCustomExercise({
      id: cur?.id ?? `custom-${Date.now().toString(36)}`, createdAt: cur?.createdAt, name: f.name.trim(), category: f.category, kind: f.kind, equipment: f.equipment,
      primary: [f.primary], secondary: [], pattern: f.kind === 'cardio' ? 'cardio' : PATTERN_BY_CATEGORY[f.category], defaultSets: n(f.sets), repMin: n(f.repMin), repMax: n(f.repMax),
      restSec: n(f.rest), incrementKg: n(f.inc), notes: f.notes.trim() || undefined
    });
    toast(t('toast.saved'));
    onClose();
  };
  return (
    <Modal open={value !== null} onClose={onClose} title={cur ? t('lib.editCustom') : t('lib.addCustom')} footer={<><button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" onClick={save}>{t('common.save')}</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label={t('workout.exerciseName')} htmlFor="ce-name" hint={t('lib.nameHint')}><Input id="ce-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
        <Field label={t('lib.category')} htmlFor="ce-cat"><Select id="ce-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ExerciseCategory })}>{EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{td(`exCat.${c}`)}</option>)}</Select></Field>
        <Field label={t('workout.kind')} htmlFor="ce-kind"><Select id="ce-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as LibraryExercise['kind'] })}>{(['resistance', 'bodyweight', 'cardio'] as const).map((x) => <option key={x} value={x}>{td(`workout.kind.${x}`)}</option>)}</Select></Field>
        <Field label={t('lib.equipment')} htmlFor="ce-eq"><Select id="ce-eq" value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value as LibraryExercise['equipment'] })}>{EQUIPMENT.map((x) => <option key={x} value={x}>{td(`equip.${x}`)}</option>)}</Select></Field>
        <Field label={t('lib.primary')} htmlFor="ce-m"><Select id="ce-m" value={f.primary} onChange={(e) => setF({ ...f, primary: e.target.value as Muscle })}>{MUSCLES.map((m) => <option key={m} value={m}>{td(`muscle.${m}`)}</option>)}</Select></Field>
        <Field label={t('lib.defaultSets')} htmlFor="ce-s"><Input id="ce-s" inputMode="numeric" value={f.sets} onChange={(e) => setF({ ...f, sets: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('lib.repMin')} htmlFor="ce-r1"><Input id="ce-r1" inputMode="numeric" value={f.repMin} onChange={(e) => setF({ ...f, repMin: e.target.value })} /></Field>
          <Field label={t('lib.repMax')} htmlFor="ce-r2"><Input id="ce-r2" inputMode="numeric" value={f.repMax} onChange={(e) => setF({ ...f, repMax: e.target.value })} /></Field>
        </div>
        <Field label={t('lib.restSec')} htmlFor="ce-rest"><Input id="ce-rest" inputMode="numeric" value={f.rest} onChange={(e) => setF({ ...f, rest: e.target.value })} /></Field>
        <Field label={t('lib.increment')} htmlFor="ce-inc" hint={t('lib.incrementHint')}><Input id="ce-inc" inputMode="decimal" value={f.inc} onChange={(e) => setF({ ...f, inc: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label={t('common.notes')} htmlFor="ce-notes"><Textarea id="ce-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
    </Modal>
  );
}
