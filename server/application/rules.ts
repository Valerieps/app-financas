// Automatic rules (docs/spec/regras-automaticas.md, ADR-009): reading, editing and testing them,
// and running them over the stored lançamentos. The collection runs them on each new lançamento
// (collect/transactions.ts) through `rules`, `ruleTagStatements` and `ruleCategoryStatements`.
import type { RulePreviewView, RuleView } from '../../src/application/api-contract';
import { cardPaymentWithChoice } from '../../src/domain/lancamentos';
import { applyReplacements, categoryFromRules, describeWithRules, MAX_RULES, parseActions, parseConditions, parseRule, RULE_PREVIEW_LIMIT, ruleMatches, tagsFromRules, withExistingTags, type RuleDefinition } from '../../src/domain/rules';
import { MAX_BULK_TAGGING, moveInOrder, moveToIndex, type TagAssignment } from '../../src/domain/tags';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import { descriptionStatements, rewriteDescriptions, ruleSubjects, storedDescriptions, type Subject } from './descriptions';
import { lancamentoViews } from './lancamentos';
import { statement, type Statement } from './ports';
import { definition, ruleRows, type RuleRow } from './rule-store';

const CHANGED = ['rules'] as const;

/** The rules in `order` (ids), with `replaced` standing in for one of them: what the rules will be after a write. */
function rulesAfter(rows: readonly RuleRow[], order: readonly string[], replaced?: { id: string; rule: RuleDefinition }): RuleDefinition[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return order.flatMap((id) => {
    if (replaced?.id === id) return [replaced.rule];
    const row = byId.get(id);
    return (row && definition(row)) || [];
  });
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

/**
 * Gives each lançamento the category a rule set, as if I had chosen it (docs/spec/regras-automaticas.md):
 * only where no category was chosen yet, and only a category still in Pluggy's tree.
 */
export function ruleCategoryStatements(byTransaction: ReadonlyMap<string, string>, now: string): Statement[] {
  const pairs = [...byTransaction];
  const statements: Statement[] = [];
  for (let i = 0; i < pairs.length; i += MAX_BULK_TAGGING) {
    statements.push(
      statement(
        `INSERT INTO transaction_categories (transaction_id, pluggy_category_id, chosen_at)
         SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), ? FROM json_each(?)
         WHERE json_extract(value, '$[1]') IN (SELECT id FROM pluggy_categories)
         ON CONFLICT (transaction_id) DO NOTHING`,
        now,
        JSON.stringify(pairs.slice(i, i + MAX_BULK_TAGGING)),
      ),
    );
  }
  return statements;
}

/** The subject as it is once a rule sets `categoryId` on it. */
export function withRuleCategory<T extends Subject>(subject: T, categoryId: string): T {
  return { ...subject, categoryId, categoryChosen: true, cardPayment: cardPaymentWithChoice(subject.cardPayment, categoryId) };
}

const categoryExists = async (ctx: Context, id: string) => (await ctx.sql.all('SELECT 1 FROM pluggy_categories WHERE id = ?', id)).length > 0;

/**
 * The stored lançamentos the conditions match, newest first. With `actions`, each one's description
 * shows what this rule would make of it, after the saved rules.
 */
export async function rulePreview(ctx: Context, input: Record<string, unknown>): Promise<RulePreviewView | QueryError> {
  const conditions = parseConditions(input.conditions);
  const actions = input.actions === undefined ? [] : parseActions(input.actions);
  if (!conditions || !actions) return new QueryError('invalid');
  const matched = (await ruleSubjects(ctx)).filter((t) => ruleMatches({ conditions }, t));
  const items = await lancamentoViews(ctx, matched.slice(0, RULE_PREVIEW_LIMIT).map((t) => t.id));
  return { total: matched.length, items: items.map((item) => ({ ...item, description: applyReplacements(actions, item.description) })) };
}

/** `invalid` for a malformed rule or one whose tags or category do not exist. */
async function checkedRule(ctx: Context, input: Record<string, unknown>): Promise<RuleDefinition | 'invalid'> {
  const rule = parseRule(input);
  if (!rule) return 'invalid';
  const exists = await tagExists(ctx);
  const allExist = rule.actions.every((a) => a.kind !== 'addTags' || Object.entries(a.tags).every(([layerId, tagId]) => exists(layerId, tagId)));
  if (!allExist) return 'invalid';
  for (const action of rule.actions) {
    if (action.kind === 'setCategory' && !(await categoryExists(ctx, action.categoryId))) return 'invalid';
  }
  return rule;
}

export async function createRule(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<{ id: string }>> {
  const rule = await checkedRule(ctx, input);
  if (rule === 'invalid') return failure('invalid');
  const existing = await ruleRows(ctx);
  if (existing.length >= MAX_RULES) return failure('conflict');
  const id = ctx.ids.next();
  const now = nowIso(ctx);
  const position = existing.reduce((max, r) => Math.max(max, r.position + 1), 0);
  const descriptions = await rewriteDescriptions(ctx, [...rulesAfter(existing, existing.map((r) => r.id)), rule], now);
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
    ...descriptions,
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
  const rows = await ruleRows(ctx);
  const now = nowIso(ctx);
  const descriptions = await rewriteDescriptions(ctx, rulesAfter(rows, rows.map((r) => r.id), { id: found, rule }), now);
  await ctx.sql.batch([
    statement(
      'UPDATE rules SET conditions_json = ?, actions_json = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(rule.conditions),
      JSON.stringify(rule.actions),
      now,
      found,
    ),
    ...descriptions,
  ]);
  return { ok: true, value: null, changed: CHANGED };
}

const savePositions = (order: readonly string[]): Statement[] => order.map((id, position) => statement('UPDATE rules SET position = ? WHERE id = ?', position, id));

/** Deleting a rule keeps the tags it already put on lançamentos; its description changes go. */
export async function deleteRule(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const found = await findRule(ctx, input.id);
  if (found === 'invalid' || found === 'not_found') return failure(found);
  const rows = await ruleRows(ctx);
  const rest = rows.filter((r) => r.id !== found).map((r) => r.id);
  const descriptions = await rewriteDescriptions(ctx, rulesAfter(rows, rest), nowIso(ctx));
  await ctx.sql.batch([statement('DELETE FROM rules WHERE id = ?', found), ...savePositions(rest), ...descriptions]);
  return { ok: true, value: null, changed: CHANGED };
}

export async function moveRule(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const { direction, to } = input;
  const dragged = typeof to === 'number' && Number.isInteger(to) && to >= 0;
  if (!dragged && direction !== 'up' && direction !== 'down') return failure('invalid');
  const found = await findRule(ctx, input.id);
  if (found === 'invalid' || found === 'not_found') return failure(found);
  const rows = await ruleRows(ctx);
  const ids = rows.map((r) => r.id);
  if (dragged && to >= ids.length) return failure('invalid');
  const order = dragged ? moveToIndex(ids, found, to) : moveInOrder(ids, found, direction === 'up' ? 'up' : 'down');
  const descriptions = await rewriteDescriptions(ctx, rulesAfter(rows, order), nowIso(ctx));
  await ctx.sql.batch([...savePositions(order), ...descriptions]);
  return { ok: true, value: null, changed: CHANGED };
}

/**
 * Runs every rule over the stored lançamentos: a category goes only where none was chosen, tags fill
 * only the empty layers, and the stored descriptions are rewritten, in case (the bank's text stays).
 * `described` counts the lançamentos whose description the rules change, to show those rules at work too.
 */
export async function applyRules(ctx: Context): Promise<CommandResult<{ tagged: number; described: number; categorized: number }>> {
  const [ruleList, stored, links, current] = await Promise.all([
    rules(ctx),
    ruleSubjects(ctx),
    ctx.sql.all<{ transaction_id: string; layer_id: string; tag_id: string }>('SELECT transaction_id, layer_id, tag_id FROM transaction_tags'),
    storedDescriptions(ctx),
  ]);
  const categories = new Map<string, string>();
  const transactions = stored.map((t) => {
    const categoryId = categoryFromRules(ruleList, t, t.categoryChosen);
    if (categoryId === null) return t;
    categories.set(t.id, categoryId);
    return withRuleCategory(t, categoryId);
  });
  const tagsNow = new Map<string, Record<string, string>>();
  for (const link of links) tagsNow.set(link.transaction_id, { ...tagsNow.get(link.transaction_id), [link.layer_id]: link.tag_id });
  const added = new Map<string, TagAssignment>();
  for (const t of transactions) {
    const tags = tagsFromRules(ruleList, t, tagsNow.get(t.id));
    if (Object.keys(tags).length > 0) added.set(t.id, tags);
  }
  const now = nowIso(ctx);
  // A row left from a lançamento since deleted stays: it comes back if the lançamento does.
  const writes = [...ruleCategoryStatements(categories, now), ...ruleTagStatements(added, now), ...descriptionStatements(ruleList, transactions, current, now)];
  if (writes.length > 0) await ctx.sql.batch(writes);
  const described = transactions.filter((t) => describeWithRules(ruleList, t) !== t.description).length;
  return { ok: true, value: { tagged: added.size, described, categorized: categories.size }, changed: ['tags', 'rules', 'categories'] };
}
