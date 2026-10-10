import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useI18n, type TKey } from '../../i18n';
import { Field, Input, Select, Textarea } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { optNumber, reqNumber, reqString } from '../../utils/validation';
import { addFood, updateFood } from '../../db/repositories';
import type { CustomFood, QuantityUnit } from '../../types';

const UNITS: QuantityUnit[] = ['g', 'ml', 'serving', 'piece'];
const schema = z.object({
  name: reqString, servingSize: reqNumber(0.01, 100000), servingUnit: z.enum(UNITS as [QuantityUnit, ...QuantityUnit[]]),
  calories: optNumber(0, 20000), proteinG: optNumber(0, 1000), carbsG: optNumber(0, 2000), fatG: optNumber(0, 1000), fiberG: optNumber(0, 300),
  notes: z.string().max(500).optional()
});
type FormIn = Record<keyof z.infer<typeof schema>, string>;
const NUTS = ['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'] as const;

export function FoodForm({ food, onDone, formId }: { food?: CustomFood; onDone: () => void; formId: string }) {
  const { t, td } = useI18n();
  const toast = useToast();
  const s = (x?: number) => (x === undefined ? '' : String(x));
  const { register, handleSubmit, formState: { errors } } = useForm<FormIn>({
    defaultValues: food ? { name: food.name, servingSize: s(food.servingSize), servingUnit: food.servingUnit, calories: s(food.calories), proteinG: s(food.proteinG), carbsG: s(food.carbsG), fatG: s(food.fatG), fiberG: s(food.fiberG), notes: food.notes ?? '' }
      : { name: '', servingSize: '100', servingUnit: 'g', calories: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', notes: '' },
    resolver: zodResolver(schema) as never
  });
  const err = (k: keyof FormIn) => (errors[k]?.message ? t(errors[k]!.message as TKey) : undefined);
  const onSubmit = async (raw: FormIn) => {
    const v = schema.parse(raw);
    try {
      if (food) await updateFood(food.id, { ...v, notes: v.notes || undefined });
      else await addFood({ ...v, notes: v.notes || undefined, favorite: false });
      toast(t('toast.saved'));
      onDone();
    } catch { toast(t('toast.saveFailed'), 'error'); }
  };
  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <Field label={t('meal.foodName')} error={err('name')} htmlFor="f-name"><Input id="f-name" {...register('name')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('food.servingSize')} error={err('servingSize')} htmlFor="f-size"><Input id="f-size" inputMode="decimal" {...register('servingSize')} /></Field>
        <Field label={t('meal.unit')} htmlFor="f-unit"><Select id="f-unit" {...register('servingUnit')}>{UNITS.map((u) => <option key={u} value={u}>{td(`unit.${u}`)}</option>)}</Select></Field>
      </div>
      <p className="text-xs muted">{t('food.perServingHint')}</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {NUTS.map((k) => <Field key={k} label={td(`nutrient.${k}`)} error={err(k)} htmlFor={`f-${k}`}><Input id={`f-${k}`} inputMode="decimal" {...register(k)} /></Field>)}
      </div>
      <Field label={t('food.source')} htmlFor="f-notes" hint={t('food.sourceHint')}><Textarea id="f-notes" {...register('notes')} /></Field>
      <input type="submit" hidden />
    </form>
  );
}
