// What counts as a gasto, its categoria, and the month compared with my own past
// (docs/spec/graficos.md). Until classification exists (phase 2), the categoria comes from the top
// of Pluggy's category tree, with Portuguese names of the app's own.
import { addMonths, daysInMonth } from './calendar';

export const CATEGORY_IDS = [
  'moradia',
  'mercado',
  'restaurante',
  'transporte',
  'saude',
  'assinaturas',
  'servicos',
  'educacao',
  'compras',
  'lazer',
  'viagem',
  'seguros',
  'impostos',
  'tarifas',
  'emprestimos',
  'transferencias',
  'doacoes',
  'apostas',
  'outros',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

/** Pluggy category id prefixes that are not a gasto: investments, my own accounts, the card bill. */
const NOT_SPENDING = ['03', '04', '0510'];

/** Pluggy category id prefix → categoria. The longest prefix wins. */
const BY_PREFIX: readonly (readonly [string, CategoryId])[] = [
  ['0702', 'educacao'],
  ['0703', 'saude'],
  ['0704', 'lazer'],
  ['01', 'outros'],
  ['02', 'emprestimos'],
  ['05', 'transferencias'],
  ['06', 'outros'],
  ['07', 'servicos'],
  ['08', 'compras'],
  ['09', 'assinaturas'],
  ['10', 'mercado'],
  ['11', 'restaurante'],
  ['12', 'viagem'],
  ['13', 'doacoes'],
  ['14', 'apostas'],
  ['15', 'impostos'],
  ['16', 'tarifas'],
  ['17', 'moradia'],
  ['18', 'saude'],
  ['19', 'transporte'],
  ['20', 'seguros'],
  ['21', 'lazer'],
];

export function categoryOf(pluggyCategoryId: string | null | undefined): CategoryId {
  if (!pluggyCategoryId) return 'outros';
  let best: readonly [string, CategoryId] | undefined;
  for (const entry of BY_PREFIX) {
    if (pluggyCategoryId.startsWith(entry[0]) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best ? best[1] : 'outros';
}

export interface SpendingSource {
  /** Pluggy's transaction type: DEBIT (money out) or CREDIT (money in). */
  readonly type: string | null;
  /** The amount in the account's currency, in cents, with Pluggy's sign. */
  readonly amountCents: number;
  /** Pluggy's account type: BANK or CREDIT. */
  readonly accountType: string | null;
  readonly pluggyCategoryId: string | null;
}

/**
 * How much a transaction adds to my gastos, in cents: positive for money out of an account or a
 * purchase on the card, negative for a refund on the card, null when it is not a gasto (money in
 * to an account, investments, transfers between my accounts, paying the card bill).
 */
export function spendingCents(t: SpendingSource): number | null {
  const category = t.pluggyCategoryId ?? '';
  if (NOT_SPENDING.some((prefix) => category.startsWith(prefix))) return null;
  const card = t.accountType === 'CREDIT';
  // Without a type, the sign says it: the card shows purchases positive, the account debits negative.
  const out = t.type === 'DEBIT' || t.type === 'CREDIT' ? t.type === 'DEBIT' : card ? t.amountCents > 0 : t.amountCents < 0;
  const cents = Math.abs(t.amountCents);
  if (out) return cents;
  return card ? -cents : null;
}

/** One gasto, already in its categoria and its Brasília day. */
export interface SpendingItem {
  readonly day: string;
  readonly category: CategoryId;
  readonly cents: number;
}

export type Comparison = 'average' | 'previous';

/** How many months the average looks back. */
export const AVERAGE_MONTHS = 3;

/** One categoria of the month: what I spent and what I usually spend by the same day. */
export interface CategoryRow {
  readonly category: CategoryId;
  readonly cents: number;
  /** Null when there is no earlier month to compare with. */
  readonly baselineCents: number | null;
}

export interface CategoryChart {
  readonly month: string;
  /** Up to which day the month and its comparison count; null for a whole month. */
  readonly throughDay: number | null;
  readonly compare: Comparison;
  /** The earlier months the comparison used (those with any gasto), oldest first. */
  readonly compareMonths: readonly string[];
  /** Biggest first, Outros last. */
  readonly rows: readonly CategoryRow[];
  readonly totalCents: number;
  readonly baselineTotalCents: number | null;
}

/**
 * Up to which day of `month` the chart counts, given today (yyyy-mm-dd): today's day in the
 * current month, null (the whole month) for a past month, 0 for a month still to come.
 */
export function throughDay(month: string, today: string): number | null {
  const current = today.slice(0, 7);
  if (month < current) return null;
  if (month > current) return 0;
  return Number(today.slice(8, 10));
}

/** The months a comparison looks at, oldest first. */
export function comparisonMonths(month: string, compare: Comparison): string[] {
  const count = compare === 'average' ? AVERAGE_MONTHS : 1;
  return Array.from({ length: count }, (_, i) => addMonths(month, i - count));
}

/** Whether a gasto's day falls in `month` up to `through` (null: the whole month). */
function within(day: string, month: string, through: number | null): boolean {
  if (day.slice(0, 7) !== month) return false;
  return through === null || Number(day.slice(8, 10)) <= Math.min(through, daysInMonth(month));
}

export function categoryChart(items: readonly SpendingItem[], month: string, today: string, compare: Comparison): CategoryChart {
  const through = throughDay(month, today);
  const withData = comparisonMonths(month, compare).filter((m) => items.some((item) => item.day.slice(0, 7) === m));

  const current = new Map<CategoryId, number>();
  const earlier = new Map<CategoryId, number>();
  for (const item of items) {
    if (within(item.day, month, through)) current.set(item.category, (current.get(item.category) ?? 0) + item.cents);
    else if (withData.some((m) => within(item.day, m, through))) earlier.set(item.category, (earlier.get(item.category) ?? 0) + item.cents);
  }

  const baseline = (cents: number) => (withData.length ? Math.round(cents / withData.length) : null);
  const rows = CATEGORY_IDS.filter((c) => current.has(c) || earlier.has(c))
    .map((category) => ({ category, cents: current.get(category) ?? 0, baselineCents: baseline(earlier.get(category) ?? 0) }))
    .sort((a, b) => Number(a.category === 'outros') - Number(b.category === 'outros') || b.cents - a.cents);
  const sum = (values: Iterable<number>) => [...values].reduce((total, v) => total + v, 0);

  return {
    month,
    throughDay: through,
    compare,
    compareMonths: withData,
    rows,
    totalCents: sum(current.values()),
    baselineTotalCents: baseline(sum(earlier.values())),
  };
}

/** Below R$ 10 and below 10% of the comparison, a difference reads "igual". */
const SAME_CENTS = 1000;
const SAME_SHARE = 0.1;

export type Trend = 'igual' | 'acima' | 'abaixo';

export function trend(cents: number, baselineCents: number): Trend {
  const diff = cents - baselineCents;
  if (diff === 0) return 'igual';
  if (Math.abs(diff) < SAME_CENTS &&Math.abs(diff) < Math.abs(baselineCents) * SAME_SHARE) return 'igual';
  return diff > 0 ? 'acima' : 'abaixo';
}

/** The answer on top of the chart: the categoria furthest above the comparison, if any. */
export function furthestAbove(rows: readonly CategoryRow[]): CategoryRow | null {
  let best: CategoryRow | null = null;
  for (const row of rows) {
    if (row.baselineCents === null || trend(row.cents, row.baselineCents) !== 'acima') continue;
    if (!best || row.cents - row.baselineCents > best.cents - (best.baselineCents ?? 0)) best = row;
  }
  return best;
}

/** The categorias below the comparison, in the rows' order. */
export function below(rows: readonly CategoryRow[]): CategoryId[] {
  return rows.filter((row) => row.baselineCents !== null && trend(row.cents, row.baselineCents) === 'abaixo').map((row) => row.category);
}

/** How many months "Ao longo do tempo" shows, ending at the selected month. */
export const TIMELINE_MONTHS = 12;

export interface MonthTotal {
  readonly month: string;
  /** Null for a month with no gasto at all (before the data starts, or still to come). */
  readonly cents: number | null;
}

export interface MonthlyChart {
  readonly months: readonly MonthTotal[];
  /** True when the last month is the current one, still running. */
  readonly partial: boolean;
  /** The average of the complete months with data; null when there are none. */
  readonly averageCents: number | null;
}

export function monthlyChart(items: readonly SpendingItem[], month: string, today: string): MonthlyChart {
  const months = Array.from({ length: TIMELINE_MONTHS }, (_, i) => addMonths(month, i - TIMELINE_MONTHS + 1));
  const totals = months.map((m) => {
    const inMonth = items.filter((item) => item.day.slice(0, 7) === m);
    return { month: m, cents: inMonth.length ? inMonth.reduce((total, item) => total + item.cents, 0) : null };
  });
  const complete = totals.filter((t) => t.cents !== null && throughDay(t.month, today) === null).map((t) => t.cents as number);
  return {
    months: totals,
    partial: throughDay(month, today) !== null,
    averageCents: complete.length ? Math.round(complete.reduce((a, b) => a + b, 0) / complete.length) : null,
  };
}
