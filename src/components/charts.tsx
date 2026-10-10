import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { Table2, LineChart as LineIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { useChartColors } from '../app/ThemeContext';
import type { TrendPoint } from '../analytics/weight';

/** Chart wrapper with a title and an accessible table-view toggle. */
export function ChartFrame({ title, subtitle, rows, columns, children, height = 240, footer }: { title: string; subtitle?: ReactNode; rows: (string | number)[][]; columns: string[]; children: ReactNode; height?: number; footer?: ReactNode }) {
  const { t } = useI18n();
  const [table, setTable] = useState(false);
  return (
    <section className="card animate-fade-in">
      <header className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="text-xs muted">{subtitle}</p>}
        </div>
        <button type="button" className="btn-icon h-9 w-9" onClick={() => setTable(!table)} aria-pressed={table} aria-label={table ? t('chart.showChart') : t('chart.showTable')} title={table ? t('chart.showChart') : t('chart.showTable')}>
          {table ? <LineIcon className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
        </button>
      </header>
      {table ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs muted dark:bg-navy-900"><tr>{columns.map((c) => <th key={c} className="py-1 pr-3 font-medium">{c}</th>)}</tr></thead>
            <tbody className="tabular-nums">{rows.map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-navy-800">{r.map((c, j) => <td key={j} className="py-1 pr-3">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} className="-ml-3">{children}</div>
      )}
      {footer}
    </section>
  );
}

const tooltipStyle = (dark: boolean) => ({
  contentStyle: { background: dark ? '#122036' : '#fff', border: `1px solid ${dark ? '#243a5e' : '#e2e8f0'}`, borderRadius: 12, fontSize: 12, color: dark ? '#e2e8f0' : '#0f172a' },
  labelStyle: { fontWeight: 600, marginBottom: 4 }
});

export function WeightTrendChart({ trend, goalKg, height = 240, title, subtitle }: { trend: TrendPoint[]; goalKg?: number; height?: number; title: string; subtitle?: ReactNode }) {
  const i = useI18n();
  const { c, dark } = useChartColors();
  const data = trend.map((p) => ({ date: p.date, observed: +i.weightValue(p.observedKg).toFixed(2), trend: +i.weightValue(p.trendKg).toFixed(2), n: p.n }));
  const values = data.flatMap((d) => [d.observed, d.trend]);
  const goal = goalKg !== undefined ? +i.weightValue(goalKg).toFixed(1) : undefined;
  const min = Math.floor(Math.min(...values) - 1), max = Math.ceil(Math.max(...values) + 1);
  return (
    <ChartFrame title={title} subtitle={subtitle} height={height}
      columns={[i.t('common.date'), `${i.t('weight.observed')} (${i.wUnit})`, `${i.t('weight.trend')} (${i.wUnit})`, 'n']}
      rows={[...data].reverse().map((d) => [i.date(d.date), i.num(d.observed), i.num(d.trend), d.n])}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={i.shortDate} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[goal !== undefined && goal >= min - 5 ? Math.min(min, goal - 1) : min, max]} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => i.num(v, 0)} />
          <Tooltip {...tooltipStyle(dark)} labelFormatter={(l) => i.date(String(l))} formatter={(v: number, name: string) => [`${i.num(v)} ${i.wUnit}`, name]} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          {goal !== undefined && goal >= min - 5 && <ReferenceLine y={goal} stroke={c.target} strokeDasharray="4 4" label={{ value: i.t('profile.goalWeight'), fill: c.axis, fontSize: 11, position: 'insideTopRight' }} />}
          <Scatter name={i.t('weight.observed')} dataKey="observed" fill={c.secondary} fillOpacity={0.55} r={4} isAnimationActive={false} />
          <Line name={i.t('weight.trend7')} dataKey="trend" type="monotone" stroke={c.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function TargetBarChart({ data, target, title, subtitle, unit, seriesName, height = 220 }: { data: { date: string; value: number }[]; target?: number; title: string; subtitle?: ReactNode; unit: string; seriesName: string; height?: number }) {
  const i = useI18n();
  const { c, dark } = useChartColors();
  return (
    <ChartFrame title={title} subtitle={subtitle} height={height} columns={[i.t('common.date'), `${seriesName} (${unit})`]} rows={[...data].reverse().map((d) => [i.date(d.date), i.num(d.value, 0)])}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={i.shortDate} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => i.num(v, 0)} />
          <Tooltip {...tooltipStyle(dark)} cursor={{ fill: dark ? '#ffffff10' : '#0000000a' }} labelFormatter={(l) => i.date(String(l))} formatter={(v: number) => [`${i.num(v, 0)} ${unit}`, seriesName]} />
          {target !== undefined && target > 0 && <ReferenceLine y={target} stroke={c.target} strokeDasharray="4 4" label={{ value: i.t('common.target'), fill: c.axis, fontSize: 11, position: 'insideTopRight' }} />}
          <Bar dataKey="value" name={seriesName} fill={c.primary} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function SimpleLineChart({ data, title, subtitle, unit, seriesName, height = 220, digits = 1, footer }: { data: { date: string; value: number }[]; title: string; subtitle?: ReactNode; unit: string; seriesName: string; height?: number; digits?: number; footer?: ReactNode }) {
  const i = useI18n();
  const { c, dark } = useChartColors();
  return (
    <ChartFrame title={title} subtitle={subtitle} height={height} footer={footer} columns={[i.t('common.date'), `${seriesName} (${unit})`]} rows={[...data].reverse().map((d) => [i.date(d.date), i.num(d.value, digits)])}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={i.shortDate} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => i.num(v, 0)} />
          <Tooltip {...tooltipStyle(dark)} labelFormatter={(l) => i.date(String(l))} formatter={(v: number) => [`${i.num(v, digits)} ${unit}`, seriesName]} />
          <Line dataKey="value" name={seriesName} stroke={c.primary} strokeWidth={2} dot={{ r: 4, fill: c.primary }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Two measures on the same scale (e.g. systolic/diastolic). Both direct-labelled via legend. */
export function TwoLineChart({ data, title, subtitle, unit, names, height = 220 }: { data: { date: string; a: number; b: number }[]; title: string; subtitle?: ReactNode; unit: string; names: [string, string]; height?: number }) {
  const i = useI18n();
  const { c, dark } = useChartColors();
  return (
    <ChartFrame title={title} subtitle={subtitle} height={height} columns={[i.t('common.date'), `${names[0]} (${unit})`, `${names[1]} (${unit})`]} rows={[...data].reverse().map((d) => [i.date(d.date), d.a, d.b])}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={i.shortDate} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip {...tooltipStyle(dark)} labelFormatter={(l) => i.date(String(l))} formatter={(v: number, n: string) => [`${i.num(v, 0)} ${unit}`, n]} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="a" name={names[0]} stroke={c.primary} strokeWidth={2} dot={{ r: 4, fill: c.primary }} isAnimationActive={false} />
          <Line dataKey="b" name={names[1]} stroke={c.secondary} strokeWidth={2} dot={{ r: 4, fill: c.secondary }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
