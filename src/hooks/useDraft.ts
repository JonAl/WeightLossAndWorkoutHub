import { useCallback, useEffect, useRef } from 'react';
import { lsGet, lsRemove, lsSet } from '../utils/storage';

/**
 * Persists unsaved form input so navigating away (or closing a sheet by accident) does not lose it.
 * Drafts live in localStorage under `draft:<key>` and are cleared on save/cancel.
 */
export function useDraft<T>(key: string | null) {
  const k = key ? `draft:${key}` : null;
  const timer = useRef<number>();
  const load = useCallback((): T | null => (k ? lsGet<T | null>(k, null) : null), [k]);
  const save = useCallback((v: T) => {
    if (!k) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => lsSet(k, v), 250);
  }, [k]);
  const clear = useCallback(() => { window.clearTimeout(timer.current); if (k) lsRemove(k); }, [k]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { load, save, clear };
}
