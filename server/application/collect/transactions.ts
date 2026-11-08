// Transactions of one account (docs/spec/cofre-de-dados.md). The app's id never changes; Pluggy's
// id may (the card deletes and recreates a transaction when its date, amount or description
// change), so a fetched transaction is recognized by its Pluggy id or else by its match key.
// Nothing is deleted: a transaction that disappears gets deleted_at, and may come back.
import { cardPaymentWithChoice, direction, isCardPayment } from '../../../src/domain/lancamentos';
import { tagsFromRules } from '../../../src/domain/rules';
import { matchKeys, toCents } from '../../../src/domain/vault';
import { nowIso, type Context } from '../context';
import { descriptionStatements, storedDescriptions } from '../descriptions';
import { statement, type SqlValue, type Statement } from '../ports';
import { rules as loadRules, ruleTagStatements } from '../rules';
import { pluggyCursor } from './raw';

export interface PluggyTransaction {
  readonly id: string;
  readonly accountId?: string;
  readonly date: string;
  readonly description?: string | null;
  readonly descriptionRaw?: string | null;
  readonly amount: number;
  readonly amountInAccountCurrency?: number | null;
  readonly balance?: number | null;
  readonly currencyCode: string;
  readonly categoryId?: string | null;
  readonly providerCode?: string | null;
  readonly providerId?: string | null;
  readonly status?: string | null;
  readonly type?: string | null;
  readonly operationType?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly paymentData?: PaymentData | null;
  readonly creditCardMetadata?: CardMetadata | null;
}

interface Participant {
  readonly name?: string | null;
}

interface PaymentData {
  readonly payer?: Participant | null;
  readonly receiver?: Participant | null;
  readonly paymentMethod?: string | null;
  readonly reason?: string | null;
  readonly referenceNumber?: string | null;
  readonly boletoMetadata?: unknown;
}

interface CardMetadata {
  readonly installmentNumber?: number | null;
  readonly totalInstallments?: number | null;
  readonly totalAmount?: number | null;
  readonly purchaseDate?: string | null;
  readonly payeeMCC?: number | null;
  readonly cardNumber?: string | null;
  readonly billId?: string | null;
}

type Row = Record<string, SqlValue>;

export interface AccountRef {
  /** The app's account id. */
  readonly id: string;
  readonly pluggyId: string;
  readonly itemId: string;
  /** Pluggy's account type: BANK or CREDIT. */
  readonly type: string | null;
}

export interface TransactionSyncOptions {
  /** Read only transactions dated from this day (yyyy-mm-dd); without it, everything Pluggy has. */
  readonly dateFrom?: string;
  /** Also read the transactions created since this instant (transactions/created). */
  readonly createdAtFrom?: string;
  /** Pluggy ids that Pluggy reported deleted (transactions/deleted). */
  readonly deletedIds?: readonly string[];
  /** Mark as deleted what is stored from `dateFrom` on and no longer comes back. */
  readonly markMissing?: boolean;
}

export interface TransactionCounts {
  fetched: number;
  inserted: number;
  updated: number;
  deleted: number;
  restored: number;
  skipped: number;
}

const BATCH_TRANSACTIONS = 50;

