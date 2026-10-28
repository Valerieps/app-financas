// The Worker: serves static assets, the API under /api, the live WebSocket and the cron.
// All personal data and logic is delegated to the AppObject Durable Object.
import type { ApiError, ApiResult } from '../../src/application/api-contract';
import { isValidPin, normalizePin } from '../../src/domain/pin';
import { SESSION_DAYS } from '../application/app-service';
import { clearCookie, readCookie, SESSION_COOKIE, setCookie } from '../infrastructure/cookies';
import { constantTimeEqual, randomToken, sha256 } from '../infrastructure/crypto';
import { AppObject, SESSION_HASH_HEADER } from './app-object';
import type { Env } from './env';

export { AppObject };

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const STATUS: Record<ApiError, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid: 400,
  conflict: 409,
  unavailable: 503,
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json', ...headers },
  });
}

function appStorage(env: Env) {
  return env.APP_STORAGE.get(env.APP_STORAGE.idFromName('default'));
}

async function sessionHash(request: Request): Promise<string | null> {
  const token = readCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  return token ? sha256(token) : null;
}

/** In-app requests must come from the app's own pages. */
function sameOrigin(request: Request, url: URL): boolean {
  return request.headers.get('Origin') === url.origin;
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'invalid' }, 405);

  const authHeader = request.headers.get('Authorization') ?? '';
  const expectedSecret = env.WEBHOOK_SECRET;

  if (!expectedSecret || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'unauthenticated' }, 401);
  }

  const token = authHeader.slice(7).trim();
  if (!constantTimeEqual(token, expectedSecret)) {
    return json({ error: 'forbidden' }, 403);
  }

  let body: { topic?: string; data?: unknown };
  try {
    body = (await request.json()) as { topic?: string; data?: unknown };
  } catch {
    return json({ error: 'invalid' }, 400);
  }

  const topic = body.topic || 'webhook';
  const result = await appStorage(env).webhook(topic, body.data ?? body);
  return json({ ok: true, value: (result as any).value });
}

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  // External webhook ingress
  if (path === '/api/webhook') {
    return handleWebhook(request, env);
  }

  // All other in-app API routes require same-origin
  if (!sameOrigin(request, url)) {
    return json({ error: 'forbidden' }, 403);
  }

  const hash = await sessionHash(request);

  // Live WebSocket
  if (path === '/api/live' && request.headers.get('Upgrade') === 'websocket') {
    if (!hash) return json({ error: 'unauthenticated' }, 401);
    const headers = new Headers({ Upgrade: 'websocket', [SESSION_HASH_HEADER]: hash });
    return appStorage(env).fetch(new Request(url.toString(), { headers }));
  }

  if (request.method !== 'POST') {
    return json({ error: 'not_found' }, 404);
  }

  // Auth endpoints
  if (path === '/api/auth/status') {
    const status = await appStorage(env).authStatus(hash);
    return json({ ok: true, value: status });
  }

  if (path === '/api/auth/setup') {
    const body = (await request.json().catch(() => ({}))) as { pin?: string };
    const pin = normalizePin(body.pin ?? '');
    if (!isValidPin(pin)) return json({ error: 'invalid' }, 400);

    const token = randomToken();
    const tokenHash = await sha256(token);
    const pinHash = await sha256(pin);

    const result = await appStorage(env).setupPin(pinHash, tokenHash);
    if (!result.ok) return json({ error: result.error }, STATUS[result.error]);

    const cookie = setCookie(SESSION_COOKIE, token, SESSION_DAYS * 24 * 60 * 60);
    return json({ ok: true }, 200, { 'Set-Cookie': cookie });
  }

  if (path === '/api/auth/unlock') {
    const body = (await request.json().catch(() => ({}))) as { pin?: string };
    const pin = normalizePin(body.pin ?? '');
    if (!isValidPin(pin)) return json({ error: 'invalid' }, 400);

    const token = randomToken();
    const tokenHash = await sha256(token);
    const pinHash = await sha256(pin);

    const result = await appStorage(env).unlock(pinHash, tokenHash);
    if (!result.ok) return json({ error: result.error }, STATUS[result.error]);

    const cookie = setCookie(SESSION_COOKIE, token, SESSION_DAYS * 24 * 60 * 60);
    return json({ ok: true }, 200, { 'Set-Cookie': cookie });
  }

  if (path === '/api/auth/lock') {
    if (hash) await appStorage(env).lock(hash);
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(SESSION_COOKIE) });
  }

  // Query & Command handlers
  const match = /^\/api\/(query|command)\/([a-zA-Z.]+)$/.exec(path);
  if (!match) return json({ error: 'not_found' }, 404);
  if (!hash) return json({ error: 'unauthenticated' }, 401);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'invalid' }, 400);
  }

  const [, kind, name] = match;
  const result = (kind === 'query'
    ? await appStorage(env).query(hash, name, input)
    : await appStorage(env).command(hash, name, input)) as ApiResult<unknown>;

  return result.ok ? json({ value: result.value }) : json({ error: result.error }, STATUS[result.error]);
}

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env, url);
    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller, env, _ctx): Promise<void> {
    await appStorage(env).tick();
  },
} satisfies ExportedHandler<Env>;
