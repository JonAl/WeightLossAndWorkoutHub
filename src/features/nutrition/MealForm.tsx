import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useI18n, type TKey } from '../../i18n';
import { Field, Input, Select, Textarea } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { useDraft } from '../../hooks/useDraft';
import { useFoods } from '../../hooks/useData';
import { dateTimeStr, optNumber, reqNumber, reqString } from '../../utils/validation';
import { nowLocal } from '../../utils/date';
import { addFood, addMeal, updateMeal } from '../../db/repositories';
import { MEAL_CATEGORIES, type CustomFood, type MealCategory, type MealEntry, type QuantityUnit } from '../../types';
import { scaleNutrient } from '../../utils/units';

const UNITS: QuantityUnit[] = ['g', 'ml', 'serving', 'piece'];
const NUTS = ['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'] as const;

const schema = z.object({
  dateTime: dateTimeStr,
  category: z.enum(MEAL_CATEGORIES as [MealCategory, ...MealCategory[]]),
  foodName: reqString,
  quantity: reqNumber(0.01, 100000),
  unit: z.enum(UNITS as [QuantityUnit, ...QuantityUnit[]]),
  calories: optNumber(0, 20000), proteinG: optNumber(0, 1000), carbsG: optNumber(0, 2000), fatG: optNumber(0, 1000), fiberG: optNumber(0, 300),
  notes: z.string().max(500).optional(),
  saveAsFood: z.boolean().optional()
});
type FormIn = { [K in keyof z.infer<typeof schema>]: K extends 'saveAsFood' ? boolean : string };

export function defaultCategory(d = new Date()): MealCategory {
  const h = d.getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}

/** Convert an eaten quantity to the food's own unit. Returns undefined if no explicit conversion exists. */
export function toFoodUnit(q: number, unit: QuantityUnit, food: Pick<CustomFood, 'servingSize' | 'servingUnit'>): number | undefined {
  if (unit === food.servingUnit) return q;
  if (unit === 'serving') return q * food.servingSize; // 1 serving = servingSize of the food's unit
  return undefined;
}

