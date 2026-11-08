// Automatic rules, "if this then that" (docs/spec/regras-automaticas.md): each rule has conditions,
// all of which must hold, and actions. The conditions are "the description contains a text" (with
// "|" for or and "&" for and) and
// "the lançamento is of this type"; the only action is "add these tags". New kinds join the unions
// below (ADR-009).
import type { Direction } from './lancamentos';
import { assignTag, cleanName, type TagAssignment } from './tags';

/** At most this many rules. */
export const MAX_RULES = 200;
/** A condition's text has at most this many characters. */
export const MAX_RULE_TEXT_LENGTH = 100;
/** At most this many conditions, and this many actions, in one rule. */
export const MAX_RULE_PARTS = 5;
/** The "Testar" button shows at most this many lançamentos. */
export const RULE_PREVIEW_LIMIT = 10;

/** Entrada, saída or transferência. */
export type LancamentoType = 'in' | 'out' | 'transfer';
export const LANCAMENTO_TYPES: readonly LancamentoType[] = ['out', 'in', 'transfer'];

export type RuleCondition =
  | { readonly kind: 'descriptionContains'; readonly text: string }
  | { readonly kind: 'type'; readonly type: LancamentoType };
export type RuleAction = { readonly kind: 'addTags'; readonly tags: TagAssignment };

export interface RuleDefinition {
  readonly conditions: readonly RuleCondition[];
  readonly actions: readonly RuleAction[];
}

/** What a rule looks at in a lançamento. */
export interface RuleSubject {
  readonly description: string | null;
  readonly direction: Direction;
  /** The category that counts: the one I chose, or else Pluggy's. */
  readonly categoryId: string | null;
  readonly cardPayment: boolean;
}

/** Pluggy's top categories for money moved between accounts: "Same person transfer" and "Transfers". */
const TRANSFER_CATEGORIES = ['04', '05'];

/**
 * A lançamento's type: a transferência when its category is a transfer (Pluggy's groups 04 and 05)
 * or it pays the card bill; otherwise an entrada or a saída, by the money's direction.
 */
export function lancamentoType(subject: Pick<RuleSubject, 'direction' | 'categoryId' | 'cardPayment'>): LancamentoType {
  if (subject.cardPayment || TRANSFER_CATEGORIES.some((prefix) => subject.categoryId?.startsWith(prefix))) return 'transfer';
  return subject.direction;
}

/** Text as rules compare it: no case, no accents, single spaces. */
export function textKey(text: string): string {
  return cleanName(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

/**
 * A "descrição contém" text read as alternatives ("|", ou) of terms that must all appear ("&", e);
 * "&" binds tighter, so "ifood | uber & eats" is "ifood" or ("uber" and "eats"). Terms are already
 * in `textKey` form. Null when an operator has no text on one side.
 */
export function containsExpression(text: string): string[][] | null {
  const alternatives = text.split('|').map((alternative) => alternative.split('&').map(textKey));
  return alternatives.every((terms) => terms.every(Boolean)) ? alternatives : null;
}

function descriptionContains(description: string, text: string): boolean {
  const key = textKey(description);
  return (containsExpression(text) ?? []).some((terms) => terms.every((term) => key.includes(term)));
}

export function conditionHolds(condition: RuleCondition, subject: RuleSubject): boolean {
  switch (condition.kind) {
    case 'descriptionContains':
      return subject.description !== null && descriptionContains(subject.description, condition.text);
    case 'type':
      return lancamentoType(subject) === condition.type;
  }
}

/** Every condition holds; a rule without conditions matches nothing. */
export function ruleMatches(rule: Pick<RuleDefinition, 'conditions'>, subject: RuleSubject): boolean {
  return rule.conditions.length > 0 && rule.conditions.every((c) => conditionHolds(c, subject));
}

/**
 * The tags the rules add to a lançamento that has `current`: each rule that matches, in order,
 * fills only the layers still empty, so a tag I chose stays and the first rule wins a layer.
 * Returns only the new layers.
 */
export function tagsFromRules(rules: readonly RuleDefinition[], subject: RuleSubject, current: TagAssignment = {}): TagAssignment {
  let result: TagAssignment = {};
  for (const rule of rules) {
    if (!ruleMatches(rule, subject)) continue;
    for (const action of rule.actions) {
      if (action.kind !== 'addTags') continue;
      for (const [layerId, tagId] of Object.entries(action.tags)) {
        if (current[layerId] === undefined && result[layerId] === undefined) result = assignTag(result, { id: tagId, layerId });
      }
    }
  }
  return result;
}

/** The rule without the tags that no longer exist (a tag or a layer deleted after the rule was saved). */
export function withExistingTags(rule: RuleDefinition, exists: (layerId: string, tagId: string) => boolean): RuleDefinition {
  return {
    conditions: rule.conditions,
    actions: rule.actions.map((action) =>
      action.kind === 'addTags'
        ? { kind: 'addTags', tags: Object.fromEntries(Object.entries(action.tags).filter(([layerId, tagId]) => exists(layerId, tagId))) }
        : action,
    ),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function parseCondition(raw: unknown): RuleCondition | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'descriptionContains' && typeof raw.text === 'string') {
    const text = cleanName(raw.text);
    if (!text || [...text].length > MAX_RULE_TEXT_LENGTH || !containsExpression(text)) return null;
    return { kind: 'descriptionContains', text };
  }
  if (raw.kind === 'type' && (LANCAMENTO_TYPES as readonly unknown[]).includes(raw.type)) {
    return { kind: 'type', type: raw.type as LancamentoType };
  }
  return null;
}

function parseAction(raw: unknown): RuleAction | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'addTags' && isRecord(raw.tags)) {
    const entries = Object.entries(raw.tags);
    if (entries.length === 0 || !entries.every(([layerId, tagId]) => layerId && typeof tagId === 'string' && tagId)) return null;
    return { kind: 'addTags', tags: Object.fromEntries(entries) as Record<string, string> };
  }
  return null;
}

function parseList<T>(raw: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_RULE_PARTS) return null;
  const parsed = raw.map(parse);
  return parsed.every((p) => p !== null) ? (parsed as T[]) : null;
}

/** Reads a rule's conditions as the API receives them, cleaned; null when malformed. */
export function parseConditions(raw: unknown): RuleCondition[] | null {
  return parseList(raw, parseCondition);
}

/** Reads a rule as the API receives it, cleaned; null when malformed. */
export function parseRule(raw: unknown): RuleDefinition | null {
  if (!isRecord(raw)) return null;
  const conditions = parseConditions(raw.conditions);
  const actions = parseList(raw.actions, parseAction);
  return conditions && actions ? { conditions, actions } : null;
}
