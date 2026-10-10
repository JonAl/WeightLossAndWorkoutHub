import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal } from '../components/Modal';
import { WeightForm } from '../features/progress/WeightForm';
import { MealForm } from '../features/nutrition/MealForm';
import { HealthForm } from '../features/health/HealthForm';
import { useI18n } from '../i18n';
import { lsRemove } from '../utils/storage';
import type { HealthEntry, HealthKind, MealEntry, WeightEntry } from '../types';

type Req =
  | { type: 'weight'; entry?: WeightEntry }
  | { type: 'meal'; entry?: MealEntry }
  | { type: 'health'; entry?: HealthEntry; kind?: HealthKind };

const Ctx = createContext<(r: Req) => void>(() => {});
export const useQuickAdd = () => useContext(Ctx);

const DRAFT_KEYS = { weight: 'draft:weight-new', meal: 'draft:meal-new', health: 'draft:health-new' };

/** One place that opens add/edit sheets for weight, meals and health logs from any page. */
export function QuickAddProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [req, setReq] = useState<Req | null>(null);
  const [key, setKey] = useState(0);
  const open = useCallback((r: Req) => { setReq(r); setKey((k) => k + 1); }, []);
  const close = useCallback(() => setReq(null), []);
  const cancel = () => { if (req && !req.entry) lsRemove(DRAFT_KEYS[req.type]); close(); };
  const formId = `qa-form-${key}`;
  const title = req ? t(req.entry ? (`edit.${req.type}` as const) : (`add.${req.type}` as const)) : '';
  return (
    <Ctx.Provider value={open}>
      {children}
      <Modal open={!!req} onClose={close} title={title} wide={req?.type === 'meal'}
        footer={<>
          <button type="button" className="btn-secondary" onClick={cancel}>{t('common.cancel')}</button>
          <button type="submit" form={formId} className="btn-primary">{t('common.save')}</button>
        </>}>
        {req?.type === 'weight' && <WeightForm key={key} formId={formId} entry={req.entry} onDone={close} />}
        {req?.type === 'meal' && <MealForm key={key} formId={formId} entry={req.entry} onDone={close} />}
        {req?.type === 'health' && <HealthForm key={key} formId={formId} entry={req.entry} initialKind={req.kind} onDone={close} />}
      </Modal>
    </Ctx.Provider>
  );
}
