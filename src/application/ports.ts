// What the UI needs from the outside world. src/infrastructure/ implements it; the UI receives it
// through ServicesProvider and never makes network calls itself.
import type { ApiResult, CommandName, Commands, LockStatusView, QueryName, Queries, Topic } from './api-contract';

export interface Backend {
  query<N extends QueryName>(name: N, input: Queries[N]['input']): Promise<ApiResult<Queries[N]['output']>>;
  command<N extends CommandName>(name: N, input: Commands[N]['input']): Promise<ApiResult<Commands[N]['output']>>;
  /** Calls `listener` with the topics a successful command changed, so screens can refetch. */
  onChange(listener: (topics: readonly Topic[]) => void): () => void;
  /** Calls `listener` whenever the API answers that this device is locked. */
  onLocked(listener: () => void): () => void;
}

/** The passkey lock (docs/spec/acesso.md). `cancelled`: the owner dismissed the fingerprint prompt. */
export interface DeviceLock {
  status(): Promise<ApiResult<LockStatusView>>;
  supported(): Promise<boolean>;
  register(label: string): Promise<ApiResult<null> | { ok: false; error: 'cancelled' }>;
  unlock(): Promise<ApiResult<null> | { ok: false; error: 'cancelled' }>;
  lock(): Promise<void>;
}
