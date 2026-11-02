import type { ApiError, Topic } from '../../src/application/api-contract';
import type { Clock, IdGenerator, PluggyApi, RawStore, Sql } from './ports';

/** What every use case gets: the database, the raw archive, Pluggy, the time and new ids. */
export interface Context {
  readonly sql: Sql;
  readonly raw: RawStore;
  readonly pluggy: PluggyApi;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Work that may finish after the response (the Worker's `waitUntil`). */
  readonly background: (task: Promise<unknown>) => void;
}

/** A command's result: on success, the topics whose screens must refetch. */
export type CommandResult<T> =
  | { readonly ok: true; readonly value: T; readonly changed: readonly Topic[] }
  | { readonly ok: false; readonly error: ApiError };

export const failure = (error: ApiError) => ({ ok: false, error }) as const;

export function nowIso(ctx: Context): string {
  return ctx.clock.now().toISOString();
}

/** A query's specific failure; returning null from a query still means `forbidden`. */
export class QueryError {
  constructor(readonly error: ApiError) {}
}
