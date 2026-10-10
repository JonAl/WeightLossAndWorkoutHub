import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Droplets, Dumbbell, Flame, Footprints, Gauge, HeartPulse, Plus, Ruler, Scale, Target, TrendingDown, Utensils, Beef, Trophy } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { useQuickAdd } from '../../app/QuickAdd';
import { useI18n } from '../../i18n';
import { useDailyMetrics, useMeals, useWater, useWeights, useWorkouts } from '../../hooks/useData';
import { Badge, Card, EmptyState, Input, MetricCard, Notice, PageHeader, ProgressBar, Segmented } from '../../components/ui';
import { WeightTrendChart } from '../../components/charts';
import { useToast } from '../../components/feedback';
import { addDays, dayOf, today, weekStart } from '../../utils/date';
import { bmi, bmiCategory, dailyWeights, latestEntry, measurementChange, totalLost, weeklyRate, weightTrend } from '../../analytics/weight';
import { dailyNutrition } from '../../analytics/nutrition';
import { workoutsInWeek } from '../../analytics/workouts';
import { currentStreak, workoutWeekStreak } from '../../analytics/adherence';
import { addWater, setSteps } from '../../db/repositories';
import { nowLocal } from '../../utils/date';
import { TodayCard } from './TodayCard';

/** Time-of-day greeting (from GymApp's home screen). */
function greetingKey(): 'dash.goodMorning' | 'dash.goodAfternoon' | 'dash.goodEvening' {
  const h = new Date().getHours();
  return h < 12 ? 'dash.goodMorning' : h < 18 ? 'dash.goodAfternoon' : 'dash.goodEvening';
}

