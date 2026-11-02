// The ports over node:sqlite and memory, for tests. D1 runs the same SQLite engine.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Clock, IdGenerator, RawStore, Sql, SqlValue } from '../application/ports';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

/** An in-memory database with every file of migrations/ applied, as `wrangler d1 migrations apply` does. */
export function memorySql(): Sql & { readonly db: DatabaseSync } {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  const exec = (query: string, bindings: readonly SqlValue[]) => db.prepare(query).run(...bindings);
  return {
    db,
    all: async <T>(query: string, ...bindings: SqlValue[]) => db.prepare(query).all(...bindings) as T[],
    run: async (query, ...bindings) => {
      exec(query, bindings);
    },
    batch: async (statements) => {
      db.exec('BEGIN');
      try {
        for (const { query, bindings } of statements) exec(query, bindings);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

export function memoryRawStore(): RawStore & { readonly objects: Map<string, string> } {
  const objects = new Map<string, string>();
  return {
    objects,
    put: async (key, body) => {
      objects.set(key, body);
    },
    get: async (key) => objects.get(key) ?? null,
  };
}

export function fixedClock(iso: string): Clock & { set(iso: string): void } {
  let now = new Date(iso);
  return { now: () => now, set: (next) => (now = new Date(next)) };
}

export function sequentialIds(): IdGenerator {
  let n = 0;
  return { next: () => `id-${++n}` };
}
