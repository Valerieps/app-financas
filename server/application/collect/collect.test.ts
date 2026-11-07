import { describe, expect, it } from 'vitest';
import { fakePluggy, testContext } from '../../testing/node-sql';
import { accounts, CARD_ID, CHECKING_ID, item, ITEM_ID, page, RENEWED_ITEM_ID, routes, transaction } from '../../testing/pluggy-fixtures';
import { AppService } from '../app-service';
import { NO_CALLER } from '../lock';
import { syncItem } from './sync';
import { processPendingEvents, receivePluggyWebhook, processEvent } from './webhooks';

const WINDOW = 'dateFrom=2026-09-23';

async function registered(overrides: Record<string, unknown> = {}) {
  const pluggy = fakePluggy(routes(overrides));
  const test = testContext('2026-11-02T12:00:00Z', pluggy);
  const result = await new AppService(test.ctx).command('connection.add', { itemId: ITEM_ID }, NO_CALLER);
  expect(result).toEqual({ ok: true, value: { itemId: ITEM_ID }, changed: ['vault'] });
  await Promise.all(test.tasks);
  return { ...test, pluggy };
}

const rows = <T = Record<string, unknown>>(ctx: Awaited<ReturnType<typeof registered>>['ctx'], query: string, ...params: (string | number)[]) =>
  ctx.sql.all<T>(query, ...params);

describe('registering a connection', () => {
  it('refuses a malformed itemId, an unknown one and a repeated one', async () => {
    const { ctx } = testContext('2026-11-02T12:00:00Z', fakePluggy({}));
    const service = new AppService(ctx);
    expect(await service.command('connection.add', { itemId: 'abc' }, NO_CALLER)).toEqual({ ok: false, error: 'invalid' });
    expect(await service.command('connection.add', { itemId: ITEM_ID }, NO_CALLER)).toEqual({ ok: false, error: 'not_found' });
    expect(await ctx.sql.all('SELECT * FROM items')).toEqual([]);

    const { ctx: ctx2 } = await registered();
    expect(await new AppService(ctx2).command('connection.add', { itemId: ITEM_ID.toUpperCase() }, NO_CALLER)).toEqual({ ok: false, error: 'conflict' });
  });

  it('loads everything the connection offers, in cents, with the day in Brasília', async () => {
    const { ctx } = await registered();
    expect(await rows(ctx, 'SELECT status, consent_expires_at, last_synced_at FROM items')).toEqual([
      { status: 'UPDATED', consent_expires_at: '2027-10-01T00:00:00.000Z', last_synced_at: '2026-11-02T12:00:00.000Z' },
    ]);
    expect(await rows(ctx, 'SELECT type, number_suffix, balance_cents FROM accounts ORDER BY type')).toEqual([
      { type: 'BANK', number_suffix: '3456', balance_cents: 152035 },
      { type: 'CREDIT', number_suffix: '9876', balance_cents: 83010 },
    ]);
    expect(await rows(ctx, 'SELECT date, balance_cents FROM account_balance_snapshots ORDER BY balance_cents')).toEqual([
      { date: '2026-11-02', balance_cents: 83010 },
      { date: '2026-11-02', balance_cents: 150000 },
    ]);
    expect(await rows(ctx, 'SELECT pluggy_id, amount_cents, match_key FROM transactions ORDER BY pluggy_id')).toEqual([
      { pluggy_id: 'c1', amount_cents: 4590, match_key: 'p:prov-1' },
      { pluggy_id: 't1', amount_cents: -1250, match_key: 'f:2026-10-28|-1250|PADARIA EXEMPLO|0' },
      { pluggy_id: 't2', amount_cents: -8000, match_key: 'f:2026-10-28|-8000|MERCADO EXEMPLO|0' },
    ]);
    expect(await rows(ctx, 'SELECT installment_number, total_installments, payee_mcc FROM transaction_card_data')).toEqual([
      { installment_number: 1, total_installments: 3, payee_mcc: 5411 },
    ]);
    expect(await rows(ctx, 'SELECT COUNT(*) AS n FROM bills')).toEqual([{ n: 1 }]);
    expect(await rows(ctx, 'SELECT balance_cents FROM investment_snapshots')).toEqual([{ balance_cents: 100001 }]);
    expect(await rows(ctx, 'SELECT COUNT(*) AS n FROM investment_transactions')).toEqual([{ n: 1 }]);
    expect(await rows(ctx, 'SELECT COUNT(*) AS n FROM identity')).toEqual([{ n: 1 }]);
    expect(await rows(ctx, 'SELECT COUNT(*) AS n FROM pluggy_categories')).toEqual([{ n: 1 }]);
  });

  it('marks what the bank does not share as unavailable, not as an error', async () => {
    const { ctx } = await registered();
    expect(await rows(ctx, "SELECT product, available, detail FROM item_resources WHERE product IN ('loans', 'scr') ORDER BY product")).toEqual([
      { product: 'loans', available: 0, detail: 'HTTP 404' },
      { product: 'scr', available: 0, detail: 'HTTP 404' },
    ]);
    expect(await rows(ctx, 'SELECT error FROM sync_runs')).toEqual([{ error: null }]);
  });

  it('archives every Pluggy response before reading it', async () => {
    const { ctx, raw, pluggy } = await registered();
    const archived = await rows<{ r2_key: string; endpoint: string }>(ctx, 'SELECT r2_key, endpoint FROM raw_payloads');
    expect(archived).toHaveLength(pluggy.calls.length);
    for (const { r2_key: key } of archived) {
      expect(key).toMatch(/^pluggy-api\/2026\/11\/02\/20261102T120000\.000Z-[\w-]+\.json$/);
      expect(raw.objects.has(key)).toBe(true);
    }
  });
});

