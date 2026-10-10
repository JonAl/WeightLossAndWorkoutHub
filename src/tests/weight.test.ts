import { describe, expect, it } from 'vitest';
import { bmi, bmiCategory, dailyWeights, measurementChange, periodChange, totalLost, weeklyAverages, weeklyRate, weightTrend } from '../analytics/weight';
import { addDays, weekStart } from '../utils/date';
import { w } from './helpers';

describe('dailyWeights', () => {
  it('averages multiple weigh-ins on the same day and sorts by date', () => {
    const d = dailyWeights([w('2026-03-02T08:00', 101), w('2026-03-01T08:00', 100), w('2026-03-01T20:00', 102)]);
    expect(d).toEqual([{ date: '2026-03-01', weightKg: 101, count: 2 }, { date: '2026-03-02', weightKg: 101, count: 1 }]);
  });
  it('returns an empty array for no data and ignores invalid weights', () => {
    expect(dailyWeights([])).toEqual([]);
    expect(dailyWeights([w('2026-03-01T08:00', NaN), w('2026-03-01T09:00', -5)])).toEqual([]);
  });
});

describe('weightTrend (7-day trailing mean)', () => {
  it('averages only observed days in the window — missing days are not zero', () => {
    const d = dailyWeights([w('2026-03-01T08:00', 100), w('2026-03-03T08:00', 98), w('2026-03-10T08:00', 96)]);
    const t = weightTrend(d);
    expect(t[0]).toMatchObject({ trendKg: 100, n: 1 });
    expect(t[1]).toMatchObject({ trendKg: 99, n: 2 });
    // 2026-03-10 window is 03-04..03-10 → only itself
    expect(t[2]).toMatchObject({ trendKg: 96, n: 1 });
  });
});

describe('weeklyRate', () => {
  it('computes a regression slope in kg/week from known linear data', () => {
    const entries = Array.from({ length: 15 }, (_, i) => w(`${addDays('2026-03-01', i)}T07:00`, 150 - i * 0.1)); // −0.7 kg/week
    const r = weeklyRate(dailyWeights(entries), '2026-03-15', 28)!;
    expect(r.kgPerWeek).toBeCloseTo(-0.7, 6);
    expect(r.n).toBe(15);
    expect(r.seKgPerWeek).toBeCloseTo(0, 6);
  });
  it('returns null with too few points or too short a span', () => {
    const few = dailyWeights([w('2026-03-01T07:00', 100), w('2026-03-08T07:00', 99), w('2026-03-09T07:00', 99)]);
    expect(weeklyRate(few, '2026-03-09', 28)).toBeNull();
    const short = dailyWeights(['01', '02', '03', '04', '05'].map((d) => w(`2026-03-${d}T07:00`, 100)));
    expect(weeklyRate(short, '2026-03-05', 28)).toBeNull();
  });
});

describe('periodChange', () => {
  it('compares trend values and reports absolute and percent change', () => {
    const entries = Array.from({ length: 31 }, (_, i) => w(`${addDays('2026-03-01', i)}T07:00`, 120 - i * 0.2));
    const trend = weightTrend(dailyWeights(entries));
    const c = periodChange(trend, '2026-03-31', 30)!;
    expect(c.fromDate).toBe('2026-03-01');
    expect(c.absKg).toBeCloseTo(-(trend[0].trendKg - trend[30].trendKg), 6);
    expect(c.pct).toBeCloseTo((c.absKg / c.fromKg) * 100, 6);
  });
  it('returns null when nothing is near the start of the period', () => {
    const trend = weightTrend(dailyWeights([w('2026-03-30T07:00', 100), w('2026-03-31T07:00', 99)]));
    expect(periodChange(trend, '2026-03-31', 90)).toBeNull();
  });
});

describe('totals & BMI', () => {
  it('total lost and percent of starting weight', () => {
    const r = totalLost(155, 145);
    expect(r.kg).toBe(10);
    expect(r.pct).toBeCloseTo(6.4516, 3);
  });
  it('BMI for 145 kg at 182 cm', () => {
    expect(bmi(145, 182)).toBeCloseTo(43.775, 2);
    expect(bmiCategory(43.8)).toBe('obese3');
    expect(bmi(100, 0)).toBeNull();
  });
});

describe('weekly averages & measurements', () => {
  it('groups by Monday-start weeks', () => {
    const d = dailyWeights([w('2026-03-02T07:00', 100), w('2026-03-08T07:00', 98), w('2026-03-09T07:00', 97)]); // Mon, Sun, Mon
    const wk = weeklyAverages(d, weekStart);
    expect(wk).toEqual([{ weekStart: '2026-03-02', avgKg: 99, n: 2 }, { weekStart: '2026-03-09', avgKg: 97, n: 1 }]);
  });
  it('measurement change needs two records', () => {
    const e = [w('2026-03-01T07:00', 100, { waistCm: 130 }), w('2026-03-05T07:00', 100), w('2026-03-20T07:00', 99, { waistCm: 127.5 })];
    expect(measurementChange(e, 'waistCm')).toMatchObject({ change: -2.5, n: 2 });
    expect(measurementChange(e, 'hipCm')).toBeNull();
  });
});
