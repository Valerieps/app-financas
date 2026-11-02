import { describe, expect, it } from 'vitest';
import { fixedClock, memoryRawStore, memorySql, sequentialIds } from '../testing/node-sql';
import { statement } from './ports';
import { AppService } from './app-service';
import { NO_CALLER } from './lock';

function createService() {
  const sql = memorySql();
  const service = new AppService({ sql, raw: memoryRawStore(), clock: fixedClock('2026-11-02T12:00:00Z'), ids: sequentialIds() });
  return { service, sql };
}

const NOW = '2026-11-02T12:00:00Z';

describe('AppService', () => {
  it('counts the current connections, leaving replaced ones out', async () => {
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
    expect(await service.query('vault', {}, NO_CALLER)).toEqual({ ok: true, value: { connectionCount: 1 } });
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
