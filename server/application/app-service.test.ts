import { describe, expect, it } from 'vitest';
import { testContext } from '../testing/node-sql';
import { statement } from './ports';
import { AppService } from './app-service';
import { NO_CALLER } from './lock';
import type { VaultView } from '../../src/application/api-contract';

function createService() {
  const { ctx, sql } = testContext();
  return { service: new AppService(ctx), sql };
}

const NOW = '2026-11-02T12:00:00Z';

describe('AppService', () => {
  it('lists current connections first, then replaced ones', async () => {
    const { service, sql } = createService();
    await sql.batch([
      statement('INSERT INTO items (item_id, registered_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', 'new', NOW, NOW, NOW),
      statement(
        'INSERT INTO items (item_id, registered_at, replaced_by, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
        'old',
        NOW,
        'new',
        NOW,
        NOW,
      ),
    ]);
    const result = await service.query('vault', {}, NO_CALLER);
    expect(result.ok && (result.value as { connections: { itemId: string; replacedBy: string | null }[] }).connections.map((c) => [c.itemId, c.replacedBy])).toEqual([
      ['new', null],
      ['old', 'new'],
    ]);
  });

  it('shows each investment with its name, issuer CNPJ and balance', async () => {
    const { service, sql } = createService();
    const raw = JSON.stringify({ id: 'p1', name: 'CDB Exemplo', issuerCNPJ: '00.000.000/0001-00', balance: 1234.56 });
    await sql.batch([
      statement('INSERT INTO items (item_id, registered_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', 'item', NOW, NOW, NOW),
      statement(
        `INSERT INTO investments (id, pluggy_id, item_id, name, currency_code, balance_cents, raw_json, first_seen_at, last_seen_at)
         VALUES ('inv', 'p1', 'item', 'CDB Exemplo', 'BRL', 123456, ?, ?, ?)`,
        raw,
        NOW,
        NOW,
      ),
    ]);
    const result = await service.query('vault', {}, NO_CALLER);
    const view = result.ok ? (result.value as VaultView) : null;
    expect(view?.connections[0]?.investments).toEqual([
      { id: 'inv', name: 'CDB Exemplo', issuerCnpj: '00.000.000/0001-00', balanceCents: 123456, currency: 'BRL' },
    ]);
  });

  it('lists connections Pluggy told about that are not registered, except deleted ones', async () => {
    const { service, sql } = createService();
    const event = (eventId: string, name: string, itemId: string, at: string) => [
      statement(
        "INSERT INTO raw_payloads (id, source, endpoint, item_id, received_at, r2_key, sha256, bytes) VALUES (?, 'pluggy-webhook', 'POST /webhooks/pluggy', ?, ?, ?, 'x', 1)",
        `raw-${eventId}`,
        itemId,
        at,
        `k-${eventId}`,
      ),
      statement("INSERT INTO webhook_events (event_id, source, event, item_id, raw_payload_id, received_at) VALUES (?, 'pluggy', ?, ?, ?, ?)", eventId, name, itemId, `raw-${eventId}`, at),
    ];
    await sql.batch([
      statement('INSERT INTO items (item_id, registered_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', 'known', NOW, NOW, NOW),
      ...event('e1', 'item/updated', 'known', NOW),
      ...event('e2', 'item/created', 'new', '2026-11-01T10:00:00Z'),
      ...event('e3', 'item/updated', 'new', '2026-11-01T11:00:00Z'),
      ...event('e4', 'item/created', 'gone', NOW),
      ...event('e5', 'item/deleted', 'gone', NOW),
    ]);
    const result = await service.query('vault', {}, NO_CALLER);
    expect(result.ok && (result.value as VaultView).pending).toEqual([{ itemId: 'new', firstSeenAt: '2026-11-01T10:00:00Z' }]);
  });

  it('answers not_found for unknown queries and commands', async () => {
    const { service } = createService();
    expect(await service.query('constructor', {}, NO_CALLER)).toEqual({ ok: false, error: 'not_found' });
    expect(await service.command('item.create', {}, NO_CALLER)).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('Sql batch', () => {
  it('commits every statement or none', async () => {
    const { sql } = createService();
    const insert = (id: string) =>
      statement('INSERT INTO items (item_id, registered_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)', id, NOW, NOW, NOW);
    await expect(sql.batch([insert('a'), insert('a')])).rejects.toThrow();
    expect(await sql.all('SELECT item_id FROM items')).toEqual([]);
    await sql.batch([insert('a'), insert('b')]);
    expect(await sql.all('SELECT item_id FROM items ORDER BY item_id')).toEqual([{ item_id: 'a' }, { item_id: 'b' }]);
  });
});
