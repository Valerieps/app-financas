// The Sql port over D1 (ADR-006). `batch` is D1's atomic unit: it runs as one transaction.
import type { Sql, SqlValue } from '../application/ports';

export function d1Sql(db: D1Database): Sql {
  const prepare = (query: string, bindings: readonly SqlValue[]) => db.prepare(query).bind(...bindings);
  return {
    all: async <T>(query: string, ...bindings: SqlValue[]) => (await prepare(query, bindings).all<T>()).results,
    run: async (query, ...bindings) => {
      await prepare(query, bindings).run();
    },
    batch: async (statements) => {
      if (statements.length === 0) return;
      await db.batch(statements.map(({ query, bindings }) => prepare(query, bindings)));
    },
  };
}
