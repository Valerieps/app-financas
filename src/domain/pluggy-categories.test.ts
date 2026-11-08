import { describe, expect, it } from 'vitest';
import { categoryOptions } from './pluggy-categories';

describe('categoryOptions', () => {
  it('lists each category after its parent, siblings by id', () => {
    expect(
      categoryOptions([
        { id: '10000000', name: 'Mercado', parentId: null },
        { id: '01000000', name: 'Renda', parentId: null },
        { id: '10010000', name: 'Supermercado', parentId: '10000000' },
        { id: '01020000', name: 'Aposentadoria', parentId: '01000000' },
        { id: '01010000', name: 'Salário', parentId: '01000000' },
      ]),
    ).toEqual([
      { id: '01000000', name: 'Renda', depth: 0 },
      { id: '01010000', name: 'Salário', depth: 1 },
      { id: '01020000', name: 'Aposentadoria', depth: 1 },
      { id: '10000000', name: 'Mercado', depth: 0 },
      { id: '10010000', name: 'Supermercado', depth: 1 },
    ]);
  });

  it('puts a category with an unknown parent at the top, and survives a cycle', () => {
    expect(
      categoryOptions([
        { id: 'b', name: 'B', parentId: 'nada' },
        { id: 'x', name: 'X', parentId: 'y' },
        { id: 'y', name: 'Y', parentId: 'x' },
        { id: 'z', name: 'Z', parentId: 'z' },
      ]),
    ).toEqual([
      { id: 'b', name: 'B', depth: 0 },
      { id: 'z', name: 'Z', depth: 0 },
    ]);
  });
});
