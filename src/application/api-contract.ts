// The contract between the app and the server: query and command names, inputs and outputs.
// Types only. The server imports it with `import type`, so nothing here runs on either side.

/** One connection on the Cofre screen (docs/spec/cofre-de-dados.md, "Tela Cofre"). */
export interface ConnectionView {
  readonly itemId: string;
  readonly institution: string | null;
  /** Pluggy's status (UPDATED, LOGIN_ERROR, ...); null until the first read. */
  readonly status: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  /** The app's last complete read; null while the first load has not finished. */
  readonly lastSyncedAt: string | null;
  readonly consentExpiresAt: string | null;
  readonly replacedBy: string | null;
  /** The last read that failed after the last one that worked, if any. */
  readonly lastError: { readonly at: string; readonly message: string } | null;
  readonly counts: {
    readonly accounts: number;
    readonly transactions: number;
    readonly deletedTransactions: number;
    readonly bills: number;
    readonly investments: number;
  };
  /** Products the bank did not share (or Pluggy did not release). */
  readonly unavailable: readonly string[];
  readonly investments: readonly InvestmentView[];
}

/** One investment on the Cofre: name, issuer's CNPJ and today's total balance. */
export interface InvestmentView {
  readonly id: string;
  readonly name: string | null;
  readonly issuerCnpj: string | null;
  readonly balanceCents: number | null;
  readonly currency: string;
}

/** A connection Pluggy told about (by webhook) that is not registered yet. */
export interface PendingConnectionView {
  readonly itemId: string;
  /** When the first event about it arrived. */
  readonly firstSeenAt: string;
}

export interface VaultView {
  readonly connections: readonly ConnectionView[];
  readonly pending: readonly PendingConnectionView[];
}

/** One account on the Cofre calendar: transactions per Brasília day and the empty days confirmed. */
export interface CalendarAccountView {
  readonly id: string;
  readonly name: string | null;
  /** Pluggy's account type: BANK or CREDIT. */
  readonly type: string | null;
  /** Transactions per day (yyyy-mm-dd); a day with none is absent. */
  readonly counts: Readonly<Record<string, number>>;
  readonly confirmedEmpty: readonly string[];
}

/** The last 12 months of one connection, day by day (docs/spec/cofre-de-dados.md, "Tela Cofre"). */
export interface CalendarView {
  readonly from: string;
  readonly to: string;
  readonly accounts: readonly CalendarAccountView[];
}

/** A provisional expense on the Cofre list (docs/spec/gastos-provisorios.md). */
export interface ProvisionalExpenseView {
  readonly id: string;
  readonly source: 'nubank' | 'wise' | 'flash' | 'swile' | 'caju' | 'outra';
  /** Card purchase or Pix/transfer sent. */
  readonly kind: 'card' | 'pix';
  /** Null while unreadable. */
  readonly amountCents: number | null;
  readonly currency: string | null;
  readonly merchant: string | null;
  /** When the phone showed it (or when it arrived). */
  readonly at: string;
  readonly status: 'provisional' | 'unreadable';
  /** The notification's text, only when unreadable, so I see what the app could not read. */
  readonly text: string | null;
}

/** One transaction on the Lançamentos list (docs/spec/lancamentos.md). */
export interface LancamentoView {
  readonly id: string;
  /** The Brasília day (yyyy-mm-dd). */
  readonly day: string;
  readonly description: string | null;
  /** Pluggy's category, translated; null when it has none. */
  readonly category: string | null;
  /** Always positive; `direction` says whether it came in or went out. */
  readonly amountCents: number;
  readonly currency: string;
  readonly direction: 'in' | 'out';
  readonly accountName: string | null;
  /** Pluggy's account type: BANK or CREDIT. */
  readonly accountType: string | null;
  /** Pluggy has not posted it yet (PENDING). */
  readonly pending: boolean;
  readonly installment: { readonly number: number; readonly total: number } | null;
}

export interface LancamentosView {
  readonly month: string;
  readonly items: readonly LancamentoView[];
  readonly totals: readonly { readonly currency: string; readonly inCents: number; readonly outCents: number }[];
}

/** One transaction in the detail panel: the list's fields and what the bank told about it. */
export interface LancamentoDetailView extends LancamentoView {
  /** When it happened, as Pluggy sent it. */
  readonly date: string;
  /** The bank's own text, when it differs from the description. */
  readonly descriptionRaw: string | null;
  /** Pluggy's operation type (PIX, CARTAO, TED...). */
  readonly operationType: string | null;
  readonly paymentMethod: string | null;
  /** Who paid, on money in; who received, on money out. */
  readonly counterpart: string | null;
  readonly cardDigits: string | null;
  /** When the app first saw it. */
  readonly firstSeenAt: string;
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
  calendar: { input: { itemId: string }; output: CalendarView };
  provisionalExpenses: { input: Record<string, never>; output: ProvisionalExpenseView[] };
  /** The month's transactions (yyyy-mm), newest first. */
  lancamentos: { input: { month: string }; output: LancamentosView };
  lancamento: { input: { id: string }; output: LancamentoDetailView };
}

/** Writes: `POST /api/command/<name>`. Each sends its writes in one atomic batch. */
export interface Commands {
  'passkey.delete': { input: { id: string }; output: null };
  /** Registers a connection by the itemId copied from the Pluggy Dashboard; the first load runs after. */
  'connection.add': { input: { itemId: string }; output: { itemId: string } };
  /** Confirms (or, with `confirmed: false`, undoes) that an account had no transaction that day. */
  'day.confirmEmpty': { input: { accountId: string; day: string; confirmed: boolean }; output: null };
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
