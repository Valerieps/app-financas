import { describe, expect, it } from 'vitest';
import { monthKey, monthOf, parseMonth, shiftMonth } from './month';

describe('month', () => {
  it('parses only well-formed keys', () => {
    expect(parseMonth('2026-11')).toEqual({ year: 2026, month: 11 });
    for (const bad of ['2026-13', '2026-00', '2026-1', '26-11', 'novembro', '', null, undefined]) {
      expect(parseMonth(bad), String(bad)).toBeNull();
    }
  });

  it('writes the key back with padding', () => {
    expect(monthKey({ year: 2026, month: 3 })).toBe('2026-03');
  });

  it('shifts across year boundaries', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 5 }, -17)).toEqual({ year: 2024, month: 12 });
  });

  it('takes the month on the São Paulo clock', () => {
    // 02:00 UTC on 1 Dec is still 30 Nov, 23:00, in São Paulo.
    expect(monthOf(new Date('2026-12-01T02:00:00Z'))).toEqual({ year: 2026, month: 11 });
    expect(monthOf(new Date('2026-12-01T04:00:00Z'))).toEqual({ year: 2026, month: 12 });
  });
});
