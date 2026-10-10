import { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { useQuickAdd } from '../../app/QuickAdd';
import { useWeights } from '../../hooks/useData';
import { Badge, Card, EmptyState, PageHeader, Segmented } from '../../components/ui';
import { DateRangeSelector, rangeBounds, type RangeKey } from '../../components/DateRangeSelector';
import { SimpleLineChart, WeightTrendChart } from '../../components/charts';
import { useConfirm, useToast } from '../../components/feedback';
import { dailyWeights, periodChange, weeklyAverages, weightTrend } from '../../analytics/weight';
import { dayOf, today, weekStart } from '../../utils/date';
import { deleteWeight } from '../../db/repositories';
import { toCSV, downloadFile } from '../../utils/csv';
import { MEASUREMENT_FIELDS, type MeasurementField } from '../../types';
import { AnalyticsPanel } from './AnalyticsPanel';

export function weightsCsv(weights: { dateTime: string; weightKg: number }[]) {
  return toCSV(weights as unknown as Record<string, unknown>[], ['dateTime', 'weightKg', ...MEASUREMENT_FIELDS, 'bodyFatPct', 'notes']);
}

export function ProgressPage() {
  const i = useI18n();
  const { t } = i;
  const { profile } = useApp();
  const quick = useQuickAdd();
  const confirm = useConfirm();
  const toast = useToast();
  const weights = useWeights();
  const [tab, setTab] = useState<'weight' | 'analytics'>('weight');
  const [range, setRange] = useState<RangeKey>('90');
  const [view, setView] = useState<'records' | 'weekly'>('records');
  const [measure, setMeasure] = useState<MeasurementField | 'bodyFatPct'>('waistCm');

  const earliest = weights?.[0] ? dayOf(weights[0].dateTime) : undefined;
  const { from, to } = rangeBounds(range, earliest);

  const d = useMemo(() => {
    if (!weights) return null;
    const daily = dailyWeights(weights);
    const trend = weightTrend(daily);
    return {
      daily, trend,
      inRange: [...weights].filter((w) => dayOf(w.dateTime) >= from && dayOf(w.dateTime) <= to).sort((a, b) => b.dateTime.localeCompare(a.dateTime)),
      trendRange: trend.filter((p) => p.date >= from && p.date <= to),
      weekly: weeklyAverages(daily.filter((x) => x.date >= from && x.date <= to), weekStart).reverse(),
      changes: [7, 30, 90, 365].map((n) => ({ n, c: periodChange(trend, today(), n) }))
    };
  }, [weights, from, to]);

  if (!d || !weights) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;

  const measureData = d.inRange.filter((w) => typeof w[measure] === 'number').map((w) => ({ date: dayOf(w.dateTime), value: measure === 'bodyFatPct' ? w[measure]! : i.units === 'imperial' ? w[measure]! / 2.54 : w[measure]! })).reverse();

  const onDelete = async (id: string) => {
    if (!(await confirm({ title: t('confirm.deleteTitle'), body: t('confirm.deleteBody'), confirmLabel: t('common.delete'), danger: true }))) return;
    try { await deleteWeight(id); toast(t('toast.deleted')); } catch { toast(t('toast.saveFailed'), 'error'); }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.progress')} actions={<button className="btn-primary" onClick={() => quick({ type: 'weight' })}><Plus className="h-4 w-4" />{t('quick.weight')}</button>} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label={t('progress.tabs')} value={tab} onChange={setTab} options={[{ value: 'weight', label: t('progress.tabWeight') }, { value: 'analytics', label: t('progress.tabAnalytics') }]} />
        <DateRangeSelector value={range} onChange={setRange} />
      </div>

      {tab === 'analytics' ? <AnalyticsPanel from={from} to={to} /> : weights.length === 0 ? (
        <EmptyState icon={Scale} title={t('dash.emptyTitle')} body={t('dash.emptyBody')} action={<button className="btn-primary" onClick={() => quick({ type: 'weight' })}>{t('dash.addFirstWeight')}</button>} />
      ) : (
        <>
          <section aria-label={t('progress.comparisons')} className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {d.changes.map(({ n, c }) => (
              <div key={n} className="card p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide muted">{t('progress.lastNDays', { n })}</p>
                {c ? (
                  <>
                    <p className="text-lg font-bold tabular-nums">{c.absKg > 0 ? '+' : ''}{i.weight(c.absKg)}</p>
                    <p className="text-xs muted">{c.pct > 0 ? '+' : ''}{i.pct(c.pct, 2)} · n={c.n}</p>
                  </>
                ) : <p className="text-sm muted">{t('common.insufficient')}</p>}
              </div>
            ))}
          </section>
          <p className="text-xs muted">{t('progress.comparisonNote')}</p>

          {d.trendRange.length > 0 && <WeightTrendChart trend={d.trendRange} goalKg={profile.goalWeightKg} title={t('progress.trendTitle')} subtitle={t('weight.trendExplain')} />}

          <Card title={t('progress.measurements')} action={
            <select aria-label={t('progress.measurement')} className="input min-h-[36px] w-auto py-1 text-sm" value={measure} onChange={(e) => setMeasure(e.target.value as MeasurementField)}>
              {MEASUREMENT_FIELDS.map((f) => <option key={f} value={f}>{i.td(`measure.${f}`)}</option>)}
              <option value="bodyFatPct">{t('weight.bodyFat')}</option>
            </select>}>
            {measureData.length >= 2 ? (
              <div className="-mx-4 -mb-4"><SimpleLineChart data={measureData} title={i.td(measure === 'bodyFatPct' ? 'weight.bodyFat' : `measure.${measure}`)} unit={measure === 'bodyFatPct' ? '%' : i.lUnit} seriesName={i.td(measure === 'bodyFatPct' ? 'weight.bodyFat' : `measure.${measure}`)} /></div>
            ) : <p className="text-sm muted">{t('progress.measureInsufficient')}</p>}
          </Card>

          <Card title={t('progress.history')} action={
            <div className="flex gap-2">
              <Segmented label={t('progress.view')} value={view} onChange={setView} options={[{ value: 'records', label: t('progress.daily') }, { value: 'weekly', label: t('progress.weekly') }]} />
              <button className="btn-icon" aria-label={t('reports.exportCsv')} title={t('reports.exportCsv')} onClick={() => downloadFile(`weights-${today()}.csv`, weightsCsv(weights), 'text/csv;charset=utf-8')}><Download className="h-4 w-4" /></button>
            </div>}>
            {view === 'records' ? (
              d.inRange.length === 0 ? <p className="text-sm muted">{t('common.noneInRange')}</p> : (
                <ul className="divide-y divide-slate-100 dark:divide-navy-800">
                  {d.inRange.map((w) => (
                    <li key={w.id} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold tabular-nums">{i.weight(w.weightKg)} {w.waistCm !== undefined && <span className="text-sm font-normal muted">· {t('measure.waistCm')} {i.length(w.waistCm)}</span>}</p>
                        <p className="truncate text-xs muted">{i.dateTime(w.dateTime)}{w.notes ? ` · ${w.notes}` : ''}</p>
                      </div>
                      <button className="btn-icon" aria-label={t('common.edit')} onClick={() => quick({ type: 'weight', entry: w })}><Pencil className="h-4 w-4" /></button>
                      <button className="btn-icon text-red-600" aria-label={t('common.delete')} onClick={() => onDelete(w.id)}><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs muted"><tr><th className="py-1 font-medium">{t('progress.weekOf')}</th><th className="font-medium">{t('progress.avg')}</th><th className="font-medium">n</th></tr></thead>
                <tbody className="tabular-nums">{d.weekly.map((w) => <tr key={w.weekStart} className="border-t border-slate-100 dark:border-navy-800"><td className="py-1.5">{i.date(w.weekStart)}</td><td>{i.weight(w.avgKg)}</td><td>{w.n}</td></tr>)}</tbody>
              </table>
            )}
            <p className="mt-2 text-xs muted"><Badge>{t('common.observed')}</Badge> {t('progress.historyNote')}</p>
          </Card>
        </>
      )}
    </div>
  );
}
