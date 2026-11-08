// The contract between the app and the server: query and command names, inputs and outputs.
// Types only. The server imports it with `import type`, so nothing here runs on either side.
import type { BillStatus } from '../domain/faturas';
import type { CategoryOption } from '../domain/pluggy-categories';
import type { RuleAction, RuleCondition, RuleDefinition } from '../domain/rules';
import type { CategoryChart, Comparison, MonthlyChart } from '../domain/spending';
import type { TagAssignment, TagChange } from '../domain/tags';

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
  /** The bank's description, with the texts my rules replace already replaced. */
  readonly description: string | null;
  /** The category that counts, translated: the one I chose, or else Pluggy's; null when it has none. */
  readonly category: string | null;
  /** That category's id in Pluggy's tree; null when it has none. */
  readonly categoryId: string | null;
  /** I chose the category, over Pluggy's (docs/spec/classificacao.md). */
  readonly categoryChosen: boolean;
  /** Always positive; `direction` says whether it came in or went out. */
  readonly amountCents: number;
  readonly currency: string;
  readonly direction: 'in' | 'out';
  readonly accountName: string | null;
  /** Pluggy's account type: BANK or CREDIT. */
  readonly accountType: string | null;
  /** Pluggy has not posted it yet (PENDING). */
  readonly pending: boolean;
  /** A card bill payment: the bank debit that pays the bill or the credit on the card; out of the totals. */
  readonly cardPayment: boolean;
  readonly installment: { readonly number: number; readonly total: number } | null;
  /** My tags on it: for each layer that has one, the tag id (docs/spec/categorias.md). */
  readonly tags: TagAssignment;
  /** Pluggy's operation type and payment method, as `operationLabel` joins them. */
  readonly operation: string | null;
  /** Who paid, as the bank told it (on money out, usually me). */
  readonly payer: string | null;
}

export interface LancamentosView {
  readonly month: string;
  readonly items: readonly LancamentoView[];
  /** Saídas and entradas of the month, without the card bill payments. */
  readonly totals: readonly { readonly currency: string; readonly inCents: number; readonly outCents: number }[];
}

/** One transaction in the detail panel: the list's fields and what the bank told about it. */
export interface LancamentoDetailView extends LancamentoView {
  /** When it happened, as Pluggy sent it. */
  readonly date: string;
  /** The bank's description, when a rule changed it. */
  readonly descriptionOriginal: string | null;
  /** The bank's own text, when it differs from the bank's description. */
  readonly descriptionRaw: string | null;
  /** Who paid, on money in; who received, on money out. */
  readonly counterpart: string | null;
  readonly cardDigits: string | null;
  /** When the app first saw it. */
  readonly firstSeenAt: string;
  /** Pluggy's own category, translated, even when I chose another. */
  readonly pluggyCategory: string | null;
}

/** A payment from the bank account linked to a card bill. */
export interface BillPaymentView {
  /** The lançamento's id, to open it in Lançamentos. */
  readonly id: string;
  readonly day: string;
  /** Always positive. */
  readonly amountCents: number;
  readonly accountName: string | null;
}

/** One card bill on Finanças › Cartão (docs/spec/cartao-de-credito.md). */
export interface BillView {
  readonly id: string;
  /** The card's name. */
  readonly accountName: string | null;
  readonly status: BillStatus;
  /** Null for the open bill. */
  readonly dueDay: string | null;
  /** The first and last purchase's day; null when it has none. */
  readonly firstDay: string | null;
  readonly lastDay: string | null;
  /** The bill's value as the bank sent it; for the open bill, its purchases so far. */
  readonly totalCents: number | null;
  /** How much of it is installment purchases. */
  readonly installmentCents: number;
  readonly paidCents: number;
  /** Payments minus the value: negative when short. */
  readonly differenceCents: number | null;
  readonly payments: readonly BillPaymentView[];
}

/** The open bill first, then the last 12 months' bills, newest first. */
export interface CartaoView {
  readonly bills: readonly BillView[];
}

/** One tag of a layer (docs/spec/categorias.md). */
export interface TagView {
  readonly id: string;
  readonly name: string;
}

/** One layer of tags, in screen order, with its tags in alphabetical order. */
export interface TagLayerView {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly TagView[];
}

/** One automatic rule, in screen order (docs/spec/regras-automaticas.md). */
export interface RuleView {
  readonly id: string;
  readonly conditions: readonly RuleCondition[];
  /** Tags deleted after the rule was saved are already gone from them. */
  readonly actions: readonly RuleAction[];
}

