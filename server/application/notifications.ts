// /webhooks/notification (docs/spec/gastos-provisorios.md): MacroDroid posts each bank
// notification from the phone. The body goes to R2 first; then, in the same batch as its
// raw_payloads row, a purchase or a Pix sent becomes a provisional expense. Reading the text needs
// no external call, so it happens before the answer, still well under a second.
import type { ProvisionalExpenseView } from '../../src/application/api-contract';
import { readNotification } from '../../src/domain/notification';
import { nowIso, type Context } from './context';
import { statement } from './ports';
import { archive } from './collect/raw';

/** Android may post the same notification again; the same text within this window counts once. */
export const REPEAT_WINDOW_MS = 2 * 60 * 1000;
/** How many the Cofre list shows. */
export const LIST_LIMIT = 50;
const MAX_FIELD = 2000;

export type NotificationReceived = 'stored' | 'ignored' | 'duplicate' | 'invalid';

interface Body {
  readonly app?: unknown;
  readonly title?: unknown;
  readonly text?: unknown;
  readonly postedAt?: unknown;
}

const field = (value: unknown) => (typeof value === 'string' ? value.trim().slice(0, MAX_FIELD) : '');

/** ISO text, or epoch seconds or milliseconds (MacroDroid's time variables). */
export function postedAt(value: unknown): string | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : null;
  const date = number !== null ? new Date(number < 1e12 ? number * 1000 : number) : typeof value === 'string' ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

export async function receiveNotification(ctx: Context, raw: string): Promise<NotificationReceived> {
  const archived = await archive(ctx, 'notification-webhook', 'POST /webhooks/notification', raw);
  let body: Body | null = null;
  try {
    const parsed: unknown = JSON.parse(raw);
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Body) : null;
  } catch {
    body = null;
  }
  const input = { app: field(body?.app), title: field(body?.title), text: field(body?.text) };
  if (!body || !input.text) {
    await ctx.sql.batch([archived.insert]);
    return 'invalid';
  }

  const read = readNotification(input);
  if (read.status === 'ignored') {
    await ctx.sql.batch([archived.insert]);
    return 'ignored';
  }

  const now = nowIso(ctx);
  const since = new Date(ctx.clock.now().getTime() - REPEAT_WINDOW_MS).toISOString();
  const repeated = await ctx.sql.all(
    'SELECT 1 FROM provisional_expenses WHERE app = ? AND title = ? AND text = ? AND received_at >= ?',
    input.app,
    input.title,
    input.text,
    since,
  );
  if (repeated.length > 0) {
    await ctx.sql.batch([archived.insert]);
    return 'duplicate';
  }

  const expense = read.status === 'expense' ? read : null;
  await ctx.sql.batch([
    archived.insert,
    statement(
      `INSERT INTO provisional_expenses (id, source, app, title, text, kind, amount_cents, currency_code, merchant, posted_at, received_at, raw_payload_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ctx.ids.next(),
      read.source,
      input.app,
      input.title,
      input.text,
      read.kind,
      expense?.amountCents ?? null,
      expense?.currency ?? null,
      expense?.merchant ?? null,
      postedAt(body.postedAt),
      now,
      archived.id,
      expense ? 'provisional' : 'unreadable',
    ),
  ]);
  return 'stored';
}

/** The latest provisional expenses, newest first, for the Cofre screen. */
export async function provisionalExpenses(ctx: Context): Promise<ProvisionalExpenseView[]> {
  const rows = await ctx.sql.all<{
    id: string;
    source: ProvisionalExpenseView['source'];
    kind: ProvisionalExpenseView['kind'];
    amount_cents: number | null;
    currency_code: string | null;
    merchant: string | null;
    at: string;
    status: ProvisionalExpenseView['status'];
    text: string;
  }>(
    `SELECT id, source, kind, amount_cents, currency_code, merchant, COALESCE(posted_at, received_at) AS at, status, text
     FROM provisional_expenses WHERE transaction_id IS NULL ORDER BY received_at DESC LIMIT ?`,
    LIST_LIMIT,
  );
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    kind: row.kind,
    amountCents: row.amount_cents,
    currency: row.currency_code,
    merchant: row.merchant,
    at: row.at,
    status: row.status,
    text: row.status === 'unreadable' ? row.text : null,
  }));
}
