// Pluggy's API over HTTPS (ADR-008). The API key comes from POST /auth on demand and lives only in
// memory, until shortly before its 2 hours run out. After a 429, waits as RateLimit-Reset says.
import type { PluggyApi } from '../application/ports';

const BASE = 'https://api.pluggy.ai';
const KEY_TTL_MS = (2 * 60 - 10) * 60 * 1000;
const MAX_ATTEMPTS = 3;
const MAX_WAIT_S = 60;

export interface PluggyCredentials {
  readonly PLUGGY_CLIENT_ID?: string;
  readonly PLUGGY_CLIENT_SECRET?: string;
}

let cachedKey: { readonly value: string; readonly until: number } | null = null;

export function pluggyClient(credentials: PluggyCredentials, wait = (ms: number) => new Promise((r) => setTimeout(r, ms))): PluggyApi {
  async function apiKey(refresh = false): Promise<string> {
    if (!refresh && cachedKey && cachedKey.until > Date.now()) return cachedKey.value;
    if (!credentials.PLUGGY_CLIENT_ID || !credentials.PLUGGY_CLIENT_SECRET) throw new Error('Pluggy credentials are not set');
    const response = await fetch(`${BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: credentials.PLUGGY_CLIENT_ID, clientSecret: credentials.PLUGGY_CLIENT_SECRET }),
    });
    if (!response.ok) throw new Error(`Pluggy /auth answered ${response.status}`);
    const { apiKey: value } = (await response.json()) as { apiKey: string };
    cachedKey = { value, until: Date.now() + KEY_TTL_MS };
    return value;
  }

  return {
    async get(path, query = {}) {
      const url = new URL(path, BASE);
      for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
      let refreshed = false;
      for (let attempt = 1; ; attempt++) {
        const response = await fetch(url, { headers: { 'X-API-KEY': await apiKey(), Accept: 'application/json' } });
        if (response.status === 401 && !refreshed) {
          refreshed = true;
          await apiKey(true);
          continue;
        }
        if (response.status === 429 && attempt < MAX_ATTEMPTS) {
          const reset = Number(response.headers.get('RateLimit-Reset') ?? response.headers.get('Retry-After') ?? MAX_WAIT_S);
          await wait(Math.min(Number.isFinite(reset) ? reset : MAX_WAIT_S, MAX_WAIT_S) * 1000);
          continue;
        }
        return { status: response.status, body: await response.text() };
      }
    },
  };
}
