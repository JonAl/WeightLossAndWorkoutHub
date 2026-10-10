import { useState } from 'react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { Modal } from '../../components/Modal';
import { Field, Input } from '../../components/ui';
import { getTraining } from '../../training/settings';
import { platesPerSide, warmupSets } from '../../training/plates';

const PLATE_COLORS = ['bg-red-600', 'bg-blue-600', 'bg-yellow-400', 'bg-green-600', 'bg-slate-100', 'bg-slate-400', 'bg-slate-300'];

/** Plate loading + warm-up ramp for a barbell lift. Works in the user's display unit. */
export function PlateCalculator({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: number }) {
  const i = useI18n();
  const { t } = i;
  const { settings } = useApp();
  const tr = getTraining(settings, i.units);
  const [val, setVal] = useState(initial ? String(Math.round(initial * 100) / 100) : '');
  const [lastInit, setLastInit] = useState(initial);
  if (initial !== lastInit) { setLastInit(initial); setVal(initial ? String(Math.round(initial * 100) / 100) : ''); }
  const target = Number(val.replace(',', '.'));
  const ok = Number.isFinite(target) && target > 0;
  const r = ok ? platesPerSide(target, tr.barWeight, tr.plates) : null;
  const sorted = [...tr.plates].sort((a, b) => b - a);
  const warm = ok ? warmupSets(target, tr.barWeight, Math.min(...tr.plates)) : [];

  return (
    <Modal open={open} onClose={onClose} title={t('plates.title')}>
      <div className="space-y-4">
        <Field label={`${t('plates.target')} (${i.wUnit})`} htmlFor="pc-target" hint={t('plates.barInfo', { bar: i.num(tr.barWeight), u: i.wUnit })}>
          <Input id="pc-target" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} />
        </Field>
        {r && (
          <div>
            <p className="text-sm font-semibold">{t('plates.perSide')}</p>
            {r.perSide.length ? (
              <div className="mt-2 flex items-center gap-1" aria-label={r.perSide.join(' + ')}>
                <div className="h-3 w-10 rounded-l bg-slate-400" aria-hidden />
                {r.perSide.map((p, k) => (
                  <div key={k} className={`flex w-7 items-center justify-center rounded text-[10px] font-bold text-navy-950 ${PLATE_COLORS[sorted.indexOf(p)] ?? 'bg-slate-300'}`} style={{ height: `${28 + Math.min(1, p / sorted[0]) * 40}px` }}>{i.num(p, 2)}</div>
                ))}
              </div>
            ) : <p className="mt-1 text-sm muted">{t('plates.barOnly')}</p>}
            <p className="mt-2 text-sm tabular-nums">{r.perSide.length ? `${r.perSide.map((p) => i.num(p, 2)).join(' + ')} ${i.wUnit}` : ''}</p>
            {Math.abs(r.remainder) > 1e-6 && <p role="alert" className="mt-1 text-sm text-amber-700 dark:text-amber-300">{t('plates.remainder', { loaded: i.num(r.loaded, 2), u: i.wUnit })}</p>}
          </div>
        )}
        {warm.length > 0 && (
          <div>
            <p className="text-sm font-semibold">{t('plates.warmup')}</p>
            <ol className="mt-1 space-y-0.5 text-sm tabular-nums">
              {warm.map((w, k) => <li key={k}>{w.label === 'bar' ? t('plates.bar') : `${i.num(w.weight, 2)} ${i.wUnit}`} × {w.reps}</li>)}
            </ol>
            <p className="mt-1 text-xs muted">{t('plates.warmupNote')}</p>
          </div>
        )}
        <p className="text-xs muted">{t('plates.settingsNote')}</p>
      </div>
    </Modal>
  );
}
