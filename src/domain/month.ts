// A calendar month, as the desktop's month selector and URLs carry it: "2026-11".
export interface Month {
  readonly year: number;
  /** 1 to 12. */
  readonly month: number;
}

const KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseMonth(key: string | null | undefined): Month | null {
  const match = key ? KEY.exec(key) : null;
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

export function monthKey({ year, month }: Month): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function shiftMonth({ year, month }: Month, delta: number): Month {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The month `now` falls in, on the owner's clock (São Paulo), not the device's or UTC. */
export function monthOf(now: Date, timeZone = 'America/Sao_Paulo'): Month {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month') };
}
