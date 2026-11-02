// The browser side of the passkey ceremonies (ADR-007): the platform authenticator (the phone's
// fingerprint) creates and uses the credential; binary values travel to the API as base64url.
import type { RegistrationInput, RegistrationOptions, UnlockInput, UnlockOptions } from '../application/api-contract';

const toBase64Url = (buffer: ArrayBuffer): string => {
  let binary = '';
  for (const b of new Uint8Array(buffer)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

export async function passkeysSupported(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
}

/** Asks the device to create a passkey; null when the owner cancels. */
export async function createPasskey(options: RegistrationOptions, label: string): Promise<RegistrationInput | null> {
  const credential = (await navigator.credentials
    .create({
      publicKey: {
        challenge: fromBase64Url(options.challenge),
        rp: { name: 'Sinal Verde' },
        user: { id: new TextEncoder().encode(options.userId), name: 'Sinal Verde', displayName: 'Sinal Verde' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        attestation: 'none',
        timeout: 60_000,
      },
    })
    .catch(() => null)) as PublicKeyCredential | null;
  if (!credential) return null;
  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = response.getPublicKey();
  if (!publicKey) return null;
  return {
    id: credential.id,
    clientDataJSON: toBase64Url(response.clientDataJSON),
    authenticatorData: toBase64Url(response.getAuthenticatorData()),
    publicKey: toBase64Url(publicKey),
    publicKeyAlgorithm: response.getPublicKeyAlgorithm(),
    label,
  };
}

/** Asks for the fingerprint; null when the owner cancels. */
export async function assertPasskey(options: UnlockOptions): Promise<UnlockInput | null> {
  const credential = (await navigator.credentials
    .get({
      publicKey: {
        challenge: fromBase64Url(options.challenge),
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(options.credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    .catch(() => null)) as PublicKeyCredential | null;
  if (!credential) return null;
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    clientDataJSON: toBase64Url(response.clientDataJSON),
    authenticatorData: toBase64Url(response.authenticatorData),
    signature: toBase64Url(response.signature),
  };
}
