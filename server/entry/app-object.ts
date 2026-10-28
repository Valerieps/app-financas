// The one Durable Object that holds the app's SQLite database and the live WebSocket connections.
// Calls are processed one at a time, so each command runs alone and inside one transaction.
import { DurableObject } from 'cloudflare:workers';
import type { LiveMessage, Topic } from '../../src/application/api-contract';
import { AppService } from '../application/app-service';
import { durableObjectSql } from '../infrastructure/durable-object-sql';
import type { Env } from './env';

export const SESSION_HASH_HEADER = 'x-app-session-hash';

export class AppObject extends DurableObject<Env> {
  private readonly service: AppService;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.service = new AppService(
      durableObjectSql(ctx.storage),
      { now: () => new Date() },
      { next: () => crypto.randomUUID() },
    );
    void ctx.blockConcurrencyWhile(async () => this.service.migrate());
  }

  authStatus(sessionHash: string | null) {
    return this.service.authStatus(sessionHash);
  }

  setupPin(pinHash: string, sessionHash: string) {
    const result = this.service.setupPin(pinHash, sessionHash);
    if (result.ok && result.changed.length > 0) this.broadcast(result.changed);
    return result;
  }

  unlock(pinHash: string, sessionHash: string) {
    return this.service.unlock(pinHash, sessionHash);
  }

  lock(sessionHash: string): void {
    this.service.lock(sessionHash);
    for (const ws of this.ctx.getWebSockets()) {
      ws.close(1000, 'Locked');
    }
  }

  query(sessionHash: string, name: string, input: unknown) {
    return this.service.query(sessionHash, name, input);
  }

  command(sessionHash: string, name: string, input: unknown) {
    const result = this.service.command(sessionHash, name, input);
    if (result.ok && result.changed.length > 0) this.broadcast(result.changed);
    return result;
  }

  webhook(topic: string, data: unknown) {
    const result = this.service.webhook(topic, data);
    if (result.ok && result.changed.length > 0) this.broadcast(result.changed);
    return result;
  }

  tick(): void {
    const changed = this.service.tick();
    if (changed.length > 0) this.broadcast(changed);
  }

  /** Live connection: the Worker already verified the origin and passes the session hash. */
  override async fetch(request: Request): Promise<Response> {
    const sessionHash = request.headers.get(SESSION_HASH_HEADER) ?? '';
    const status = this.service.authStatus(sessionHash);
    if (!status.authenticated) return new Response(null, { status: 401 });

    const pair = new WebSocketPair();
    // Hibernation API: idle connections cost nothing.
    this.ctx.acceptWebSocket(pair[1], ['owner']);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override webSocketMessage(): void {
    // The app never sends messages over WebSocket; commands go through HTTP POST.
  }

  private broadcast(topics: readonly Topic[]): void {
    const message: LiveMessage = { type: 'changed', topics };
    const payload = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Closed sockets will be cleaned up by Cloudflare.
      }
    }
  }
}
