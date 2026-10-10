import type { Profile, Settings, WorkoutTemplate } from '../types';
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

/** Starter templates — structure only (exercise names and target sets), no logged data. */
export function starterTemplates(): WorkoutTemplate[] {
  const now = isoNow();
  const mk = (name: string, type: WorkoutTemplate['type'], ex: [string, number, number][]): WorkoutTemplate => ({
    id: uid(),
    name,
    type,
    exercises: ex.map(([n, s, r]) => ({ name: n, kind: 'resistance', targetSets: s, targetReps: r })),
    createdAt: now,
    updatedAt: now
  });
  return [
    mk('Push', 'push', [['Bench Press', 4, 8], ['Overhead Press', 3, 8], ['Incline Dumbbell Press', 3, 10], ['Lateral Raise', 3, 12], ['Triceps Pushdown', 3, 12]]),
    mk('Pull', 'pull', [['Lat Pulldown', 4, 10], ['Seated Cable Row', 3, 10], ['Face Pull', 3, 15], ['Biceps Curl', 3, 12]]),
    mk('Legs', 'legs', [['Leg Press', 4, 10], ['Romanian Deadlift', 3, 8], ['Leg Curl', 3, 12], ['Leg Extension', 3, 12], ['Calf Raise', 3, 15]])
  ];
}
