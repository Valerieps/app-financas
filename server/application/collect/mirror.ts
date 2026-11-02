// Tables that mirror a Pluggy list (accounts, bills, investments, loans, consents...). History,
// not overwrite: when a record changes beyond its volatile fields, the previous row goes to
// record_versions first. Rows already stored are loaded once per scope, so a sync costs one read
// per list instead of one per record.
import { nowIso, type Context } from '../context';
import { statement, type SqlValue, type Statement } from '../ports';

export type Row = Record<string, SqlValue>;

export interface MirrorOptions {
  readonly table: string;
  /** 'pluggy_id' for tables with their own id; 'id' when Pluggy's id is the primary key. */
  readonly key: 'pluggy_id' | 'id';
  /** Which stored rows to load: e.g. ['item_id', '...'] or ['account_id', '...']. */
  readonly scope: readonly [column: string, value: string];
  /** Top-level fields of the raw record whose change alone is not a new version (balances live in snapshots). */
  readonly volatile?: readonly string[];
}

export class Mirror {
  private constructor(
    private readonly ctx: Context,
    private readonly options: MirrorOptions,
    private readonly rows: Map<string, Row>,
  ) {}

  static async load(ctx: Context, options: MirrorOptions): Promise<Mirror> {
    const [column, value] = options.scope;
    const rows = await ctx.sql.all<Row>(`SELECT * FROM ${options.table} WHERE ${column} = ?`, value);
    return new Mirror(ctx, options, new Map(rows.map((row) => [String(row[options.key]), row])));
  }

  /** The stored row for a Pluggy id, if any. */
  find(pluggyId: string): Row | undefined {
    return this.rows.get(pluggyId);
  }

  /**
   * Inserts or updates one record. `adopt` is an existing row (found by another key) that this
   * Pluggy id now stands for, e.g. an account of the item this one renewed.
   */
  upsert(pluggyId: string, columns: Row, raw: unknown, adopt?: Row): { id: string; statements: Statement[]; inserted: boolean } {
    const { table, key } = this.options;
    const now = nowIso(this.ctx);
    const rawJson = JSON.stringify(raw);
    const current = this.rows.get(pluggyId) ?? adopt;

    if (!current) {
      const id = key === 'id' ? pluggyId : this.ctx.ids.next();
      const row: Row = { id, ...(key === 'pluggy_id' ? { pluggy_id: pluggyId } : {}), ...columns, raw_json: rawJson, first_seen_at: now, last_seen_at: now };
      this.rows.set(pluggyId, row);
      const names = Object.keys(row);
      return {
        id,
        inserted: true,
        statements: [statement(`INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`, ...names.map((n) => row[n]))],
      };
    }

    const id = String(current.id);
    const statements: Statement[] = [];
    const moved = key === 'pluggy_id' && current.pluggy_id !== pluggyId;
    if (moved || this.significant(current.raw_json) !== this.significant(rawJson)) {
      statements.push(
        statement(
          'INSERT INTO record_versions (id, table_name, record_id, previous_json, changed_at) VALUES (?, ?, ?, ?, ?)',
          this.ctx.ids.next(),
          table,
          id,
          JSON.stringify(current),
          now,
        ),
      );
    }
    const updated: Row = { ...(key === 'pluggy_id' ? { pluggy_id: pluggyId } : {}), ...columns, raw_json: rawJson, last_seen_at: now };
    const names = Object.keys(updated);
    statements.push(
      statement(`UPDATE ${table} SET ${names.map((n) => `${n} = ?`).join(', ')} WHERE id = ?`, ...names.map((n) => updated[n]), id),
    );
    this.rows.set(pluggyId, { ...current, ...updated });
    return { id, statements, inserted: false };
  }

  private significant(rawJson: SqlValue): string {
    try {
      const record = JSON.parse(String(rawJson)) as Record<string, unknown>;
      for (const field of ['updatedAt', ...(this.options.volatile ?? [])]) delete record[field];
      return JSON.stringify(record);
    } catch {
      return String(rawJson);
    }
  }
}
