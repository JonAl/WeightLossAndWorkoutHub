import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useI18n, type TKey } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { Badge, Field, Input, Select, Textarea } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { optNumber, reqNumber, dateStr } from '../../utils/validation';
import { updateProfile } from '../../db/repositories';
import { lengthFromDisplay, lengthToDisplay, weightFromDisplay, weightToDisplay } from '../../utils/units';
import type { ConfirmableField, Profile } from '../../types';

const schema = z.object({
  birthDate: z.union([z.literal(''), dateStr]),
  age: optNumber(14, 110),
  sex: z.enum(['male', 'female', 'unspecified']),
  height: reqNumber(30, 300),
  startWeight: reqNumber(20, 1500),
  startDate: dateStr,
  currentWeight: optNumber(20, 1500),
  goalWeight: optNumber(20, 1500),
  targetDate: z.union([z.literal(''), dateStr]),
  goalDescription: z.string().max(300),
  trainingExperience: z.enum(['beginner', 'intermediate', 'advanced']),
  trainingSchedule: z.string().max(500),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'high']),
  mealsPerDay: reqNumber(1, 10),
  dietaryNotes: z.string().max(500),
  supplementNotes: z.string().max(500)
});
type FormIn = Record<keyof z.infer<typeof schema>, string>;

