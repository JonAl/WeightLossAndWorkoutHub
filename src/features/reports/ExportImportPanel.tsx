import { useRef, useState } from 'react';
import { Download, FileJson, Upload, FileSpreadsheet } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../app/AppContext';
import { Card, Notice } from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { applyImport, existingIds, exportAll, markBackupDone } from '../../db/repositories/backupRepo';
import { previewImport, validateBackup, type ImportMode, type ImportPreviewRow, type ValidationResult } from '../../db/backup';
import { db } from '../../db/schema';
import { downloadFile, toCSV } from '../../utils/csv';
import { today } from '../../utils/date';
import { MEASUREMENT_FIELDS } from '../../types';

export type CsvDataset = 'weights' | 'meals' | 'workouts' | 'health' | 'water' | 'steps';
export const CSV_DATASETS: CsvDataset[] = ['weights', 'meals', 'workouts', 'health', 'water', 'steps'];

/** Build CSV text for a dataset. Units: kg, cm, ml, g, km, minutes. */
export async function buildCsv(ds: CsvDataset): Promise<string> {
  switch (ds) {
    case 'weights': return toCSV((await db.weights.orderBy('dateTime').toArray()) as never, ['dateTime', 'weightKg', ...MEASUREMENT_FIELDS, 'bodyFatPct', 'notes']);
    case 'meals': return toCSV((await db.meals.orderBy('dateTime').toArray()) as never, ['dateTime', 'category', 'foodName', 'quantity', 'unit', 'calories', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'notes']);
    case 'health': return toCSV((await db.health.orderBy('dateTime').toArray()) as never, ['dateTime', 'kind', 'value', 'systolic', 'diastolic', 'name', 'dose', 'sideEffects', 'notes']);
    case 'water': return toCSV((await db.water.orderBy('dateTime').toArray()) as never, ['dateTime', 'ml']);
    case 'steps': return toCSV((await db.dailyMetrics.orderBy('date').toArray()) as never, ['date', 'steps']);
    case 'workouts': {
      const rows: Record<string, unknown>[] = [];
      for (const w of await db.workouts.orderBy('date').toArray()) {
        for (const e of w.exercises) {
          if (e.kind === 'cardio') rows.push({ date: w.date, workout: w.title, type: w.type, status: w.status, exercise: e.name, kind: e.kind, cardioType: e.cardio?.cardioType, durationMin: e.cardio?.durationMin, distanceKm: e.cardio?.distanceKm });
          else e.sets.forEach((s, k) => rows.push({ date: w.date, workout: w.title, type: w.type, status: w.status, exercise: e.name, kind: e.kind, set: k + 1, reps: s.reps, weightKg: s.weightKg, rpe: s.rpe, restSec: s.restSec, done: s.done }));
        }
      }
      return toCSV(rows, ['date', 'workout', 'type', 'status', 'exercise', 'kind', 'set', 'reps', 'weightKg', 'rpe', 'restSec', 'done', 'cardioType', 'durationMin', 'distanceKm']);
    }
  }
}

