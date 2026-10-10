import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { usePrograms, useTemplates, useWorkouts } from '../../hooks/useData';
import { Card, Field, Input, Notice, Select, cx } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { saveProgram } from '../../db/repositories';
import { activeProgram, estimateMinutes, monthGrid, plannedDaysPerWeek, plannedTemplate, workoutsByDate } from '../../training/plan';
import { getTraining } from '../../training/settings';
import { parseDateKey, toDateKey, today } from '../../utils/date';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function PlanTab() {
  const i = useI18n();
  const { t, td } = i;
  const { profile, settings } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const programs = usePrograms(), templates = useTemplates(), workouts = useWorkouts();
  const prog = programs ? activeProgram(programs) : undefined;
  const [draft, setDraft] = useState<{ name: string; days: (string | null)[] } | null>(null);
  const [month, setMonth] = useState(today());
  const [selected, setSelected] = useState<string | null>(today());
  const byDate = useMemo(() => workoutsByDate(workouts ?? []), [workouts]);
  if (!programs || !templates || !workouts) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;

  const cur = draft ?? { name: prog?.name ?? t('plan.defaultName'), days: prog?.days ?? Array(7).fill(null) };
  const dirty = draft !== null;
  const tr = getTraining(settings, i.units);
  const save = async () => {
    await saveProgram({ id: prog?.id, createdAt: prog?.createdAt, name: cur.name.trim() || t('plan.defaultName'), days: cur.days, active: true });
    setDraft(null);
    toast(t('toast.saved'));
  };
  const grid = monthGrid(month);
  const shiftMonth = (d: number) => { const x = parseDateKey(month); setMonth(toDateKey(new Date(x.getFullYear(), x.getMonth() + d, 1, 12))); };
  const sel = selected ? byDate.get(selected) ?? [] : [];
  const selPlan = selected ? plannedTemplate(prog, templates, selected) : null;
  const planned = plannedDaysPerWeek(dirty ? { ...prog!, days: cur.days } : prog);

  return (
    <div className="space-y-4">
      <Card title={t('plan.weekly')} subtitle={t('plan.weeklySub')}>
        <div className="space-y-2">
          <Field label={t('plan.name')} htmlFor="pl-name"><Input id="pl-name" value={cur.name} onChange={(e) => setDraft({ ...cur, name: e.target.value })} /></Field>
          {WEEKDAYS.map((d) => {
            const tpl = templates.find((x) => x.id === cur.days[d]);
            return (
              <div key={d} className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
                <label htmlFor={`pl-${d}`} className="text-sm font-medium">{td(`weekday.${d}`)}</label>
                <div>
                  <Select id={`pl-${d}`} value={cur.days[d] ?? ''} onChange={(e) => { const days = [...cur.days]; days[d] = e.target.value || null; setDraft({ ...cur, days }); }}>
                    <option value="">{t('plan.rest')}</option>
                    {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </Select>
                  {tpl && <p className="mt-0.5 text-xs muted">{t('plan.tplInfo', { n: tpl.exercises.length, min: estimateMinutes(tpl, tr.defaultRestSec) })}</p>}
                </div>
              </div>
            );
          })}
        </div>
        {planned !== profile.weeklyWorkoutTarget && <Notice>{t('plan.targetMismatch', { planned, target: profile.weeklyWorkoutTarget })}</Notice>}
        <button className="btn-primary mt-3" disabled={!dirty && !!prog} onClick={save}><Save className="h-4 w-4" />{t('common.save')}</button>
      </Card>

      <Card title={t('plan.calendar')} action={
        <div className="flex items-center gap-1">
          <button className="btn-icon h-9 w-9" aria-label={t('plan.prevMonth')} onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[8rem] text-center text-sm font-medium">{i.date(month, { month: 'long', year: 'numeric' })}</span>
          <button className="btn-icon h-9 w-9" aria-label={t('plan.nextMonth')} onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></button>
        </div>}>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium muted" aria-hidden>
          {WEEKDAYS.map((d) => <span key={d}>{td(`weekdayShort.${d}`)}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((d, k) => {
            if (!d) return <span key={k} />;
            const done = byDate.get(d)?.length ?? 0;
            const plan = plannedTemplate(prog, templates, d);
            const isToday = d === today();
            return (
              <button key={d} onClick={() => setSelected(d)} aria-pressed={selected === d}
                aria-label={`${i.date(d)}${done ? ` · ${t('plan.doneN', { n: done })}` : ''}${plan ? ` · ${t('plan.plannedX', { name: plan.name })}` : ''}`}
                className={cx('flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition',
                  selected === d ? 'ring-2 ring-teal-500' : '',
                  done ? 'bg-teal-600 font-bold text-white dark:bg-teal-500 dark:text-navy-950' : plan && d >= today() ? 'bg-slate-100 dark:bg-navy-800' : '',
                  isToday && !done ? 'font-bold text-teal-700 dark:text-teal-300' : '')}>
                {parseDateKey(d).getDate()}
                {plan && !done && <span aria-hidden className="mt-0.5 h-1 w-1 rounded-full bg-teal-500" />}
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex flex-wrap gap-3 text-xs muted">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-teal-600" />{t('plan.legendDone')}</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" />{t('plan.legendPlanned')}</span>
        </p>
        {selected && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-navy-800">
            <p className="text-sm font-semibold"><CalendarDays aria-hidden className="mr-1 inline h-4 w-4" />{i.date(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            {sel.length ? (
              <ul className="mt-1 space-y-1 text-sm">{sel.map((w) => <li key={w.id}><button className="text-teal-700 underline dark:text-teal-400" onClick={() => nav(`/workouts/${w.id}`)}>{w.title}</button>{w.durationMin ? ` · ${w.durationMin} min` : ''}</li>)}</ul>
            ) : <p className="text-sm muted">{selPlan ? t('plan.plannedX', { name: selPlan.name }) : t('plan.nothing')}</p>}
          </div>
        )}
      </Card>
      <p className="text-xs muted">{t('plan.note')}</p>
    </div>
  );
}
