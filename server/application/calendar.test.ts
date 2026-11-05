import { describe, expect, it } from 'vitest';
import type { CalendarView } from '../../src/application/api-contract';
import { testContext } from '../testing/node-sql';
import { AppService } from './app-service';
import { NO_CALLER } from './lock';
import { statement } from './ports';

const NOW = '2026-11-02T12:00:00Z'; // the test clock: 2 Nov 2026, 9h in Brasília

async function seed() {
  const { ctx, sql } = testContext(NOW);
  const account = (id: string, type: string) =>
    statement(
      'INSERT INTO accounts (id, pluggy_id, item_id, type, name, currency_code, raw_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      `p-${id}`,
      'item',
      type,
      type === 'CREDIT' ? 'Cartão' : 'Conta',
      'BRL',
      '{}',
      NOW,
      NOW,
    );
  let n = 0;
  const transaction = (accountId: string, date: string, deletedAt: string | null = null) =>
    statement(
      'INSERT INTO transactions (id, pluggy_id, account_id, match_key, date, amount_cents, currency_code, deleted_at, raw_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      `t${++n}`,
      `pt${n}`,
      accountId,
      `k${n}`,
      date,
      100,
      'BRL',
      deletedAt,
      '{}',
      NOW,
      NOW,
    );
  await sql.batch([
    statement('INSERT INTO items (item_id, registered_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', 'item', NOW, NOW, NOW),
    account('card', 'CREDIT'),
    account('bank', 'BANK'),
    transaction('bank', '2026-11-01T00:00:00.000Z'),
    transaction('bank', '2026-11-01T03:00:00.000Z'),
    transaction('bank', '2026-11-02T01:00:00.000Z'), // 22h of 1 Nov in Brasília
    transaction('bank', '2026-10-30T00:00:00.000Z', NOW), // deleted by Pluggy
    transaction('bank', '2025-11-01T00:00:00.000Z'), // before the 12 months
    transaction('card', '2026-10-31T00:00:00.000Z'),
  ]);
  return { service: new AppService(ctx), sql };
}

async function read(service: AppService): Promise<CalendarView> {
  const result = await service.query('calendar', { itemId: 'item' }, NO_CALLER);
  if (!result.ok) throw new Error(result.error);
  return result.value as CalendarView;
}

describe('Cofre calendar', () => {
  it('counts each account’s transactions per Brasília day over the last 12 months', async () => {
    const { service } = await seed();
    const view = await read(service);
    expect(view.from).toBe('2025-11-02');
    expect(view.to).toBe('2026-11-02');
    expect(view.accounts.map((a) => a.id)).toEqual(['bank', 'card']);
    expect(view.accounts[0]?.counts).toEqual({ '2026-11-01': 3 });
    expect(view.accounts[1]?.counts).toEqual({ '2026-10-31': 1 });
  });

  it('keeps the empty days the owner confirmed, and undoes them', async () => {
    const { service } = await seed();
    const confirm = (day: string, confirmed: boolean) => service.command('day.confirmEmpty', { accountId: 'bank', day, confirmed }, NO_CALLER);
    expect(await confirm('2026-10-30', true)).toEqual({ ok: true, value: null, changed: ['vault'] });
    expect(await confirm('2026-10-30', true)).toMatchObject({ ok: true });
    expect((await read(service)).accounts[0]?.confirmedEmpty).toEqual(['2026-10-30']);
    await confirm('2026-10-30', false);
    expect((await read(service)).accounts[0]?.confirmedEmpty).toEqual([]);
  });

  it('refuses a bad day, a future day and an unknown account', async () => {
    const { service } = await seed();
    expect(await service.command('day.confirmEmpty', { accountId: 'bank', day: '30/10', confirmed: true }, NO_CALLER)).toEqual({ ok: false, error: 'invalid' });
    expect(await service.command('day.confirmEmpty', { accountId: 'bank', day: '2026-11-03', confirmed: true }, NO_CALLER)).toEqual({ ok: false, error: 'invalid' });
    expect(await service.command('day.confirmEmpty', { accountId: 'x', day: '2026-10-30', confirmed: true }, NO_CALLER)).toEqual({ ok: false, error: 'not_found' });
    expect(await service.query('calendar', { itemId: 'x' }, NO_CALLER)).toEqual({ ok: false, error: 'not_found' });
  });
});
