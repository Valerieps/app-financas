// The stored automatic rules (ADR-009), read by the Regras use cases (rules.ts) and by the writes
// that rewrite the descriptions the rules leave (descriptions.ts).
import { parseRule, type RuleDefinition } from '../../src/domain/rules';
import type { Context } from './context';

export interface RuleRow {
  id: string;
  position: number;
  conditions_json: string;
  actions_json: string;
}

export const ruleRows = (ctx: Context) => ctx.sql.all<RuleRow>('SELECT id, position, conditions_json, actions_json FROM rules ORDER BY position, created_at');

/** A stored rule as the domain reads it; null if the stored JSON no longer parses. */
export function definition(row: RuleRow): RuleDefinition | null {
  return parseRule({ conditions: JSON.parse(row.conditions_json), actions: JSON.parse(row.actions_json) });
}

/** The rules in order, as stored (with any deleted tags still in them). */
export async function storedRules(ctx: Context): Promise<RuleDefinition[]> {
  return (await ruleRows(ctx)).flatMap((row) => definition(row) ?? []);
}
