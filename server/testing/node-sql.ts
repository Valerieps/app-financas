// The ports over node:sqlite and memory, for tests. D1 runs the same SQLite engine.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Context } from '../application/context';
import type { Clock, IdGenerator, PluggyApi, PluggyResponse, RawStore, Sql, SqlValue } from '../application/ports';

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

/**
 * A fake Pluggy: answers from `routes`, keyed by path plus sorted query ("/accounts?itemId=x"),
 * or by path alone; anything else is a 404. Records every call.
 */
export function fakePluggy(routes: Record<string, unknown | PluggyResponse> = {}): PluggyApi & { calls: string[]; routes: Record<string, unknown> } {
  const calls: string[] = [];
  return {
    calls,
    routes,
    async get(path, query = {}) {
      const search = new URLSearchParams(Object.entries(query).sort(([a], [b]) => a.localeCompare(b))).toString();
      const full = search ? `${path}?${search}` : path;
      calls.push(full);
      const answer = routes[full] ?? routes[path];
      if (answer === undefined) return { status: 404, body: '{"code":404}' };
      if (answer && typeof answer === 'object' && 'status' in answer && 'body' in answer) return answer as PluggyResponse;
      return { status: 200, body: JSON.stringify(answer) };
    },
  };
}

/** Everything a use case needs, on node:sqlite and memory; background tasks are collected. */
export function testContext(start = '2026-11-02T12:00:00Z', pluggy: PluggyApi = fakePluggy()) {
  const sql = memorySql();
  const raw = memoryRawStore();
  const clock = fixedClock(start);
  const tasks: Promise<unknown>[] = [];
  const ctx: Context = { sql, raw, pluggy, clock, ids: sequentialIds(), background: (task) => void tasks.push(task) };
  return { ctx, sql, raw, clock, tasks };
}

export function fixedClock(iso: string): Clock & { set(iso: string): void } {
  let now = new Date(iso);
  return { now: () => now, set: (next) => (now = new Date(next)) };
}

export function sequentialIds(): IdGenerator {
  let n = 0;
  return { next: () => `id-${++n}` };
}
