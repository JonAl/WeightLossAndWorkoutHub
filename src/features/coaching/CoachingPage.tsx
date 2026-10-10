import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, EyeOff, Lightbulb, RotateCcw, Sparkles, TrendingUp, AlertTriangle, MinusCircle, HelpCircle } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { useHealth, useMeals, useRecStates, useWeeklyReviews, useWeights, useWorkouts } from '../../hooks/useData';
import { Badge, Card, EmptyState, Notice, PageHeader, cx } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { buildContext } from '../../coaching/context';
import { evaluateRules, selectInsights, type Insight } from '../../coaching/rules';
import { reviewForWeek, type ReviewItem, type WeeklyReview } from '../../coaching/weeklyReview';
import { clearRecommendationState, saveWeeklyReview, setRecommendationState } from '../../db/repositories';
import { addDays, today, weekStart } from '../../utils/date';
import { isoNow } from '../../utils/id';

export function InsightCard({ ins, onDismiss, onDone, onRestore, status }: { ins: Insight; onDismiss?: () => void; onDone?: () => void; onRestore?: () => void; status?: string }) {
  const { td, t } = useI18n();
  return (
    <article className={cx('card animate-fade-in border-l-4', ins.tone === 'positive' ? 'border-l-teal-500' : ins.tone === 'attention' ? 'border-l-amber-500' : 'border-l-indigo-400')}>
      <h3 className="font-semibold">{td(`coach.${ins.ruleId}.title`, ins.params)}</h3>
      <p className="mt-1 text-sm">{td(`coach.${ins.ruleId}.body`, ins.params)}</p>
      {ins.evidence.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-medium text-teal-700 dark:text-teal-400">{t('coach.basedOn')}</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 muted">{ins.evidence.map((e, k) => <li key={k}>{td(e.key, e.params)}</li>)}</ul>
        </details>
      )}
      {(onDismiss || onDone || onRestore) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onDone && <button className="btn-secondary min-h-[36px] px-3 text-xs" onClick={onDone}><CheckCircle2 className="h-3.5 w-3.5" />{t('coach.markDone')}</button>}
          {onDismiss && <button className="btn-ghost min-h-[36px] px-3 text-xs" onClick={onDismiss}><EyeOff className="h-3.5 w-3.5" />{t('coach.dismiss')}</button>}
          {onRestore && <><Badge>{status === 'completed' ? t('coach.statusDone') : t('coach.statusDismissed')}</Badge><button className="btn-ghost min-h-[36px] px-3 text-xs" onClick={onRestore}><RotateCcw className="h-3.5 w-3.5" />{t('coach.restore')}</button></>}
        </div>
      )}
    </article>
  );
}

const BUCKET_META = {
  improved: { icon: TrendingUp, cls: 'text-teal-700 dark:text-teal-400' },
  stable: { icon: MinusCircle, cls: 'text-indigo-700 dark:text-indigo-300' },
  attention: { icon: AlertTriangle, cls: 'text-amber-700 dark:text-amber-300' },
  insufficient: { icon: HelpCircle, cls: 'text-slate-500' }
} as const;

