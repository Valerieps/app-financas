// Raw first (docs/ARQUITETURA.md): every Pluggy response and every webhook body goes to R2, with
// a row in raw_payloads, before anything reads it.
import { sha256 } from '../../infrastructure/crypto';
import { nowIso, type Context } from '../context';
import { statement, type Statement } from '../ports';

export type RawSource = 'pluggy-api' | 'pluggy-webhook' | 'notification-webhook';

/** Stores the body in R2 and returns the raw_payloads row to insert (callers may batch it). */
export async function archive(
  ctx: Context,
  source: RawSource,
  endpoint: string,
  body: string,
  meta: { itemId?: string | null; status?: number | null } = {},
): Promise<{ id: string; insert: Statement }> {
  const receivedAt = nowIso(ctx);
  const hash = await sha256(body);
  const [day] = receivedAt.split('T');
  const stamp = receivedAt.replace(/[-:]/g, '');
  const key = `${source}/${day.replace(/-/g, '/')}/${stamp}-${hash}.json`;
  await ctx.raw.put(key, body);
  const id = ctx.ids.next();
  return {
    id,
    insert: statement(
      'INSERT INTO raw_payloads (id, source, endpoint, item_id, status, received_at, r2_key, sha256, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      source,
      endpoint,
      meta.itemId ?? null,
      meta.status ?? null,
      receivedAt,
      key,
      hash,
      new TextEncoder().encode(body).length,
    ),
  };
}

export interface Fetched<T> {
  readonly status: number;
  /** The parsed body when the status is 2xx. */
  readonly data: T | null;
}

/** GET from Pluggy, archived before it is parsed. */
export async function pluggyGet<T>(ctx: Context, path: string, query: Record<string, string> = {}, itemId: string | null = null): Promise<Fetched<T>> {
  const response = await ctx.pluggy.get(path, query);
  const search = new URLSearchParams(query).toString();
  const { insert } = await archive(ctx, 'pluggy-api', `GET ${path}${search ? `?${search}` : ''}`, response.body, {
    itemId,
    status: response.status,
  });
  await ctx.sql.batch([insert]);
  if (response.status < 200 || response.status >= 300) return { status: response.status, data: null };
  try {
    return { status: response.status, data: JSON.parse(response.body) as T };
  } catch {
    return { status: 502, data: null };
  }
}

interface Page<T> {
  readonly results?: T[];
  readonly totalPages?: number;
}

/** Every page of a page-numbered list (500 per page). */
export async function pluggyPages<T>(ctx: Context, path: string, query: Record<string, string>, itemId: string | null): Promise<Fetched<T[]>> {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const fetched = await pluggyGet<Page<T>>(ctx, path, { ...query, page: String(page), pageSize: '500' }, itemId);
    // A list with a page missing is no list: callers would take the missing records as gone.
    if (!fetched.data) return { status: fetched.status, data: null };
    all.push(...(fetched.data.results ?? []));
    if (page >= (fetched.data.totalPages ?? 1)) return { status: fetched.status, data: all };
  }
}

/** Every page of a cursor list (GET /v2/transactions: 500 per page, `next` until null). */
export async function pluggyCursor<T>(ctx: Context, path: string, query: Record<string, string>, itemId: string): Promise<Fetched<T[]>> {
  const all: T[] = [];
  let after: string | null = null;
  for (;;) {
    const fetched: Fetched<{ results?: T[]; next?: string | null }> = await pluggyGet(ctx, path, after ? { ...query, after } : query, itemId);
    if (!fetched.data) return { status: fetched.status, data: null };
    all.push(...(fetched.data.results ?? []));
    after = fetched.data.next ? new URLSearchParams(fetched.data.next.replace(/^\?/, '')).get('after') : null;
    if (!after) return { status: fetched.status, data: all };
  }
}
