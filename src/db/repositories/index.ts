import { db } from '../schema';
import { initialProfile, initialSettings, starterTemplates } from '../defaults';
import type {
  CustomFood, DailyMetric, DoseSchedule, HealthEntry, MealEntry, Profile, RecommendationStatus,
  SavedMeal, Settings, StoredWeeklyReview, WaterEntry, WeightEntry, Workout, WorkoutTemplate
} from '../../types';
import { TABLE_NAMES } from '../../types';
import { isoNow, uid } from '../../utils/id';
import { parseLocalDateTime } from '../../utils/date';

type New<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

/** Ensure singleton rows exist. Safe to call repeatedly. */
export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', db.profile, db.settings, db.templates, async () => {
    if (!(await db.profile.get('profile'))) {
      await db.profile.put(initialProfile());
      if ((await db.templates.count()) === 0) await db.templates.bulkPut(starterTemplates());
    }
    if (!(await db.settings.get('settings'))) await db.settings.put(initialSettings());
  });
}

// ---------- profile & settings ----------
export async function updateProfile(patch: Partial<Profile>): Promise<void> {
  const cur = (await db.profile.get('profile')) ?? initialProfile();
  await db.profile.put({ ...cur, ...patch, id: 'profile', updatedAt: isoNow() });
}
export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const cur = (await db.settings.get('settings')) ?? initialSettings();
  await db.settings.put({ ...cur, ...patch, id: 'settings', updatedAt: isoNow() });
}

// ---------- generic CRUD ----------
function stamp<T extends { id?: string }>(x: T): T & { id: string; createdAt: string; updatedAt: string } {
  const now = isoNow();
  return { ...x, id: x.id ?? uid(), createdAt: now, updatedAt: now };
}

// ---------- weights ----------
/** Entries within this window with (almost) the same weight are flagged as possible duplicates. */
export const DUPLICATE_WINDOW_MIN = 10;

export function findPossibleDuplicate(entries: WeightEntry[], candidate: { dateTime: string; weightKg: number; id?: string }): WeightEntry | undefined {
  const t = parseLocalDateTime(candidate.dateTime).getTime();
  return entries.find(
    (e) =>
      e.id !== candidate.id &&
      Math.abs(parseLocalDateTime(e.dateTime).getTime() - t) <= DUPLICATE_WINDOW_MIN * 60000 &&
      Math.abs(e.weightKg - candidate.weightKg) < 0.05
  );
}

export const addWeight = async (e: New<WeightEntry>) => { const r = stamp(e); await db.weights.put(r); return r; };
export const updateWeight = (id: string, patch: Partial<WeightEntry>) => db.weights.update(id, { ...patch, updatedAt: isoNow() });
export const deleteWeight = (id: string) => db.weights.delete(id);

// ---------- nutrition ----------
export const addMeal = async (e: New<MealEntry>) => { const r = stamp(e); await db.meals.put(r); return r; };
export const updateMeal = (id: string, patch: Partial<MealEntry>) => db.meals.update(id, { ...patch, updatedAt: isoNow() });
export const deleteMeal = (id: string) => db.meals.delete(id);
export const addFood = async (e: New<CustomFood>) => { const r = stamp(e); await db.foods.put(r); return r; };
export const updateFood = (id: string, patch: Partial<CustomFood>) => db.foods.update(id, { ...patch, updatedAt: isoNow() });
export const deleteFood = (id: string) => db.foods.delete(id);
export const addSavedMeal = async (e: New<SavedMeal>) => { const r = stamp(e); await db.savedMeals.put(r); return r; };
export const deleteSavedMeal = (id: string) => db.savedMeals.delete(id);
export async function addWater(ml: number, dateTime: string): Promise<WaterEntry> {
  const r: WaterEntry = { id: uid(), ml, dateTime, createdAt: isoNow() };
  await db.water.put(r);
  return r;
}
export const deleteWater = (id: string) => db.water.delete(id);
export async function setSteps(date: string, steps: number | undefined): Promise<void> {
  const rec: DailyMetric = { id: date, date, steps, updatedAt: isoNow() };
  await db.dailyMetrics.put(rec);
}

/** Log every item of a saved meal at the given time. */
export async function logSavedMeal(meal: SavedMeal, dateTime: string): Promise<void> {
  await db.meals.bulkPut(
    meal.items.map((it) => stamp<New<MealEntry>>({ ...it, category: meal.category, dateTime }))
  );
}

// ---------- workouts ----------
export const addWorkout = async (e: New<Workout>) => { const r = stamp(e); await db.workouts.put(r); return r; };
export const saveWorkout = (w: Workout) => db.workouts.put({ ...w, updatedAt: isoNow() });
export const deleteWorkout = (id: string) => db.workouts.delete(id);
export const addTemplate = async (e: New<WorkoutTemplate>) => { const r = stamp(e); await db.templates.put(r); return r; };
export const deleteTemplate = (id: string) => db.templates.delete(id);

// ---------- health ----------
export const addHealth = async (e: New<HealthEntry>) => { const r = stamp(e); await db.health.put(r); return r; };
export const updateHealth = (id: string, patch: Partial<HealthEntry>) => db.health.update(id, { ...patch, updatedAt: isoNow() });
export const deleteHealth = (id: string) => db.health.delete(id);
export const addSchedule = async (e: New<DoseSchedule>) => { const r = stamp(e); await db.schedules.put(r); return r; };
export const updateSchedule = (id: string, patch: Partial<DoseSchedule>) => db.schedules.update(id, { ...patch, updatedAt: isoNow() });
export const deleteSchedule = (id: string) => db.schedules.delete(id);

// ---------- coaching ----------
export const setRecommendationState = (id: string, status: RecommendationStatus) =>
  db.recommendationStates.put({ id, status, at: isoNow() });
export const clearRecommendationState = (id: string) => db.recommendationStates.delete(id);
export const saveWeeklyReview = (r: StoredWeeklyReview) => db.weeklyReviews.put(r);

// ---------- danger zone ----------
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', TABLE_NAMES.map((t) => db.table(t)), async () => {
    for (const t of TABLE_NAMES) await db.table(t).clear();
  });
  await ensureSeed();
}
