import { describe, expect, it } from 'vitest';
import type { LancamentoDetailView, LancamentosView, RulePreviewView, RuleView } from '../../src/application/api-contract';
import { fakePluggy, testContext } from '../testing/node-sql';
import { CHECKING_ID, ITEM_ID, page, routes, transaction } from '../testing/pluggy-fixtures';
import { AppService } from './app-service';
import { rewriteDescriptionsJob } from './descriptions';
import { NO_CALLER } from './lock';
import { statement } from './ports';

const NOW = '2026-11-02T12:00:00Z';

async function setup(pluggy = fakePluggy({})) {
  const test = testContext(NOW, pluggy);
  const service = new AppService(test.ctx);
  const command = (name: string, input: Record<string, unknown>) => service.command(name, input, NO_CALLER);
  const query = async <T>(name: string, input: Record<string, unknown> = {}): Promise<T> => {
    const result = await service.query(name, input, NO_CALLER);
    if (!result.ok) throw new Error(result.error);
    return result.value as T;
  };
  const create = async (name: string, input: Record<string, unknown>): Promise<string> => {
    const result = await command(name, input);
    if (!result.ok) throw new Error(result.error);
    return (result.value as { id: string }).id;
  };
  const tipo = await create('tagLayer.create', { name: 'Tipo' });
  const origem = await create('tagLayer.create', { name: 'Origem' });
  const restaurante = await create('tag.create', { layerId: tipo, name: 'Restaurante' });
  const mercado = await create('tag.create', { layerId: tipo, name: 'Mercado' });
  const impulso = await create('tag.create', { layerId: origem, name: 'Impulso' });
  return { ...test, command, query, create, tipo, origem, restaurante, mercado, impulso };
}

const rule = (text: string, tags: Record<string, string>) => ({
  conditions: [{ kind: 'descriptionContains', text }],
  actions: [{ kind: 'addTags', tags }],
});

async function seedTransactions(sql: { batch: (s: ReturnType<typeof statement>[]) => Promise<void> }, list: [string, string, string][]) {
  await sql.batch([
    statement('INSERT INTO items (item_id, registered_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', 'item', NOW, NOW, NOW),
    statement(
      "INSERT INTO accounts (id, pluggy_id, item_id, type, name, currency_code, raw_json, first_seen_at, last_seen_at) VALUES ('bank', 'p-bank', 'item', 'BANK', 'Conta', 'BRL', '{}', ?, ?)",
      NOW,
      NOW,
    ),
    ...list.map(([id, date, description]) =>
      statement(
        `INSERT INTO transactions (id, pluggy_id, account_id, match_key, date, amount_cents, currency_code, type, description, raw_json, first_seen_at, last_seen_at)
         VALUES (?, ?, 'bank', ?, ?, -1000, 'BRL', 'DEBIT', ?, '{}', ?, ?)`,
        id,
        `p-${id}`,
        `k-${id}`,
        date,
        description,
        NOW,
        NOW,
      ),
    ),
  ]);
}