export function ReviewView({ review }: { review: WeeklyReview }) {
  const i = useI18n();
  const { t, td } = i;
  const section = (bucket: keyof typeof BUCKET_META, items: ReviewItem[]) => {
    if (!items.length) return null;
    const M = BUCKET_META[bucket];
    return (
      <div>
        <h4 className={cx('mb-1 flex items-center gap-1.5 text-sm font-semibold', M.cls)}><M.icon aria-hidden className="h-4 w-4" />{td(`review.${bucket}`)}</h4>
        <ul className="space-y-1 pl-6 text-sm">{items.map((x) => <li key={x.metric}>{td(`review.${x.metric}.${x.bucket}`, x.params)}</li>)}</ul>
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <p className="text-xs muted">{i.date(review.weekStart)} – {i.date(review.weekEnd)}</p>
      {section('improved', review.improved)}
      {section('stable', review.stable)}
      {section('attention', review.attention)}
      {section('insufficient', review.insufficient)}
      <div>
        <h4 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><Lightbulb aria-hidden className="h-4 w-4" />{t('review.priorities')}</h4>
        {review.priorities.length ? <ol className="list-decimal space-y-1 pl-6 text-sm">{review.priorities.map((p) => <li key={p.ruleId}>{td(`coach.${p.ruleId}.title`, p.params)}</li>)}</ol> : <p className="pl-6 text-sm muted">{t('review.noPriorities')}</p>}
      </div>
    </div>
  );
}

export function CoachingPage() {
  const { t, date } = useI18n();
  const { profile, settings } = useApp();
  const toast = useToast();
  const weights = useWeights(), meals = useMeals(), workouts = useWorkouts(), health = useHealth(), states = useRecStates(), reviews = useWeeklyReviews();
  const [openReview, setOpenReview] = useState<string | null>(null);

  const data = useMemo(() => (weights && meals && workouts && health ? { weights, meals, workouts, health } : null), [weights, meals, workouts, health]);
  const result = useMemo(() => {
    if (!data || !states) return null;
    const ctx = buildContext(data, profile, settings, today());
    const all = evaluateRules(ctx);
    return { ...selectInsights(all, new Map(states.map((s) => [s.id, s.status]))), stateMap: new Map(states.map((s) => [s.id, s.status])) };
  }, [data, states, profile, settings]);

  const lastWeek = addDays(weekStart(today()), -7);
  const current = useMemo(() => (data ? reviewForWeek(data, profile, settings, weekStart(today())) : null), [data, profile, settings]);

  // Keep a local history: store last week's review once it is complete (if any data exists).
  useEffect(() => {
    if (!data || !reviews) return;
    const hasData = data.weights.length + data.meals.length + data.workouts.length + data.health.length > 0;
    if (!hasData || reviews.some((r) => r.id === lastWeek)) return;
    saveWeeklyReview({ id: lastWeek, createdAt: isoNow(), review: reviewForWeek(data, profile, settings, lastWeek) }).catch(() => {});
  }, [data, reviews, lastWeek, profile, settings]);

  if (!result || !current || !reviews) return <div className="p-6 muted" role="status">{t('common.loading')}</div>;
  const noData = (weights!.length + meals!.length + workouts!.length + health!.length) === 0;

  const act = async (id: string, s: 'dismissed' | 'completed') => { await setRecommendationState(id, s); toast(s === 'completed' ? t('coach.doneToast') : t('coach.dismissedToast')); };

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.coaching')} subtitle={t('coach.subtitle')} />
      <Notice>{t('coach.howItWorks')}</Notice>
      {noData ? <EmptyState icon={Sparkles} title={t('coach.noDataTitle')} body={t('coach.noDataBody')} /> : (
        <>
          <section aria-label={t('coach.recommendations')} className="space-y-3">
            <h2 className="text-lg font-semibold">{t('coach.recommendations')} <span className="text-sm font-normal muted">({t('coach.maxThree')})</span></h2>
            {result.recommendations.length === 0 ? <Card><p className="text-sm muted">{t('coach.noRecs')}</p></Card>
              : result.recommendations.map((r) => <InsightCard key={r.id} ins={r} onDone={() => act(r.id, 'completed')} onDismiss={() => act(r.id, 'dismissed')} />)}
          </section>
          {result.observations.length > 0 && (
            <section aria-label={t('coach.observations')} className="space-y-3">
              <h2 className="text-lg font-semibold">{t('coach.observations')}</h2>
              {result.observations.map((o) => <InsightCard key={o.id} ins={o} />)}
            </section>
          )}
          {result.hidden.length > 0 && (
            <details className="card">
              <summary className="cursor-pointer text-sm font-semibold">{t('coach.hidden', { n: result.hidden.length })}</summary>
              <div className="mt-3 space-y-3">{result.hidden.map((h) => <InsightCard key={h.id} ins={h} status={result.stateMap.get(h.id)} onRestore={() => clearRecommendationState(h.id)} />)}</div>
            </details>
          )}
        </>
      )}

      <Card title={t('review.thisWeek')} subtitle={t('review.inProgress')}><ReviewView review={current} /></Card>

      <Card title={t('review.history')} subtitle={t('review.historySub')}>
        {reviews.length === 0 ? <p className="text-sm muted">{t('review.noHistory')}</p> : (
          <ul className="space-y-2">
            {[...reviews].sort((a, b) => b.id.localeCompare(a.id)).map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200 dark:border-navy-700">
                <button className="flex min-h-[44px] w-full items-center justify-between px-3 text-left text-sm font-medium" aria-expanded={openReview === r.id} onClick={() => setOpenReview(openReview === r.id ? null : r.id)}>
                  {t('review.weekOf', { date: date(r.id) })}
                  <span className="text-xs muted">↑{r.review.improved.length} · !{r.review.attention.length}</span>
                </button>
                {openReview === r.id && <div className="border-t border-slate-200 p-3 dark:border-navy-700"><ReviewView review={r.review} /></div>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-xs muted">{t('coach.medicationNote')}</p>
    </div>
  );
}
