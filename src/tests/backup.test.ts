import { beforeEach, describe, expect, it } from 'vitest';
import { validateBackup, previewImport, rowsToWrite, BACKUP_SCHEMA_VERSION } from '../db/backup';
import { db } from '../db/schema';
import { addWeight, ensureSeed, deleteAllData, findPossibleDuplicate } from '../db/repositories';
import { applyImport, exportAll, existingIds } from '../db/repositories/backupRepo';
import { w } from './helpers';

const file = (data: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ app: 'weight-loss-hub', schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: '2026-03-01T10:00:00Z', data, ...extra });

describe('validateBackup', () => {
  it('rejects non-JSON, foreign and future-version files', () => {
    expect(validateBackup('nope').errors).toEqual(['notJson']);
    expect(validateBackup('{"a":1}').errors).toEqual(['badStructure']);
    expect(validateBackup(file({}, { app: 'other' })).errors).toEqual(['wrongApp']);
    expect(validateBackup(file({}, { schemaVersion: 99 })).errors).toEqual(['unsupportedVersion']);
  });
  it('keeps valid records and reports invalid ones per table', () => {
    const v = validateBackup(file({ weights: [w('2026-03-01T07:00', 100), { id: 'x', dateTime: 'bad', weightKg: 100 }, { id: 'y', dateTime: '2026-03-01T07:00', weightKg: -1 }] }));
    expect(v.ok).toBe(true);
    const t = v.tables.find((x) => x.table === 'weights')!;
    expect(t.valid).toBe(1);
    expect(t.invalid.map((i) => i.index)).toEqual([1, 2]);
    expect(v.data!.weights).toHaveLength(1);
  });
  it('flags a table that is not an array', () => {
    const v = validateBackup(file({ meals: 'oops' }));
    expect(v.tables.find((x) => x.table === 'meals')!.invalid[0].error).toBe('notArray');
  });
});

describe('import preview & modes', () => {
  it('counts duplicates by id', () => {
    const v = validateBackup(file({ weights: [{ ...w('2026-03-01T07:00', 100), id: 'a' }, { ...w('2026-03-02T07:00', 99), id: 'b' }] }));
    const ids = Object.fromEntries(['profile', 'settings', 'weights', 'meals', 'foods', 'savedMeals', 'water', 'dailyMetrics', 'workouts', 'templates', 'health', 'schedules', 'recommendationStates', 'weeklyReviews'].map((t) => [t, new Set<string>()])) as never as Parameters<typeof previewImport>[1];
    ids.weights.add('a');
    const p = previewImport(v.data!, ids, v.tables).find((r) => r.table === 'weights')!;
    expect(p).toMatchObject({ incoming: 2, duplicates: 1, existing: 1 });
    expect(rowsToWrite([{ id: 'a' }, { id: 'b' }], new Set(['a']), 'merge-skip')).toEqual([{ id: 'b' }]);
    expect(rowsToWrite([{ id: 'a' }, { id: 'b' }], new Set(['a']), 'merge-overwrite')).toHaveLength(2);
  });
});

describe('IndexedDB round trip (fake-indexeddb)', () => {
  beforeEach(async () => { await db.open(); await deleteAllData(); });

  it('seeds profile/settings and exports everything', async () => {
    await ensureSeed();
    await addWeight({ dateTime: '2026-03-01T07:00', weightKg: 145 });
    const b = await exportAll();
    expect(b.app).toBe('weight-loss-hub');
    expect(b.data.profile).toHaveLength(1);
    expect(b.data.weights).toHaveLength(1);
    expect(b.data.templates.length).toBeGreaterThan(0);
  });

  it('merge-skip keeps local edits; replace restores the backup exactly', async () => {
    const r = await addWeight({ dateTime: '2026-03-01T07:00', weightKg: 145 });
    const backup = JSON.stringify(await exportAll());
    await db.weights.update(r.id, { weightKg: 144 });
    await addWeight({ dateTime: '2026-03-02T07:00', weightKg: 143.5 });

    const v = validateBackup(backup);
    const s1 = await applyImport(v.data!, 'merge-skip');
    expect(s1.written).toBe(0);
    expect((await db.weights.get(r.id))!.weightKg).toBe(144);

    await applyImport(v.data!, 'merge-overwrite');
    expect((await db.weights.get(r.id))!.weightKg).toBe(145);
    expect(await db.weights.count()).toBe(2);

    await applyImport(v.data!, 'replace');
    expect(await db.weights.count()).toBe(1);
    expect((await existingIds()).weights.has(r.id)).toBe(true);
  });

  it('flags likely duplicate weigh-ins but allows legitimate repeats', async () => {
    const a = await addWeight({ dateTime: '2026-03-01T07:00', weightKg: 145 });
    const all = await db.weights.toArray();
    expect(findPossibleDuplicate(all, { dateTime: '2026-03-01T07:05', weightKg: 145.02 })?.id).toBe(a.id);
    expect(findPossibleDuplicate(all, { dateTime: '2026-03-01T19:00', weightKg: 145 })).toBeUndefined();
    expect(findPossibleDuplicate(all, { dateTime: '2026-03-01T07:05', weightKg: 146 })).toBeUndefined();
    expect(findPossibleDuplicate(all, { id: a.id, dateTime: '2026-03-01T07:00', weightKg: 145 })).toBeUndefined();
  });
});
