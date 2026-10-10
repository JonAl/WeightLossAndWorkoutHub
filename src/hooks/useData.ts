import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';

// Live queries: components re-render automatically when IndexedDB changes.
export const useWeights = () => useLiveQuery(() => db.weights.orderBy('dateTime').toArray(), [], undefined);
export const useMeals = () => useLiveQuery(() => db.meals.orderBy('dateTime').toArray(), [], undefined);
export const useFoods = () => useLiveQuery(() => db.foods.orderBy('name').toArray(), [], undefined);
export const useSavedMeals = () => useLiveQuery(() => db.savedMeals.orderBy('name').toArray(), [], undefined);
export const useWater = () => useLiveQuery(() => db.water.orderBy('dateTime').toArray(), [], undefined);
export const useDailyMetrics = () => useLiveQuery(() => db.dailyMetrics.orderBy('date').toArray(), [], undefined);
export const useWorkouts = () => useLiveQuery(() => db.workouts.orderBy('date').toArray(), [], undefined);
export const useTemplates = () => useLiveQuery(() => db.templates.orderBy('name').toArray(), [], undefined);
export const useHealth = () => useLiveQuery(() => db.health.orderBy('dateTime').toArray(), [], undefined);
export const useSchedules = () => useLiveQuery(() => db.schedules.toArray(), [], undefined);
export const useRecStates = () => useLiveQuery(() => db.recommendationStates.toArray(), [], undefined);
export const useWeeklyReviews = () => useLiveQuery(() => db.weeklyReviews.toArray(), [], undefined);
export const useCustomExercises = () => useLiveQuery(() => db.exercises.toArray(), [], undefined);
export const usePrograms = () => useLiveQuery(() => db.programs.toArray(), [], undefined);
export const useMealPlan = () => useLiveQuery(() => db.mealPlan.toArray(), [], undefined);
