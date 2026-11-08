// The single entry to the app's data. The Worker checks Access and the passkey lock (ADR-007),
// then calls it.
import type { ApiResult, CommandName, Commands, PasskeyView, Queries, QueryName } from '../../src/application/api-contract';
import { failure, QueryError, type CommandResult, type Context } from './context';
import { calendar, confirmEmptyDay } from './calendar';
import { addConnection } from './collect/connections';
import { runSweeps } from './collect/sync';
import { vault } from './collect/vault';
import { processPendingEvents } from './collect/webhooks';
import { cartao } from './faturas';
import { categorizeLancamentos, lancamento, lancamentos, pluggyCategories, tagLancamentos } from './lancamentos';
import { cleanUpLock, type Caller } from './lock';
import { provisionalExpenses } from './notifications';
import { statement } from './ports';
import { applyRules, createRule, deleteRule, moveRule, rulePreview, rules, updateRule } from './rules';
import { spendingByCategory, spendingByMonth } from './spending';
import { createLayer, createTag, deleteLayer, deleteTag, moveLayer, renameLayer, renameTag, tagLayers } from './tags';

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
    await processPendingEvents(this.ctx);
    await runSweeps(this.ctx);
  }
}

function asInput(raw: unknown): Input {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Input) : {};
}

const QUERIES: { [N in QueryName]: Handler<Queries[N]['output'] | QueryError> } = {
  vault: async (ctx) => vault(ctx),
  calendar: async (ctx, input) => calendar(ctx, input.itemId),
  provisionalExpenses: async (ctx) => provisionalExpenses(ctx),
  spendingByCategory: async (ctx, input) => spendingByCategory(ctx, input),
  spendingByMonth: async (ctx, input) => spendingByMonth(ctx, input),
  lancamentos: async (ctx, input) => lancamentos(ctx, input.month),
  lancamento: async (ctx, input) => lancamento(ctx, input.id),
  tagLayers: async (ctx) => tagLayers(ctx),
  pluggyCategories: async (ctx) => pluggyCategories(ctx),
  cartao: async (ctx) => cartao(ctx),
  rules: async (ctx) => rules(ctx),
  rulePreview: async (ctx, input) => rulePreview(ctx, input),
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
  'connection.add': async (ctx, input) => addConnection(ctx, input.itemId),
  'day.confirmEmpty': async (ctx, input) => confirmEmptyDay(ctx, input),
  'tagLayer.create': async (ctx, input) => createLayer(ctx, input),
  'tagLayer.rename': async (ctx, input) => renameLayer(ctx, input),
  'tagLayer.delete': async (ctx, input) => deleteLayer(ctx, input),
  'tagLayer.move': async (ctx, input) => moveLayer(ctx, input),
  'tag.create': async (ctx, input) => createTag(ctx, input),
  'tag.rename': async (ctx, input) => renameTag(ctx, input),
  'tag.delete': async (ctx, input) => deleteTag(ctx, input),
  'lancamentos.tag': async (ctx, input) => tagLancamentos(ctx, input),
  'lancamentos.categorize': async (ctx, input) => categorizeLancamentos(ctx, input),
  'rule.create': async (ctx, input) => createRule(ctx, input),
  'rule.update': async (ctx, input) => updateRule(ctx, input),
  'rule.delete': async (ctx, input) => deleteRule(ctx, input),
  'rule.move': async (ctx, input) => moveRule(ctx, input),
  'rules.apply': async (ctx) => applyRules(ctx),
};
