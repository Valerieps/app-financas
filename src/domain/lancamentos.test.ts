import { describe, expect, it } from 'vitest';
import { DEFAULT_COLUMNS, DEFAULT_SORT, EMPTY_CHOICE, cardPaymentWithChoice, columnTemplate, lancamentoKind, parseColumns, toggleColumn, clickSelection, isCardPayment, dayCell, dayLabel, direction, matchesAccounts, matchesChoice, matchesDirections, monthDays, nextSort, parseDirectionFilters, parseSort, sortByDay, sortLancamentos, sortParams, toggleChoice, totals } from './lancamentos';

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

  it('adds a choice on a tap and takes it out on the next', () => {
    expect(toggleChoice(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleChoice(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('a filter with Vazio', () => {
  it('keeps everything when none is chosen, and Vazio keeps the ones without a value', () => {
    expect(matchesChoice([], null)).toBe(true);
    expect(matchesChoice(['05'], '05')).toBe(true);
    expect(matchesChoice(['05'], null)).toBe(false);
    expect(matchesChoice(['05', EMPTY_CHOICE], null)).toBe(true);
    expect(matchesChoice([EMPTY_CHOICE], '05')).toBe(false);
    expect(matchesChoice([EMPTY_CHOICE], '')).toBe(true);
  });
});

describe('the direction filter', () => {
  it('reads every kind in the URL and ignores the rest', () => {
    expect(parseDirectionFilters(['cartao', 'x', 'saidas'])).toEqual(['saidas', 'cartao']);
    expect(parseDirectionFilters([])).toEqual([]);
  });

  it('keeps what matches any chosen kind; none chosen keeps everything', () => {
    const plain = (direction: 'in' | 'out') => ({ direction, cardPayment: false });
    expect(matchesDirections([], plain('in'))).toBe(true);
    expect(matchesDirections(['entradas'], plain('in'))).toBe(true);
    expect(matchesDirections(['entradas'], plain('out'))).toBe(false);
    expect(matchesDirections(['saidas', 'entradas'], plain('out'))).toBe(true);
    expect(matchesDirections(['cartao'], plain('out'))).toBe(false);
  });

  it('isolates card bill payments under cartao', () => {
    const paid = { direction: 'out' as const, cardPayment: true };
    const received = { direction: 'in' as const, cardPayment: true };
    expect(matchesDirections(['cartao'], paid)).toBe(true);
    expect(matchesDirections(['cartao'], received)).toBe(true);
    expect(matchesDirections(['saidas'], paid)).toBe(false);
    expect(matchesDirections(['entradas'], received)).toBe(false);
    expect(matchesDirections(['saidas', 'cartao'], paid)).toBe(true);
    expect(matchesDirections([], paid)).toBe(true);
  });
});

describe('totals and card bill payments', () => {
  it('leaves card bill payments out', () => {
    expect(
      totals([
        { currency: 'BRL', direction: 'out', amountCents: 1000 },
        { currency: 'BRL', direction: 'out', amountCents: 90000, cardPayment: true },
        { currency: 'BRL', direction: 'in', amountCents: 90000, cardPayment: true },
      ]),
    ).toEqual([{ currency: 'BRL', inCents: 0, outCents: 1000 }]);
  });
});

describe('isCardPayment', () => {
  const t = (over: Partial<Parameters<typeof isCardPayment>[0]>) =>
    isCardPayment({ type: 'DEBIT', amountCents: -90000, accountType: 'BANK', pluggyCategoryId: null, description: null, ...over });

  it("trusts Pluggy's credit card payment category on either side", () => {
    expect(t({ pluggyCategoryId: '05100000' })).toBe(true);
    expect(t({ accountType: 'CREDIT', type: 'CREDIT', pluggyCategoryId: '05100000' })).toBe(true);
    expect(t({ pluggyCategoryId: '05070000', description: 'Transferência' })).toBe(false);
  });

  it('reads the description of the debit in the bank account', () => {
    expect(t({ description: 'Pagamento de fatura' })).toBe(true);
    expect(t({ description: 'PAGAMENTO DA FATURA' })).toBe(true);
    expect(t({ description: 'Pagamento de fatura', type: 'CREDIT', amountCents: 90000 })).toBe(false);
    expect(t({ description: 'Mercado' })).toBe(false);
  });

  it('reads the description of the credit on the card', () => {
    const card = { accountType: 'CREDIT', type: 'CREDIT' };
    expect(t({ ...card, description: 'Pagamento recebido' })).toBe(true);
    expect(t({ ...card, description: 'Estorno de compra' })).toBe(false);
    expect(t({ accountType: 'CREDIT', type: 'DEBIT', amountCents: 90000, description: 'Pagamento recebido' })).toBe(false);
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

describe('sorting', () => {
  const item = (day: string, description: string | null, category: string | null, amountCents: number) => ({ day, description, category, amountCents });
  const a = item('2026-11-03', 'Padaria', 'Mercado', 1500);
  const b = item('2026-11-05', 'açougue', null, 9000);
  const c = item('2026-11-01', null, 'Bares', 300);

  it('reads the sort from the URL, newest day first by default', () => {
    expect(parseSort(null, null)).toEqual({ column: 'data', direction: 'desc' });
    expect(parseSort('valor', null)).toEqual({ column: 'valor', direction: 'desc' });
    expect(parseSort('descricao', null)).toEqual({ column: 'descricao', direction: 'asc' });
    expect(parseSort('outra', 'asc')).toEqual({ column: 'data', direction: 'asc' });
  });

  it('flips the same column and starts another in its first direction', () => {
    expect(nextSort(DEFAULT_SORT, 'data')).toEqual({ column: 'data', direction: 'asc' });
    expect(nextSort(DEFAULT_SORT, 'valor')).toEqual({ column: 'valor', direction: 'desc' });
    expect(nextSort({ column: 'valor', direction: 'desc' }, 'categoria')).toEqual({ column: 'categoria', direction: 'asc' });
  });

  it('leaves the default out of the URL', () => {
    expect(sortParams(DEFAULT_SORT)).toEqual({ ordem: null, sentido: null });
    expect(sortParams({ column: 'valor', direction: 'desc' })).toEqual({ ordem: 'valor', sentido: null });
    expect(sortParams({ column: 'valor', direction: 'asc' })).toEqual({ ordem: 'valor', sentido: 'asc' });
    expect(parseSort('valor', 'asc')).toEqual({ column: 'valor', direction: 'asc' });
  });

  it('sorts by each column', () => {
    expect(sortLancamentos([a, b, c], { column: 'data', direction: 'desc' })).toEqual([b, a, c]);
    expect(sortLancamentos([a, b, c], { column: 'data', direction: 'asc' })).toEqual([c, a, b]);
    expect(sortLancamentos([a, b, c], { column: 'valor', direction: 'desc' })).toEqual([b, a, c]);
    expect(sortLancamentos([a, b, c], { column: 'valor', direction: 'asc' })).toEqual([c, a, b]);
  });

  it('ignores case and accents, and puts empty text last either way', () => {
    expect(sortLancamentos([a, b, c], { column: 'descricao', direction: 'asc' })).toEqual([b, a, c]);
    expect(sortLancamentos([a, b, c], { column: 'descricao', direction: 'desc' })).toEqual([a, b, c]);
    expect(sortLancamentos([a, b, c], { column: 'categoria', direction: 'asc' })).toEqual([c, a, b]);
  });

  it('breaks ties by the newest day', () => {
    const d = item('2026-11-04', 'Padaria', 'Mercado', 1500);
    expect(sortLancamentos([a, d], { column: 'valor', direction: 'desc' })).toEqual([d, a]);
  });
});

describe('clickSelection', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];

  it('toggles one box on a plain click', () => {
    expect(clickSelection(['a'], order, 'a', 'c', false)).toEqual(['a', 'c']);
    expect(clickSelection(['a', 'c'], order, 'a', 'c', false)).toEqual(['a']);
  });

  it('selects everything between the anchor and the shift-clicked box, either way', () => {
    expect(clickSelection(['b'], order, 'b', 'd', true)).toEqual(['b', 'c', 'd']);
    expect(clickSelection(['d'], order, 'd', 'b', true)).toEqual(['d', 'b', 'c']);
  });

  it('keeps what was already selected outside the range', () => {
    expect(clickSelection(['a', 'c'], order, 'c', 'e', true)).toEqual(['a', 'c', 'd', 'e']);
  });

  it('clears the range when the shift-clicked box was selected', () => {
    expect(clickSelection(['a', 'b', 'c', 'd'], order, 'a', 'c', true)).toEqual(['d']);
  });

  it('falls back to a toggle without an anchor in the list', () => {
    expect(clickSelection([], order, null, 'c', true)).toEqual(['c']);
    expect(clickSelection([], order, 'z', 'c', true)).toEqual(['c']);
  });
});

describe('cardPaymentWithChoice', () => {
  it('follows my category when I chose one, else the stored flag', () => {
    expect(cardPaymentWithChoice(true, null)).toBe(true);
    expect(cardPaymentWithChoice(false, null)).toBe(false);
    expect(cardPaymentWithChoice(true, '10000000')).toBe(false);
    expect(cardPaymentWithChoice(false, '05100000')).toBe(true);
  });
});

describe('lancamentoKind', () => {
  it('says pagamento de cartão first, else entrada or saída', () => {
    expect(lancamentoKind({ direction: 'in', cardPayment: false })).toBe('entrada');
    expect(lancamentoKind({ direction: 'out', cardPayment: false })).toBe('saida');
    expect(lancamentoKind({ direction: 'out', cardPayment: true })).toBe('cartao');
    expect(lancamentoKind({ direction: 'in', cardPayment: true })).toBe('cartao');
  });
});

describe('the list columns', () => {
  it('starts with the default columns when nothing readable is remembered', () => {
    expect(parseColumns(null)).toEqual(DEFAULT_COLUMNS);
    expect(parseColumns('not json')).toEqual(DEFAULT_COLUMNS);
    expect(parseColumns('{"a":1}')).toEqual(DEFAULT_COLUMNS);
  });

  it('keeps the table order, drops unknown columns and always keeps descrição and valor', () => {
    expect(parseColumns('["pagador","outra","data"]')).toEqual(['data', 'descricao', 'pagador', 'valor']);
    expect(parseColumns('[]')).toEqual(['descricao', 'valor']);
  });

  it('shows or hides a column, in the table order, but never a fixed one', () => {
    expect(toggleColumn(['descricao', 'valor'], 'tipo')).toEqual(['descricao', 'tipo', 'valor']);
    expect(toggleColumn(['data', 'descricao', 'tipo', 'valor'], 'tipo')).toEqual(['data', 'descricao', 'valor']);
    expect(toggleColumn(['descricao', 'valor'], 'valor')).toEqual(['descricao', 'valor']);
  });

  it('gives each shown column its share of the row', () => {
    expect(columnTemplate(['data', 'descricao', 'valor'])).toBe('minmax(0, 1fr) minmax(0, 3fr) minmax(0, 1fr)');
  });
});
