import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// desktop.css takes every color and size from tokens.css; only the two breakpoints are literal,
// because CSS cannot read a variable inside a media query.
const css = readFileSync(new URL('./desktop.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('desktop.css', () => {
  it('writes no color of its own', () => {
    expect(css.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi) ?? []).toEqual([]);
  });

  it('writes no size of its own outside the breakpoints', () => {
    const outsideMedia = css.replace(/@media \((?:min|max)-width: \d+px\)/g, '');
    expect(outsideMedia.match(/\b\d+(\.\d+)?(px|rem|em)\b/g) ?? []).toEqual([]);
  });
});
