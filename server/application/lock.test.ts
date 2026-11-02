import { describe, expect, it } from 'vitest';
import { base64Url, sha256 } from '../infrastructure/crypto';
import { derToRaw } from '../infrastructure/webauthn';
import { testContext } from '../testing/node-sql';
import { AppService } from './app-service';
import type { Context } from './context';
import { gate, lock, lockStatus, register, registrationOptions, unlock, unlockOptions, type Caller } from './lock';

const CEREMONY = { origin: 'https://app.example', rpId: 'app.example' };
const encoder = new TextEncoder();

/** A software authenticator: what the phone does when the owner touches the sensor. */
async function authenticator(credentialId = 'cred-1') {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = base64Url(new Uint8Array(await crypto.subtle.exportKey('spki', keys.publicKey)));
  let counter = 0;

  async function authData(flags: number, attested: boolean, rpId = CEREMONY.rpId): Promise<Uint8Array> {
    const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(rpId)));
    const head = new Uint8Array(37);
    head.set(rpIdHash);
    head[32] = flags | (attested ? 0x40 : 0);
    new DataView(head.buffer).setUint32(33, counter);
    if (!attested) return head;
    const id = encoder.encode(credentialId);
    const tail = new Uint8Array(18 + id.length);
    new DataView(tail.buffer).setUint16(16, id.length);
    tail.set(id, 18);
    return new Uint8Array([...head, ...tail]);
  }

  const clientData = (type: string, challenge: string, origin = CEREMONY.origin) =>
    encoder.encode(JSON.stringify({ type, challenge, origin, crossOrigin: false }));

  return {
    id: base64Url(encoder.encode(credentialId)),
    publicKey,
    async create(challenge: string, options: { flags?: number } = {}) {
      return {
        id: base64Url(encoder.encode(credentialId)),
        clientDataJSON: base64Url(clientData('webauthn.create', challenge)),
        authenticatorData: base64Url(await authData(options.flags ?? 0x05, true)),
        publicKey,
        publicKeyAlgorithm: -7,
        label: 'Celular',
      };
    },
    async get(challenge: string, options: { origin?: string; keepCounter?: boolean } = {}) {
      if (!options.keepCounter) counter++;
      const data = await authData(0x05, false);
      const client = clientData('webauthn.get', challenge, options.origin);
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', client));
      const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new Uint8Array([...data, ...hash])));
      return {
        id: base64Url(encoder.encode(credentialId)),
        clientDataJSON: base64Url(client),
        authenticatorData: base64Url(data),
        signature: base64Url(rawToDer(raw)),
      };
    },
  };
}

function rawToDer(raw: Uint8Array): Uint8Array {
  const integer = (bytes: Uint8Array) => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i++;
    const trimmed = bytes.slice(i);
    return trimmed[0] & 0x80 ? [0x02, trimmed.length + 1, 0, ...trimmed] : [0x02, trimmed.length, ...trimmed];
  };
  const body = [...integer(raw.slice(0, 32)), ...integer(raw.slice(32))];
  return new Uint8Array([0x30, body.length, ...body]);
}

function setup() {
  const { ctx, clock } = testContext();
  return { ctx, clock };
}

async function registered() {
  const { ctx, clock } = setup();
  const device = await authenticator();
  const { challenge } = await registrationOptions(ctx);
  const result = await register(ctx, await device.create(challenge), CEREMONY);
  if (!result.ok) throw new Error(result.error);
  const caller: Caller = {
    deviceTokenHash: await sha256(result.value.deviceToken),
    sessionTokenHash: await sha256(result.value.sessionToken),
  };
  return { ctx, clock, device, caller };
}

async function unlockWith(ctx: Context, caller: Caller, device: Awaited<ReturnType<typeof authenticator>>, options = {}) {
  const opts = await unlockOptions(ctx, caller);
  if (!opts) throw new Error('no passkey');
  return unlock(ctx, caller, await device.get(opts.challenge, options), CEREMONY);
}

