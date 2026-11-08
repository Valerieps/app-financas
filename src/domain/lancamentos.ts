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

/** The currencies whose saldo the list's summary always shows, even at zero. */
export const SUMMARY_CURRENCIES: readonly string[] = ['BRL', 'USD'];

/** The saldo (entradas minus saídas) of the reais and the dollars, in that order. */
export function balances(sums: readonly Totals[]): { currency: string; cents: number }[] {
  return SUMMARY_CURRENCIES.map((currency) => {
    const sum = sums.find((t) => t.currency === currency);
    return { currency, cents: sum ? sum.inCents - sum.outCents : 0 };
  });
}

/** Items sorted newest day first, keeping each day's order. */
export function sortByDay<T extends { day: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.day.localeCompare(a.day));
}

/**
 * The direction filter, as the URL carries it (`?tipo=saidas&tipo=cartao`): one or more kinds. Card
 * bill payments show only under `cartao`, never as saídas or entradas. None chosen keeps everything.
 */
export type DirectionFilter = 'saidas' | 'entradas' | 'cartao';
export const DIRECTION_FILTERS: readonly DirectionFilter[] = ['saidas', 'entradas', 'cartao'];

export function parseDirectionFilters(values: readonly string[]): DirectionFilter[] {
  return DIRECTION_FILTERS.filter((f) => values.includes(f));
}

export function matchesDirections(chosen: readonly DirectionFilter[], item: { direction: Direction; cardPayment: boolean }): boolean {
  if (chosen.length === 0) return true;
  const kind: DirectionFilter = item.cardPayment ? 'cartao' : item.direction === 'in' ? 'entradas' : 'saidas';
  return chosen.includes(kind);
}

/** The account filter, as the URL carries it (`?conta=a&conta=b`); none chosen keeps every account. */
export function matchesAccounts(chosen: readonly string[], account: string): boolean {
  return chosen.length === 0 || chosen.includes(account);
}

/** The key of "Vazio" in a filter: a lançamento with no value in that column. */
export const EMPTY_CHOICE = 'vazio';

/**
 * A filter over a column that may be empty, as the URL carries it (`?categoria=<id>&categoria=vazio`):
 * the values chosen, plus "Vazio" for the lançamentos without one. None chosen keeps every lançamento.
 */
export function matchesChoice(chosen: readonly string[], value: string | null): boolean {
  return chosen.length === 0 || chosen.includes(value || EMPTY_CHOICE);
}

/** The choices after a tap on one: adds it, or takes it out when it was chosen. */
export function toggleChoice(chosen: readonly string[], key: string): string[] {
  return chosen.includes(key) ? chosen.filter((a) => a !== key) : [...chosen, key];
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
  if (!shift || from < 0 || to < 0) return toggleChoice(selection, id);
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

/** A lançamento's type as the Tipo column shows it: a card bill payment, or else money in or out. */
export type LancamentoKind = 'entrada' | 'saida' | 'cartao';

export function lancamentoKind(item: { direction: Direction; cardPayment: boolean }): LancamentoKind {
  if (item.cardPayment) return 'cartao';
  return item.direction === 'in' ? 'entrada' : 'saida';
}

/** The list's columns, in the order the table shows them. */
export type ListColumn = 'data' | 'descricao' | 'tipo' | 'categoria' | 'tags' | 'operacao' | 'pagador' | 'valor';
export const LIST_COLUMNS: readonly ListColumn[] = ['data', 'descricao', 'tipo', 'categoria', 'tags', 'operacao', 'pagador', 'valor'];

/** Columns that always show: without them a row says nothing. */
export const FIXED_COLUMNS: readonly ListColumn[] = ['descricao', 'valor'];

/** The columns a first visit shows; the new ones wait until I turn them on. */
export const DEFAULT_COLUMNS: readonly ListColumn[] = ['data', 'descricao', 'categoria', 'tags', 'valor'];

/** Each column's share of the row's width. */
const COLUMN_WIDTH: Record<ListColumn, number> = { data: 1, descricao: 3, tipo: 1, categoria: 2, tags: 2, operacao: 2, pagador: 2, valor: 1 };

/** The columns remembered on this device (a JSON list); anything unreadable falls back to the default. */
export function parseColumns(raw: string | null): ListColumn[] {
  if (!raw) return [...DEFAULT_COLUMNS];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [...DEFAULT_COLUMNS];
    return LIST_COLUMNS.filter((c) => FIXED_COLUMNS.includes(c) || value.includes(c));
  } catch {
    return [...DEFAULT_COLUMNS];
  }
}

/** The columns after a tap on one: shown or hidden, in the table's order; the fixed ones stay. */
export function toggleColumn(shown: readonly ListColumn[], column: ListColumn): ListColumn[] {
  if (FIXED_COLUMNS.includes(column)) return LIST_COLUMNS.filter((c) => shown.includes(c));
  const next = shown.includes(column) ? shown.filter((c) => c !== column) : [...shown, column];
  return LIST_COLUMNS.filter((c) => next.includes(c));
}

/** The CSS grid template for the shown columns. */
export function columnTemplate(shown: readonly ListColumn[]): string {
  return shown.map((c) => `minmax(0, ${COLUMN_WIDTH[c]}fr)`).join(' ');
}
