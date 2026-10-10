import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { Field, Input, Notice, Segmented, Select, Toggle } from '../../components/ui';
import { addWeight, updateProfile, updateSettings } from '../../db/repositories';
import { useToast } from '../../components/feedback';
import { proteinRecommendation } from '../../analytics/nutrition';
import { lengthFromDisplay, lengthToDisplay, weightFromDisplay, weightToDisplay } from '../../utils/units';
import { nowLocal, today } from '../../utils/date';
import type { ConfirmableField, Language, Sex, UnitSystem } from '../../types';

const r1 = (x: number) => String(Math.round(x * 10) / 10);

export function Onboarding() {
  const i = useI18n();
  const { t } = i;
  const { profile: p, settings } = useApp();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const u = settings.units;
  const [f, setF] = useState({
    age: p.age ? String(p.age) : '', sex: p.sex as Sex, height: r1(lengthToDisplay(p.heightCm, u)),
    startWeight: r1(weightToDisplay(p.startWeightKg, u)), startDate: p.startDate,
    currentWeight: p.currentWeightKg ? r1(weightToDisplay(p.currentWeightKg, u)) : '', logCurrent: true,
    goalWeight: p.goalWeightKg ? r1(weightToDisplay(p.goalWeightKg, u)) : '',
    protein: String(p.proteinTargetG), water: String(p.waterTargetMl), workouts: String(p.weeklyWorkoutTarget), calorieTracking: p.calorieTrackingEnabled,
    confirmBasics: false, confirmWeights: false
  });
  const [err, setErr] = useState<string | null>(null);
  const num = (s: string) => Number(s.replace(',', '.'));
  const rec = proteinRecommendation({ heightCm: lengthFromDisplay(num(f.height) || 0, u), goalWeightKg: f.goalWeight ? weightFromDisplay(num(f.goalWeight), u) : undefined });

  const validate = (): boolean => {
    const bad = (s: string, min: number, max: number, req = true) => (s.trim() === '' ? req : !(num(s) >= min && num(s) <= max));
    if (step === 1 && (bad(f.age, 14, 110, false) || bad(f.height, 30, 300))) { setErr(t('val.range')); return false; }
    if (step === 2 && (bad(f.startWeight, 20, 1500) || bad(f.currentWeight, 20, 1500) || bad(f.goalWeight, 20, 1500, false) || !/^\d{4}-\d{2}-\d{2}$/.test(f.startDate))) { setErr(t('onb.weightsInvalid')); return false; }
    if (step === 3 && (bad(f.protein, 20, 400) || bad(f.water, 500, 8000) || bad(f.workouts, 0, 14))) { setErr(t('val.range')); return false; }
    setErr(null);
    return true;
  };

  const finish = async () => {
    if (!validate()) return;
    const confirmed: ConfirmableField[] = [];
    if (f.confirmBasics) confirmed.push('age', 'heightCm', 'sex');
    if (f.confirmWeights) confirmed.push('startWeightKg', 'currentWeightKg', ...(f.goalWeight ? (['goalWeightKg'] as const) : []));
    const currentKg = weightFromDisplay(num(f.currentWeight), u);
    try {
      await updateProfile({
        age: f.age ? num(f.age) : undefined, sex: f.sex, heightCm: lengthFromDisplay(num(f.height), u),
        startWeightKg: weightFromDisplay(num(f.startWeight), u), startDate: f.startDate, currentWeightKg: currentKg,
        goalWeightKg: f.goalWeight ? weightFromDisplay(num(f.goalWeight), u) : undefined,
        proteinTargetG: num(f.protein), waterTargetMl: num(f.water), weeklyWorkoutTarget: num(f.workouts), calorieTrackingEnabled: f.calorieTracking,
        unconfirmed: p.unconfirmed.filter((x) => !confirmed.includes(x)), onboardingComplete: true
      });
      if (f.logCurrent) await addWeight({ dateTime: nowLocal(), weightKg: currentKg, notes: t('onb.initialEntryNote') });
      toast(t('onb.done'));
    } catch { toast(t('toast.saveFailed'), 'error'); }
  };

  const steps = [
    <div key="0" className="space-y-4">
      <h2 className="text-xl font-bold">{t('onb.welcome')}</h2>
      <p className="text-sm muted">{t('onb.intro')}</p>
      <div><p className="label">{t('settings.language')}</p><Segmented label={t('settings.language')} value={settings.language} onChange={(v: Language) => updateSettings({ language: v })} options={[{ value: 'el', label: 'Ελληνικά' }, { value: 'en', label: 'English' }]} /></div>
      <div><p className="label">{t('settings.units')}</p><Segmented label={t('settings.units')} value={u} onChange={async (v: UnitSystem) => {
        const conv = (s: string, kind: 'w' | 'l') => (s ? r1(kind === 'w' ? weightToDisplay(weightFromDisplay(num(s), u), v) : lengthToDisplay(lengthFromDisplay(num(s), u), v)) : s);
        setF({ ...f, height: conv(f.height, 'l'), startWeight: conv(f.startWeight, 'w'), currentWeight: conv(f.currentWeight, 'w'), goalWeight: conv(f.goalWeight, 'w') });
        await updateSettings({ units: v });
      }} options={[{ value: 'metric', label: 'kg / cm' }, { value: 'imperial', label: 'lb / in' }]} /></div>
      <Notice><ShieldCheck className="mr-1 inline h-4 w-4" />{t('onb.privacy')}</Notice>
    </div>,
    <div key="1" className="space-y-3">
      <h2 className="text-xl font-bold">{t('onb.basics')}</h2>
      <Notice tone="warn">{t('onb.prefilled')}</Notice>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('profile.age')} htmlFor="o-age"><Input id="o-age" inputMode="numeric" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} /></Field>
        <Field label={`${t('profile.height')} (${i.lUnit})`} htmlFor="o-h"><Input id="o-h" inputMode="decimal" value={f.height} onChange={(e) => setF({ ...f, height: e.target.value })} /></Field>
      </div>
      <Field label={t('profile.sex')} htmlFor="o-sex" hint={t('profile.sexHint')}>
        <Select id="o-sex" value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value as Sex })}><option value="unspecified">{t('profile.sexUnspecified')}</option><option value="male">{t('profile.sexMale')}</option><option value="female">{t('profile.sexFemale')}</option></Select>
      </Field>
      <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-teal-600" checked={f.confirmBasics} onChange={(e) => setF({ ...f, confirmBasics: e.target.checked })} />{t('onb.confirmCorrect')}</label>
    </div>,
    <div key="2" className="space-y-3">
      <h2 className="text-xl font-bold">{t('onb.weights')}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${t('profile.startWeight')} (${i.wUnit})`} htmlFor="o-sw"><Input id="o-sw" inputMode="decimal" value={f.startWeight} onChange={(e) => setF({ ...f, startWeight: e.target.value })} /></Field>
        <Field label={t('profile.startDate')} htmlFor="o-sd"><Input id="o-sd" type="date" max={today()} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
      </div>
      <Field label={`${t('onb.currentWeightConfirm')} (${i.wUnit})`} htmlFor="o-cw" hint={t('onb.currentWeightHint')}><Input id="o-cw" inputMode="decimal" value={f.currentWeight} onChange={(e) => setF({ ...f, currentWeight: e.target.value })} /></Field>
      <Toggle checked={f.logCurrent} onChange={(v) => setF({ ...f, logCurrent: v })} label={t('onb.logCurrent')} description={t('onb.logCurrentHint')} />
      <Field label={`${t('profile.goalWeight')} (${i.wUnit})`} htmlFor="o-gw" hint={t('profile.optional')}><Input id="o-gw" inputMode="decimal" value={f.goalWeight} onChange={(e) => setF({ ...f, goalWeight: e.target.value })} /></Field>
      <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-teal-600" checked={f.confirmWeights} onChange={(e) => setF({ ...f, confirmWeights: e.target.checked })} />{t('onb.confirmCorrect')}</label>
    </div>,
    <div key="3" className="space-y-3">
      <h2 className="text-xl font-bold">{t('onb.targets')}</h2>
      <Field label={t('settings.proteinTarget')} htmlFor="o-p" hint={rec ? t('settings.proteinRecHint', { low: rec.lowG, high: rec.highG }) : undefined}>
        <div className="flex gap-2"><Input id="o-p" inputMode="numeric" value={f.protein} onChange={(e) => setF({ ...f, protein: e.target.value })} />{rec && <button type="button" className="btn-secondary whitespace-nowrap px-3 text-xs" onClick={() => setF({ ...f, protein: String(rec.midG) })}>{t('settings.useEstimate', { v: rec.midG })}</button>}</div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('settings.waterTarget')} htmlFor="o-w"><Input id="o-w" inputMode="numeric" value={f.water} onChange={(e) => setF({ ...f, water: e.target.value })} /></Field>
        <Field label={t('settings.workoutTarget')} htmlFor="o-wk"><Input id="o-wk" inputMode="numeric" value={f.workouts} onChange={(e) => setF({ ...f, workouts: e.target.value })} /></Field>
      </div>
      <Toggle checked={f.calorieTracking} onChange={(v) => setF({ ...f, calorieTracking: v })} label={t('settings.calorieTracking')} description={t('onb.calorieHint')} />
      <Notice>{t('onb.backupAdvice')}</Notice>
    </div>
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-6 pt-safe">
      <div className="mb-6 flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}icons/favicon.svg`} alt="" className="h-10 w-10" />
        <div><p className="font-bold">Weight Loss Hub</p><p className="text-xs muted">{t('onb.step', { n: step + 1, total: steps.length })}</p></div>
      </div>
      <div className="mb-4 flex gap-1" aria-hidden>{steps.map((_, k) => <div key={k} className={`h-1.5 flex-1 rounded-full ${k <= step ? 'bg-teal-500' : 'bg-slate-200 dark:bg-navy-700'}`} />)}</div>
      <div className="card flex-1 animate-fade-in" key={step}>{steps[step]}{err && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{err}</p>}</div>
      <div className="mt-4 flex gap-2 pb-safe">
        {step > 0 && <button className="btn-secondary" onClick={() => { setErr(null); setStep(step - 1); }}><ArrowLeft className="h-4 w-4" />{t('common.back')}</button>}
        {step < steps.length - 1
          ? <button className="btn-primary ml-auto" onClick={() => validate() && setStep(step + 1)}>{t('common.next')}<ArrowRight className="h-4 w-4" /></button>
          : <button className="btn-primary ml-auto" onClick={finish}><Check className="h-4 w-4" />{t('onb.finish')}</button>}
      </div>
    </div>
  );
}
