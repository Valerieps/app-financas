// Every product Pluggy offers for a connection (docs/spec/cofre-de-dados.md, "O que é coletado").
// Each reader archives what it fetched (raw.ts), mirrors it into its table and says whether the
// product is available: what the bank does not share is "não disponível", not an error.
import { numberSuffix, saoPauloDate, toCents } from '../../../src/domain/vault';
import { sha256 } from '../../infrastructure/crypto';
import { nowIso, type Context } from '../context';
import { statement, type Statement } from '../ports';
import { Mirror, type Row } from './mirror';
import { pluggyGet, pluggyPages, type Fetched } from './raw';

/** A failure worth retrying (Pluggy or the network), as opposed to a product not shared. */
export class PluggyUnavailable extends Error {
  constructor(readonly path: string, readonly status: number) {
    super(`Pluggy ${path} answered ${status}`);
  }
}

export interface PluggyItem {
  readonly id: string;
  readonly connector?: { readonly id?: number; readonly name?: string } | null;
  readonly status?: string | null;
  readonly executionStatus?: string | null;
  readonly error?: { readonly code?: string; readonly message?: string } | null;
  readonly consentExpiresAt?: string | null;
  readonly lastUpdatedAt?: string | null;
  readonly resourcesCollectedAt?: string | null;
  readonly products?: readonly string[] | null;
}

export interface PluggyAccount {
  readonly id: string;
  readonly type?: string | null;
  readonly subtype?: string | null;
  readonly name?: string | null;
  readonly marketingName?: string | null;
  readonly number?: string | null;
  readonly balance?: number | null;
  readonly currencyCode: string;
  readonly creditData?: { readonly creditLimit?: number | null; readonly availableCreditLimit?: number | null } | null;
}

/** Which Pluggy product (`item.products`) each of the app's products depends on. */
const PRODUCT_OF: Record<string, string> = {
  accounts: 'ACCOUNTS',
  transactions: 'TRANSACTIONS',
  bills: 'CREDIT_CARDS',
  investments: 'INVESTMENTS',
  investment_transactions: 'INVESTMENTS_TRANSACTIONS',
  loans: 'LOANS',
  identity: 'IDENTITY',
};

/** Records whether a product is available, from what Pluggy answered. */
export function availability(ctx: Context, item: PluggyItem, product: string, fetched: Fetched<unknown>): Statement | null {
  if (fetched.status >= 500 || fetched.status === 429) throw new PluggyUnavailable(product, fetched.status);
  const declared = PRODUCT_OF[product];
  let detail: string | null = null;
  if (fetched.status >= 400) detail = `HTTP ${fetched.status}`;
  else if (declared && item.products && !item.products.includes(declared)) detail = 'não compartilhado';
  return statement(
    `INSERT INTO item_resources (item_id, product, available, detail, checked_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (item_id, product) DO UPDATE SET available = excluded.available, detail = excluded.detail, checked_at = excluded.checked_at`,
    item.id,
    product,
    detail ? 0 : 1,
    detail,
    nowIso(ctx),
  );
}

/** GET /items/{id}: the connection's status, error and consent expiry. Null when Pluggy no longer has it. */
export async function readItem(ctx: Context, itemId: string): Promise<PluggyItem | null> {
  const fetched = await pluggyGet<PluggyItem>(ctx, `/items/${itemId}`, {}, itemId);
  if (fetched.status === 404) return null;
  if (!fetched.data) throw new PluggyUnavailable('item', fetched.status);
  const item = fetched.data;
  await ctx.sql.run(
    `UPDATE items SET connector_id = ?, connector_name = ?, status = ?, execution_status = ?, error_code = ?, error_message = ?,
       consent_expires_at = ?, pluggy_updated_at = ?, resources_collected_at = ?, raw_json = ?, last_seen_at = ? WHERE item_id = ?`,
    item.connector?.id ?? null,
    item.connector?.name ?? null,
    item.status ?? null,
    item.executionStatus ?? null,
    item.error?.code ?? null,
    item.error?.message ?? null,
    item.consentExpiresAt ?? null,
    item.lastUpdatedAt ?? null,
    item.resourcesCollectedAt ?? null,
    JSON.stringify(item),
    nowIso(ctx),
    itemId,
  );
  return item;
}

