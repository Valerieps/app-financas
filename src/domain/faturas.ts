// Finanças › Cartão (docs/spec/cartao-de-credito.md): which bill each card payment pays, and
// whether each bill is paid. Pure rules; the server reads the vault and calls them.
import { addDays } from './vault';

/** A bill is paid when its payments add up to its value within this many cents. */
export const PAYMENT_TOLERANCE_CENTS = 1;

/** How many months back the Cartão screen goes. */
export const BILL_MONTHS = 12;

/**
 * Without purchases to say when a bill started, it is taken to start this many days before its due
 * date (a card bill covers about a month and is due about a week after it closes).
 */
const BILL_SPAN_DAYS = 40;

export type BillStatus = 'aberta' | 'a-pagar' | 'paga' | 'nao-bateu';

export interface BillForMatching {
  readonly id: string;
  /** Null for the open bill, which the bank has not closed yet. */
  readonly dueDay: string | null;
  /** Null when the bank did not say. */
  readonly totalCents: number | null;
  /** The first purchase's day; null when the bill has none. */
  readonly firstDay: string | null;
}

export interface PaymentForMatching {
  readonly id: string;
  readonly day: string;
  /** Always positive. */
  readonly amountCents: number;
}

/** The day a bill starts taking payments: its first purchase, or about a month before it is due. */
function startDay(bill: BillForMatching): string | null {
  if (bill.firstDay) return bill.firstDay;
  return bill.dueDay ? addDays(bill.dueDay, -BILL_SPAN_DAYS) : null;
}

/**
 * Links each payment to the oldest bill not yet paid, closed or open, so an advance on the open
 * bill stays with it. A bill takes a payment only from its start until the next bill is due: a
 * bill that never adds up does not swallow every later payment. `bills` come oldest first, the open
 * bill last. Returns the payments of each bill, by bill id; a payment no bill takes is left out.
 */
export function matchPayments(
  bills: readonly BillForMatching[],
  payments: readonly PaymentForMatching[],
): Map<string, PaymentForMatching[]> {
  const linked = new Map<string, PaymentForMatching[]>(bills.map((b) => [b.id, []]));
  const paid = new Map<string, number>(bills.map((b) => [b.id, 0]));
  const ordered = [...payments].sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
  for (const payment of ordered) {
    const bill = bills.find((b, i) => {
      if (b.totalCents === null) return false;
      if ((paid.get(b.id) ?? 0) >= b.totalCents - PAYMENT_TOLERANCE_CENTS) return false;
      const start = startDay(b);
      if (start !== null && payment.day < start) return false;
      const nextDue = bills[i + 1]?.dueDay;
      return !nextDue || payment.day <= nextDue;
    });
    if (!bill) continue;
    linked.get(bill.id)?.push(payment);
    paid.set(bill.id, (paid.get(bill.id) ?? 0) + payment.amountCents);
  }
  return linked;
}

/** Payments minus the bill's value: negative when short, positive when over. */
export function paymentDifference(totalCents: number | null, paidCents: number): number | null {
  return totalCents === null ? null : paidCents - totalCents;
}

/**
 * A bill is paid when its payments add up to its value within one cent. Otherwise the open bill is
 * `aberta`, a closed bill is `a-pagar` until its due date and `nao-bateu` after it.
 */
export function billStatus(bill: { readonly dueDay: string | null; readonly totalCents: number | null }, paidCents: number, today: string): BillStatus {
  const difference = paymentDifference(bill.totalCents, paidCents);
  if (difference !== null && paidCents > 0 && Math.abs(difference) <= PAYMENT_TOLERANCE_CENTS) return 'paga';
  if (bill.dueDay === null) return 'aberta';
  // Nothing to pay: refunds covered the purchases.
  if (bill.totalCents !== null && bill.totalCents <= 0 && paidCents === 0) return 'paga';
  return today > bill.dueDay ? 'nao-bateu' : 'a-pagar';
}
