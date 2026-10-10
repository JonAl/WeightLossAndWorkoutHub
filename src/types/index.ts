// Domain types. All internal storage uses metric units: kg, cm, ml, g, km, minutes.

export type Language = 'el' | 'en';
export type UnitSystem = 'metric' | 'imperial';
export type ThemeMode = 'light' | 'dark' | 'system';
export type Sex = 'male' | 'female' | 'unspecified';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high';
export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';

export type HealthKind =
  | 'glucose'
  | 'bloodPressure'
  | 'heartRate'
  | 'sleep'
  | 'energy'
  | 'hunger'
  | 'digestive'
  | 'medication'
  | 'supplement';

export const HEALTH_KINDS: HealthKind[] = [
  'glucose',
  'bloodPressure',
  'heartRate',
  'sleep',
  'energy',
  'hunger',
  'digestive',
  'medication',
  'supplement'
];

/** Profile fields whose initial value came from the setup brief and still needs confirmation. */
export type ConfirmableField = 'age' | 'heightCm' | 'startWeightKg' | 'currentWeightKg' | 'sex' | 'goalWeightKg';

export interface Profile {
  id: 'profile';
  onboardingComplete: boolean;
  birthDate?: string; // YYYY-MM-DD
  age?: number;
  sex: Sex;
  heightCm: number;
  startWeightKg: number;
  startDate: string; // YYYY-MM-DD
  /** Weight given during onboarding; real current weight is always the latest weight entry. */
  currentWeightKg?: number;
  goalWeightKg?: number;
  targetDate?: string;
  goalDescription: string;
  trainingExperience: TrainingExperience;
  weeklyWorkoutTarget: number;
  trainingSchedule: string;
  activityLevel: ActivityLevel;
  mealsPerDay: number;
  dietaryNotes: string;
  supplementNotes: string;
  proteinTargetG: number;
  calorieTrackingEnabled: boolean;
  calorieTargetKcal?: number;
  fiberTargetG: number;
  waterTargetMl: number;
  stepTarget?: number;
  unconfirmed: ConfirmableField[];
  updatedAt: string;
}

export interface Settings {
  id: 'settings';
  language: Language;
  units: UnitSystem;
  theme: ThemeMode;
  enabledHealthKinds: HealthKind[];
  lastBackupAt?: string;
  updatedAt: string;
}

export interface WeightEntry {
  id: string;
  dateTime: string; // ISO local-ish string: YYYY-MM-DDTHH:mm
  weightKg: number;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  neckCm?: number;
  bodyFatPct?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const MEASUREMENT_FIELDS = ['waistCm', 'hipCm', 'chestCm', 'armCm', 'thighCm', 'neckCm'] as const;
export type MeasurementField = (typeof MEASUREMENT_FIELDS)[number];

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_CATEGORIES: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export type QuantityUnit = 'g' | 'ml' | 'serving' | 'piece';

/** Nutrient values. `null`/undefined means "not recorded" — never treated as zero in averages. */
export interface Nutrients {
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
}

export interface MealEntry extends Nutrients {
  id: string;
  dateTime: string;
  category: MealCategory;
  foodName: string;
  quantity: number;
  unit: QuantityUnit;
  foodId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** A user-defined food. Nutrients are per `servingSize` `servingUnit` (e.g. per 100 g or per 1 serving). */
export interface CustomFood extends Nutrients {
  id: string;
  name: string;
  servingSize: number;
  servingUnit: QuantityUnit;
  favorite: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedMealItem extends Nutrients {
  foodName: string;
  quantity: number;
  unit: QuantityUnit;
}

export interface SavedMeal {
  id: string;
  name: string;
  category: MealCategory;
  items: SavedMealItem[];
  createdAt: string;
  updatedAt: string;
}

export interface WaterEntry {
  id: string;
  dateTime: string;
  ml: number;
  createdAt: string;
}

export interface DailyMetric {
  id: string; // date YYYY-MM-DD
  date: string;
  steps?: number;
  updatedAt: string;
}

export type WorkoutType = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'fullBody' | 'cardio' | 'custom';
export const WORKOUT_TYPES: WorkoutType[] = ['push', 'pull', 'legs', 'upper', 'lower', 'fullBody', 'cardio', 'custom'];
export type ExerciseKind = 'resistance' | 'bodyweight' | 'cardio';

export interface WorkoutSet {
  id: string;
  reps?: number;
  weightKg?: number;
  rpe?: number;
  restSec?: number;
  done: boolean;
}

export interface CardioData {
  cardioType?: string;
  durationMin?: number;
  distanceKm?: number;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  sets: WorkoutSet[];
  cardio?: CardioData;
  notes?: string;
}

export interface Workout {
  id: string;
  status: 'active' | 'completed';
  type: WorkoutType;
  title: string;
  startedAt: string;
  completedAt?: string;
  date: string; // YYYY-MM-DD
  durationMin?: number;
  exercises: WorkoutExercise[];
  notes?: string;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateExercise {
  name: string;
  kind: ExerciseKind;
  targetSets: number;
  targetReps?: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  type: WorkoutType;
  exercises: TemplateExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface HealthEntry {
  id: string;
  kind: HealthKind;
  dateTime: string;
  value?: number; // glucose mg/dL, HR bpm, sleep hours, energy/hunger 1-5
  systolic?: number;
  diastolic?: number;
  name?: string; // medication / supplement name, digestive symptom
  dose?: string;
  sideEffects?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DoseSchedule {
  id: string;
  kind: 'medication' | 'supplement';
  name: string;
  dose: string;
  times: string[]; // HH:mm, user-configured
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RecommendationStatus = 'dismissed' | 'completed';

export interface RecommendationState {
  id: string; // recommendation instance id (rule + week)
  status: RecommendationStatus;
  at: string;
}

export interface StoredWeeklyReview {
  id: string; // week start YYYY-MM-DD
  createdAt: string;
  review: import('../coaching/weeklyReview').WeeklyReview;
}

export interface AppData {
  profile: Profile[];
  settings: Settings[];
  weights: WeightEntry[];
  meals: MealEntry[];
  foods: CustomFood[];
  savedMeals: SavedMeal[];
  water: WaterEntry[];
  dailyMetrics: DailyMetric[];
  workouts: Workout[];
  templates: WorkoutTemplate[];
  health: HealthEntry[];
  schedules: DoseSchedule[];
  recommendationStates: RecommendationState[];
  weeklyReviews: StoredWeeklyReview[];
}

export type TableName = keyof AppData;
export const TABLE_NAMES: TableName[] = [
  'profile',
  'settings',
  'weights',
  'meals',
  'foods',
  'savedMeals',
  'water',
  'dailyMetrics',
  'workouts',
  'templates',
  'health',
  'schedules',
  'recommendationStates',
  'weeklyReviews'
];
