import { Database } from 'bun:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const migration = readFileSync(join(import.meta.dir, '../migrations/001-initial.sql'), 'utf8');
const tokenVersionMigration = readFileSync(join(import.meta.dir, '../migrations/002-token-version.sql'), 'utf8');

export function openDatabase(filename = process.env.DATABASE_PATH ?? join(import.meta.dir, '../../../data/taskflow.sqlite')) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename, { create: true, strict: true });
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const migrations = [
    { version: '001-initial', apply: () => db.exec(migration) },
    { version: '002-token-version', apply: () => {
      const columns = db.query<{ name: string }, any[]>('PRAGMA table_info(users)').all();
      if (!columns.some(({ name }) => name === 'token_version')) db.exec(tokenVersionMigration);
    } },
  ];
  for (const migration of migrations) {
    if (db.query('SELECT version FROM schema_migrations WHERE version = ?').get(migration.version)) continue;
    db.transaction(() => {
      migration.apply();
      db.query('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
    })();
  }
  return db;
}

export type AppDatabase = ReturnType<typeof openDatabase>;
