// The desktop's addresses (docs/rascunhos/arquitetura-desktop.md, "Endereços"): every screen has a
// URL, and the detail panel opens over a list at /financas/<list>/:id.

export type ModuleId = 'inicio' | 'financas' | 'investimentos' | 'patrimonio' | 'regras' | 'categorias' | 'cofre' | 'ajustes';
export type FinancasTab = 'visao-geral' | 'lancamentos' | 'cartao' | 'graficos' | 'metas' | 'caixinhas';

export const MODULES: readonly ModuleId[] = ['inicio', 'financas', 'investimentos', 'patrimonio'];
export const SYSTEM_MODULES: readonly ModuleId[] = ['regras', 'categorias', 'cofre', 'ajustes'];
export const FINANCAS_TABS: readonly FinancasTab[] = ['visao-geral', 'lancamentos', 'cartao', 'graficos', 'metas', 'caixinhas'];

export type Route =
  | { readonly module: Exclude<ModuleId, 'financas'> }
  | { readonly module: 'financas'; readonly tab: FinancasTab; readonly detailId?: string }
  | { readonly module: 'not_found' };

/** The lists whose items open in the detail panel. */
const PANEL_TABS: ReadonlySet<FinancasTab> = new Set(['lancamentos', 'metas', 'caixinhas']);

export function modulePath(module: ModuleId): string {
  return module === 'inicio' ? '/' : `/${module}`;
}

export function tabPath(tab: FinancasTab): string {
  return tab === 'visao-geral' ? '/financas' : `/financas/${tab}`;
}

export function parseRoute(pathname: string): Route {
  let parts: string[];
  try {
    parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { module: 'not_found' };
  }
  const [first, second, third, ...rest] = parts;
  if (!first) return { module: 'inicio' };
  if (first === 'financas') {
    if (!second) return { module: 'financas', tab: 'visao-geral' };
    const tab = FINANCAS_TABS.find((t) => t === second && t !== 'visao-geral');
    if (!tab || rest.length > 0) return { module: 'not_found' };
    if (third === undefined) return { module: 'financas', tab };
    // /financas/graficos/categoria picks a chart, not a panel item.
    if (tab === 'graficos') return GRAFICOS_CHARTS.some((c) => c === third) ? { module: 'financas', tab } : { module: 'not_found' };
    return PANEL_TABS.has(tab) ? { module: 'financas', tab, detailId: third } : { module: 'not_found' };
  }
  // /ajustes/:secao lands on Ajustes; its sections do not exist yet.
  if (first === 'ajustes' && parts.length <= 2) return { module: 'ajustes' };
  const module = [...MODULES, ...SYSTEM_MODULES].find((m) => m === first && m !== 'inicio' && m !== 'financas');
  return module && parts.length === 1 ? { module: module as Exclude<ModuleId, 'financas'> } : { module: 'not_found' };
}

/** The charts of Finanças › Gráficos, each at /financas/graficos/<chart>. */
export type GraficosChart = 'categoria' | 'tag' | 'importancia' | 'tempo';
export const GRAFICOS_CHARTS: readonly GraficosChart[] = ['categoria', 'tag', 'importancia', 'tempo'];

/** Which chart a Gráficos path shows; /financas/graficos alone shows Por categoria. */
export function graficosChart(pathname: string): GraficosChart {
  const third = pathname.split('/').filter(Boolean)[2];
  return GRAFICOS_CHARTS.find((c) => c === third) ?? 'categoria';
}

export function graficosPath(chart: GraficosChart): string {
  return `${tabPath('graficos')}/${chart}`;
}

/** Where closing the detail panel goes: back to the list it opened over. */
export function panelParentPath(route: Route): string | null {
  return route.module === 'financas' && route.detailId !== undefined ? tabPath(route.tab) : null;
}

/** Whether the header shows the month selector: only screens that look at a month. */
export function showsMonth(route: Route): boolean {
  return route.module === 'financas' || route.module === 'inicio';
}

/** Adds the selected month to an internal link, so moving between screens keeps it. */
export function withMonth(path: string, monthKey: string | null): string {
  return monthKey ? `${path}?mes=${encodeURIComponent(monthKey)}` : path;
}

/**
 * An internal link that keeps the current query (the month and the list's filters), changing only
 * `changes`; a null value drops that parameter.
 */
export function withQuery(path: string, search: URLSearchParams, changes: Readonly<Record<string, string | null>> = {}): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
