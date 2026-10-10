import { useMemo, useState } from 'react';
import { HeartPulse, Pencil, Pill, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { useQuickAdd } from '../../app/QuickAdd';
import { useHealth, useSchedules } from '../../hooks/useData';
import { Badge, Card, EmptyState, Field, Input, Notice, PageHeader, Select, Textarea, Toggle } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { SimpleLineChart, TwoLineChart } from '../../components/charts';
import { useConfirm, useToast } from '../../components/feedback';
import { addHealth, addSchedule, deleteHealth, deleteSchedule, updateSchedule } from '../../db/repositories';
import { dayOf, nowLocal } from '../../utils/date';
import { mean } from '../../utils/stats';
import type { DoseSchedule, HealthEntry, HealthKind } from '../../types';
import { DateRangeSelector, rangeBounds, type RangeKey } from '../../components/DateRangeSelector';

const CHART_KINDS: HealthKind[] = ['glucose', 'heartRate', 'sleep', 'energy', 'hunger'];
const UNIT: Partial<Record<HealthKind, string>> = { glucose: 'mg/dL', heartRate: 'bpm', sleep: 'h', energy: '/5', hunger: '/5', digestive: '/5' };

export function describeHealth(e: HealthEntry, td: (k: string) => string): string {
  if (e.kind === 'bloodPressure') return `${e.systolic}/${e.diastolic} mmHg`;
  if (e.kind === 'medication' || e.kind === 'supplement') return [e.name, e.dose].filter(Boolean).join(' · ');
  if (e.kind === 'digestive') return [e.name, e.value !== undefined ? `${e.value}/5` : ''].filter(Boolean).join(' · ');
  return e.value !== undefined ? `${e.value} ${UNIT[e.kind] ?? ''}` : td('common.na');
}

/** Daily mean per kind (multiple readings per day are averaged). */
function dailySeries(entries: HealthEntry[], kind: HealthKind, pick: (e: HealthEntry) => number | undefined) {
  const m = new Map<string, number[]>();
  for (const e of entries) { if (e.kind !== kind) continue; const v = pick(e); if (typeof v === 'number') m.set(dayOf(e.dateTime), [...(m.get(dayOf(e.dateTime)) ?? []), v]); }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, xs]) => ({ date, value: mean(xs)! }));
}

