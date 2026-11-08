// Finanças › Gráficos › Por tag (docs/spec/graficos.md): how the month's gastos split among the tags
// of one layer, with "Sem tag" for the gastos with no tag there. It reads the Lançamentos list, so
// the slice's lançamentos can be tagged in place.
import { NOT_SPENDING } from './spending';
import { emptyTagKey, type TagAssignment } from './tags';

/** What the chart needs of a lançamento: the fields of the Lançamentos list. */
export interface TagChartSource {
  readonly amountCents: number;
  readonly currency: string;
  readonly direction: 'in' | 'out';
  readonly accountType: string | null;
  /** The category that counts: the one I chose, or else Pluggy's. */
  readonly categoryId: string | null;
  readonly cardPayment: boolean;
  readonly tags: TagAssignment;
}

/**
 * How much a lançamento adds to my gastos, in cents, by the rule of the other charts: money out
 * counts, a refund on the card takes away, and money in, investments, transfers between my accounts
 * and card bill payments do not count (null). Only reais count.
 */
export function lancamentoSpendingCents(item: TagChartSource): number | null {
  if (item.currency !== 'BRL' || item.cardPayment) return null;
  const category = item.categoryId ?? '';
  if (NOT_SPENDING.some((prefix) => category.startsWith(prefix))) return null;
  if (item.direction === 'out') return item.amountCents;
  return item.accountType === 'CREDIT' ? -item.amountCents : null;
}

/** One slice of the donut: a tag of the layer, or the gastos with no tag in it. */
export interface TagSlice {
  /** The tag id, or emptyTagKey(layerId) for "Sem tag". */
  readonly key: string;
  /** Null for "Sem tag". */
  readonly tagId: string | null;
  readonly cents: number;
}

export interface TagChart {
  readonly slices: readonly TagSlice[];
  /** The sum of the slices. */
  readonly totalCents: number;
}

/** The key of the slice a lançamento falls in: its tag in the layer, or "Sem tag" when it has none of the layer's tags. */
export function sliceKey(tags: TagAssignment, layer: { readonly id: string; readonly tagIds: readonly string[] }): string {
  const tag = tags[layer.id];
  return tag !== undefined && layer.tagIds.includes(tag) ? tag : emptyTagKey(layer.id);
}

/**
 * The month's gastos split among the tags of `layer`: one slice per tag with gasto above zero,
 * biggest first (ties by the layer's order), and "Sem tag" last.
 */
export function tagChart(items: readonly TagChartSource[], layer: { readonly id: string; readonly tagIds: readonly string[] }): TagChart {
  const sums = new Map<string, number>();
  for (const item of items) {
    const cents = lancamentoSpendingCents(item);
    if (cents === null) continue;
    const key = sliceKey(item.tags, layer);
    sums.set(key, (sums.get(key) ?? 0) + cents);
  }
  const empty = emptyTagKey(layer.id);
  const tagged: TagSlice[] = layer.tagIds
    .map((tagId) => ({ key: tagId, tagId, cents: sums.get(tagId) ?? 0 }))
    .filter((s) => s.cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const none = sums.get(empty) ?? 0;
  const slices = none > 0 ? [...tagged, { key: empty, tagId: null, cents: none }] : tagged;
  return { slices, totalCents: slices.reduce((sum, s) => sum + s.cents, 0) };
}

/** The lançamentos behind one slice: the gastos (refunds included) that fall in it. */
export function sliceItems<T extends TagChartSource>(items: readonly T[], layer: { readonly id: string; readonly tagIds: readonly string[] }, key: string): T[] {
  return items.filter((item) => lancamentoSpendingCents(item) !== null && sliceKey(item.tags, layer) === key);
}

/** One arc of the donut, as fractions of the circle: where it starts and how long it is. */
export interface Arc {
  readonly key: string;
  readonly start: number;
  readonly length: number;
}

/** The donut's arcs, in the slices' order, starting at the top. */
export function arcs(chart: TagChart): Arc[] {
  if (chart.totalCents <= 0) return [];
  let start = 0;
  return chart.slices.map((s) => {
    const length = s.cents / chart.totalCents;
    const arc = { key: s.key, start, length };
    start += length;
    return arc;
  });
}
