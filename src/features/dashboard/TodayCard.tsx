import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Dumbbell, Play } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { useCustomExercises, usePrograms, useTemplates, useWorkouts } from '../../hooks/useData';
import { activeProgram, estimateMinutes, plannedTemplate } from '../../training/plan';
import { getTraining } from '../../training/settings';
import { workoutFromTemplate } from '../../training/workoutOps';
import { addWorkout } from '../../db/repositories';
import { addDays, today } from '../../utils/date';

/** GymApp's "Today's workout" card, driven by the weekly plan. */
export function TodayCard() {
  const i = useI18n();
  const { t } = i;
  const { settings } = useApp();
  const nav = useNavigate();
  const programs = usePrograms(), templates = useTemplates(), workouts = useWorkouts(), custom = useCustomExercises();
  if (!programs || !templates || !workouts || !custom) return null;
  const d0 = today();
  const prog = activeProgram(programs);
  const tpl = plannedTemplate(prog, templates, d0);
  const active = workouts.find((w) => w.status === 'active');
  const doneToday = workouts.filter((w) => w.status === 'completed' && w.date === d0);
  const tr = getTraining(settings, i.units);
  let next: { date: string; name: string } | null = null;
  if (!tpl && prog) for (let k = 1; k <= 7; k++) { const d = addDays(d0, k); const p = plannedTemplate(prog, templates, d); if (p) { next = { date: d, name: p.name }; break; } }

  const start = async () => {
    if (active) { nav(`/workouts/${active.id}`); return; }
    if (!tpl) { nav('/workouts?start=1'); return; }
    const r = await addWorkout(workoutFromTemplate(tpl, workouts, custom));
    nav(`/workouts/${r.id}`);
  };

  return (
    <section aria-label={t('today.title')} className="overflow-hidden rounded-3xl bg-navy-900 p-5 text-white shadow-lg ring-1 ring-navy-700 dark:bg-navy-900">
      <p className="text-xs font-bold uppercase tracking-wider text-teal-300">{t('today.title')}</p>
      {active ? (
        <>
          <h2 className="mt-1 text-2xl font-bold">{active.title}</h2>
          <p className="text-sm text-slate-300">{t('today.inProgress', { done: active.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0), total: active.exercises.reduce((a, e) => a + e.sets.length, 0) })}</p>
        </>
      ) : doneToday.length ? (
        <>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold"><CalendarCheck aria-hidden className="h-6 w-6 text-teal-300" />{t('today.done')}</h2>
          <p className="text-sm text-slate-300">{doneToday.map((w) => w.title).join(', ')}</p>
        </>
      ) : tpl ? (
        <>
          <h2 className="mt-1 text-2xl font-bold">{tpl.name}</h2>
          <p className="text-sm text-slate-300">{t('today.meta', { n: tpl.exercises.length, min: estimateMinutes(tpl, tr.defaultRestSec) })}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{tpl.exercises.map((e) => e.name).join(' · ')}</p>
        </>
      ) : (
        <>
          <h2 className="mt-1 text-2xl font-bold">{prog ? t('today.rest') : t('today.noPlan')}</h2>
          <p className="text-sm text-slate-300">{next ? t('today.next', { day: i.date(next.date, { weekday: 'long' }), name: next.name }) : t('today.setupPlan')}</p>
        </>
      )}
      <div className="mt-4 flex gap-2">
        {!doneToday.length || active ? (
          <button className="btn flex-1 bg-teal-400 text-navy-950 hover:bg-teal-300" onClick={start}>
            <Play className="h-4 w-4" />{active ? t('workout.resume') : tpl ? t('today.start') : t('today.startOther')}
          </button>
        ) : null}
        <button className="btn border border-white/20 text-white hover:bg-white/10" onClick={() => nav('/workouts?tab=plan')}><Dumbbell className="h-4 w-4" />{t('today.plan')}</button>
      </div>
    </section>
  );
}