export async function readConsents(ctx: Context, item: PluggyItem): Promise<number> {
  const fetched = await pluggyPages<{ id: string; products?: unknown; openFinancePermissionsGranted?: unknown; createdAt?: string; expiresAt?: string; revokedAt?: string }>(
    ctx,
    '/consents',
    { itemId: item.id },
    item.id,
  );
  const statements = compact([availability(ctx, item, 'consents', fetched)]);
  const mirror = await Mirror.load(ctx, { table: 'consents', key: 'id', scope: ['item_id', item.id] });
  for (const consent of fetched.data ?? []) {
    statements.push(
      ...mirror.upsert(
        consent.id,
        {
          item_id: item.id,
          products_json: JSON.stringify(consent.products ?? null),
          permissions_json: JSON.stringify(consent.openFinancePermissionsGranted ?? null),
          created_at: consent.createdAt ?? null,
          expires_at: consent.expiresAt ?? null,
          revoked_at: consent.revokedAt ?? null,
        },
        consent,
      ).statements,
    );
  }
  await ctx.sql.batch(statements);
  return fetched.data?.length ?? 0;
}

/** GET /items/{id}/resources: what the institution declared it shares (Open Finance), archived as is. */
export async function readResources(ctx: Context, item: PluggyItem): Promise<void> {
  const fetched = await pluggyGet(ctx, `/items/${item.id}/resources`, {}, item.id);
  if (fetched.status >= 500 || fetched.status === 429) throw new PluggyUnavailable('resources', fetched.status);
}

export interface StoredAccount {
  readonly id: string;
  readonly pluggyId: string;
  readonly type: string | null;
}

/**
 * Accounts, their daily balance snapshot and the real-time balance. An account Pluggy does not
 * know yet is linked to an account of another connection with the same type and final digits (the
 * item a renewal replaced), and that connection is marked as replaced.
 */
export async function readAccounts(ctx: Context, item: PluggyItem, options: { snapshot: boolean }): Promise<StoredAccount[]> {
  const fetched = await pluggyPages<PluggyAccount>(ctx, '/accounts', { itemId: item.id }, item.id);
  const statements = compact([availability(ctx, item, 'accounts', fetched)]);
  const mirror = await Mirror.load(ctx, { table: 'accounts', key: 'pluggy_id', scope: ['item_id', item.id], volatile: ['balance', 'creditData', 'bankData'] });
  const replaced = new Set<string>();
  const stored: StoredAccount[] = [];
  const now = nowIso(ctx);
  const day = saoPauloDate(ctx.clock.now());

  for (const account of fetched.data ?? []) {
    const suffix = numberSuffix(account.number);
    let adopt: Row | undefined;
    if (!mirror.find(account.id) && suffix) {
      [adopt] = await ctx.sql.all<Row>(
        `SELECT * FROM accounts WHERE item_id != ? AND type IS ? AND subtype IS ? AND number_suffix = ? AND currency_code = ?
         ORDER BY last_seen_at DESC LIMIT 1`,
        item.id,
        account.type ?? null,
        account.subtype ?? null,
        suffix,
        account.currencyCode,
      );
      if (adopt) replaced.add(String(adopt.item_id));
    }
    const balance = toCents(account.balance);
    const creditLimit = toCents(account.creditData?.creditLimit);
    const availableLimit = toCents(account.creditData?.availableCreditLimit);
    const { id, statements: upsert } = mirror.upsert(
      account.id,
      {
        item_id: item.id,
        type: account.type ?? null,
        subtype: account.subtype ?? null,
        name: account.marketingName || account.name || null,
        number_suffix: suffix,
        currency_code: account.currencyCode,
        balance_cents: balance,
        credit_limit_cents: creditLimit,
        available_limit_cents: availableLimit,
      },
      account,
      adopt,
    );
    statements.push(...upsert);
    stored.push({ id, pluggyId: account.id, type: account.type ?? null });

    if (options.snapshot) {
      let snapshotBalance = balance;
      if (account.type === 'BANK') {
        const live = await pluggyGet<{ balance?: number }>(ctx, `/accounts/${account.id}/balance`, {}, item.id);
        if (live.data && typeof live.data.balance === 'number') snapshotBalance = toCents(live.data.balance);
      }
      statements.push(
        statement(
          `INSERT INTO account_balance_snapshots (account_id, date, balance_cents, credit_limit_cents, available_limit_cents, currency_code, captured_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, date) DO UPDATE SET balance_cents = excluded.balance_cents, credit_limit_cents = excluded.credit_limit_cents,
             available_limit_cents = excluded.available_limit_cents, captured_at = excluded.captured_at`,
          id,
          day,
          snapshotBalance,
          creditLimit,
          availableLimit,
          account.currencyCode,
          now,
        ),
      );
    }
  }
  for (const oldItem of replaced) {
    statements.push(statement('UPDATE items SET replaced_by = ? WHERE item_id = ? AND replaced_by IS NULL', item.id, oldItem));
  }
  await ctx.sql.batch(statements);
  return stored;
}

