import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom lacks these browser APIs used by Recharts / theme detection.
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver ??= RO;
if (!window.matchMedia) {
  window.matchMedia = (q: string) => ({ matches: false, media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false }) as unknown as MediaQueryList;
}
window.scrollTo = (() => {}) as typeof window.scrollTo;
