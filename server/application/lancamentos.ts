// The Lançamentos list and its detail panel (docs/spec/lancamentos.md): the month's transactions,
// read from the vault. Reads only; the vault is written by collect/.
import type { LancamentoDetailView, LancamentosView, LancamentoView } from '../../src/application/api-contract';
import { transactionDay } from '../../src/domain/calendar';
import { direction, monthDays, totals } from '../../src/domain/lancamentos';
import { parseMonth } from '../../src/domain/month';
import { addDays } from '../../src/domain/vault';
import { QueryError, type Context } from './context';

interface Row {
  id: string;
  date: string;
  description: string | null;
  category: string | null;
  amount_cents: number;
  currency_code: string;
  type: string | null;
  status: string | null;
  account_name: string | null;
  account_type: string | null;
  installment_number: number | null;
  total_installments: number | null;
}

const SELECT = `
  SELECT t.id, t.date, t.description, t.amount_cents, t.currency_code, t.type, t.status,
         COALESCE(c.description_translated, c.description, json_extract(t.raw_json, '$.category')) AS category,
         a.name AS account_name, a.type AS account_type,
         cd.installment_number, cd.total_installments`;

const FROM = `
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN pluggy_categories c ON c.id = t.pluggy_category_id
  LEFT JOIN transaction_card_data cd ON cd.transaction_id = t.id`;

function toView(row: Row): LancamentoView {
  return {
    id: row.id,
    day: transactionDay(row.date),
    description: row.description,
    category: row.category,
    amountCents: Math.abs(row.amount_cents),
    currency: row.currency_code,
    direction: direction(row.type, row.amount_cents, row.account_type),
    accountName: row.account_name,
    accountType: row.account_type,
    pending: row.status === 'PENDING',
    installment:
      row.installment_number !== null && row.total_installments !== null && row.total_installments > 1
        ? { number: row.installment_number, total: row.total_installments }
        : null,
  };
}

export async function lancamentos(ctx: Context, month: unknown): Promise<LancamentosView | QueryError> {
  if (typeof month !== 'string' || !parseMonth(month)) return new QueryError('invalid');
  const { first, last } = monthDays(month);
  // A day early on each side: Pluggy's date may be an instant that falls on a neighbouring Brasília day.
  const rows = await ctx.sql.all<Row>(
    `${SELECT} ${FROM}
     WHERE t.deleted_at IS NULL AND t.date >= ? AND t.date < ?
     ORDER BY t.date DESC, t.first_seen_at DESC, t.id`,
    addDays(first, -1),
    addDays(last, 2),
  );
  const items = rows.map(toView).filter((item) => item.day >= first && item.day <= last);
  return { month, items, totals: totals(items) };
}

export async function lancamento(ctx: Context, id: unknown): Promise<LancamentoDetailView | QueryError> {
  if (typeof id !== 'string' || !id) return new QueryError('invalid');
  const [row] = await ctx.sql.all<
    Row & {
      description_raw: string | null;
      operation_type: string | null;
      payment_method: string | null;
      payer_name: string | null;
      receiver_name: string | null;
      card_number: string | null;
      first_seen_at: string;
    }
  >(
    `${SELECT}, t.description_raw, t.operation_type, t.first_seen_at,
            p.payment_method, p.payer_name, p.receiver_name, cd.card_number
     ${FROM}
     LEFT JOIN transaction_payment_data p ON p.transaction_id = t.id
     WHERE t.id = ? AND t.deleted_at IS NULL`,
    id,
  );
  if (!row) return new QueryError('not_found');
  const view = toView(row);
  return {
    ...view,
    date: row.date,
    descriptionRaw: row.description_raw && row.description_raw !== row.description ? row.description_raw : null,
    operationType: row.operation_type,
    paymentMethod: row.payment_method,
    counterpart: view.direction === 'in' ? row.payer_name : row.receiver_name,
    cardDigits: row.card_number,
    firstSeenAt: row.first_seen_at,
  };
}
