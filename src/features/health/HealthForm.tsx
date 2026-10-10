import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useI18n, type TKey } from '../../i18n';
import { Field, Input, Select, Textarea, parseOptNum } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { useDraft } from '../../hooks/useDraft';
import { useApp } from '../../app/AppContext';
import { useSchedules } from '../../hooks/useData';
import { nowLocal } from '../../utils/date';
import { dateTimeStr } from '../../utils/validation';
import { addHealth, updateHealth } from '../../db/repositories';
import { HEALTH_KINDS, type HealthEntry, type HealthKind } from '../../types';

/** Allowed ranges per kind for the main numeric value. */
export const HEALTH_RANGES: Partial<Record<HealthKind, [number, number]>> = {
  glucose: [20, 600], heartRate: [25, 220], sleep: [0, 24], energy: [1, 5], hunger: [1, 5], digestive: [1, 5]
};

const schema = z.object({
  kind: z.enum(HEALTH_KINDS as [HealthKind, ...HealthKind[]]),
  dateTime: dateTimeStr,
  value: z.string().optional(), systolic: z.string().optional(), diastolic: z.string().optional(),
  name: z.string().max(120).optional(), dose: z.string().max(80).optional(), sideEffects: z.string().max(500).optional(), notes: z.string().max(500).optional()
}).superRefine((v, ctx) => {
  const num = (k: 'value' | 'systolic' | 'diastolic', min: number, max: number, required: boolean) => {
    const n = parseOptNum(v[k]);
    if (n === undefined) { if (required) ctx.addIssue({ code: 'custom', path: [k], message: 'val.required' }); return; }
    if (!Number.isFinite(n) || n < min || n > max) ctx.addIssue({ code: 'custom', path: [k], message: 'val.range' });
  };
  const r = HEALTH_RANGES[v.kind];
  if (v.kind === 'bloodPressure') { num('systolic', 50, 260, true); num('diastolic', 30, 180, true); }
  else if (v.kind === 'medication' || v.kind === 'supplement') { if (!v.name?.trim()) ctx.addIssue({ code: 'custom', path: ['name'], message: 'val.required' }); }
  else if (v.kind === 'digestive') { if (!v.name?.trim()) ctx.addIssue({ code: 'custom', path: ['name'], message: 'val.required' }); if (r) num('value', r[0], r[1], false); }
  else if (r) num('value', r[0], r[1], true);
});
type FormIn = z.infer<typeof schema>;