export function ExportImportPanel() {
  const i = useI18n();
  const { t, td } = i;
  const { settings } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [val, setVal] = useState<ValidationResult | null>(null);
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge-skip');
  const [fileName, setFileName] = useState('');

  const backup = async () => {
    setBusy(true);
    try {
      const data = await exportAll();
      const count = Object.values(data.data).reduce((a, rows) => a + (rows as unknown[]).length, 0);
      downloadFile(`weight-loss-hub-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
      await markBackupDone();
      toast(t('backup.created', { n: count }), 'info');
    } catch {
      toast(t('backup.failed'), 'error');
    } finally { setBusy(false); }
  };

  const csv = async (ds: CsvDataset) => {
    try { downloadFile(`${ds}-${today()}.csv`, await buildCsv(ds), 'text/csv;charset=utf-8'); toast(t('backup.csvCreated'), 'info'); }
    catch { toast(t('backup.failed'), 'error'); }
  };

  const onFile = async (f: File | undefined) => {
    setVal(null); setPreview(null);
    if (!f) return;
    setFileName(f.name);
    if (f.size > 50 * 1024 * 1024) { setVal({ ok: false, errors: ['tooLarge'], tables: [] }); return; }
    const v = validateBackup(await f.text());
    setVal(v);
    if (v.ok && v.data) setPreview(previewImport(v.data, await existingIds(), v.tables));
  };

  const doImport = async () => {
    if (!val?.data) return;
    const body = mode === 'replace' ? t('import.replaceWarn') : mode === 'merge-overwrite' ? t('import.overwriteWarn') : t('import.mergeInfo');
    if (!(await confirm({ title: t('import.confirmTitle'), body, danger: mode !== 'merge-skip', confirmLabel: t('import.run') }))) return;
    setBusy(true);
    try {
      const r = await applyImport(val.data, mode);
      toast(t('import.done', { w: r.written, s: r.skipped }));
      setVal(null); setPreview(null); if (fileRef.current) fileRef.current.value = '';
    } catch {
      toast(t('import.failed'), 'error');
    } finally { setBusy(false); }
  };

  const totalInvalid = val?.tables.reduce((a, x) => a + x.invalid.length, 0) ?? 0;

  return (
    <div className="space-y-3">
      <Card title={t('backup.title')} subtitle={settings.lastBackupAt ? t('backup.last', { date: i.date(settings.lastBackupAt.slice(0, 10)) }) : t('backup.never')}>
        <Notice tone="warn">{t('backup.warning')}</Notice>
        <button className="btn-primary mt-3 w-full sm:w-auto" disabled={busy} onClick={backup}><FileJson className="h-4 w-4" />{t('backup.download')}</button>
      </Card>

      <Card title={t('backup.csvTitle')} subtitle={t('backup.csvSub')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CSV_DATASETS.map((d) => <button key={d} className="btn-secondary" onClick={() => csv(d)}><FileSpreadsheet className="h-4 w-4" />{td(`dataset.${d}`)}</button>)}
        </div>
      </Card>

      <Card title={t('import.title')} subtitle={t('import.sub')}>
        <label className="btn-secondary cursor-pointer">
          <Upload className="h-4 w-4" />{t('import.choose')}
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {fileName && <p className="mt-2 text-xs muted">{fileName}</p>}
        {val && !val.ok && <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{t('import.invalid')}: {val.errors.map((e) => td(`import.err.${e}`)).join(', ')}</p>}
        {val?.ok && preview && (
          <div className="mt-3 space-y-3">
            <p className="text-sm">{t('import.fileInfo', { v: val.schemaVersion ?? '?', date: val.exportedAt ? i.date(val.exportedAt.slice(0, 10)) : '—' })}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs muted"><tr><th className="py-1 font-medium">{t('import.dataset')}</th><th className="font-medium">{t('import.incoming')}</th><th className="font-medium">{t('import.duplicates')}</th><th className="font-medium">{t('import.invalidCol')}</th><th className="font-medium">{t('import.existing')}</th></tr></thead>
                <tbody className="tabular-nums">{preview.filter((p) => p.incoming || p.invalid || p.existing).map((p) => (
                  <tr key={p.table} className="border-t border-slate-100 dark:border-navy-800"><td className="py-1">{td(`table.${p.table}`)}</td><td>{p.incoming}</td><td>{p.duplicates}</td><td className={p.invalid ? 'text-red-600' : ''}>{p.invalid}</td><td>{p.existing}</td></tr>
                ))}</tbody>
              </table>
            </div>
            {totalInvalid > 0 && <Notice tone="warn">{t('import.invalidSkipped', { n: totalInvalid })}</Notice>}
            <fieldset className="space-y-2">
              <legend className="label">{t('import.duplicateHandling')}</legend>
              {(['merge-skip', 'merge-overwrite', 'replace'] as ImportMode[]).map((m) => (
                <label key={m} className="flex min-h-[44px] items-start gap-2 text-sm">
                  <input type="radio" name="import-mode" className="mt-1 h-4 w-4 accent-teal-600" checked={mode === m} onChange={() => setMode(m)} />
                  <span><span className="font-medium">{td(`import.mode.${m}`)}</span><span className="block text-xs muted">{td(`import.modeHint.${m}`)}</span></span>
                </label>
              ))}
            </fieldset>
            <button className={mode === 'replace' ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={doImport}><Download className="h-4 w-4" />{t('import.run')}</button>
          </div>
        )}
      </Card>
    </div>
  );
}