export function HealthPage() {
  const i = useI18n();
  const { t, td } = i;
  const { settings } = useApp();
  const quick = useQuickAdd();
  const confirm = useConfirm();
  const toast = useToast();
  const health = useHealth(), schedules = useSchedules();
  const [filter, setFilter] = useState<HealthKind | 'all'>('all');
  const [range, setRange] = useState<RangeKey>('30');
  const [schedEdit, setSchedEdit] = useState<DoseSchedule | 'new' | null>(null);
  const enabled = settings.enabledHealthKinds;

  const earliest = health?.[0] ? dayOf(health[0].dateTime) : undefined;
  const { from, to } = rangeBounds(range, earliest);
  const inRange = useMemo(() => (health ?? []).filter((h) => enabled.includes(h.kind) && dayOf(h.dateTime) >= from && dayOf(h.dateTime) <= to), [health, enabled, from, to]);
  if (!health || !schedules) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;

  const list = inRange.filter((h) => filter === 'all' || h.kind === filter).sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  const bp = (() => { const s = dailySeries(inRange, 'bloodPressure', (e) => e.systolic), d = dailySeries(inRange, 'bloodPressure', (e) => e.diastolic); return s.map((x, k) => ({ date: x.date, a: Math.round(x.value), b: Math.round(d[k]?.value ?? 0) })); })();
  const medsEnabled = enabled.includes('medication') || enabled.includes('supplement');

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.health')} actions={enabled.length > 0 && <button className="btn-primary" onClick={() => quick({ type: 'health' })}><Plus className="h-4 w-4" />{t('quick.health')}</button>} />
      <Notice tone="warn"><strong>{t('health.disclaimerTitle')}</strong> {t('health.disclaimer')}</Notice>

      {enabled.length === 0 ? <EmptyState icon={ShieldAlert} title={t('health.allDisabled')} body={t('health.allDisabledBody')} /> : (
        <>
          <div className="flex flex-wrap gap-2">
            {enabled.map((k) => <button key={k} className="chip border-slate-300 hover:border-teal-500 dark:border-navy-600" onClick={() => quick({ type: 'health', kind: k })}><Plus className="h-3.5 w-3.5" />{td(`health.kind.${k}`)}</button>)}
          </div>
          <DateRangeSelector value={range} onChange={setRange} />

          <div className="grid gap-3 lg:grid-cols-2">
            {enabled.includes('bloodPressure') && bp.length >= 2 && <TwoLineChart data={bp} title={td('health.kind.bloodPressure')} unit="mmHg" names={[t('health.systolic'), t('health.diastolic')]} subtitle={t('health.dailyMean')} />}
            {CHART_KINDS.filter((k) => enabled.includes(k)).map((k) => {
              const s = dailySeries(inRange, k, (e) => e.value);
              return s.length >= 2 ? <SimpleLineChart key={k} data={s} title={td(`health.kind.${k}`)} unit={UNIT[k] ?? ''} seriesName={td(`health.kind.${k}`)} subtitle={t('health.dailyMean')} /> : null;
            })}
          </div>

          {medsEnabled && (
            <Card title={t('health.schedules')} subtitle={t('health.schedulesSub')} action={<button className="btn-secondary min-h-[36px] px-3 text-xs" onClick={() => setSchedEdit('new')}><Plus className="h-3.5 w-3.5" />{t('common.add')}</button>}>
              {schedules.length === 0 ? <p className="text-sm muted">{t('health.noSchedules')}</p> : (
                <ul className="divide-y divide-slate-100 dark:divide-navy-800">
                  {schedules.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 py-2">
                      <Pill aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1"><p className="truncate font-medium">{s.name} · {s.dose} {!s.active && <Badge>{t('health.paused')}</Badge>}</p><p className="text-xs muted">{td(`health.kind.${s.kind}`)} · {s.times.join(', ') || t('health.asNeeded')}</p></div>
                      <button className="btn-secondary min-h-[36px] px-3 text-xs" onClick={async () => { await addHealth({ kind: s.kind, dateTime: nowLocal(), name: s.name, dose: s.dose }); toast(t('health.doseLogged')); }}>{t('health.logDose')}</button>
                      <button className="btn-icon" aria-label={t('common.edit')} onClick={() => setSchedEdit(s)}><Pencil className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card title={t('health.history')} action={
            <Select aria-label={t('health.kind')} className="min-h-[36px] w-auto py-1 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as HealthKind | 'all')}>
              <option value="all">{t('common.all')}</option>
              {enabled.map((k) => <option key={k} value={k}>{td(`health.kind.${k}`)}</option>)}
            </Select>}>
            {list.length === 0 ? <EmptyState icon={HeartPulse} title={t('health.emptyTitle')} body={t('health.emptyBody')} /> : (
              <ul className="divide-y divide-slate-100 dark:divide-navy-800">
                {list.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{td(`health.kind.${h.kind}`)}: <span className="tabular-nums">{describeHealth(h, td)}</span></p>
                      <p className="truncate text-xs muted">{i.dateTime(h.dateTime)}{h.sideEffects ? ` · ${t('health.sideEffects')}: ${h.sideEffects}` : ''}{h.notes ? ` · ${h.notes}` : ''}</p>
                    </div>
                    <button className="btn-icon" aria-label={t('common.edit')} onClick={() => quick({ type: 'health', entry: h })}><Pencil className="h-4 w-4" /></button>
                    <button className="btn-icon text-red-600" aria-label={t('common.delete')} onClick={async () => { if (await confirm({ title: t('confirm.deleteTitle'), body: t('confirm.deleteBody'), danger: true, confirmLabel: t('common.delete') })) { await deleteHealth(h.id); toast(t('toast.deleted')); } }}><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      <ScheduleEditor value={schedEdit} onClose={() => setSchedEdit(null)} onDelete={async (id) => { if (await confirm({ title: t('confirm.deleteTitle'), body: t('confirm.deleteBody'), danger: true, confirmLabel: t('common.delete') })) { await deleteSchedule(id); setSchedEdit(null); toast(t('toast.deleted')); } }} />
    </div>
  );
}

function ScheduleEditor({ value, onClose, onDelete }: { value: DoseSchedule | 'new' | null; onClose: () => void; onDelete: (id: string) => void }) {
  const { t, td } = useI18n();
  const toast = useToast();
  const cur = value && value !== 'new' ? value : null;
  const [form, setForm] = useState({ kind: 'supplement' as DoseSchedule['kind'], name: '', dose: '', times: '', notes: '', active: true });
  const [err, setErr] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = value === null ? null : value === 'new' ? 'new' : value.id;
  if (key !== lastKey) {
    setLastKey(key);
    setForm(cur ? { kind: cur.kind, name: cur.name, dose: cur.dose, times: cur.times.join(', '), notes: cur.notes ?? '', active: cur.active } : { kind: 'supplement', name: '', dose: '', times: '', notes: '', active: true });
    setErr(false);
  }
  const save = async () => {
    const times = form.times.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!form.name.trim() || !form.dose.trim() || times.some((x) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(x))) { setErr(true); return; }
    const rec = { kind: form.kind, name: form.name.trim(), dose: form.dose.trim(), times, notes: form.notes.trim() || undefined, active: form.active };
    if (cur) await updateSchedule(cur.id, rec); else await addSchedule(rec);
    toast(t('toast.saved'));
    onClose();
  };
  return (
    <Modal open={value !== null} onClose={onClose} title={cur ? t('health.editSchedule') : t('health.addSchedule')}
      footer={<>{cur && <button className="btn-ghost mr-auto text-red-600" onClick={() => onDelete(cur.id)}>{t('common.delete')}</button>}<button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" onClick={save}>{t('common.save')}</button></>}>
      <div className="space-y-3">
        <Notice>{t('health.scheduleNotice')}</Notice>
        <Field label={t('health.kind')} htmlFor="s-kind"><Select id="s-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as DoseSchedule['kind'] })}><option value="medication">{td('health.kind.medication')}</option><option value="supplement">{td('health.kind.supplement')}</option></Select></Field>
        <Field label={t('health.name')} htmlFor="s-name" error={err && !form.name.trim() ? t('val.required') : undefined}><Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label={t('health.dose')} htmlFor="s-dose" hint={t('health.doseHint')} error={err && !form.dose.trim() ? t('val.required') : undefined}><Input id="s-dose" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} /></Field>
        <Field label={t('health.times')} htmlFor="s-times" hint={t('health.timesHint')} error={err ? t('health.timesError') : undefined}><Input id="s-times" value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} placeholder="08:00, 20:00" /></Field>
        <Field label={t('common.notes')} htmlFor="s-notes"><Textarea id="s-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label={t('health.active')} />
      </div>
    </Modal>
  );
}
