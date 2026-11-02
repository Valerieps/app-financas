// The passkey lock (docs/spec/acesso.md, ADR-007). A device that registered a passkey carries a
// device cookie; while it does, the API needs an unlocked session, which lasts an hour after the
// last use. A device without one (the computer) gets in with the Access sign-in alone.
import type {
  LockStatusView,
  RegistrationInput,
  RegistrationOptions,
  UnlockInput,
  UnlockOptions,
} from '../../src/application/api-contract';
import { base64Url, fromBase64Url, randomToken, sha256 } from '../infrastructure/crypto';
import {
  checkCeremony,
  ES256,
  isP256Key,
  parseAuthenticatorData,
  parseClientData,
  verifyAssertionSignature,
  type Ceremony,
} from '../infrastructure/webauthn';
import { failure, nowIso, type CommandResult, type Context } from './context';
import { statement } from './ports';

export const UNLOCK_MINUTES = 60;
const CHALLENGE_MINUTES = 5;

/** The hashes of the caller's device and session cookies (the database keeps only hashes). */
export interface Caller {
  readonly deviceTokenHash: string | null;
  readonly sessionTokenHash: string | null;
}

export const NO_CALLER: Caller = { deviceTokenHash: null, sessionTokenHash: null };

const minutesFrom = (ctx: Context, minutes: number) => new Date(ctx.clock.now().getTime() + minutes * 60_000).toISOString();

async function devicePasskey(ctx: Context, caller: Caller): Promise<{ id: string; public_key: string; sign_count: number } | undefined> {
  if (!caller.deviceTokenHash) return undefined;
  const [row] = await ctx.sql.all<{ id: string; public_key: string; sign_count: number }>(
    'SELECT id, public_key, sign_count FROM passkeys WHERE device_token_hash = ?',
    caller.deviceTokenHash,
  );
  return row;
}

async function hasSession(ctx: Context, caller: Caller, passkeyId: string): Promise<boolean> {
  if (!caller.sessionTokenHash) return false;
  const rows = await ctx.sql.all(
    'SELECT 1 FROM sessions WHERE token_hash = ? AND passkey_id = ? AND expires_at > ?',
    caller.sessionTokenHash,
    passkeyId,
    nowIso(ctx),
  );
  return rows.length > 0;
}

export async function lockStatus(ctx: Context, caller: Caller): Promise<LockStatusView> {
  const passkey = await devicePasskey(ctx, caller);
  if (!passkey) return { deviceHasPasskey: false, locked: false };
  return { deviceHasPasskey: true, locked: !(await hasSession(ctx, caller, passkey.id)) };
}

/** Whether the caller may use the API now; each allowed use renews the unlocked hour. */
export async function gate(ctx: Context, caller: Caller): Promise<boolean> {
  const passkey = await devicePasskey(ctx, caller);
  if (!passkey) return true;
  if (!(await hasSession(ctx, caller, passkey.id))) return false;
  await ctx.sql.run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', minutesFrom(ctx, UNLOCK_MINUTES), caller.sessionTokenHash);
  return true;
}

async function newChallenge(ctx: Context, purpose: 'register' | 'unlock'): Promise<string> {
  const challenge = randomToken();
  await ctx.sql.run(
    'INSERT INTO webauthn_challenges (challenge, purpose, expires_at) VALUES (?, ?, ?)',
    challenge,
    purpose,
    minutesFrom(ctx, CHALLENGE_MINUTES),
  );
  return challenge;
}

/** A challenge works once, for its purpose, within five minutes. */
async function consumeChallenge(ctx: Context, challenge: string, purpose: 'register' | 'unlock'): Promise<boolean> {
  const rows = await ctx.sql.all(
    'SELECT 1 FROM webauthn_challenges WHERE challenge = ? AND purpose = ? AND expires_at > ?',
    challenge,
    purpose,
    nowIso(ctx),
  );
  await ctx.sql.run('DELETE FROM webauthn_challenges WHERE challenge = ?', challenge);
  return rows.length > 0;
}

export async function registrationOptions(ctx: Context): Promise<RegistrationOptions> {
  return { challenge: await newChallenge(ctx, 'register'), userId: 'dona' };
}

