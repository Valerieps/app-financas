import { describe, expect, it } from 'vitest';
import type { ProvisionalExpenseView } from '../../src/application/api-contract';
import { testContext } from '../testing/node-sql';
import { AppService } from './app-service';
import { NO_CALLER } from './lock';
import { postedAt, receiveNotification } from './notifications';

const body = (text: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ app: 'com.nu.production', title: 'Compra aprovada', text, ...extra });
const PURCHASE = 'Compra no cartão de crédito aprovada no valor de R$ 42,90 no estabelecimento MERCADO BOM';

async function list(service: AppService): Promise<ProvisionalExpenseView[]> {
  const result = await service.query('provisionalExpenses', {}, NO_CALLER);
  if (!result.ok) throw new Error(result.error);
  return result.value as ProvisionalExpenseView[];
}

describe('the notification webhook', () => {
  it('stores the raw body first and creates a provisional expense', async () => {
    const { ctx, sql, raw } = testContext();
    expect(await receiveNotification(ctx, body(PURCHASE, { postedAt: 1793620800 }))).toBe('stored');

    expect([...raw.objects.values()]).toEqual([body(PURCHASE, { postedAt: 1793620800 })]);
    expect(await sql.all("SELECT source, endpoint FROM raw_payloads")).toEqual([
      { source: 'notification-webhook', endpoint: 'POST /webhooks/notification' },
    ]);
    expect(await list(new AppService(ctx))).toEqual([
      {
        id: expect.any(String),
        source: 'nubank',
        kind: 'card',
        amountCents: 4290,
        currency: 'BRL',
        merchant: 'MERCADO BOM',
        at: '2026-11-02T12:00:00.000Z',
        status: 'provisional',
        text: null,
      },
    ]);
  });

  it('counts a repeated notification once, but the same purchase again later twice', async () => {
    const { ctx, sql, clock } = testContext();
    await receiveNotification(ctx, body(PURCHASE));
    clock.set('2026-11-02T12:01:00Z');
    expect(await receiveNotification(ctx, body(PURCHASE))).toBe('duplicate');
    clock.set('2026-11-02T12:05:00Z');
    expect(await receiveNotification(ctx, body(PURCHASE))).toBe('stored');

    expect(await sql.all('SELECT COUNT(*) AS n FROM provisional_expenses')).toEqual([{ n: 2 }]);
    expect(await sql.all('SELECT COUNT(*) AS n FROM raw_payloads')).toEqual([{ n: 3 }]);
  });

  it('keeps only the raw body of what is not an expense, or not a notification', async () => {
    const { ctx, sql } = testContext();
    expect(await receiveNotification(ctx, body('Você recebeu um Pix de R$ 100,00'))).toBe('ignored');
    expect(await receiveNotification(ctx, 'not json')).toBe('invalid');
    expect(await receiveNotification(ctx, JSON.stringify({ app: 'x' }))).toBe('invalid');

    expect(await sql.all('SELECT COUNT(*) AS n FROM provisional_expenses')).toEqual([{ n: 0 }]);
    expect(await sql.all('SELECT COUNT(*) AS n FROM raw_payloads')).toEqual([{ n: 3 }]);
  });

  it('lists an unreadable purchase with its text and no amount', async () => {
    const { ctx } = testContext();
    await receiveNotification(ctx, body('Sua compra em LOJA X foi aprovada'));
    expect(await list(new AppService(ctx))).toMatchObject([
      { status: 'unreadable', amountCents: null, currency: null, text: 'Sua compra em LOJA X foi aprovada' },
    ]);
  });

  it('reads the time MacroDroid sends in seconds, milliseconds or ISO', () => {
    expect(postedAt(1793620800)).toBe('2026-11-02T12:00:00.000Z');
    expect(postedAt('1793620800000')).toBe('2026-11-02T12:00:00.000Z');
    expect(postedAt('2026-11-02T09:00:00-03:00')).toBe('2026-11-02T12:00:00.000Z');
    expect(postedAt('ontem')).toBeNull();
    expect(postedAt(undefined)).toBeNull();
  });
});
