import { describe, expect, it } from 'vitest';
import {
  below,
  categoryChart,
  categoryOf,
  comparisonMonths,
  furthestAbove,
  monthlyChart,
  spendingCents,
  throughDay,
  trend,
  type SpendingItem,
} from './spending';

describe('categoryOf', () => {
  it('takes the categoria from the top of the Pluggy tree, the longest prefix first', () => {
    expect(categoryOf('11010000')).toBe('restaurante');
    expect(categoryOf('11020000')).toBe('restaurante');
    expect(categoryOf('10000000')).toBe('mercado');
    expect(categoryOf('17020002')).toBe('moradia');
    expect(categoryOf('19050001')).toBe('transporte');
    expect(categoryOf('09020000')).toBe('assinaturas');
    expect(categoryOf('07010001')).toBe('servicos');
    expect(categoryOf('07020002')).toBe('educacao');
    expect(categoryOf('07040003')).toBe('lazer');
  });

  it('puts what it does not know in Outros', () => {
    expect(categoryOf(null)).toBe('outros');
    expect(categoryOf('')).toBe('outros');
    expect(categoryOf('99000000')).toBe('outros');
  });
});

describe('spendingCents', () => {
  const t = (over: Partial<Parameters<typeof spendingCents>[0]>) =>
    spendingCents({ type: 'DEBIT', amountCents: -1000, accountType: 'BANK', pluggyCategoryId: '10000000', ...over });

  it('counts money out of the account and purchases on the card', () => {
    expect(t({})).toBe(1000);
    expect(t({ accountType: 'CREDIT', amountCents: 4590 })).toBe(4590);
  });

  it('takes a refund on the card off the gastos', () => {
    expect(t({ accountType: 'CREDIT', type: 'CREDIT', amountCents: -2000 })).toBe(-2000);
  });

  it('leaves out money in, investments, my own transfers and the card bill', () => {
    expect(t({ type: 'CREDIT', amountCents: 500000, pluggyCategoryId: '01010000' })).toBeNull();
    expect(t({ pluggyCategoryId: '03020000' })).toBeNull();
    expect(t({ pluggyCategoryId: '04020000' })).toBeNull();
    expect(t({ pluggyCategoryId: '05100000' })).toBeNull();
    expect(t({ accountType: 'CREDIT', type: 'CREDIT', amountCents: -80000, pluggyCategoryId: '05100000' })).toBeNull();
  });

  it('counts a Pix to someone else', () => {
    expect(t({ pluggyCategoryId: '05070000' })).toBe(1000);
  });

  it('reads the sign when the type is missing', () => {
    expect(t({ type: null })).toBe(1000);
    expect(t({ type: null, amountCents: 1000 })).toBeNull();
    expect(t({ type: null, accountType: 'CREDIT', amountCents: 1000 })).toBe(1000);
    expect(t({ type: null, accountType: 'CREDIT', amountCents: -1000 })).toBe(-1000);
  });
});

describe('the month and its comparison', () => {
  it('counts the current month up to today, a past month whole, a future month not at all', () => {
    expect(throughDay('2026-11', '2026-11-07')).toBe(7);
    expect(throughDay('2026-10', '2026-11-07')).toBeNull();
    expect(throughDay('2026-12', '2026-11-07')).toBe(0);
  });

  it('compares with the 3 months before, or the one before', () => {
    expect(comparisonMonths('2026-02', 'average')).toEqual(['2025-11', '2025-12', '2026-01']);
    expect(comparisonMonths('2026-02', 'previous')).toEqual(['2026-01']);
  });
});

const item = (day: string, category: SpendingItem['category'], cents: number): SpendingItem => ({ day, category, cents });

