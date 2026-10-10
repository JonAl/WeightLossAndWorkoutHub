import type { Settings, TrainingSettings, UnitSystem } from '../types';

export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
export const DEFAULT_PLATES_LB = [45, 35, 25, 10, 5, 2.5];

/** Training settings with defaults filled in (bar/plates in the user's display unit). */
export function getTraining(settings: Pick<Settings, 'training'>, units: UnitSystem): TrainingSettings {
  const t = settings.training ?? {};
  return {
    defaultRestSec: t.defaultRestSec ?? 90,
    autoStartRest: t.autoStartRest ?? true,
    restSound: t.restSound ?? true,
    restVibrate: t.restVibrate ?? true,
    barWeight: t.barWeight ?? (units === 'imperial' ? 45 : 20),
    plates: t.plates && t.plates.length ? t.plates : units === 'imperial' ? DEFAULT_PLATES_LB : DEFAULT_PLATES_KG
  };
}
