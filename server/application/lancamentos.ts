// The Lançamentos list and its detail panel (docs/spec/lancamentos.md): the month's transactions,
// read from the vault, which only collect/ writes. My own decisions on them (tags, the category I
// chose) live in their own tables, written here.
import type { LancamentoDetailView, LancamentosView, LancamentoView } from '../../src/application/api-contract';
import { transactionDay } from '../../src/domain/calendar';
import { cardPaymentWithChoice, direction, monthDays, totals } from '../../src/domain/lancamentos';
import { parseMonth } from '../../src/domain/month';
import { categoryOptions, type CategoryOption } from '../../src/domain/pluggy-categories';
import { MAX_BULK_TAGGING, type TagAssignment, type TagChange } from '../../src/domain/tags';
import { addDays } from '../../src/domain/vault';
import { CATEGORY_ID, CHOICE_JOIN } from './category-choice';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import { statement } from './ports';

interface Row {
  id: string;
  date: string;
  description: string | null;
  category: string | null;
  category_id: string | null;
  chosen_category_id: string | null;
  amount_cents: number;
  currency_code: string;
  type: string | null;
  status: string | null;
  account_name: string | null;
  account_type: string | null;
  installment_number: number | null;
  total_installments: number | null;
  card_payment: number;
}

const SELECT = `
  SELECT t.id, t.date, t.description, t.amount_cents, t.currency_code, t.type, t.status, t.card_payment,
         ${CATEGORY_ID} AS category_id, tc.pluggy_category_id AS chosen_category_id,
         COALESCE(c.description_translated, c.description,
                  CASE WHEN tc.pluggy_category_id IS NULL THEN json_extract(t.raw_json, '$.category') END) AS category,
         a.name AS account_name, a.type AS account_type,
         cd.installment_number, cd.total_installments`;

const FROM = `
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  ${CHOICE_JOIN}
  LEFT JOIN pluggy_categories c ON c.id = ${CATEGORY_ID}
  LEFT JOIN transaction_card_data cd ON cd.transaction_id = t.id`;

function toView(row: Row, tags: TagAssignment = {}): LancamentoView {
  return {
    id: row.id,
    day: transactionDay(row.date),
    description: row.description,
    category: row.category,
    categoryId: row.category_id,
    categoryChosen: row.chosen_category_id !== null,
    amountCents: Math.abs(row.amount_cents),
    currency: row.currency_code,
    direction: direction(row.type, row.amount_cents, row.account_type),
    accountName: row.account_name,
    accountType: row.account_type,
    pending: row.status === 'PENDING',
    cardPayment: cardPaymentWithChoice(row.card_payment === 1, row.chosen_category_id),
    installment:
      row.installment_number !== null && row.total_installments !== null && row.total_installments > 1
        ? { number: row.installment_number, total: row.total_installments }
        : null,
    tags,
  };
}

interface TagLink {
  transaction_id: string;
  layer_id: string;
  tag_id: string;
}

/** Each transaction's tags, by transaction id. */
function tagsById(links: readonly TagLink[]): Map<string, Record<string, string>> {
  const byId = new Map<string, Record<string, string>>();
  for (const link of links) {
    const tags = byId.get(link.transaction_id) ?? {};
    tags[link.layer_id] = link.tag_id;
    byId.set(link.transaction_id, tags);
  }
  return byId;
}

export async function lancamentos(ctx: Context, month: unknown): Promise<LancamentosView | QueryError> {
  if (typeof month !== 'string' || !parseMonth(month)) return new QueryError('invalid');
  const { first, last } = monthDays(month);
  // A day early on each side: Pluggy's date may be an instant that falls on a neighbouring Brasília day.
  const from = addDays(first, -1);
  const to = addDays(last, 2);
  const [rows, links] = await Promise.all([
    ctx.sql.all<Row>(
      `${SELECT} ${FROM}
       WHERE t.deleted_at IS NULL AND t.date >= ? AND t.date < ?
       ORDER BY t.date DESC, t.first_seen_at DESC, t.id`,
      from,
      to,
    ),
    ctx.sql.all<TagLink>(
      `SELECT tt.transaction_id, tt.layer_id, tt.tag_id
       FROM transaction_tags tt JOIN transactions t ON t.id = tt.transaction_id
       WHERE t.deleted_at IS NULL AND t.date >= ? AND t.date < ?`,
      from,
      to,
    ),
  ]);
  const tags = tagsById(links);
  const items = rows.map((row) => toView(row, tags.get(row.id))).filter((item) => item.day >= first && item.day <= last);
  return { month, items, totals: totals(items) };
}

export async function lancamento(ctx: Context, id: unknown): Promise<LancamentoDetailView | QueryError> {
  if (typeof id !== 'string' || !id) return new QueryError('invalid');
  const [row] = await ctx.sql.all<
    Row & {
      description_raw: string | null;
      operation_type: string | null;
      payment_method: string | null;
      payer_name: string | null;
      receiver_name: string | null;
      card_number: string | null;
      first_seen_at: string;
      pluggy_category: string | null;
    }
  >(
    `${SELECT}, t.description_raw, t.operation_type, t.first_seen_at,
            p.payment_method, p.payer_name, p.receiver_name, cd.card_number,
            COALESCE(pc.description_translated, pc.description, json_extract(t.raw_json, '$.category')) AS pluggy_category
     ${FROM}
     LEFT JOIN transaction_payment_data p ON p.transaction_id = t.id
     LEFT JOIN pluggy_categories pc ON pc.id = t.pluggy_category_id
     WHERE t.id = ? AND t.deleted_at IS NULL`,
    id,
  );
  if (!row) return new QueryError('not_found');
  const links = await ctx.sql.all<TagLink>('SELECT transaction_id, layer_id, tag_id FROM transaction_tags WHERE transaction_id = ?', id);
  const view = toView(row, tagsById(links).get(id));
  return {
    ...view,
    date: row.date,
    descriptionRaw: row.description_raw && row.description_raw !== row.description ? row.description_raw : null,
    operationType: row.operation_type,
    paymentMethod: row.payment_method,
    counterpart: view.direction === 'in' ? row.payer_name : row.receiver_name,
    cardDigits: row.card_number,
    firstSeenAt: row.first_seen_at,
    pluggyCategory: row.pluggy_category,
  };
}

