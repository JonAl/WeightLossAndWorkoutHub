import { useEffect, useState } from 'react';
import type { ThemeMode } from '../types';

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/** Applies the theme class to <html> and returns whether dark mode is active. */
export function useApplyTheme(mode: ThemeMode): boolean {
  const [sys, setSys] = useState(systemDark());
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const h = () => setSys(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  const dark = mode === 'dark' || (mode === 'system' && !!sys);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#070c18' : '#0b1324');
  }, [dark]);
  return dark;
}

/** Chart colors validated for colorblind separation & contrast (light/dark surfaces). */
export function chartColors(dark: boolean) {
  return dark
    ? { primary: '#14a08a', secondary: '#7377e6', accent: '#c47c0a', muted: '#64748b', grid: '#1e293b', axis: '#94a3b8', target: '#94a3b8' }
    : { primary: '#00957f', secondary: '#5b5fd6', accent: '#d97706', muted: '#94a3b8', grid: '#e2e8f0', axis: '#64748b', target: '#64748b' };
}
