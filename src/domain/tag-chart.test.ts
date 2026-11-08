import { describe, expect, it } from 'vitest';
import { arcs, lancamentoSpendingCents, sliceItems, tagChart, type TagChartSource } from './tag-chart';

const item = (over: Partial<TagChartSource> & { id?: string } = {}): TagChartSource & { id: string } => ({
  id: 'x',
  amountCents: 1000,
  currency: 'BRL',
  direction: 'out',
  accountType: 'BANK',
  categoryId: '11000000',
  cardPayment: false,
  tags: {},
  ...over,
});

const layer = { id: 'tipo', tagIds: ['mercado', 'lazer', 'casa'] };

describe('lancamentoSpendingCents', () => {
  it('counts money out and takes a card refund away', () => {
    expect(lancamentoSpendingCents(item())).toBe(1000);
    expect(lancamentoSpendingCents(item({ direction: 'in', accountType: 'CREDIT' }))).toBe(-1000);
  });

  it('leaves out money in, card bill payments, investments, transfers and other currencies', () => {
    expect(lancamentoSpendingCents(item({ direction: 'in' }))).toBeNull();
    expect(lancamentoSpendingCents(item({ cardPayment: true }))).toBeNull();
    expect(lancamentoSpendingCents(item({ categoryId: '03010000' }))).toBeNull();
    expect(lancamentoSpendingCents(item({ categoryId: '04000000' }))).toBeNull();
    expect(lancamentoSpendingCents(item({ categoryId: '05100000' }))).toBeNull();
    expect(lancamentoSpendingCents(item({ currency: 'USD' }))).toBeNull();
  });

  it('counts a lançamento with no category', () => {
    expect(lancamentoSpendingCents(item({ categoryId: null }))).toBe(1000);
  });
});

describe('tagChart', () => {
  it('splits the gastos by tag, biggest first, with Sem tag last', () => {
    const chart = tagChart(
      [
        item({ amountCents: 500, tags: { tipo: 'mercado' } }),
        item({ amountCents: 3000, tags: { tipo: 'lazer' } }),
        item({ amountCents: 200, tags: { tipo: 'mercado' } }),
        item({ amountCents: 9000, tags: { outra: 'y' } }),
        item({ amountCents: 100, direction: 'in', accountType: 'CREDIT', tags: { tipo: 'lazer' } }),
        item({ amountCents: 99999, direction: 'in', tags: { tipo: 'casa' } }),
      ],
      layer,
    );
    expect(chart.slices).toEqual([
      { key: 'lazer', tagId: 'lazer', cents: 2900 },
      { key: 'mercado', tagId: 'mercado', cents: 700 },
      { key: 'vazio:tipo', tagId: null, cents: 9000 },
    ]);
    expect(chart.totalCents).toBe(12600);
  });

  it('puts a tag the layer no longer has in Sem tag, and drops slices with nothing', () => {
    const chart = tagChart([item({ tags: { tipo: 'apagada' } }), item({ amountCents: 300, direction: 'in', accountType: 'CREDIT', tags: { tipo: 'casa' } })], layer);
    expect(chart.slices).toEqual([{ key: 'vazio:tipo', tagId: null, cents: 1000 }]);
  });

  it('is empty without gastos', () => {
    expect(tagChart([], layer)).toEqual({ slices: [], totalCents: 0 });
  });
});

describe('sliceItems', () => {
  it('lists the gastos of one slice, refunds included', () => {
    const items = [
      item({ id: 'a', tags: { tipo: 'lazer' } }),
      item({ id: 'b', direction: 'in', accountType: 'CREDIT', tags: { tipo: 'lazer' } }),
      item({ id: 'c', direction: 'in', tags: { tipo: 'lazer' } }),
      item({ id: 'd' }),
    ];
    expect(sliceItems(items, layer, 'lazer').map((i) => i.id)).toEqual(['a', 'b']);
    expect(sliceItems(items, layer, 'vazio:tipo').map((i) => i.id)).toEqual(['d']);
  });
});

describe('arcs', () => {
  it('lays the slices around the circle from the top', () => {
    const chart = { slices: [{ key: 'a', tagId: 'a', cents: 300 }, { key: 'b', tagId: null, cents: 100 }], totalCents: 400 };
    expect(arcs(chart)).toEqual([
      { key: 'a', start: 0, length: 0.75 },
      { key: 'b', start: 0.75, length: 0.25 },
    ]);
    expect(arcs({ slices: [], totalCents: 0 })).toEqual([]);
  });
});
