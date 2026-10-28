// The contract between the app and the server: query and command names, inputs and outputs.
// Types only. The server imports it with `import type`, so nothing here runs on either side.

export interface AuthStatusView {
  readonly configured: boolean;
  readonly authenticated: boolean;
}

export interface ItemView {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
}

export interface AppStatusView {
  readonly configured: boolean;
  readonly itemCount: number;
  readonly lastActiveAt: string;
}

/** Reads: `POST /api/query/<name>`. They never change anything. */
export interface Queries {
  status: { input: Record<string, never>; output: AppStatusView };
  items: { input: Record<string, never>; output: ItemView[] };
}

/** Writes: `POST /api/command/<name>`. Each runs alone, in one transaction. */
export interface Commands {
  'item.create': { input: { title: string }; output: ItemView };
  'item.delete': { input: { id: string }; output: null };
}

export type QueryName = keyof Queries;
export type CommandName = keyof Commands;

/** What a live message says changed; screens that subscribe refetch. */
export type Topic = 'status' | 'items';

export interface LiveMessage {
  readonly type: 'changed';
  readonly topics: readonly Topic[];
}

export type ApiError = 'unauthenticated' | 'forbidden' | 'not_found' | 'invalid' | 'conflict' | 'unavailable';

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };
