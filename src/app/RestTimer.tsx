import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Minus, Plus, Timer, X } from 'lucide-react';
import { useApp } from './AppContext';
import { useI18n } from '../i18n';
import { getTraining } from '../training/settings';
import { fmtClock, remainingSec } from '../training/restTimer';
import { lsGet, lsRemove, lsSet } from '../utils/storage';

interface TimerState { endAt: number; total: number; label: string }
interface Ctx { start: (sec: number, label: string) => void; stop: () => void; active: boolean }
const RestCtx = createContext<Ctx>({ start: () => {}, stop: () => {}, active: false });
export const useRestTimer = () => useContext(RestCtx);

const KEY = 'wlh:restTimer';

/** Plays a short beep with Web Audio (created inside a user gesture so mobile browsers allow it). */
function useBeep() {
  const ctx = useRef<AudioContext | null>(null);
  const unlock = useCallback(() => {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx.current ??= new AC();
      if (ctx.current.state === 'suspended') void ctx.current.resume();
    } catch { /* audio unavailable */ }
  }, []);
  const beep = useCallback(() => {
    const c = ctx.current;
    if (!c) return;
    try {
      [0, 0.25, 0.5].forEach((t, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.value = i === 2 ? 1046 : 784;
        g.gain.setValueAtTime(0.0001, c.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, c.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.18);
        o.connect(g).connect(c.destination);
        o.start(c.currentTime + t);
        o.stop(c.currentTime + t + 0.2);
      });
    } catch { /* ignore */ }
  }, []);
  return { unlock, beep };
}

/**
 * Rest timer shared by the whole app. It stores the end timestamp, so it keeps counting across
 * page changes and reloads. Alerts (sound/vibration) fire while the app is open; background alerts
 * are not possible for a web app on GitHub Pages.
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const { settings } = useApp();
  const { t, units } = useI18n();
  const tr = getTraining(settings, units);
  const [state, setState] = useState<TimerState | null>(() => {
    const s = lsGet<TimerState | null>(KEY, null);
    return s && s.endAt > Date.now() ? s : null;
  });
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState(false);
  const { unlock, beep } = useBeep();

  useEffect(() => {
    if (!state) return;
    const h = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(h);
  }, [state]);

  const left = state ? remainingSec(state.endAt, now) : 0;
  useEffect(() => {
    if (!state || left > 0) return;
    if (tr.restVibrate) try { navigator.vibrate?.([250, 120, 250, 120, 400]); } catch { /* ignore */ }
    if (tr.restSound) beep();
    setState(null); lsRemove(KEY); setDone(true);
    const h = window.setTimeout(() => setDone(false), 4000);
    return () => window.clearTimeout(h);
  }, [left, state, tr.restVibrate, tr.restSound, beep]);

  const start = useCallback((sec: number, label: string) => {
    if (!(sec > 0)) return;
    unlock();
    const s = { endAt: Date.now() + sec * 1000, total: sec, label };
    setState(s); lsSet(KEY, s); setNow(Date.now()); setDone(false);
  }, [unlock]);
  const stop = useCallback(() => { setState(null); lsRemove(KEY); }, []);
  const adjust = (d: number) => setState((s) => {
    if (!s) return s;
    const n = { ...s, endAt: Math.max(Date.now() + 1000, s.endAt + d * 1000), total: Math.max(1, s.total + d) };
    lsSet(KEY, n);
    return n;
  });

  const pct = state ? Math.min(100, (1 - left / state.total) * 100) : 0;
  return (
    <RestCtx.Provider value={{ start, stop, active: !!state }}>
      {children}
      {(state || done) && (
        <div role="timer" aria-live="off" className="fixed inset-x-3 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-[45] mx-auto max-w-sm overflow-hidden rounded-2xl bg-navy-900 text-white shadow-2xl ring-1 ring-teal-500/40 md:bottom-24 md:left-auto md:right-6 md:mx-0">
          {state ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2">
                <Timer aria-hidden className="h-5 w-5 text-teal-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-300">{t('rest.title')}</p>
                  <p className="truncate text-xs text-slate-300">{state.label}</p>
                </div>
                <button className="btn-icon h-9 w-9 text-white hover:bg-white/10" aria-label={t('rest.minus15')} onClick={() => adjust(-15)}><Minus className="h-4 w-4" /></button>
                <span className="w-16 text-center text-2xl font-bold tabular-nums" aria-label={t('rest.remaining', { s: left })}>{fmtClock(left)}</span>
                <button className="btn-icon h-9 w-9 text-white hover:bg-white/10" aria-label={t('rest.plus15')} onClick={() => adjust(15)}><Plus className="h-4 w-4" /></button>
                <button className="btn-icon h-9 w-9 text-white hover:bg-white/10" aria-label={t('rest.skip')} onClick={stop}><X className="h-4 w-4" /></button>
              </div>
              <div className="h-1 bg-white/10"><div className="h-full bg-teal-400 transition-[width] duration-200" style={{ width: `${pct}%` }} /></div>
            </>
          ) : (
            <p role="status" className="px-4 py-3 text-center text-sm font-semibold text-teal-200">{t('rest.done')}</p>
          )}
        </div>
      )}
    </RestCtx.Provider>
  );
}
