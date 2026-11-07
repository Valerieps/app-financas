import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard for the invariant "only the collection writes the vault" (docs/ARQUITETURA.md):
 * the tables that hold what Pluggy returned are written only by server/application/collect/.
 * My decisions (categories, overrides, adjustments...) live in their own tables and never
 * edit the vault. A new table in migrations/ must be listed below as one or the other.
 */

const ROOT = join(__dirname, '..', '..');

/** What Pluggy returned, and the record of how it was collected. */
const VAULT_TABLES = [
  'raw_payloads',
  'webhook_events',
  'items',
  'sync_runs',
  'consents',
  'item_resources',
  'accounts',
  'account_balance_snapshots',
  'bills',
  'transactions',
  'transaction_versions',
  'transaction_payment_data',
  'transaction_card_data',
  'investments',
  'investment_snapshots',
  'investment_transactions',
  'loans',
  'record_versions',
  'identity',
  'scr_reports',
  'pluggy_categories',
];

/** Everything else: access, cron bookkeeping and my own decisions. */
const OTHER_TABLES = ['job_runs', 'passkeys', 'webauthn_challenges', 'sessions', 'confirmed_empty_days'];

/** The only folder whose code may write the vault. */
const COLLECTION = 'server/application/collect/';

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, pattern);
    return pattern.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const rel = (file: string) => relative(ROOT, file).split(sep).join('/');
const read = (file: string) => readFileSync(file, 'utf8');

// Every place that runs SQL against the database, outside the collection and the test helpers.
const writers = [
  ...files(join(ROOT, 'server'), /\.ts$/),
  ...files(join(ROOT, 'src'), /\.tsx?$/),
  ...files(join(ROOT, 'scripts'), /\.m?js$/),
]
  .filter((file) => !rel(file).startsWith(COLLECTION) && !rel(file).startsWith('server/testing/'));

const migrationTables = files(join(ROOT, 'migrations'), /\.sql$/).flatMap((file) =>
  [...read(file).matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi)].map((match) => match[1].toLowerCase()),
);

/** Statements that change a table's rows or its shape. */
const writeTo = (table: string) =>
  new RegExp(String.raw`\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM|DROP\s+TABLE(?:\s+IF\s+EXISTS)?|ALTER\s+TABLE)\s+["\`]?${table}\b`, 'i');

/** SQL whose table name is computed: only the collection may build it (the Mirror does). */
const COMPUTED_TABLE = /\b(?:INTO|UPDATE|FROM|TABLE)\s+\$\{/i;

describe('only the collection writes the vault', () => {
  it('finds the code and the tables', () => {
    expect(writers.length).toBeGreaterThan(0);
    expect(migrationTables.length).toBeGreaterThan(0);
  });

  it('every table in migrations/ is either vault or not', () => {
    const listed = [...VAULT_TABLES, ...OTHER_TABLES];
    expect(migrationTables.filter((table) => !listed.includes(table))).toEqual([]);
    expect(listed.filter((table) => !migrationTables.includes(table))).toEqual([]);
    expect(VAULT_TABLES.filter((table) => OTHER_TABLES.includes(table))).toEqual([]);
  });

  it.each(VAULT_TABLES)('nothing outside the collection writes %s', (table) => {
    expect(writers.filter((file) => writeTo(table).test(read(file))).map(rel)).toEqual([]);
  });

  it('nothing outside the collection builds a table name into SQL', () => {
    expect(writers.filter((file) => COMPUTED_TABLE.test(read(file))).map(rel)).toEqual([]);
  });

  it('the Mirror is used only by the collection', () => {
    expect(writers.filter((file) => /from\s+['"][^'"]*collect\/mirror['"]/.test(read(file))).map(rel)).toEqual([]);
  });

  it('the pattern catches a write and ignores a read', () => {
    expect(writeTo('transactions').test('UPDATE transactions SET description = ?')).toBe(true);
    expect(writeTo('transactions').test('INSERT OR REPLACE INTO\n  transactions (id) VALUES (?)')).toBe(true);
    expect(writeTo('transactions').test('DELETE FROM "transactions" WHERE id = ?')).toBe(true);
    expect(writeTo('transactions').test('SELECT * FROM transactions')).toBe(false);
    expect(writeTo('transactions').test('UPDATE transaction_versions SET x = 1')).toBe(false);
    expect(COMPUTED_TABLE.test('`UPDATE ${table} SET`')).toBe(true);
  });
});