/** The "Testar" button: the newest lançamentos the conditions match, and how many match in all. */
export interface RulePreviewView {
  readonly total: number;
  readonly items: readonly LancamentoView[];
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
  /** Finanças › Gráficos › Por categoria: `month` is yyyy-mm (docs/spec/graficos.md). */
  spendingByCategory: { input: { month: string; compare: Comparison }; output: CategoryChart };
  /** Finanças › Gráficos › Ao longo do tempo: the 12 months ending at `month`. */
  spendingByMonth: { input: { month: string }; output: MonthlyChart };
  /** The month's transactions (yyyy-mm), newest first. */
  lancamentos: { input: { month: string }; output: LancamentosView };
  lancamento: { input: { id: string }; output: LancamentoDetailView };
  /** Finanças › Cartão: the card bills and the payments linked to each (docs/spec/cartao-de-credito.md). */
  cartao: { input: Record<string, never>; output: CartaoView };
  /** The category layers and their tags (docs/spec/categorias.md). */
  tagLayers: { input: Record<string, never>; output: TagLayerView[] };
  /** Pluggy's category tree, in reading order: the choices for a lançamento's category. */
  pluggyCategories: { input: Record<string, never>; output: CategoryOption[] };
  /** The automatic rules, in order (docs/spec/regras-automaticas.md). */
  rules: { input: Record<string, never>; output: RuleView[] };
  /** The stored lançamentos that `conditions` match, newest first, at most RULE_PREVIEW_LIMIT. */
  rulePreview: { input: { conditions: readonly RuleCondition[] }; output: RulePreviewView };
}

/** Writes: `POST /api/command/<name>`. Each sends its writes in one atomic batch. */
export interface Commands {
  'passkey.delete': { input: { id: string }; output: null };
  /** Registers a connection by the itemId copied from the Pluggy Dashboard; the first load runs after. */
  'connection.add': { input: { itemId: string }; output: { itemId: string } };
  /** Confirms (or, with `confirmed: false`, undoes) that an account had no transaction that day. */
  'day.confirmEmpty': { input: { accountId: string; day: string; confirmed: boolean }; output: null };
  // Category layers and tags (docs/spec/categorias.md). A name that is empty or too long is
  // `invalid`; a name already used among its siblings, or a sixth layer, is `conflict`.
  'tagLayer.create': { input: { name: string }; output: { id: string } };
  'tagLayer.rename': { input: { id: string; name: string }; output: null };
  /** Deletes the layer, its tags and those tags on every lançamento. */
  'tagLayer.delete': { input: { id: string }; output: null };
  'tagLayer.move': { input: { id: string; direction: 'up' | 'down' }; output: null };
  'tag.create': { input: { layerId: string; name: string }; output: { id: string } };
  'tag.rename': { input: { id: string; name: string }; output: null };
  /** Deletes the tag and takes it off every lançamento. */
  'tag.delete': { input: { id: string }; output: null };
  /**
   * Puts tags on many lançamentos at once, or takes them off (`tagId: null`); layers left out keep
   * each lançamento's own tag. An unknown lançamento, layer or tag is `not_found`.
   */
  'lancamentos.tag': { input: { ids: readonly string[]; changes: readonly TagChange[] }; output: null };
  /**
   * Gives many lançamentos a category from Pluggy's tree, over Pluggy's own, or takes it off
   * (`categoryId: null`). An unknown lançamento or category is `not_found`.
   */
  'lancamentos.categorize': { input: { ids: readonly string[]; categoryId: string | null }; output: null };
  // Automatic rules (docs/spec/regras-automaticas.md). A malformed rule, or a tag that does not
  // exist, is `invalid`; a rule beyond MAX_RULES is `conflict`.
  'rule.create': { input: RuleDefinition; output: { id: string } };
  'rule.update': { input: RuleDefinition & { id: string }; output: null };
  'rule.delete': { input: { id: string }; output: null };
  'rule.move': { input: { id: string; direction: 'up' | 'down' }; output: null };
  /** Runs every rule, in order, over the stored lançamentos; returns how many got a tag. */
  'rules.apply': { input: Record<string, never>; output: { tagged: number; described: number; categorized: number } };
}

export type QueryName = keyof Queries;
export type CommandName = keyof Commands;

/** What a command says changed; screens that read these topics refetch. */
export type Topic = 'vault' | 'passkeys' | 'tags' | 'categories' | 'rules';

/** `locked`: this device has a passkey and must be unlocked first. */
export type ApiError = 'unauthenticated' | 'locked' | 'forbidden' | 'not_found' | 'invalid' | 'conflict' | 'unavailable';

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };

/** A successful command's response body. */
export interface CommandResponse<T> {
  readonly value: T;
  readonly changed: readonly Topic[];
}
