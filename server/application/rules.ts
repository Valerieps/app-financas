// Automatic rules (docs/spec/regras-automaticas.md, ADR-009): reading, editing and testing them,
// and running them over the stored lançamentos. The collection runs them on each new lançamento
// (collect/transactions.ts) through `rules` and `ruleTagStatements`.
import type { RulePreviewView, RuleView } from '../../src/application/api-contract';
import { MAX_RULES, parseConditions, parseRule, RULE_PREVIEW_LIMIT, ruleMatches, tagsFromRules, withExistingTags, type RuleDefinition } from '../../src/domain/rules';
import { MAX_BULK_TAGGING, moveInOrder, type TagAssignment } from '../../src/domain/tags';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import { lancamentoViews } from './lancamentos';
import { statement, type Statement } from './ports';

interface RuleRow {
  id: string;
  position: number;
  conditions_json: string;
  actions_json: string;
}

const CHANGED = ['rules'] as const;

const ruleRows = (ctx: Context) => ctx.sql.all<RuleRow>('SELECT id, position, conditions_json, actions_json FROM rules ORDER BY position, created_at');

/** A stored rule as the domain reads it; null if the stored JSON no longer parses. */
function definition(row: RuleRow): RuleDefinition | null {
  return parseRule({ conditions: JSON.parse(row.conditions_json), actions: JSON.parse(row.actions_json) });
}

async function tagExists(ctx: Context): Promise<(layerId: string, tagId: string) => boolean> {
  const tags = await ctx.sql.all<{ id: string; layer_id: string }>('SELECT id, layer_id FROM tags');
  const keys = new Set(tags.map((t) => `${t.layer_id}/${t.id}`));
  return (layerId, tagId) => keys.has(`${layerId}/${tagId}`);
}

/** The rules in order, without the tags deleted since they were saved. The collection runs these. */
export async function rules(ctx: Context): Promise<RuleView[]> {
  const [rows, exists] = await Promise.all([ruleRows(ctx), tagExists(ctx)]);
  return rows.flatMap((row) => {
    const rule = definition(row);
    return rule ? [{ id: row.id, ...withExistingTags(rule, exists) }] : [];
  });
}

/** Inserts the tags into the empty layers of each lançamento; a layer that already has a tag keeps it. */
export function ruleTagStatements(byTransaction: ReadonlyMap<string, TagAssignment>, now: string): Statement[] {
  const groups = new Map<string, { layerId: string; tagId: string; ids: string[] }>();
  for (const [transactionId, tags] of byTransaction) {
    for (const [layerId, tagId] of Object.entries(tags)) {
      const key = `${layerId}/${tagId}`;
      const group = groups.get(key) ?? { layerId, tagId, ids: [] };
      group.ids.push(transactionId);
      groups.set(key, group);
    }
  }
  const statements: Statement[] = [];
  for (const { layerId, tagId, ids } of groups.values()) {
    for (let i = 0; i < ids.length; i += MAX_BULK_TAGGING) {
      statements.push(
        statement(
          `INSERT INTO transaction_tags (transaction_id, layer_id, tag_id, tagged_at)
           SELECT value, ?, ?, ? FROM json_each(?) WHERE true
           ON CONFLICT (transaction_id, layer_id) DO NOTHING`,
          layerId,
          tagId,
          now,
          JSON.stringify(ids.slice(i, i + MAX_BULK_TAGGING)),
        ),
      );
    }
  }
  return statements;
}

/** The stored lançamentos a rule can look at, newest first. */
const stored = (ctx: Context) =>
  ctx.sql.all<{ id: string; description: string | null }>(
    'SELECT id, description FROM transactions WHERE deleted_at IS NULL ORDER BY date DESC, first_seen_at DESC, id',
  );

export async function rulePreview(ctx: Context, input: Record<string, unknown>): Promise<RulePreviewView | QueryError> {
  const conditions = parseConditions(input.conditions);
  if (!conditions) return new QueryError('invalid');
  const matched = (await stored(ctx)).filter((t) => ruleMatches({ conditions }, t));
  return { total: matched.length, items: await lancamentoViews(ctx, matched.slice(0, RULE_PREVIEW_LIMIT).map((t) => t.id)) };
}

