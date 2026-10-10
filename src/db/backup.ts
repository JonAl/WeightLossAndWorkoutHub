import { z } from 'zod';
import type { AppData, TableName } from '../types';
import { TABLE_NAMES } from '../types';
import { HEALTH_KINDS, MEAL_CATEGORIES, WORKOUT_TYPES } from '../types';

/** Version of the JSON backup format (independent from the IndexedDB schema version). */
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_APP_ID = 'weight-loss-hub';

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  data: AppData;
}

// ---------- validation schemas (structural; unknown extra fields are kept) ----------
const id = z.string().min(1);
const num = z.number().finite();
const optNum = num.optional().nullable().transform((v) => (v === null ? undefined : v));
const dt = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'invalid date');

const weight = z.object({ id, dateTime: dt, weightKg: num.positive().max(700) }).passthrough();
const meal = z.object({ id, dateTime: dt, category: z.enum(MEAL_CATEGORIES as [string, ...string[]]), foodName: z.string(), quantity: num, unit: z.string(), calories: optNum, proteinG: optNum, carbsG: optNum, fatG: optNum, fiberG: optNum }).passthrough();
const food = z.object({ id, name: z.string(), servingSize: num.positive(), servingUnit: z.string() }).passthrough();
const savedMeal = z.object({ id, name: z.string(), items: z.array(z.object({ foodName: z.string(), quantity: num }).passthrough()) }).passthrough();
const water = z.object({ id, dateTime: dt, ml: num.nonnegative() }).passthrough();
const dailyMetric = z.object({ id, date: dt }).passthrough();
const exercise = z.object({ id, name: z.string(), kind: z.enum(['resistance', 'bodyweight', 'cardio']), sets: z.array(z.object({ id, done: z.boolean() }).passthrough()) }).passthrough();
const workout = z.object({ id, status: z.enum(['active', 'completed']), type: z.enum(WORKOUT_TYPES as [string, ...string[]]), date: dt, exercises: z.array(exercise) }).passthrough();
const template = z.object({ id, name: z.string(), exercises: z.array(z.object({ name: z.string() }).passthrough()) }).passthrough();
const health = z.object({ id, kind: z.enum(HEALTH_KINDS as [string, ...string[]]), dateTime: dt }).passthrough();
const schedule = z.object({ id, kind: z.enum(['medication', 'supplement']), name: z.string(), dose: z.string(), times: z.array(z.string()) }).passthrough();
const recState = z.object({ id, status: z.enum(['dismissed', 'completed']) }).passthrough();
const review = z.object({ id, review: z.object({}).passthrough() }).passthrough();
const profile = z.object({ id: z.literal('profile'), heightCm: num, startWeightKg: num, proteinTargetG: num }).passthrough();
const settings = z.object({ id: z.literal('settings'), language: z.enum(['el', 'en']) }).passthrough();

const TABLE_SCHEMAS: Record<TableName, z.ZodTypeAny> = {
  profile, settings, weights: weight, meals: meal, foods: food, savedMeals: savedMeal, water, dailyMetrics: dailyMetric,
  workouts: workout, templates: template, health, schedules: schedule, recommendationStates: recState, weeklyReviews: review
};

export interface TableValidation { table: TableName; valid: number; invalid: { index: number; error: string }[] }
export interface ValidationResult {
  ok: boolean;
  /** Fatal problems: not JSON, wrong app, unsupported version. */
  errors: string[];
  schemaVersion?: number;
  exportedAt?: string;
  tables: TableValidation[];
  /** Only the records that passed validation. */
  data?: AppData;
}

/** Migrate older backup formats to the current format. Add a case for every new version. */
export function migrateBackup(raw: { schemaVersion: number; data: Record<string, unknown> }): Record<string, unknown> {
  const data = { ...raw.data };
  // v1 is current; future versions add transforms here, e.g. `if (raw.schemaVersion < 2) {...}`.
  return data;
}

export function validateBackup(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['notJson'], tables: [] };
  }
  const head = z.object({ app: z.string(), schemaVersion: z.number().int(), exportedAt: z.string().optional(), data: z.record(z.unknown()) }).safeParse(parsed);
  if (!head.success) return { ok: false, errors: ['badStructure'], tables: [] };
  if (head.data.app !== BACKUP_APP_ID) return { ok: false, errors: ['wrongApp'], tables: [] };
  if (head.data.schemaVersion > BACKUP_SCHEMA_VERSION || head.data.schemaVersion < 1) return { ok: false, errors: ['unsupportedVersion'], schemaVersion: head.data.schemaVersion, tables: [] };

  const migrated = migrateBackup(head.data);
  const tables: TableValidation[] = [];
  const out = {} as Record<TableName, unknown[]>;
  for (const t of TABLE_NAMES) {
    const rows = migrated[t];
    const tv: TableValidation = { table: t, valid: 0, invalid: [] };
    out[t] = [];
    if (rows !== undefined && !Array.isArray(rows)) {
      tv.invalid.push({ index: -1, error: 'notArray' });
    } else if (Array.isArray(rows)) {
      rows.forEach((r, i) => {
        const res = TABLE_SCHEMAS[t].safeParse(r);
        if (res.success) { out[t].push(res.data); tv.valid++; }
        else tv.invalid.push({ index: i, error: res.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
      });
    }
    tables.push(tv);
  }
  return { ok: true, errors: [], schemaVersion: head.data.schemaVersion, exportedAt: head.data.exportedAt, tables, data: out as unknown as AppData };
}

export type ImportMode = 'merge-skip' | 'merge-overwrite' | 'replace';

export interface ImportPreviewRow { table: TableName; incoming: number; duplicates: number; invalid: number; existing: number }

/** Count incoming records whose id already exists locally. */
export function previewImport(incoming: AppData, existingIds: Record<TableName, Set<string>>, validation: TableValidation[]): ImportPreviewRow[] {
  return TABLE_NAMES.map((t) => {
    const rows = (incoming[t] as { id: string }[]) ?? [];
    return {
      table: t,
      incoming: rows.length,
      duplicates: rows.filter((r) => existingIds[t]?.has(r.id)).length,
      invalid: validation.find((v) => v.table === t)?.invalid.length ?? 0,
      existing: existingIds[t]?.size ?? 0
    };
  });
}

/** Decide which incoming rows to write for a mode. Singleton tables (profile/settings) follow the same rule. */
export function rowsToWrite<T extends { id: string }>(rows: T[], existing: Set<string>, mode: ImportMode): T[] {
  if (mode === 'merge-skip') return rows.filter((r) => !existing.has(r.id));
  return rows;
}