export function Dashboard() {
  const i = useI18n();
  const { t } = i;
  const { profile } = useApp();
  const quick = useQuickAdd();
  const nav = useNavigate();
  const toast = useToast();
  const weights = useWeights();
  const meals = useMeals();
  const workouts = useWorkouts();
  const water = useWater();
  const metrics = useDailyMetrics();
  const [range, setRange] = useState<7 | 30>(30);
  const [stepsInput, setStepsInput] = useState('');
  const d0 = today();

  const s = useMemo(() => {
    if (!weights || !meals || !workouts || !water || !metrics) return null;
    const daily = dailyWeights(weights);
    const trend = weightTrend(daily);
    const latest = latestEntry(weights);
    const currentKg = latest?.weightKg;
    const nut = dailyNutrition(meals).get(d0);
    const waterToday = water.filter((w) => dayOf(w.dateTime) === d0).reduce((a, w) => a + w.ml, 0);
    const stepsToday = metrics.find((m) => m.date === d0)?.steps;
    const rate = weeklyRate(daily, d0, 28);
    const ws = weekStart(d0);
    const waist = measurementChange(weights, 'waistCm');
    const mealDays = new Set(meals.map((m) => dayOf(m.dateTime)));
    const prevWeekMeals = meals.filter((m) => dayOf(m.dateTime) >= addDays(ws, -7) && dayOf(m.dateTime) < ws);
    return {
      daily, trend, latest, currentKg, nut, waterToday, stepsToday, rate, waist,
      workoutsWeek: workoutsInWeek(workouts, ws),
      weightStreak: currentStreak(new Set(daily.map((x) => x.date)), d0),
      mealStreak: currentStreak(mealDays, d0),
      workoutStreak: workoutWeekStreak(workouts, profile.weeklyWorkoutTarget, d0),
      weekWeights: daily.filter((x) => x.date >= ws).length,
      prevWeekMealDays: new Set(prevWeekMeals.map((m) => dayOf(m.dateTime))).size,
      activeWorkout: workouts.find((w) => w.status === 'active')
    };
  }, [weights, meals, workouts, water, metrics, d0, profile.weeklyWorkoutTarget]);

  if (!s) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;

  const lost = s.currentKg !== undefined ? totalLost(profile.startWeightKg, s.currentKg) : null;
  const b = s.currentKg !== undefined ? bmi(s.currentKg, profile.heightCm) : null;
  const remaining = s.currentKg !== undefined && profile.goalWeightKg ? s.currentKg - profile.goalWeightKg : null;
  const chartTrend = s.trend.filter((p) => p.date >= addDays(d0, -(range - 1)));
  const protein = s.nut?.proteinG ?? 0;
  const calories = s.nut?.calories ?? 0;

  const quickButtons = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button className="btn-primary" onClick={() => quick({ type: 'weight' })}><Scale className="h-4 w-4" />{t('quick.weight')}</button>
      <button className="btn-secondary" onClick={() => quick({ type: 'meal' })}><Utensils className="h-4 w-4" />{t('quick.meal')}</button>
      <button className="btn-secondary" onClick={() => nav(s.activeWorkout ? `/workouts/${s.activeWorkout.id}` : '/workouts?start=1')}><Dumbbell className="h-4 w-4" />{s.activeWorkout ? t('workout.resume') : t('quick.workout')}</button>
      <button className="btn-secondary" onClick={() => quick({ type: 'health' })}><HeartPulse className="h-4 w-4" />{t('quick.health')}</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader title={t('dash.title')} subtitle={`${t(greetingKey())} · ${i.date(d0, { weekday: 'long', day: 'numeric', month: 'long' })}`} />
      <TodayCard />
      {quickButtons}

      {profile.unconfirmed.length > 0 && (
        <Notice tone="warn">{t('dash.unconfirmed')} <button className="font-semibold underline" onClick={() => nav('/settings')}>{t('dash.reviewProfile')}</button></Notice>
      )}

      {weights!.length === 0 ? (
        <EmptyState icon={Scale} title={t('dash.emptyTitle')} body={t('dash.emptyBody')}
          action={<button className="btn-primary" onClick={() => quick({ type: 'weight' })}><Plus className="h-4 w-4" />{t('dash.addFirstWeight')}</button>} />
      ) : (
        <section aria-label={t('dash.weightSection')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label={t('dash.current')} icon={Scale} value={i.weight(s.currentKg)} sub={s.latest ? i.dateTime(s.latest.dateTime) : undefined} />
          <MetricCard label={t('dash.start')} icon={Activity} value={i.weight(profile.startWeightKg)} sub={i.date(profile.startDate)} />
          <MetricCard label={t('dash.lost')} icon={TrendingDown} tone={lost && lost.kg > 0 ? 'good' : 'neutral'} value={lost ? i.weight(lost.kg) : '—'} sub={lost ? t('dash.lostPct', { pct: i.num(lost.pct) }) : undefined} />
          <MetricCard label={t('dash.goal')} icon={Target} value={profile.goalWeightKg ? i.weight(profile.goalWeightKg) : t('common.notSet')}
            sub={remaining !== null ? (remaining > 0 ? t('dash.remaining', { w: i.weight(remaining) }) : t('dash.goalReached')) : undefined} />
          <MetricCard label={t('dash.weeklyChange')} icon={Gauge}
            value={s.rate ? `${s.rate.kgPerWeek > 0 ? '+' : ''}${i.weight(s.rate.kgPerWeek, 2)}` : '—'}
            sub={s.rate ? t('dash.rateBasis', { n: s.rate.n }) : t('common.insufficient')} />
          <MetricCard label={t('dash.bmi')} icon={Ruler} value={b ? i.num(b) : '—'} sub={b ? `${i.td(`bmi.${bmiCategory(b)}`)} · ${t('dash.bmiNote')}` : undefined} />
          <MetricCard label={t('dash.waist')} icon={Ruler} value={s.waist ? `${s.waist.change > 0 ? '+' : ''}${i.length(s.waist.change)}` : '—'}
            sub={s.waist ? t('dash.since', { date: i.shortDate(s.waist.firstDate) }) : t('dash.noWaist')} />
          <MetricCard label={t('dash.streaks')} icon={Trophy} value={t('dash.streakDays', { n: s.weightStreak })}
            sub={t('dash.streakSub', { meals: s.mealStreak, weeks: s.workoutStreak })} />
        </section>
      )}

      <section aria-label={t('dash.today')} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card title={t('dash.protein')} action={<Beef aria-hidden className="h-4 w-4 text-slate-400" />}>
          <p className="mb-2 text-xl font-bold tabular-nums">{i.num(protein, 0)} <span className="text-sm font-normal muted">/ {profile.proteinTargetG} g</span></p>
          <ProgressBar value={protein} max={profile.proteinTargetG} label={t('dash.protein')} />
          <p className="mt-2 text-xs muted">{s.nut ? (protein >= profile.proteinTargetG ? t('dash.targetMet') : t('dash.remainingG', { g: i.num(profile.proteinTargetG - protein, 0) })) : t('dash.noMealsToday')}</p>
        </Card>
        {profile.calorieTrackingEnabled && (
          <Card title={t('dash.calories')} action={<Flame aria-hidden className="h-4 w-4 text-slate-400" />}>
            {profile.calorieTargetKcal ? (
              <>
                <p className="mb-2 text-xl font-bold tabular-nums">{i.num(calories, 0)} <span className="text-sm font-normal muted">/ {i.num(profile.calorieTargetKcal, 0)} kcal</span></p>
                <ProgressBar value={calories} max={profile.calorieTargetKcal} label={t('dash.calories')} />
                <p className="mt-2 text-xs muted">{s.nut ? t('dash.remainingKcal', { k: i.num(Math.max(0, profile.calorieTargetKcal - calories), 0) }) : t('dash.noMealsToday')}</p>
              </>
            ) : (
              <p className="text-sm muted">{i.num(calories, 0)} kcal · <button className="font-semibold text-teal-700 underline dark:text-teal-400" onClick={() => nav('/settings')}>{t('dash.setCalorieTarget')}</button></p>
            )}
          </Card>
        )}
        <Card title={t('dash.workoutsWeek')} action={<Dumbbell aria-hidden className="h-4 w-4 text-slate-400" />}>
          <p className="mb-2 text-xl font-bold tabular-nums">{s.workoutsWeek} <span className="text-sm font-normal muted">/ {profile.weeklyWorkoutTarget}</span></p>
          <ProgressBar value={s.workoutsWeek} max={profile.weeklyWorkoutTarget} label={t('dash.workoutsWeek')} />
        </Card>
        <Card title={t('dash.water')} action={<Droplets aria-hidden className="h-4 w-4 text-slate-400" />}>
          <p className="mb-2 text-xl font-bold tabular-nums">{i.num(s.waterToday / 1000, 2)} <span className="text-sm font-normal muted">/ {i.num(profile.waterTargetMl / 1000, 1)} L</span></p>
          <ProgressBar value={s.waterToday} max={profile.waterTargetMl} label={t('dash.water')} />
          <div className="mt-2 flex gap-2">
            {[250, 500].map((ml) => (
              <button key={ml} className="btn-secondary min-h-[36px] flex-1 px-2 text-xs" onClick={async () => { try { await addWater(ml, nowLocal()); toast(t('dash.waterAdded', { ml })); } catch { toast(t('toast.saveFailed'), 'error'); } }}>+{ml} ml</button>
            ))}
          </div>
        </Card>
        <Card title={t('dash.steps')} action={<Footprints aria-hidden className="h-4 w-4 text-slate-400" />}>
          <p className="mb-2 text-xl font-bold tabular-nums">{s.stepsToday !== undefined ? i.num(s.stepsToday, 0) : '—'}{profile.stepTarget ? <span className="text-sm font-normal muted"> / {i.num(profile.stepTarget, 0)}</span> : null}</p>
          {profile.stepTarget && s.stepsToday !== undefined && <ProgressBar value={s.stepsToday} max={profile.stepTarget} label={t('dash.steps')} />}
          <form className="mt-2 flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            const n = Number(stepsInput);
            if (!Number.isInteger(n) || n < 0 || n > 200000) { toast(t('val.range'), 'error'); return; }
            await setSteps(d0, n); setStepsInput(''); toast(t('toast.saved'));
          }}>
            <Input aria-label={t('dash.stepsInput')} inputMode="numeric" value={stepsInput} onChange={(e) => setStepsInput(e.target.value)} placeholder={t('dash.stepsInput')} className="min-h-[36px] text-sm" />
            <button className="btn-secondary min-h-[36px] px-3 text-xs" type="submit">{t('common.save')}</button>
          </form>
        </Card>
      </section>

      {s.trend.length > 0 && (
        <div>
          <div className="mb-2 flex justify-end">
            <Segmented label={t('range.label')} value={range} onChange={setRange} options={[{ value: 7, label: t('range.7') }, { value: 30, label: t('range.30') }]} />
          </div>
          {chartTrend.length > 0 ? (
            <WeightTrendChart trend={chartTrend} goalKg={profile.goalWeightKg} title={t('dash.trendChart')} subtitle={t('weight.trendExplain')} />
          ) : (
            <Card><p className="text-sm muted">{t('dash.noRecentWeights')}</p></Card>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Card title={t('dash.dailySummary')}>
          <ul className="space-y-1.5 text-sm">
            <li>{s.daily.some((x) => x.date === d0) ? t('dash.sumWeighed') : t('dash.sumNotWeighed')}</li>
            <li>{s.nut ? t('dash.sumMeals', { n: s.nut.entries, p: i.num(protein, 0) }) : t('dash.noMealsToday')}</li>
            <li>{t('dash.sumWater', { l: i.num(s.waterToday / 1000, 2) })}</li>
          </ul>
        </Card>
        <Card title={t('dash.weeklySummary')}>
          <ul className="space-y-1.5 text-sm">
            <li>{t('dash.wkWeighIns', { n: s.weekWeights })}</li>
            <li>{t('dash.wkWorkouts', { n: s.workoutsWeek, target: profile.weeklyWorkoutTarget })}</li>
            <li>{s.rate ? t('dash.wkRate', { r: `${s.rate.kgPerWeek > 0 ? '+' : ''}${i.weight(s.rate.kgPerWeek, 2)}` }) : t('dash.wkRateInsufficient')}</li>
          </ul>
          <button className="mt-3 text-sm font-semibold text-teal-700 underline dark:text-teal-400" onClick={() => nav('/coaching')}>{t('dash.openCoaching')}</button>
        </Card>
      </div>
      <p className="text-xs muted"><Badge>{t('common.observed')}</Badge> {t('dash.footnote')}</p>
    </div>
  );
}
