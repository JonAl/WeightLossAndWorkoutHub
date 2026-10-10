import { createContext, useContext } from 'react';
import { chartColors } from '../hooks/useTheme';

export const DarkContext = createContext(false);
export function useChartColors() {
  const dark = useContext(DarkContext);
  return { dark, c: chartColors(dark) };
}