describe('passkey lock', () => {
  it('lets a device without a passkey in with Access alone', async () => {
    const { ctx } = setup();
    const computer: Caller = { deviceTokenHash: null, sessionTokenHash: null };
    expect(await lockStatus(ctx, computer)).toEqual({ deviceHasPasskey: false, locked: false });
    expect(await gate(ctx, computer)).toBe(true);
  });

  it('registers a passkey and leaves the device unlocked', async () => {
    const { ctx, caller } = await registered();
    expect(await lockStatus(ctx, caller)).toEqual({ deviceHasPasskey: true, locked: false });
    expect(await gate(ctx, caller)).toBe(true);
  });

  it('asks for the fingerprint after an hour without use, and each use renews the hour', async () => {
    const { ctx, clock, caller } = await registered();
    clock.set('2026-11-02T12:50:00Z');
    expect(await gate(ctx, caller)).toBe(true);
    clock.set('2026-11-02T13:40:00Z');
    expect(await gate(ctx, caller)).toBe(true);
    clock.set('2026-11-02T14:41:00Z');
    expect(await gate(ctx, caller)).toBe(false);
    expect((await lockStatus(ctx, caller)).locked).toBe(true);
  });

  it('unlocks with a valid assertion and opens a new session', async () => {
    const { ctx, caller, device } = await registered();
    await lock(ctx, caller);
    expect(await gate(ctx, caller)).toBe(false);

    const result = await unlockWith(ctx, caller, device);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const unlocked = { ...caller, sessionTokenHash: await sha256(result.value.sessionToken) };
    expect(await gate(ctx, unlocked)).toBe(true);
  });

  it('refuses an assertion from another origin, a replayed challenge or a counter that went back', async () => {
    const { ctx, caller, device } = await registered();
    expect(await unlockWith(ctx, caller, device, { origin: 'https://evil.example' })).toEqual({ ok: false, error: 'unauthenticated' });

    const opts = (await unlockOptions(ctx, caller))!;
    const assertion = await device.get(opts.challenge);
    expect((await unlock(ctx, caller, assertion, CEREMONY)).ok).toBe(true);
    expect(await unlock(ctx, caller, assertion, CEREMONY)).toEqual({ ok: false, error: 'unauthenticated' });

    expect(await unlockWith(ctx, caller, device, { keepCounter: true })).toEqual({ ok: false, error: 'unauthenticated' });
  });

  it('refuses a signature from another key', async () => {
    const { ctx, caller } = await registered();
    const impostor = await authenticator();
    expect(await unlockWith(ctx, caller, impostor)).toEqual({ ok: false, error: 'unauthenticated' });
  });

  it('refuses a registration without user verification or with an expired challenge', async () => {
    const { ctx, clock } = setup();
    const device = await authenticator();
    const first = await registrationOptions(ctx);
    expect(await register(ctx, await device.create(first.challenge, { flags: 0x01 }), CEREMONY)).toEqual({ ok: false, error: 'unauthenticated' });

    const second = await registrationOptions(ctx);
    clock.set('2026-11-02T12:06:00Z');
    expect(await register(ctx, await device.create(second.challenge), CEREMONY)).toEqual({ ok: false, error: 'unauthenticated' });
  });

  it('lists passkeys, marks this device, and deleting one drops the lock on its device', async () => {
    const { ctx, caller, device } = await registered();
    const service = new AppService(ctx);
    const list = await service.query('passkeys', {}, caller);
    expect(list).toMatchObject({ ok: true, value: [{ id: device.id, label: 'Celular', thisDevice: true }] });

    await lock(ctx, caller);
    expect(await gate(ctx, caller)).toBe(false);
    expect(await service.command('passkey.delete', { id: device.id }, caller)).toEqual({ ok: true, value: null, changed: ['passkeys'] });
    expect(await lockStatus(ctx, caller)).toEqual({ deviceHasPasskey: false, locked: false });
  });
});

describe('derToRaw', () => {
  it('pads short integers and strips sign bytes', () => {
    const r = new Uint8Array(32).fill(0x80);
    const s = new Uint8Array(32);
    s[31] = 7;
    const raw = derToRaw(rawToDer(new Uint8Array([...r, ...s])));
    expect(raw).toEqual(new Uint8Array([...r, ...s]));
    expect(derToRaw(new Uint8Array([0x30, 2, 0, 0]))).toBeNull();
  });
});