/** Reads the account's transactions from Pluggy and reconciles them. Null when Pluggy failed. */
export async function syncTransactions(ctx: Context, account: AccountRef, options: TransactionSyncOptions = {}): Promise<TransactionCounts | null> {
  const query: Record<string, string> = { accountId: account.pluggyId };
  const window = await pluggyCursor<PluggyTransaction>(ctx, '/v2/transactions', options.dateFrom ? { ...query, dateFrom: options.dateFrom } : query, account.itemId);
  if (!window.data) return null;
  let extra: PluggyTransaction[] = [];
  if (options.createdAtFrom) {
    const created = await pluggyCursor<PluggyTransaction>(ctx, '/v2/transactions', { ...query, createdAtFrom: options.createdAtFrom }, account.itemId);
    if (!created.data) return null;
    const inWindow = new Set(window.data.map((t) => t.id));
    extra = created.data.filter((t) => !inWindow.has(t.id));
  }

  // Positions among identical transactions only make sense inside one complete list.
  const keys = new Map([...matchKeys(window.data), ...matchKeys(extra)]);
  const fetched = [...window.data, ...extra];
  const deletedIds = options.deletedIds ?? [];

  const stored = await ctx.sql.all<Row>(
    `SELECT * FROM transactions WHERE account_id = ? AND (date >= ? OR pluggy_id IN (SELECT value FROM json_each(?)) OR match_key IN (SELECT value FROM json_each(?)))`,
    account.id,
    options.dateFrom ?? '',
    JSON.stringify([...fetched.map((t) => t.id), ...deletedIds]),
    JSON.stringify([...keys.values()]),
  );
  const byPluggyId = new Map(stored.map((row) => [String(row.pluggy_id), row]));
  const byKey = new Map(stored.map((row) => [String(row.match_key), row]));
  const fetchedIds = new Set(fetched.map((t) => t.id));
  /** Stored rows this read matched, whatever Pluggy id they had before. */
  const matched = new Set<SqlValue>();

  // My automatic rules tag each new lançamento as it arrives and rewrite the description of each one
  // written (docs/spec/regras-automaticas.md), which may look at the category I chose.
  const storedIds = JSON.stringify(stored.map((row) => row.id));
  const [rules, choices, descriptions] = await Promise.all([
    loadRules(ctx),
    ctx.sql
      .all<{ transaction_id: string; pluggy_category_id: string }>(
        'SELECT transaction_id, pluggy_category_id FROM transaction_categories WHERE transaction_id IN (SELECT value FROM json_each(?))',
        storedIds,
      )
      .then((rows) => new Map(rows.map((row) => [row.transaction_id, row.pluggy_category_id]))),
    storedDescriptions(ctx, stored.map((row) => String(row.id))),
  ]);
  const now = nowIso(ctx);
  const counts: TransactionCounts = { fetched: fetched.length, inserted: 0, updated: 0, deleted: 0, restored: 0, skipped: 0 };
  const groups: Statement[][] = [];
  const version = (row: Row) =>
    statement(
      'INSERT INTO transaction_versions (id, transaction_id, previous_json, changed_at) VALUES (?, ?, ?, ?)',
      ctx.ids.next(),
      row.id,
      JSON.stringify(row),
      now,
    );

  const subject = (transaction: PluggyTransaction, columns: Row, chosen: string | null) => ({
    description: (columns.description as string | null) ?? null,
    direction: direction(transaction.type ?? null, columns.amount_cents as number, account.type),
    categoryId: chosen ?? transaction.categoryId ?? null,
    cardPayment: cardPaymentWithChoice(columns.card_payment === 1, chosen),
  });

  for (const transaction of fetched) {
    const matchKey = keys.get(transaction)!;
    let current = byPluggyId.get(transaction.id);
    if (!current) {
      const candidate = byKey.get(matchKey);
      // A row whose Pluggy id is still alive in this read is another transaction, not this one.
      if (candidate && fetchedIds.has(String(candidate.pluggy_id))) {
        counts.skipped++;
        continue;
      }
      current = candidate;
    }
    const columns = transactionColumns(transaction, account, matchKey);
    const group: Statement[] = [];
    let id: string;
    if (!current) {
      id = ctx.ids.next();
      const row: Row = { id, ...columns, deleted_at: null, raw_json: JSON.stringify(transaction), first_seen_at: now, last_seen_at: now };
      const names = Object.keys(row);
      group.push(statement(`INSERT INTO transactions (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`, ...names.map((n) => row[n])));
      const tags = tagsFromRules(rules, subject(transaction, columns, null));
      group.push(...ruleTagStatements(new Map([[id, tags]]), now));
      counts.inserted++;
    } else {
      id = String(current.id);
      matched.add(current.id);
      const rawJson = JSON.stringify(transaction);
      const changed = current.pluggy_id !== transaction.id || current.deleted_at !== null || withoutUpdatedAt(current.raw_json) !== withoutUpdatedAt(rawJson);
      if (changed) {
        group.push(version(current));
        if (current.deleted_at !== null) counts.restored++;
        else counts.updated++;
      }
      const row: Row = { ...columns, deleted_at: null, raw_json: rawJson, last_seen_at: now };
      const names = Object.keys(row);
      group.push(statement(`UPDATE transactions SET ${names.map((n) => `${n} = ?`).join(', ')} WHERE id = ?`, ...names.map((n) => row[n]), id));
      byKey.delete(String(current.match_key));
    }
    group.push(...detailStatements(id, transaction));
    group.push(...descriptionStatements(rules, [{ id, ...subject(transaction, columns, choices.get(id) ?? null) }], descriptions, now));
    groups.push(group);
  }

  // An empty read (an expired consent reads empty) never wipes the account.
  const markMissing = Boolean(options.markMissing && options.dateFrom && window.data.length > 0);
  const gone = stored.filter(
    (row) =>
      row.deleted_at === null &&
      !matched.has(row.id) &&
      !fetchedIds.has(String(row.pluggy_id)) &&
      (deletedIds.includes(String(row.pluggy_id)) || (markMissing && String(row.date) >= options.dateFrom!)),
  );
  for (const row of gone) {
    groups.push([version(row), statement('UPDATE transactions SET deleted_at = ?, last_seen_at = ? WHERE id = ?', now, now, row.id)]);
    counts.deleted++;
  }

  for (let i = 0; i < groups.length; i += BATCH_TRANSACTIONS) {
    await ctx.sql.batch(groups.slice(i, i + BATCH_TRANSACTIONS).flat());
  }
  return counts;
}

