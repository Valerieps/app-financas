// The single entry to the app's data. The Worker checks access (ADR-007) and then calls it.
import type { ApiResult, CommandName, Commands, Queries, QueryName } from '../../src/application/api-contract';
import { failure, QueryError, type CommandResult, type Context } from './context';

type Input = Record<string, unknown>;
type Handler<T> = (ctx: Context, input: Input) => Promise<T>;

export class AppService {
  constructor(private readonly ctx: Context) {}

  async query(name: string, input: unknown): Promise<ApiResult<unknown>> {
    const handler = Object.hasOwn(QUERIES, name) ? QUERIES[name as QueryName] : undefined;
    if (!handler) return failure('not_found');
    const value = await handler(this.ctx, asInput(input));
    if (value instanceof QueryError) return failure(value.error);
    return { ok: true, value };
  }

  async command(name: string, input: unknown): Promise<CommandResult<unknown>> {
    const handler = Object.hasOwn(COMMANDS, name) ? (COMMANDS as Record<string, Handler<CommandResult<unknown>>>)[name] : undefined;
    if (!handler) return failure('not_found');
    return handler(this.ctx, asInput(input));
  }

  /** The cron: every job decides whether it is due. */
  async tick(): Promise<void> {}
}

function asInput(raw: unknown): Input {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Input) : {};
}

const QUERIES: { [N in QueryName]: Handler<Queries[N]['output']> } = {
  vault: async (ctx) => {
    const [{ count }] = await ctx.sql.all<{ count: number }>('SELECT COUNT(*) AS count FROM items WHERE replaced_by IS NULL');
    return { connectionCount: count };
  },
};

const COMMANDS: { [N in CommandName]: Handler<CommandResult<Commands[N]['output']>> } = {};
