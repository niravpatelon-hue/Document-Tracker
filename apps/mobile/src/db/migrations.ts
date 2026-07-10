/**
 * Schema migrations. Empty at v1 (initial schema). When the schema `version`
 * bumps, add a migration step here so existing on-device databases upgrade in
 * place rather than being wiped — important for a local-first app where the
 * device may hold the only full-resolution copy of a document.
 */
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [],
});