function transactionColumns(t: PluggyTransaction, account: AccountRef, matchKey: string): Row {
  const amountCents = toCents(t.amount) ?? 0;
  // Every write decides it again, so a payment that Pluggy recategorizes or renames follows.
  const cardPayment = isCardPayment({
    type: t.type ?? null,
    amountCents,
    accountType: account.type,
    pluggyCategoryId: t.categoryId ?? null,
    description: t.description ?? null,
  });
  return {
    pluggy_id: t.id,
    account_id: account.id,
    match_key: matchKey,
    provider_id: t.providerId ?? null,
    provider_code: t.providerCode ?? null,
    date: t.date,
    amount_cents: amountCents,
    currency_code: t.currencyCode,
    amount_in_account_currency_cents: toCents(t.amountInAccountCurrency),
    balance_cents: toCents(t.balance),
    description: t.description ?? null,
    description_raw: t.descriptionRaw ?? null,
    pluggy_category_id: t.categoryId ?? null,
    status: t.status ?? null,
    type: t.type ?? null,
    operation_type: t.operationType ?? null,
    bill_id: t.creditCardMetadata?.billId ?? null,
    pluggy_created_at: t.createdAt ?? null,
    pluggy_updated_at: t.updatedAt ?? null,
    card_payment: cardPayment ? 1 : 0,
  };
}

function detailStatements(transactionId: string, t: PluggyTransaction): Statement[] {
  const statements: Statement[] = [];
  const payment = t.paymentData;
  if (payment) {
    statements.push(
      statement(
        `INSERT OR REPLACE INTO transaction_payment_data
          (transaction_id, payer_name, payer_json, receiver_name, receiver_json, payment_method, reason, reference_number, boleto_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        transactionId,
        payment.payer?.name ?? null,
        payment.payer ? JSON.stringify(payment.payer) : null,
        payment.receiver?.name ?? null,
        payment.receiver ? JSON.stringify(payment.receiver) : null,
        payment.paymentMethod ?? null,
        payment.reason ?? null,
        payment.referenceNumber ?? null,
        payment.boletoMetadata ? JSON.stringify(payment.boletoMetadata) : null,
      ),
    );
  }
  const card = t.creditCardMetadata;
  if (card) {
    statements.push(
      statement(
        `INSERT OR REPLACE INTO transaction_card_data
          (transaction_id, installment_number, total_installments, total_amount_cents, purchase_date, payee_mcc, card_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        transactionId,
        card.installmentNumber ?? null,
        card.totalInstallments ?? null,
        toCents(card.totalAmount),
        card.purchaseDate ?? null,
        card.payeeMCC ?? null,
        card.cardNumber ?? null,
      ),
    );
  }
  return statements;
}

function withoutUpdatedAt(rawJson: SqlValue): string {
  try {
    const record = JSON.parse(String(rawJson)) as Record<string, unknown>;
    delete record.updatedAt;
    return JSON.stringify(record);
  } catch {
    return String(rawJson);
  }
}