describe('categoryChart', () => {
  const items = [
    item('2026-11-03', 'restaurante', 18640),
    item('2026-11-05', 'mercado', 41230),
    item('2026-11-08', 'mercado', 99999), // after today: not counted
    item('2026-11-02', 'outros', 5300),
    item('2026-10-04', 'restaurante', 12000),
    item('2026-10-20', 'restaurante', 50000), // after the same day: not counted
    item('2026-09-01', 'restaurante', 15000),
    item('2026-08-07', 'restaurante', 10320),
    item('2026-08-06', 'transporte', 9000),
    item('2026-07-01', 'restaurante', 77777), // older than 3 months
  ];

  it('compares each categoria with the average of the 3 months before, up to the same day', () => {
    const chart = categoryChart(items, '2026-11', '2026-11-07', 'average');
    expect(chart.throughDay).toBe(7);
    expect(chart.compareMonths).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(chart.rows).toEqual([
      { category: 'mercado', cents: 41230, baselineCents: 0 },
      { category: 'restaurante', cents: 18640, baselineCents: 12440 },
      { category: 'transporte', cents: 0, baselineCents: 3000 },
      { category: 'outros', cents: 5300, baselineCents: 0 },
    ]);
    expect(chart.totalCents).toBe(65170);
    expect(chart.baselineTotalCents).toBe(15440);
  });

  it('compares with the month before', () => {
    const chart = categoryChart(items, '2026-11', '2026-11-07', 'previous');
    expect(chart.compareMonths).toEqual(['2026-10']);
    expect(chart.rows.find((r) => r.category === 'restaurante')).toEqual({ category: 'restaurante', cents: 18640, baselineCents: 12000 });
  });

  it('averages only the months that have gastos', () => {
    const chart = categoryChart([item('2026-11-01', 'mercado', 3000), item('2026-10-01', 'mercado', 1000)], '2026-11', '2026-11-07', 'average');
    expect(chart.compareMonths).toEqual(['2026-10']);
    expect(chart.rows[0]?.baselineCents).toBe(1000);
  });

  it('has no comparison without earlier months', () => {
    const chart = categoryChart([item('2026-11-01', 'mercado', 3000)], '2026-11', '2026-11-07', 'average');
    expect(chart.rows).toEqual([{ category: 'mercado', cents: 3000, baselineCents: null }]);
    expect(chart.baselineTotalCents).toBeNull();
  });

  it('takes whole months for a past month', () => {
    const chart = categoryChart(items, '2026-10', '2026-11-07', 'previous');
    expect(chart.throughDay).toBeNull();
    expect(chart.rows).toEqual([{ category: 'restaurante', cents: 62000, baselineCents: 15000 }]);
  });
});

describe('trend', () => {
  it('reads small differences as igual', () => {
    expect(trend(120000, 119400)).toBe('igual');
    expect(trend(7970, 7900)).toBe('igual');
    expect(trend(41230, 39800)).toBe('acima');
    expect(trend(500, 1400)).toBe('abaixo');
    expect(trend(0, 0)).toBe('igual');
  });

  it('finds the categoria furthest above and those below', () => {
    const rows = [
      { category: 'mercado' as const, cents: 41230, baselineCents: 39800 },
      { category: 'restaurante' as const, cents: 18640, baselineCents: 12440 },
      { category: 'transporte' as const, cents: 11890, baselineCents: 14000 },
      { category: 'outros' as const, cents: 5300, baselineCents: null },
    ];
    expect(furthestAbove(rows)?.category).toBe('restaurante');
    expect(below(rows)).toEqual(['transporte']);
    expect(furthestAbove([rows[2]!])).toBeNull();
  });
});

describe('monthlyChart', () => {
  it('sums 12 months ending at the selected one and averages the complete ones', () => {
    const chart = monthlyChart(
      [item('2026-11-02', 'mercado', 1000), item('2026-10-02', 'mercado', 3000), item('2026-09-30', 'lazer', 5000), item('2026-09-01', 'lazer', -1000)],
      '2026-11',
      '2026-11-07',
    );
    expect(chart.months).toHaveLength(12);
    expect(chart.months[0]).toEqual({ month: '2025-12', cents: null });
    expect(chart.months.slice(-3)).toEqual([
      { month: '2026-09', cents: 4000 },
      { month: '2026-10', cents: 3000 },
      { month: '2026-11', cents: 1000 },
    ]);
    expect(chart.partial).toBe(true);
    expect(chart.averageCents).toBe(3500);
  });
});
