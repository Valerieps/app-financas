import { describe, expect, it } from 'vitest';
import { addMonths, calendarStart, dayState, isBareDay, monthGrid, transactionDay } from './calendar';

describe('Cofre calendar', () => {
  it('takes a bare Pluggy day as written and a real instant in Brasília', () => {
    expect(transactionDay('2026-10-01T00:00:00.000Z')).toBe('2026-10-01');
    expect(transactionDay('2026-10-01')).toBe('2026-10-01');
    expect(transactionDay('2026-10-01T03:00:00.000Z')).toBe('2026-10-01');
    expect(transactionDay('2026-10-02T01:30:00.000Z')).toBe('2026-10-01');
    expect(transactionDay('2026-10-01T15:00:00-03:00')).toBe('2026-10-01');
  });

  it('starts 12 months before today, clamping to the end of a short month', () => {
    expect(calendarStart('2026-11-04')).toBe('2025-11-04');
    expect(calendarStart('2028-02-29')).toBe('2027-02-28');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2025-12', 1)).toBe('2026-01');
  });

  it('lays a month out in weeks starting on Sunday', () => {
    const weeks = monthGrid('2026-11'); // 1 Nov 2026 is a Sunday
    expect(weeks[0]?.[0]).toBe('2026-11-01');
    expect(weeks.at(-1)).toEqual(['2026-11-29', '2026-11-30', null, null, null, null, null]);
    expect(monthGrid('2026-10')[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('marks an empty day red until the owner confirms it', () => {
    const range = { from: '2025-11-04', to: '2026-11-04' };
    expect(dayState('2026-11-03', range, 2, false)).toBe('some');
    expect(dayState('2026-11-03', range, 0, false)).toBe('missing');
    expect(dayState('2026-11-03', range, 0, true)).toBe('confirmed');
    expect(dayState('2026-11-05', range, 0, false)).toBe('outside');
    expect(dayState('2025-11-03', range, 0, false)).toBe('outside');
  });
});

describe('isBareDay', () => {
  it('tells a bare day from an instant', () => {
    expect(isBareDay('2026-11-01')).toBe(true);
    expect(isBareDay('2026-11-01T00:00:00.000Z')).toBe(true);
    expect(isBareDay('2026-11-01T15:30:00.000Z')).toBe(false);
  });
});
