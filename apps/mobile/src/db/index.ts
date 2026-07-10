/**
 * WatermelonDB bootstrap. The local database is the source of truth for reads
 * (ARCHITECTURE.md local-first principle); cloud sync (src/db/sync.ts) is a
 * backup/multi-device layer on top.
 *
 * Encryption at rest: production builds must use a SQLCipher-backed SQLite build
 * and pass a passphrase sourced from the Android Keystore (ARCHITECTURE.md §6).
 * The passphrase is never hardcoded here; it is injected by the native layer at
 * startup. This factory is passphrase-agnostic so tests can run against a plain
 * in-memory database.
 */
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import { modelClasses } from './models';

export function createDatabase(): Database {
  const adapter = new SQLiteAdapter({
    schema,
    migrations,
    jsi: true,
    dbName: 'documenttracker',
    onSetUpError: (error) => {
      // A corrupt or locked DB is a hard failure; route to crash reporting.
      // eslint-disable-next-line no-console
      console.error('WatermelonDB setup error', error);
    },
  });

  return new Database({ adapter, modelClasses });
}

export const database = createDatabase();
