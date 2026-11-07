import { describe, expect, it } from 'vitest';
import { strings } from './strings';

describe('cofre.add messages', () => {
  // The Cofre form shows strings.cofre.add[error]; a missing key falls back to the generic error.
  it('has a message for every error connection.add can return', () => {
    const add: Record<string, string> = strings.cofre.add;
    for (const code of ['invalid', 'not_found', 'conflict', 'unavailable']) {
      expect(add[code], code).toBeTypeOf('string');
    }
  });
});

describe('graficos sentences', () => {
  const t = strings.graficos.categoria;
  it('says what the month is compared with', () => {
    expect(t.period(7, [8, 9, 10], 'average')).toBe('Até o dia 7, comparado com a média de agosto a outubro até o mesmo dia.');
    expect(t.period(7, [10], 'previous')).toBe('Até o dia 7, comparado com outubro até o mesmo dia.');
    expect(t.period(null, [10], 'average')).toBe('No mês inteiro, comparado com outubro.');
  });

  it('lists the categorias below', () => {
    expect(t.below([])).toBe('');
    expect(t.below(['Transporte'])).toBe('Transporte está abaixo.');
    expect(t.below(['Transporte', 'Lazer', 'Outros'])).toBe('Transporte, Lazer e Outros estão abaixo.');
  });

  it('names the categoria furthest above', () => {
    expect(t.above('Restaurante', 'R$ 62', 'average')).toBe('Restaurante está R$ 62 acima da sua média.');
  });
});
