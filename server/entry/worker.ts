// The Worker: serves the app's files, the API under /api and the cron (ADR-004, ADR-006).
import type { ApiError, ApiResult } from '../../src/application/api-contract';
import { AppService } from '../application/app-service';
import { accessEmail } from '../infrastructure/access';
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

function service(env: Env): AppService {
  return new AppService({
    sql: d1Sql(env.DB),
    raw: r2RawStore(env.RAW),
    clock: { now: () => new Date() },
    ids: { next: () => crypto.randomUUID() },
  });
}

/** In-app requests must come from the app's own pages. */
function sameOrigin(request: Request, url: URL): boolean {
  return request.headers.get('Origin') === url.origin;
}

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'not_found' }, 404);
  if (!sameOrigin(request, url)) return json({ error: 'forbidden' }, 403);
  if (!(await accessEmail(request, env))) return json({ error: 'unauthenticated' }, 401);

  const match = /^\/api\/(query|command)\/([a-zA-Z.]+)$/.exec(url.pathname);
  if (!match) return json({ error: 'not_found' }, 404);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'invalid' }, 400);
  }

  const [, kind, name] = match;
  if (kind === 'query') {
    const result: ApiResult<unknown> = await service(env).query(name, input);
    return result.ok ? json({ value: result.value }) : json({ error: result.error }, STATUS[result.error]);
  }
  const result = await service(env).command(name, input);
  return result.ok
    ? json({ value: result.value, changed: result.changed })
    : json({ error: result.error }, STATUS[result.error]);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env, url);
    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller, env): Promise<void> {
    await service(env).tick();
  },
} satisfies ExportedHandler<Env>;
