import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { en, type TKey } from './en';
import { el } from './el';
import type { Language, UnitSystem } from '../types';
import { lengthToDisplay, lengthUnit, weightToDisplay, weightUnit } from '../utils/units';
import { parseDateKey, parseLocalDateTime } from '../utils/date';

export type { TKey } from './en';
export const DICTIONARIES: Record<Language, Record<TKey, string>> = { en, el };
export type TParams = Record<string, string | number | undefined>;

export interface I18n {
  lang: Language;
  units: UnitSystem;
  locale: string;
  t: (key: TKey, params?: TParams) => string;
  /** For dynamically built keys (e.g. `nav.${id}`); falls back to the key itself. */
  td: (key: string, params?: TParams) => string;
  num: (x: number | null | undefined, digits?: number) => string;
  weight: (kg: number | null | undefined, digits?: number, withUnit?: boolean) => string;
  weightValue: (kg: number) => number;
  length: (cm: number | null | undefined, digits?: number) => string;
  wUnit: string;
  lUnit: string;
  pct: (x: number | null | undefined, digits?: number) => string;
  date: (key: string, opts?: Intl.DateTimeFormatOptions) => string;
  dateTime: (s: string) => string;
  shortDate: (key: string) => string;
}

export function interpolate(s: string, params?: TParams): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] === undefined ? `{${k}}` : String(params[k])));
}

export function createI18n(lang: Language, units: UnitSystem): I18n {
  const dict = DICTIONARIES[lang];
  const locale = lang === 'el' ? 'el-GR' : 'en-GB';
  const nf = (d: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const num = (x: number | null | undefined, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : nf(d).format(x));
  const wUnit = weightUnit(units);
  const lUnit = lengthUnit(units);
  const fmtParams = (p?: TParams) => {
    if (!p) return p;
    const o: TParams = {};
    for (const [k, v] of Object.entries(p)) {
      if (typeof v !== 'number') { o[k] = v; continue; }
      if (k.endsWith('Kg')) o[k] = `${num(weightToDisplay(v, units), 1)} ${wUnit}`;
      else if (k.endsWith('Cm')) o[k] = `${num(lengthToDisplay(v, units), 1)} ${lUnit}`;
      else if (k.endsWith('Pct')) o[k] = `${num(v, 1)}%`;
      else o[k] = num(v, 1);
    }
    return o;
  };
  const t = (key: TKey, p?: TParams) => interpolate(dict[key] ?? en[key] ?? key, fmtParams(p));
  return {
    lang, units, locale, wUnit, lUnit, num, t,
    td: (key, p) => interpolate((dict as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key, fmtParams(p)),
    weight: (kg, d = 1, withUnit = true) => (kg === null || kg === undefined ? '—' : `${num(weightToDisplay(kg, units), d)}${withUnit ? ` ${wUnit}` : ''}`),
    weightValue: (kg) => weightToDisplay(kg, units),
    length: (cm, d = 1) => (cm === null || cm === undefined ? '—' : `${num(lengthToDisplay(cm, units), d)} ${lUnit}`),
    pct: (x, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : `${num(x, d)}%`),
    date: (key, opts) => new Intl.DateTimeFormat(locale, opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDateKey(key.slice(0, 10))),
    shortDate: (key) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(parseDateKey(key.slice(0, 10))),
    dateTime: (s) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(parseLocalDateTime(s))
  };
}

const I18nContext = createContext<I18n>(createI18n('el', 'metric'));

export function I18nProvider({ lang, units, children }: { lang: Language; units: UnitSystem; children: ReactNode }) {
  const value = useMemo(() => createI18n(lang, units), [lang, units]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
