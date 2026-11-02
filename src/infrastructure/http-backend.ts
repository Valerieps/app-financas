// The API over HTTP, same origin. Inputs always go in a JSON body, never in the URL.
import type { ApiError, ApiResult, CommandResponse, Topic } from '../application/api-contract';
import type { Backend } from '../application/ports';

async function post<T>(path: string, body: unknown): Promise<ApiResult<T> & { changed?: readonly Topic[] }> {
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
  const payload = (await response.json().catch(() => ({}))) as Partial<CommandResponse<T>> & { error?: ApiError };
  if (response.ok) return { ok: true, value: payload.value as T, changed: payload.changed };
  return { ok: false, error: payload.error ?? 'unavailable' };
}

export function httpBackend(): Backend {
  const listeners = new Set<(topics: readonly Topic[]) => void>();
  return {
    query: (name, input) => post(`/api/query/${name}`, input),
    command: async (name, input) => {
      const { changed, ...result } = await post<never>(`/api/command/${String(name)}`, input);
      if (result.ok && changed?.length) listeners.forEach((listener) => listener(changed));
      return result;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
