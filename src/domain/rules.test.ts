import { describe, expect, it } from 'vitest';
import { applyReplacements, categoryFromRules, categoryWithin, containsExpression, describeWithRules, lancamentoType, operationLabel, parseConditions, parseMatch, parseRule, replaceText, ruleMatches, ruleMatchesSearch, tagsFromRules, textKey, withExistingTags, type RuleDefinition, type RuleSubject } from './rules';

const contains = (text: string) => ({ kind: 'descriptionContains', text }) as const;
const subject = (description: string | null, more: Partial<RuleSubject> = {}): RuleSubject => ({ description, direction: 'out', categoryId: null, cardPayment: false, payer: null, operation: null, ...more });
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
    expect(ruleMatches({ match: 'all', ...both }, subject('Uber Eats'))).toBe(false);
  });

  it('with "qualquer condição" (any), needs just one', () => {
    const either = { match: 'any', conditions: [contains('ifood'), { kind: 'category', categoryId: '05000000' }] } as const;
    expect(ruleMatches(either, subject('iFood'))).toBe(true);
    expect(ruleMatches(either, subject('Mercado', { categoryId: '05070000' }))).toBe(true);
    expect(ruleMatches(either, subject('iFood', { categoryId: '05070000' }))).toBe(true);
    expect(ruleMatches(either, subject('Mercado'))).toBe(false);
  });

  it('with a single condition, "all" and "any" agree', () => {
    for (const match of ['all', 'any'] as const) {
      expect(ruleMatches({ match, conditions: [contains('ifood')] }, subject('iFood'))).toBe(true);
      expect(ruleMatches({ match, conditions: [contains('ifood')] }, subject('Uber'))).toBe(false);
    }
  });

  it('never matches a rule without conditions, even with "any"', () => {
    expect(ruleMatches({ match: 'any', conditions: [] }, subject('x'))).toBe(false);
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
    expect(parseRule({ conditions: [contains('  ifood  ')], actions: [{ kind: 'addTags', tags: { l: 't' } }] })).toEqual({ match: 'all', ...rule('ifood', { l: 't' }) });
  });

  it('reads how the conditions join: "all" when absent, as rules saved before "ou"', () => {
    const tags = [{ kind: 'addTags', tags: { l: 't' } }];
    expect(parseRule({ match: 'any', conditions: [contains('x')], actions: tags })?.match).toBe('any');
    expect(parseRule({ match: 'all', conditions: [contains('x')], actions: tags })?.match).toBe('all');
    expect(parseRule({ conditions: [contains('x')], actions: tags })?.match).toBe('all');
    expect(parseRule({ match: 'some', conditions: [contains('x')], actions: tags })).toBeNull();
    expect(parseMatch(null)).toBe('all');
    expect(parseMatch(1)).toBeNull();
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

describe('replacing text in the description', () => {
  const replace = (find: string, by: string) => ({ kind: 'replaceInDescription', find, replace: by }) as const;

  it('replaces only the piece, every time, without case, accents or repeated spaces', () => {
    expect(replaceText('IFOOD *Restaurante', 'ifood', 'iFood')).toBe('iFood *Restaurante');
    expect(replaceText('Padaría do Zé, padaria', 'padaria', 'Padaria')).toBe('Padaria do Zé, Padaria');
    expect(replaceText('PIX  ENVIADO Ana', 'pix enviado', 'Pix para')).toBe('Pix para Ana');
    expect(replaceText('Uber Trip', 'ifood', 'x')).toBe('Uber Trip');
  });

  it('tidies the spaces left and gives null when nothing is left', () => {
    expect(replaceText('PIX * Ana', '*', '')).toBe('PIX Ana');
    expect(replaceText('IFOOD', 'ifood', '')).toBeNull();
  });

  it("applies a rule's replacements in order", () => {
    expect(applyReplacements([replace('ifood', 'iFood'), { kind: 'addTags', tags: {} }, replace('*', '·')], 'IFOOD *Loja')).toBe('iFood ·Loja');
    expect(applyReplacements([replace('x', 'y')], null)).toBeNull();
  });

  it("chains the matching rules in order, their conditions looking at the bank's description", () => {
    const rules: RuleDefinition[] = [
      { conditions: [contains('ifood')], actions: [replace('ifood', 'iFood')] },
      { conditions: [contains('ifood')], actions: [replace('*', '-')] },
      { conditions: [contains('rappi')], actions: [replace('loja', 'X')] },
    ];
    expect(describeWithRules(rules, subject('IFOOD *Loja'))).toBe('iFood -Loja');
    expect(describeWithRules(rules, subject('Uber'))).toBe('Uber');
    expect(describeWithRules(rules, subject(null))).toBeNull();
  });

  it('is read and cleaned like the other actions', () => {
    expect(parseRule({ conditions: [contains('ifood')], actions: [replace(' IFOOD ', '  iFood ')] })).toEqual({ match: 'all', conditions: [contains('ifood')], actions: [replace('IFOOD', '  iFood ')] });
    expect(parseRule({ conditions: [contains('ifood')], actions: [replace('ifood', '')] })?.actions).toEqual([replace('ifood', '')]);
    expect(parseRule({ conditions: [contains('x')], actions: [replace(' ', 'y')] })).toBeNull();
    expect(parseRule({ conditions: [contains('x')], actions: [replace('x', 'y'.repeat(101))] })).toBeNull();
  });
});

describe('"operação" condition', () => {
  const operation = (text: string) => ({ kind: 'operationContains', text }) as const;

  it('joins the operation type and the payment method as the detail shows them', () => {
    expect(operationLabel('PIX', 'PIX')).toBe('PIX · PIX');
    expect(operationLabel(null, 'TED')).toBe('TED');
    expect(operationLabel(undefined, null)).toBeNull();
  });

  it('matches the operação of any lançamento, like the description text', () => {
    expect(ruleMatches({ conditions: [operation('pix | ted')] }, subject('x', { operation: 'PIX · PIX' }))).toBe(true);
    expect(ruleMatches({ conditions: [operation('pix')] }, subject('x', { direction: 'in', operation: 'TRANSFERENCIA_MESMA_INSTITUICAO · PIX' }))).toBe(true);
    expect(ruleMatches({ conditions: [operation('boleto')] }, subject('x', { operation: 'PIX' }))).toBe(false);
    expect(ruleMatches({ conditions: [operation('pix')] }, subject('x'))).toBe(false);
  });

  it('is read and cleaned like the description text', () => {
    expect(parseConditions([{ kind: 'operationContains', text: '  PIX  ' }])).toEqual([operation('PIX')]);
    expect(parseConditions([{ kind: 'operationContains', text: '& pix' }])).toBeNull();
  });
});

describe('"quem pagou" condition', () => {
  const payer = (text: string) => ({ kind: 'payerContains', text }) as const;
  const entrada = (name: string | null) => subject('PIX RECEBIDO', { direction: 'in', payer: name });

  it('matches who paid an entrada, like the description text', () => {
    expect(ruleMatches({ conditions: [payer('acme | globex')] }, entrada('ACME Ltda'))).toBe(true);
    expect(ruleMatches({ conditions: [payer('joão & silva')] }, entrada('Joao da Silva'))).toBe(true);
    expect(ruleMatches({ conditions: [payer('acme')] }, entrada('Globex'))).toBe(false);
  });

  it('matches a transferência recebida, whose category is Transfers', () => {
    expect(ruleMatches({ conditions: [payer('acme')] }, subject('x', { direction: 'in', payer: 'ACME', categoryId: '04000000' }))).toBe(true);
  });

  it('never matches a saída or an entrada without payer', () => {
    expect(ruleMatches({ conditions: [payer('acme')] }, subject('x', { direction: 'out', payer: 'ACME' }))).toBe(false);
    expect(ruleMatches({ conditions: [payer('acme')] }, subject('x', { direction: 'out', payer: 'ACME', categoryId: '04000000' }))).toBe(false);
    expect(ruleMatches({ conditions: [payer('acme')] }, entrada(null))).toBe(false);
  });

  it('is read and cleaned like the description text', () => {
    expect(parseConditions([{ kind: 'payerContains', text: '  ACME  ' }])).toEqual([payer('ACME')]);
    expect(parseConditions([{ kind: 'payerContains', text: 'a |' }])).toBeNull();
  });
});

describe('categoryFromRules', () => {
  const setCategory = (text: string, categoryId: string): RuleDefinition => ({ conditions: [contains(text)], actions: [{ kind: 'setCategory', categoryId }] });
  const rules = [rule('ifood', { a: 't' }), setCategory('ifood', '01000000'), setCategory('ifood', '02000000')];

  it('gives the category of the first matching rule that sets one', () => {
    expect(categoryFromRules(rules, subject('IFOOD'), false)).toBe('01000000');
    expect(categoryFromRules(rules, subject('Uber'), false)).toBeNull();
  });

  it('leaves the category I chose', () => {
    expect(categoryFromRules(rules, subject('IFOOD'), true)).toBeNull();
  });

  it('is read like the other actions', () => {
    expect(parseRule({ conditions: [contains('x')], actions: [{ kind: 'setCategory', categoryId: '01000000' }] })?.actions).toEqual([{ kind: 'setCategory', categoryId: '01000000' }]);
    expect(parseRule({ conditions: [contains('x')], actions: [{ kind: 'setCategory', categoryId: '' }] })).toBeNull();
  });
});

describe('ruleMatchesSearch', () => {
  const texts = ['Sempre que a descrição contiver "ifood"', 'Tipo de Gasto: Restaurante'];

  it('finds every word anywhere in the rule, without case or accents', () => {
    expect(ruleMatchesSearch(texts, 'RESTAURANTE ifood')).toBe(true);
    expect(ruleMatchesSearch(texts, 'descricao')).toBe(true);
  });

  it('misses when one word is absent', () => {
    expect(ruleMatchesSearch(texts, 'ifood farmácia')).toBe(false);
  });

  it('keeps every rule for an empty search', () => {
    expect(ruleMatchesSearch(texts, '   ')).toBe(true);
  });
});

describe('"categoria" condition', () => {
  const byCategory = (categoryId: string): RuleDefinition => ({ conditions: [{ kind: 'category', categoryId }], actions: [{ kind: 'addTags', tags: { a: 't' } }] });

  it('matches the category or any category under it in the tree', () => {
    expect(categoryWithin('05070000', '05070000')).toBe(true);
    expect(categoryWithin('05070000', '05000000')).toBe(true);
    expect(categoryWithin('05070100', '05000000')).toBe(true);
    expect(categoryWithin('05070100', '05070000')).toBe(true);
    expect(categoryWithin('05000000', '05070000')).toBe(false);
    expect(categoryWithin('06000000', '05000000')).toBe(false);
    expect(categoryWithin('050700', '05000000')).toBe(false);
    expect(categoryWithin(null, '05000000')).toBe(false);
  });

  it('looks at the category that counts, and never at a lançamento without one', () => {
    expect(ruleMatches(byCategory('05000000'), subject('x', { categoryId: '05070000' }))).toBe(true);
    expect(ruleMatches(byCategory('05000000'), subject('x', { categoryId: '06000000' }))).toBe(false);
    expect(ruleMatches(byCategory('05000000'), subject('x'))).toBe(false);
  });

  it('is read from the API only with a category id', () => {
    expect(parseConditions([{ kind: 'category', categoryId: '05000000' }])).toEqual([{ kind: 'category', categoryId: '05000000' }]);
    expect(parseConditions([{ kind: 'category', categoryId: '' }])).toBeNull();
    expect(parseConditions([{ kind: 'category' }])).toBeNull();
  });
});
