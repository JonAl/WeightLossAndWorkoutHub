import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Droplets, Pencil, Plus, Star, Trash2, Utensils, BookmarkPlus, Apple } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { useQuickAdd } from '../../app/QuickAdd';
import { useFoods, useMeals, useSavedMeals, useWater } from '../../hooks/useData';
import { Card, EmptyState, Notice, PageHeader, ProgressBar, Segmented, Badge } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { useConfirm, useToast } from '../../components/feedback';
import { addDays, dayOf, nowLocal, today } from '../../utils/date';
import { averageNutrient, calorieAdherence, calorieEstimate, dailyNutrition, proteinAdherence, proteinRecommendation, sumNutrients, topProteinFoods } from '../../analytics/nutrition';
import { addMeal, addSavedMeal, addWater, deleteFood, deleteMeal, deleteSavedMeal, deleteWater, logSavedMeal, updateFood } from '../../db/repositories';
import { MEAL_CATEGORIES, type CustomFood, type MealCategory, type MealEntry } from '../../types';
import { FoodForm } from './FoodForm';
import { MealPlanTab } from './MealPlanTab';
import { latestEntry } from '../../analytics/weight';
import { useWeights } from '../../hooks/useData';
import { ageFromBirthDate } from '../../utils/date';

export function NutritionPage() {
  const i = useI18n();
  const { t, td } = i;
  const [tab, setTab] = useState<'log' | 'plan' | 'foods' | 'insights'>('log');
  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.nutrition')} />
      <Segmented label={t('nutrition.tabs')} value={tab} onChange={setTab} options={[{ value: 'log', label: t('nutrition.tabLog') }, { value: 'plan', label: t('nutrition.tabPlan') }, { value: 'foods', label: t('nutrition.tabFoods') }, { value: 'insights', label: t('nutrition.tabInsights') }]} />
      {tab === 'log' && <DayLog />}
      {tab === 'plan' && <MealPlanTab />}
      {tab === 'foods' && <FoodsTab />}
      {tab === 'insights' && <NutritionInsights />}
      <span className="sr-only">{td('nav.nutrition')}</span>
    </div>
  );
}