/** `invalid` for a malformed rule or one whose tags do not exist. */
async function checkedRule(ctx: Context, input: Record<string, unknown>): Promise<RuleDefinition | 'invalid'> {
  const rule = parseRule(input);
  if (!rule) return 'invalid';
  const exists = await tagExists(ctx);
  const allExist = rule.actions.every((a) => a.kind !== 'addTags' || Object.entries(a.tags).every(([layerId, tagId]) => exists(layerId, tagId)));
  return allExist ? rule : 'invalid';
}

export async function createRule(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<{ id: string }>> {
  const rule = await checkedRule(ctx, input);
  if (rule === 'invalid') return failure('invalid');
  const existing = await ruleRows(ctx);
  if (existing.length >= MAX_RULES) return failure('conflict');
  const id = ctx.ids.next();
  const now = nowIso(ctx);
  const position = existing.reduce((max, r) => Math.max(max, r.position + 1), 0);
  await ctx.sql.batch([
    statement(
      'INSERT INTO rules (id, position, conditions_json, actions_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      position,
      JSON.stringify(rule.conditions),
      JSON.stringify(rule.actions),
      now,
      now,
    ),
  ]);
  return { ok: true, value: { id }, changed: CHANGED };
}

async function findRule(ctx: Context, id: unknown): Promise<string | 'invalid' | 'not_found'> {
  if (typeof id !== 'string') return 'invalid';
  return (await ctx.sql.all('SELECT 1 FROM rules WHERE id = ?', id)).length > 0 ? id : 'not_found';
}

export async function updateRule(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const found = await findRule(ctx, input.id);
  if (found === 'invalid' || found === 'not_found') return failure(found);
  const rule = await checkedRule(ctx, input);
  if (rule === 'invalid') return failure('invalid');
  await ctx.sql.batch([
    statement(
      'UPDATE rules SET conditions_json = ?, actions_json = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(rule.conditions),
      JSON.stringify(rule.actions),
      nowIso(ctx),
      found,
    ),
  ]);
  return { ok: true, value: null, changed: CHANGED };
}

const savePositions = (order: readonly string[]): Statement[] => order.map((id, position) => statement('UPDATE rules SET position = ? WHERE id = ?', position, id));

/** Deleting a rule keeps the tags it already put on lançamentos. */
export async function deleteRule(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const found = await findRule(ctx, input.id);
  if (found === 'invalid' || found === 'not_found') return failure(found);
  const rest = (await ruleRows(ctx)).filter((r) => r.id !== found).map((r) => r.id);
  await ctx.sql.batch([statement('DELETE FROM rules WHERE id = ?', found), ...savePositions(rest)]);
  return { ok: true, value: null, changed: CHANGED };
}

export async function moveRule(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const { direction } = input;
  if (direction !== 'up' && direction !== 'down') return failure('invalid');
  const found = await findRule(ctx, input.id);
  if (found === 'invalid' || found === 'not_found') return failure(found);
  const order = (await ruleRows(ctx)).map((r) => r.id);
  await ctx.sql.batch(savePositions(moveInOrder(order, found, direction)));
  return { ok: true, value: null, changed: CHANGED };
}

/** Runs every rule over the stored lançamentos, filling only their empty layers. */
export async function applyRules(ctx: Context): Promise<CommandResult<{ tagged: number }>> {
  const [ruleList, transactions, links] = await Promise.all([
    rules(ctx),
    stored(ctx),
    ctx.sql.all<{ transaction_id: string; layer_id: string; tag_id: string }>('SELECT transaction_id, layer_id, tag_id FROM transaction_tags'),
  ]);
  const current = new Map<string, Record<string, string>>();
  for (const link of links) current.set(link.transaction_id, { ...current.get(link.transaction_id), [link.layer_id]: link.tag_id });
  const added = new Map<string, TagAssignment>();
  for (const t of transactions) {
    const tags = tagsFromRules(ruleList, t, current.get(t.id));
    if (Object.keys(tags).length > 0) added.set(t.id, tags);
  }
  if (added.size > 0) await ctx.sql.batch(ruleTagStatements(added, nowIso(ctx)));
  return { ok: true, value: { tagged: added.size }, changed: ['tags'] };
}
