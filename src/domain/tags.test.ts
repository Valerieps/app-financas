import { describe, expect, it } from 'vitest';
import { assignTag, canAddLayer, cleanName, clearLayer, commonTags, emptyTagKey, matchesTags, MAX_LAYERS, moveInOrder, moveToIndex, nameKey, nameProblem, tagChanges, toggleTag } from './tags';

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

describe('tagging many lançamentos', () => {
  const a = { id: 'a', layerId: 'tipo' };
  const b = { id: 'b', layerId: 'tipo' };

  it('starts the form with the tags all of them share', () => {
    expect(commonTags([])).toEqual({});
    expect(commonTags([{ tipo: 'a', origem: 'x' }])).toEqual({ tipo: 'a', origem: 'x' });
    expect(commonTags([{ tipo: 'a', origem: 'x' }, { tipo: 'a', origem: 'y' }, { tipo: 'a' }])).toEqual({ tipo: 'a' });
  });

  it('marks one tag per layer, and a second tap unmarks it', () => {
    expect(toggleTag({}, a)).toEqual({ tipo: 'a' });
    expect(toggleTag({ tipo: 'a' }, b)).toEqual({ tipo: 'b' });
    expect(toggleTag({ tipo: 'a', origem: 'x' }, a)).toEqual({ origem: 'x' });
  });

  it('saves only the layers I changed', () => {
    expect(tagChanges({ tipo: 'a' }, { tipo: 'a' })).toEqual([]);
    expect(tagChanges({ tipo: 'a' }, { tipo: 'b', origem: 'x' })).toEqual([
      { layerId: 'tipo', tagId: 'b' },
      { layerId: 'origem', tagId: 'x' },
    ]);
    expect(tagChanges({ tipo: 'a', origem: 'x' }, { origem: 'x' })).toEqual([{ layerId: 'tipo', tagId: null }]);
  });

  it('filters by any chosen tag within a layer and every chosen layer', () => {
    const layerOf = new Map([
      ['a', 'tipo'],
      ['b', 'tipo'],
      ['x', 'origem'],
    ]);
    expect(matchesTags([], layerOf, {})).toBe(true);
    expect(matchesTags(['a', 'b'], layerOf, { tipo: 'b' })).toBe(true);
    expect(matchesTags(['a'], layerOf, {})).toBe(false);
    expect(matchesTags(['a', 'x'], layerOf, { tipo: 'a' })).toBe(false);
    expect(matchesTags(['a', 'x'], layerOf, { tipo: 'a', origem: 'x' })).toBe(true);
    expect(matchesTags(['sumiu'], layerOf, {})).toBe(true);
  });

  it('filters by "Vazio": no tag in that layer, alone or with tags of the same layer', () => {
    const layerOf = new Map([
      ['a', 'tipo'],
      ['x', 'origem'],
    ]);
    const vazio = emptyTagKey('tipo');
    expect(matchesTags([vazio], layerOf, {})).toBe(true);
    expect(matchesTags([vazio], layerOf, { origem: 'x' })).toBe(true);
    expect(matchesTags([vazio], layerOf, { tipo: 'a' })).toBe(false);
    expect(matchesTags([vazio, 'a'], layerOf, { tipo: 'a' })).toBe(true);
    expect(matchesTags([vazio, 'x'], layerOf, { origem: 'x' })).toBe(true);
    expect(matchesTags([vazio, 'x'], layerOf, {})).toBe(false);
  });
});

describe('moveToIndex', () => {
  it('puts the id at the new position, shifting the others', () => {
    expect(moveToIndex(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveToIndex(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('keeps the order for an unknown id or a position out of range', () => {
    expect(moveToIndex(['a', 'b'], 'x', 0)).toEqual(['a', 'b']);
    expect(moveToIndex(['a', 'b'], 'a', 2)).toEqual(['a', 'b']);
    expect(moveToIndex(['a', 'b'], 'a', 0.5)).toEqual(['a', 'b']);
  });
});
