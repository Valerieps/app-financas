// The API over HTTP, same origin. Inputs always go in a JSON body, never in the URL.
import type {
  ApiError,
  ApiResult,
  CommandResponse,
  LockStatusView,
  RegistrationOptions,
  Topic,
  UnlockOptions,
} from '../application/api-contract';
import type { Backend, DeviceLock } from '../application/ports';
import { createPasskey, passkeysSupported, assertPasskey } from './passkey';

const lockedListeners = new Set<() => void>();

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
  if (payload.error === 'locked') lockedListeners.forEach((listener) => listener());
  return { ok: false, error: payload.error ?? 'unavailable' };
}

export function httpBackend(): Backend {
  const listeners = new Set<(topics: readonly Topic[]) => void>();
  return {
    query: (name, input) => post(`/api/query/${name}`, input),
    command: async (name, input) => {
      const { changed, ...result } = await post<never>(`/api/command/${name}`, input);
      if (result.ok && changed?.length) listeners.forEach((listener) => listener(changed));
      return result;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onLocked(listener) {
      lockedListeners.add(listener);
      return () => lockedListeners.delete(listener);
    },
  };
}

export function httpDeviceLock(): DeviceLock {
  return {
    status: () => post<LockStatusView>('/api/auth/status', {}),
    supported: passkeysSupported,
    async register(label) {
      const options = await post<RegistrationOptions>('/api/auth/register/options', {});
      if (!options.ok) return options;
      const input = await createPasskey(options.value, label);
      if (!input) return { ok: false, error: 'cancelled' };
      const { changed: _changed, ...result } = await post<null>('/api/auth/register', input);
      return result;
    },
    async unlock() {
      const options = await post<UnlockOptions>('/api/auth/unlock/options', {});
      if (!options.ok) return options;
      const input = await assertPasskey(options.value);
      if (!input) return { ok: false, error: 'cancelled' };
      const { changed: _changed, ...result } = await post<null>('/api/auth/unlock', input);
      return result;
    },
    async lock() {
      await post('/api/auth/lock', {});
    },
  };
}