describe('automatic rules', () => {
  it('are created, listed in order, moved, edited and deleted', async () => {
    const { command, query, create, tipo, restaurante, mercado } = await setup();
    const a = await create('rule.create', rule('  ifood ', { [tipo]: restaurante }));
    const b = await create('rule.create', rule('mercado', { [tipo]: mercado }));
    expect(await query<RuleView[]>('rules')).toEqual([
      { id: a, match: 'all', ...rule('ifood', { [tipo]: restaurante }) },
      { id: b, match: 'all', ...rule('mercado', { [tipo]: mercado }) },
    ]);
    expect(await command('rule.move', { id: b, direction: 'up' })).toEqual({ ok: true, value: null, changed: ['rules'] });
    expect((await query<RuleView[]>('rules')).map((r) => r.id)).toEqual([b, a]);
    expect((await command('rule.move', { id: b, to: 1 })).ok).toBe(true);
    expect((await query<RuleView[]>('rules')).map((r) => r.id)).toEqual([a, b]);
    expect(await command('rule.move', { id: b, to: 2 })).toEqual({ ok: false, error: 'invalid' });
    expect((await command('rule.move', { id: b, to: 0 })).ok).toBe(true);
    expect((await command('rule.update', { id: a, ...rule('rappi', { [tipo]: restaurante }) })).ok).toBe(true);
    expect((await query<RuleView[]>('rules'))[1]?.conditions).toEqual([{ kind: 'descriptionContains', text: 'rappi' }]);
    expect((await command('rule.delete', { id: b })).ok).toBe(true);
    expect((await query<RuleView[]>('rules')).map((r) => r.id)).toEqual([a]);
  });

  it('keep "qualquer condição" (any) and catch a lançamento that meets just one condition', async () => {
    const { command, query, create, tipo, restaurante } = await setup();
    const either = { match: 'any', conditions: [{ kind: 'descriptionContains', text: 'ifood' }, { kind: 'descriptionContains', text: 'rappi' }], actions: [{ kind: 'addTags', tags: { [tipo]: restaurante } }] };
    const id = await create('rule.create', either);
    expect((await query<RuleView[]>('rules'))[0]?.match).toBe('any');
    expect((await command('rule.update', { id, ...either, match: 'all' })).ok).toBe(true);
    expect((await query<RuleView[]>('rules'))[0]?.match).toBe('all');
    expect(await command('rule.update', { id, ...either, match: 'some' })).toEqual({ ok: false, error: 'invalid' });
  });

  it('refuse malformed rules, unknown tags and unknown ids', async () => {
    const { command, tipo, origem, restaurante } = await setup();
    expect(await command('rule.create', rule(' ', { [tipo]: restaurante }))).toEqual({ ok: false, error: 'invalid' });
    expect(await command('rule.create', rule('x', { [tipo]: 'nada' }))).toEqual({ ok: false, error: 'invalid' });
    expect(await command('rule.create', rule('x', { [origem]: restaurante }))).toEqual({ ok: false, error: 'invalid' });
    expect(await command('rule.update', { id: 'nada', ...rule('x', { [tipo]: restaurante }) })).toEqual({ ok: false, error: 'not_found' });
    expect(await command('rule.delete', { id: 'nada' })).toEqual({ ok: false, error: 'not_found' });
    expect(await command('rule.move', { id: 'nada', direction: 'sideways' })).toEqual({ ok: false, error: 'invalid' });
  });

  it('drop a deleted tag from their actions', async () => {
    const { command, query, create, tipo, origem, restaurante, impulso } = await setup();
    await create('rule.create', rule('ifood', { [tipo]: restaurante, [origem]: impulso }));
    await command('tag.delete', { id: impulso });
    expect((await query<RuleView[]>('rules'))[0]?.actions).toEqual([{ kind: 'addTags', tags: { [tipo]: restaurante } }]);
  });

  it('are tested against the stored lançamentos, newest first, at most 10', async () => {
    const { sql, query } = await setup();
    const list: [string, string, string][] = Array.from({ length: 12 }, (_, i) => [`if${i}`, `2026-10-${String(i + 10)}T12:00:00.000Z`, `IFOOD *Loja ${i}`]);
    await seedTransactions(sql, [...list, ['uber', '2026-10-30T12:00:00.000Z', 'Uber Trip']]);
    const preview = await query<RulePreviewView>('rulePreview', { conditions: [{ kind: 'descriptionContains', text: 'iFóod' }] });
    expect(preview.total).toBe(12);
    expect(preview.items.map((i) => i.id)).toEqual(['if11', 'if10', 'if9', 'if8', 'if7', 'if6', 'if5', 'if4', 'if3', 'if2']);
    expect(preview.items[0]).toMatchObject({ description: 'IFOOD *Loja 11', day: '2026-10-21', amountCents: 1000 });
    await expect(query('rulePreview', { conditions: [] })).rejects.toThrow('invalid');
  });

  it('test "qualquer condição" (any) as any one condition', async () => {
    const { sql, query } = await setup();
    await seedTransactions(sql, [
      ['if', '2026-10-10T12:00:00.000Z', 'IFOOD *Loja'],
      ['ra', '2026-10-11T12:00:00.000Z', 'RAPPI *Pedido'],
      ['ub', '2026-10-12T12:00:00.000Z', 'Uber Trip'],
    ]);
    const conditions = [{ kind: 'descriptionContains', text: 'ifood' }, { kind: 'descriptionContains', text: 'rappi' }];
    expect((await query<RulePreviewView>('rulePreview', { match: 'any', conditions })).items.map((i) => i.id)).toEqual(['ra', 'if']);
    expect((await query<RulePreviewView>('rulePreview', { conditions })).total).toBe(0);
  });

  it('test the type condition: entrada, saída or transferência', async () => {
    const { sql, query } = await setup();
    await seedTransactions(sql, [
      ['out', '2026-10-10T12:00:00.000Z', 'Pix Ana'],
      ['in', '2026-10-11T12:00:00.000Z', 'Pix Ana'],
      ['transfer', '2026-10-12T12:00:00.000Z', 'Pix Ana'],
    ]);
    await sql.batch([
      statement("UPDATE transactions SET type = 'CREDIT', amount_cents = 1000 WHERE id = 'in'"),
      statement("UPDATE transactions SET pluggy_category_id = '05000000' WHERE id = 'transfer'"),
    ]);
    const ids = async (type: string) =>
      (await query<RulePreviewView>('rulePreview', { conditions: [{ kind: 'descriptionContains', text: 'pix' }, { kind: 'type', type }] })).items.map((i) => i.id);
    expect(await ids('out')).toEqual(['out']);
    expect(await ids('in')).toEqual(['in']);
    expect(await ids('transfer')).toEqual(['transfer']);
  });

  it("replace a piece of the description wherever lançamentos are shown, keeping the bank's", async () => {
    const { sql, query, create } = await setup();
    await seedTransactions(sql, [
      ['if', '2026-10-10T12:00:00.000Z', 'IFOOD *Loja'],
      ['uber', '2026-10-11T12:00:00.000Z', 'Uber Trip'],
    ]);
    const replaceRule = { conditions: [{ kind: 'descriptionContains', text: 'ifood' }], actions: [{ kind: 'replaceInDescription', find: 'ifood *', replace: 'iFood ' }] };
    const preview = await query<RulePreviewView>('rulePreview', replaceRule);
    expect(preview.items.map((i) => i.description)).toEqual(['iFood Loja']);
    await create('rule.create', replaceRule);
    const list = await query<LancamentosView>('lancamentos', { month: '2026-10' });
    expect(list.items.map((i) => i.description)).toEqual(['Uber Trip', 'iFood Loja']);
    expect(await query<LancamentoDetailView>('lancamento', { id: 'if' })).toMatchObject({ description: 'iFood Loja', descriptionOriginal: 'IFOOD *Loja' });
    expect(await query<LancamentoDetailView>('lancamento', { id: 'uber' })).toMatchObject({ description: 'Uber Trip', descriptionOriginal: null });
    const stored = await sql.all<{ description: string }>("SELECT description FROM transactions WHERE id = 'if'");
    expect(stored).toEqual([{ description: 'IFOOD *Loja' }]);
  });

  it('fill only the empty layers of the stored lançamentos when applied, the first rule winning', async () => {
    const { sql, command, create, tipo, origem, restaurante, mercado, impulso } = await setup();
    await seedTransactions(sql, [
      ['a', '2026-10-10T12:00:00.000Z', 'IFOOD Loja'],
      ['b', '2026-10-11T12:00:00.000Z', 'IFOOD Mercado'],
      ['c', '2026-10-12T12:00:00.000Z', 'Uber'],
    ]);
    await command('lancamentos.tag', { ids: ['b'], changes: [{ layerId: tipo, tagId: mercado }] });
    await create('rule.create', rule('ifood', { [tipo]: restaurante, [origem]: impulso }));
    await create('rule.create', rule('loja', { [tipo]: mercado }));
    expect(await command('rules.apply', {})).toEqual({ ok: true, value: { tagged: 2, described: 0, categorized: 0 }, changed: ['tags', 'rules', 'categories'] });
    expect(await sql.all('SELECT transaction_id, layer_id, tag_id FROM transaction_tags ORDER BY transaction_id, layer_id')).toEqual(
      [
        { transaction_id: 'a', layer_id: tipo, tag_id: restaurante },
        { transaction_id: 'a', layer_id: origem, tag_id: impulso },
        { transaction_id: 'b', layer_id: tipo, tag_id: mercado },
        { transaction_id: 'b', layer_id: origem, tag_id: impulso },
      ].sort((x, y) => x.transaction_id.localeCompare(y.transaction_id) || x.layer_id.localeCompare(y.layer_id)),
    );
    expect(await command('rules.apply', {})).toEqual({ ok: true, value: { tagged: 0, described: 0, categorized: 0 }, changed: ['tags', 'rules', 'categories'] });
  });

  it('count the lançamentos whose description the replace rules change when applied', async () => {
    const { sql, command, create } = await setup();
    await seedTransactions(sql, [
      ['if', '2026-10-10T12:00:00.000Z', 'IFOOD *Loja'],
      ['uber', '2026-10-11T12:00:00.000Z', 'Uber Trip'],
    ]);
    await create('rule.create', { conditions: [{ kind: 'descriptionContains', text: 'ifood' }], actions: [{ kind: 'replaceInDescription', find: 'ifood *', replace: 'iFood ' }] });
    expect(await command('rules.apply', {})).toEqual({ ok: true, value: { tagged: 0, described: 1, categorized: 0 }, changed: ['tags', 'rules', 'categories'] });
  });

  it('tag each new lançamento the collection stores', async () => {
    const test = await setup(fakePluggy(routes()));
    await test.create('rule.create', rule('padaria', { [test.tipo]: test.mercado }));
    expect((await test.command('connection.add', { itemId: ITEM_ID })).ok).toBe(true);
    await Promise.all(test.tasks);
    expect(
      await test.sql.all(
        'SELECT t.pluggy_id, tt.tag_id FROM transaction_tags tt JOIN transactions t ON t.id = tt.transaction_id ORDER BY t.pluggy_id',
      ),
    ).toEqual([{ pluggy_id: 't1', tag_id: test.mercado }]);
  });
});