export function HealthForm({ entry, onDone, formId, initialKind }: { entry?: HealthEntry; onDone: () => void; formId: string; initialKind?: HealthKind }) {
  const { t, td } = useI18n();
  const toast = useToast();
  const { settings } = useApp();
  const schedules = useSchedules() ?? [];
  const kinds = HEALTH_KINDS.filter((k) => settings.enabledHealthKinds.includes(k) || entry?.kind === k);
  const draft = useDraft<FormIn>(entry ? null : 'health-new');
  const str = (x?: number) => (x === undefined ? '' : String(x));
  const defaults: FormIn = entry
    ? { kind: entry.kind, dateTime: entry.dateTime, value: str(entry.value), systolic: str(entry.systolic), diastolic: str(entry.diastolic), name: entry.name ?? '', dose: entry.dose ?? '', sideEffects: entry.sideEffects ?? '', notes: entry.notes ?? '' }
    : { ...(draft.load() ?? { kind: kinds[0] ?? 'sleep', dateTime: nowLocal(), value: '', systolic: '', diastolic: '', name: '', dose: '', sideEffects: '', notes: '' }), ...(initialKind ? { kind: initialKind } : {}) };
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormIn>({ defaultValues: defaults, resolver: zodResolver(schema) });
  useEffect(() => { const s = watch((v) => draft.save(v as FormIn)); return () => s.unsubscribe(); }, [watch, draft]);
  const kind = watch('kind');
  const err = (k: keyof FormIn) => (errors[k]?.message ? t(errors[k]!.message as TKey) : undefined);
  const range = HEALTH_RANGES[kind];
  const isScale = kind === 'energy' || kind === 'hunger' || kind === 'digestive';
  const matching = schedules.filter((s) => s.active && s.kind === kind);

  const onSubmit = async (v: FormIn) => {
    const rec = {
      kind: v.kind, dateTime: v.dateTime,
      value: parseOptNum(v.value), systolic: v.kind === 'bloodPressure' ? parseOptNum(v.systolic) : undefined, diastolic: v.kind === 'bloodPressure' ? parseOptNum(v.diastolic) : undefined,
      name: v.name?.trim() || undefined, dose: v.dose?.trim() || undefined, sideEffects: v.sideEffects?.trim() || undefined, notes: v.notes?.trim() || undefined
    };
    if (v.kind === 'bloodPressure' || v.kind === 'medication' || v.kind === 'supplement') rec.value = undefined;
    try {
      if (entry) await updateHealth(entry.id, rec); else await addHealth(rec);
      draft.clear();
      toast(t(entry ? 'toast.updated' : 'toast.saved'));
      onDone();
    } catch { toast(t('toast.saveFailed'), 'error'); }
  };

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('health.kind')} htmlFor="h-kind">
          <Select id="h-kind" {...register('kind')} disabled={!!entry}>{kinds.map((k) => <option key={k} value={k}>{td(`health.kind.${k}`)}</option>)}</Select>
        </Field>
        <Field label={t('common.dateTime')} error={err('dateTime')} htmlFor="h-dt"><Input id="h-dt" type="datetime-local" {...register('dateTime')} /></Field>
      </div>

      {kind === 'bloodPressure' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('health.systolic')} error={err('systolic')} htmlFor="h-sys"><Input id="h-sys" inputMode="numeric" {...register('systolic')} /></Field>
          <Field label={t('health.diastolic')} error={err('diastolic')} htmlFor="h-dia"><Input id="h-dia" inputMode="numeric" {...register('diastolic')} /></Field>
        </div>
      )}

      {(kind === 'medication' || kind === 'supplement' || kind === 'digestive') && (
        <>
          {matching.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label={t('health.fromSchedule')}>
              {matching.map((s) => <button key={s.id} type="button" className="chip border-teal-300 text-teal-800 dark:border-teal-700 dark:text-teal-300" onClick={() => { setValue('name', s.name); setValue('dose', s.dose); }}>{s.name} · {s.dose}</button>)}
            </div>
          )}
          <Field label={kind === 'digestive' ? t('health.symptom') : t('health.name')} error={err('name')} htmlFor="h-name"><Input id="h-name" {...register('name')} /></Field>
        </>
      )}
      {(kind === 'medication' || kind === 'supplement') && (
        <>
          <Field label={t('health.dose')} htmlFor="h-dose" hint={t('health.doseHint')}><Input id="h-dose" {...register('dose')} /></Field>
          <Field label={t('health.sideEffects')} htmlFor="h-se"><Textarea id="h-se" {...register('sideEffects')} /></Field>
        </>
      )}

      {range && kind !== 'bloodPressure' && (
        isScale ? (
          <Field label={`${td(`health.valueLabel.${kind}`)} (1–5)`} error={err('value')}>
            <div role="radiogroup" aria-label={td(`health.valueLabel.${kind}`)} className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex-1">
                  <input type="radio" value={String(n)} {...register('value')} className="peer sr-only" />
                  <span className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-slate-300 font-semibold peer-checked:border-teal-600 peer-checked:bg-teal-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500 dark:border-navy-600">{n}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs muted">{td(`health.scaleHint.${kind}`)}</p>
          </Field>
        ) : (
          <Field label={td(`health.valueLabel.${kind}`)} error={err('value')} htmlFor="h-val"><Input id="h-val" inputMode="decimal" {...register('value')} /></Field>
        )
      )}
      <Field label={t('common.notes')} htmlFor="h-notes"><Textarea id="h-notes" {...register('notes')} /></Field>
      <input type="submit" hidden disabled={isSubmitting} />
    </form>
  );
}
