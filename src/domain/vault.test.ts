import { describe, expect, it } from 'vitest';
import { addDays, matchKeys, numberSuffix, saoPauloDate, saoPauloHour, toCents } from './vault';

describe('vault rules', () => {
  it('turns decimal money into integer cents without float drift', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(-0.1 - 0.2)).toBe(-30);
    expect(toCents(1234567.891)).toBe(123456789);
    expect(toCents(null)).toBeNull();
    expect(toCents('10')).toBeNull();
  });

  it('dates and hours follow Brasília, not UTC', () => {
    expect(saoPauloDate(new Date('2026-11-03T02:30:00Z'))).toBe('2026-11-02');
    expect(saoPauloDate(new Date('2026-11-03T03:00:00Z'))).toBe('2026-11-03');
    expect(saoPauloHour(new Date('2026-11-02T10:00:00Z'))).toBe(7);
    expect(addDays('2026-11-02', -40)).toBe('2026-09-23');
  });

  it('keeps only the last four digits of an account number', () => {
    expect(numberSuffix('12345-6')).toBe('3456');
    expect(numberSuffix(null)).toBeNull();
  });

  it('matches by providerId, or by day, amount, description and position among identical ones', () => {
    const a = { providerId: 'X1', date: '2026-10-01T00:00:00.000Z', amount: 10, description: 'Café' };
    const b = { providerId: null, date: '2026-10-01T03:00:00.000Z', amount: 10, description: ' café  da esquina ' };
    const c = { providerId: null, date: '2026-10-01T00:00:00.000Z', amount: 10, description: 'CAFÉ DA ESQUINA' };
    const keys = matchKeys([a, b, c]);
    expect(keys.get(a)).toBe('p:X1');
    expect(keys.get(b)).toBe('f:2026-10-01|1000|CAFÉ DA ESQUINA|0');
    expect(keys.get(c)).toBe('f:2026-10-01|1000|CAFÉ DA ESQUINA|1');
  });
});
