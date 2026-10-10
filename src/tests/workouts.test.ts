import { describe, expect, it } from 'vitest';
import { epley1RM, exerciseProgression, exerciseVolume, personalRecords, weeklyWorkoutCounts, workoutsInWeek } from '../analytics/workouts';
import { coverage, currentStreak, workoutAdherence } from '../analytics/adherence';
import { workout } from './helpers';
import type { WorkoutExercise } from '../types';

describe('volume', () => {
  it('sets × reps × load for completed weighted sets only', () => {
    const ex: WorkoutExercise = { id: 'e', name: 'Squat', kind: 'resistance', sets: [
      { id: 'a', reps: 10, weightKg: 100, done: true }, { id: 'b', reps: 8, weightKg: 100, done: true },
      { id: 'c', reps: 8, weightKg: 100, done: false }, { id: 'd', reps: 12, done: true }
    ] };
    expect(exerciseVolume(ex)).toBe(1800);
    expect(exerciseVolume({ ...ex, kind: 'cardio' })).toBeNull();
    expect(exerciseVolume({ ...ex, kind: 'bodyweight' })).toBeNull();
  });
});

describe('weekly workout counts', () => {
  const ws = [workout('2026-03-02'), workout('2026-03-04'), workout('2026-03-08'), workout('2026-03-09'), workout('2026-03-10', [[5, 60]], 'active')];
  it('counts completed workouts per Monday-start week, ignoring active ones', () => {
    const m = weeklyWorkoutCounts(ws);
    expect(m.get('2026-03-02')).toBe(3);
    expect(m.get('2026-03-09')).toBe(1);
    expect(workoutsInWeek(ws, '2026-02-23')).toBe(0);
  });
  it('workout adherence over full weeks', () => {
    const a = workoutAdherence(ws, 3, '2026-03-11', 2);
    expect(a.weeks.map((x) => x.count)).toEqual([0, 3]);
    expect(a.pct).toBe(50);
  });
});

describe('records & progression', () => {
  it('tracks heaviest set and estimated 1RM per exercise (name-normalized)', () => {
    const ws = [workout('2026-03-02', [[10, 80], [5, 90]]), workout('2026-03-09', [[3, 95]], 'completed', 'bench press ')];
    const pr = personalRecords(ws);
    expect(pr).toHaveLength(1);
    expect(pr[0]).toMatchObject({ maxWeightKg: 95, maxWeightReps: 3, maxWeightDate: '2026-03-09' });
    expect(pr[0].best1RM).toBeCloseTo(Math.max(epley1RM(80, 10), epley1RM(90, 5), epley1RM(95, 3)), 6);
    expect(exerciseProgression(ws, 'Bench Press').map((p) => p.topSetKg)).toEqual([90, 95]);
  });
  it('epley', () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 2);
  });
});

describe('coverage & streaks', () => {
  it('coverage over a range', () => {
    expect(coverage(new Set(['2026-03-01', '2026-03-03']), '2026-03-01', '2026-03-04')).toEqual({ days: 2, total: 4, pct: 50 });
  });
  it('streak counts back from today, or from yesterday if today is not logged yet', () => {
    const s = new Set(['2026-03-08', '2026-03-09', '2026-03-10']);
    expect(currentStreak(s, '2026-03-10')).toBe(3);
    expect(currentStreak(s, '2026-03-11')).toBe(3);
    expect(currentStreak(s, '2026-03-12')).toBe(0);
  });
});
