// The single entry to the app's data. The Worker checks Access and the passkey lock (ADR-007),
// then calls it.
import type { ApiResult, CommandName, Commands, PasskeyView, Queries, QueryName } from '../../src/application/api-contract';
import { failure, QueryError, type CommandResult, type Context } from './context';
import { cleanUpLock, type Caller } from './lock';
import { statement } from './ports';

type Input = Record<string, unknown>;
type Handler<T> = (ctx: Context, input: Input, caller: Caller) => Promise<T>;

export class AppService {
  constructor(private readonly ctx: Context) {}

  async query(name: string, input: unknown, caller: Caller): Promise<ApiResult<unknown>> {
    const handler = Object.hasOwn(QUERIES, name) ? QUERIES[name as QueryName] : undefined;
    if (!handler) return failure('not_found');
    const value = await handler(this.ctx, asInput(input), caller);
    if (value instanceof QueryError) return failure(value.error);
    return { ok: true, value };
  }

  async command(name: string, input: unknown, caller: Caller): Promise<CommandResult<unknown>> {
    const handler = Object.hasOwn(COMMANDS, name) ? COMMANDS[name as CommandName] : undefined;
    if (!handler) return failure('not_found');
    return handler(this.ctx, asInput(input), caller);
  }

  /** The cron: every job decides whether it is due. */
  async tick(): Promise<void> {
    await cleanUpLock(this.ctx);
  }
}

function asInput(raw: unknown): Input {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Input) : {};
}

const QUERIES: { [N in QueryName]: Handler<Queries[N]['output']> } = {
  vault: async (ctx) => {
    const [{ count }] = await ctx.sql.all<{ count: number }>('SELECT COUNT(*) AS count FROM items WHERE replaced_by IS NULL');
    return { connectionCount: count };
  },
  passkeys: async (ctx, _input, caller) => {
    const rows = await ctx.sql.all<Omit<PasskeyView, 'thisDevice'> & { device: string }>(
      'SELECT id, label, created_at AS createdAt, last_used_at AS lastUsedAt, device_token_hash AS device FROM passkeys ORDER BY created_at',
    );
    return rows.map(({ device, ...passkey }) => ({ ...passkey, thisDevice: device === caller.deviceTokenHash }));
  },
};

const COMMANDS: { [N in CommandName]: Handler<CommandResult<Commands[N]['output']>> } = {
  'passkey.delete': async (ctx, input) => {
    const id = String(input.id ?? '');
    if (!id) return failure('invalid');
    if ((await ctx.sql.all('SELECT 1 FROM passkeys WHERE id = ?', id)).length === 0) return failure('not_found');
    await ctx.sql.batch([statement('DELETE FROM sessions WHERE passkey_id = ?', id), statement('DELETE FROM passkeys WHERE id = ?', id)]);
    return { ok: true, value: null, changed: ['passkeys'] };
  },
};
