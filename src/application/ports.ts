// What the UI needs from the outside world. src/infrastructure/ implements it; the UI receives it
// through ServicesProvider and never makes network calls itself.
import type { ApiResult, AuthStatusView, CommandName, Commands, QueryName, Queries, Topic } from './api-contract';

export interface Backend {
  authStatus(): Promise<ApiResult<AuthStatusView>>;
  setupPin(pin: string): Promise<ApiResult<null>>;
  unlock(pin: string): Promise<ApiResult<null>>;
  lock(): Promise<void>;
  query<N extends QueryName>(name: N, input: Queries[N]['input']): Promise<ApiResult<Queries[N]['output']>>;
  command<N extends CommandName>(name: N, input: Commands[N]['input']): Promise<ApiResult<Commands[N]['output']>>;
}

export type LiveStatus = 'connecting' | 'online' | 'offline';

export interface LiveUpdates {
  /** Calls `onChange` with the topics that changed; also with every topic after a reconnect. */
  subscribe(onChange: (topics: readonly Topic[]) => void): () => void;
  onStatus(listener: (status: LiveStatus) => void): () => void;
  start(): void;
  stop(): void;
}
