import Dexie, { type Table } from 'dexie';
import type {
  CustomFood, DailyMetric, DoseSchedule, HealthEntry, MealEntry, Profile, RecommendationState,
  SavedMeal, Settings, StoredWeeklyReview, WaterEntry, WeightEntry, Workout, WorkoutTemplate
} from '../types';
import { applyMigrations } from './migrations';

export class WeightHubDB extends Dexie {
  profile!: Table<Profile, string>;
  settings!: Table<Settings, string>;
  weights!: Table<WeightEntry, string>;
  meals!: Table<MealEntry, string>;
  foods!: Table<CustomFood, string>;
  savedMeals!: Table<SavedMeal, string>;
  water!: Table<WaterEntry, string>;
  dailyMetrics!: Table<DailyMetric, string>;
  workouts!: Table<Workout, string>;
  templates!: Table<WorkoutTemplate, string>;
  health!: Table<HealthEntry, string>;
  schedules!: Table<DoseSchedule, string>;
  recommendationStates!: Table<RecommendationState, string>;
  weeklyReviews!: Table<StoredWeeklyReview, string>;

  constructor(name = 'weight-loss-hub') {
    super(name);
    applyMigrations(this);
  }
}

export const db = new WeightHubDB();
