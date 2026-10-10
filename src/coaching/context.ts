import type { AppData, HealthEntry, Profile, Settings } from '../types';
import { dailyNutrition, type DayNutrition } from '../analytics/nutrition';
import { dailyWeights, weightTrend, type DailyWeight, type TrendPoint } from '../analytics/weight';
import { dayOf, weekStart } from '../utils/date';

/** Everything the coaching rules need, derived once from raw data. Pure & deterministic. */
export interface CoachingContext {
  today: string;
  weekStart: string;
  profile: Profile;
  settings: Settings;
  data: Pick<AppData, 'weights' | 'meals' | 'workouts' | 'health'>;
  daily: DailyWeight[];
  trend: TrendPoint[];
  nutrition: Map<string, DayNutrition>;
  weightDays: Set<string>;
  mealDays: Set<string>;
  health: HealthEntry[];
}

export function buildContext(data: Pick<AppData, 'weights' | 'meals' | 'workouts' | 'health'>, profile: Profile, settings: Settings, today: string): CoachingContext {
  const daily = dailyWeights(data.weights);
  return {
    today,
    weekStart: weekStart(today),
    profile,
    settings,
    data,
    daily,
    trend: weightTrend(daily),
    nutrition: dailyNutrition(data.meals),
    weightDays: new Set(daily.map((d) => d.date)),
    mealDays: new Set(data.meals.map((m) => dayOf(m.dateTime))),
    health: data.health.filter((h) => settings.enabledHealthKinds.includes(h.kind))
  };
}