export function ProfileForm({ formId, onDone }: { formId: string; onDone?: () => void }) {
  const i = useI18n();
  const { t, units } = i;
  const { profile: p } = useApp();
  const toast = useToast();
  const r1 = (x?: number) => (x === undefined ? '' : String(Math.round(x * 10) / 10));
  const defaults: FormIn = {
    birthDate: p.birthDate ?? '', age: r1(p.age), sex: p.sex, height: r1(lengthToDisplay(p.heightCm, units)),
    startWeight: r1(weightToDisplay(p.startWeightKg, units)), startDate: p.startDate, currentWeight: p.currentWeightKg ? r1(weightToDisplay(p.currentWeightKg, units)) : '',
    goalWeight: p.goalWeightKg ? r1(weightToDisplay(p.goalWeightKg, units)) : '', targetDate: p.targetDate ?? '', goalDescription: p.goalDescription,
    trainingExperience: p.trainingExperience, trainingSchedule: p.trainingSchedule, activityLevel: p.activityLevel, mealsPerDay: String(p.mealsPerDay),
    dietaryNotes: p.dietaryNotes, supplementNotes: p.supplementNotes
  };
  const { register, handleSubmit, formState: { errors, dirtyFields } } = useForm<FormIn>({ defaultValues: defaults, resolver: zodResolver(schema) as never });
  const err = (k: keyof FormIn) => (errors[k]?.message ? t(errors[k]!.message as TKey) : undefined);
  const flag = (f: ConfirmableField) => p.unconfirmed.includes(f) ? <Badge tone="warn">{t('profile.unconfirmed')}</Badge> : null;

  const onSubmit = async (raw: FormIn) => {
    const v = schema.parse(raw);
    // Editing a field counts as confirming it.
    const map: Partial<Record<keyof FormIn, ConfirmableField>> = { age: 'age', birthDate: 'age', height: 'heightCm', startWeight: 'startWeightKg', currentWeight: 'currentWeightKg', sex: 'sex', goalWeight: 'goalWeightKg' };
    const confirmed = new Set(Object.keys(dirtyFields).map((k) => map[k as keyof FormIn]).filter(Boolean));
    const patch: Partial<Profile> = {
      birthDate: v.birthDate || undefined, age: v.age, sex: v.sex, heightCm: lengthFromDisplay(v.height, units),
      startWeightKg: weightFromDisplay(v.startWeight, units), startDate: v.startDate,
      currentWeightKg: v.currentWeight === undefined ? undefined : weightFromDisplay(v.currentWeight, units),
      goalWeightKg: v.goalWeight === undefined ? undefined : weightFromDisplay(v.goalWeight, units),
      targetDate: v.targetDate || undefined, goalDescription: v.goalDescription, trainingExperience: v.trainingExperience,
      trainingSchedule: v.trainingSchedule, activityLevel: v.activityLevel, mealsPerDay: v.mealsPerDay, dietaryNotes: v.dietaryNotes, supplementNotes: v.supplementNotes,
      unconfirmed: p.unconfirmed.filter((f) => !confirmed.has(f))
    };
    try { await updateProfile(patch); toast(t('toast.saved')); onDone?.(); } catch { toast(t('toast.saveFailed'), 'error'); }
  };

  const L = (key: TKey, f?: ConfirmableField) => <span className="inline-flex items-center gap-1.5">{t(key)} {f && flag(f)}</span>;

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
      <Field label={t('profile.birthDate')} error={err('birthDate')} htmlFor="p-bd" hint={t('profile.birthDateHint')}><Input id="p-bd" type="date" {...register('birthDate')} /></Field>
      <Field label={t('profile.age')} error={err('age')} htmlFor="p-age"><Input id="p-age" inputMode="numeric" {...register('age')} /></Field>
      {flag('age') && <div className="sm:col-span-2 -mt-2">{flag('age')}</div>}
      <div><label className="label" htmlFor="p-sex">{L('profile.sex', 'sex')}</label><Select id="p-sex" {...register('sex')}><option value="unspecified">{t('profile.sexUnspecified')}</option><option value="male">{t('profile.sexMale')}</option><option value="female">{t('profile.sexFemale')}</option></Select><p className="mt-1 text-xs muted">{t('profile.sexHint')}</p></div>
      <div><label className="label" htmlFor="p-h">{L('profile.height', 'heightCm')} ({i.lUnit})</label><Input id="p-h" inputMode="decimal" {...register('height')} />{err('height') && <p className="mt-1 text-xs text-red-600">{err('height')}</p>}</div>
      <div><label className="label" htmlFor="p-sw">{L('profile.startWeight', 'startWeightKg')} ({i.wUnit})</label><Input id="p-sw" inputMode="decimal" {...register('startWeight')} />{err('startWeight') && <p className="mt-1 text-xs text-red-600">{err('startWeight')}</p>}</div>
      <Field label={t('profile.startDate')} error={err('startDate')} htmlFor="p-sd"><Input id="p-sd" type="date" {...register('startDate')} /></Field>
      <div><label className="label" htmlFor="p-cw">{L('profile.currentWeight', 'currentWeightKg')} ({i.wUnit})</label><Input id="p-cw" inputMode="decimal" {...register('currentWeight')} /><p className="mt-1 text-xs muted">{t('profile.currentWeightHint')}</p></div>
      <div><label className="label" htmlFor="p-gw">{L('profile.goalWeight', 'goalWeightKg')} ({i.wUnit})</label><Input id="p-gw" inputMode="decimal" {...register('goalWeight')} />{err('goalWeight') && <p className="mt-1 text-xs text-red-600">{err('goalWeight')}</p>}</div>
      <Field label={t('profile.targetDate')} error={err('targetDate')} htmlFor="p-td" hint={t('profile.optional')}><Input id="p-td" type="date" {...register('targetDate')} /></Field>
      <Field label={t('profile.mealsPerDay')} error={err('mealsPerDay')} htmlFor="p-mpd"><Input id="p-mpd" inputMode="numeric" {...register('mealsPerDay')} /></Field>
      <Field label={t('profile.experience')} htmlFor="p-exp"><Select id="p-exp" {...register('trainingExperience')}>{(['beginner', 'intermediate', 'advanced'] as const).map((x) => <option key={x} value={x}>{i.td(`profile.exp.${x}`)}</option>)}</Select></Field>
      <Field label={t('profile.activity')} htmlFor="p-act" hint={t('profile.activityHint')}><Select id="p-act" {...register('activityLevel')}>{(['sedentary', 'light', 'moderate', 'high'] as const).map((x) => <option key={x} value={x}>{i.td(`profile.act.${x}`)}</option>)}</Select></Field>
      <div className="sm:col-span-2"><Field label={t('profile.goal')} htmlFor="p-goal"><Textarea id="p-goal" {...register('goalDescription')} /></Field></div>
      <div className="sm:col-span-2"><Field label={t('profile.schedule')} htmlFor="p-sch" hint={t('profile.scheduleHint')}><Textarea id="p-sch" {...register('trainingSchedule')} /></Field></div>
      <div className="sm:col-span-2"><Field label={t('profile.diet')} htmlFor="p-diet"><Textarea id="p-diet" {...register('dietaryNotes')} /></Field></div>
      <div className="sm:col-span-2"><Field label={t('profile.supplements')} htmlFor="p-sup"><Textarea id="p-sup" {...register('supplementNotes')} /></Field></div>
      <input type="submit" hidden />
    </form>
  );
}
