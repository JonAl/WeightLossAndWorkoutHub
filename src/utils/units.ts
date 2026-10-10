import type { UnitSystem } from '../types';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inch: number) => inch * CM_PER_IN;

/** Convert a stored kg value to the display unit. */
export const weightToDisplay = (kg: number, u: UnitSystem) => (u === 'imperial' ? kgToLb(kg) : kg);
/** Convert a user-entered weight in display unit back to kg for storage. */
export const weightFromDisplay = (v: number, u: UnitSystem) => (u === 'imperial' ? lbToKg(v) : v);
export const lengthToDisplay = (cm: number, u: UnitSystem) => (u === 'imperial' ? cmToIn(cm) : cm);
export const lengthFromDisplay = (v: number, u: UnitSystem) => (u === 'imperial' ? inToCm(v) : v);
export const weightUnit = (u: UnitSystem) => (u === 'imperial' ? 'lb' : 'kg');
export const lengthUnit = (u: UnitSystem) => (u === 'imperial' ? 'in' : 'cm');

/** Scale nutrients of a food defined per `servingSize` to an eaten `quantity` (same unit). */
export function scaleNutrient(per: number | undefined, servingSize: number, quantity: number): number | undefined {
  if (per === undefined || per === null || !Number.isFinite(per) || servingSize <= 0) return undefined;
  return (per * quantity) / servingSize;
}
