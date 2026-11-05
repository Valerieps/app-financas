// The Cofre calendar (docs/spec/cofre-de-dados.md, "Tela Cofre"): transactions per day of the last
// 12 months, per account, and the empty days the owner confirmed.
import type { CalendarView } from '../../src/application/api-contract';
import { calendarStart, transactionDay } from '../../src/domain/calendar';
import { addDays, saoPauloDate } from '../../src/domain/vault';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import { statement } from './ports';

export async function calendar(ctx: Context, itemId: unknown): Promise<CalendarView | QueryError> {
  if (typeof itemId !== 'string' || !itemId) return new QueryError('invalid');
  if ((await ctx.sql.all('SELECT 1 FROM items WHERE item_id = ?', itemId)).length === 0) return new QueryError('not_found');
  const to = saoPauloDate(ctx.clock.now());
  const from = calendarStart(to);

  const accounts = await ctx.sql.all<{ id: string; name: string | null; type: string | null }>(
    // The current account first, then the card, as the Nubank app shows them.
    "SELECT id, name, type FROM accounts WHERE item_id = ? ORDER BY type = 'CREDIT', first_seen_at, id",
    itemId,
  );
  // A day early on each side: Pluggy's date may be an instant that falls on a neighbouring Brasília day.
  const transactions = await ctx.sql.all<{ account_id: string; date: string }>(
    `SELECT t.account_id, t.date FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.item_id = ? AND t.deleted_at IS NULL AND t.date >= ? AND t.date < ?`,
    itemId,
    addDays(from, -1),
    addDays(to, 2),
  );
  const confirmed = await ctx.sql.all<{ account_id: string; day: string }>(
    `SELECT c.account_id, c.day FROM confirmed_empty_days c JOIN accounts a ON a.id = c.account_id
     WHERE a.item_id = ? AND c.day >= ? ORDER BY c.day`,
    itemId,
    from,
  );

  return {
    from,
    to,
    accounts: accounts.map((account) => {
      const counts: Record<string, number> = {};
      for (const transaction of transactions) {
        if (transaction.account_id !== account.id) continue;
        const day = transactionDay(transaction.date);
        if (day >= from && day <= to) counts[day] = (counts[day] ?? 0) + 1;
      }
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        counts,
        confirmedEmpty: confirmed.filter((c) => c.account_id === account.id).map((c) => c.day),
      };
    }),
  };
}

export async function confirmEmptyDay(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const { accountId, day, confirmed } = input;
  if (typeof accountId !== 'string' || typeof day !== 'string' || typeof confirmed !== 'boolean') return failure('invalid');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > saoPauloDate(ctx.clock.now())) return failure('invalid');
  if ((await ctx.sql.all('SELECT 1 FROM accounts WHERE id = ?', accountId)).length === 0) return failure('not_found');
  await ctx.sql.batch([
    confirmed
      ? statement('INSERT INTO confirmed_empty_days (account_id, day, confirmed_at) VALUES (?, ?, ?) ON CONFLICT (account_id, day) DO NOTHING', accountId, day, nowIso(ctx))
      : statement('DELETE FROM confirmed_empty_days WHERE account_id = ? AND day = ?', accountId, day),
  ]);
  return { ok: true, value: null, changed: ['vault'] };
}
