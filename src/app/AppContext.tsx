import { createContext, useContext } from 'react';
import type { Profile, Settings } from '../types';

export interface AppState { profile: Profile; settings: Settings }
export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp outside provider');
  return v;
}
