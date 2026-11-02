// WebAuthn checks for the passkey lock (ADR-007), with WebCrypto only: the browser hands over the
// public key as SPKI (`getPublicKey()`), so there is no CBOR to parse. Only ES256 (-7) is accepted.
import { fromBase64Url } from './crypto';

export const ES256 = -7;

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_ATTESTED_DATA = 0x40;

export interface ClientData {
  readonly type: string;
  readonly challenge: string;
  readonly origin: string;
  readonly crossOrigin?: boolean;
}

export interface AuthenticatorData {
  readonly rpIdHash: Uint8Array;
  readonly flags: number;
  readonly signCount: number;
  /** Present on registration (attested credential data). */
  readonly credentialId?: Uint8Array;
}

/** What the browser and the server must agree on: the site's origin and its host (the RP id). */
export interface Ceremony {
  readonly origin: string;
  readonly rpId: string;
}

export function parseClientData(clientDataJSON: Uint8Array): ClientData | null {
  try {
    const data = JSON.parse(new TextDecoder().decode(clientDataJSON)) as ClientData;
    return typeof data.type === 'string' && typeof data.challenge === 'string' && typeof data.origin === 'string' ? data : null;
  } catch {
    return null;
  }
}

export function parseAuthenticatorData(bytes: Uint8Array): AuthenticatorData | null {
  if (bytes.length < 37) return null;
  const flags = bytes[32];
  const signCount = new DataView(bytes.buffer, bytes.byteOffset + 33, 4).getUint32(0);
  let credentialId: Uint8Array | undefined;
  if (flags & FLAG_ATTESTED_DATA) {
    // rpIdHash(32) flags(1) signCount(4) aaguid(16) credentialIdLength(2) credentialId(n) ...
    if (bytes.length < 55) return null;
    const length = new DataView(bytes.buffer, bytes.byteOffset + 53, 2).getUint16(0);
    if (bytes.length < 55 + length) return null;
    credentialId = bytes.slice(55, 55 + length);
  }
  return { rpIdHash: bytes.slice(0, 32), flags, signCount, credentialId };
}

/**
 * The checks both ceremonies share: the right type and challenge, this site's origin, this RP id,
 * and a user who was present and verified (the fingerprint).
 */
export async function checkCeremony(
  clientData: ClientData,
  authData: AuthenticatorData,
  expected: Ceremony & { readonly type: 'webauthn.create' | 'webauthn.get'; readonly challenge: string },
): Promise<boolean> {
  if (clientData.type !== expected.type || clientData.challenge !== expected.challenge) return false;
  if (clientData.origin !== expected.origin || clientData.crossOrigin) return false;
  const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expected.rpId)));
  if (!equalBytes(rpIdHash, authData.rpIdHash)) return false;
  return Boolean(authData.flags & FLAG_USER_PRESENT) && Boolean(authData.flags & FLAG_USER_VERIFIED);
}

/** Verifies an assertion signature: ES256 over authenticatorData ‖ SHA-256(clientDataJSON). */
export async function verifyAssertionSignature(
  publicKeySpki: string,
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array<ArrayBuffer>,
  derSignature: Uint8Array,
): Promise<boolean> {
  const raw = derToRaw(derSignature);
  if (!raw) return false;
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey('spki', fromBase64Url(publicKeySpki), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  } catch {
    return false;
  }
  const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON));
  const signed = new Uint8Array(authenticatorData.length + clientDataHash.length);
  signed.set(authenticatorData);
  signed.set(clientDataHash, authenticatorData.length);
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, raw, signed);
}

/** Checks that an SPKI is a P-256 public key WebCrypto can use. */
export async function isP256Key(publicKeySpki: string): Promise<boolean> {
  try {
    await crypto.subtle.importKey('spki', fromBase64Url(publicKeySpki), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return true;
  } catch {
    return false;
  }
}

/** WebAuthn signs in ASN.1 DER (SEQUENCE of two INTEGERs); WebCrypto wants r ‖ s, 32 bytes each. */
export function derToRaw(der: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (der.length < 8 || der[0] !== 0x30 || der[1] !== der.length - 2) return null;
  const out = new Uint8Array(64);
  let offset = 2;
  for (const target of [0, 32]) {
    if (der[offset] !== 0x02) return null;
    const length = der[offset + 1];
    let value = der.slice(offset + 2, offset + 2 + length);
    if (value.length !== length) return null;
    while (value.length > 32 && value[0] === 0) value = value.slice(1);
    if (value.length > 32) return null;
    out.set(value, target + 32 - value.length);
    offset += 2 + length;
  }
  return offset === der.length ? out : null;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}
