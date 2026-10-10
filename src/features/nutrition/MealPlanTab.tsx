import { useMemo, useState } from 'react';
import { ClipboardCopy, ShoppingCart, Trash2, Utensils } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { useMealPlan, useSavedMeals } from '../../hooks/useData';
import { Card, EmptyState, Notice, ProgressBar, Select, cx } from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { clearMealPlan, logSavedMeal, setMealPlanSlot } from '../../db/repositories';
import { plannedDay, shoppingList } from '../../analytics/mealPlan';
import { weekdayIndex } from '../../training/plan';
import { nowLocal, today } from '../../utils/date';
import { lsGet, lsSet } from '../../utils/storage';
import { MEAL_CATEGORIES } from '../../types';

const DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Weekly meal plan built from saved meals, with a real shopping list (replaces GymApp's static plan). */
export function MealPlanTab() {
  const i = useI18n();
  const { t, td } = i;
  const { profile } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const plan = useMealPlan(), saved = useSavedMeals();
  const [day, setDay] = useState(weekdayIndex(today()));
  const [checked, setChecked] = useState<Record<string, boolean>>(() => lsGet('wlh:shoppingChecked', {}));
  const list = useMemo(() => (plan && saved ? shoppingList(plan, saved) : []), [plan, saved]);
  if (!plan || !saved) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;
  if (saved.length === 0) return <EmptyState icon={Utensils} title={t('mp.noSaved')} body={t('mp.noSavedBody')} />;

  const dayPlan = plannedDay(plan, saved, day);
  const todayIdx = weekdayIndex(today());
  const toggle = (k: string) => { const n = { ...checked, [k]: !checked[k] }; setChecked(n); lsSet('wlh:shoppingChecked', n); };
  const copy = async () => {
    const text = list.map((x) => `${checked[x.key] ? '☑' : '☐'} ${x.name} — ${i.num(x.quantity)} ${td(`unit.${x.unit}`)}`).join('\n');
    try { await navigator.clipboard.writeText(text); toast(t('mp.copied')); } catch { toast(t('mp.copyFailed'), 'error'); }
  };
  const logToday = async () => {
    const todays = plannedDay(plan, saved, todayIdx).meals;
    if (!todays.length) return;
    if (!(await confirm({ title: t('mp.logTodayTitle'), body: t('mp.logTodayBody', { n: todays.length }) }))) return;
    for (const m of todays) await logSavedMeal({ ...m.meal, category: m.category }, nowLocal());
    toast(t('nutrition.logged'));
  };

  return (
    <div className="space-y-4">
      <Notice>{t('mp.intro')}</Notice>
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4" role="tablist" aria-label={t('mp.days')}>
        {DAYS.map((d) => (
          <button key={d} role="tab" aria-selected={day === d} onClick={() => setDay(d)}
            className={cx('chip shrink-0', day === d ? 'border-teal-600 bg-teal-600 text-white dark:bg-teal-500 dark:text-navy-950' : 'border-slate-300 dark:border-navy-600', d === todayIdx && day !== d && 'font-bold')}>
            {td(`weekdayShort.${d}`)}{d === todayIdx ? ' •' : ''}
          </button>
        ))}
      </div>
      <Card title={td(`weekday.${day}`)} subtitle={t('mp.dayTotals', { p: i.num(dayPlan.totals.proteinG, 0), k: i.num(dayPlan.totals.calories, 0) })}>
        <div className="space-y-2">
          {MEAL_CATEGORIES.map((c) => {
            const cur = plan.find((e) => e.weekday === day && e.category === c);
            return (
              <div key={c} className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
                <label htmlFor={`mp-${day}-${c}`} className="text-sm font-medium">{td(`meal.cat.${c}`)}</label>
                <Select id={`mp-${day}-${c}`} value={cur && saved.some((s) => s.id === cur.savedMealId) ? cur.savedMealId : ''} onChange={(e) => setMealPlanSlot(day, c, e.target.value || null)}>
                  <option value="">—</option>
                  {saved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs"><span>{t('nutrient.proteinG')}</span><span className="tabular-nums">{i.num(dayPlan.totals.proteinG, 0)} / {profile.proteinTargetG}</span></div>
          <ProgressBar value={dayPlan.totals.proteinG} max={profile.proteinTargetG} label={t('nutrient.proteinG')} />
        </div>
        {day === todayIdx && dayPlan.meals.length > 0 && <button className="btn-primary mt-3" onClick={logToday}><Utensils className="h-4 w-4" />{t('mp.logToday')}</button>}
      </Card>

      <Card title={t('mp.shopping')} subtitle={t('mp.shoppingSub')} action={list.length > 0 && <button className="btn-icon" aria-label={t('mp.copy')} title={t('mp.copy')} onClick={copy}><ClipboardCopy className="h-4 w-4" /></button>}>
        {list.length === 0 ? <p className="text-sm muted">{t('mp.emptyList')}</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-navy-800">
            {list.map((x) => (
              <li key={x.key}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                  <input type="checkbox" className="h-5 w-5 accent-teal-600" checked={!!checked[x.key]} onChange={() => toggle(x.key)} />
                  <span className={cx('flex-1', checked[x.key] && 'line-through muted')}>{x.name}</span>
                  <span className="tabular-nums text-sm">{i.num(x.quantity)} {td(`unit.${x.unit}`)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {list.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => { setChecked({}); lsSet('wlh:shoppingChecked', {}); }}><ShoppingCart className="h-4 w-4" />{t('mp.uncheckAll')}</button>
            <button className="btn-ghost text-red-600" onClick={async () => { if (await confirm({ title: t('mp.clearTitle'), body: t('mp.clearBody'), danger: true, confirmLabel: t('common.delete') })) { await clearMealPlan(); toast(t('toast.deleted')); } }}><Trash2 className="h-4 w-4" />{t('mp.clear')}</button>
          </div>
        )}
      </Card>
    </div>
  );
}
