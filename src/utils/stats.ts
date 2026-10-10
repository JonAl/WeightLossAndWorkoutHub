// Small deterministic statistics helpers. Inputs never contain "missing" values:
// callers must filter undefined/null out first so missing data is never treated as zero.

export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function round(x: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

export interface Regression {
  slope: number;
  intercept: number;
  n: number;
  /** Standard error of the slope (null when n < 3). */
  slopeSE: number | null;
}

export function linearRegression(points: { x: number; y: number }[]): Regression | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let slopeSE: number | null = null;
  if (n >= 3) {
    const sse = points.reduce((a, p) => a + (p.y - (intercept + slope * p.x)) ** 2, 0);
    slopeSE = Math.sqrt(sse / (n - 2) / sxx);
  }
  return { slope, intercept, n, slopeSE };
}

export interface Correlation {
  r: number;
  n: number;
}

/** Pearson correlation. Returns null when fewer than `minN` pairs or zero variance. */
export function pearson(pairs: [number, number][], minN = 10): Correlation | null {
  const n = pairs.length;
  if (n < minN) return null;
  const mx = pairs.reduce((a, p) => a + p[0], 0) / n;
  const my = pairs.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return { r: sxy / Math.sqrt(sxx * syy), n };
}

export function pctChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / from) * 100;
}