function DayLog() {
  const i = useI18n();
  const { t, td } = i;
  const { profile } = useApp();
  const quick = useQuickAdd();
  const confirm = useConfirm();
  const toast = useToast();
  const meals = useMeals(), water = useWater(), saved = useSavedMeals();
  const [day, setDay] = useState(today());
  const [waterMl, setWaterMl] = useState('');

  const dayMeals = useMemo(() => (meals ?? []).filter((m) => dayOf(m.dateTime) === day), [meals, day]);
  const dayWater = useMemo(() => (water ?? []).filter((w) => dayOf(w.dateTime) === day), [water, day]);
  const totals = sumNutrients(dayMeals);
  const waterTotal = dayWater.reduce((a, w) => a + w.ml, 0);
  const week = useMemo(() => {
    const nut = dailyNutrition(meals ?? []);
    return Array.from({ length: 7 }, (_, k) => addDays(day, k - 6)).map((d) => ({ d, n: nut.get(d) }));
  }, [meals, day]);
  if (!meals || !water || !saved) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;

  const atTime = (d: string) => (d === today() ? nowLocal() : `${d}T12:00`);
  const duplicate = async (m: MealEntry) => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = m;
    await addMeal({ ...rest, dateTime: atTime(today()) });
    toast(t('nutrition.duplicated'));
  };
  const remove = async (m: MealEntry) => {
    if (!(await confirm({ title: t('confirm.deleteTitle'), body: t('confirm.deleteBody'), confirmLabel: t('common.delete'), danger: true }))) return;
    await deleteMeal(m.id); toast(t('toast.deleted'));
  };
  const saveGroup = async (cat: MealCategory, items: MealEntry[]) => {
    const name = window.prompt(t('nutrition.savedMealName'), `${td(`meal.cat.${cat}`)} ${i.shortDate(day)}`);
    if (!name?.trim()) return;
    await addSavedMeal({ name: name.trim(), category: cat, items: items.map((m) => ({ foodName: m.foodName, quantity: m.quantity, unit: m.unit, calories: m.calories, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG, fiberG: m.fiberG })) });
    toast(t('nutrition.mealSaved'));
  };

  const rows: { k: 'calories' | 'proteinG' | 'fiberG'; target?: number; unit: string }[] = [
    { k: 'proteinG', target: profile.proteinTargetG, unit: 'g' },
    ...(profile.calorieTrackingEnabled ? [{ k: 'calories' as const, target: profile.calorieTargetKcal, unit: 'kcal' }] : []),
    { k: 'fiberG', target: profile.fiberTargetG, unit: 'g' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="btn-icon" aria-label={t('common.prevDay')} onClick={() => setDay(addDays(day, -1))}><ChevronLeft className="h-5 w-5" /></button>
        <input type="date" aria-label={t('common.date')} className="input w-auto" value={day} max={today()} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <button className="btn-icon" aria-label={t('common.nextDay')} disabled={day >= today()} onClick={() => setDay(addDays(day, 1))}><ChevronRight className="h-5 w-5" /></button>
        <button className="btn-primary ml-auto" onClick={() => quick({ type: 'meal' })}><Plus className="h-4 w-4" />{t('quick.meal')}</button>
      </div>

      <Card title={t('nutrition.dayTotals')}>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.k}>
              <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{td(`nutrient.${r.k}`)}</span>
                <span className="tabular-nums">{i.num(totals[r.k], 0)}{r.target ? ` / ${i.num(r.target, 0)}` : ''} {r.unit}{r.target ? <span className="muted"> · {totals[r.k] >= r.target ? t('dash.targetMet') : t('nutrition.left', { v: i.num(r.target - totals[r.k], 0) })}</span> : null}</span></div>
              {r.target ? <ProgressBar value={totals[r.k]} max={r.target} label={td(`nutrient.${r.k}`)} /> : null}
            </div>
          ))}
          <p className="text-xs muted">{t('nutrition.macros', { c: i.num(totals.carbsG, 0), f: i.num(totals.fatG, 0) })}</p>
        </div>
      </Card>

      {dayMeals.length === 0 ? (
        <EmptyState icon={Utensils} title={t('nutrition.emptyTitle')} body={t('nutrition.emptyBody')} action={<button className="btn-primary" onClick={() => quick({ type: 'meal' })}>{t('quick.meal')}</button>} />
      ) : MEAL_CATEGORIES.map((cat) => {
        const items = dayMeals.filter((m) => m.category === cat).sort((a, b) => a.dateTime.localeCompare(b.dateTime));
        if (!items.length) return null;
        const s = sumNutrients(items);
        return (
          <Card key={cat} title={td(`meal.cat.${cat}`)} subtitle={`${i.num(s.proteinG, 0)} g ${t('nutrient.proteinShort')}${profile.calorieTrackingEnabled ? ` · ${i.num(s.calories, 0)} kcal` : ''}`}
            action={<button className="btn-icon" aria-label={t('nutrition.saveAsMeal')} title={t('nutrition.saveAsMeal')} onClick={() => saveGroup(cat, items)}><BookmarkPlus className="h-4 w-4" /></button>}>
            <ul className="divide-y divide-slate-100 dark:divide-navy-800">
              {items.map((m) => (
                <li key={m.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.foodName}</p>
                    <p className="text-xs muted tabular-nums">{i.num(m.quantity)} {td(`unit.${m.unit}`)} · {m.proteinG !== undefined ? `${i.num(m.proteinG, 0)} g P` : `${t('common.na')} P`}{profile.calorieTrackingEnabled ? ` · ${m.calories !== undefined ? `${i.num(m.calories, 0)} kcal` : `${t('common.na')} kcal`}` : ''} · {m.dateTime.slice(11, 16)}</p>
                  </div>
                  <button className="btn-icon" aria-label={t('nutrition.duplicateToday')} title={t('nutrition.duplicateToday')} onClick={() => duplicate(m)}><Copy className="h-4 w-4" /></button>
                  <button className="btn-icon" aria-label={t('common.edit')} onClick={() => quick({ type: 'meal', entry: m })}><Pencil className="h-4 w-4" /></button>
                  <button className="btn-icon text-red-600" aria-label={t('common.delete')} onClick={() => remove(m)}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      <Card title={t('dash.water')} action={<Droplets aria-hidden className="h-4 w-4 text-slate-400" />}>
        <p className="mb-2 text-sm tabular-nums">{i.num(waterTotal, 0)} / {i.num(profile.waterTargetMl, 0)} ml</p>
        <ProgressBar value={waterTotal} max={profile.waterTargetMl} label={t('dash.water')} />
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={async (e) => {
          e.preventDefault();
          const n = Number(waterMl);
          if (!(n > 0 && n <= 5000)) { toast(t('val.range'), 'error'); return; }
          await addWater(n, atTime(day)); setWaterMl(''); toast(t('toast.saved'));
        }}>
          {[250, 500].map((ml) => <button key={ml} type="button" className="btn-secondary" onClick={async () => { await addWater(ml, atTime(day)); toast(t('dash.waterAdded', { ml })); }}>+{ml} ml</button>)}
          <input aria-label={t('nutrition.customMl')} className="input w-28" inputMode="numeric" placeholder="ml" value={waterMl} onChange={(e) => setWaterMl(e.target.value)} />
          <button className="btn-secondary" type="submit">{t('common.add')}</button>
        </form>
        {dayWater.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {dayWater.map((w) => <li key={w.id}><button className="chip border-slate-300 dark:border-navy-600" aria-label={t('nutrition.removeWater', { ml: w.ml })} onClick={async () => { await deleteWater(w.id); toast(t('toast.deleted')); }}>{w.ml} ml · {w.dateTime.slice(11, 16)} <Trash2 className="h-3 w-3" /></button></li>)}
          </ul>
        )}
      </Card>

      <Card title={t('nutrition.savedMeals')} subtitle={t('nutrition.savedMealsSub')}>
        {saved.length === 0 ? <p className="text-sm muted">{t('nutrition.noSavedMeals')}</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-navy-800">
            {saved.map((s) => {
              const n = sumNutrients(s.items);
              return (
                <li key={s.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{s.name}</p><p className="text-xs muted">{td(`meal.cat.${s.category}`)} · {s.items.length} · {i.num(n.proteinG, 0)} g P</p></div>
                  <button className="btn-secondary min-h-[36px] px-3 text-xs" onClick={async () => { await logSavedMeal(s, atTime(day)); toast(t('nutrition.logged')); }}>{t('nutrition.logIt')}</button>
                  <button className="btn-icon text-red-600" aria-label={t('common.delete')} onClick={async () => { if (await confirm({ title: t('confirm.deleteTitle'), body: t('confirm.deleteBody'), danger: true, confirmLabel: t('common.delete') })) { await deleteSavedMeal(s.id); toast(t('toast.deleted')); } }}><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title={t('nutrition.weekTotals')} subtitle={t('nutrition.weekEnding', { date: i.date(day) })}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-left text-xs muted"><tr><th className="py-1 font-medium">{t('common.date')}</th><th className="font-medium">kcal</th><th className="font-medium">P</th><th className="font-medium">C</th><th className="font-medium">F</th><th className="font-medium">{t('nutrient.fiberShort')}</th></tr></thead>
            <tbody className="tabular-nums">
              {week.map(({ d, n }) => (
                <tr key={d} className="border-t border-slate-100 dark:border-navy-800">
                  <td className="py-1.5">{i.date(d, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  {n ? <><td>{i.num(n.calories, 0)}</td><td>{i.num(n.proteinG, 0)}</td><td>{i.num(n.carbsG, 0)}</td><td>{i.num(n.fatG, 0)}</td><td>{i.num(n.fiberG, 0)}</td></> : <td colSpan={5} className="muted">{t('common.notLogged')}</td>}
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 font-semibold dark:border-navy-700">
                <td className="py-1.5">{t('nutrition.avgLogged', { n: week.filter((w) => w.n).length })}</td>
                {(['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'] as const).map((k) => { const xs = week.filter((w) => w.n).map((w) => w.n![k]); return <td key={k}>{xs.length ? i.num(xs.reduce((a, b) => a + b, 0) / xs.length, 0) : '—'}</td>; })}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FoodsTab() {
  const i = useI18n();
  const { t, td } = i;
  const foods = useFoods();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<CustomFood | 'new' | null>(null);
  if (!foods) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;
  return (
    <div className="space-y-3">
      <Notice>{t('food.notice')}</Notice>
      <button className="btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />{t('food.add')}</button>
      {foods.length === 0 ? <EmptyState icon={Apple} title={t('food.emptyTitle')} body={t('food.emptyBody')} /> : (
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-navy-800">
            {[...foods].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name)).map((f) => (
              <li key={f.id} className="flex items-center gap-2 py-2">
                <button className="btn-icon" aria-pressed={f.favorite} aria-label={t('food.favorite')} onClick={() => updateFood(f.id, { favorite: !f.favorite })}><Star className={`h-4 w-4 ${f.favorite ? 'fill-amber-400 text-amber-500' : ''}`} /></button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.name} <Badge>{t('food.userEntered')}</Badge></p>
                  <p className="text-xs muted tabular-nums">{t('food.per', { size: i.num(f.servingSize), unit: td(`unit.${f.servingUnit}`) })}: {f.calories ?? '—'} kcal · {f.proteinG ?? '—'} g P · {f.carbsG ?? '—'} g C · {f.fatG ?? '—'} g F · {f.fiberG ?? '—'} g {t('nutrient.fiberShort')}</p>
                </div>
                <button className="btn-icon" aria-label={t('common.edit')} onClick={() => setEditing(f)}><Pencil className="h-4 w-4" /></button>
                <button className="btn-icon text-red-600" aria-label={t('common.delete')} onClick={async () => { if (await confirm({ title: t('confirm.deleteTitle'), body: t('food.deleteBody'), danger: true, confirmLabel: t('common.delete') })) { await deleteFood(f.id); toast(t('toast.deleted')); } }}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('food.add') : t('food.edit')} wide
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="food-form">{t('common.save')}</button></>}>
        {editing && <FoodForm formId="food-form" food={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function NutritionInsights() {
  const i = useI18n();
  const { t } = i;
  const { profile } = useApp();
  const meals = useMeals();
  const weights = useWeights();
  const d = useMemo(() => {
    if (!meals) return null;
    const nut = dailyNutrition(meals);
    const d0 = today();
    const w7 = addDays(d0, -6), w30 = addDays(d0, -29);
    return {
      todayP: nut.get(d0)?.proteinG,
      p7: proteinAdherence(nut, profile.proteinTargetG, w7, d0),
      p30: proteinAdherence(nut, profile.proteinTargetG, w30, d0),
      fiber7: averageNutrient(nut, 'fiberG', w7, d0),
      cal30: profile.calorieTargetKcal ? calorieAdherence(nut, profile.calorieTargetKcal, w30, d0) : null,
      top: topProteinFoods(meals, w30, d0)
    };
  }, [meals, profile]);
  if (!d || !weights) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;
  const rec = proteinRecommendation(profile);
  const latest = latestEntry(weights);
  const age = profile.birthDate ? ageFromBirthDate(profile.birthDate) : profile.age;
  const cal = calorieEstimate(profile, latest?.weightKg ?? profile.currentWeightKg ?? profile.startWeightKg, age);

  const qa: [string, string][] = [
    [t('ni.qToday'), d.todayP === undefined ? t('ni.aNoMealsToday') : d.todayP >= profile.proteinTargetG ? t('ni.aTodayYes', { p: i.num(d.todayP, 0) }) : t('ni.aTodayNo', { p: i.num(d.todayP, 0), left: i.num(profile.proteinTargetG - d.todayP, 0) })],
    [t('ni.qWeekAvg'), d.p7.loggedDays ? t('ni.aWeekAvg', { avg: i.num(d.p7.average, 0), n: d.p7.loggedDays, target: profile.proteinTargetG }) : t('common.insufficient')],
    [t('ni.qBelow'), d.p7.loggedDays ? (d.p7.belowDays.length ? d.p7.belowDays.map((x) => i.date(x, { weekday: 'short', day: 'numeric', month: 'short' })).join(', ') : t('ni.aNoneBelow')) : t('common.insufficient')],
    [t('ni.qFiber'), d.fiber7.n >= 3 ? t('ni.aFiber', { avg: i.num(d.fiber7.avg, 0), target: profile.fiberTargetG, n: d.fiber7.n }) + (d.fiber7.avg! >= profile.fiberTargetG * 0.8 ? ` ${t('ni.aFiberOk')}` : ` ${t('ni.aFiberLow')}`) : t('ni.aFewDays', { n: d.fiber7.n })],
    [t('ni.qMonth'), d.p30.loggedDays ? t('ni.aMonth', { logged: d.p30.loggedDays, met: d.p30.metDays, pct: i.num(d.p30.pct, 0) }) + (d.cal30 ? ` ${t('ni.aMonthCal', { pct: i.num(d.cal30.pct, 0) })}` : '') : t('common.insufficient')],
    [t('ni.qTopMeals'), d.top.length ? d.top.map((x) => `${x.name} (${i.num(x.proteinG, 0)} g, ${x.count}×)`).join(' · ') : t('common.insufficient')]
  ];

  return (
    <div className="space-y-4">
      <Card title={t('ni.title')} subtitle={t('ni.subtitle')}>
        <dl className="space-y-3">
          {qa.map(([q, a]) => <div key={q}><dt className="text-sm font-semibold">{q}</dt><dd className="text-sm muted">{a}</dd></div>)}
        </dl>
      </Card>
      <Card title={t('ni.proteinRec')} subtitle={t('common.estimate')}>
        {rec ? (
          <>
            <p className="text-sm">{t('ni.proteinRecBody', { low: rec.lowG, high: rec.highG, mid: rec.midG, ref: i.weight(rec.referenceKg), source: rec.referenceSource === 'goal' ? t('ni.refGoal') : t('ni.refBmi') })}</p>
            <p className="mt-2 text-xs muted">{t('ni.proteinRecWhy')}</p>
            <p className="mt-2 text-sm">{t('ni.yourTarget', { g: profile.proteinTargetG })}</p>
          </>
        ) : <p className="text-sm muted">{t('common.insufficient')}</p>}
      </Card>
      <Card title={t('ni.calorieEst')} subtitle={t('common.estimate')}>
        {cal ? (
          <>
            <p className="text-sm">{t('ni.calorieBody', { bmr: i.num(cal.bmr, 0), maint: i.num(cal.maintenance, 0), sug: i.num(cal.suggested, 0), def: i.num(cal.deficit, 0) })}</p>
            <p className="mt-2 text-xs muted">{t('ni.calorieWhy', { floor: cal.floor })}</p>
          </>
        ) : <p className="text-sm muted">{t('ni.calorieNeeds')}</p>}
      </Card>
    </div>
  );
}
