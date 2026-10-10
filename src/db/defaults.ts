import type { Profile, Settings, TrainingProgram, WorkoutTemplate } from '../types';
import { HEALTH_KINDS } from '../types';
import { isoNow, uid } from '../utils/id';
import { today } from '../utils/date';

/**
 * Initial profile values from the setup brief. They are *not* treated as confirmed facts:
 * every value listed in `unconfirmed` is flagged in the UI until the user confirms it.
 */
export function initialProfile(): Profile {
  return {
    id: 'profile',
    onboardingComplete: false,
    age: 37,
    sex: 'unspecified',
    heightCm: 182,
    startWeightKg: 155,
    startDate: today(),
    currentWeightKg: 145,
    goalWeightKg: undefined,
    goalDescription: 'Lose body fat while maintaining or gaining muscle',
    trainingExperience: 'intermediate',
    weeklyWorkoutTarget: 5,
    trainingSchedule: '',
    activityLevel: 'sedentary',
    mealsPerDay: 3,
    dietaryNotes: '',
    supplementNotes: 'MyProtein Impact Whey Isolate — usually 1 scoop after training',
    proteinTargetG: 160,
    calorieTrackingEnabled: true,
    calorieTargetKcal: undefined,
    fiberTargetG: 30,
    waterTargetMl: 3000,
    stepTarget: 8000,
    unconfirmed: ['age', 'heightCm', 'startWeightKg', 'currentWeightKg', 'sex', 'goalWeightKg'],
    updatedAt: isoNow()
  };
}

export function initialSettings(): Settings {
  return {
    id: 'settings',
    language: 'el',
    units: 'metric',
    theme: 'system',
    enabledHealthKinds: [...HEALTH_KINDS],
    updatedAt: isoNow()
  };
}

/** Starter templates — structure only (exercise names, sets and rep ranges), no logged data. */
export function starterTemplates(): WorkoutTemplate[] {
  const now = isoNow();
  const mk = (name: string, type: WorkoutTemplate['type'], ex: [string, string, number, number, number, number][]): WorkoutTemplate => ({
    id: uid(),
    name,
    type,
    exercises: ex.map(([exerciseId, n, s, lo, hi, rest]) => ({ exerciseId, name: n, kind: 'resistance', targetSets: s, repMin: lo, targetReps: hi, restSec: rest })),
    createdAt: now,
    updatedAt: now
  });
  return [
    mk('Push', 'push', [['bench', 'Bench Press', 4, 6, 10, 150], ['ohp', 'Overhead Press', 3, 6, 10, 120], ['incline-db', 'Incline Dumbbell Press', 3, 8, 12, 120], ['lateral-raise', 'Lateral Raise', 3, 12, 15, 60], ['triceps-pushdown', 'Cable Triceps Pushdown', 3, 10, 15, 60]]),
    mk('Pull', 'pull', [['lat-pulldown', 'Lat Pulldown', 4, 8, 12, 90], ['cable-row', 'Seated Cable Row', 3, 10, 12, 90], ['face-pull', 'Face Pull', 3, 12, 20, 60], ['db-curl', 'Dumbbell Curl', 3, 10, 15, 60]]),
    mk('Legs', 'legs', [['leg-press', 'Leg Press', 4, 10, 15, 120], ['rdl', 'Romanian Deadlift', 3, 8, 12, 120], ['leg-curl', 'Leg Curl', 3, 10, 15, 75], ['leg-extension', 'Leg Extension', 3, 10, 15, 75], ['calf-raise', 'Standing Calf Raise', 3, 12, 20, 60]])
  ];
}

/** Default weekly plan using the starter templates: Push / Pull / Legs / rest / Push / Pull / rest. */
export function starterProgram(templates: WorkoutTemplate[]): TrainingProgram {
  const by = (n: string) => templates.find((t) => t.name === n)?.id ?? null;
  const now = isoNow();
  return { id: uid(), name: 'PPL', active: true, days: [by('Push'), by('Pull'), by('Legs'), null, by('Push'), by('Pull'), null], createdAt: now, updatedAt: now };
}
