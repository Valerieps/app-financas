// /webhooks/pluggy (docs/ARQUITETURA.md): store the raw body and the event, answer 2xx at once,
// and process afterwards by re-reading Pluggy. A repeated eventId has no effect; an event whose
// processing failed is retried by the cron, up to MAX_ATTEMPTS.
import { nowIso, type Context } from '../context';
import { statement } from '../ports';
import { readItem } from './products';
import { archive } from './raw';
import { syncAccountTransactions, syncItem } from './sync';

export const MAX_ATTEMPTS = 5;
/** The cron leaves alone the events the webhook's own `waitUntil` may still be processing. */
const GRACE_MS = 2 * 60 * 1000;

interface PluggyEvent {
  readonly event?: string;
  readonly eventId?: string;
  readonly itemId?: string;
  readonly accountId?: string;
  readonly transactionIds?: readonly string[];
  readonly transactionsCreatedAtFrom?: string;
}

export type Received = { readonly status: 'new'; readonly eventId: string } | { readonly status: 'duplicate' } | { readonly status: 'invalid' };

/** Archives the body first, whatever it is; then records the event once. */
export async function receivePluggyWebhook(ctx: Context, body: string): Promise<Received> {
  let event: PluggyEvent | null = null;
  try {
    event = JSON.parse(body) as PluggyEvent;
  } catch {
    event = null;
  }
  const itemId = typeof event?.itemId === 'string' ? event.itemId : null;
  const raw = await archive(ctx, 'pluggy-webhook', 'POST /webhooks/pluggy', body, { itemId });
  if (!event || typeof event.eventId !== 'string' || typeof event.event !== 'string') {
    await ctx.sql.batch([raw.insert]);
    return { status: 'invalid' };
  }
  const known = await ctx.sql.all('SELECT 1 FROM webhook_events WHERE event_id = ?', event.eventId);
  await ctx.sql.batch([
    raw.insert,
    statement(
      `INSERT INTO webhook_events (event_id, source, event, item_id, raw_payload_id, received_at) VALUES (?, 'pluggy', ?, ?, ?, ?)
       ON CONFLICT (event_id) DO NOTHING`,
      event.eventId,
      event.event,
      itemId,
      raw.id,
      nowIso(ctx),
    ),
  ]);
  return known.length > 0 ? { status: 'duplicate' } : { status: 'new', eventId: event.eventId };
}

/** Processes one stored event by re-reading Pluggy, never by trusting the event's content. */
export async function processEvent(ctx: Context, eventId: string): Promise<void> {
  const [row] = await ctx.sql.all<{ event: string; item_id: string | null; processed_at: string | null; r2_key: string }>(
    `SELECT e.event, e.item_id, e.processed_at, r.r2_key FROM webhook_events e JOIN raw_payloads r ON r.id = e.raw_payload_id WHERE e.event_id = ?`,
    eventId,
  );
  if (!row || row.processed_at) return;
  await ctx.sql.run('UPDATE webhook_events SET attempts = attempts + 1 WHERE event_id = ?', eventId);

  const body = await ctx.raw.get(row.r2_key);
  const event = body ? (JSON.parse(body) as PluggyEvent) : {};
  const registered = row.item_id
    ? (await ctx.sql.all("SELECT 1 FROM items WHERE item_id = ? AND replaced_by IS NULL AND status IS NOT 'DELETED'", row.item_id)).length > 0
    : false;

  let ok = true;
  if (registered && row.item_id) {
    const itemId = row.item_id;
    if (row.event === 'item/updated' || row.event === 'item/created' || row.event === 'item/login_succeeded') {
      ok = await syncItem(ctx, itemId, 'webhook');
    } else if (row.event.startsWith('item/')) {
      ok = await syncItemStatus(ctx, itemId);
    } else if (row.event.startsWith('transactions/') && typeof event.accountId === 'string') {
      ok = await syncAccountTransactions(ctx, itemId, event.accountId, {
        createdAtFrom: row.event === 'transactions/created' ? event.transactionsCreatedAtFrom : undefined,
        deletedIds: row.event === 'transactions/deleted' ? (event.transactionIds ?? []) : undefined,
      });
    }
  }
  // Events about connections the vault does not keep, and payment events, stay only in the archive.
  if (ok) await ctx.sql.run('UPDATE webhook_events SET processed_at = ?, last_error = NULL WHERE event_id = ?', nowIso(ctx), eventId);
  else await ctx.sql.run("UPDATE webhook_events SET last_error = 'sync falhou' WHERE event_id = ?", eventId);
}

/** item/error, item/deleted and the like: only the connection's state changes. */
async function syncItemStatus(ctx: Context, itemId: string): Promise<boolean> {
  try {
    const item = await readItem(ctx, itemId);
    if (!item) await ctx.sql.run("UPDATE items SET status = 'DELETED', last_seen_at = ? WHERE item_id = ?", nowIso(ctx), itemId);
    return true;
  } catch {
    return false;
  }
}

/** The cron: events not yet processed, oldest first. */
export async function processPendingEvents(ctx: Context, limit = 20): Promise<void> {
  const before = new Date(ctx.clock.now().getTime() - GRACE_MS).toISOString();
  const pending = await ctx.sql.all<{ event_id: string }>(
    'SELECT event_id FROM webhook_events WHERE processed_at IS NULL AND attempts < ? AND received_at < ? ORDER BY received_at LIMIT ?',
    MAX_ATTEMPTS,
    before,
    limit,
  );
  for (const { event_id: eventId } of pending) await processEvent(ctx, eventId);
}
