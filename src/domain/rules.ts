// Automatic rules, "if this then that" (docs/spec/regras-automaticas.md): each rule has conditions,
// all of which must hold, and actions. The conditions are "the description contains a text" (with
// "|" for or and "&" for and), "the lançamento is of this type", "who paid an entrada contains a
// text", "the operação contains a text" and "the category is (or is under) this one"; the actions are "add these tags", "replace this text in the description" and "set the
// category". New kinds join the unions below (ADR-009).
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
/** A category id (Pluggy's, like "05100000") has at most this many characters. */
const MAX_CATEGORY_ID_LENGTH = 64;

/** Entrada, saída or transferência. */
export type LancamentoType = 'in' | 'out' | 'transfer';
export const LANCAMENTO_TYPES: readonly LancamentoType[] = ['out', 'in', 'transfer'];

export type RuleCondition =
  | { readonly kind: 'descriptionContains'; readonly text: string }
  | { readonly kind: 'type'; readonly type: LancamentoType }
  | { readonly kind: 'payerContains'; readonly text: string }
  | { readonly kind: 'operationContains'; readonly text: string }
  | { readonly kind: 'category'; readonly categoryId: string };
export type RuleAction =
  | { readonly kind: 'addTags'; readonly tags: TagAssignment }
  | { readonly kind: 'replaceInDescription'; readonly find: string; readonly replace: string }
  | { readonly kind: 'setCategory'; readonly categoryId: string };

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
  /** Who paid, as the bank names them; null when the bank sent no name. */
  readonly payer: string | null;
  /** The operação as the detail shows it (`operationLabel`); null when the bank sent none. */
  readonly operation: string | null;
}

/** The operação: Pluggy's operation type and payment method, like "PIX · PIX"; null when neither came. */
export function operationLabel(operationType: string | null | undefined, paymentMethod: string | null | undefined): string | null {
  return [operationType, paymentMethod].filter(Boolean).join(' · ') || null;
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

/**
 * Whether `categoryId` is `ancestorId` or sits under it in Pluggy's tree. Pluggy's ids follow the
 * tree: a child keeps its parent's digits and fills the parent's trailing "00" pairs ("05000000"
 * holds "05070000", which holds "05070100").
 */
export function categoryWithin(categoryId: string | null, ancestorId: string): boolean {
  if (categoryId === null) return false;
  if (categoryId === ancestorId) return true;
  const prefix = ancestorId.replace(/(00)+$/, '');
  return prefix !== ancestorId && prefix.length > 0 && categoryId.length === ancestorId.length && categoryId.startsWith(prefix);
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
    case 'payerContains':
      // Money coming in, even a "transferência recebida" (Pluggy files those under Transfers).
      return subject.direction === 'in' && !subject.cardPayment && subject.payer !== null && descriptionContains(subject.payer, condition.text);
    case 'operationContains':
      return subject.operation !== null && descriptionContains(subject.operation, condition.text);
    case 'category':
      return categoryWithin(subject.categoryId, condition.categoryId);
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

/**
 * The category the rules give a lançamento whose category I have not chosen (`chosen` false): the
 * first rule that matches and sets a category wins. Null when no rule sets one, or I chose already.
 */
export function categoryFromRules(rules: readonly RuleDefinition[], subject: RuleSubject, chosen: boolean): string | null {
  if (chosen) return null;
  for (const rule of rules) {
    if (!ruleMatches(rule, subject)) continue;
    const action = rule.actions.find((a) => a.kind === 'setCategory');
    if (action) return action.categoryId;
  }
  return null;
}

/** One character as `textKey` compares it: no case, no accents, any space a plain one. */
function foldChar(char: string): string {
  return /\s/u.test(char) ? ' ' : char.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
}

/**
 * `text` with every occurrence of `find` replaced by `replacement`, found as rules compare text (no
 * case, no accents, repeated spaces as one), with the result's spaces tidied. Null when nothing is left.
 */
export function replaceText(text: string, find: string, replacement: string): string | null {
  const needle = textKey(find);
  const chars = [...text];
  let folded = '';
  // The character of `text` behind each code unit of `folded`.
  const owner: number[] = [];
  chars.forEach((char, index) => {
    const key = foldChar(char);
    if (key === ' ' && (folded === '' || folded.endsWith(' '))) return;
    folded += key;
    for (let i = 0; i < key.length; i++) owner.push(index);
  });
  let result = '';
  let next = 0;
  for (let at = needle ? folded.indexOf(needle) : -1; at !== -1; at = folded.indexOf(needle, at + needle.length)) {
    const from = owner[at];
    const to = owner[at + needle.length - 1] + 1;
    if (from < next) continue;
    result += chars.slice(next, from).join('') + replacement;
    next = to;
  }
  result += chars.slice(next).join('');
  return cleanName(result) || null;
}

/** `description` after a rule's "replace in the description" actions, in order. */
export function applyReplacements(actions: readonly RuleAction[], description: string | null): string | null {
  return actions.reduce<string | null>(
    (text, action) => (action.kind === 'replaceInDescription' && text !== null ? replaceText(text, action.find, action.replace) : text),
    description,
  );
}

/**
 * A lançamento's description as the rules leave it: each rule that matches, in order, replaces its
 * texts in what the rules before it left. The conditions always look at the bank's description.
 */
export function describeWithRules(rules: readonly RuleDefinition[], subject: RuleSubject): string | null {
  return rules.reduce((description, rule) => (ruleMatches(rule, subject) ? applyReplacements(rule.actions, description) : description), subject.description);
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
  if ((raw.kind === 'descriptionContains' || raw.kind === 'payerContains' || raw.kind === 'operationContains') && typeof raw.text === 'string') {
    const text = cleanName(raw.text);
    if (!text || [...text].length > MAX_RULE_TEXT_LENGTH || !containsExpression(text)) return null;
    return { kind: raw.kind, text };
  }
  if (raw.kind === 'category' && typeof raw.categoryId === 'string') {
    const { categoryId } = raw;
    if (!categoryId || categoryId.length > MAX_CATEGORY_ID_LENGTH) return null;
    return { kind: 'category', categoryId };
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
  if (raw.kind === 'replaceInDescription' && typeof raw.find === 'string' && typeof raw.replace === 'string') {
    const find = cleanName(raw.find);
    const { replace } = raw;
    if (!find || [...find].length > MAX_RULE_TEXT_LENGTH || [...replace].length > MAX_RULE_TEXT_LENGTH) return null;
    return { kind: 'replaceInDescription', find, replace };
  }
  if (raw.kind === 'setCategory' && typeof raw.categoryId === 'string') {
    const { categoryId } = raw;
    if (!categoryId || categoryId.length > MAX_CATEGORY_ID_LENGTH) return null;
    return { kind: 'setCategory', categoryId };
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

/** Reads a rule's actions as the API receives them, cleaned; null when malformed. */
export function parseActions(raw: unknown): RuleAction[] | null {
  return parseList(raw, parseAction);
}

/** Reads a rule as the API receives it, cleaned; null when malformed. */
export function parseRule(raw: unknown): RuleDefinition | null {
  if (!isRecord(raw)) return null;
  const conditions = parseConditions(raw.conditions);
  const actions = parseActions(raw.actions);
  return conditions && actions ? { conditions, actions } : null;
}

/** Whether a rule, read as these texts (its sentence, its tags), has every word of the search, without case or accents. */
export function ruleMatchesSearch(texts: readonly string[], search: string): boolean {
  const haystack = textKey(texts.join(' '));
  return textKey(search)
    .split(' ')
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