/** Pluggy's category tree, the list I choose a lançamento's category from. */
export async function pluggyCategories(ctx: Context): Promise<CategoryOption[]> {
  const rows = await ctx.sql.all<{ id: string; name: string | null; parent_id: string | null }>(
    'SELECT id, COALESCE(description_translated, description) AS name, parent_id FROM pluggy_categories',
  );
  return categoryOptions(rows.map((r) => ({ id: r.id, name: r.name ?? r.id, parentId: r.parent_id })));
}

/** Reads a list of lançamento ids; null when it is empty, too long or malformed. */
function parseIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK_TAGGING) return null;
  if (!ids.every((id): id is string => typeof id === 'string' && id !== '')) return null;
  return [...new Set(ids)];
}

/** How many of these lançamentos exist, read in one go: D1 allows only 100 bound parameters per statement. */
async function existingCount(ctx: Context, ids: readonly string[]): Promise<number> {
  const rows = await ctx.sql.all<{ id: string }>(
    'SELECT t.id FROM transactions t JOIN json_each(?) j ON j.value = t.id WHERE t.deleted_at IS NULL',
    JSON.stringify(ids),
  );
  return rows.length;
}

/**
 * Gives many lançamentos the category I chose from Pluggy's tree, or (`categoryId: null`) takes my
 * choice off so Pluggy's counts again (docs/spec/classificacao.md).
 */
export async function categorizeLancamentos(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const ids = parseIds(input.ids);
  const { categoryId } = input;
  if (!ids || (categoryId !== null && (typeof categoryId !== 'string' || categoryId === ''))) return failure('invalid');
  const [count, known] = await Promise.all([
    existingCount(ctx, ids),
    categoryId === null ? Promise.resolve(true) : ctx.sql.all('SELECT 1 FROM pluggy_categories WHERE id = ?', categoryId).then((r) => r.length > 0),
  ]);
  if (count !== ids.length || !known) return failure('not_found');
  const list = JSON.stringify(ids);
  await ctx.sql.batch([
    categoryId === null
      ? statement('DELETE FROM transaction_categories WHERE transaction_id IN (SELECT value FROM json_each(?))', list)
      : statement(
          `INSERT INTO transaction_categories (transaction_id, pluggy_category_id, chosen_at)
           SELECT value, ?, ? FROM json_each(?) WHERE true
           ON CONFLICT (transaction_id) DO UPDATE SET pluggy_category_id = excluded.pluggy_category_id, chosen_at = excluded.chosen_at
           WHERE transaction_categories.pluggy_category_id <> excluded.pluggy_category_id`,
          categoryId,
          nowIso(ctx),
          list,
        ),
  ]);
  return { ok: true, value: null, changed: ['categories'] };
}

/** Reads `lancamentos.tag`'s input; null when it is malformed. */
function parseTagging(input: Record<string, unknown>): { ids: string[]; changes: TagChange[] } | null {
  const ids = parseIds(input.ids);
  const { changes } = input;
  if (!ids || !Array.isArray(changes) || changes.length === 0) return null;
  const parsed: TagChange[] = [];
  for (const change of changes as unknown[]) {
    if (!change || typeof change !== 'object') return null;
    const { layerId, tagId } = change as Record<string, unknown>;
    if (typeof layerId !== 'string' || (tagId !== null && typeof tagId !== 'string')) return null;
    if (parsed.some((c) => c.layerId === layerId)) return null;
    parsed.push({ layerId, tagId });
  }
  return { ids, changes: parsed };
}

/** Puts tags on many lançamentos, or takes them off, in one batch (docs/spec/categorias.md). */
export async function tagLancamentos(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const parsed = parseTagging(input);
  if (!parsed) return failure('invalid');
  const { ids, changes } = parsed;
  const [layers, tags, existing] = await Promise.all([
    ctx.sql.all<{ id: string }>('SELECT id FROM tag_layers'),
    ctx.sql.all<{ id: string; layer_id: string }>('SELECT id, layer_id FROM tags'),
    existingCount(ctx, ids),
  ]);
  if (existing !== ids.length) return failure('not_found');
  for (const change of changes) {
    if (!layers.some((l) => l.id === change.layerId)) return failure('not_found');
    if (change.tagId !== null && !tags.some((t) => t.id === change.tagId && t.layer_id === change.layerId)) return failure('not_found');
  }
  const now = nowIso(ctx);
  const list = JSON.stringify(ids);
  await ctx.sql.batch(
    changes.map((change) =>
      change.tagId === null
        ? statement('DELETE FROM transaction_tags WHERE layer_id = ? AND transaction_id IN (SELECT value FROM json_each(?))', change.layerId, list)
        : statement(
            `INSERT INTO transaction_tags (transaction_id, layer_id, tag_id, tagged_at)
             SELECT value, ?, ?, ? FROM json_each(?) WHERE true
             ON CONFLICT (transaction_id, layer_id) DO UPDATE SET tag_id = excluded.tag_id, tagged_at = excluded.tagged_at
             WHERE transaction_tags.tag_id <> excluded.tag_id`,
            change.layerId,
            change.tagId,
            now,
            list,
          ),
    ),
  );
  return { ok: true, value: null, changed: ['tags'] };
}
