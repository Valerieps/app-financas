// The contract between the app and the server: query and command names, inputs and outputs.
// Types only. The server imports it with `import type`, so nothing here runs on either side.

export interface VaultView {
  readonly connectionCount: number;
}

/** A device with a passkey asks for it after an hour without use (docs/spec/acesso.md). */
export interface LockStatusView {
  readonly deviceHasPasskey: boolean;
  readonly locked: boolean;
}

export interface PasskeyView {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly thisDevice: boolean;
}

// The passkey ceremonies (`POST /api/auth/...`). Binary fields travel as base64url.
export interface RegistrationOptions {
  readonly challenge: string;
  readonly userId: string;
}

export interface RegistrationInput {
  readonly id: string;
  readonly clientDataJSON: string;
  readonly authenticatorData: string;
  /** SPKI, from `AuthenticatorAttestationResponse.getPublicKey()`. */
  readonly publicKey: string;
  readonly publicKeyAlgorithm: number;
  readonly label: string;
}

export interface UnlockOptions {
  readonly challenge: string;
  readonly credentialId: string;
}

export interface UnlockInput {
  readonly id: string;
  readonly clientDataJSON: string;
  readonly authenticatorData: string;
  readonly signature: string;
}

/** Reads: `POST /api/query/<name>`. They never change anything. */
export interface Queries {
  vault: { input: Record<string, never>; output: VaultView };
  passkeys: { input: Record<string, never>; output: PasskeyView[] };
}

/** Writes: `POST /api/command/<name>`. Each sends its writes in one atomic batch. */
export interface Commands {
  'passkey.delete': { input: { id: string }; output: null };
  /** Registers a connection by the itemId copied from the Pluggy Dashboard; the first load runs after. */
  'connection.add': { input: { itemId: string }; output: { itemId: string } };
}

export type QueryName = keyof Queries;
export type CommandName = keyof Commands;

/** What a command says changed; screens that read these topics refetch. */
export type Topic = 'vault' | 'passkeys';

/** `locked`: this device has a passkey and must be unlocked first. */
export type ApiError = 'unauthenticated' | 'locked' | 'forbidden' | 'not_found' | 'invalid' | 'conflict' | 'unavailable';

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };

/** A successful command's response body. */
export interface CommandResponse<T> {
  readonly value: T;
  readonly changed: readonly Topic[];
}
