import { afterEach, describe, expect, it, vi } from 'vitest';
import { pluggyClient } from './pluggy-client';

function stubFetch(answers: Response[]) {
  const calls: { url: string; key: string | null }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, key: new Headers(init?.headers).get('X-API-KEY') });
      return answers.shift() ?? new Response('{}', { status: 500 });
    }),
  );
  return calls;
}

const auth = (key: string) => new Response(JSON.stringify({ apiKey: key }), { status: 200 });
const credentials = { PLUGGY_CLIENT_ID: 'id', PLUGGY_CLIENT_SECRET: 'secret' };

afterEach(() => vi.unstubAllGlobals());

describe('pluggyClient', () => {
  it('creates the API key once and reuses it', async () => {
    const calls = stubFetch([auth('k1'), new Response('{"a":1}'), new Response('{"b":2}')]);
    const client = pluggyClient(credentials);
    expect(await client.get('/accounts', { itemId: 'x' })).toEqual({ status: 200, body: '{"a":1}' });
    expect(await client.get('/bills')).toEqual({ status: 200, body: '{"b":2}' });
    expect(calls.map((c) => c.url)).toEqual(['https://api.pluggy.ai/auth', 'https://api.pluggy.ai/accounts?itemId=x', 'https://api.pluggy.ai/bills']);
    expect(calls[1].key).toBe('k1');
  });

  it('waits as RateLimit-Reset says after a 429, then tries again', async () => {
    const waits: number[] = [];
    stubFetch([new Response('{}', { status: 429, headers: { 'RateLimit-Reset': '7', 'Retry-After': '60' } }), new Response('{"ok":true}')]);
    const client = pluggyClient(credentials, async (ms) => void waits.push(ms));
    expect(await client.get('/accounts')).toEqual({ status: 200, body: '{"ok":true}' });
    expect(waits).toEqual([7000]);
  });

  it('gets a new API key once when Pluggy refuses the cached one', async () => {
    const calls = stubFetch([new Response('{}', { status: 401 }), auth('k2'), new Response('[]')]);
    const client = pluggyClient(credentials);
    expect(await client.get('/accounts')).toEqual({ status: 200, body: '[]' });
    expect(calls.map((c) => c.key)).toEqual(['k1', null, 'k2']);
  });
});
