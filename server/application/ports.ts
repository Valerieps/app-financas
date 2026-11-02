// Ports the server's use cases depend on. D1 and R2 implement them in production; tests use
// node:sqlite and memory (server/testing/). Nothing here imports Cloudflare types.

export type SqlValue = string | number | null;

export interface Statement {
  readonly query: string;
  readonly bindings: readonly SqlValue[];
}

export const statement = (query: string, ...bindings: SqlValue[]): Statement => ({ query, bindings });

/**
 * Asynchronous SQLite, as D1 provides it. D1 has no interactive transactions: a use case reads
 * first, decides, then sends every write that must land together in one `batch`.
 */
export interface Sql {
  all<T = Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]): Promise<T[]>;
  run(query: string, ...bindings: SqlValue[]): Promise<void>;
  /** Runs the statements in order, atomically: all of them commit or none does. */
  batch(statements: readonly Statement[]): Promise<void>;
}

/** The raw archive (R2): whole bodies, written before any normalization. */
export interface RawStore {
  put(key: string, body: string): Promise<void>;
  get(key: string): Promise<string | null>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}
