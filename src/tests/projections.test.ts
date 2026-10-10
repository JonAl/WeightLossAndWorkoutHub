import { describe, expect, it } from 'vitest';
import { projectWeight } from '../analytics/projections';
import { dailyWeights } from '../analytics/weight';
import { pearson } from '../utils/stats';
import { addDays } from '../utils/date';
import { w } from './helpers';

const linear = (days: number, start: number, perDay: number) => dailyWeights(Array.from({ length: days }, (_, i) => w(`${addDays('2026-03-01', i)}T07:00`, start + i * perDay)));

describe('projectWeight', () => {
  it('produces a range that brackets the observed rate', () => {
    const d = linear(28, 140, -0.1); // −0.7 kg/week, perfect fit → band = ±0.25
    const p = projectWeight(d, '2026-03-28', 137.3, 100)!;
    expect(p.rateKgPerWeek).toBeCloseTo(-0.7, 6);
    expect(p.fastRate).toBeCloseTo(-0.95, 6);
    expect(p.slowRate).toBeCloseTo(-0.45, 6);
    const four = p.points.find((x) => x.weeks === 4)!;
    expect(four.lowKg).toBeCloseTo(137.3 - 0.95 * 4, 6);
    expect(four.highKg).toBeCloseTo(137.3 - 0.45 * 4, 6);
    // > 8 weeks: slower bound reduced by 25 %
    const twelve = p.points.find((x) => x.weeks === 12)!;
    expect(twelve.highKg).toBeCloseTo(137.3 - 0.45 * 0.75 * 12, 6);
    expect(p.weeksToGoal).toEqual({ min: Math.ceil(37.3 / 0.95), max: Math.ceil(37.3 / (0.45 * 0.75)) });
  });
  it('never projects below the goal weight', () => {
    const p = projectWeight(linear(28, 102, -0.2), '2026-03-28', 96.6, 95)!;
    expect(Math.min(...p.points.map((x) => x.lowKg))).toBe(95);
  });
  it('returns null with insufficient data', () => {
    expect(projectWeight(linear(9, 140, -0.1), '2026-03-09', 139)).toBeNull();
    expect(projectWeight([], '2026-03-09', 139)).toBeNull();
  });
  it('does not give a time-to-goal when the band includes gaining', () => {
    const p = projectWeight(linear(28, 140, -0.01), '2026-03-28', 139.7, 100)!;
    expect(p.weeksToGoal).toBeNull();
  });
});

describe('pearson', () => {
  it('requires a minimum sample', () => {
    expect(pearson([[1, 2], [2, 4]], 10)).toBeNull();
    const pts = Array.from({ length: 10 }, (_, i) => [i, 2 * i + 1] as [number, number]);
    expect(pearson(pts)!.r).toBeCloseTo(1, 10);
  });
});
