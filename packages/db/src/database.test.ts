import Database from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { migrate, openDatabase } from './database';
import { MIGRATIONS } from './migrations';
import { ensureDefaultWorkspace } from './services';
import { ALL_TABLES, environments, projects, settings, workspaces } from './tables';

describe('database & migrations [M2-01]', () => {
  it('creates every table of SPEC Phụ lục 2 with the common columns', () => {
    const db = openDatabase({ path: ':memory:' });
    const names = (
      db.$client
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite%'",
        )
        .all() as { name: string }[]
    ).map((r) => r.name);
    expect(names.sort()).toEqual(
      [
        'artifacts',
        'datasets',
        'elements',
        'environments',
        'folders',
        'projects',
        'run_cases',
        'run_steps',
        'runs',
        'secrets',
        'settings',
        'shared_steps',
        'suite_items',
        'suites',
        'test_cases',
        'variables',
        'workspaces',
      ].sort(),
    );
    for (const t of names) {
      const cols = (
        db.$client.prepare(`PRAGMA table_info("${t}")`).all() as { name: string }[]
      ).map((c) => c.name);
      expect(cols, t).toEqual(
        expect.arrayContaining([
          'id',
          'workspace_id',
          'created_at',
          'updated_at',
          'deleted_at',
          'version',
        ]),
      );
    }
  });

  it('matches the Drizzle tables exactly (columns, types, not-null)', () => {
    const db = openDatabase({ path: ':memory:' });
    for (const table of Object.values(ALL_TABLES)) {
      const cfg = getTableConfig(table);
      const actual = (
        db.$client.prepare(`PRAGMA table_info("${cfg.name}")`).all() as {
          name: string;
          type: string;
          notnull: number;
          pk: number;
        }[]
      ).map((c) => `${c.name}:${c.type}:${c.notnull || c.pk ? 'nn' : ''}`);
      const expected = cfg.columns.map(
        (c) => `${c.name}:${c.getSQLType().toUpperCase()}:${c.notNull || c.primary ? 'nn' : ''}`,
      );
      expect(actual.sort(), cfg.name).toEqual(expected.sort());
    }
  });

  it('applies migrations once and records them', () => {
    const client = new Database(':memory:');
    expect(migrate(client)).toEqual(MIGRATIONS.map((m) => m.id));
    expect(migrate(client)).toEqual([]);
    const rows = client.prepare('SELECT id, name FROM _kiemi_migrations').all();
    expect(rows).toEqual(MIGRATIONS.map((m) => ({ id: m.id, name: m.name })));
  });

  it('rolls back a failing migration', () => {
    const client = new Database(':memory:');
    migrate(client);
    expect(() =>
      migrate(client, [
        ...MIGRATIONS,
        { id: 999, name: 'bad', sql: 'CREATE TABLE x (a); SELECT nope FROM missing;' },
      ]),
    ).toThrow();
    expect(client.prepare("SELECT count(*) n FROM sqlite_master WHERE name = 'x'").get()).toEqual({
      n: 0,
    });
    expect(client.prepare('SELECT count(*) n FROM _kiemi_migrations').get()).toEqual({
      n: MIGRATIONS.length,
    });
  });

  it('seeds the default workspace, project, environment and language once', () => {
    const db = openDatabase({ path: ':memory:' });
    const first = ensureDefaultWorkspace(db);
    const again = ensureDefaultWorkspace(db);
    expect(first.created).toBe(true);
    expect(again).toEqual({ ...first, created: false });
    expect(first.workspaceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/); // UUIDv7
    expect(db.select().from(workspaces).all()).toHaveLength(1);
    expect(db.select().from(projects).all()).toMatchObject([
      { id: first.projectId, workspaceId: first.workspaceId, name: 'Dự án đầu tiên' },
    ]);
    expect(db.select().from(environments).all()).toMatchObject([
      { name: 'Mặc định', projectId: first.projectId },
    ]);
    expect(db.select().from(settings).all()).toMatchObject([{ key: 'language', value: 'vi' }]);
  });
});