/** Stores the passkey and unlocks this device. Returns the raw cookie values to set. */
export async function register(
  ctx: Context,
  input: Partial<RegistrationInput>,
  ceremony: Ceremony,
): Promise<CommandResult<{ deviceToken: string; sessionToken: string }>> {
  const decoded = decode(input.clientDataJSON, input.authenticatorData);
  if (!decoded || typeof input.id !== 'string' || typeof input.publicKey !== 'string') return failure('invalid');
  const { clientDataJSON, authenticatorData } = decoded;
  const clientData = parseClientData(clientDataJSON);
  const authData = parseAuthenticatorData(authenticatorData);
  if (!clientData || !authData) return failure('invalid');
  if (!(await consumeChallenge(ctx, clientData.challenge, 'register'))) return failure('unauthenticated');
  if (!(await checkCeremony(clientData, authData, { ...ceremony, type: 'webauthn.create', challenge: clientData.challenge }))) {
    return failure('unauthenticated');
  }
  if (input.publicKeyAlgorithm !== ES256 || !(await isP256Key(input.publicKey))) return failure('invalid');
  if (authData.credentialId && base64Url(authData.credentialId) !== input.id) return failure('invalid');
  if ((await ctx.sql.all('SELECT 1 FROM passkeys WHERE id = ?', input.id)).length > 0) return failure('conflict');

  const deviceToken = randomToken();
  const sessionToken = randomToken();
  const now = nowIso(ctx);
  const label = String(input.label ?? '').trim().slice(0, 60) || 'Aparelho';
  await ctx.sql.batch([
    statement(
      'INSERT INTO passkeys (id, public_key, sign_count, device_token_hash, label, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      input.id,
      input.publicKey,
      authData.signCount,
      await sha256(deviceToken),
      label,
      now,
      now,
    ),
    statement(
      'INSERT INTO sessions (token_hash, passkey_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      await sha256(sessionToken),
      input.id,
      now,
      minutesFrom(ctx, UNLOCK_MINUTES),
    ),
  ]);
  return { ok: true, value: { deviceToken, sessionToken }, changed: ['passkeys'] };
}

export async function unlockOptions(ctx: Context, caller: Caller): Promise<UnlockOptions | null> {
  const passkey = await devicePasskey(ctx, caller);
  if (!passkey) return null;
  return { challenge: await newChallenge(ctx, 'unlock'), credentialId: passkey.id };
}

/** Checks the fingerprint assertion for this device's passkey and opens an unlocked hour. */
export async function unlock(
  ctx: Context,
  caller: Caller,
  input: Partial<UnlockInput>,
  ceremony: Ceremony,
): Promise<CommandResult<{ sessionToken: string }>> {
  const passkey = await devicePasskey(ctx, caller);
  if (!passkey) return failure('not_found');
  const decoded = decode(input.clientDataJSON, input.authenticatorData, input.signature);
  if (!decoded || input.id !== passkey.id) return failure('invalid');
  const { clientDataJSON, authenticatorData, signature } = decoded;
  const clientData = parseClientData(clientDataJSON);
  const authData = parseAuthenticatorData(authenticatorData);
  if (!clientData || !authData || !signature) return failure('invalid');
  if (!(await consumeChallenge(ctx, clientData.challenge, 'unlock'))) return failure('unauthenticated');
  if (!(await checkCeremony(clientData, authData, { ...ceremony, type: 'webauthn.get', challenge: clientData.challenge }))) {
    return failure('unauthenticated');
  }
  // A counter that does not grow means a cloned authenticator; synced passkeys always send 0.
  if ((authData.signCount > 0 || passkey.sign_count > 0) && authData.signCount <= passkey.sign_count) return failure('unauthenticated');
  if (!(await verifyAssertionSignature(passkey.public_key, authenticatorData, clientDataJSON, signature))) {
    return failure('unauthenticated');
  }

  const sessionToken = randomToken();
  const now = nowIso(ctx);
  await ctx.sql.batch([
    statement('UPDATE passkeys SET sign_count = ?, last_used_at = ? WHERE id = ?', authData.signCount, now, passkey.id),
    statement(
      'INSERT INTO sessions (token_hash, passkey_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      await sha256(sessionToken),
      passkey.id,
      now,
      minutesFrom(ctx, UNLOCK_MINUTES),
    ),
  ]);
  return { ok: true, value: { sessionToken }, changed: [] };
}

export async function lock(ctx: Context, caller: Caller): Promise<void> {
  if (caller.sessionTokenHash) await ctx.sql.run('DELETE FROM sessions WHERE token_hash = ?', caller.sessionTokenHash);
}

/** Run by the cron: drops expired sessions and challenges. */
export async function cleanUpLock(ctx: Context): Promise<void> {
  const now = nowIso(ctx);
  await ctx.sql.batch([
    statement('DELETE FROM sessions WHERE expires_at <= ?', now),
    statement('DELETE FROM webauthn_challenges WHERE expires_at <= ?', now),
  ]);
}

function decode(
  ...fields: (string | undefined)[]
): { clientDataJSON: Uint8Array<ArrayBuffer>; authenticatorData: Uint8Array<ArrayBuffer>; signature?: Uint8Array<ArrayBuffer> } | null {
  if (fields.some((field) => typeof field !== 'string')) return null;
  try {
    const [clientDataJSON, authenticatorData, signature] = fields.map((field) => fromBase64Url(field!));
    return { clientDataJSON, authenticatorData, signature };
  } catch {
    return null;
  }
}
