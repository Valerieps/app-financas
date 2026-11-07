// The Lançamentos list (docs/spec/lancamentos.md): every transaction of the month, money out
// (gastos) and money in (créditos), newest Brasília day first.
import { addDays } from './vault';

export type Direction = 'in' | 'out';

/**
 * Whether a Pluggy transaction is money in or out. Pluggy's `type` says it (CREDIT is money in);
 * without it, the sign does on a bank account (negative is out) and the opposite on a card, whose
 * purchases come positive.
 */
export function direction(type: string | null, amountCents: number, accountType: string | null): Direction {
  if (type === 'CREDIT') return 'in';
  if (type === 'DEBIT') return 'out';
  if (accountType === 'CREDIT') return amountCents > 0 ? 'out' : 'in';
  return amountCents < 0 ? 'out' : 'in';
}

/** The first and last day of a month (yyyy-mm), as yyyy-mm-dd. */
export function monthDays(month: string): { first: string; last: string } {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const next = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
  return { first: `${month}-01`, last: addDays(`${next}-01`, -1) };
}

export interface Totals {
  readonly currency: string;
  readonly inCents: number;
  readonly outCents: number;
}

/** What came in and went out, per currency, BRL first. */
export function totals(items: readonly { currency: string; direction: Direction; amountCents: number }[]): Totals[] {
  const byCurrency = new Map<string, { inCents: number; outCents: number }>();
  for (const item of items) {
    const sum = byCurrency.get(item.currency) ?? { inCents: 0, outCents: 0 };
    if (item.direction === 'in') sum.inCents += item.amountCents;
    else sum.outCents += item.amountCents;
    byCurrency.set(item.currency, sum);
  }
  return [...byCurrency.entries()]
    .map(([currency, sum]) => ({ currency, ...sum }))
    .sort((a, b) => (a.currency === 'BRL' ? -1 : b.currency === 'BRL' ? 1 : a.currency.localeCompare(b.currency)));
}

/** Items sorted newest day first, keeping each day's order. */
export function sortByDay<T extends { day: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.day.localeCompare(a.day));
}

/** The list's filter, as the URL carries it (`?tipo=entradas`). */
export type DirectionFilter = 'todos' | 'saidas' | 'entradas';

export function parseDirectionFilter(value: string | null): DirectionFilter {
  return value === 'saidas' || value === 'entradas' ? value : 'todos';
}

export function matchesFilter(filter: DirectionFilter, value: Direction): boolean {
  return filter === 'todos' || (filter === 'entradas') === (value === 'in');
}

/** The account filter, as the URL carries it (`?conta=a&conta=b`); none chosen keeps every account. */
export function matchesAccounts(chosen: readonly string[], account: string): boolean {
  return chosen.length === 0 || chosen.includes(account);
}

/** The accounts chosen after a tap on one: adds it, or takes it out when it was chosen. */
export function toggleAccount(chosen: readonly string[], account: string): string[] {
  return chosen.includes(account) ? chosen.filter((a) => a !== account) : [...chosen, account];
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function shortDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${date} ${MONTHS_SHORT[month - 1]}`;
}

/** A day in full: "Hoje · sáb, 7 nov", "Ontem · sex, 6 nov", "qui, 5 nov". */
export function dayLabel(day: string, today: string, words: { today: string; yesterday: string }): string {
  const short = shortDay(day);
  if (day === today) return `${words.today} · ${short}`;
  if (day === addDays(today, -1)) return `${words.yesterday} · ${short}`;
  return short;
}

/** A day in the list's Data column: "Hoje", "Ontem", "qui, 5 nov". */
export function dayCell(day: string, today: string, words: { today: string; yesterday: string }): string {
  if (day === today) return words.today;
  if (day === addDays(today, -1)) return words.yesterday;
  return shortDay(day);
}
