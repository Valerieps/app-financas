// The single entry to the app's data. The Durable Object calls it; every method is synchronous,
// so a command runs alone and inside one transaction (ADR-004).
import type {
  ApiResult,
  AuthStatusView,
  CommandName,
  Commands,
  ItemView,
  Queries,
  QueryName,
  Topic,
} from '../../src/application/api-contract';
import { constantTimeEqual } from '../infrastructure/crypto';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import type { Clock, IdGenerator, Sql } from './ports';
import { migrate } from './schema';

export const SESSION_DAYS = 180;

type Input = Record<string, unknown>;
type Handler<T> = (ctx: Context, input: Input) => T;

export class AppService {
  private readonly ctx: Context;

  constructor(sql: Sql, clock: Clock, ids: IdGenerator) {
    this.ctx = { sql, clock, ids };
  }

  migrate(): void {
    migrate(this.ctx.sql);
  }

  /** Checks whether the app has a PIN configured. */
  isConfigured(): boolean {
    const row = this.ctx.sql.all<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'pin_hash')[0];
    return Boolean(row?.value);
  }

  /** Verifies if a session token hash is active and not expired. */
  validateSession(sessionHash: string): boolean {
    if (!sessionHash) return false;
    const now = nowIso(this.ctx);
    const row = this.ctx.sql.all<{ 1: number }>(
      'SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > ?',
      sessionHash,
      now,
    )[0];
    return Boolean(row);
  }

  authStatus(sessionHash?: string | null): AuthStatusView {
    const configured = this.isConfigured();
    const authenticated = sessionHash ? this.validateSession(sessionHash) : false;
    return { configured, authenticated };
  }

  setupPin(pinHash: string, sessionHash: string): CommandResult<null> {
    if (this.isConfigured()) return failure('conflict');
    return this.ctx.sql.transaction(() => {
      this.ctx.sql.run('INSERT INTO settings (key, value) VALUES (?, ?)', 'pin_hash', pinHash);
      this.createSession(sessionHash);
      return { ok: true, value: null, changed: ['status'] };
    });
  }

  unlock(pinHash: string, sessionHash: string): CommandResult<null> {
    const row = this.ctx.sql.all<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'pin_hash')[0];
    if (!row?.value || !constantTimeEqual(row.value, pinHash)) {
      return failure('unauthenticated');
    }
    return this.ctx.sql.transaction(() => {
      this.createSession(sessionHash);
      return { ok: true, value: null, changed: [] };
    });
  }

  lock(sessionHash: string): void {
    if (!sessionHash) return;
    this.ctx.sql.run('DELETE FROM sessions WHERE token_hash = ?', sessionHash);
  }

  query(sessionHash: string, name: string, input: unknown): ApiResult<unknown> {
    if (!this.validateSession(sessionHash)) return failure('unauthenticated');
    const handler = Object.hasOwn(QUERIES, name) ? QUERIES[name as QueryName] : undefined;
    if (!handler) return failure('not_found');
    const value = handler(this.ctx, asInput(input));
    if (value instanceof QueryError) return failure(value.error);
    return { ok: true, value };
  }

  command(sessionHash: string, name: string, input: unknown): CommandResult<unknown> {
    if (!this.validateSession(sessionHash)) return failure('unauthenticated');
    const handler = Object.hasOwn(COMMANDS, name) ? COMMANDS[name as CommandName] : undefined;
    if (!handler) return failure('not_found');
    return this.ctx.sql.transaction(() => handler(this.ctx, asInput(input)));
  }

  /** Webhook ingress: processes external events and triggers live topic broadcasts. */
  webhook(topic: string, data: unknown): CommandResult<unknown> {
    const input = asInput(data);
    return this.ctx.sql.transaction(() => {
      if (topic === 'item.create' || topic === 'item') {
        const title = String(input.title ?? '').trim() || 'Webhook Item';
        const id = this.ctx.ids.next();
        const createdAt = nowIso(this.ctx);
        this.ctx.sql.run('INSERT INTO items (id, title, created_at) VALUES (?, ?, ?)', id, title, createdAt);
        return { ok: true, value: { id, title, createdAt }, changed: ['items', 'status'] };
      }
      return { ok: true, value: null, changed: ['status'] };
    });
  }

  tick(): Topic[] {
    const now = nowIso(this.ctx);
    this.ctx.sql.run('DELETE FROM sessions WHERE expires_at <= ?', now);
    return [];
  }

  private createSession(sessionHash: string): void {
    const now = this.ctx.clock.now();
    const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    this.ctx.sql.run(
      'INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)',
      sessionHash,
      now.toISOString(),
      expires,
    );
  }
}

function asInput(raw: unknown): Input {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Input) : {};
}

const QUERIES: { [N in QueryName]: Handler<Queries[N]['output']> } = {
  status: (ctx) => {
    const [{ count }] = ctx.sql.all<{ count: number }>('SELECT COUNT(*) AS count FROM items');
    return {
      configured: true,
      itemCount: count ?? 0,
      lastActiveAt: nowIso(ctx),
    };
  },
  items: (ctx) => {
    return ctx.sql.all<ItemView>('SELECT id, title, created_at AS createdAt FROM items ORDER BY created_at DESC');
  },
};

const COMMANDS: { [N in CommandName]: Handler<CommandResult<Commands[N]['output']>> } = {
  'item.create': (ctx, input) => {
    const title = String(input.title ?? '').trim();
    if (!title) return failure('invalid');
    const id = ctx.ids.next();
    const createdAt = nowIso(ctx);
    ctx.sql.run('INSERT INTO items (id, title, created_at) VALUES (?, ?, ?)', id, title, createdAt);
    return { ok: true, value: { id, title, createdAt }, changed: ['items', 'status'] };
  },
  'item.delete': (ctx, input) => {
    const id = String(input.id ?? '').trim();
    if (!id) return failure('invalid');
    ctx.sql.run('DELETE FROM items WHERE id = ?', id);
    return { ok: true, value: null, changed: ['items', 'status'] };
  },
};
