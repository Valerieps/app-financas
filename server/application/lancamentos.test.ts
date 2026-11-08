import { describe, expect, it } from 'vitest';
import type { LancamentoDetailView, LancamentosView } from '../../src/application/api-contract';
import { testContext } from '../testing/node-sql';
import { AppService } from './app-service';
import { NO_CALLER } from './lock';
import { statement } from './ports';

const NOW = '2026-11-07T12:00:00Z';

async function seed(withCardPayment = false) {
  const { ctx, sql } = testContext(NOW);
  const account = (id: string, type: string, name: string) =>
    statement(
      'INSERT INTO accounts (id, pluggy_id, item_id, type, name, currency_code, raw_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      `p-${id}`,
      'item',
      type,
      name,
      'BRL',
      '{}',
      NOW,
      NOW,
    );
  const transaction = (
    id: string,
    accountId: string,
    date: string,
    amountCents: number,
    extra: { type?: string; status?: string; description?: string; category?: string; deleted?: boolean; raw?: object } = {},
  ) =>
    statement(
      `INSERT INTO transactions (id, pluggy_id, account_id, match_key, date, amount_cents, currency_code, type, status, description,
         description_raw, pluggy_category_id, operation_type, deleted_at, raw_json, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, 'BRL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      `p-${id}`,
      accountId,
      `k-${id}`,
      date,
      amountCents,
      extra.type ?? null,
      extra.status ?? 'POSTED',
      extra.description ?? id,
      'RAW ' + id,
      extra.category ?? null,
      'PIX',
      extra.deleted ? NOW : null,
      JSON.stringify(extra.raw ?? {}),
      NOW,
      NOW,
    );
  await sql.batch([
    statement('INSERT INTO items (item_id, registered_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', 'item', NOW, NOW, NOW),
    statement(
      "INSERT INTO pluggy_categories (id, description, description_translated, raw_json, first_seen_at, last_seen_at) VALUES ('c1', 'Groceries', 'Supermercado', '{}', ?, ?)",
      NOW,
      NOW,
    ),
    statement(
      `INSERT INTO pluggy_categories (id, description, description_translated, parent_id, raw_json, first_seen_at, last_seen_at) VALUES
         ('11000000', 'Food and drinks', 'Alimentação', NULL, '{}', ?, ?),
         ('11010000', 'Restaurants', 'Restaurantes', '11000000', '{}', ?, ?),
         ('05100000', 'Credit card payment', 'Pagamento de cartão de crédito', NULL, '{}', ?, ?)`,
      NOW, NOW, NOW, NOW, NOW, NOW,
    ),
    account('bank', 'BANK', 'Conta'),
    account('card', 'CREDIT', 'Cartão'),
    transaction('salario', 'bank', '2026-11-05T00:00:00.000Z', 500000, { type: 'CREDIT' }),
    transaction('mercado', 'bank', '2026-11-06T15:00:00.000Z', -8000, { type: 'DEBIT', category: 'c1' }),
    transaction('loja', 'card', '2026-11-07T00:00:00.000Z', 4590, { type: 'DEBIT', status: 'PENDING', raw: { category: 'Shopping' } }),
    transaction('virada', 'bank', '2026-12-01T02:00:00.000Z', -100, { type: 'DEBIT' }), // 23h of 30 Nov in Brasília
    transaction('dezembro', 'bank', '2026-12-01T00:00:00.000Z', -100, { type: 'DEBIT' }),
    transaction('outubro', 'bank', '2026-10-31T00:00:00.000Z', -100, { type: 'DEBIT' }),
    transaction('apagada', 'bank', '2026-11-03T00:00:00.000Z', -100, { type: 'DEBIT', deleted: true }),
    statement(
      'INSERT INTO transaction_card_data (transaction_id, installment_number, total_installments, card_number) VALUES (?, ?, ?, ?)',
      'loja',
      1,
      3,
      '1234',
    ),
    statement('INSERT INTO transaction_payment_data (transaction_id, payer_name, receiver_name) VALUES (?, ?, ?)', 'salario', 'Empresa', 'Eu'),
  ]);
  if (withCardPayment) {
    await sql.batch([
      transaction('fatura', 'bank', '2026-11-04T12:00:00.000Z', -90000, { type: 'DEBIT', description: 'Pagamento de fatura' }),
      transaction('recebido', 'card', '2026-11-04T12:00:00.000Z', -90000, { type: 'CREDIT', description: 'Pagamento recebido' }),
      statement("UPDATE transactions SET card_payment = 1 WHERE id IN ('fatura', 'recebido')"),
    ]);
  }
  return new AppService(ctx);
}

describe('lancamentos', () => {
  it("lists the month's transactions by Brasília day, newest first, with totals", async () => {
    const service = await seed();
    const result = await service.query('lancamentos', { month: '2026-11' }, NO_CALLER);
    expect(result.ok).toBe(true);
    const view = (result as { value: LancamentosView }).value;
    expect(view.items.map((i) => [i.id, i.day])).toEqual([
      ['virada', '2026-11-30'],
      ['loja', '2026-11-07'],
      ['mercado', '2026-11-06'],
      ['salario', '2026-11-05'],
    ]);
    expect(view.totals).toEqual([{ currency: 'BRL', inCents: 500000, outCents: 8000 + 4590 + 100 }]);
    const loja = view.items.find((i) => i.id === 'loja');
    expect(loja).toMatchObject({ direction: 'out', amountCents: 4590, pending: true, category: 'Shopping', accountName: 'Cartão', installment: { number: 1, total: 3 } });
    expect(view.items.find((i) => i.id === 'mercado')).toMatchObject({ category: 'Supermercado', direction: 'out', amountCents: 8000 });
    expect(view.items.find((i) => i.id === 'salario')).toMatchObject({ direction: 'in', pending: false, installment: null, cardPayment: false });
  });

  it('lists each lançamento with its operação and who paid', async () => {
    const service = await seed();
    const result = await service.query('lancamentos', { month: '2026-11' }, NO_CALLER);
    const view = (result as { value: LancamentosView }).value;
    expect(view.items.find((i) => i.id === 'salario')).toMatchObject({ operation: 'PIX', payer: 'Empresa' });
    expect(view.items.find((i) => i.id === 'mercado')).toMatchObject({ payer: null });
  });

  it('lists card bill payments but leaves them out of the totals', async () => {
    const service = await seed(true);
    const result = await service.query('lancamentos', { month: '2026-11' }, NO_CALLER);
    const view = (result as { value: LancamentosView }).value;
    expect(view.items.filter((i) => i.cardPayment).map((i) => [i.id, i.direction])).toEqual([
      ['fatura', 'out'],
      ['recebido', 'in'],
    ]);
    expect(view.totals).toEqual([{ currency: 'BRL', inCents: 500000, outCents: 8000 + 4590 + 100 }]);
  });

  it('refuses a malformed month', async () => {
    const service = await seed();
    expect(await service.query('lancamentos', { month: '2026-13' }, NO_CALLER)).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('lancamento', () => {
  it('shows the detail, with who paid on money in', async () => {
    const service = await seed();
    const result = await service.query('lancamento', { id: 'salario' }, NO_CALLER);
    const view = (result as { value: LancamentoDetailView }).value;
    expect(view).toMatchObject({ id: 'salario', direction: 'in', counterpart: 'Empresa', descriptionRaw: 'RAW salario', operation: 'PIX' });
  });

  it('does not find a deleted or unknown transaction', async () => {
    const service = await seed();
    expect(await service.query('lancamento', { id: 'apagada' }, NO_CALLER)).toEqual({ ok: false, error: 'not_found' });
    expect(await service.query('lancamento', { id: 'nada' }, NO_CALLER)).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('lancamentos.tag', () => {
  async function tagged() {
    const service = await seed();
    const command = (input: Record<string, unknown>) => service.command('lancamentos.tag', input, NO_CALLER);
    const create = async (name: string, input: Record<string, unknown>) => {
      const result = await service.command(name, input, NO_CALLER);
      return (result as { value: { id: string } }).value.id;
    };
    const tipo = await create('tagLayer.create', { name: 'Tipo' });
    const origem = await create('tagLayer.create', { name: 'Origem' });
    const mercado = await create('tag.create', { layerId: tipo, name: 'Mercado' });
    const lazer = await create('tag.create', { layerId: tipo, name: 'Lazer' });
    const impulso = await create('tag.create', { layerId: origem, name: 'Impulso' });
    const tagsOf = async () => {
      const result = await service.query('lancamentos', { month: '2026-11' }, NO_CALLER);
      return Object.fromEntries((result as { value: LancamentosView }).value.items.map((i) => [i.id, i.tags]));
    };
    return { service, command, tagsOf, tipo, origem, mercado, lazer, impulso };
  }

  it('puts tags on many lançamentos, replacing the layer’s tag and keeping the other layers', async () => {
    const { command, tagsOf, tipo, origem, mercado, lazer, impulso } = await tagged();
    expect(await command({ ids: ['mercado', 'loja'], changes: [{ layerId: tipo, tagId: mercado }, { layerId: origem, tagId: impulso }] })).toEqual({
      ok: true,
      value: null,
      changed: ['tags'],
    });
    expect(await command({ ids: ['loja', 'salario'], changes: [{ layerId: tipo, tagId: lazer }] })).toMatchObject({ ok: true });
    expect(await tagsOf()).toEqual({
      virada: {},
      loja: { [tipo]: lazer, [origem]: impulso },
      mercado: { [tipo]: mercado, [origem]: impulso },
      salario: { [tipo]: lazer },
    });
  });

  it('takes a layer’s tag off', async () => {
    const { command, tagsOf, tipo, origem, mercado, impulso } = await tagged();
    await command({ ids: ['mercado', 'loja'], changes: [{ layerId: tipo, tagId: mercado }, { layerId: origem, tagId: impulso }] });
    await command({ ids: ['mercado', 'loja'], changes: [{ layerId: tipo, tagId: null }] });
    expect((await tagsOf()).mercado).toEqual({ [origem]: impulso });
  });

  it('shows the tags on the detail panel', async () => {
    const { service, command, tipo, mercado } = await tagged();
    await command({ ids: ['mercado'], changes: [{ layerId: tipo, tagId: mercado }] });
    const result = await service.query('lancamento', { id: 'mercado' }, NO_CALLER);
    expect((result as { value: LancamentoDetailView }).value.tags).toEqual({ [tipo]: mercado });
  });

  it('refuses malformed input, unknown lançamentos and a tag from another layer', async () => {
    const { command, tipo, origem, mercado } = await tagged();
    expect(await command({ ids: [], changes: [{ layerId: tipo, tagId: mercado }] })).toEqual({ ok: false, error: 'invalid' });
    expect(await command({ ids: ['mercado'], changes: [] })).toEqual({ ok: false, error: 'invalid' });
    expect(await command({ ids: ['mercado'], changes: [{ layerId: tipo, tagId: mercado }, { layerId: tipo, tagId: null }] })).toEqual({ ok: false, error: 'invalid' });
    expect(await command({ ids: ['mercado', 'apagada'], changes: [{ layerId: tipo, tagId: mercado }] })).toEqual({ ok: false, error: 'not_found' });
    expect(await command({ ids: ['mercado'], changes: [{ layerId: origem, tagId: mercado }] })).toEqual({ ok: false, error: 'not_found' });
    expect(await command({ ids: ['mercado'], changes: [{ layerId: 'nada', tagId: null }] })).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('lancamentos.categorize', () => {
  async function categorized() {
    const service = await seed();
    const command = (input: Record<string, unknown>) => service.command('lancamentos.categorize', input, NO_CALLER);
    const list = async () => {
      const result = await service.query('lancamentos', { month: '2026-11' }, NO_CALLER);
      return (result as { value: LancamentosView }).value;
    };
    return { service, command, list };
  }

  it('gives many lançamentos my category, over Pluggy’s, and takes it off again', async () => {
    const { service, command, list } = await categorized();
    expect(await command({ ids: ['mercado', 'loja'], categoryId: '11010000' })).toEqual({ ok: true, value: null, changed: ['categories'] });
    let items = (await list()).items;
    expect(items.find((i) => i.id === 'mercado')).toMatchObject({ category: 'Restaurantes', categoryId: '11010000', categoryChosen: true });
    expect(items.find((i) => i.id === 'loja')).toMatchObject({ category: 'Restaurantes', categoryChosen: true });
    expect(items.find((i) => i.id === 'salario')).toMatchObject({ categoryChosen: false });
    const detail = (await service.query('lancamento', { id: 'mercado' }, NO_CALLER)) as { value: LancamentoDetailView };
    expect(detail.value).toMatchObject({ category: 'Restaurantes', pluggyCategory: 'Supermercado' });

    expect(await command({ ids: ['mercado', 'loja'], categoryId: null })).toMatchObject({ ok: true });
    items = (await list()).items;
    expect(items.find((i) => i.id === 'mercado')).toMatchObject({ category: 'Supermercado', categoryId: 'c1', categoryChosen: false });
    expect(items.find((i) => i.id === 'loja')).toMatchObject({ category: 'Shopping', categoryId: null, categoryChosen: false });
  });

  it('makes a lançamento a card bill payment, out of the totals, or takes it out of the card payments', async () => {
    const service = await seed(true);
    const command = (input: Record<string, unknown>) => service.command('lancamentos.categorize', input, NO_CALLER);
    await command({ ids: ['mercado'], categoryId: '05100000' });
    await command({ ids: ['fatura'], categoryId: 'c1' });
    const view = ((await service.query('lancamentos', { month: '2026-11' }, NO_CALLER)) as { value: LancamentosView }).value;
    expect(view.items.filter((i) => i.cardPayment).map((i) => i.id)).toEqual(['mercado', 'recebido']);
    expect(view.totals).toEqual([{ currency: 'BRL', inCents: 500000, outCents: 90000 + 4590 + 100 }]);
  });

  it('lists Pluggy’s tree as the choices', async () => {
    const { service } = await categorized();
    const result = await service.query('pluggyCategories', {}, NO_CALLER);
    expect(result).toEqual({
      ok: true,
      value: [
        { id: '05100000', name: 'Pagamento de cartão de crédito', depth: 0 },
        { id: '11000000', name: 'Alimentação', depth: 0 },
        { id: '11010000', name: 'Restaurantes', depth: 1 },
        { id: 'c1', name: 'Supermercado', depth: 0 },
      ],
    });
  });

  it('refuses malformed input, unknown lançamentos and unknown categories', async () => {
    const { command } = await categorized();
    expect(await command({ ids: [], categoryId: 'c1' })).toEqual({ ok: false, error: 'invalid' });
    expect(await command({ ids: ['mercado'] })).toEqual({ ok: false, error: 'invalid' });
    expect(await command({ ids: ['mercado'], categoryId: '' })).toEqual({ ok: false, error: 'invalid' });
    expect(await command({ ids: ['mercado', 'apagada'], categoryId: 'c1' })).toEqual({ ok: false, error: 'not_found' });
    expect(await command({ ids: ['mercado'], categoryId: 'nada' })).toEqual({ ok: false, error: 'not_found' });
  });
});
