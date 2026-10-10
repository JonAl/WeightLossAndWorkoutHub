import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown } from 'lucide-react';
import { useI18n, type TKey } from '../../i18n';
import { Field, Input, Textarea } from '../../components/ui';
import { useToast, useConfirm } from '../../components/feedback';
import { useDraft } from '../../hooks/useDraft';
import { dateTimeStr, optNumber, reqNumber } from '../../utils/validation';
import { nowLocal } from '../../utils/date';
import { lengthFromDisplay, lengthToDisplay, weightFromDisplay, weightToDisplay } from '../../utils/units';
import { addWeight, findPossibleDuplicate, updateWeight } from '../../db/repositories';
import { db } from '../../db/schema';
import { MEASUREMENT_FIELDS, type WeightEntry } from '../../types';

const schema = z.object({
  dateTime: dateTimeStr,
  weight: reqNumber(20, 1500),
  waistCm: optNumber(20, 400), hipCm: optNumber(20, 400), chestCm: optNumber(20, 400),
  armCm: optNumber(5, 200), thighCm: optNumber(10, 250), neckCm: optNumber(10, 150),
  bodyFatPct: optNumber(2, 75),
  notes: z.string().max(500).optional()
});
type FormIn = Record<keyof z.infer<typeof schema>, string>;

export function WeightForm({ entry, onDone, formId }: { entry?: WeightEntry; onDone: () => void; formId: string }) {
  const i = useI18n();
  const { t, units } = i;
  const toast = useToast();
  const confirm = useConfirm();
  const draft = useDraft<FormIn>(entry ? null : 'weight-new');
  const [showMore, setShowMore] = useState(!!entry && MEASUREMENT_FIELDS.some((f) => entry[f] !== undefined));
  const r1 = (x?: number) => (x === undefined ? '' : String(Math.round(x * 10) / 10));
  const defaults: FormIn = entry
    ? { dateTime: entry.dateTime, weight: r1(weightToDisplay(entry.weightKg, units)), ...Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f, r1(entry[f] === undefined ? undefined : lengthToDisplay(entry[f]!, units))])) as Record<(typeof MEASUREMENT_FIELDS)[number], string>, bodyFatPct: r1(entry.bodyFatPct), notes: entry.notes ?? '' }
    : (draft.load() ?? { dateTime: nowLocal(), weight: '', waistCm: '', hipCm: '', chestCm: '', armCm: '', thighCm: '', neckCm: '', bodyFatPct: '', notes: '' });
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormIn>({ defaultValues: defaults, resolver: zodResolver(schema) as never });

  useEffect(() => { const s = watch((v) => draft.save(v as FormIn)); return () => s.unsubscribe(); }, [watch, draft]);
  const err = (k: keyof FormIn) => (errors[k]?.message ? t(errors[k]!.message as TKey) : undefined);

  const onSubmit = async (raw: FormIn) => {
    const v = schema.parse(raw);
    const rec = {
      dateTime: v.dateTime,
      weightKg: weightFromDisplay(v.weight, units),
      ...Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f, v[f] === undefined ? undefined : lengthFromDisplay(v[f]!, units)])),
      bodyFatPct: v.bodyFatPct,
      notes: v.notes?.trim() || undefined
    } as Omit<WeightEntry, 'id' | 'createdAt' | 'updatedAt'>;
    try {
      const dup = findPossibleDuplicate(await db.weights.toArray(), { ...rec, id: entry?.id });
      if (dup && !(await confirm({ title: t('weight.duplicateTitle'), body: t('weight.duplicateBody', { time: i.dateTime(dup.dateTime), w: i.weight(dup.weightKg) }), confirmLabel: t('weight.saveAnyway') }))) return;
      if (entry) await updateWeight(entry.id, rec);
      else await addWeight(rec);
      draft.clear();
      toast(t(entry ? 'toast.updated' : 'toast.saved'));
      onDone();
    } catch {
      toast(t('toast.saveFailed'), 'error');
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${t('weight.weight')} (${i.wUnit})`} error={err('weight')} htmlFor="w-weight">
          <Input id="w-weight" inputMode="decimal" autoComplete="off" {...register('weight')} placeholder="0.0" />
        </Field>
        <Field label={t('common.dateTime')} error={err('dateTime')} htmlFor="w-dt">
          <Input id="w-dt" type="datetime-local" {...register('dateTime')} />
        </Field>
      </div>
      <button type="button" className="btn-ghost w-full justify-between px-2" aria-expanded={showMore} onClick={() => setShowMore(!showMore)}>
        {t('weight.measurements')} <ChevronDown className={`h-4 w-4 transition ${showMore ? 'rotate-180' : ''}`} />
      </button>
      {showMore && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MEASUREMENT_FIELDS.map((f) => (
            <Field key={f} label={`${i.td(`measure.${f}`)} (${i.lUnit})`} error={err(f)} htmlFor={`w-${f}`}>
              <Input id={`w-${f}`} inputMode="decimal" {...register(f)} />
            </Field>
          ))}
          <Field label={t('weight.bodyFat')} error={err('bodyFatPct')} htmlFor="w-bf" hint={t('weight.bodyFatHint')}>
            <Input id="w-bf" inputMode="decimal" {...register('bodyFatPct')} />
          </Field>
        </div>
      )}
      <Field label={t('common.notes')} htmlFor="w-notes"><Textarea id="w-notes" {...register('notes')} /></Field>
      <input type="submit" hidden disabled={isSubmitting} />
    </form>
  );
}
