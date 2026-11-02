// When and how much is read from Pluggy (docs/spec/cofre-de-dados.md, "Quando é coletado"):
// everything when a connection is registered, everything again in the daily sweep and after
// item/updated, and one account's recent transactions after a transaction event.
import { addDays, saoPauloDate, saoPauloHour } from '../../../src/domain/vault';
import { nowIso, type Context } from '../context';
import {
  PluggyUnavailable,
  readAccounts,
  readBills,
  readCategories,
  readConsents,
  readIdentity,
  readInvestments,
  readItem,
  readLoans,
  readResources,
  readScr,
  type PluggyItem,
} from './products';
import { syncTransactions, type TransactionCounts } from './transactions';

export type SyncKind = 'initial' | 'daily' | 'webhook';

/** Days of transactions re-read by the daily sweep and after transaction events. */
export const RECENT_DAYS = 40;
export const SWEEP_HOUR = 7;
const CATEGORIES_EVERY_DAYS = 7;
const SCR_EVERY_DAYS = 30;
const RETRY_FIRST_LOAD_MS = 60 * 60 * 1000;

/** Only a connection Pluggy reports as healthy may have its missing transactions marked deleted. */
const healthy = (item: PluggyItem) => item.status === 'UPDATED' && !item.error;

async function startRun(ctx: Context, itemId: string, kind: string): Promise<string> {
  const id = ctx.ids.next();
  await ctx.sql.run('INSERT INTO sync_runs (id, item_id, kind, started_at) VALUES (?, ?, ?, ?)', id, itemId, kind, nowIso(ctx));
  return id;
}

async function finishRun(ctx: Context, runId: string, counts: Record<string, unknown>, error: unknown): Promise<void> {
  // Only our own message: Pluggy's bodies may carry personal data and never go into logs.
  const message = error === null ? null : error instanceof PluggyUnavailable ? error.message : 'falha inesperada';
  if (error !== null && !(error instanceof PluggyUnavailable)) console.error('sync failed', error instanceof Error ? error.name : typeof error);
  await ctx.sql.run('UPDATE sync_runs SET finished_at = ?, counts_json = ?, error = ? WHERE id = ?', nowIso(ctx), JSON.stringify(counts), message, runId);
}

async function due(ctx: Context, job: string, everyDays: number): Promise<boolean> {
  const [row] = await ctx.sql.all<{ last_run_at: string }>('SELECT last_run_at FROM job_runs WHERE job = ?', job);
  return !row || Date.parse(row.last_run_at) <= ctx.clock.now().getTime() - everyDays * 86_400_000 + 3_600_000;
}

async function markRun(ctx: Context, job: string): Promise<void> {
  await ctx.sql.run(
    'INSERT INTO job_runs (job, last_run_at) VALUES (?, ?) ON CONFLICT (job) DO UPDATE SET last_run_at = excluded.last_run_at',
    job,
    nowIso(ctx),
  );
}

/** Reads everything the connection offers. Returns false when it failed (the run records why). */
export async function syncItem(ctx: Context, itemId: string, kind: SyncKind): Promise<boolean> {
  const runId = await startRun(ctx, itemId, kind);
  const counts: Record<string, unknown> = {};
  try {
    const item = await readItem(ctx, itemId);
    if (!item) {
      await ctx.sql.run("UPDATE items SET status = 'DELETED', last_seen_at = ? WHERE item_id = ?", nowIso(ctx), itemId);
      await finishRun(ctx, runId, counts, new PluggyUnavailable('item', 404));
      return false;
    }
    counts.consents = await readConsents(ctx, item);
    await readResources(ctx, item);
    const accounts = await readAccounts(ctx, item, { snapshot: true });
    counts.accounts = accounts.length;

    const today = saoPauloDate(ctx.clock.now());
    const transactions: TransactionCounts[] = [];
    for (const account of accounts) {
      const result = await syncTransactions(
        ctx,
        { id: account.id, pluggyId: account.pluggyId, itemId },
        kind === 'initial' ? {} : { dateFrom: addDays(today, -RECENT_DAYS), markMissing: healthy(item) },
      );
      if (!result) throw new PluggyUnavailable('transactions', 502);
      transactions.push(result);
    }
    counts.transactions = sum(transactions);

    let bills = 0;
    for (const account of accounts.filter((a) => a.type === 'CREDIT')) bills += await readBills(ctx, item, account);
    counts.bills = bills;
    counts.investments = await readInvestments(ctx, item, { snapshot: true });
    counts.loans = await readLoans(ctx, item);
    await readIdentity(ctx, item);

    if (await due(ctx, 'categories', CATEGORIES_EVERY_DAYS)) {
      counts.categories = await readCategories(ctx);
      await markRun(ctx, 'categories');
    }
    const [{ scr_checked_at: scrCheckedAt }] = await ctx.sql.all<{ scr_checked_at: string | null }>('SELECT scr_checked_at FROM items WHERE item_id = ?', itemId);
    if (!scrCheckedAt || Date.parse(scrCheckedAt) <= ctx.clock.now().getTime() - SCR_EVERY_DAYS * 86_400_000) await readScr(ctx, item);

    await ctx.sql.run('UPDATE items SET last_synced_at = ? WHERE item_id = ?', nowIso(ctx), itemId);
    await finishRun(ctx, runId, counts, null);
    return true;
  } catch (error) {
    await finishRun(ctx, runId, counts, error);
    return false;
  }
}

