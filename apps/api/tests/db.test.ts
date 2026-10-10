import { describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db';

describe('database migrations', () => {
  it('upgrades an existing 001 database with the session token version field', () => {
    const directory = mkdtempSync(join(tmpdir(), 'taskflow-db-test-'));
    const filename = join(directory, 'legacy.sqlite');
    let columns: { name: string }[] = [];
    let tokenVersion = -1;
    let versions: string[] = [];
    try {
      const initial = readFileSync(join(import.meta.dir, '../migrations/001-initial.sql'), 'utf8').replace('  token_version INTEGER NOT NULL DEFAULT 0,\n', '');
      const legacy = new Database(filename, { create: true });
      try {
        legacy.exec(initial);
        legacy.exec("CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); INSERT INTO schema_migrations (version) VALUES ('001-initial');");
      } finally { legacy.close(); }
      const db = openDatabase(filename);
      try {
        columns = db.query<{ name: string }, any[]>('PRAGMA table_info(users)').all();
        tokenVersion = (db.query('INSERT INTO users (display_name, email, password_hash) VALUES (?, ?, ?) RETURNING token_version').get('Demo', 'migration@example.test', 'hash') as { token_version: number }).token_version;
        versions = db.query<{ version: string }, any[]>('SELECT version FROM schema_migrations ORDER BY version').all().map(({ version }) => version);
      } finally { db.close(); }
    } finally { rmSync(directory, { recursive: true, force: true }); }

    expect(columns.some(({ name }) => name === 'token_version')).toBe(true);
    expect(tokenVersion).toBe(0);
    expect(versions).toEqual(['001-initial', '002-token-version']);
  });
});