describe('the daily sweep', () => {
  it('marks a transaction that left Pluggy as deleted, keeps its version, and restores it when it returns', async () => {
    const { ctx, pluggy } = await registered();
    pluggy.routes[`/v2/transactions?accountId=${CHECKING_ID}&${WINDOW}`] = page([transaction('t1')]);
    pluggy.routes[`/v2/transactions?accountId=${CARD_ID}&${WINDOW}`] = page([]);
    expect(await syncItem(ctx, ITEM_ID, 'daily')).toBe(true);
    expect(await rows(ctx, 'SELECT pluggy_id, deleted_at FROM transactions ORDER BY pluggy_id')).toEqual([
      // An empty read of the card is not taken as "everything was deleted".
      { pluggy_id: 'c1', deleted_at: null },
      { pluggy_id: 't1', deleted_at: null },
      { pluggy_id: 't2', deleted_at: '2026-11-02T12:00:00.000Z' },
    ]);

    pluggy.routes[`/v2/transactions?accountId=${CHECKING_ID}&${WINDOW}`] = page([transaction('t1'), transaction('t2', { description: 'MERCADO EXEMPLO', amount: -80 })]);
    await syncItem(ctx, ITEM_ID, 'daily');
    expect(await rows(ctx, "SELECT deleted_at FROM transactions WHERE pluggy_id = 't2'")).toEqual([{ deleted_at: null }]);
    expect(await rows(ctx, 'SELECT COUNT(*) AS n FROM transaction_versions')).toEqual([{ n: 2 }]);
  });

  it('never marks anything deleted while the connection is in error', async () => {
    const { ctx, pluggy } = await registered();
    pluggy.routes[`/items/${ITEM_ID}`] = item(ITEM_ID, { status: 'LOGIN_ERROR', error: { code: 'USER_AUTHORIZATION_EXPIRED', message: 'expirou' } });
    pluggy.routes[`/v2/transactions?accountId=${CHECKING_ID}&${WINDOW}`] = page([transaction('t1')]);
    pluggy.routes[`/v2/transactions?accountId=${CARD_ID}&${WINDOW}`] = page([]);
    await syncItem(ctx, ITEM_ID, 'daily');
    expect(await rows(ctx, 'SELECT COUNT(*) AS n FROM transactions WHERE deleted_at IS NOT NULL')).toEqual([{ n: 0 }]);
  });

  it('runs once a day, from 7h in Brasília', async () => {
    const { ctx, clock } = await registered();
    const service = new AppService(ctx);
    const dailyRuns = async () => (await rows<{ n: number }>(ctx, "SELECT COUNT(*) AS n FROM sync_runs WHERE kind = 'daily'"))[0].n;
    clock.set('2026-11-03T09:55:00Z'); // 6h55 in Brasília
    await service.tick();
    expect(await dailyRuns()).toBe(0);
    clock.set('2026-11-03T10:00:00Z');
    await service.tick();
    clock.set('2026-11-03T10:05:00Z');
    await service.tick();
    expect(await dailyRuns()).toBe(1);
  });
});

