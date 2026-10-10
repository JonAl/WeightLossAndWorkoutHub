import { useI18n } from '../i18n';
import { Segmented } from './ui';
import { addDays, today } from '../utils/date';

export type RangeKey = '7' | '30' | '90' | '365' | 'all';
export const RANGE_KEYS: RangeKey[] = ['7', '30', '90', '365', 'all'];

export function rangeBounds(k: RangeKey, earliest?: string): { from: string; to: string; days: number } {
  const to = today();
  if (k === 'all') {
    const from = earliest && earliest < to ? earliest : addDays(to, -29);
    return { from, to, days: Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 };
  }
  const days = Number(k);
  return { from: addDays(to, -(days - 1)), to, days };
}

export function DateRangeSelector({ value, onChange, options = RANGE_KEYS }: { value: RangeKey; onChange: (k: RangeKey) => void; options?: RangeKey[] }) {
  const { t, td } = useI18n();
  return <Segmented label={t('range.label')} value={value} onChange={onChange} options={options.map((k) => ({ value: k, label: td(`range.${k}`) }))} />;
}
