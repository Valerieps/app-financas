// Who is calling (ADR-007): Cloudflare Access signs every request that passed its Google sign-in
// with a JWT in `Cf-Access-Jwt-Assertion`. The Worker checks it too, so a request that reaches the
// Worker some other way is refused.
import { ACCESS_TEAM_ORIGIN } from '../../network-policy';
import { fromBase64Url } from './crypto';

export interface AccessEnv {
  /** The Access application's audience tag. */
  readonly ACCESS_AUD?: string;
  /** The only e-mail allowed in (a secret, so the address stays out of the repository). */
  readonly OWNER_EMAIL?: string;
  /** Local development only: stands in for Access. */
  readonly DEV_ACCESS_EMAIL?: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const CERTS_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_S = 60;

export type KeySource = (kid: string) => Promise<CryptoKey | null>;

/** The signed-in e-mail, or null when the request must be refused. */
export async function accessEmail(request: Request, env: AccessEnv, keys: KeySource = teamKeys): Promise<string | null> {
  // Locally there is no Access: DEV_ACCESS_EMAIL stands in, and only on a local host, so a value
  // set by mistake in production is never read.
  const { hostname } = new URL(request.url);
  if (LOCAL_HOSTS.has(hostname)) return env.DEV_ACCESS_EMAIL || null;

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_AUD || !env.OWNER_EMAIL) return null;
  const email = await verifyAccessJwt(token, { audience: env.ACCESS_AUD, now: new Date(), keys });
  return email && email.toLowerCase() === env.OWNER_EMAIL.toLowerCase() ? email : null;
}

/** Checks the signature (RS256), issuer, audience and validity window; returns the e-mail claim. */
export async function verifyAccessJwt(
  token: string,
  options: { audience: string; now: Date; keys: KeySource },
): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  let header: { alg?: string; kid?: string };
  let payload: { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(fromBase64Url(headerPart)));
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart)));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;

  const key = await options.keys(header.kid);
  if (!key) return null;
  const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64Url(signaturePart), signed);
  if (!valid) return null;

  const now = options.now.getTime() / 1000;
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== ACCESS_TEAM_ORIGIN) return null;
  if (!audiences.includes(options.audience)) return null;
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_S < now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_S > now) return null;
  return typeof payload.email === 'string' ? payload.email : null;
}

let cachedKeys: { readonly at: number; readonly keys: Map<string, CryptoKey> } | null = null;

/**
 * The team's public keys, cached for an hour. An unknown key id (Access rotates keys) refetches
 * them, at most once a minute, so forged tokens cannot make the Worker fetch on every request.
 */
async function teamKeys(kid: string): Promise<CryptoKey | null> {
  const age = cachedKeys ? Date.now() - cachedKeys.at : Infinity;
  if (age >= CERTS_TTL_MS || (!cachedKeys!.keys.has(kid) && age >= 60_000)) {
    const response = await fetch(`${ACCESS_TEAM_ORIGIN}/cdn-cgi/access/certs`);
    if (!response.ok) return cachedKeys?.keys.get(kid) ?? null;
    const { keys } = (await response.json()) as { keys: (JsonWebKey & { kid: string })[] };
    const imported = new Map<string, CryptoKey>();
    for (const jwk of keys) {
      imported.set(jwk.kid, await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
    }
    cachedKeys = { at: Date.now(), keys: imported };
  }
  return cachedKeys!.keys.get(kid) ?? null;
}
