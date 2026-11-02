// Registering a connection by the itemId copied from the Pluggy Dashboard (Meu Pluggy has no list).
import { failure, nowIso, type CommandResult, type Context } from '../context';
import { PluggyUnavailable, readItem } from './products';
import { syncItem } from './sync';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addConnection(ctx: Context, rawItemId: unknown): Promise<CommandResult<{ itemId: string }>> {
  const itemId = String(rawItemId ?? '').trim().toLowerCase();
  if (!UUID.test(itemId)) return failure('invalid');
  if ((await ctx.sql.all('SELECT 1 FROM items WHERE item_id = ?', itemId)).length > 0) return failure('conflict');

  const now = nowIso(ctx);
  await ctx.sql.run('INSERT INTO items (item_id, registered_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', itemId, now, now, now);
  try {
    if (!(await readItem(ctx, itemId))) {
      await ctx.sql.run('DELETE FROM items WHERE item_id = ?', itemId);
      return failure('not_found');
    }
  } catch (error) {
    await ctx.sql.run('DELETE FROM items WHERE item_id = ?', itemId);
    if (error instanceof PluggyUnavailable) return failure('unavailable');
    throw error;
  }
  // The first load (12 months of everything) may outlive the request; the cron retries it if not.
  ctx.background(syncItem(ctx, itemId, 'initial'));
  return { ok: true, value: { itemId }, changed: ['vault'] };
}
