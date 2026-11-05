// Reading a phone notification into a provisional expense (docs/spec/gastos-provisorios.md).
// Pure: the server calls it when MacroDroid posts, and tests feed it sample texts.

/** Where a notification came from, by the app that posted it. */
export type NotificationSource = 'nubank' | 'wise' | 'flash' | 'swile' | 'caju' | 'outra';

/** Card purchase or money sent (Pix, transfer). */
export type ExpenseKind = 'card' | 'pix';

export interface NotificationInput {
  /** The Android package (or app name) MacroDroid reports. */
  readonly app: string;
  readonly title: string;
  readonly text: string;
}

export type ReadNotification =
  | {
      readonly status: 'expense';
      readonly source: NotificationSource;
      readonly kind: ExpenseKind;
      readonly amountCents: number;
      readonly currency: string;
      readonly merchant: string | null;
    }
  /** Looks like a purchase or a Pix sent, but the amount could not be read. */
  | { readonly status: 'unreadable'; readonly source: NotificationSource; readonly kind: ExpenseKind }
  /** Not an expense (Pix received, declined purchase, bill payment, refunds, marketing...). */
  | { readonly status: 'ignored'; readonly source: NotificationSource };

const SOURCES: readonly [NotificationSource, RegExp][] = [
  ['nubank', /\bnu\.production\b|nubank/i],
  ['wise', /transferwise|\bwise\b/i],
  ['flash', /flash/i],
  ['swile', /swile/i],
  ['caju', /caju/i],
];

export function notificationSource(app: string): NotificationSource {
  return SOURCES.find(([, pattern]) => pattern.test(app))?.[0] ?? 'outra';
}

// Checked before anything counts as an expense: money in, refused purchases, card bill and boleto
// payments, refunds. Refunds and boletos are left out of phase 2 by the owner's choice.
const NOT_AN_EXPENSE =
  /recusad|negad|n[ãa]o (foi )?aprovad|n[ãa]o autorizad|recebe(u|ido|mos)|voc[êe] recebeu|dep[óo]sito|estorn|reembols|devolu|cancelad|fatura|boleto|received|declined|refund/i;
const PIX = /\bpix\b|transfer[êe]ncia|\bted\b|enviad[oa]|voc[êe] enviou|transferiu|you sent|transfer sent/i;
const CARD = /\bcompra\b|aprovad[oa]|pagamento (no|em|de)|gasto no cart|d[ée]bito|you spent|card payment/i;

/** "R$ 1.234,56", "US$ 12.50", "€ 3,00", "BRL 10,00", "10.00 USD". */
const SYMBOLS: Record<string, string> = { 'R$': 'BRL', 'US$': 'USD', $: 'USD', '€': 'EUR', '£': 'GBP' };
const AMOUNT_BEFORE = /(R\$|US\$|€|£|\$|\b(?:BRL|USD|EUR|GBP)\b)\s?(\d(?:[\d.,]*\d)?)/;
const AMOUNT_AFTER = /(\d(?:[\d.,]*\d)?)\s?(BRL|USD|EUR|GBP)\b/;

/** Cents from "1.234,56", "1,234.56", "12,5" or "12": the last separator followed by 1-2 digits is the decimal one. */
export function parseAmount(value: string): number | null {
  const compact = value.replace(/\s/g, '');
  const decimal = /[.,](\d{1,2})$/.exec(compact);
  const whole = (decimal ? compact.slice(0, decimal.index) : compact).replace(/[.,]/g, '');
  if (!/^\d+$/.test(whole)) return null;
  const cents = decimal ? Number(decimal[1].padEnd(2, '0')) : 0;
  return Number(whole) * 100 + cents;
}

function readAmount(text: string): { amountCents: number; currency: string } | null {
  const before = AMOUNT_BEFORE.exec(text);
  if (before) {
    const currency = SYMBOLS[before[1]] ?? before[1];
    const amountCents = parseAmount(before[2]);
    if (amountCents !== null && /^[A-Z]{3}$/.test(currency)) return { amountCents, currency };
  }
  const after = AMOUNT_AFTER.exec(text);
  if (after) {
    const amountCents = parseAmount(after[1]);
    if (amountCents !== null) return { amountCents, currency: after[2] };
  }
  return null;
}

// Who got the money: "no estabelecimento Y", "em Y", "para Y" (Wise: "at Y", "to Y"). The card's last digits and
// trailing punctuation are cut off.
const MERCHANT = [/\bno estabelecimento\s+(.+)/i, /\bem\s+(?!\d{2}\/)(.+)/i, /\bpara\s+(?!o cart|seu cart)(.+)/i, /\b(?:at|to)\s+(.+)/i];
const MERCHANT_END = /\s+(para o cart[ãa]o|no cart[ãa]o|com o cart[ãa]o|cart[ãa]o (com )?final|final \d|às? \d{1,2}[:h]|em \d{2}\/|via\b|pelo pix|com pix|with your|on \d|using).*$|[.!;]+$/i;

function readMerchant(text: string, amountEnd: number): string | null {
  const rest = text.slice(amountEnd);
  for (const pattern of MERCHANT) {
    const match = pattern.exec(rest);
    if (!match) continue;
    const merchant = match[1].replace(MERCHANT_END, '').replace(MERCHANT_END, '').trim();
    if (merchant && !/^R\$|^\d/.test(merchant)) return merchant.slice(0, 120);
  }
  return null;
}

export function readNotification(input: NotificationInput): ReadNotification {
  const source = notificationSource(input.app);
  const text = `${input.title}\n${input.text}`.replace(/ /g, ' ');
  if (NOT_AN_EXPENSE.test(text)) return { status: 'ignored', source };
  const kind: ExpenseKind | null = PIX.test(text) ? 'pix' : CARD.test(text) ? 'card' : null;
  if (!kind) return { status: 'ignored', source };
  const amount = readAmount(text);
  if (!amount || amount.amountCents <= 0) return { status: 'unreadable', source, kind };
  const at = (AMOUNT_BEFORE.exec(text) ?? AMOUNT_AFTER.exec(text))!;
  return { status: 'expense', source, kind, ...amount, merchant: readMerchant(text, at.index + at[0].length) };
}
