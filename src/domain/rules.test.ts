import { describe, expect, it } from 'vitest';
import { parseConditions, parseRule, ruleMatches, tagsFromRules, textKey, withExistingTags, type RuleDefinition } from './rules';

const contains = (text: string) => ({ kind: 'descriptionContains', text }) as const;
const rule = (text: string, tags: Record<string, string>): RuleDefinition => ({ conditions: [contains(text)], actions: [{ kind: 'addTags', tags }] });

describe('textKey', () => {
  it('ignores case, accents and repeated spaces', () => {
    expect(textKey('  Padaria   São JOÃO ')).toBe('padaria sao joao');
  });
});

describe('ruleMatches', () => {
  it('finds the text anywhere in the description, without case or accents', () => {
    expect(ruleMatches(rule('ifood', {}), { description: 'IFOOD *Restaurante' })).toBe(true);
    expect(ruleMatches(rule('padaria', {}), { description: 'Padaría do Zé' })).toBe(true);
    expect(ruleMatches(rule('uber', {}), { description: 'Mercado' })).toBe(false);
  });

  it('never matches a lançamento without description, nor a rule without conditions', () => {
    expect(ruleMatches(rule('x', {}), { description: null })).toBe(false);
    expect(ruleMatches({ conditions: [] }, { description: 'x' })).toBe(false);
  });

  it('needs every condition', () => {
    const both = { conditions: [contains('uber'), contains('trip')] };
    expect(ruleMatches(both, { description: 'Uber Trip' })).toBe(true);
    expect(ruleMatches(both, { description: 'Uber Eats' })).toBe(false);
  });
});

describe('tagsFromRules', () => {
  const rules = [rule('ifood', { tipo: 'restaurante' }), rule('food', { tipo: 'mercado', origem: 'impulso' })];

  it('fills only empty layers, and the first rule wins a layer', () => {
    expect(tagsFromRules(rules, { description: 'iFood' })).toEqual({ tipo: 'restaurante', origem: 'impulso' });
  });

  it('keeps the tags the lançamento already has', () => {
    expect(tagsFromRules(rules, { description: 'iFood' }, { tipo: 'outra' })).toEqual({ origem: 'impulso' });
  });

  it('adds nothing when no rule matches', () => {
    expect(tagsFromRules(rules, { description: 'Uber' })).toEqual({});
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
