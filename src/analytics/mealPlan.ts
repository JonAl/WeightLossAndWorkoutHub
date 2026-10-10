import type { MealCategory, MealPlanEntry, Nutrients, SavedMeal } from '../types';
import { sumNutrients } from './nutrition';

export interface ShoppingItem { key: string; name: string; unit: string; quantity: number; uses: number }

/**
 * Shopping list for the week: every saved meal assigned in the plan contributes its items once per
 * assignment. Items are grouped by normalized food name + unit; quantities are summed in that unit
 * (no cross-unit conversion is attempted).
 */
export function shoppingList(plan: MealPlanEntry[], saved: SavedMeal[]): ShoppingItem[] {
  const byId = new Map(saved.map((s) => [s.id, s]));
  const m = new Map<string, ShoppingItem>();
  for (const e of plan) {
    const meal = byId.get(e.savedMealId);
    if (!meal) continue;
    for (const it of meal.items) {
      const key = `${it.foodName.trim().toLowerCase()}|${it.unit}`;
      const cur = m.get(key) ?? { key, name: it.foodName.trim(), unit: it.unit, quantity: 0, uses: 0 };
      cur.quantity += it.quantity;
      cur.uses++;
      m.set(key, cur);
    }
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Planned nutrient totals for one weekday (0 = Monday). */
export function plannedDay(plan: MealPlanEntry[], saved: SavedMeal[], weekday: number): { totals: Required<Nutrients>; meals: { category: MealCategory; meal: SavedMeal }[] } {
  const byId = new Map(saved.map((s) => [s.id, s]));
  const meals = plan.filter((e) => e.weekday === weekday && byId.has(e.savedMealId)).map((e) => ({ category: e.category, meal: byId.get(e.savedMealId)! }));
  return { totals: sumNutrients(meals.flatMap((m) => m.meal.items)), meals };
}
