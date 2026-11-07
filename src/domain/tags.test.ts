import { describe, expect, it } from 'vitest';
import { assignTag, canAddLayer, cleanName, clearLayer, MAX_LAYERS, moveInOrder, nameKey, nameProblem } from './tags';

describe('names', () => {
  it('trims and collapses spaces', () => {
    expect(cleanName('  Impulso   ou  planejado ')).toBe('Impulso ou planejado');
  });

  it('compare without case or accents', () => {
    expect(nameKey('Farmácia')).toBe(nameKey(' farmacia '));
  });

  it('must be filled, short and unique among siblings', () => {
    expect(nameProblem('   ', [])).toBe('empty');
    expect(nameProblem('x'.repeat(41), [])).toBe('too_long');
    expect(nameProblem('x'.repeat(40), [])).toBeNull();
    expect(nameProblem('MERCADO', ['Mercado', 'Transporte'])).toBe('duplicate');
    expect(nameProblem('Restaurante', ['Mercado', 'Transporte'])).toBeNull();
  });
});

describe('layers', () => {
  it('are at most five', () => {
    expect(MAX_LAYERS).toBe(5);
    expect(canAddLayer(4)).toBe(true);
    expect(canAddLayer(5)).toBe(false);
  });

  it('move one place at a time and stop at the ends', () => {
    expect(moveInOrder(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c']);
    expect(moveInOrder(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b']);
    expect(moveInOrder(['a', 'b', 'c'], 'a', 'up')).toEqual(['a', 'b', 'c']);
    expect(moveInOrder(['a', 'b', 'c'], 'c', 'down')).toEqual(['a', 'b', 'c']);
    expect(moveInOrder(['a', 'b'], 'x', 'up')).toEqual(['a', 'b']);
  });
});

describe('a lançamento’s tags', () => {
  it('hold at most one tag per layer, and may leave layers empty', () => {
    let tags = assignTag({}, { id: 'impulso', layerId: 'origem' });
    tags = assignTag(tags, { id: 'mercado', layerId: 'tipo' });
    tags = assignTag(tags, { id: 'planejado', layerId: 'origem' });
    expect(tags).toEqual({ origem: 'planejado', tipo: 'mercado' });
    expect(clearLayer(tags, 'tipo')).toEqual({ origem: 'planejado' });
    expect(clearLayer(tags, 'nada')).toEqual(tags);
  });
});
