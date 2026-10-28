import { describe, expect, it } from 'vitest';
import { isValidPin, normalizePin } from './pin';

describe('isValidPin', () => {
  it('accepts 4 to 8 digits', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12345678')).toBe(true);
  });

  it('rejects too short or too long pins', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('123456789')).toBe(false);
  });

  it('rejects non-numeric characters', () => {
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('abcd')).toBe(false);
    expect(isValidPin('12 4')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });

  it('trims whitespace', () => {
    expect(normalizePin('  1234  ')).toBe('1234');
    expect(isValidPin('  1234  ')).toBe(true);
  });
});