export async function readBills(ctx: Context, item: PluggyItem, account: StoredAccount): Promise<number> {
  const fetched = await pluggyPages<{ id: string; dueDate?: string; totalAmount?: number; totalAmountCurrencyCode?: string; minimumPaymentAmount?: number }>(
    ctx,
    '/bills',
    { accountId: account.pluggyId },
    item.id,
  );
  const statements = compact([availability(ctx, item, 'bills', fetched)]);
  const mirror = await Mirror.load(ctx, { table: 'bills', key: 'pluggy_id', scope: ['account_id', account.id] });
  for (const bill of fetched.data ?? []) {
    statements.push(
      ...mirror.upsert(
        bill.id,
        {
          account_id: account.id,
          due_date: bill.dueDate ?? null,
          total_amount_cents: toCents(bill.totalAmount),
          minimum_payment_cents: toCents(bill.minimumPaymentAmount),
          currency_code: bill.totalAmountCurrencyCode ?? 'BRL',
        },
        bill,
      ).statements,
    );
  }
  await ctx.sql.batch(statements);
  return fetched.data?.length ?? 0;
}

interface PluggyInvestment {
  readonly id: string;
  readonly type?: string | null;
  readonly subtype?: string | null;
  readonly name?: string | null;
  readonly code?: string | null;
  readonly status?: string | null;
  readonly currencyCode?: string | null;
  readonly balance?: number | null;
  readonly amount?: number | null;
  readonly amountProfit?: number | null;
  readonly amountWithdrawal?: number | null;
  readonly annualRate?: number | null;
  readonly lastMonthRate?: number | null;
  readonly lastTwelveMonthsRate?: number | null;
  readonly dueDate?: string | null;
}

const INVESTMENT_VOLATILE = [
  'balance',
  'amount',
  'amountProfit',
  'amountWithdrawal',
  'amountOriginal',
  'value',
  'quantity',
  'annualRate',
  'lastMonthRate',
  'lastTwelveMonthsRate',
  'date',
  'taxes',
  'taxes2',
  'transactions',
];

/** Investments, their daily snapshot, and each one's movements (aplicações e resgates). */
export async function readInvestments(ctx: Context, item: PluggyItem, options: { snapshot: boolean }): Promise<{ investments: number; movements: number }> {
  const fetched = await pluggyPages<PluggyInvestment>(ctx, '/investments', { itemId: item.id }, item.id);
  const statements = compact([availability(ctx, item, 'investments', fetched)]);
  const mirror = await Mirror.load(ctx, { table: 'investments', key: 'pluggy_id', scope: ['item_id', item.id], volatile: INVESTMENT_VOLATILE });
  const stored: { id: string; pluggyId: string }[] = [];
  const now = nowIso(ctx);
  const day = saoPauloDate(ctx.clock.now());
  for (const investment of fetched.data ?? []) {
    const { id, statements: upsert } = mirror.upsert(
      investment.id,
      {
        item_id: item.id,
        type: investment.type ?? null,
        subtype: investment.subtype ?? null,
        name: investment.name ?? null,
        code: investment.code ?? null,
        status: investment.status ?? null,
        currency_code: investment.currencyCode ?? 'BRL',
        balance_cents: toCents(investment.balance),
        amount_cents: toCents(investment.amount),
        amount_profit_cents: toCents(investment.amountProfit),
        amount_withdrawal_cents: toCents(investment.amountWithdrawal),
        annual_rate: investment.annualRate ?? null,
        last_month_rate: investment.lastMonthRate ?? null,
        last_twelve_months_rate: investment.lastTwelveMonthsRate ?? null,
        due_date: investment.dueDate ?? null,
      },
      investment,
    );
    statements.push(...upsert);
    stored.push({ id, pluggyId: investment.id });
    if (options.snapshot) {
      statements.push(
        statement(
          `INSERT INTO investment_snapshots (investment_id, date, balance_cents, amount_cents, amount_withdrawal_cents, captured_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (investment_id, date) DO UPDATE SET balance_cents = excluded.balance_cents, amount_cents = excluded.amount_cents,
             amount_withdrawal_cents = excluded.amount_withdrawal_cents, captured_at = excluded.captured_at`,
          id,
          day,
          toCents(investment.balance),
          toCents(investment.amount),
          toCents(investment.amountWithdrawal),
          now,
        ),
      );
    }
  }
  await ctx.sql.batch(statements);

  let movements = 0;
  for (const investment of stored) {
    const list = await pluggyPages<{ id: string; date?: string; tradeDate?: string; type?: string; movementType?: string; description?: string; amount?: number; value?: number; quantity?: number }>(
      ctx,
      `/investments/${investment.pluggyId}/transactions`,
      {},
      item.id,
    );
    const batch = compact([availability(ctx, item, 'investment_transactions', list)]);
    const movementsMirror = await Mirror.load(ctx, { table: 'investment_transactions', key: 'pluggy_id', scope: ['investment_id', investment.id] });
    for (const movement of list.data ?? []) {
      batch.push(
        ...movementsMirror.upsert(
          movement.id,
          {
            investment_id: investment.id,
            date: movement.date ?? null,
            trade_date: movement.tradeDate ?? null,
            type: movement.type ?? null,
            movement_type: movement.movementType ?? null,
            description: movement.description ?? null,
            amount_cents: toCents(movement.amount),
            value_cents: toCents(movement.value),
            quantity: movement.quantity ?? null,
          },
          movement,
        ).statements,
      );
    }
    await ctx.sql.batch(batch);
    movements += list.data?.length ?? 0;
  }
  return { investments: stored.length, movements };
}

