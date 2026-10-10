import { useState } from 'react';
import { Save } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { Card, Field, Input, Toggle } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { updateSettings } from '../../db/repositories';
import { getTraining } from '../../training/settings';

export function TrainingSettingsCard() {
  const i = useI18n();
  const { t } = i;
  const { settings } = useApp();
  const toast = useToast();
  const tr = getTraining(settings, i.units);
  const [rest, setRest] = useState(String(tr.defaultRestSec));
  const [bar, setBar] = useState(String(tr.barWeight));
  const [plates, setPlates] = useState(tr.plates.join(', '));
  const [err, setErr] = useState('');
  const patch = (p: Partial<typeof tr>) => updateSettings({ training: { ...settings.training, ...p } });
  const save = async () => {
    const r = Number(rest), b = Number(bar.replace(',', '.'));
    const ps = plates.split(/[,\s;]+/).map((x) => Number(x.replace(',', '.'))).filter((x) => x > 0);
    if (!(r >= 0 && r <= 900) || !(b >= 0 && b <= 100) || ps.length === 0) { setErr(t('val.range')); return; }
    setErr('');
    await patch({ defaultRestSec: r, barWeight: b, plates: [...new Set(ps)].sort((a, c) => c - a) });
    toast(t('toast.saved'));
  };
  return (
    <Card title={t('trs.title')} subtitle={t('trs.sub')}>
      <div className="divide-y divide-slate-100 dark:divide-navy-800">
        <Toggle label={t('trs.autoRest')} description={t('trs.autoRestHint')} checked={tr.autoStartRest} onChange={(v) => patch({ autoStartRest: v })} />
        <Toggle label={t('trs.sound')} checked={tr.restSound} onChange={(v) => patch({ restSound: v })} />
        <Toggle label={t('trs.vibrate')} checked={tr.restVibrate} onChange={(v) => patch({ restVibrate: v })} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label={t('trs.defaultRest')} htmlFor="trs-rest"><Input id="trs-rest" inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} /></Field>
        <Field label={`${t('trs.bar')} (${i.wUnit})`} htmlFor="trs-bar"><Input id="trs-bar" inputMode="decimal" value={bar} onChange={(e) => setBar(e.target.value)} /></Field>
        <Field label={`${t('trs.plates')} (${i.wUnit})`} htmlFor="trs-plates" hint={t('trs.platesHint')}><Input id="trs-plates" value={plates} onChange={(e) => setPlates(e.target.value)} /></Field>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
      <p className="mt-2 text-xs muted">{t('trs.bgNote')}</p>
      <button className="btn-primary mt-3" onClick={save}><Save className="h-4 w-4" />{t('common.save')}</button>
    </Card>
  );
}
