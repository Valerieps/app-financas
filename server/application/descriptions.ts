// The description my rules leave on each lançamento (docs/spec/regras-automaticas.md), stored in
// transaction_descriptions beside the bank's, which stays untouched in transactions. Reads never
// rerun the rules: every write that can change a description (a rule, my category choice, a
// lançamento the collection stores) adds these statements to its own batch.
import { cardPaymentWithChoice, direction } from '../../src/domain/lancamentos';
import { describeWithRules, type RuleDefinition, type RuleSubject } from '../../src/domain/rules';
import { nowIso, type Context } from './context';
import { statement, type Statement } from './ports';
import { storedRules } from './rule-store';

export type Subject = RuleSubject & { readonly id: string };

/** Rows per statement: each row is one element of a JSON parameter, far below D1's limits. */
const CHUNK = 500;

/**
 * The stored lançamentos a rule can look at, newest first; only `ids` when given. `chosen` stands in
 * for my category choice on all of them, for a choice about to be written (null: taking it off).
 */
export async function ruleSubjects(ctx: Context, options: { ids?: readonly string[]; chosen?: string | null } = {}): Promise<Subject[]> {
  const rows = await ctx.sql.all<{
    id: string;
    description: string | null;
    type: string | null;
    amount_cents: number;
    account_type: string | null;
    pluggy_category_id: string | null;
    chosen_category_id: string | null;
    card_payment: number;
  }>(
    `SELECT t.id, t.description, t.type, t.amount_cents, a.type AS account_type, t.pluggy_category_id,
            tc.pluggy_category_id AS chosen_category_id, t.card_payment
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN transaction_categories tc ON tc.transaction_id = t.id
     WHERE t.deleted_at IS NULL ${options.ids ? 'AND t.id IN (SELECT value FROM json_each(?))' : ''}
     ORDER BY t.date DESC, t.first_seen_at DESC, t.id`,
    ...(options.ids ? [JSON.stringify(options.ids)] : []),
  );
  return rows.map((row) => {
    const chosen = options.chosen === undefined ? row.chosen_category_id : options.chosen;
    return {
      id: row.id,
      description: row.description,
      direction: direction(row.type, row.amount_cents, row.account_type),
      categoryId: chosen ?? row.pluggy_category_id,
      cardPayment: cardPaymentWithChoice(row.card_payment === 1, chosen),
    };
  });
}

/** The descriptions stored now, by lançamento; only `ids` when given. */
export async function storedDescriptions(ctx: Context, ids?: readonly string[]): Promise<Map<string, string | null>> {
  const rows = await ctx.sql.all<{ transaction_id: string; description: string | null }>(
    ids
      ? 'SELECT transaction_id, description FROM transaction_descriptions WHERE transaction_id IN (SELECT value FROM json_each(?))'
      : 'SELECT transaction_id, description FROM transaction_descriptions',
    ...(ids ? [JSON.stringify(ids)] : []),
  );
  return new Map(rows.map((row) => [row.transaction_id, row.description]));
}

/**
 * The writes that leave `subjects`' stored descriptions as `rules` make them, given `current` (what
 * is stored for them now): a row where the rules change the bank's description, none where they do not.
 */
export function descriptionStatements(
  rules: readonly RuleDefinition[],
  subjects: readonly Subject[],
  current: ReadonlyMap<string, string | null>,
  now: string,
): Statement[] {
  const upserts: [string, string | null][] = [];
  const deletes: string[] = [];
  for (const subject of subjects) {
    const described = describeWithRules(rules, subject);
    if (described === subject.description) {
      if (current.has(subject.id)) deletes.push(subject.id);
    } else if (!current.has(subject.id) || current.get(subject.id) !== described) {
      upserts.push([subject.id, described]);
    }
  }
  const statements: Statement[] = [];
  for (let i = 0; i < upserts.length; i += CHUNK) {
    statements.push(
      statement(
        `INSERT INTO transaction_descriptions (transaction_id, description, described_at)
         SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), ? FROM json_each(?) WHERE true
         ON CONFLICT (transaction_id) DO UPDATE SET description = excluded.description, described_at = excluded.described_at`,
        now,
        JSON.stringify(upserts.slice(i, i + CHUNK)),
      ),
    );
  }
  for (let i = 0; i < deletes.length; i += CHUNK) {
    statements.push(statement('DELETE FROM transaction_descriptions WHERE transaction_id IN (SELECT value FROM json_each(?))', JSON.stringify(deletes.slice(i, i + CHUNK))));
  }
  return statements;
}

/** The writes that bring every stored lançamento's description in line with `rules`. */
export async function rewriteDescriptions(ctx: Context, rules: readonly RuleDefinition[], now: string): Promise<Statement[]> {
  const [subjects, current] = await Promise.all([ruleSubjects(ctx), storedDescriptions(ctx)]);
  // A row left from a lançamento since deleted stays: it comes back if the lançamento does.
  return descriptionStatements(rules, subjects, current, now);
}

const JOB = 'descriptions';
const EVERY_MS = 86_400_000;

/**
 * The cron's job: once a day, and on the first run after the table appeared, every description is
 * rewritten from the stored rules, in case a write ever missed one.
 */
export async function rewriteDescriptionsJob(ctx: Context): Promise<void> {
  const [last] = await ctx.sql.all<{ last_run_at: string }>('SELECT last_run_at FROM job_runs WHERE job = ?', JOB);
  if (last && Date.parse(last.last_run_at) > ctx.clock.now().getTime() - EVERY_MS) return;
  const now = nowIso(ctx);
  const writes = await rewriteDescriptions(ctx, await storedRules(ctx), now);
  await ctx.sql.batch([
    ...writes,
    statement('INSERT INTO job_runs (job, last_run_at) VALUES (?, ?) ON CONFLICT (job) DO UPDATE SET last_run_at = excluded.last_run_at', JOB, now),
  ]);
}
