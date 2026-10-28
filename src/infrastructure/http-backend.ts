// The API over HTTP, same origin. Inputs always go in a JSON body, never in the URL.
import type { ApiError, ApiResult, AuthStatusView } from '../application/api-contract';
import type { Backend } from '../application/ports';

async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return { ok: false, error: 'unavailable' };
  }
  const payload = (await response.json().catch(() => ({}))) as { value?: T; error?: ApiError };
  if (response.ok) return { ok: true, value: payload.value as T };
  return { ok: false, error: payload.error ?? 'unavailable' };
}

export function httpBackend(): Backend {
  return {
    authStatus: () => post<AuthStatusView>('/api/auth/status', {}),
    setupPin: (pin: string) => post<null>('/api/auth/setup', { pin }),
    unlock: (pin: string) => post<null>('/api/auth/unlock', { pin }),
    lock: async () => {
      await post('/api/auth/lock', {});
    },
    query: (name, input) => post(`/api/query/${name}`, input),
    command: (name, input) => post(`/api/command/${name}`, input),
  };
}
