import { describe, expect, it } from 'vitest';
import { clearCookie, readCookie, setCookie } from './cookies';
import { base64Url, constantTimeEqual, fromBase64Url, randomToken, sha256 } from './crypto';

describe('cookies', () => {
  it('reads one cookie among many', () => {
    expect(readCookie('a=1; __Host-sessao=abc; b=2', '__Host-sessao')).toBe('abc');
    expect(readCookie('a=1', '__Host-sessao')).toBeNull();
  });

  it('sets HttpOnly, Secure and Lax cookies', () => {
    expect(setCookie('__Host-sessao', 'x', 10)).toBe(
      '__Host-sessao=x; Path=/; Max-Age=10; HttpOnly; Secure; SameSite=Lax',
    );
    expect(clearCookie('__Host-sessao')).toContain('Max-Age=0');
  });
});

describe('crypto', () => {
  it('compares strings in constant time', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('generates random tokens', () => {
    const t1 = randomToken();
    const t2 = randomToken();
    expect(t1).toBeTruthy();
    expect(t1).not.toBe(t2);
  });

  it('computes sha256 digest', async () => {
    const hash = await sha256('1234');
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  it('round-trips base64Url', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 255]);
    const encoded = base64Url(bytes);
    const decoded = fromBase64Url(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
});
