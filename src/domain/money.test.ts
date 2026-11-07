import { describe, expect, it } from 'vitest';
import { money, moneyDiff, moneyShort, moneyWhole } from './money';

describe('money', () => {
  it('writes reais with cents', () => {
    expect(money(120000)).toBe('R$ 1.200,00');
    expect(money(41230)).toBe('R$ 412,30');
  });

  it('writes whole reais', () => {
    expect(moneyWhole(6200)).toBe('R$ 62');
    expect(moneyWhole(6249)).toBe('R$ 62');
    expect(moneyWhole(120000)).toBe('R$ 1.200');
  });

  it('writes a short value next to a bar', () => {
    expect(moneyShort(41230)).toBe('R$ 412');
    expect(moneyShort(120000)).toBe('R$ 1,2 mil');
    expect(moneyShort(200000)).toBe('R$ 2 mil');
    expect(moneyShort(1534000)).toBe('R$ 15 mil');
  });

  it('writes a difference with its sign', () => {
    expect(moneyDiff(1430)).toBe('+ R$ 14,30');
    expect(moneyDiff(-2110)).toBe('− R$ 21,10');
  });
});
