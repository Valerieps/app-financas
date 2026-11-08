import { describe, expect, it } from 'vitest';
import { billStatus, matchPayments, paymentDifference, type BillForMatching, type PaymentForMatching } from './faturas';

const bill = (id: string, dueDay: string | null, totalCents: number | null, firstDay: string | null = null): BillForMatching => ({
  id,
  dueDay,
  totalCents,
  firstDay,
});
const pay = (id: string, day: string, amountCents: number): PaymentForMatching => ({ id, day, amountCents });
const ids = (map: Map<string, PaymentForMatching[]>, billId: string) => (map.get(billId) ?? []).map((p) => p.id);

describe('matchPayments', () => {
  it('links the payment after closing to the closed bill', () => {
    const bills = [bill('set', '2026-09-10', 100000, '2026-08-03'), bill('out', '2026-10-10', 50000, '2026-09-03')];
    const linked = matchPayments(bills, [pay('p1', '2026-09-09', 100000), pay('p2', '2026-10-10', 50000)]);
    expect(ids(linked, 'set')).toEqual(['p1']);
    expect(ids(linked, 'out')).toEqual(['p2']);
  });

  it('keeps an advance on the open bill, and the rest of it after closing', () => {
    const bills = [bill('out', '2026-10-10', 50000, '2026-09-03'), bill('nov', '2026-11-10', 120000, '2026-10-03')];
    const linked = matchPayments(bills, [pay('final-out', '2026-10-08', 50000), pay('adiantamento', '2026-10-20', 40000), pay('resto', '2026-11-09', 80000)]);
    expect(ids(linked, 'out')).toEqual(['final-out']);
    expect(ids(linked, 'nov')).toEqual(['adiantamento', 'resto']);
  });

  it('pays the oldest bill first when an advance comes before the closed bill is paid', () => {
    const bills = [bill('out', '2026-10-10', 50000, '2026-09-03'), bill('nov', '2026-11-10', 120000, '2026-10-03')];
    const linked = matchPayments(bills, [pay('a', '2026-10-05', 50000), pay('b', '2026-10-06', 30000)]);
    expect(ids(linked, 'out')).toEqual(['a']);
    expect(ids(linked, 'nov')).toEqual(['b']);
  });

  it('treats a bill short by one cent as paid and moves on', () => {
    const bills = [bill('out', '2026-10-10', 50001, '2026-09-03'), bill('nov', '2026-11-10', 1000, '2026-10-03')];
    const linked = matchPayments(bills, [pay('a', '2026-10-09', 50000), pay('b', '2026-11-09', 1000)]);
    expect(ids(linked, 'nov')).toEqual(['b']);
  });

  it('does not let a bill that never adds up take payments after the next bill is due', () => {
    const bills = [
      bill('set', '2026-09-10', 100000, '2026-08-03'),
      bill('out', '2026-10-10', 50000, '2026-09-03'),
      bill('nov', '2026-11-10', 70000, '2026-10-03'),
    ];
    // September was paid short; the payment of 9 Nov comes after October is due, so it skips
    // September and pays the oldest bill still open to it, October.
    const linked = matchPayments(bills, [pay('pouco', '2026-09-09', 90000), pay('depois', '2026-11-09', 50000)]);
    expect(ids(linked, 'set')).toEqual(['pouco']);
    expect(ids(linked, 'out')).toEqual(['depois']);
    expect(ids(linked, 'nov')).toEqual([]);
  });

  it('leaves out payments made before any bill started', () => {
    const linked = matchPayments([bill('nov', '2026-11-10', 1000, '2026-10-03')], [pay('antigo', '2026-01-05', 1000)]);
    expect(ids(linked, 'nov')).toEqual([]);
  });

  it('starts a bill with no purchases about a month before it is due', () => {
    const linked = matchPayments([bill('nov', '2026-11-10', 1000)], [pay('a', '2026-10-15', 1000), pay('b', '2026-09-01', 1000)]);
    expect(ids(linked, 'nov')).toEqual(['a']);
  });

  it('skips a bill whose value the bank did not send', () => {
    const linked = matchPayments([bill('x', '2026-10-10', null, '2026-09-03'), bill('nov', '2026-11-10', 1000, '2026-10-03')], [pay('a', '2026-10-20', 1000)]);
    expect(ids(linked, 'x')).toEqual([]);
    expect(ids(linked, 'nov')).toEqual(['a']);
  });
});

describe('billStatus', () => {
  const closed = { dueDay: '2026-11-10', totalCents: 100000 };

  it('is paid within one cent, either way', () => {
    expect(billStatus(closed, 100000, '2026-11-20')).toBe('paga');
    expect(billStatus(closed, 99999, '2026-11-20')).toBe('paga');
    expect(billStatus(closed, 100001, '2026-11-20')).toBe('paga');
  });

  it('is a pagar until the due date, then nao-bateu', () => {
    expect(billStatus(closed, 99998, '2026-11-10')).toBe('a-pagar');
    expect(billStatus(closed, 0, '2026-11-11')).toBe('nao-bateu');
    expect(billStatus(closed, 100002, '2026-11-11')).toBe('nao-bateu');
  });

  it('keeps the open bill aberta until it is paid', () => {
    expect(billStatus({ dueDay: null, totalCents: 5000 }, 0, '2026-11-20')).toBe('aberta');
    expect(billStatus({ dueDay: null, totalCents: 0 }, 0, '2026-11-20')).toBe('aberta');
    expect(billStatus({ dueDay: null, totalCents: 5000 }, 5000, '2026-11-20')).toBe('paga');
  });

  it('is paid when refunds left nothing to pay', () => {
    expect(billStatus({ dueDay: '2026-11-10', totalCents: -500 }, 0, '2026-11-20')).toBe('paga');
  });
});

describe('paymentDifference', () => {
  it('is negative when short and null without a value', () => {
    expect(paymentDifference(1000, 400)).toBe(-600);
    expect(paymentDifference(null, 400)).toBeNull();
  });
});
