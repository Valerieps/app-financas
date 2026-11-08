import { describe, expect, it } from 'vitest';
import type { CategoryChart, MonthlyChart } from '../../src/domain/spending';
import { testContext } from '../testing/node-sql';
import { AppService } from './app-service';
import { NO_CALLER } from './lock';
import { statement } from './ports';

const NOW = '2026-11-07T15:00:00Z';

async function setUp(extra: ReturnType<typeof statement>[] = []) {
  const { ctx, sql } = testContext(NOW);
  const account = (id: string, item: string, type: string, currency = 'BRL') =>
    statement(
      'INSERT INTO accounts (id, pluggy_id, item_id, type, currency_code, raw_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      `p-${id}`,
      item,
      type,
      currency,
      '{}',
      NOW,
      NOW,
    );
  let n = 0;
  const tx = (accountId: string, date: string, cents: number, type: string, category: string | null, deleted = false) =>
    statement(
      `INSERT INTO transactions (id, pluggy_id, account_id, match_key, date, amount_cents, currency_code, pluggy_category_id, type, deleted_at, raw_json, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, 'BRL', ?, ?, ?, '{}', ?, ?)`,
      `t${++n}`,
      `pt${n}`,
      accountId,
      `k${n}`,
      date,
      cents,
      category,
      type,
      deleted ? NOW : null,
      NOW,
      NOW,
    );
  await sql.batch([
    statement('INSERT INTO items (item_id, registered_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', 'nu', NOW, NOW, NOW),
    statement('INSERT INTO items (item_id, registered_at, replaced_by, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?)', 'old', NOW, 'nu', NOW, NOW),
    account('conta', 'nu', 'BANK'),
    account('cartao', 'nu', 'CREDIT'),
    account('velha', 'old', 'BANK'),
    account('wise', 'nu', 'BANK', 'USD'),
    // November, up to today (the 7th)
    tx('cartao', '2026-11-03T22:30:00.000Z', 18640, 'DEBIT', '11010000'),
    tx('conta', '2026-11-05', -41230, 'DEBIT', '10000000'),
    tx('conta', '2026-11-05', -100000, 'DEBIT', '03020000'), // investment
    tx('conta', '2026-11-06', 500000, 'CREDIT', '01010000'), // salary
    tx('cartao', '2026-11-06', -80000, 'CREDIT', '05100000'), // bill paid
    tx('cartao', '2026-11-06', -2000, 'CREDIT', '11010000'), // refund
    tx('conta', '2026-11-04', -9999, 'DEBIT', '10000000', true), // deleted
    tx('velha', '2026-11-04', -9999, 'DEBIT', '10000000'), // replaced connection
    tx('wise', '2026-11-04', -9999, 'DEBIT', '10000000'), // another currency
    // October: up to the 7th and after
    tx('cartao', '2026-10-07', 12000, 'DEBIT', '11020000'),
    tx('cartao', '2026-10-08', 50000, 'DEBIT', '11020000'),
  ]);
  if (extra.length > 0) await sql.batch(extra);
  return new AppService(ctx);
}

async function query<T>(service: AppService, name: string, input: unknown): Promise<T> {
  const result = await service.query(name, input, NO_CALLER);
  if (!result.ok) throw new Error(result.error);
  return result.value as T;
}

describe('spendingByCategory', () => {
  it('sums the month gastos per categoria and compares them with the month before, up to today', async () => {
    const service = await setUp();
    const chart = await query<CategoryChart>(service, 'spendingByCategory', { month: '2026-11', compare: 'previous' });
    expect(chart).toEqual({
      month: '2026-11',
      throughDay: 7,
      compare: 'previous',
      compareMonths: ['2026-10'],
      rows: [
        { category: 'mercado', cents: 41230, baselineCents: 0 },
        { category: 'restaurante', cents: 16640, baselineCents: 12000 },
      ],
      totalCents: 57870,
      baselineTotalCents: 12000,
    });
  });

  it('counts the category I chose over Pluggy’s, including what is not a gasto', async () => {
    const category = (id: string) =>
      statement("INSERT INTO pluggy_categories (id, raw_json, first_seen_at, last_seen_at) VALUES (?, '{}', ?, ?)", id, NOW, NOW);
    const choose = (transactionId: string, categoryId: string) =>
      statement('INSERT INTO transaction_categories (transaction_id, pluggy_category_id, chosen_at) VALUES (?, ?, ?)', transactionId, categoryId, NOW);
    const service = await setUp([category('19000000'), category('05100000'), choose('t2', '19000000'), choose('t1', '05100000')]);
    const chart = await query<CategoryChart>(service, 'spendingByCategory', { month: '2026-11', compare: 'previous' });
    expect(chart.rows).toEqual([
      { category: 'transporte', cents: 41230, baselineCents: 0 },
      { category: 'restaurante', cents: -2000, baselineCents: 12000 },
    ]);
  });

  it('refuses a malformed month or comparison', async () => {
    const service = await setUp();
    expect(await service.query('spendingByCategory', { month: '2026-13', compare: 'average' }, NO_CALLER)).toEqual({ ok: false, error: 'invalid' });
    expect(await service.query('spendingByCategory', { month: '2026-11', compare: 'year' }, NO_CALLER)).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('spendingByMonth', () => {
  it('sums the 12 months ending at the selected one', async () => {
    const service = await setUp();
    const chart = await query<MonthlyChart>(service, 'spendingByMonth', { month: '2026-11' });
    expect(chart.months.slice(-2)).toEqual([
      { month: '2026-10', cents: 62000 },
      { month: '2026-11', cents: 57870 },
    ]);
    expect(chart.partial).toBe(true);
    expect(chart.averageCents).toBe(62000);
  });
});
