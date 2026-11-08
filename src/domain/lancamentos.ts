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

/** Pluggy's category for a card bill payment ("Credit card payment"), on either side. */
export const CARD_PAYMENT_CATEGORY = '0510';

/**
 * Descriptions that name a card bill payment, as lowercase prefixes: the debit in the bank account,
 * and the credit that lands on the card. migrations/0005_card_payment.sql applies the same prefixes
 * with LIKE to what was stored before the rule existed.
 */
export const CARD_PAYMENT_BANK_PREFIXES: readonly string[] = ['pagamento de fatura', 'pagamento da fatura', 'pagamento fatura'];
export const CARD_PAYMENT_CARD_PREFIXES: readonly string[] = [...CARD_PAYMENT_BANK_PREFIXES, 'pagamento recebido'];

export interface CardPaymentSource {
  readonly type: string | null;
  readonly amountCents: number;
  readonly accountType: string | null;
  readonly pluggyCategoryId: string | null;
  readonly description: string | null;
}

/**
 * Whether a transaction is a card bill payment (docs/spec/lancamentos.md): the money that leaves the
 * bank account to pay the bill, or the payment the card receives. Pluggy's category says it; without
 * it, the description does, on money out of an account or money into a card.
 */
export function isCardPayment(t: CardPaymentSource): boolean {
  if (t.pluggyCategoryId?.startsWith(CARD_PAYMENT_CATEGORY)) return true;
  const text = (t.description ?? '').trim().toLowerCase();
  if (!text) return false;
  const card = t.accountType === 'CREDIT';
  if (direction(t.type, t.amountCents, t.accountType) !== (card ? 'in' : 'out')) return false;
  return (card ? CARD_PAYMENT_CARD_PREFIXES : CARD_PAYMENT_BANK_PREFIXES).some((prefix) => text.startsWith(prefix));
}

/**
 * Whether a lançamento counts as a card bill payment once I may have chosen its category
 * (docs/spec/classificacao.md): my category alone decides it; without one, the flag the collection
 * stored (isCardPayment). server/application/category-choice.ts says the same in SQL.
 */
export function cardPaymentWithChoice(stored: boolean, chosenCategoryId: string | null): boolean {
  return chosenCategoryId === null ? stored : chosenCategoryId.startsWith(CARD_PAYMENT_CATEGORY);
}

export interface Totals {
  readonly currency: string;
  readonly inCents: number;
  readonly outCents: number;
}

/**
 * What came in and went out, per currency, BRL first. Card bill payments stay out: they move money
 * between my own accounts, and the purchases on the card already count as saídas.
 */
export function totals(items: readonly { currency: string; direction: Direction; amountCents: number; cardPayment?: boolean }[]): Totals[] {
  const byCurrency = new Map<string, { inCents: number; outCents: number }>();
  for (const item of items) {
    if (item.cardPayment) continue;
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

/**
 * The list's filter, as the URL carries it (`?tipo=entradas`). Card bill payments show only under
 * `cartao` (and `todos`), never as saídas or entradas.
 */
export type DirectionFilter = 'todos' | 'saidas' | 'entradas' | 'cartao';

export function parseDirectionFilter(value: string | null): DirectionFilter {
  return value === 'saidas' || value === 'entradas' || value === 'cartao' ? value : 'todos';
}

export function matchesFilter(filter: DirectionFilter, item: { direction: Direction; cardPayment: boolean }): boolean {
  if (filter === 'todos') return true;
  if (filter === 'cartao') return item.cardPayment;
  return !item.cardPayment && (filter === 'entradas') === (item.direction === 'in');
}

/** The account filter, as the URL carries it (`?conta=a&conta=b`); none chosen keeps every account. */
export function matchesAccounts(chosen: readonly string[], account: string): boolean {
  return chosen.length === 0 || chosen.includes(account);
}

/** The accounts chosen after a tap on one: adds it, or takes it out when it was chosen. */
export function toggleAccount(chosen: readonly string[], account: string): string[] {
  return chosen.includes(account) ? chosen.filter((a) => a !== account) : [...chosen, account];
}

/**
 * The selection after a click on one lançamento's box. A plain click toggles it. A shift-click, with
 * an anchor (the last box clicked) still in the list, sets every lançamento between the anchor and
 * the clicked one, in the order the list shows, to the state the clicked one is switching to.
 */
export function clickSelection(
  selection: readonly string[],
  order: readonly string[],
  anchor: string | null,
  id: string,
  shift: boolean,
): string[] {
  const from = anchor === null ? -1 : order.indexOf(anchor);
  const to = order.indexOf(id);
  if (!shift || from < 0 || to < 0) return toggleAccount(selection, id);
  const range = order.slice(Math.min(from, to), Math.max(from, to) + 1);
  if (selection.includes(id)) return selection.filter((x) => !range.includes(x));
  return [...selection, ...range.filter((x) => !selection.includes(x))];
}

const WEEKDAYS =['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
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

/** The column the list is sorted by, as the URL carries it (`?ordem=valor&sentido=asc`). */
export type SortColumn = 'data' | 'descricao' | 'categoria' | 'valor';
export type SortDirection = 'asc' | 'desc';
export interface Sort {
  readonly column: SortColumn;
  readonly direction: SortDirection;
}

/** Each column's first direction: newest day and biggest value first, text from A to Z. */
const FIRST_DIRECTION: Record<SortColumn, SortDirection> = { data: 'desc', descricao: 'asc', categoria: 'asc', valor: 'desc' };

export const DEFAULT_SORT: Sort = { column: 'data', direction: 'desc' };

export function parseSort(column: string | null, direction: string | null): Sort {
  const c: SortColumn = column === 'descricao' || column === 'categoria' || column === 'valor' ? column : 'data';
  const d: SortDirection = direction === 'asc' || direction === 'desc' ? direction : FIRST_DIRECTION[c];
  return { column: c, direction: d };
}

/** The sort after a click on `column`: the same column flips, another starts in its first direction. */
export function nextSort(current: Sort, column: SortColumn): Sort {
  if (current.column === column) return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  return { column, direction: FIRST_DIRECTION[column] };
}

/** The URL parameters of a sort; the default leaves them out. */
export function sortParams(sort: Sort): { ordem: string | null; sentido: string | null } {
  if (sort.column === DEFAULT_SORT.column && sort.direction === DEFAULT_SORT.direction) return { ordem: null, sentido: null };
  return { ordem: sort.column === 'data' ? null : sort.column, sentido: sort.direction === FIRST_DIRECTION[sort.column] ? null : sort.direction };
}

interface Sortable {
  readonly day: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly amountCents: number;
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * Items sorted by a column. Empty text goes last in either direction; ties keep the newest day first,
 * then the order they came in. Value is the amount, money in or out alike.
 */
export function sortLancamentos<T extends Sortable>(items: readonly T[], sort: Sort): T[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const text = (a: string | null, b: string | null) => {
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    return sign * collator.compare(a, b);
  };
  const compare = (a: T, b: T): number => {
    switch (sort.column) {
      case 'data':
        return sign * a.day.localeCompare(b.day);
      case 'descricao':
        return text(a.description, b.description);
      case 'categoria':
        return text(a.category, b.category);
      case 'valor':
        return sign * (a.amountCents - b.amountCents);
    }
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || b.item.day.localeCompare(a.item.day) || a.index - b.index)
    .map(({ item }) => item);
}