describe('one transaction, one record', () => {
  it('recognizes a card transaction recreated with a new id by its providerId', async () => {
    const { ctx, pluggy } = await registered();
    const [{ id }] = await rows<{ id: string }>(ctx, "SELECT id FROM transactions WHERE pluggy_id = 'c1'");
    pluggy.routes[`/v2/transactions?accountId=${CHECKING_ID}&${WINDOW}`] = page([transaction('t1'), transaction('t2', { description: 'MERCADO EXEMPLO', amount: -80 })]);
    pluggy.routes[`/v2/transactions?accountId=${CARD_ID}&${WINDOW}`] = page([
      transaction('c1-new', { accountId: CARD_ID, providerId: 'prov-1', description: 'LOJA EXEMPLO LTDA', amount: 45.9 }),
    ]);
    await syncItem(ctx, ITEM_ID, 'daily');
    expect(await rows(ctx, "SELECT id, pluggy_id, description, deleted_at FROM transactions WHERE account_id = (SELECT id FROM accounts WHERE pluggy_id = ?)", CARD_ID)).toEqual([
      { id, pluggy_id: 'c1-new', description: 'LOJA EXEMPLO LTDA', deleted_at: null },
    ]);
    expect(await rows(ctx, 'SELECT COUNT(*) AS n FROM transaction_versions WHERE transaction_id = ?', id)).toEqual([{ n: 1 }]);
  });

  it('recognizes it by date, amount and description when there is no providerId', async () => {
    const { ctx, pluggy } = await registered();
    pluggy.routes[`/v2/transactions?accountId=${CHECKING_ID}&${WINDOW}`] = page([
      transaction('t1-new'),
      transaction('t2', { description: 'MERCADO EXEMPLO', amount: -80 }),
    ]);
    await syncItem(ctx, ITEM_ID, 'daily');
    expect(await rows(ctx, "SELECT COUNT(*) AS n FROM transactions WHERE description = 'PADARIA EXEMPLO'")).toEqual([{ n: 1 }]);
    expect(await rows(ctx, "SELECT pluggy_id FROM transactions WHERE description = 'PADARIA EXEMPLO'")).toEqual([{ pluggy_id: 't1-new' }]);
  });

  it('links a renewed connection to the same accounts and transactions, and marks the old one replaced', async () => {
    const { ctx, pluggy } = await registered();
    const ids = { checking: 'acc-checking-2', card: 'acc-card-2' };
    Object.assign(pluggy.routes, {
      [`/items/${RENEWED_ITEM_ID}`]: item(RENEWED_ITEM_ID),
      [`/consents?itemId=${RENEWED_ITEM_ID}&page=1&pageSize=500`]: { page: 1, total: 0, totalPages: 1, results: [] },
      [`/accounts?itemId=${RENEWED_ITEM_ID}&page=1&pageSize=500`]: accounts(RENEWED_ITEM_ID, ids),
      [`/v2/transactions?accountId=${ids.checking}`]: page([transaction('n1'), transaction('n2', { description: 'MERCADO EXEMPLO', amount: -80 })]),
      [`/v2/transactions?accountId=${ids.card}`]: page([transaction('nc1', { accountId: ids.card, providerId: 'prov-1', description: 'LOJA EXEMPLO', amount: 45.9 })]),
    });
    const service = new AppService(ctx);
    expect((await service.command('connection.add', { itemId: RENEWED_ITEM_ID }, NO_CALLER)).ok).toBe(true);
    await syncItem(ctx, RENEWED_ITEM_ID, 'initial');

    expect(await rows(ctx, 'SELECT COUNT(*) AS n FROM accounts')).toEqual([{ n: 2 }]);
    expect(await rows(ctx, 'SELECT COUNT(*) AS n FROM transactions')).toEqual([{ n: 3 }]);
    expect(await rows(ctx, 'SELECT item_id, replaced_by FROM items ORDER BY item_id')).toEqual([
      { item_id: ITEM_ID, replaced_by: RENEWED_ITEM_ID },
      { item_id: RENEWED_ITEM_ID, replaced_by: null },
    ]);
    const view = await service.query('vault', {}, NO_CALLER);
    expect(view.ok && view.value).toMatchObject({
      connections: [
        { itemId: RENEWED_ITEM_ID, replacedBy: null, counts: { accounts: 2, transactions: 3, deletedTransactions: 0 } },
        { itemId: ITEM_ID, replacedBy: RENEWED_ITEM_ID, counts: { accounts: 0, transactions: 0 } },
      ],
    });
  });
});

