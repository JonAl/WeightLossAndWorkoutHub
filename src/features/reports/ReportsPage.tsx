import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { useHealth, useMeals, useWeights, useWorkouts, useWater } from '../../hooks/useData';
import { Card, PageHeader, Segmented } from '../../components/ui';
import { addDays, dayOf, parseDateKey, toDateKey, today, weekStart } from '../../utils/date';
import { dailyWeights, measurementChange, weightTrend } from '../../analytics/weight';
import { averageNutrient, calorieAdherence, dailyNutrition, proteinAdherence } from '../../analytics/nutrition';
import { cardioTotals, completedSets, workoutVolume, personalRecords } from '../../analytics/workouts';
import { mean } from '../../utils/stats';
import { MEASUREMENT_FIELDS, type HealthKind } from '../../types';
import { ExportImportPanel } from './ExportImportPanel';
import { ReviewView } from '../coaching/CoachingPage';
import { reviewForWeek } from '../../coaching/weeklyReview';

function monthBounds(anchor: string) {
  const d = parseDateKey(anchor);
  return { from: toDateKey(new Date(d.getFullYear(), d.getMonth(), 1, 12)), to: toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)) };
}

export function ReportsPage() {
  const i = useI18n();
  const { t, td } = i;
  const { profile, settings } = useApp();
  const weights = useWeights(), meals = useMeals(), workouts = useWorkouts(), health = useHealth(), water = useWater();
  const [tab, setTab] = useState<'reports' | 'data'>('reports');
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(today());

  const { from, to } = period === 'week' ? { from: weekStart(anchor), to: addDays(weekStart(anchor), 6) } : monthBounds(anchor);
  const shift = (dir: number) => {
    if (period === 'week') setAnchor(addDays(anchor, 7 * dir));
    else { const d = parseDateKey(anchor); setAnchor(toDateKey(new Date(d.getFullYear(), d.getMonth() + dir, 1, 12))); }
  };

  const r = useMemo(() => {
    if (!weights || !meals || !workouts || !health || !water) return null;
    const daily = dailyWeights(weights);
    const trend = weightTrend(daily).filter((p) => p.date >= from && p.date <= to);
    const inW = daily.filter((d) => d.date >= from && d.date <= to);
    const nut = dailyNutrition(meals);
    const ws = workouts.filter((w) => w.status === 'completed' && w.date >= from && w.date <= to);
    const prsAll = personalRecords(workouts);
    const prsBefore = new Map(personalRecords(workouts.filter((w) => w.date < from)).map((p) => [p.exercise.toLowerCase(), p.maxWeightKg]));
    const hIn = health.filter((h) => settings.enabledHealthKinds.includes(h.kind) && dayOf(h.dateTime) >= from && dayOf(h.dateTime) <= to);
    const hAvg = (k: HealthKind) => { const xs = hIn.filter((h) => h.kind === k && typeof h.value === 'number').map((h) => h.value!); return { avg: mean(xs), n: xs.length }; };
    const bpIn = hIn.filter((h) => h.kind === 'bloodPressure');
    const waterDays = new Map<string, number>();
    for (const w of water) { const d = dayOf(w.dateTime); if (d >= from && d <= to) waterDays.set(d, (waterDays.get(d) ?? 0) + w.ml); }
    return {
      weight: {
        n: inW.length,
        first: trend[0], last: trend[trend.length - 1],
        min: inW.length ? Math.min(...inW.map((d) => d.weightKg)) : null,
        max: inW.length ? Math.max(...inW.map((d) => d.weightKg)) : null
      },
      protein: proteinAdherence(nut, profile.proteinTargetG, from, to),
      calories: profile.calorieTargetKcal ? calorieAdherence(nut, profile.calorieTargetKcal, from, to) : null,
      avgs: (['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'] as const).map((k) => ({ k, ...averageNutrient(nut, k, from, to) })),
      water: { avg: mean([...waterDays.values()]), n: waterDays.size },
      workouts: {
        n: ws.length, sets: ws.reduce((a, w) => a + completedSets(w), 0), volume: ws.reduce((a, w) => a + workoutVolume(w), 0),
        cardio: ws.reduce((a, w) => { const c = cardioTotals(w); return { min: a.min + c.durationMin, km: a.km + c.distanceKm }; }, { min: 0, km: 0 }),
        newPRs: prsAll.filter((p) => p.maxWeightDate >= from && p.maxWeightDate <= to && p.maxWeightKg > (prsBefore.get(p.exercise.toLowerCase()) ?? 0))
      },
      measures: MEASUREMENT_FIELDS.map((f) => measurementChange(weights, f, from, to)).filter((x) => x !== null),
      health: {
        values: (['glucose', 'heartRate', 'sleep', 'energy', 'hunger'] as HealthKind[]).filter((k) => settings.enabledHealthKinds.includes(k)).map((k) => ({ k, ...hAvg(k) })),
        bp: bpIn.length ? { sys: mean(bpIn.map((b) => b.systolic!)), dia: mean(bpIn.map((b) => b.diastolic!)), n: bpIn.length } : null,
        meds: hIn.filter((h) => h.kind === 'medication').length, supps: hIn.filter((h) => h.kind === 'supplement').length, digestive: hIn.filter((h) => h.kind === 'digestive').length
      },
      review: period === 'week' ? reviewForWeek({ weights, meals, workouts, health }, profile, settings, from) : null
    };
  }, [weights, meals, workouts, health, water, from, to, profile, settings, period]);

  const Row = ({ label, value }: { label: string; value: string }) => <div className="flex justify-between gap-2 border-t border-slate-100 py-1.5 text-sm first:border-0 dark:border-navy-800"><span className="muted">{label}</span><span className="text-right font-medium tabular-nums">{value}</span></div>;
  const sign = (x: number) => (x > 0 ? '+' : '');

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.reports')} />
      <Segmented label={t('reports.tabs')} value={tab} onChange={setTab} options={[{ value: 'reports', label: t('reports.tabReports') }, { value: 'data', label: t('reports.tabData') }]} />
      {tab === 'data' ? <ExportImportPanel /> : !r ? <div className="p-6 muted" role="status">{t('common.loading')}</div> : (
        <>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Segmented label={t('reports.period')} value={period} onChange={setPeriod} options={[{ value: 'week', label: t('reports.weekly') }, { value: 'month', label: t('reports.monthly') }]} />
            <div className="flex items-center gap-1">
              <button className="btn-icon" aria-label={t('reports.prev')} onClick={() => shift(-1)}><ChevronLeft className="h-5 w-5" /></button>
              <span className="min-w-[10rem] text-center text-sm font-medium">{period === 'week' ? `${i.shortDate(from)} – ${i.date(to)}` : i.date(from, { month: 'long', year: 'numeric' })}</span>
              <button className="btn-icon" aria-label={t('reports.next')} disabled={to >= today()} onClick={() => shift(1)}><ChevronRight className="h-5 w-5" /></button>
            </div>
            <button className="btn-secondary ml-auto" onClick={() => window.print()}><Printer className="h-4 w-4" />{t('reports.print')}</button>
          </div>

          {r.review && <Card title={t('reports.weeklySummary')}><ReviewView review={r.review} /></Card>}

          <div className="grid gap-3 md:grid-cols-2">
            <Card title={t('reports.weightReport')}>
              {r.weight.n === 0 ? <p className="text-sm muted">{t('common.noneInRange')}</p> : <>
                <Row label={t('reports.weighIns')} value={String(r.weight.n)} />
                {r.weight.first && r.weight.last && r.weight.first !== r.weight.last && <Row label={t('reports.trendChange')} value={`${sign(r.weight.last.trendKg - r.weight.first.trendKg)}${i.weight(r.weight.last.trendKg - r.weight.first.trendKg)}`} />}
                {r.weight.last && <Row label={t('reports.trendEnd')} value={i.weight(r.weight.last.trendKg)} />}
                <Row label={t('reports.range')} value={`${i.weight(r.weight.min)} – ${i.weight(r.weight.max)}`} />
              </>}
            </Card>
            <Card title={t('reports.nutritionReport')}>
              <Row label={t('reports.loggedDays')} value={`${r.protein.loggedDays} / ${r.protein.totalDays}`} />
              {r.avgs.map((a) => <Row key={a.k} label={`${td(`nutrient.${a.k}`)} (${t('progress.avg')})`} value={a.avg === null ? '—' : i.num(a.avg, 0)} />)}
              <Row label={t('analytics.proteinAdherence')} value={`${i.pct(r.protein.pct, 0)} (${r.protein.metDays}/${r.protein.loggedDays})`} />
              {r.calories && profile.calorieTrackingEnabled && <Row label={t('analytics.calorieAdherence')} value={`${i.pct(r.calories.pct, 0)} (${r.calories.metDays}/${r.calories.loggedDays})`} />}
              <Row label={t('reports.waterAvg')} value={r.water.avg === null ? '—' : `${i.num(r.water.avg, 0)} ml (n=${r.water.n})`} />
            </Card>
            <Card title={t('reports.workoutReport')}>
              <Row label={t('workout.sessions')} value={String(r.workouts.n)} />
              <Row label={t('reports.completedSets')} value={String(r.workouts.sets)} />
              <Row label={t('workout.volume')} value={i.weight(r.workouts.volume, 0)} />
              <Row label={t('reports.cardio')} value={t('workout.cardioSummary', { min: i.num(r.workouts.cardio.min, 0), km: i.num(r.workouts.cardio.km) })} />
              <Row label={t('reports.newPRs')} value={r.workouts.newPRs.length ? r.workouts.newPRs.map((p) => `${p.exercise} ${i.weight(p.maxWeightKg)}`).join(', ') : '—'} />
            </Card>
            <Card title={t('reports.measurementReport')}>
              {r.measures.length ? r.measures.map((m) => <Row key={m!.field} label={td(`measure.${m!.field}`)} value={`${sign(m!.change)}${i.length(m!.change)} (n=${m!.n})`} />) : <p className="text-sm muted">{t('progress.measureInsufficient')}</p>}
            </Card>
            {settings.enabledHealthKinds.length > 0 && (
              <Card title={t('reports.healthReport')}>
                {r.health.values.map((h) => <Row key={h.k} label={td(`health.kind.${h.k}`)} value={h.avg === null ? '—' : `${i.num(h.avg)} (n=${h.n})`} />)}
                {r.health.bp && <Row label={td('health.kind.bloodPressure')} value={`${i.num(r.health.bp.sys, 0)}/${i.num(r.health.bp.dia, 0)} mmHg (n=${r.health.bp.n})`} />}
                <Row label={t('reports.doseLogs')} value={t('reports.doseLogsValue', { m: r.health.meds, s: r.health.supps })} />
                <Row label={td('health.kind.digestive')} value={String(r.health.digestive)} />
                <p className="mt-2 text-xs muted">{t('health.disclaimer')}</p>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
