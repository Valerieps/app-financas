import { describe, expect, it } from 'vitest';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { AppService, SESSION_DAYS } from './app-service';

function createService(initialTime = '2026-10-21T12:00:00Z') {
  const clock = fixedClock(initialTime);
  const sql = memorySql();
  const ids = sequentialIds();
  const service = new AppService(sql, clock, ids);
  service.migrate();

  return { service, sql, clock };
}

describe('AppService', () => {
  it('reports unconfigured status before setup', () => {
    const { service } = createService();
    expect(service.authStatus()).toEqual({ configured: false, authenticated: false });
  });

  it('sets up PIN and creates active session', () => {
    const { service } = createService();
    const pinHash = 'hashed-pin-1234';
    const sessionHash = 'session-token-hash-1';

    const result = service.setupPin(pinHash, sessionHash);
    expect(result.ok).toBe(true);

    const status = service.authStatus(sessionHash);
    expect(status).toEqual({ configured: true, authenticated: true });
  });

  it('rejects duplicate PIN setup', () => {
    const { service } = createService();
    service.setupPin('hash-1', 'session-1');
    const result = service.setupPin('hash-2', 'session-2');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('conflict');
    }
  });

  it('verifies unlock with correct PIN', () => {
    const { service } = createService();
    service.setupPin('correct-hash', 'session-1');

    const wrong = service.unlock('wrong-hash', 'session-2');
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) {
      expect(wrong.error).toBe('unauthenticated');
    }

    const right = service.unlock('correct-hash', 'session-2');
    expect(right.ok).toBe(true);
    expect(service.validateSession('session-2')).toBe(true);
  });

  it('locks a session', () => {
    const { service } = createService();
    service.setupPin('hash', 'session-1');
    expect(service.validateSession('session-1')).toBe(true);

    service.lock('session-1');
    expect(service.validateSession('session-1')).toBe(false);
  });

  it('requires authenticated session for queries and commands', () => {
    const { service } = createService();
    service.setupPin('hash', 'session-1');

    const unauthQuery = service.query('invalid-session', 'items', {});
    expect(unauthQuery.ok).toBe(false);
    if (!unauthQuery.ok) {
      expect(unauthQuery.error).toBe('unauthenticated');
    }

    const unauthCommand = service.command('invalid-session', 'item.create', { title: 'Test' });
    expect(unauthCommand.ok).toBe(false);
    if (!unauthCommand.ok) {
      expect(unauthCommand.error).toBe('unauthenticated');
    }
  });

  it('creates and deletes items', () => {
    const { service } = createService();
    service.setupPin('hash', 'session-1');

    const createResult = service.command('session-1', 'item.create', { title: 'Comprar café' });
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    expect(createResult.changed).toContain('items');
    expect(createResult.value).toMatchObject({ title: 'Comprar café' });

    const itemsQuery = service.query('session-1', 'items', {});
    expect(itemsQuery.ok).toBe(true);
    if (itemsQuery.ok) {
      expect(itemsQuery.value).toHaveLength(1);
    }

    const deleteResult = service.command('session-1', 'item.delete', { id: (createResult.value as any).id });
    expect(deleteResult.ok).toBe(true);

    const itemsAfterDelete = service.query('session-1', 'items', {});
    if (itemsAfterDelete.ok) {
      expect(itemsAfterDelete.value).toHaveLength(0);
    }
  });

  it('processes webhook and emits changed topics', () => {
    const { service } = createService();
    service.setupPin('hash', 'session-1');

    const webhookResult = service.webhook('item.create', { title: 'Webhook Item' });
    expect(webhookResult.ok).toBe(true);
    if (webhookResult.ok) {
      expect(webhookResult.changed).toContain('items');
      expect(webhookResult.value).toMatchObject({ title: 'Webhook Item' });
    }

    const items = service.query('session-1', 'items', {});
    if (items.ok) {
      expect(items.value).toHaveLength(1);
    }
  });

  it('cleans up expired sessions on tick', () => {
    const initial = '2026-10-21T12:00:00Z';
    const { service, clock } = createService(initial);
    service.setupPin('hash', 'session-1');

    expect(service.validateSession('session-1')).toBe(true);

    // Advance beyond SESSION_DAYS
    const later = new Date(new Date(initial).getTime() + (SESSION_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    clock.set(later);

    service.tick();
    expect(service.validateSession('session-1')).toBe(false);
  });
});