export async function readLoans(ctx: Context, item: PluggyItem): Promise<number> {
  const fetched = await pluggyPages<{
    id: string;
    productName?: string;
    type?: string;
    currencyCode?: string;
    contractAmount?: number;
    CET?: number;
    payments?: { contractOutstandingBalance?: number } | null;
  }>(ctx, '/loans', { itemId: item.id }, item.id);
  const statements = compact([availability(ctx, item, 'loans', fetched)]);
  const mirror = await Mirror.load(ctx, { table: 'loans', key: 'pluggy_id', scope: ['item_id', item.id] });
  for (const loan of fetched.data ?? []) {
    statements.push(
      ...mirror.upsert(
        loan.id,
        {
          item_id: item.id,
          product_name: loan.productName ?? null,
          type: loan.type ?? null,
          currency_code: loan.currencyCode ?? null,
          contract_amount_cents: toCents(loan.contractAmount),
          outstanding_balance_cents: toCents(loan.payments?.contractOutstandingBalance),
          cet: loan.CET ?? null,
        },
        loan,
      ).statements,
    );
  }
  await ctx.sql.batch(statements);
  return fetched.data?.length ?? 0;
}

/** Identity data: a new version only when something in it changed. */
export async function readIdentity(ctx: Context, item: PluggyItem): Promise<void> {
  const fetched = await pluggyGet<unknown>(ctx, '/identity', { itemId: item.id }, item.id);
  const statements = compact([availability(ctx, item, 'identity', fetched)]);
  if (fetched.data) statements.push(...(await newVersion(ctx, 'identity', item.id, fetched.data)));
  await ctx.sql.batch(statements);
}

/** The SCR report (Banco Central): monthly, and "não disponível" when Pluggy does not release it. */
export async function readScr(ctx: Context, item: PluggyItem): Promise<void> {
  const fetched = await pluggyGet<unknown>(ctx, `/items/${item.id}/scr`, {}, item.id);
  const statements = compact([availability(ctx, item, 'scr', fetched)]);
  if (fetched.data) statements.push(...(await newVersion(ctx, 'scr_reports', item.id, fetched.data)));
  statements.push(statement('UPDATE items SET scr_checked_at = ? WHERE item_id = ?', nowIso(ctx), item.id));
  await ctx.sql.batch(statements);
}

/** Pluggy's category tree, the same for every connection. */
export async function readCategories(ctx: Context): Promise<number> {
  const fetched = await pluggyPages<{ id: string; description?: string; descriptionTranslated?: string; parentId?: string }>(ctx, '/categories', {}, null);
  if (!fetched.data) throw new PluggyUnavailable('categories', fetched.status);
  const now = nowIso(ctx);
  await ctx.sql.batch(
    fetched.data.map((category) =>
      statement(
        `INSERT INTO pluggy_categories (id, description, description_translated, parent_id, raw_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET description = excluded.description, description_translated = excluded.description_translated,
           parent_id = excluded.parent_id, raw_json = excluded.raw_json, last_seen_at = excluded.last_seen_at`,
        category.id,
        category.description ?? null,
        category.descriptionTranslated ?? null,
        category.parentId ?? null,
        JSON.stringify(category),
        now,
        now,
      ),
    ),
  );
  return fetched.data.length;
}

async function newVersion(ctx: Context, table: 'identity' | 'scr_reports', itemId: string, data: unknown): Promise<Statement[]> {
  const rawJson = JSON.stringify(data);
  const hash = await sha256(rawJson);
  const [latest] = await ctx.sql.all<{ sha256: string }>(`SELECT sha256 FROM ${table} WHERE item_id = ? ORDER BY collected_at DESC LIMIT 1`, itemId);
  if (latest?.sha256 === hash) return [];
  return [statement(`INSERT INTO ${table} (id, item_id, sha256, raw_json, collected_at) VALUES (?, ?, ?, ?, ?)`, ctx.ids.next(), itemId, hash, rawJson, nowIso(ctx))];
}

function compact(statements: (Statement | null)[]): Statement[] {
  return statements.filter((s): s is Statement => s !== null);
}
