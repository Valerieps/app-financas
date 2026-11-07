import { describe, expect, it } from 'vitest';
import type { TagLayerView } from '../../src/application/api-contract';
import { testContext } from '../testing/node-sql';
import { AppService } from './app-service';
import { NO_CALLER } from './lock';
import { statement } from './ports';

const NOW = '2026-11-02T12:00:00Z';

function setup() {
  const { ctx, sql } = testContext(NOW);
  const service = new AppService(ctx);
  const command = (name: string, input: Record<string, unknown>) => service.command(name, input, NO_CALLER);
  const create = async (name: string, input: Record<string, unknown>): Promise<string> => {
    const result = await command(name, input);
    if (!result.ok) throw new Error(result.error);
    return (result.value as { id: string }).id;
  };
  const read = async (): Promise<TagLayerView[]> => {
    const result = await service.query('tagLayers', {}, NO_CALLER);
    if (!result.ok) throw new Error(result.error);
    return result.value as TagLayerView[];
  };
  return { sql, command, create, read };
}

const names = (layers: TagLayerView[]) => layers.map((l) => [l.name, l.tags.map((t) => t.name)]);

describe('category layers', () => {
  it('are created in order, with cleaned names, and their tags listed alphabetically', async () => {
    const { command, create, read } = setup();
    const origem = await create('tagLayer.create', { name: '  Impulso   ou planejado ' });
    const tipo = await create('tagLayer.create', { name: 'Tipo' });
    await create('tag.create', { layerId: origem, name: 'Planejado' });
    await create('tag.create', { layerId: origem, name: 'Impulso' });
    await create('tag.create', { layerId: tipo, name: 'Transporte' });
    expect(await command('tag.create', { layerId: tipo, name: 'Mercado' })).toEqual({ ok: true, value: { id: expect.any(String) }, changed: ['tags'] });
    expect(names(await read())).toEqual([
      ['Impulso ou planejado', ['Impulso', 'Planejado']],
      ['Tipo', ['Mercado', 'Transporte']],
    ]);
  });

  it('are at most five', async () => {
    const { command, create } = setup();
    for (const name of ['A', 'B', 'C', 'D', 'E']) await create('tagLayer.create', { name });
    expect(await command('tagLayer.create', { name: 'F' })).toEqual({ ok: false, error: 'conflict' });
  });

  it('reject empty, long and repeated names, among siblings only', async () => {
    const { command, create } = setup();
    const tipo = await create('tagLayer.create', { name: 'Tipo' });
    const outra = await create('tagLayer.create', { name: 'Outra' });
    expect(await command('tagLayer.create', { name: ' ' })).toEqual({ ok: false, error: 'invalid' });
    expect(await command('tagLayer.create', { name: 'x'.repeat(41) })).toEqual({ ok: false, error: 'invalid' });
    expect(await command('tagLayer.create', { name: 'tipo' })).toEqual({ ok: false, error: 'conflict' });
    expect(await command('tagLayer.rename', { id: outra, name: 'TIPO' })).toEqual({ ok: false, error: 'conflict' });
    expect((await command('tagLayer.rename', { id: tipo, name: 'tipo' })).ok).toBe(true);
    await create('tag.create', { layerId: tipo, name: 'Farmácia' });
    expect(await command('tag.create', { layerId: tipo, name: 'farmacia' })).toEqual({ ok: false, error: 'conflict' });
    expect((await command('tag.create', { layerId: outra, name: 'Farmácia' })).ok).toBe(true);
    expect(await command('tag.create', { layerId: 'nada', name: 'X' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('are renamed and reordered', async () => {
    const { command, create, read } = setup();
    const a = await create('tagLayer.create', { name: 'A' });
    const b = await create('tagLayer.create', { name: 'B' });
    const tag = await create('tag.create', { layerId: a, name: 'x' });
    expect((await command('tagLayer.move', { id: b, direction: 'up' })).ok).toBe(true);
    expect((await command('tagLayer.rename', { id: a, name: 'A2' })).ok).toBe(true);
    expect((await command('tag.rename', { id: tag, name: 'y' })).ok).toBe(true);
    expect(names(await read())).toEqual([
      ['B', []],
      ['A2', ['y']],
    ]);
    expect(await command('tagLayer.move', { id: b, direction: 'left' })).toEqual({ ok: false, error: 'invalid' });
    expect(await command('tag.rename', { id: 'nada', name: 'y' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('take their tags off the lançamentos when deleted', async () => {
    const { sql, command, create, read } = setup();
    const a = await create('tagLayer.create', { name: 'A' });
    const b = await create('tagLayer.create', { name: 'B' });
    const c = await create('tagLayer.create', { name: 'C' });
    const ta = await create('tag.create', { layerId: a, name: 'x' });
    const tb = await create('tag.create', { layerId: b, name: 'y' });
    const tb2 = await create('tag.create', { layerId: b, name: 'z' });
    await sql.batch([
      statement('INSERT INTO items (item_id, registered_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', 'item', NOW, NOW, NOW),
      statement(
        'INSERT INTO accounts (id, pluggy_id, item_id, type, name, currency_code, raw_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'acc', 'p-acc', 'item', 'BANK', 'Conta', 'BRL', '{}', NOW, NOW,
      ),
      statement(
        'INSERT INTO transactions (id, pluggy_id, account_id, match_key, date, amount_cents, currency_code, raw_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        't1', 'pt1', 'acc', 'k1', NOW, 100, 'BRL', '{}', NOW, NOW,
      ),
      statement('INSERT INTO transaction_tags (transaction_id, layer_id, tag_id, tagged_at) VALUES (?, ?, ?, ?)', 't1', a, ta, NOW),
      statement('INSERT INTO transaction_tags (transaction_id, layer_id, tag_id, tagged_at) VALUES (?, ?, ?, ?)', 't1', b, tb, NOW),
    ]);
    // The database itself refuses a second tag of the same layer, and a tag under another layer.
    await expect(sql.run('INSERT INTO transaction_tags (transaction_id, layer_id, tag_id, tagged_at) VALUES (?, ?, ?, ?)', 't1', b, tb2, NOW)).rejects.toThrow();
    await expect(sql.run('INSERT INTO transaction_tags (transaction_id, layer_id, tag_id, tagged_at) VALUES (?, ?, ?, ?)', 't1', c, tb2, NOW)).rejects.toThrow();

    expect((await command('tag.delete', { id: tb })).ok).toBe(true);
    expect(await sql.all('SELECT tag_id FROM transaction_tags')).toEqual([{ tag_id: ta }]);
    expect((await command('tagLayer.delete', { id: a })).ok).toBe(true);
    expect(await sql.all('SELECT tag_id FROM transaction_tags')).toEqual([]);
    expect(names(await read())).toEqual([
      ['B', ['z']],
      ['C', []],
    ]);
    expect(await sql.all('SELECT id, position FROM tag_layers ORDER BY position')).toEqual([
      { id: b, position: 0 },
      { id: c, position: 1 },
    ]);
    expect(await command('tagLayer.delete', { id: a })).toEqual({ ok: false, error: 'not_found' });
  });
});
