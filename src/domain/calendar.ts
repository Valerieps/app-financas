// The Cofre calendar (docs/spec/cofre-de-dados.md, "Tela Cofre"): how many transactions each day
// of the last 12 months has, per account, and which empty days the owner confirmed.
import { saoPauloDate } from './vault';

/** How far back the calendar goes. */
export const CALENDAR_MONTHS = 12;

/**
 * The Brasília day (yyyy-mm-dd) of a Pluggy transaction date. Pluggy sends a bare day as midnight
 * UTC; read through the time zone, that would fall on the day before, so it is taken as written.
 */
export function transactionDay(date: string): string {
  if (isBareDay(date)) return date.slice(0, 10);
  const instant = new Date(date);
  return Number.isNaN(instant.getTime()) ? date.slice(0, 10) : saoPauloDate(instant);
}

/** Whether a Pluggy date carries only a day (midnight UTC), with no time of its own. */
export function isBareDay(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T00:00(:00(\.0+)?)?(Z|\+00:00)?)?$/.test(date);
}

/** The first day the calendar shows: the same day, 12 months before today (yyyy-mm-dd). */
export function calendarStart(today: string): string {
  const month = addMonths(today.slice(0, 7), -CALENDAR_MONTHS);
  const day = Math.min(Number(today.slice(8, 10)), daysInMonth(month));
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** Shifts a month (yyyy-mm) by whole months. */
export function addMonths(month: string, months: number): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const index = year * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function daysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/** The month's weeks, Sunday first; days outside the month are null. */
export function monthGrid(month: string): (string | null)[][] {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const firstWeekday = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth(month); day++) cells.push(`${month}-${String(day).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * What a day's dot says: `outside` before the calendar starts or after today; `missing` with no
 * transaction and no confirmation (red); `confirmed` when the owner said zero is right.
 */
export type DayState = 'outside' | 'some' | 'missing' | 'confirmed';

export function dayState(day: string, range: { readonly from: string; readonly to: string }, count: number, confirmedEmpty: boolean): DayState {
  if (day < range.from || day > range.to) return 'outside';
  if (count > 0) return 'some';
  return confirmedEmpty ? 'confirmed' : 'missing';
}
