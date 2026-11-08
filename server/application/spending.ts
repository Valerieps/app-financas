// Finanças › Gráficos (docs/spec/graficos.md): the month's gastos per categoria against my own past,
// and the last 12 months. Reads the transactions the vault keeps; writes nothing.
import type { CategoryChart, Comparison, MonthlyChart, SpendingItem } from '../../src/domain/spending';
import { addMonths, daysInMonth, transactionDay } from '../../src/domain/calendar';
import { parseMonth } from '../../src/domain/month';
import { categoryChart, categoryOf, comparisonMonths, monthlyChart, spendingCents, TIMELINE_MONTHS } from '../../src/domain/spending';
import { addDays, saoPauloDate } from '../../src/domain/vault';
import { CATEGORY_ID, CHOICE_JOIN } from './category-choice';
import { QueryError, type Context } from './context';

interface Row {
  date: string;
  type: string | null;
  amount_cents: number;
  amount_in_account_currency_cents: number | null;
  pluggy_category_id: string | null;
  account_type: string | null;
}

/** Every gasto from the first day of `from` to the last day of `to` (yyyy-mm), in Brasília days. */
async function spendingItems(ctx: Context, from: string, to: string): Promise<SpendingItem[]> {
  const first = `${from}-01`;
  const last = `${to}-${String(daysInMonth(to)).padStart(2, '0')}`;
  // A day early on each side: Pluggy's date may be an instant that falls on a neighbouring Brasília day.
  // A connection replaced by a new one is left out: the new one brings the same transactions again.
  const rows = await ctx.sql.all<Row>(
    `SELECT t.date, t.type, t.amount_cents, t.amount_in_account_currency_cents, ${CATEGORY_ID} AS pluggy_category_id, a.type AS account_type
     FROM transactions t JOIN accounts a ON a.id = t.account_id JOIN items i ON i.item_id = a.item_id ${CHOICE_JOIN}
     WHERE t.deleted_at IS NULL AND i.replaced_by IS NULL AND a.currency_code = 'BRL' AND t.date >= ? AND t.date < ?`,
    addDays(first, -1),
    addDays(last, 2),
  );
  const items: SpendingItem[] = [];
  for (const row of rows) {
    const day = transactionDay(row.date);
    if (day < first || day > last) continue;
    const cents = spendingCents({
      type: row.type,
      amountCents: row.amount_in_account_currency_cents ?? row.amount_cents,
      accountType: row.account_type,
      pluggyCategoryId: row.pluggy_category_id,
    });
    if (cents !== null) items.push({ day, category: categoryOf(row.pluggy_category_id), cents });
  }
  return items;
}

function monthInput(value: unknown): string | null {
  return typeof value === 'string' && parseMonth(value) ? value : null;
}

export async function spendingByCategory(ctx: Context, input: Record<string, unknown>): Promise<CategoryChart | QueryError> {
  const month = monthInput(input.month);
  const compare: Comparison | null = input.compare === 'average' || input.compare === 'previous' ? input.compare : null;
  if (!month || !compare) return new QueryError('invalid');
  const items = await spendingItems(ctx, comparisonMonths(month, compare)[0] as string, month);
  return categoryChart(items, month, saoPauloDate(ctx.clock.now()), compare);
}

export async function spendingByMonth(ctx: Context, input: Record<string, unknown>): Promise<MonthlyChart | QueryError> {
  const month = monthInput(input.month);
  if (!month) return new QueryError('invalid');
  const items = await spendingItems(ctx, addMonths(month, 1 - TIMELINE_MONTHS), month);
  return monthlyChart(items, month, saoPauloDate(ctx.clock.now()));
}