describe('the Pluggy webhook', () => {
  const event = (eventId: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ event: 'transactions/deleted', eventId, itemId: ITEM_ID, accountId: CHECKING_ID, transactionIds: ['t2'], ...extra });

  it('stores the raw body, ignores a repeated eventId and re-reads the account', async () => {
    const { ctx, pluggy } = await registered();
    pluggy.routes[`/v2/transactions?accountId=${CHECKING_ID}&${WINDOW}`] = page([transaction('t1')]);

    const first = await receivePluggyWebhook(ctx, event('evt-1'));
    expect(first).toEqual({ status: 'new', eventId: 'evt-1' });
    expect(await receivePluggyWebhook(ctx, event('evt-1'))).toEqual({ status: 'duplicate' });
    expect(await rows(ctx, "SELECT COUNT(*) AS n FROM raw_payloads WHERE source = 'pluggy-webhook'")).toEqual([{ n: 2 }]);

    await processEvent(ctx, 'evt-1');
    expect(await rows(ctx, "SELECT deleted_at FROM transactions WHERE pluggy_id = 't2'")).toEqual([{ deleted_at: '2026-11-02T12:00:00.000Z' }]);
    expect(await rows<{ processed_at: string | null }>(ctx, "SELECT processed_at FROM webhook_events WHERE event_id = 'evt-1'")).toEqual([
      { processed_at: '2026-11-02T12:00:00.000Z' },
    ]);
  });

  it('keeps an unreadable body in the archive and refuses it', async () => {
    const { ctx } = testContext();
    expect(await receivePluggyWebhook(ctx, 'not json')).toEqual({ status: 'invalid' });
    expect(await ctx.sql.all('SELECT source FROM raw_payloads')).toEqual([{ source: 'pluggy-webhook' }]);
  });

  it('leaves a failed event for the cron, which retries it', async () => {
    const { ctx, pluggy, clock } = await registered();
    pluggy.routes[`/v2/transactions?accountId=${CHECKING_ID}&${WINDOW}`] = { status: 500, body: '{}' };
    await receivePluggyWebhook(ctx, event('evt-2'));
    await processEvent(ctx, 'evt-2');
    expect(await rows(ctx, "SELECT processed_at, attempts, last_error FROM webhook_events WHERE event_id = 'evt-2'")).toEqual([
      { processed_at: null, attempts: 1, last_error: 'sync falhou' },
    ]);

    pluggy.routes[`/v2/transactions?accountId=${CHECKING_ID}&${WINDOW}`] = page([transaction('t1')]);
    clock.set('2026-11-02T12:10:00Z');
    await processPendingEvents(ctx);
    expect(await rows(ctx, "SELECT attempts, last_error FROM webhook_events WHERE event_id = 'evt-2' AND processed_at IS NOT NULL")).toEqual([
      { attempts: 2, last_error: null },
    ]);
  });

  it('records events about unknown connections without touching anything', async () => {
    const { ctx } = testContext();
    const received = await receivePluggyWebhook(ctx, event('evt-3'));
    expect(received.status).toBe('new');
    await processEvent(ctx, 'evt-3');
    expect(await ctx.sql.all("SELECT processed_at IS NOT NULL AS done FROM webhook_events")).toEqual([{ done: 1 }]);
  });
});

describe('the Cofre view', () => {
  it('shows status, consent expiry, counts and what the bank did not share', async () => {
    const { ctx } = await registered();
    const view = await new AppService(ctx).query('vault', {}, NO_CALLER);
    expect(view).toEqual({
      ok: true,
      value: {
        connections: [
          {
            itemId: ITEM_ID,
            institution: 'Banco Exemplo',
            status: 'UPDATED',
            errorCode: null,
            errorMessage: null,
            lastSyncedAt: '2026-11-02T12:00:00.000Z',
            consentExpiresAt: '2027-10-01T00:00:00.000Z',
            replacedBy: null,
            lastError: null,
            counts: { accounts: 2, transactions: 3, deletedTransactions: 0, bills: 1, investments: 1 },
            unavailable: ['loans', 'scr'],
            investments: [{ id: expect.any(String), name: 'CDB Exemplo', issuerCnpj: null, balanceCents: 100001, currency: 'BRL' }],
          },
        ],
        pending: [],
      },
    });
  });

  it('shows the last failed read until one works', async () => {
    const { ctx, pluggy, clock } = await registered();
    pluggy.routes['/accounts'] = { status: 503, body: '{}' };
    clock.set('2026-11-02T13:00:00Z');
    await syncItem(ctx, ITEM_ID, 'webhook');
    const view = await new AppService(ctx).query('vault', {}, NO_CALLER);
    expect(view.ok && (view.value as { connections: { lastError: unknown }[] }).connections[0].lastError).toEqual({
      at: '2026-11-02T13:00:00.000Z',
      message: 'Pluggy accounts answered 503',
    });
  });
});
