// Line icons from the desktop drafts (docs/rascunhos/desktop-telas/), drawn with currentColor.
import type { ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  inicio: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  financas: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 15h2" />
    </>
  ),
  investimentos: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </>
  ),
  patrimonio: <path d="M3 21h18M5 21v-9M10 21v-9M14 21v-9M19 21v-9M2 10l10-6 10 6z" />,
  regras: (
    <>
      <path d="M13 3 5 14h6l-1 7 8-11h-6z" />
    </>
  ),
  categorias: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  cofre: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9V7M15 12h2" />
    </>
  ),
  ajustes: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  previous: <path d="m15 6-6 6 6 6" />,
  next: <path d="m9 6 6 6-6 6" />,
  sidebar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  // The funnel of a column's filter.
  filter: <path d="M3 4h18l-7 8.5V19l-4 2v-8.5z" />,
  // A column's sort, A to Z (or Z to A) along a down arrow.
  sortAsc: <path d="M3 11 6 3l3 8M4.1 8.5h3.8M3 13h6l-6 8h6M18 3v18m-4-4 4 4 4-4" />,
  sortDesc: <path d="M3 3h6l-6 8h6M3 21l3-8 3 8M4.1 18.5h3.8M18 3v18m-4-4 4 4 4-4" />,
  // A column that always shows.
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