describe('"quem pagou" rules that set the category', () => {
  const SALARIO = '01010000';
  const OUTRA = '01020000';
  const payerRule = (text: string, categoryId: string) => ({
    conditions: [{ kind: 'payerContains', text }],
    actions: [{ kind: 'setCategory', categoryId }],
  });
  async function seedCategories(sql: { batch: (s: ReturnType<typeof statement>[]) => Promise<void> }) {
    await sql.batch(
      [SALARIO, OUTRA].map((id) => statement('INSERT INTO pluggy_categories (id, raw_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', id, '{}', NOW, NOW)),
    );
  }
  async function seedEntradas(sql: { batch: (s: ReturnType<typeof statement>[]) => Promise<void> }) {
    await seedTransactions(sql, [
      ['acme', '2026-10-10T12:00:00.000Z', 'PIX RECEBIDO'],
      ['outro', '2026-10-11T12:00:00.000Z', 'PIX RECEBIDO'],
      ['saida', '2026-10-12T12:00:00.000Z', 'PIX ENVIADO'],
      ['minha', '2026-10-13T12:00:00.000Z', 'PIX RECEBIDO'],
    ]);
    await sql.batch([
      statement("UPDATE transactions SET type = 'CREDIT', amount_cents = 1000 WHERE id IN ('acme', 'outro', 'minha')"),
      ...[
        ['acme', 'ACME Ltda'],
        ['outro', 'Globex'],
        ['saida', 'ACME Ltda'],
        ['minha', 'Acme Ltda'],
      ].map(([id, name]) => statement('INSERT INTO transaction_payment_data (transaction_id, payer_name) VALUES (?, ?)', id, name)),
    ]);
  }

  it("refuse a category that is not in Pluggy's tree", async () => {
    const { sql, command } = await setup();
    await seedCategories(sql);
    expect(await command('rule.create', payerRule('acme', '99999999'))).toEqual({ ok: false, error: 'invalid' });
    expect((await command('rule.create', payerRule('acme', SALARIO))).ok).toBe(true);
  });

  it('are tested against who paid the entradas only', async () => {
    const { sql, query } = await setup();
    await seedEntradas(sql);
    const preview = await query<RulePreviewView>('rulePreview', { conditions: [{ kind: 'payerContains', text: 'acme' }] });
    expect(preview.items.map((i) => i.id)).toEqual(['minha', 'acme']);
  });

  it('give the category to the stored entradas when applied, keeping the one I chose', async () => {
    const { sql, command, create, query } = await setup();
    await seedCategories(sql);
    await seedEntradas(sql);
    expect((await command('lancamentos.categorize', { ids: ['minha'], categoryId: OUTRA })).ok).toBe(true);
    await create('rule.create', payerRule('acme', SALARIO));
    await create('rule.create', payerRule('acme | globex', OUTRA));
    expect(await command('rules.apply', {})).toEqual({ ok: true, value: { tagged: 0, described: 0, categorized: 2 }, changed: ['tags', 'rules', 'categories'] });
    expect(await sql.all('SELECT transaction_id, pluggy_category_id FROM transaction_categories ORDER BY transaction_id')).toEqual([
      { transaction_id: 'acme', pluggy_category_id: SALARIO },
      { transaction_id: 'minha', pluggy_category_id: OUTRA },
      { transaction_id: 'outro', pluggy_category_id: OUTRA },
    ]);
    expect(await query<LancamentoDetailView>('lancamento', { id: 'acme' })).toMatchObject({ categoryId: SALARIO, categoryChosen: true });
    expect(await command('rules.apply', {})).toMatchObject({ value: { categorized: 0 } });
  });

  it('give the category to each new entrada the collection stores', async () => {
    const entrada = transaction('t3', { type: 'CREDIT', amount: 1000, description: 'PIX RECEBIDO', paymentData: { payer: { name: 'ACME LTDA' } } });
    const test = await setup(fakePluggy(routes({ [`/v2/transactions?accountId=${CHECKING_ID}`]: page([transaction('t1'), entrada]) })));
    await seedCategories(test.sql);
    await test.create('rule.create', payerRule('acme', SALARIO));
    expect((await test.command('connection.add', { itemId: ITEM_ID })).ok).toBe(true);
    await Promise.all(test.tasks);
    expect(
      await test.sql.all('SELECT t.pluggy_id, tc.pluggy_category_id FROM transaction_categories tc JOIN transactions t ON t.id = tc.transaction_id'),
    ).toEqual([{ pluggy_id: 't3', pluggy_category_id: SALARIO }]);
  });
});

