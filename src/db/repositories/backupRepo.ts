import { db } from '../schema';
import type { AppData, TableName } from '../../types';
import { TABLE_NAMES } from '../../types';
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, rowsToWrite, type BackupFile, type ImportMode } from '../backup';
import { ensureSeed, updateSettings } from './index';
import { isoNow } from '../../utils/id';

export async function exportAll(): Promise<BackupFile> {
  const data = {} as Record<TableName, unknown[]>;
  await db.transaction('r', TABLE_NAMES.map((t) => db.table(t)), async () => {
    for (const t of TABLE_NAMES) data[t] = await db.table(t).toArray();
  });
  return { app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: isoNow(), data: data as unknown as AppData };
}

export async function existingIds(): Promise<Record<TableName, Set<string>>> {
  const out = {} as Record<TableName, Set<string>>;
  for (const t of TABLE_NAMES) out[t] = new Set((await db.table(t).toCollection().primaryKeys()) as string[]);
  return out;
}

export interface ImportSummary { written: number; skipped: number }

/** Apply a validated import atomically. Either everything is written or nothing is. */
export async function applyImport(data: AppData, mode: ImportMode): Promise<ImportSummary> {
  const ids = await existingIds();
  let written = 0, skipped = 0;
  await db.transaction('rw', TABLE_NAMES.map((t) => db.table(t)), async () => {
    if (mode === 'replace') for (const t of TABLE_NAMES) await db.table(t).clear();
    for (const t of TABLE_NAMES) {
      const rows = (data[t] as { id: string }[]) ?? [];
      const toWrite = mode === 'replace' ? rows : rowsToWrite(rows, ids[t], mode);
      skipped += rows.length - toWrite.length;
      if (toWrite.length) await db.table(t).bulkPut(toWrite);
      written += toWrite.length;
    }
  });
  await ensureSeed();
  return { written, skipped };
}

export async function markBackupDone(): Promise<void> {
  await updateSettings({ lastBackupAt: isoNow() });
}
