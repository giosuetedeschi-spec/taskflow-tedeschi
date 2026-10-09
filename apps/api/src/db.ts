import { Database } from 'bun:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const migration = readFileSync(join(import.meta.dir, '../migrations/001-initial.sql'), 'utf8');

export function openDatabase(filename = process.env.DATABASE_PATH ?? join(import.meta.dir, '../../../data/taskflow.sqlite')) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename, { create: true, strict: true });
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  if (!db.query('SELECT version FROM schema_migrations WHERE version = ?').get('001-initial')) {
    db.exec(`BEGIN; ${migration}; INSERT INTO schema_migrations (version) VALUES ('001-initial'); COMMIT;`);
  }
  return db;
}

export type AppDatabase = ReturnType<typeof openDatabase>;
