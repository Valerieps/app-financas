// Rules of the data vault (docs/spec/cofre-de-dados.md): money in cents, the day in Brasília, and
// how a transaction is recognized when Pluggy gives it a new id.

export const TIME_ZONE = 'America/Sao_Paulo';

/** Pluggy sends money as decimal numbers; the vault keeps integer cents. */
export function toCents(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** The calendar day (yyyy-mm-dd) in Brasília for an instant. */
export function saoPauloDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

/** The hour (0-23) in Brasília for an instant. */
export function saoPauloHour(instant: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(instant));
}

/** Shifts a yyyy-mm-dd day by whole days. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The last digits of an account number, enough to recognize the account after a renewal. */
export function numberSuffix(number: unknown): string | null {
  const digits = typeof number === 'string' ? number.replace(/\D/g, '') : '';
  return digits ? digits.slice(-4) : null;
}

export interface TransactionKeyFields {
  readonly providerId?: string | null;
  readonly date: string;
  readonly amount: number;
  readonly description?: string | null;
}

/**
 * What makes two Pluggy transactions the same transaction (Pluggy's own advice for the card's
 * delete-and-recreate): the institution's `providerId` when there is one; otherwise the date, the
 * amount, the description and the position among identical transactions of that day.
 */
export function matchKeys<T extends TransactionKeyFields>(transactions: readonly T[]): Map<T, string> {
  const keys = new Map<T, string>();
  const seen = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.providerId) {
      keys.set(transaction, `p:${transaction.providerId}`);
      continue;
    }
    const description = (transaction.description ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
    const base = `${transaction.date.slice(0, 10)}|${toCents(transaction.amount)}|${description}`;
    const position = seen.get(base) ?? 0;
    seen.set(base, position + 1);
    keys.set(transaction, `f:${base}|${position}`);
  }
  return keys;
}