describe('"categoria" rules', () => {
  const COMPRAS = '08000000';
  const ONLINE = '08010000';
  const SALARIO = '01010000';
  async function seed(sql: { batch: (s: ReturnType<typeof statement>[]) => Promise<void> }) {
    await sql.batch(
      [COMPRAS, ONLINE, SALARIO].map((id) => statement('INSERT INTO pluggy_categories (id, raw_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', id, '{}', NOW, NOW)),
    );
    await seedTransactions(sql, [
      ['loja', '2026-10-10T12:00:00.000Z', 'LOJA'],
      ['site', '2026-10-11T12:00:00.000Z', 'SITE'],
      ['outra', '2026-10-12T12:00:00.000Z', 'OUTRA'],
      ['escolhida', '2026-10-13T12:00:00.000Z', 'ESCOLHIDA'],
    ]);
    await sql.batch([
      statement("UPDATE transactions SET pluggy_category_id = ? WHERE id = 'loja'", COMPRAS),
      statement("UPDATE transactions SET pluggy_category_id = ? WHERE id IN ('site', 'escolhida')", ONLINE),
    ]);
  }

  it("refuse a category that is not in Pluggy's tree", async () => {
    const { sql, command, restaurante, tipo } = await setup();
    await seed(sql);
    const byCategory = (categoryId: string) => ({ conditions: [{ kind: 'category', categoryId }], actions: [{ kind: 'addTags', tags: { [tipo]: restaurante } }] });
    expect(await command('rule.create', byCategory('99999999'))).toEqual({ ok: false, error: 'invalid' });
    expect((await command('rule.create', byCategory(COMPRAS))).ok).toBe(true);
  });

  it('are tested against the category that counts, its subcategories included', async () => {
    const { sql, command, query } = await setup();
    await seed(sql);
    expect((await command('lancamentos.categorize', { ids: ['escolhida'], categoryId: SALARIO })).ok).toBe(true);
    const preview = await query<RulePreviewView>('rulePreview', { conditions: [{ kind: 'category', categoryId: COMPRAS }] });
    expect(preview.items.map((i) => i.id)).toEqual(['site', 'loja']);
  });

  it('tag the stored lançamentos when applied, seeing the category another rule set', async () => {
    const { sql, command, create, tipo, mercado } = await setup();
    await seed(sql);
    await create('rule.create', { conditions: [{ kind: 'descriptionContains', text: 'outra' }], actions: [{ kind: 'setCategory', categoryId: ONLINE }] });
    await create('rule.create', { conditions: [{ kind: 'category', categoryId: COMPRAS }], actions: [{ kind: 'addTags', tags: { [tipo]: mercado } }] });
    expect(await command('rules.apply', {})).toMatchObject({ ok: true, value: { tagged: 4, categorized: 1 } });
    expect(await sql.all('SELECT transaction_id FROM transaction_tags ORDER BY transaction_id')).toEqual(
      ['escolhida', 'loja', 'outra', 'site'].map((transaction_id) => ({ transaction_id })),
    );
  });
});

