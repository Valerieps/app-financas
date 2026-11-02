// The Cofre screen's read: each connection, what is stored for it and what the bank did not share.
import type { ConnectionView, VaultView } from '../../../src/application/api-contract';
import type { Context } from '../context';

interface ConnectionRow {
  item_id: string;
  connector_name: string | null;
  status: string | null;
  error_code: string | null;
  error_message: string | null;
  last_synced_at: string | null;
  consent_expires_at: string | null;
  replaced_by: string | null;
  accounts: number;
  transactions: number;
  deleted_transactions: number;
  bills: number;
  investments: number;
}

export async function vault(ctx: Context): Promise<VaultView> {
  const rows = await ctx.sql.all<ConnectionRow>(
    `SELECT i.item_id, i.connector_name, i.status, i.error_code, i.error_message, i.last_synced_at, i.consent_expires_at, i.replaced_by,
       (SELECT COUNT(*) FROM accounts a WHERE a.item_id = i.item_id) AS accounts,
       (SELECT COUNT(*) FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE a.item_id = i.item_id AND t.deleted_at IS NULL) AS transactions,
       (SELECT COUNT(*) FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE a.item_id = i.item_id AND t.deleted_at IS NOT NULL) AS deleted_transactions,
       (SELECT COUNT(*) FROM bills b JOIN accounts a ON a.id = b.account_id WHERE a.item_id = i.item_id) AS bills,
       (SELECT COUNT(*) FROM investments v WHERE v.item_id = i.item_id) AS investments
     FROM items i
     ORDER BY i.replaced_by IS NOT NULL, i.registered_at`,
  );
  const unavailable = await ctx.sql.all<{ item_id: string; product: string }>('SELECT item_id, product FROM item_resources WHERE available = 0 ORDER BY product');
  // The last failed run counts only if no run worked after it.
  const failures = await ctx.sql.all<{ item_id: string; started_at: string; error: string }>(
    `SELECT r.item_id, r.started_at, r.error FROM sync_runs r
     WHERE r.error IS NOT NULL AND r.started_at = (SELECT MAX(started_at) FROM sync_runs WHERE item_id = r.item_id AND finished_at IS NOT NULL)`,
  );

  const connections: ConnectionView[] = rows.map((row) => {
    const failure = failures.find((f) => f.item_id === row.item_id);
    return {
      itemId: row.item_id,
      institution: row.connector_name,
      status: row.status,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      lastSyncedAt: row.last_synced_at,
      consentExpiresAt: row.consent_expires_at,
      replacedBy: row.replaced_by,
      lastError: failure ? { at: failure.started_at, message: failure.error } : null,
      counts: {
        accounts: row.accounts,
        transactions: row.transactions,
        deletedTransactions: row.deleted_transactions,
        bills: row.bills,
        investments: row.investments,
      },
      unavailable: unavailable.filter((u) => u.item_id === row.item_id).map((u) => u.product),
    };
  });
  return { connections };
}
