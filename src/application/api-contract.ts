// The contract between the app and the server: query and command names, inputs and outputs.
// Types only. The server imports it with `import type`, so nothing here runs on either side.

export interface VaultView {
  readonly connectionCount: number;
}

/** Reads: `POST /api/query/<name>`. They never change anything. */
export interface Queries {
  vault: { input: Record<string, never>; output: VaultView };
}

/** Writes: `POST /api/command/<name>`. Each sends its writes in one atomic batch. */
export interface Commands {}

export type QueryName = keyof Queries;
export type CommandName = keyof Commands;

/** What a command says changed; screens that read these topics refetch. */
export type Topic = 'vault';

export type ApiError = 'unauthenticated' | 'forbidden' | 'not_found' | 'invalid' | 'conflict' | 'unavailable';

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };

/** A successful command's response body. */
export interface CommandResponse<T> {
  readonly value: T;
  readonly changed: readonly Topic[];
}
