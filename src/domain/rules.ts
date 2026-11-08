// Automatic rules, "if this then that" (docs/spec/regras-automaticas.md): each rule has conditions,
// all of which must hold, and actions. Today the only condition is "the description contains a
// text" and the only action is "add these tags"; new kinds join the two unions below (ADR-009).
import { assignTag, cleanName, type TagAssignment } from './tags';

/** At most this many rules. */
export const MAX_RULES = 200;
/** A condition's text has at most this many characters. */
export const MAX_RULE_TEXT_LENGTH = 100;
/** At most this many conditions, and this many actions, in one rule. */
export const MAX_RULE_PARTS = 5;
/** The "Testar" button shows at most this many lançamentos. */
export const RULE_PREVIEW_LIMIT = 10;

export type RuleCondition = { readonly kind: 'descriptionContains'; readonly text: string };
export type RuleAction = { readonly kind: 'addTags'; readonly tags: TagAssignment };

export interface RuleDefinition {
  readonly conditions: readonly RuleCondition[];
  readonly actions: readonly RuleAction[];
}

/** What a rule looks at in a lançamento. */
export interface RuleSubject {
  readonly description: string | null;
}

/** Text as rules compare it: no case, no accents, single spaces. */
export function textKey(text: string): string {
  return cleanName(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

export function conditionHolds(condition: RuleCondition, subject: RuleSubject): boolean {
  switch (condition.kind) {
    case 'descriptionContains':
      return subject.description !== null && textKey(subject.description).includes(textKey(condition.text));
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
    if (!text || [...text].length > MAX_RULE_TEXT_LENGTH) return null;
    return { kind: 'descriptionContains', text };
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
