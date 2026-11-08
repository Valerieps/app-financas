// Finanças › Cartão (docs/spec/cartao-de-credito.md): the card bills of the last 12 months and the
// open one, each with the payments from the bank account that pay it. Reads only.
import type { BillView, CartaoView } from '../../src/application/api-contract';
import { calendarStart, transactionDay } from '../../src/domain/calendar';
import { billStatus, matchPayments, paymentDifference, type BillForMatching } from '../../src/domain/faturas';
import { direction } from '../../src/domain/lancamentos';
import { addDays, saoPauloDate } from '../../src/domain/vault';
import type { Context } from './context';

/** Without a closed bill to start from, the open bill takes the purchases of this many days. */
const OPEN_BILL_DAYS = 40;

interface BillRow {
  id: string;
  pluggy_id: string;
  account_id: string;
  account_name: string | null;
  due_date: string | null;
  total_amount_cents: number | null;
  last_seen_at: string;
}

interface CardRow {
  account_id: string;
  bill_id: string | null;
  date: string;
  amount_cents: number;
  type: string | null;
  total_installments: number | null;
}

interface PaymentRow {
  id: string;
  date: string;
  amount_cents: number;
  type: string | null;
  account_name: string | null;
  account_type: string | null;
}

/** What a bill's purchases say: its first and last day and how much is installments. */
interface Purchases {
  firstDay: string | null;
  lastDay: string | null;
  totalCents: number;
  installmentCents: number;
}

function addPurchase(into: Purchases, row: CardRow): void {
  const day = transactionDay(row.date);
  // On the card, a purchase is money out; a refund is money in.
  const cents = direction(row.type, row.amount_cents, 'CREDIT') === 'out' ? Math.abs(row.amount_cents) : -Math.abs(row.amount_cents);
  if (!into.firstDay || day < into.firstDay) into.firstDay = day;
  if (!into.lastDay || day > into.lastDay) into.lastDay = day;
  into.totalCents += cents;
  if ((row.total_installments ?? 0) > 1) into.installmentCents += cents;
}

const empty = (): Purchases => ({ firstDay: null, lastDay: null, totalCents: 0, installmentCents: 0 });

interface Bill extends BillForMatching {
  readonly accountId: string;
  readonly accountName: string | null;
  readonly purchases: Purchases;
}

export async function cartao(ctx: Context): Promise<CartaoView> {
  const today = saoPauloDate(ctx.clock.now());
  const [billRows, cardRows, paymentRows] = await Promise.all([
    ctx.sql.all<BillRow>(
      `SELECT b.id, b.pluggy_id, b.account_id, a.name AS account_name, b.due_date, b.total_amount_cents, b.last_seen_at
       FROM bills b JOIN accounts a ON a.id = b.account_id
       WHERE a.type = 'CREDIT'`,
    ),
    ctx.sql.all<CardRow>(
      `SELECT t.account_id, t.bill_id, t.date, t.amount_cents, t.type, cd.total_installments
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN transaction_card_data cd ON cd.transaction_id = t.id
       WHERE a.type = 'CREDIT' AND t.deleted_at IS NULL AND t.card_payment = 0`,
    ),
    ctx.sql.all<PaymentRow>(
      `SELECT t.id, t.date, t.amount_cents, t.type, a.name AS account_name, a.type AS account_type
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE COALESCE(a.type, '') <> 'CREDIT' AND t.deleted_at IS NULL AND t.card_payment = 1`,
    ),
  ]);

  // A renewed connection starts new bill records for the same card (docs/ARQUITETURA.md): one bill
  // per card and due day, the one read last; its purchases may carry either record's Pluggy id.
  const kept = new Map<string, BillRow>();
  const keptByPluggyId = new Map<string, string>();
  for (const row of billRows) {
    const key = `${row.account_id}|${row.due_date ? transactionDay(row.due_date) : row.id}`;
    const current = kept.get(key);
    if (!current || row.last_seen_at > current.last_seen_at) kept.set(key, row);
  }
  for (const row of billRows) {
    const key = `${row.account_id}|${row.due_date ? transactionDay(row.due_date) : row.id}`;
    keptByPluggyId.set(row.pluggy_id, kept.get(key)!.id);
  }

  const purchases = new Map<string, Purchases>();
  const withoutBill = new Map<string, CardRow[]>();
  for (const row of cardRows) {
    const billId = row.bill_id ? keptByPluggyId.get(row.bill_id) : undefined;
    if (billId) {
      const into = purchases.get(billId) ?? empty();
      addPurchase(into, row);
      purchases.set(billId, into);
    } else if (!row.bill_id) {
      withoutBill.set(row.account_id, [...(withoutBill.get(row.account_id) ?? []), row]);
    }
  }

  const closed: Bill[] = [...kept.values()]
    .map((row) => {
      const own = purchases.get(row.id) ?? empty();
      return {
        id: row.id,
        accountId: row.account_id,
        accountName: row.account_name,
        dueDay: row.due_date ? transactionDay(row.due_date) : null,
        totalCents: row.total_amount_cents,
        firstDay: own.firstDay,
        purchases: own,
      };
    })
    .filter((b) => b.dueDay !== null)
    .sort((a, b) => a.dueDay!.localeCompare(b.dueDay!) || a.id.localeCompare(b.id));

  // The open bill: each card's purchases with no bill yet, after its last closed bill.
  const open: Bill[] = [];
  for (const [accountId, rows] of withoutBill) {
    const own = closed.filter((b) => b.accountId === accountId);
    const last = own.at(-1);
    const after = last ? (last.purchases.lastDay ?? last.dueDay!) : addDays(today, -OPEN_BILL_DAYS);
    const bill = empty();
    for (const row of rows) if (transactionDay(row.date) > after) addPurchase(bill, row);
    if (bill.firstDay === null) continue;
    open.push({
      id: `aberta-${accountId}`,
      accountId,
      accountName: own[0]?.accountName ?? null,
      dueDay: null,
      totalCents: bill.totalCents,
      firstDay: bill.firstDay,
      purchases: bill,
    });
  }

  const payments = paymentRows
    .filter((row) => direction(row.type, row.amount_cents, row.account_type) === 'out')
    .map((row) => ({ id: row.id, day: transactionDay(row.date), amountCents: Math.abs(row.amount_cents), accountName: row.account_name }));
  const bills = [...closed, ...open];
  const linked = matchPayments(bills, payments);
  const accountOf = new Map(payments.map((p) => [p.id, p.accountName]));

  const since = calendarStart(today);
  const views: BillView[] = bills
    .filter((b) => b.dueDay === null || b.dueDay >= since)
    .map((b) => {
      const own = linked.get(b.id) ?? [];
      const paidCents = own.reduce((sum, p) => sum + p.amountCents, 0);
      return {
        id: b.id,
        accountName: b.accountName,
        status: billStatus(b, paidCents, today),
        dueDay: b.dueDay,
        firstDay: b.purchases.firstDay,
        lastDay: b.purchases.lastDay,
        totalCents: b.totalCents,
        installmentCents: b.purchases.installmentCents,
        paidCents,
        differenceCents: paymentDifference(b.totalCents, paidCents),
        payments: own.map((p) => ({ id: p.id, day: p.day, amountCents: p.amountCents, accountName: accountOf.get(p.id) ?? null })),
      };
    })
    // The open bill first, then the newest due date.
    .sort((a, b) => (b.dueDay ?? '9999').localeCompare(a.dueDay ?? '9999'));
  return { bills: views };
}
