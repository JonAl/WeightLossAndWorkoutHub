import type { CoachingContext } from './context';
import { buildContext } from './context';
import { addDays, dayOf } from '../utils/date';
import { mean, round } from '../utils/stats';
import { averageNutrient } from '../analytics/nutrition';
import { workoutsInWeek } from '../analytics/workouts';
import { evaluateRules, MAX_RECOMMENDATIONS, type Params } from './rules';

export type ReviewBucket = 'improved' | 'stable' | 'attention' | 'insufficient';
export interface ReviewItem { metric: string; bucket: ReviewBucket; params: Params }
export interface WeeklyReview {
  weekStart: string;
  weekEnd: string;
  improved: ReviewItem[];
  stable: ReviewItem[];
  attention: ReviewItem[];
  insufficient: ReviewItem[];
  priorities: { ruleId: string; params: Params }[];
}

function weightMean(c: CoachingContext, from: string, to: string) {
  const xs = c.daily.filter((d) => d.date >= from && d.date <= to).map((d) => d.weightKg);
  return { avg: mean(xs), n: xs.length };
}
function healthMean(c: CoachingContext, kind: 'sleep' | 'energy', from: string, to: string) {
  const xs = c.health.filter((h) => h.kind === kind && typeof h.value === 'number' && dayOf(h.dateTime) >= from && dayOf(h.dateTime) <= to).map((h) => h.value!);
  return { avg: mean(xs), n: xs.length };
}

/** Build the review for the Monday-start week beginning `ws`, comparing with the week before. */
export function buildWeeklyReview(ctxAtWeekEnd: CoachingContext, ws: string): WeeklyReview {
  const c = ctxAtWeekEnd;
  const we = addDays(ws, 6);
  const pws = addDays(ws, -7), pwe = addDays(ws, -1);
  const items: ReviewItem[] = [];

  // Weight: weekly mean vs previous weekly mean; needs ≥ 2 days in each week.
  const w1 = weightMean(c, ws, we), w0 = weightMean(c, pws, pwe);
  if (w1.n >= 2 && w0.n >= 2) {
    const d = w1.avg! - w0.avg!;
    const bucket: ReviewBucket = d < -0.2 ? 'improved' : d > 0.2 ? 'attention' : 'stable';
    // Texts say "down/up by X", so pass the magnitude unless the change is reported as stable.
    items.push({ metric: 'weight', bucket, params: { changeKg: round(bucket === 'stable' ? d : Math.abs(d), 1), n: w1.n + w0.n } });
  } else items.push({ metric: 'weight', bucket: 'insufficient', params: { n: w1.n } });

  // Protein: weekly average vs target; needs ≥ 3 logged days.
  const p1 = averageNutrient(c.nutrition, 'proteinG', ws, we);
  const target = c.profile.proteinTargetG;
  if (p1.n >= 3) {
    const p0 = averageNutrient(c.nutrition, 'proteinG', pws, pwe);
    const onTarget = p1.avg! >= target;
    const better = p0.n >= 3 && p1.avg! > p0.avg! * 1.05;
    items.push({ metric: 'protein', bucket: onTarget ? (better ? 'improved' : 'stable') : better ? 'improved' : 'attention', params: { avg: Math.round(p1.avg!), target, n: p1.n } });
  } else items.push({ metric: 'protein', bucket: 'insufficient', params: { n: p1.n } });

  // Fiber
  const f1 = averageNutrient(c.nutrition, 'fiberG', ws, we);
  if (f1.n >= 3) items.push({ metric: 'fiber', bucket: f1.avg! >= c.profile.fiberTargetG * 0.8 ? 'stable' : 'attention', params: { avg: Math.round(f1.avg!), target: c.profile.fiberTargetG, n: f1.n } });

  // Workouts
  const tgt = c.profile.weeklyWorkoutTarget;
  const k1 = workoutsInWeek(c.data.workouts, ws), k0 = workoutsInWeek(c.data.workouts, pws);
  if (c.data.workouts.length > 0) {
    items.push({ metric: 'workouts', bucket: k1 > k0 ? 'improved' : k1 >= tgt ? 'stable' : 'attention', params: { count: k1, before: k0, target: tgt } });
  } else items.push({ metric: 'workouts', bucket: 'insufficient', params: { n: 0 } });

  // Sleep
  const s1 = healthMean(c, 'sleep', ws, we);
  if (s1.n >= 3) items.push({ metric: 'sleep', bucket: s1.avg! >= 7 ? 'stable' : s1.avg! < 6.5 ? 'attention' : 'stable', params: { avg: round(s1.avg!, 1), n: s1.n } });

  // Logging coverage
  const covDays = c.daily.filter((d) => d.date >= ws && d.date <= we).length;
  items.push({ metric: 'coverage', bucket: covDays >= 4 ? 'stable' : 'attention', params: { days: covDays, total: 7 } });

  const prios = evaluateRules(c).filter((i) => i.kind === 'recommendation').slice(0, MAX_RECOMMENDATIONS).map((i) => ({ ruleId: i.ruleId, params: i.params }));

  return {
    weekStart: ws,
    weekEnd: we,
    improved: items.filter((i) => i.bucket === 'improved'),
    stable: items.filter((i) => i.bucket === 'stable'),
    attention: items.filter((i) => i.bucket === 'attention'),
    insufficient: items.filter((i) => i.bucket === 'insufficient'),
    priorities: prios
  };
}

/** Convenience: build the review for a week from raw data, evaluating rules as of that week's Sunday. */
export function reviewForWeek(data: Parameters<typeof buildContext>[0], profile: Parameters<typeof buildContext>[1], settings: Parameters<typeof buildContext>[2], ws: string): WeeklyReview {
  const ctx = buildContext(data, profile, settings, addDays(ws, 6));
  return buildWeeklyReview(ctx, ws);
}
