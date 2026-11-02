import { describe, expect, it } from 'vitest';
import { ACCESS_TEAM_ORIGIN } from '../../network-policy';
import { accessEmail, verifyAccessJwt, type KeySource } from './access';
import { base64Url } from './crypto';

const AUD = 'aud-tag';
const NOW = new Date('2026-11-02T12:00:00Z');
const nowS = NOW.getTime() / 1000;

const pair = (await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
)) as CryptoKeyPair;
const keys: KeySource = async (kid) => (kid === 'k1' ? pair.publicKey : null);

const encode = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

async function jwt(payload: Record<string, unknown>, header: Record<string, unknown> = { alg: 'RS256', kid: 'k1' }): Promise<string> {
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

const valid = { aud: [AUD], iss: ACCESS_TEAM_ORIGIN, exp: nowS + 600, nbf: nowS - 10, email: 'owner@example.com' };
const verify = (token: string) => verifyAccessJwt(token, { audience: AUD, now: NOW, keys });

describe('verifyAccessJwt', () => {
  it('accepts a token signed by the team for this application', async () => {
    expect(await verify(await jwt(valid))).toBe('owner@example.com');
  });

  it('refuses another audience, issuer, an expired token or an unknown key', async () => {
    expect(await verify(await jwt({ ...valid, aud: ['other'] }))).toBeNull();
    expect(await verify(await jwt({ ...valid, iss: 'https://other.cloudflareaccess.com' }))).toBeNull();
    expect(await verify(await jwt({ ...valid, exp: nowS - 120 }))).toBeNull();
    expect(await verify(await jwt(valid, { alg: 'RS256', kid: 'k2' }))).toBeNull();
  });

  it('refuses a tampered payload and other algorithms', async () => {
    const [header, , signature] = (await jwt(valid)).split('.');
    expect(await verify(`${header}.${encode({ ...valid, email: 'intruder@example.com' })}.${signature}`)).toBeNull();
    expect(await verify(await jwt(valid, { alg: 'none', kid: 'k1' }))).toBeNull();
    expect(await verify('not-a-jwt')).toBeNull();
  });
});

describe('accessEmail', () => {
  const env = { ACCESS_AUD: AUD, OWNER_EMAIL: 'Owner@example.com', DEV_ACCESS_EMAIL: 'dev@example.com' };
  const request = (url: string, token?: string) =>
    new Request(url, { method: 'POST', headers: token ? { 'Cf-Access-Jwt-Assertion': token } : {} });
  const PUBLIC = 'https://sinal-verde.souza-pereira-valeria.workers.dev/api/query/vault';

  it('uses DEV_ACCESS_EMAIL on a local host only', async () => {
    expect(await accessEmail(request('http://localhost:8787/api/query/vault'), env, keys)).toBe('dev@example.com');
    expect(await accessEmail(request('http://localhost:8787/api/query/vault'), {}, keys)).toBeNull();
    expect(await accessEmail(request(PUBLIC), env, keys)).toBeNull();
  });

  it('lets in only the owner, whatever the case of the address', async () => {
    const token = await jwt({ ...valid, exp: Date.now() / 1000 + 600, nbf: undefined });
    expect(await accessEmail(request(PUBLIC, token), env, keys)).toBe('owner@example.com');
    expect(await accessEmail(request(PUBLIC, token), { ...env, OWNER_EMAIL: 'someone@example.com' }, keys)).toBeNull();
    expect(await accessEmail(request(PUBLIC, token), { ...env, ACCESS_AUD: undefined }, keys)).toBeNull();
  });
});
