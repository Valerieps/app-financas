import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every color, size and weight of the UI lives in tokens.css (docs/rascunhos/desktop-visual.md).
 * A literal anywhere else is how screens drift apart, so the build refuses it.
 */

const UI_ROOT = join(__dirname, '..');

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, pattern);
    return pattern.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The lines that break a rule, as "file:line: text". Media queries may hold the breakpoints. */
function offending(paths: string[], rule: RegExp, prepare: (text: string) => string = (t) => t): string[] {
  return paths.flatMap((path) =>
    prepare(readFileSync(path, 'utf8'))
      .split('\n')
      .flatMap((line, index) =>
        rule.test(line) && !line.trimStart().startsWith('@media') ? [`${relative(UI_ROOT, path)}:${index + 1}: ${line.trim()}`] : [],
      ),
  );
}

const stylesheets = files(join(UI_ROOT, 'theme'), /\.css$/).filter((path) => !path.endsWith('tokens.css'));
const components = files(UI_ROOT, /\.tsx$/);

describe('design tokens', () => {
  it('keeps colors out of the stylesheets and components', () => {
    const color = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/;
    expect(offending(stylesheets, color, withoutComments)).toEqual([]);
    expect(offending(components, color)).toEqual([]);
  });

  it('keeps lengths out of the stylesheets', () => {
    expect(offending(stylesheets, /\b\d*\.?\d+(px|rem|em)\b/, withoutComments)).toEqual([]);
  });

  it('keeps font weights on the scale', () => {
    expect(offending(stylesheets, /font-weight:\s*\d/, withoutComments)).toEqual([]);
  });
});
