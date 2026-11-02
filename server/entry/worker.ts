// The Worker: serves the app's files, the API under /api and the cron (ADR-004, ADR-006).
import type { ApiError } from '../../src/application/api-contract';
import { AppService } from '../application/app-service';
import type { Context } from '../application/context';
import * as lockService from '../application/lock';
import type { Caller } from '../application/lock';
import { accessEmail } from '../infrastructure/access';
import {
  clearCookie,
  DEVICE_COOKIE,
  DEVICE_COOKIE_SECONDS,
  readCookie,
  SESSION_COOKIE,
  SESSION_COOKIE_SECONDS,
  setCookie,
} from '../infrastructure/cookies';
import { sha256 } from '../infrastructure/crypto';
import { d1Sql } from '../infrastructure/d1-sql';
import { r2RawStore } from '../infrastructure/r2-raw-store';
import type { Env } from './env';

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const STATUS: Record<ApiError, number> = {
  unauthenticated: 401,
  locked: 401,
  forbidden: 403,
  not_found: 404,
  invalid: 400,
  conflict: 409,
  unavailable: 503,
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const response = new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json' } });
  new Headers(headers).forEach((value, key) => response.headers.append(key, value));
  return response;
}

const error = (code: ApiError) => json({ error: code }, STATUS[code]);

function context(env: Env): Context {
  return {
    sql: d1Sql(env.DB),
    raw: r2RawStore(env.RAW),
    clock: { now: () => new Date() },
    ids: { next: () => crypto.randomUUID() },
  };
}

/** In-app requests must come from the app's own pages. */
function sameOrigin(request: Request, url: URL): boolean {
  return request.headers.get('Origin') === url.origin;
}

async function caller(request: Request): Promise<Caller> {
  const cookies = request.headers.get('Cookie');
  const device = readCookie(cookies, DEVICE_COOKIE);
  const session = readCookie(cookies, SESSION_COOKIE);
  return { deviceTokenHash: device ? await sha256(device) : null, sessionTokenHash: session ? await sha256(session) : null };
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return null;
  }
}

/** The passkey ceremonies and the lock (ADR-007). */
async function auth(action: string, request: Request, ctx: Context, who: Caller, url: URL): Promise<Response> {
  const ceremony = { origin: url.origin, rpId: url.hostname };
  switch (action) {
    case 'status':
      return json({ value: await lockService.lockStatus(ctx, who) });
    case 'register/options':
      if (!(await lockService.gate(ctx, who))) return error('locked');
      return json({ value: await lockService.registrationOptions(ctx) });
    case 'register': {
      if (!(await lockService.gate(ctx, who))) return error('locked');
      const input = await body(request);
      if (!input) return error('invalid');
      const result = await lockService.register(ctx, input, ceremony);
      if (!result.ok) return error(result.error);
      const headers = new Headers();
      headers.append('Set-Cookie', setCookie(DEVICE_COOKIE, result.value.deviceToken, DEVICE_COOKIE_SECONDS));
      headers.append('Set-Cookie', setCookie(SESSION_COOKIE, result.value.sessionToken, SESSION_COOKIE_SECONDS));
      return json({ value: null, changed: result.changed }, 200, headers);
    }
    case 'unlock/options': {
      const options = await lockService.unlockOptions(ctx, who);
      return options ? json({ value: options }) : error('not_found');
    }
    case 'unlock': {
      const input = await body(request);
      if (!input) return error('invalid');
      const result = await lockService.unlock(ctx, who, input, ceremony);
      if (!result.ok) return error(result.error);
      return json({ value: null }, 200, { 'Set-Cookie': setCookie(SESSION_COOKIE, result.value.sessionToken, SESSION_COOKIE_SECONDS) });
    }
    case 'lock':
      await lockService.lock(ctx, who);
      return json({ value: null }, 200, { 'Set-Cookie': clearCookie(SESSION_COOKIE) });
    default:
      return error('not_found');
  }
}

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'POST') return error('not_found');
  if (!sameOrigin(request, url)) return error('forbidden');
  if (!(await accessEmail(request, env))) return error('unauthenticated');

  const ctx = context(env);
  const who = await caller(request);
  if (url.pathname.startsWith('/api/auth/')) return auth(url.pathname.slice('/api/auth/'.length), request, ctx, who, url);

  const match = /^\/api\/(query|command)\/([a-zA-Z.]+)$/.exec(url.pathname);
  if (!match) return error('not_found');
  if (!(await lockService.gate(ctx, who))) return error('locked');
  const input = await body(request);
  if (!input) return error('invalid');

  const [, kind, name] = match;
  const service = new AppService(ctx);
  if (kind === 'query') {
    const result = await service.query(name, input, who);
    return result.ok ? json({ value: result.value }) : error(result.error);
  }
  const result = await service.command(name, input, who);
  return result.ok ? json({ value: result.value, changed: result.changed }) : error(result.error);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env, url);
    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller, env): Promise<void> {
    await new AppService(context(env)).tick();
  },
} satisfies ExportedHandler<Env>;
