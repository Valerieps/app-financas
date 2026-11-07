import { describe, expect, it } from 'vitest';
import { dayCell, dayLabel, direction, matchesAccounts, matchesFilter, monthDays, parseDirectionFilter, sortByDay, toggleAccount, totals } from './lancamentos';

describe('direction', () => {
  it("follows Pluggy's type", () => {
    expect(direction('CREDIT', -100, 'BANK')).toBe('in');
    expect(direction('DEBIT', 100, 'CREDIT')).toBe('out');
  });

  it('falls back to the sign, reversed on a card', () => {
    expect(direction(null, -100, 'BANK')).toBe('out');
    expect(direction(null, 100, 'BANK')).toBe('in');
    expect(direction(null, 100, 'CREDIT')).toBe('out');
    expect(direction(null, -100, 'CREDIT')).toBe('in');
  });
});

describe('monthDays', () => {
  it('knows the last day of each month', () => {
    expect(monthDays('2026-11')).toEqual({ first: '2026-11-01', last: '2026-11-30' });
    expect(monthDays('2026-12')).toEqual({ first: '2026-12-01', last: '2026-12-31' });
    expect(monthDays('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
  });
});

describe('totals', () => {
  it('sums in and out per currency, BRL first', () => {
    expect(
      totals([
        { currency: 'USD', direction: 'out', amountCents: 500 },
        { currency: 'BRL', direction: 'out', amountCents: 1000 },
        { currency: 'BRL', direction: 'in', amountCents: 300 },
        { currency: 'BRL', direction: 'out', amountCents: 50 },
      ]),
    ).toEqual([
      { currency: 'BRL', inCents: 300, outCents: 1050 },
      { currency: 'USD', inCents: 0, outCents: 500 },
    ]);
  });
});

describe('sortByDay', () => {
  it('puts the newest day first and keeps the order inside a day', () => {
    const sorted = sortByDay([
      { day: '2026-11-01', id: 'a' },
      { day: '2026-11-03', id: 'b' },
      { day: '2026-11-01', id: 'c' },
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('the account filter', () => {
  it('keeps every account when none is chosen', () => {
    expect(matchesAccounts([], 'Nubank cartão')).toBe(true);
    expect(matchesAccounts(['Nubank conta'], 'Nubank cartão')).toBe(false);
    expect(matchesAccounts(['Nubank conta', 'Nubank cartão'], 'Nubank cartão')).toBe(true);
  });

  it('adds an account on a tap and takes it out on the next', () => {
    expect(toggleAccount(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleAccount(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('the direction filter', () => {
  it('reads the URL and defaults to everything', () => {
    expect(parseDirectionFilter('entradas')).toBe('entradas');
    expect(parseDirectionFilter('saidas')).toBe('saidas');
    expect(parseDirectionFilter(null)).toBe('todos');
    expect(parseDirectionFilter('x')).toBe('todos');
  });

  it('keeps what matches', () => {
    expect(matchesFilter('todos', 'in')).toBe(true);
    expect(matchesFilter('entradas', 'in')).toBe(true);
    expect(matchesFilter('entradas', 'out')).toBe(false);
    expect(matchesFilter('saidas', 'out')).toBe(true);
  });
});

describe('dayLabel', () => {
  const words = { today: 'Hoje', yesterday: 'Ontem' };
  it('names today and yesterday, and gives the weekday', () => {
    expect(dayLabel('2026-11-07', '2026-11-07', words)).toBe('Hoje · sáb, 7 nov');
    expect(dayLabel('2026-11-06', '2026-11-07', words)).toBe('Ontem · sex, 6 nov');
    expect(dayLabel('2026-11-05', '2026-11-07', words)).toBe('qui, 5 nov');
    expect(dayLabel('2026-10-31', '2026-11-01', words)).toBe('Ontem · sáb, 31 out');
  });
});

describe('dayCell', () => {
  const words = { today: 'Hoje', yesterday: 'Ontem' };
  it('says only Hoje or Ontem for those days', () => {
    expect(dayCell('2026-11-07', '2026-11-07', words)).toBe('Hoje');
    expect(dayCell('2026-11-06', '2026-11-07', words)).toBe('Ontem');
    expect(dayCell('2026-11-05', '2026-11-07', words)).toBe('qui, 5 nov');
  });
});
