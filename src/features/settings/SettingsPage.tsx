import { useEffect, useState } from 'react';
import { Download, HardDrive, Save, Smartphone, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { Badge, Card, Field, Input, Notice, PageHeader, Segmented, Toggle } from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { deleteAllData, updateProfile, updateSettings } from '../../db/repositories';
import { ProfileForm } from './ProfileForm';
import { ExportImportPanel } from '../reports/ExportImportPanel';
import { HEALTH_KINDS, type ConfirmableField, type Language, type ThemeMode, type UnitSystem } from '../../types';
import { calorieEstimate, proteinRecommendation } from '../../analytics/nutrition';
import { useWeights } from '../../hooks/useData';
import { latestEntry } from '../../analytics/weight';
import { ageFromBirthDate } from '../../utils/date';
import { useInstallPrompt } from '../../hooks/usePwa';
import { lsRemove } from '../../utils/storage';

export function SettingsPage() {
  const i = useI18n();
  const { t, td } = i;
  const { profile, settings } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const weights = useWeights();
  const { canInstall, installed, install } = useInstallPrompt();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');
  const [targets, setTargets] = useState({ protein: String(profile.proteinTargetG), calories: profile.calorieTargetKcal ? String(profile.calorieTargetKcal) : '', fiber: String(profile.fiberTargetG), water: String(profile.waterTargetMl), steps: profile.stepTarget ? String(profile.stepTarget) : '', workouts: String(profile.weeklyWorkoutTarget) });
  const [tErr, setTErr] = useState<string | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    navigator.storage?.estimate?.().then((e) => setUsage(e.usage !== undefined ? `${(e.usage / 1024 / 1024).toFixed(2)} MB` : '')).catch(() => {});
  }, []);

  const rec = proteinRecommendation(profile);
  const age = profile.birthDate ? ageFromBirthDate(profile.birthDate) : profile.age;
  const cal = calorieEstimate(profile, (weights && latestEntry(weights)?.weightKg) ?? profile.currentWeightKg ?? profile.startWeightKg, age);

  const saveTargets = async () => {
    const n = (s: string) => (s.trim() === '' ? undefined : Number(s));
    const p = n(targets.protein), c = n(targets.calories), f = n(targets.fiber), w = n(targets.water), s = n(targets.steps), wk = n(targets.workouts);
    const bad = (x: number | undefined, min: number, max: number, req = false) => (x === undefined ? req : !Number.isFinite(x) || x < min || x > max);
    if (bad(p, 20, 400, true) || bad(c, 1000, 6000) || bad(f, 5, 100, true) || bad(w, 500, 8000, true) || bad(s, 500, 50000) || bad(wk, 0, 14, true)) { setTErr(t('settings.targetsInvalid')); return; }
    setTErr(null);
    await updateProfile({ proteinTargetG: p!, calorieTargetKcal: c, fiberTargetG: f!, waterTargetMl: w!, stepTarget: s, weeklyWorkoutTarget: wk! });
    toast(t('toast.saved'));
  };

  const confirmField = async (f: ConfirmableField) => { await updateProfile({ unconfirmed: profile.unconfirmed.filter((x) => x !== f) }); toast(t('profile.confirmedToast')); };

  const wipe = async () => {
    if (!(await confirm({ title: t('settings.deleteAllTitle'), body: t('settings.deleteAllBody'), danger: true, confirmLabel: t('settings.deleteAllConfirm') }))) return;
    if (!(await confirm({ title: t('settings.deleteAllTitle2'), body: t('settings.deleteAllBody2'), danger: true, confirmLabel: t('settings.deleteAllConfirm') }))) return;
    try {
      await deleteAllData();
      ['draft:weight-new', 'draft:meal-new', 'draft:health-new'].forEach(lsRemove);
      toast(t('settings.deleted'));
    } catch { toast(t('toast.saveFailed'), 'error'); }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.settings')} />

      <Card title={t('settings.preferences')}>
        <div className="space-y-4">
          <div><p className="label">{t('settings.language')}</p><Segmented label={t('settings.language')} value={settings.language} onChange={(v: Language) => updateSettings({ language: v })} options={[{ value: 'el', label: 'Ελληνικά' }, { value: 'en', label: 'English' }]} /></div>
          <div><p className="label">{t('settings.units')}</p><Segmented label={t('settings.units')} value={settings.units} onChange={(v: UnitSystem) => updateSettings({ units: v })} options={[{ value: 'metric', label: 'kg / cm' }, { value: 'imperial', label: 'lb / in' }]} /></div>
          <div><p className="label">{t('settings.theme')}</p><Segmented label={t('settings.theme')} value={settings.theme} onChange={(v: ThemeMode) => updateSettings({ theme: v })} options={[{ value: 'system', label: t('settings.themeSystem') }, { value: 'light', label: t('settings.themeLight') }, { value: 'dark', label: t('settings.themeDark') }]} /></div>
        </div>
      </Card>

      <Card title={t('settings.profile')} subtitle={t('settings.profileSub')}>
        {profile.unconfirmed.length > 0 && (
          <div className="mb-4 space-y-2">
            <Notice tone="warn">{t('profile.unconfirmedNotice')}</Notice>
            <div className="flex flex-wrap gap-2">{profile.unconfirmed.map((f) => <button key={f} className="chip border-amber-300 text-amber-800 dark:border-amber-600 dark:text-amber-300" onClick={() => confirmField(f)}>{t('profile.confirmField', { field: td(`profile.field.${f}`) })}</button>)}</div>
          </div>
        )}
        <ProfileForm formId="profile-form" key={`${profile.updatedAt}-${settings.units}`} />
        <button type="submit" form="profile-form" className="btn-primary mt-4"><Save className="h-4 w-4" />{t('common.save')}</button>
      </Card>

      <Card title={t('settings.targets')} subtitle={t('settings.targetsSub')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('settings.proteinTarget')} htmlFor="t-p" hint={rec ? t('settings.proteinRecHint', { low: rec.lowG, high: rec.highG }) : undefined}>
            <div className="flex gap-2"><Input id="t-p" inputMode="numeric" value={targets.protein} onChange={(e) => setTargets({ ...targets, protein: e.target.value })} />{rec && <button type="button" className="btn-secondary whitespace-nowrap px-3 text-xs" onClick={() => setTargets({ ...targets, protein: String(rec.midG) })}>{t('settings.useEstimate', { v: rec.midG })}</button>}</div>
          </Field>
          <div className="space-y-2">
            <Toggle checked={profile.calorieTrackingEnabled} onChange={(v) => updateProfile({ calorieTrackingEnabled: v })} label={t('settings.calorieTracking')} />
            {profile.calorieTrackingEnabled && (
              <Field label={t('settings.calorieTarget')} htmlFor="t-c" hint={cal ? t('settings.calorieEstHint', { v: cal.suggested, m: cal.maintenance }) : t('ni.calorieNeeds')}>
                <div className="flex gap-2"><Input id="t-c" inputMode="numeric" value={targets.calories} onChange={(e) => setTargets({ ...targets, calories: e.target.value })} />{cal && <button type="button" className="btn-secondary whitespace-nowrap px-3 text-xs" onClick={() => setTargets({ ...targets, calories: String(cal.suggested) })}>{t('settings.useEstimate', { v: cal.suggested })}</button>}</div>
              </Field>
            )}
          </div>
          <Field label={t('settings.fiberTarget')} htmlFor="t-f"><Input id="t-f" inputMode="numeric" value={targets.fiber} onChange={(e) => setTargets({ ...targets, fiber: e.target.value })} /></Field>
          <Field label={t('settings.waterTarget')} htmlFor="t-w"><Input id="t-w" inputMode="numeric" value={targets.water} onChange={(e) => setTargets({ ...targets, water: e.target.value })} /></Field>
          <Field label={t('settings.stepTarget')} htmlFor="t-s" hint={t('profile.optional')}><Input id="t-s" inputMode="numeric" value={targets.steps} onChange={(e) => setTargets({ ...targets, steps: e.target.value })} /></Field>
          <Field label={t('settings.workoutTarget')} htmlFor="t-wk"><Input id="t-wk" inputMode="numeric" value={targets.workouts} onChange={(e) => setTargets({ ...targets, workouts: e.target.value })} /></Field>
        </div>
        {tErr && <p role="alert" className="mt-2 text-sm text-red-600">{tErr}</p>}
        <p className="mt-2 text-xs muted">{t('settings.estimatesNote')}</p>
        <button className="btn-primary mt-3" onClick={saveTargets}><Save className="h-4 w-4" />{t('common.save')}</button>
      </Card>

      <Card title={t('settings.healthCategories')} subtitle={t('settings.healthCategoriesSub')}>
        <div className="divide-y divide-slate-100 dark:divide-navy-800">
          {HEALTH_KINDS.map((k) => (
            <Toggle key={k} label={td(`health.kind.${k}`)} checked={settings.enabledHealthKinds.includes(k)}
              onChange={(v) => updateSettings({ enabledHealthKinds: v ? [...settings.enabledHealthKinds, k] : settings.enabledHealthKinds.filter((x) => x !== k) })} />
          ))}
        </div>
      </Card>

      <Card title={t('settings.app')}>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Smartphone aria-hidden className="h-4 w-4 text-slate-400" />
            {installed ? <Badge tone="good">{t('pwa.installed')}</Badge> : canInstall
              ? <button className="btn-primary" onClick={install}><Download className="h-4 w-4" />{t('pwa.install')}</button>
              : <span className="muted">{t('pwa.manual')}</span>}
          </div>
          <p className="text-xs muted">{t('pwa.httpsNote')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <HardDrive aria-hidden className="h-4 w-4 text-slate-400" />
            <span>{t('settings.storage')}: {persisted === null ? t('common.unknown') : persisted ? <Badge tone="good">{t('settings.persisted')}</Badge> : <Badge tone="warn">{t('settings.notPersisted')}</Badge>} {usage && <span className="muted">· {usage}</span>}</span>
            {persisted === false && <button className="btn-secondary min-h-[36px] px-3 text-xs" onClick={async () => { const ok = await navigator.storage?.persist?.(); setPersisted(!!ok); toast(ok ? t('settings.persistGranted') : t('settings.persistDenied'), ok ? 'success' : 'info'); }}>{t('settings.requestPersist')}</button>}
          </div>
          <p className="text-xs muted">{t('settings.privacy')}</p>
        </div>
      </Card>

      <ExportImportPanel />

      <Card title={t('settings.dangerZone')}>
        <p className="mb-3 text-sm muted">{t('settings.deleteAllHint')}</p>
        <button className="btn-danger" onClick={wipe}><Trash2 className="h-4 w-4" />{t('settings.deleteAll')}</button>
      </Card>
    </div>
  );
}
