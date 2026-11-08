import { describe, expect, it } from 'vitest';
import type { CartaoView } from '../../src/application/api-contract';
import { testContext } from '../testing/node-sql';
import { AppService } from './app-service';
import { NO_CALLER } from './lock';
import { statement } from './ports';

const NOW = '2026-11-07T12:00:00Z';

async function seed() {
  const { ctx, sql } = testContext(NOW);
  const account = (id: string, type: string, name: string) =>
    statement(
      'INSERT INTO accounts (id, pluggy_id, item_id, type, name, currency_code, raw_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      `p-${id}`,
      'item',
      type,
      name,
      'BRL',
      '{}',
      NOW,
      NOW,
    );
  const bill = (id: string, due: string, totalCents: number, lastSeen = NOW) =>
    statement(
      `INSERT INTO bills (id, pluggy_id, account_id, due_date, total_amount_cents, currency_code, raw_json, first_seen_at, last_seen_at)
       VALUES (?, ?, 'card', ?, ?, 'BRL', '{}', ?, ?)`,
      id,
      `p-${id}`,
      `${due}T00:00:00.000Z`,
      totalCents,
      NOW,
      lastSeen,
    );
  const transaction = (
    id: string,
    accountId: string,
    day: string,
    amountCents: number,
    extra: { type?: string; billId?: string; cardPayment?: boolean; deleted?: boolean } = {},
  ) =>
    statement(
      `INSERT INTO transactions (id, pluggy_id, account_id, match_key, date, amount_cents, currency_code, type, status, description,
         bill_id, card_payment, deleted_at, raw_json, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, 'BRL', ?, 'POSTED', ?, ?, ?, ?, '{}', ?, ?)`,
      id,
      `p-${id}`,
      accountId,
      `k-${id}`,
      `${day}T12:00:00.000Z`,
      amountCents,
      extra.type ?? null,
      id,
      extra.billId ? `p-${extra.billId}` : null,
      extra.cardPayment ? 1 : 0,
      extra.deleted ? NOW : null,
      NOW,
      NOW,
    );
  const installments = (id: string, total: number) =>
    statement('INSERT INTO transaction_card_data (transaction_id, installment_number, total_installments) VALUES (?, 1, ?)', id, total);
  const payment = (id: string, day: string, cents: number, deleted = false) =>
    transaction(id, 'bank', day, -cents, { type: 'DEBIT', cardPayment: true, deleted });

  await sql.batch([
    statement('INSERT INTO items (item_id, registered_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', 'item', NOW, NOW, NOW),
    account('bank', 'BANK', 'Conta'),
    account('card', 'CREDIT', 'Nubank'),
    bill('velha', '2025-09-10', 1000),
    bill('set', '2026-09-10', 100000),
    bill('out', '2026-10-10', 50000),
    bill('nov', '2026-11-10', 120000),
    // The same bill, read by the connection before it was renewed.
    bill('nov-antiga', '2026-11-10', 999, '2026-10-01T00:00:00Z'),
    transaction('mercado', 'card', '2026-08-05', 60000, { type: 'DEBIT', billId: 'set' }),
    transaction('geladeira', 'card', '2026-08-06', 40000, { type: 'DEBIT', billId: 'set' }),
    installments('geladeira', 10),
    transaction('farmacia', 'card', '2026-09-05', 50000, { type: 'DEBIT', billId: 'out' }),
    transaction('viagem', 'card', '2026-10-05', 100000, { type: 'DEBIT', billId: 'nov' }),
    transaction('curso', 'card', '2026-10-06', 25000, { type: 'DEBIT', billId: 'nov-antiga' }),
    installments('curso', 5),
    transaction('estorno', 'card', '2026-10-07', 5000, { type: 'CREDIT', billId: 'nov' }),
    transaction('recebido', 'card', '2026-10-20', 40000, { type: 'CREDIT', cardPayment: true }),
    transaction('padaria', 'card', '2026-11-03', 4590, { type: 'DEBIT' }),
    payment('pg-velha', '2025-09-09', 1000),
    payment('pg-set', '2026-09-09', 100000),
    payment('pg-out', '2026-10-09', 49999),
    payment('adiantamento', '2026-10-20', 40000),
    payment('apagado', '2026-10-25', 80000, true),
    transaction('mercado-conta', 'bank', '2026-10-21', -3000, { type: 'DEBIT' }),
  ]);
  return new AppService(ctx);
}

async function view(): Promise<CartaoView> {
  const result = await (await seed()).query('cartao', {}, NO_CALLER);
  if (!result.ok) throw new Error(result.error);
  return result.value as CartaoView;
}

describe('cartao', () => {
  it('lists the open bill and the last 12 months, newest first, one per due date', async () => {
    const { bills } = await view();
    expect(bills.map((b) => [b.id, b.status])).toEqual([
      ['aberta-card', 'aberta'],
      ['nov', 'a-pagar'],
      ['out', 'paga'],
      ['set', 'paga'],
    ]);
  });

  it('links the advance to the bill still open when it was made', async () => {
    const nov = (await view()).bills.find((b) => b.id === 'nov')!;
    expect(nov.payments).toEqual([{ id: 'adiantamento', day: '2026-10-20', amountCents: 40000, accountName: 'Conta' }]);
    expect(nov.paidCents).toBe(40000);
    expect(nov.differenceCents).toBe(-80000);
  });

  it('accepts a payment one cent short', async () => {
    const out = (await view()).bills.find((b) => b.id === 'out')!;
    expect(out.payments.map((p) => p.id)).toEqual(['pg-out']);
    expect(out.differenceCents).toBe(-1);
  });

  it('adds up the installments and the purchase days, across both records of a renewed bill', async () => {
    const { bills } = await view();
    const nov = bills.find((b) => b.id === 'nov')!;
    expect(nov.totalCents).toBe(120000);
    expect(nov.installmentCents).toBe(25000);
    expect([nov.firstDay, nov.lastDay]).toEqual(['2026-10-05', '2026-10-07']);
    expect(bills.find((b) => b.id === 'set')!.installmentCents).toBe(40000);
  });

  it('takes the purchases after the last closed bill as the open bill, without card payments', async () => {
    const open = (await view()).bills[0]!;
    expect(open).toMatchObject({ dueDay: null, totalCents: 4590, firstDay: '2026-11-03', accountName: 'Nubank', payments: [] });
  });
});
