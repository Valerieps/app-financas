import { describe, expect, it } from 'vitest';
import { graficosChart, graficosPath, panelParentPath, parseRoute, showsMonth, tabPath, withMonth, withQuery } from './routes';

describe('parseRoute', () => {
  it('maps the documented addresses', () => {
    expect(parseRoute('/')).toEqual({ module: 'inicio' });
    expect(parseRoute('/financas')).toEqual({ module: 'financas', tab: 'visao-geral' });
    expect(parseRoute('/financas/')).toEqual({ module: 'financas', tab: 'visao-geral' });
    expect(parseRoute('/financas/lancamentos')).toEqual({ module: 'financas', tab: 'lancamentos' });
    expect(parseRoute('/financas/lancamentos/abc')).toEqual({ module: 'financas', tab: 'lancamentos', detailId: 'abc' });
    expect(parseRoute('/financas/metas/m1')).toEqual({ module: 'financas', tab: 'metas', detailId: 'm1' });
    expect(parseRoute('/financas/caixinhas/c1')).toEqual({ module: 'financas', tab: 'caixinhas', detailId: 'c1' });
    expect(parseRoute('/financas/graficos/categoria')).toEqual({ module: 'financas', tab: 'graficos' });
    expect(parseRoute('/financas/cartao')).toEqual({ module: 'financas', tab: 'cartao' });
    expect(parseRoute('/financas/cartao/x')).toEqual({ module: 'not_found' });
    expect(parseRoute('/investimentos')).toEqual({ module: 'investimentos' });
    expect(parseRoute('/patrimonio')).toEqual({ module: 'patrimonio' });
    expect(parseRoute('/categorias')).toEqual({ module: 'categorias' });
    expect(parseRoute('/cofre')).toEqual({ module: 'cofre' });
    expect(parseRoute('/ajustes')).toEqual({ module: 'ajustes' });
    expect(parseRoute('/ajustes/regras')).toEqual({ module: 'ajustes' });
  });

  it('rejects anything else', () => {
    for (const path of ['/inicio', '/financas/visao-geral', '/financas/nada', '/financas/lancamentos/a/b', '/cofre/x', '/categorias/x', '/membros', '/financas/lancamentos/%E0']) {
      expect(parseRoute(path), path).toEqual({ module: 'not_found' });
    }
  });
});

describe('the detail panel', () => {
  it('closes back to the list it opened over', () => {
    expect(panelParentPath(parseRoute('/financas/lancamentos/abc'))).toBe('/financas/lancamentos');
    expect(panelParentPath(parseRoute('/financas/lancamentos'))).toBeNull();
    expect(panelParentPath(parseRoute('/cofre'))).toBeNull();
  });
});

describe('links', () => {
  it('keep the selected month', () => {
    expect(withMonth(tabPath('metas'), '2026-10')).toBe('/financas/metas?mes=2026-10');
    expect(withMonth(tabPath('visao-geral'), null)).toBe('/financas');
  });

  it('keep the filters and change only what is asked', () => {
    const search = new URLSearchParams('mes=2026-10&tipo=entradas');
    expect(withQuery('/financas/lancamentos/t1', search)).toBe('/financas/lancamentos/t1?mes=2026-10&tipo=entradas');
    expect(withQuery('/financas/lancamentos', search, { mes: '2026-11' })).toBe('/financas/lancamentos?mes=2026-11&tipo=entradas');
    expect(withQuery('/financas/lancamentos', search, { tipo: null, mes: null })).toBe('/financas/lancamentos');
  });

  it('show the month selector only where a month matters', () => {
    expect(showsMonth(parseRoute('/financas/lancamentos'))).toBe(true);
    expect(showsMonth(parseRoute('/cofre'))).toBe(false);
  });
});

describe('Gráficos', () => {
  it('knows its three charts and nothing else', () => {
    expect(parseRoute('/financas/graficos/tempo')).toEqual({ module: 'financas', tab: 'graficos' });
    expect(parseRoute('/financas/graficos/pizza')).toEqual({ module: 'not_found' });
    expect(graficosChart('/financas/graficos')).toBe('categoria');
    expect(graficosChart('/financas/graficos/importancia')).toBe('importancia');
    expect(graficosPath('tempo')).toBe('/financas/graficos/tempo');
  });
});
