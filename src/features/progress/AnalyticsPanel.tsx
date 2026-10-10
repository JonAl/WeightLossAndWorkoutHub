import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { useDailyMetrics, useHealth, useMeals, useWeights, useWorkouts } from '../../hooks/useData';
import { Badge, Card, MetricCard, Notice, Select } from '../../components/ui';
import { SimpleLineChart, TargetBarChart } from '../../components/charts';
import { dailyWeights, latestEntry, measurementChange, totalLost, weeklyRate, weightTrend } from '../../analytics/weight';
import { averageNutrient, calorieAdherence, dailyNutrition, proteinAdherence } from '../../analytics/nutrition';
import { exerciseNames, exerciseProgression, weeklyVolume } from '../../analytics/workouts';
import { coverage } from '../../analytics/adherence';
import { projectWeight, PROJECTION_MIN_POINTS, PROJECTION_MIN_SPAN } from '../../analytics/projections';
import { computeCorrelations, correlationStrength } from '../../analytics/correlations';
import { addDays, dayOf, diffDays, weekStart } from '../../utils/date';
import { MEASUREMENT_FIELDS } from '../../types';
import { weeklyWorkoutCounts } from '../../analytics/workouts';

export function AnalyticsPanel({ from, to }: { from: string; to: string }) {
  const i = useI18n();
  const { t } = i;
  const { profile, settings } = useApp();
  const weights = useWeights(), meals = useMeals(), workouts = useWorkouts(), health = useHealth(), metrics = useDailyMetrics();
  const [rateWindow, setRateWindow] = useState(28);
  const [exercise, setExercise] = useState('');

  const a = useMemo(() => {
    if (!weights || !meals || !workouts || !health || !metrics) return null;
    const daily = dailyWeights(weights);
    const trend = weightTrend(daily);
    const nut = dailyNutrition(meals);
    const latest = latestEntry(weights);
    const span = diffDays(from, to) + 1;
    const wkCounts = weeklyWorkoutCounts(workouts);
    const weeksInRange: string[] = [];
    // Only complete Monday–Sunday weeks fully inside the range count toward workout adherence.
    for (let w = weekStart(from); addDays(w, 6) <= to; w = addDays(w, 7)) if (w >= from) weeksInRange.push(w);
    const enabledHealth = health.filter((h) => settings.enabledHealthKinds.includes(h.kind));
    return {
      daily, trend, nut, latest,
      rangeRate: weeklyRate(daily, to, span),
      rate: weeklyRate(daily, to, rateWindow),
      projection: latest ? projectWeight(daily, to, trend[trend.length - 1].trendKg, profile.goalWeightKg) : null,
      protein: proteinAdherence(nut, profile.proteinTargetG, from, to),
      calories: profile.calorieTargetKcal ? calorieAdherence(nut, profile.calorieTargetKcal, from, to) : null,
      workoutWeeks: weeksInRange.map((w) => ({ w, n: wkCounts.get(w) ?? 0 })),
      covWeight: coverage(new Set(daily.map((d) => d.date)), from, to),
      covMeals: coverage(new Set(meals.map((m) => dayOf(m.dateTime))), from, to),
      avgs: (['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'] as const).map((k) => ({ k, ...averageNutrient(nut, k, from, to) })),
      measures: MEASUREMENT_FIELDS.map((f) => measurementChange(weights, f, from, to)).filter((x) => x !== null),
      volume: weeklyVolume(workouts).filter((v) => v.weekStart >= weekStart(from) && v.weekStart <= to),
      names: exerciseNames(workouts),
      correlations: computeCorrelations(enabledHealth, nut, new Map(metrics.filter((m) => m.steps !== undefined).map((m) => [m.date, m.steps!]))),
      proteinSeries: [...nut.values()].filter((d) => d.date >= from && d.date <= to).sort((x, y) => x.date.localeCompare(y.date)).map((d) => ({ date: d.date, value: d.proteinG }))
    };
  }, [weights, meals, workouts, health, metrics, from, to, rateWindow, profile, settings]);

  if (!a) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;
  const ex = exercise || a.names[0] || '';
  const prog = ex && workouts ? exerciseProgression(workouts, ex).filter((p) => p.date >= from && p.date <= to) : [];
  const lost = a.latest ? totalLost(profile.startWeightKg, a.latest.weightKg) : null;
  const sign = (x: number) => (x > 0 ? '+' : '');
  const workoutMet = a.workoutWeeks.filter((w) => w.n >= profile.weeklyWorkoutTarget).length;

  return (
    <div className="space-y-4">
      <Notice>{t('analytics.intro')}</Notice>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('analytics.weight')}>
        <MetricCard label={t('dash.lost')} value={lost ? i.weight(lost.kg) : '—'} sub={lost ? t('dash.lostPct', { pct: i.num(lost.pct) }) : t('common.insufficient')} />
        <MetricCard label={t('analytics.avgWeeklyRange')} value={a.rangeRate ? `${sign(a.rangeRate.kgPerWeek)}${i.weight(a.rangeRate.kgPerWeek, 2)}` : '—'} sub={a.rangeRate ? `n=${a.rangeRate.n} · ${t('analytics.regression')}` : t('common.insufficient')} />
        <div className="card p-3.5">
          <label htmlFor="rate-win" className="text-xs font-medium uppercase tracking-wide muted">{t('analytics.rateOver')}</label>
          <select id="rate-win" className="input mt-1 min-h-[36px] py-1 text-sm" value={rateWindow} onChange={(e) => setRateWindow(Number(e.target.value))}>
            {[14, 28, 56, 84].map((n) => <option key={n} value={n}>{t('progress.lastNDays', { n })}</option>)}
          </select>
          <p className="mt-1 text-lg font-bold tabular-nums">{a.rate ? `${sign(a.rate.kgPerWeek)}${i.weight(a.rate.kgPerWeek, 2)}/${t('common.weekShort')}` : <span className="text-sm font-normal muted">{t('common.insufficient')}</span>}</p>
          {a.rate && <p className="text-xs muted">n={a.rate.n}</p>}
        </div>
        <MetricCard label={t('analytics.rollingAvg')} value={a.trend.length ? i.weight(a.trend[a.trend.length - 1].trendKg) : '—'} sub={a.trend.length ? `${t('weight.trend7')} · n=${a.trend[a.trend.length - 1].n}` : undefined} badge={<Badge tone="info">{t('common.calculated')}</Badge>} />
      </section>

      <Card title={t('analytics.projection')} subtitle={t('analytics.projectionSub')}>
        {a.projection ? (
          <>
            <table className="w-full text-sm">
              <thead className="text-left text-xs muted"><tr><th className="py-1 font-medium">{t('analytics.horizon')}</th><th className="font-medium">{t('analytics.estRange')}</th></tr></thead>
              <tbody className="tabular-nums">
                {a.projection.points.map((p) => <tr key={p.weeks} className="border-t border-slate-100 dark:border-navy-800"><td className="py-1.5">{t('analytics.inWeeks', { n: p.weeks })}</td><td>{i.weight(p.lowKg)} – {i.weight(p.highKg)}</td></tr>)}
              </tbody>
            </table>
            {a.projection.weeksToGoal && <p className="mt-2 text-sm">{t('analytics.weeksToGoal', { min: a.projection.weeksToGoal.min, max: a.projection.weeksToGoal.max })}</p>}
            <p className="mt-2 text-xs muted">{t('analytics.projectionAssumptions', { rate: i.weight(a.projection.rateKgPerWeek, 2), n: a.projection.n, days: a.projection.spanDays })}</p>
          </>
        ) : <p className="text-sm muted">{t('analytics.projectionInsufficient', { n: PROJECTION_MIN_POINTS, days: PROJECTION_MIN_SPAN })}</p>}
      </Card>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4" aria-label={t('analytics.adherence')}>
        <MetricCard label={t('analytics.proteinAdherence')} value={i.pct(a.protein.pct, 0)} sub={t('analytics.daysMet', { met: a.protein.metDays, n: a.protein.loggedDays })} />
        {profile.calorieTrackingEnabled && <MetricCard label={t('analytics.calorieAdherence')} value={a.calories ? i.pct(a.calories.pct, 0) : '—'} sub={a.calories ? t('analytics.daysInBand', { met: a.calories.metDays, n: a.calories.loggedDays }) : t('dash.setCalorieTarget')} />}
        <MetricCard label={t('analytics.workoutAdherence')} value={a.workoutWeeks.length ? i.pct((workoutMet / a.workoutWeeks.length) * 100, 0) : '—'} sub={a.workoutWeeks.length ? t('analytics.weeksMet', { met: workoutMet, n: a.workoutWeeks.length, target: profile.weeklyWorkoutTarget }) : t('common.insufficient')} />
        <MetricCard label={t('analytics.coverage')} value={i.pct(a.covWeight.pct, 0)} sub={t('analytics.coverageSub', { w: a.covWeight.days, m: a.covMeals.days, total: a.covWeight.total })} />
      </section>

      {a.proteinSeries.length > 0 && <TargetBarChart data={a.proteinSeries} target={profile.proteinTargetG} title={t('analytics.proteinDaily')} unit="g" seriesName={t('nutrient.proteinG')} subtitle={t('analytics.loggedDaysOnly')} />}

      <Card title={t('analytics.nutritionAvgs')} subtitle={t('analytics.loggedDaysOnly')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {a.avgs.map((x) => (
            <div key={x.k} className="rounded-xl bg-slate-50 p-2.5 dark:bg-navy-800">
              <p className="text-xs muted">{i.td(`nutrient.${x.k}`)}</p>
              <p className="font-bold tabular-nums">{x.avg === null ? '—' : i.num(x.avg, 0)}</p>
              <p className="text-xs muted">n={x.n}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t('analytics.measurementChanges')}>
        {a.measures.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {a.measures.map((m) => <li key={m!.field} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-navy-800"><span>{i.td(`measure.${m!.field}`)}</span><span className="tabular-nums font-semibold">{sign(m!.change)}{i.length(m!.change)} <span className="font-normal muted">(n={m!.n})</span></span></li>)}
          </ul>
        ) : <p className="text-sm muted">{t('progress.measureInsufficient')}</p>}
      </Card>

      {a.volume.length > 0 && <TargetBarChart data={a.volume.map((v) => ({ date: v.weekStart, value: i.weightValue(v.volume) }))} title={t('analytics.weeklyVolume')} subtitle={t('analytics.volumeNote')} unit={i.wUnit} seriesName={t('workout.volume')} />}

      <Card title={t('analytics.exerciseProgression')} action={a.names.length > 0 && (
        <Select aria-label={t('workout.exercise')} className="min-h-[36px] w-44 py-1 text-sm" value={ex} onChange={(e) => setExercise(e.target.value)}>
          {a.names.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>)}>
        {prog.length >= 2 ? (
          <div className="-mx-4 -mb-4"><SimpleLineChart data={prog.map((p) => ({ date: p.date, value: i.weightValue(p.est1RM) }))} title={`${ex} · ${t('workout.est1RM')}`} unit={i.wUnit} seriesName={t('workout.est1RM')} subtitle={t('workout.est1RMNote')} /></div>
        ) : <p className="text-sm muted">{t('analytics.progressionInsufficient')}</p>}
      </Card>

      <Card title={t('analytics.correlations')} subtitle={t('analytics.correlationNote')}>
        <ul className="space-y-2">
          {a.correlations.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{i.td(`corr.${c.id}`)}</span>
              {c.result ? <span className="tabular-nums">r = {i.num(c.result.r, 2)} · {i.td(`corr.${correlationStrength(c.result.r)}`)} · n={c.result.n}</span> : <span className="muted">{t('analytics.corrInsufficient', { n: c.n })}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
