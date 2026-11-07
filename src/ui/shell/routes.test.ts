import { describe, expect, it } from 'vitest';
import { panelParentPath, parseRoute, showsMonth, tabPath, withMonth } from './routes';

describe('parseRoute', () => {
  it('maps the documented addresses', () => {
    expect(parseRoute('/')).toEqual({ module: 'inicio' });
    expect(parseRoute('/financas')).toEqual({ module: 'financas', tab: 'visao-geral' });
    expect(parseRoute('/financas/')).toEqual({ module: 'financas', tab: 'visao-geral' });
    expect(parseRoute('/financas/gastos')).toEqual({ module: 'financas', tab: 'gastos' });
    expect(parseRoute('/financas/gastos/abc')).toEqual({ module: 'financas', tab: 'gastos', detailId: 'abc' });
    expect(parseRoute('/financas/metas/m1')).toEqual({ module: 'financas', tab: 'metas', detailId: 'm1' });
    expect(parseRoute('/financas/caixinhas/c1')).toEqual({ module: 'financas', tab: 'caixinhas', detailId: 'c1' });
    expect(parseRoute('/financas/graficos/categoria')).toEqual({ module: 'financas', tab: 'graficos' });
    expect(parseRoute('/investimentos')).toEqual({ module: 'investimentos' });
    expect(parseRoute('/patrimonio')).toEqual({ module: 'patrimonio' });
    expect(parseRoute('/cofre')).toEqual({ module: 'cofre' });
    expect(parseRoute('/ajustes')).toEqual({ module: 'ajustes' });
    expect(parseRoute('/ajustes/regras')).toEqual({ module: 'ajustes' });
  });

  it('rejects anything else', () => {
    for (const path of ['/inicio', '/financas/visao-geral', '/financas/nada', '/financas/gastos/a/b', '/cofre/x', '/membros', '/financas/gastos/%E0']) {
      expect(parseRoute(path), path).toEqual({ module: 'not_found' });
    }
  });
});

describe('the detail panel', () => {
  it('closes back to the list it opened over', () => {
    expect(panelParentPath(parseRoute('/financas/gastos/abc'))).toBe('/financas/gastos');
    expect(panelParentPath(parseRoute('/financas/gastos'))).toBeNull();
    expect(panelParentPath(parseRoute('/cofre'))).toBeNull();
  });
});

describe('links', () => {
  it('keep the selected month', () => {
    expect(withMonth(tabPath('metas'), '2026-10')).toBe('/financas/metas?mes=2026-10');
    expect(withMonth(tabPath('visao-geral'), null)).toBe('/financas');
  });

  it('show the month selector only where a month matters', () => {
    expect(showsMonth(parseRoute('/financas/gastos'))).toBe(true);
    expect(showsMonth(parseRoute('/cofre'))).toBe(false);
  });
});
