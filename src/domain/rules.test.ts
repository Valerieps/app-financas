import { describe, expect, it } from 'vitest';
import { containsExpression, lancamentoType, parseConditions, parseRule, ruleMatches, tagsFromRules, textKey, withExistingTags, type RuleDefinition, type RuleSubject } from './rules';

const contains = (text: string) => ({ kind: 'descriptionContains', text }) as const;
const subject = (description: string | null, more: Partial<RuleSubject> = {}): RuleSubject => ({ description, direction: 'out', categoryId: null, cardPayment: false, ...more });
const rule = (text: string, tags: Record<string, string>): RuleDefinition => ({ conditions: [contains(text)], actions: [{ kind: 'addTags', tags }] });

describe('textKey', () => {
  it('ignores case, accents and repeated spaces', () => {
    expect(textKey('  Padaria   São JOÃO ')).toBe('padaria sao joao');
  });
});

describe('ruleMatches', () => {
  it('finds the text anywhere in the description, without case or accents', () => {
    expect(ruleMatches(rule('ifood', {}), subject('IFOOD *Restaurante'))).toBe(true);
    expect(ruleMatches(rule('padaria', {}), subject('Padaría do Zé'))).toBe(true);
    expect(ruleMatches(rule('uber', {}), subject('Mercado'))).toBe(false);
  });

  it('never matches a lançamento without description, nor a rule without conditions', () => {
    expect(ruleMatches(rule('x', {}), subject(null))).toBe(false);
    expect(ruleMatches({ conditions: [] }, subject('x'))).toBe(false);
  });

  it('needs every condition', () => {
    const both = { conditions: [contains('uber'), contains('trip')] };
    expect(ruleMatches(both, subject('Uber Trip'))).toBe(true);
    expect(ruleMatches(both, subject('Uber Eats'))).toBe(false);
  });
});

describe('"|" (ou) and "&" (e) in the description text', () => {
  it('matches any alternative of "|"', () => {
    expect(ruleMatches(rule('ifood | rappi', {}), subject('RAPPI*Pedido'))).toBe(true);
    expect(ruleMatches(rule('ifood|rappi', {}), subject('IFOOD'))).toBe(true);
    expect(ruleMatches(rule('ifood | rappi', {}), subject('Uber'))).toBe(false);
  });

  it('needs every term of "&", in any order', () => {
    expect(ruleMatches(rule('eats & uber', {}), subject('Uber Eats'))).toBe(true);
    expect(ruleMatches(rule('uber & eats', {}), subject('Uber Trip'))).toBe(false);
  });

  it('binds "&" tighter than "|"', () => {
    expect(containsExpression(' iFood | Uber & Eats ')).toEqual([['ifood'], ['uber', 'eats']]);
    expect(ruleMatches(rule('ifood | uber & eats', {}), subject('Uber Trip'))).toBe(false);
    expect(ruleMatches(rule('ifood | uber & eats', {}), subject('Uber Eats'))).toBe(true);
    expect(ruleMatches(rule('ifood | uber & eats', {}), subject('iFood'))).toBe(true);
  });

  it('refuses an operator without text on both sides', () => {
    expect(containsExpression('ifood |')).toBeNull();
    expect(containsExpression('& uber')).toBeNull();
    expect(containsExpression('a || b')).toBeNull();
    expect(parseConditions([contains('ifood | ')])).toBeNull();
    expect(parseConditions([contains('ifood | rappi')])).toEqual([contains('ifood | rappi')]);
  });
});

describe('lancamentoType', () => {
  it('is a transferência for transfer categories and card bill payments, else the direction', () => {
    expect(lancamentoType(subject('x', { direction: 'in' }))).toBe('in');
    expect(lancamentoType(subject('x', { categoryId: '11000000' }))).toBe('out');
    expect(lancamentoType(subject('x', { direction: 'in', categoryId: '05070000' }))).toBe('transfer');
    expect(lancamentoType(subject('x', { categoryId: '04000000' }))).toBe('transfer');
    expect(lancamentoType(subject('x', { cardPayment: true }))).toBe('transfer');
  });
});

describe('type condition', () => {
  it('matches the lançamento type, together with the text', () => {
    const outIfood = { conditions: [contains('ifood'), { kind: 'type', type: 'out' } as const] };
    expect(ruleMatches(outIfood, subject('iFood'))).toBe(true);
    expect(ruleMatches(outIfood, subject('iFood', { direction: 'in' }))).toBe(false);
    expect(ruleMatches({ conditions: [{ kind: 'type', type: 'transfer' }] }, subject(null, { categoryId: '05000000' }))).toBe(true);
  });

  it('parses only the known types', () => {
    expect(parseConditions([{ kind: 'type', type: 'in' }])).toEqual([{ kind: 'type', type: 'in' }]);
    expect(parseConditions([{ kind: 'type', type: 'both' }])).toBeNull();
  });
});

describe('tagsFromRules', () => {
  const rules = [rule('ifood', { tipo: 'restaurante' }), rule('food', { tipo: 'mercado', origem: 'impulso' })];

  it('fills only empty layers, and the first rule wins a layer', () => {
    expect(tagsFromRules(rules, subject('iFood'))).toEqual({ tipo: 'restaurante', origem: 'impulso' });
  });

  it('keeps the tags the lançamento already has', () => {
    expect(tagsFromRules(rules, subject('iFood'), { tipo: 'outra' })).toEqual({ origem: 'impulso' });
  });

  it('adds nothing when no rule matches', () => {
    expect(tagsFromRules(rules, subject('Uber'))).toEqual({});
  });
});

describe('withExistingTags', () => {
  it('drops the tags that were deleted', () => {
    const pruned = withExistingTags(rule('x', { tipo: 'a', origem: 'b' }), (layer) => layer === 'tipo');
    expect(pruned.actions).toEqual([{ kind: 'addTags', tags: { tipo: 'a' } }]);
  });
});

describe('parseRule', () => {
  it('cleans the text and keeps the tags', () => {
    expect(parseRule({ conditions: [contains('  ifood  ')], actions: [{ kind: 'addTags', tags: { l: 't' } }] })).toEqual(rule('ifood', { l: 't' }));
  });

  it('refuses empty, long or unknown parts', () => {
    const tags = [{ kind: 'addTags', tags: { l: 't' } }];
    expect(parseRule({ conditions: [contains(' ')], actions: tags })).toBeNull();
    expect(parseRule({ conditions: [contains('x'.repeat(101))], actions: tags })).toBeNull();
    expect(parseRule({ conditions: [{ kind: 'amountAbove', value: 1 }], actions: tags })).toBeNull();
    expect(parseRule({ conditions: [contains('x')], actions: [{ kind: 'addTags', tags: {} }] })).toBeNull();
    expect(parseRule({ conditions: [], actions: tags })).toBeNull();
    expect(parseRule(null)).toBeNull();
  });

  it('reads conditions alone for the test button', () => {
    expect(parseConditions([contains('Uber ')])).toEqual([contains('Uber')]);
    expect(parseConditions('uber')).toBeNull();
  });
});
