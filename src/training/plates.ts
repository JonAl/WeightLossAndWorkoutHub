/**
 * Plate & warm-up calculators. All values are in ONE unit (the user's display unit: kg or lb).
 */
export interface PlateResult { perSide: number[]; loaded: number; remainder: number }

/** Greedy plate loading per side for a target total weight including the bar. */
export function platesPerSide(target: number, bar: number, plates: number[]): PlateResult {
  const sorted = [...plates].filter((p) => p > 0).sort((a, b) => b - a);
  let side = (target - bar) / 2;
  const perSide: number[] = [];
  if (side <= 0) return { perSide, loaded: bar, remainder: Math.max(0, target - bar) };
  for (const p of sorted) {
    while (side + 1e-9 >= p) { perSide.push(p); side -= p; }
  }
  const loaded = bar + 2 * perSide.reduce((a, b) => a + b, 0);
  return { perSide, loaded: round(loaded), remainder: round(target - loaded) };
}

export interface WarmupSet { weight: number; reps: number; label: 'bar' | 'pct' }

/**
 * Warm-up ramp for a working weight: empty bar × 10, then 40 % × 5, 60 % × 3, 80 % × 2,
 * rounded down to a loadable step (2 × smallest plate). Steps that are not heavier than the
 * previous one are skipped.
 */
export function warmupSets(working: number, bar: number, smallestPlate: number): WarmupSet[] {
  if (!(working > bar)) return [];
  const step = 2 * smallestPlate;
  const out: WarmupSet[] = [{ weight: bar, reps: 10, label: 'bar' }];
  for (const [pct, reps] of [[0.4, 5], [0.6, 3], [0.8, 2]] as const) {
    const w = Math.max(bar, Math.floor((working * pct) / step) * step);
    if (w > out[out.length - 1].weight && w < working) out.push({ weight: round(w), reps, label: 'pct' });
  }
  return out;
}

const round = (x: number) => Math.round(x * 100) / 100;