export function MealForm({ entry, onDone, formId, preset }: { entry?: MealEntry; onDone: () => void; formId: string; preset?: Partial<FormIn> }) {
  const { t, td } = useI18n();
  const toast = useToast();
  const foods = useFoods() ?? [];
  const draft = useDraft<FormIn>(entry || preset ? null : 'meal-new');
  const s = (x?: number) => (x === undefined ? '' : String(Math.round(x * 10) / 10));
  const defaults: FormIn = entry
    ? { dateTime: entry.dateTime, category: entry.category, foodName: entry.foodName, quantity: String(entry.quantity), unit: entry.unit, calories: s(entry.calories), proteinG: s(entry.proteinG), carbsG: s(entry.carbsG), fatG: s(entry.fatG), fiberG: s(entry.fiberG), notes: entry.notes ?? '', saveAsFood: false }
    : { ...(draft.load() ?? { dateTime: nowLocal(), category: defaultCategory(), foodName: '', quantity: '1', unit: 'serving', calories: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', notes: '', saveAsFood: false }), ...preset };
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormIn>({ defaultValues: defaults, resolver: zodResolver(schema) as never });
  const [food, setFood] = useState<CustomFood | null>(null);
  const [conversionWarning, setConversionWarning] = useState(false);

  useEffect(() => { const sub = watch((v) => draft.save(v as FormIn)); return () => sub.unsubscribe(); }, [watch, draft]);

  // Recalculate nutrients from the selected custom food whenever quantity/unit change.
  const qty = watch('quantity'), unit = watch('unit');
  useEffect(() => {
    if (!food) return;
    const q = Number(String(qty).replace(',', '.'));
    if (!(q > 0)) return;
    const inFoodUnit = toFoodUnit(q, unit as QuantityUnit, food);
    setConversionWarning(inFoodUnit === undefined);
    if (inFoodUnit === undefined) return;
    for (const k of NUTS) setValue(k, s(scaleNutrient(food[k], food.servingSize, inFoodUnit)));
  }, [food, qty, unit, setValue]);

  const pickFood = (id: string) => {
    const f = foods.find((x) => x.id === id) ?? null;
    setFood(f);
    if (f) {
      setValue('foodName', f.name);
      setValue('unit', f.servingUnit);
      setValue('quantity', String(f.servingSize));
    }
  };

  const err = (k: keyof FormIn) => (errors[k]?.message ? t(errors[k]!.message as TKey) : undefined);

  const onSubmit = async (raw: FormIn) => {
    const v = schema.parse(raw);
    const rec = { dateTime: v.dateTime, category: v.category, foodName: v.foodName, quantity: v.quantity, unit: v.unit, calories: v.calories, proteinG: v.proteinG, carbsG: v.carbsG, fatG: v.fatG, fiberG: v.fiberG, notes: v.notes?.trim() || undefined, foodId: food?.id ?? entry?.foodId };
    try {
      if (entry) await updateMeal(entry.id, rec);
      else await addMeal(rec);
      if (v.saveAsFood && !food) {
        await addFood({ name: v.foodName, servingSize: v.quantity, servingUnit: v.unit, calories: v.calories, proteinG: v.proteinG, carbsG: v.carbsG, fatG: v.fatG, fiberG: v.fiberG, favorite: false });
      }
      draft.clear();
      toast(t(entry ? 'toast.updated' : 'toast.saved'));
      onDone();
    } catch {
      toast(t('toast.saveFailed'), 'error');
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      {foods.length > 0 && !entry && (
        <Field label={t('meal.fromFood')} htmlFor="m-food">
          <Select id="m-food" value={food?.id ?? ''} onChange={(e) => pickFood(e.target.value)}>
            <option value="">{t('meal.manualEntry')}</option>
            {[...foods].sort((a, b) => Number(b.favorite) - Number(a.favorite)).map((f) => <option key={f.id} value={f.id}>{f.favorite ? '★ ' : ''}{f.name}</option>)}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('meal.category')} htmlFor="m-cat">
          <Select id="m-cat" {...register('category')}>{MEAL_CATEGORIES.map((c) => <option key={c} value={c}>{td(`meal.cat.${c}`)}</option>)}</Select>
        </Field>
        <Field label={t('common.dateTime')} error={err('dateTime')} htmlFor="m-dt"><Input id="m-dt" type="datetime-local" {...register('dateTime')} /></Field>
      </div>
      <Field label={t('meal.foodName')} error={err('foodName')} htmlFor="m-name"><Input id="m-name" autoComplete="off" {...register('foodName')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('meal.quantity')} error={err('quantity')} htmlFor="m-q"><Input id="m-q" inputMode="decimal" {...register('quantity')} /></Field>
        <Field label={t('meal.unit')} htmlFor="m-u"><Select id="m-u" {...register('unit')}>{UNITS.map((u) => <option key={u} value={u}>{td(`unit.${u}`)}</option>)}</Select></Field>
      </div>
      {food && <p className="text-xs muted">{t('meal.calculatedFrom', { name: food.name, size: food.servingSize, unit: td(`unit.${food.servingUnit}`) })}</p>}
      {conversionWarning && <p role="alert" className="text-xs font-medium text-amber-700 dark:text-amber-300">{t('meal.noConversion')}</p>}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {NUTS.map((k) => (
          <Field key={k} label={td(`nutrient.${k}`)} error={err(k)} htmlFor={`m-${k}`}><Input id={`m-${k}`} inputMode="decimal" {...register(k)} /></Field>
        ))}
      </div>
      <p className="text-xs muted">{t('meal.blankHint')}</p>
      <Field label={t('common.notes')} htmlFor="m-notes"><Textarea id="m-notes" {...register('notes')} /></Field>
      {!entry && !food && (
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-teal-600" {...register('saveAsFood')} />{t('meal.saveAsFood')}</label>
      )}
      <input type="submit" hidden disabled={isSubmitting} />
    </form>
  );
}