/** After a transaction event: re-read that account's recent transactions, plus what the event named. */
export async function syncAccountTransactions(
  ctx: Context,
  itemId: string,
  pluggyAccountId: string,
  event: { createdAtFrom?: string; deletedIds?: readonly string[] },
): Promise<boolean> {
  const [account] = await ctx.sql.all<{ id: string }>('SELECT id FROM accounts WHERE pluggy_id = ? AND item_id = ?', pluggyAccountId, itemId);
  // An account the vault does not know yet comes with the whole connection.
  if (!account) return syncItem(ctx, itemId, 'webhook');

  const runId = await startRun(ctx, itemId, 'webhook');
  try {
    const [stored] = await ctx.sql.all<{ status: string | null; error_code: string | null }>('SELECT status, error_code FROM items WHERE item_id = ?', itemId);
    const today = saoPauloDate(ctx.clock.now());
    const counts = await syncTransactions(
      ctx,
      { id: account.id, pluggyId: pluggyAccountId, itemId },
      {
        dateFrom: addDays(today, -RECENT_DAYS),
        createdAtFrom: event.createdAtFrom,
        deletedIds: event.deletedIds,
        markMissing: stored?.status === 'UPDATED' && !stored.error_code,
      },
    );
    if (!counts) throw new PluggyUnavailable('transactions', 502);
    await finishRun(ctx, runId, { transactions: counts }, null);
    return true;
  } catch (error) {
    await finishRun(ctx, runId, {}, error);
    return false;
  }
}

/** The cron, every 5 minutes: first loads of new connections, and the 7h sweep once a day. */
export async function runSweeps(ctx: Context): Promise<void> {
  // A first load that failed is tried again after an hour (and not while one is still running).
  const pending = await ctx.sql.all<{ item_id: string }>(
    `SELECT item_id FROM items WHERE last_synced_at IS NULL AND replaced_by IS NULL AND status IS NOT 'DELETED'
       AND NOT EXISTS (SELECT 1 FROM sync_runs r WHERE r.item_id = items.item_id AND r.started_at > ?)`,
    new Date(ctx.clock.now().getTime() - RETRY_FIRST_LOAD_MS).toISOString(),
  );
  for (const { item_id: itemId } of pending) await syncItem(ctx, itemId, 'initial');

  const now = ctx.clock.now();
  if (saoPauloHour(now) < SWEEP_HOUR) return;
  const [last] = await ctx.sql.all<{ last_run_at: string }>("SELECT last_run_at FROM job_runs WHERE job = 'daily'");
  if (last && saoPauloDate(new Date(last.last_run_at)) === saoPauloDate(now)) return;
  // Marked before it runs, so a slow sweep is not started again by the next cron.
  await markRun(ctx, 'daily');
  const items = await ctx.sql.all<{ item_id: string }>("SELECT item_id FROM items WHERE replaced_by IS NULL AND status IS NOT 'DELETED' AND last_synced_at IS NOT NULL");
  for (const { item_id: itemId } of items) await syncItem(ctx, itemId, 'daily');
}

function sum(list: readonly TransactionCounts[]): TransactionCounts {
  const total: TransactionCounts = { fetched: 0, inserted: 0, updated: 0, deleted: 0, restored: 0, skipped: 0 };
  for (const counts of list) for (const key of Object.keys(total) as (keyof TransactionCounts)[]) total[key] += counts[key];
  return total;
}