describe('"operação" rules', () => {
  const pixRule = { conditions: [{ kind: 'operationContains', text: 'pix' }] };

  it('are tested against the operation type and the payment method', async () => {
    const { sql, query } = await setup();
    await seedTransactions(sql, [
      ['tipo', '2026-10-10T12:00:00.000Z', 'A'],
      ['meio', '2026-10-11T12:00:00.000Z', 'B'],
      ['ted', '2026-10-12T12:00:00.000Z', 'C'],
      ['nada', '2026-10-13T12:00:00.000Z', 'D'],
    ]);
    await sql.batch([
      statement("UPDATE transactions SET operation_type = 'PIX' WHERE id = 'tipo'"),
      statement("UPDATE transactions SET operation_type = 'TED' WHERE id = 'ted'"),
      statement('INSERT INTO transaction_payment_data (transaction_id, payment_method) VALUES (?, ?)', 'meio', 'PIX'),
    ]);
    const preview = await query<RulePreviewView>('rulePreview', { conditions: pixRule.conditions });
    expect(preview.items.map((i) => i.id)).toEqual(['meio', 'tipo']);
  });
});

describe('the descriptions my rules leave', () => {
  const replace = (text: string, find: string, by: string, extra: Record<string, unknown>[] = []) => ({
    conditions: [{ kind: 'descriptionContains', text }, ...extra],
    actions: [{ kind: 'replaceInDescription', find, replace: by }],
  });
  const storedRows = (sql: { all: <T>(q: string) => Promise<T[]> }) =>
    sql.all<{ transaction_id: string; description: string | null }>('SELECT transaction_id, description FROM transaction_descriptions ORDER BY transaction_id');

  it('are stored beside the bank description and follow each rule write', async () => {
    const { sql, command, create } = await setup();
    await seedTransactions(sql, [
      ['if', '2026-10-10T12:00:00.000Z', 'IFOOD *Loja'],
      ['uber', '2026-10-11T12:00:00.000Z', 'Uber Trip'],
    ]);
    const a = await create('rule.create', replace('ifood', 'ifood *', 'iFood '));
    expect(await storedRows(sql)).toEqual([{ transaction_id: 'if', description: 'iFood Loja' }]);
    const b = await create('rule.create', replace('ifood', 'loja', 'Restaurante'));
    expect(await storedRows(sql)).toEqual([{ transaction_id: 'if', description: 'iFood Restaurante' }]);
    // Moved up, the second rule finds "Loja" in the bank's text first: same result, other order.
    expect((await command('rule.move', { id: b, direction: 'up' })).ok).toBe(true);
    expect(await storedRows(sql)).toEqual([{ transaction_id: 'if', description: 'iFood Restaurante' }]);
    expect((await command('rule.update', { id: a, ...replace('uber', 'trip', '') })).ok).toBe(true);
    expect(await storedRows(sql)).toEqual([
      { transaction_id: 'if', description: 'IFOOD *Restaurante' },
      { transaction_id: 'uber', description: 'Uber' },
    ]);
    expect((await command('rule.delete', { id: a })).ok).toBe(true);
    expect((await command('rule.delete', { id: b })).ok).toBe(true);
    expect(await storedRows(sql)).toEqual([]);
    expect(await sql.all("SELECT description FROM transactions WHERE id = 'if'")).toEqual([{ description: 'IFOOD *Loja' }]);
  });

  it('follow the category I choose, which decides the lançamento type', async () => {
    const { sql, command, create } = await setup();
    await seedTransactions(sql, [['pix', '2026-10-10T12:00:00.000Z', 'PIX Ana']]);
    await sql.batch([statement("INSERT INTO pluggy_categories (id, raw_json, first_seen_at, last_seen_at) VALUES ('05100000', '{}', ?, ?)", NOW, NOW)]);
    await create('rule.create', replace('pix', 'pix', 'Transferência', [{ kind: 'type', type: 'transfer' }]));
    expect(await storedRows(sql)).toEqual([]);
    expect((await command('lancamentos.categorize', { ids: ['pix'], categoryId: '05100000' })).ok).toBe(true);
    expect(await storedRows(sql)).toEqual([{ transaction_id: 'pix', description: 'Transferência Ana' }]);
    expect((await command('lancamentos.categorize', { ids: ['pix'], categoryId: null })).ok).toBe(true);
    expect(await storedRows(sql)).toEqual([]);
  });

  it('are written for the lançamentos the collection stores', async () => {
    const test = await setup(fakePluggy(routes()));
    await test.create('rule.create', replace('padaria', 'padaria', 'Padaria da esquina'));
    expect((await test.command('connection.add', { itemId: ITEM_ID })).ok).toBe(true);
    await Promise.all(test.tasks);
    expect(
      await test.sql.all('SELECT t.pluggy_id, t.description AS bank, d.description FROM transaction_descriptions d JOIN transactions t ON t.id = d.transaction_id'),
    ).toEqual([{ pluggy_id: 't1', bank: 'PADARIA EXEMPLO', description: 'Padaria da esquina EXEMPLO' }]);
  });

  it('are rewritten by the daily cron job, which fills a table left empty', async () => {
    const { sql, ctx, clock, create } = await setup();
    await seedTransactions(sql, [['if', '2026-10-10T12:00:00.000Z', 'IFOOD *Loja']]);
    await create('rule.create', replace('ifood', 'ifood *', 'iFood '));
    await sql.batch([statement('DELETE FROM transaction_descriptions')]);
    await rewriteDescriptionsJob(ctx);
    expect(await storedRows(sql)).toEqual([{ transaction_id: 'if', description: 'iFood Loja' }]);
    await sql.batch([statement('DELETE FROM transaction_descriptions')]);
    await rewriteDescriptionsJob(ctx);
    expect(await storedRows(sql)).toEqual([]);
    clock.set('2026-11-03T12:00:00Z');
    await rewriteDescriptionsJob(ctx);
    expect(await storedRows(sql)).toEqual([{ transaction_id: 'if', description: 'iFood Loja' }]);
  });
});
