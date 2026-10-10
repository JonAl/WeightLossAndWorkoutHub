import type Dexie from 'dexie';
import type { Transaction } from 'dexie';

/**
 * IndexedDB schema versions. To change the schema, append a new entry — never edit an
 * existing one. Dexie runs every `upgrade` whose version is above the stored version.
 * Only indexed fields are listed; other properties are stored but not indexed.
 */
export interface SchemaVersion {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => Promise<void> | void;
}

export const SCHEMA_VERSIONS: SchemaVersion[] = [
  {
    version: 1,
    stores: {
      profile: 'id',
      settings: 'id',
      weights: 'id, dateTime',
      meals: 'id, dateTime, category, foodName',
      foods: 'id, name, favorite',
      savedMeals: 'id, name',
      water: 'id, dateTime',
      dailyMetrics: 'id, date',
      workouts: 'id, date, status, type',
      templates: 'id, name',
      health: 'id, dateTime, kind',
      schedules: 'id, kind',
      recommendationStates: 'id',
      weeklyReviews: 'id'
    }
  },
  {
    // v2: adds fiber target to profiles created by v1 builds.
    version: 2,
    stores: {},
    upgrade: async (tx) => {
      await tx.table('profile').toCollection().modify((p: { fiberTargetG?: number }) => {
        if (p.fiberTargetG === undefined) p.fiberTargetG = 30;
      });
    }
  }
];

export const CURRENT_DB_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1].version;

export function applyMigrations(db: Dexie): void {
  for (const v of SCHEMA_VERSIONS) {
    const s = db.version(v.version).stores(v.stores);
    if (v.upgrade) s.upgrade(v.upgrade);
  }
}
