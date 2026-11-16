import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { MIGRATIONS, type Migration } from './migrations';
import * as tables from './tables';

export type KiemiDb = BetterSQLite3Database<typeof tables> & { $client: Database.Database };

export interface OpenOptions {
  /** File path, or `:memory:` for tests. */
  path: string;
  migrations?: readonly Migration[];
  /**
   * When an existing database needs migrations (first start of a new app version), a copy
   * is saved here first: `kiemi-before-<lastAppliedId>-<timestamp>.db` [N-12].
   */
  backupDir?: string;
}

/**
 * Opens (creating if needed) the Kiemi database, enables WAL + foreign-key
 * friendly pragmas and applies pending migrations [M2-01].
 */
export function openDatabase(options: OpenOptions): KiemiDb {
  const client = new Database(options.path);
  client.pragma('journal_mode = WAL');
  client.pragma('synchronous = NORMAL');
  client.pragma('busy_timeout = 5000');
  const migrations = options.migrations ?? MIGRATIONS;
  if (options.backupDir) backupBeforeMigrate(client, migrations, options.backupDir);
  migrate(client, migrations);
  return drizzle(client, { schema: tables });
}

/** Ids of migrations already applied ([] for a new database). */
function appliedIds(client: Database.Database): number[] {
  const table = client
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_kiemi_migrations'")
    .get();
  if (!table) return [];
  return (client.prepare('SELECT id FROM "_kiemi_migrations"').all() as { id: number }[]).map(
    (r) => r.id,
  );
}

/** Copies an existing database before new migrations run. Returns the backup path. */
export function backupBeforeMigrate(
  client: Database.Database,
  migrations: readonly Migration[],
  dir: string,
): string | undefined {
  const done = appliedIds(client);
  if (done.length === 0) return undefined;
  const doneSet = new Set(done);
  if (migrations.every((m) => doneSet.has(m.id))) return undefined;
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `kiemi-before-${Math.max(...done)}-${Date.now()}.db`);
  client.prepare('VACUUM INTO ?').run(file);
  return file;
}

/** Applies migrations not yet recorded. Returns the ids applied now. */
export function migrate(
  client: Database.Database,
  migrations: readonly Migration[] = MIGRATIONS,
): number[] {
  client.exec(
    'CREATE TABLE IF NOT EXISTS "_kiemi_migrations" ("id" INTEGER PRIMARY KEY, "name" TEXT NOT NULL, "applied_at" INTEGER NOT NULL)',
  );
  const done = new Set(
    (client.prepare('SELECT id FROM "_kiemi_migrations"').all() as { id: number }[]).map(
      (r) => r.id,
    ),
  );
  const applied: number[] = [];
  const record = client.prepare(
    'INSERT INTO "_kiemi_migrations" (id, name, applied_at) VALUES (?, ?, ?)',
  );
  for (const m of [...migrations].sort((a, b) => a.id - b.id)) {
    if (done.has(m.id)) continue;
    client.transaction(() => {
      client.exec(m.sql);
      record.run(m.id, m.name, Date.now());
    })();
    applied.push(m.id);
  }
  return applied;
}
