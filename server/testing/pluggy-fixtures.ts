// Anonymized Pluggy responses, shaped like the examples in Pluggy's API reference. Every name,
// number and id here is made up; no real data ever goes into fixtures.

export const ITEM_ID = '0b1c2d3e-0000-4000-8000-000000000001';
export const RENEWED_ITEM_ID = '0b1c2d3e-0000-4000-8000-000000000002';
export const CHECKING_ID = 'acc-checking-1';
export const CARD_ID = 'acc-card-1';

export function item(id = ITEM_ID, overrides: Record<string, unknown> = {}) {
  return {
    id,
    connector: { id: 601, name: 'Banco Exemplo' },
    status: 'UPDATED',
    executionStatus: 'SUCCESS',
    error: null,
    consentExpiresAt: '2027-10-01T00:00:00.000Z',
    lastUpdatedAt: '2026-11-02T09:00:00.000Z',
    resourcesCollectedAt: '2026-11-02T09:00:00.000Z',
    products: ['ACCOUNTS', 'CREDIT_CARDS', 'TRANSACTIONS', 'INVESTMENTS', 'INVESTMENTS_TRANSACTIONS', 'IDENTITY'],
    ...overrides,
  };
}

export function accounts(itemId = ITEM_ID, ids = { checking: CHECKING_ID, card: CARD_ID }) {
  return {
    page: 1,
    total: 2,
    totalPages: 1,
    results: [
      { id: ids.checking, itemId, type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta', number: '0001/12345-6', balance: 1520.35, currencyCode: 'BRL' },
      {
        id: ids.card,
        itemId,
        type: 'CREDIT',
        subtype: 'CREDIT_CARD',
        name: 'Cartão',
        number: '9876',
        balance: 830.1,
        currencyCode: 'BRL',
        creditData: { creditLimit: 5000, availableCreditLimit: 4169.9 },
      },
    ],
  };
}

export function transaction(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    accountId: CHECKING_ID,
    date: '2026-10-28T00:00:00.000Z',
    description: 'PADARIA EXEMPLO',
    amount: -12.5,
    currencyCode: 'BRL',
    status: 'POSTED',
    type: 'DEBIT',
    providerId: null,
    createdAt: '2026-10-28T10:00:00.000Z',
    updatedAt: '2026-10-28T10:00:00.000Z',
    ...overrides,
  };
}

export const page = <T>(results: T[]) => ({ results, next: null });

export function routes(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [`/items/${ITEM_ID}`]: item(),
    '/consents': { page: 1, total: 1, totalPages: 1, results: [{ id: 'consent-1', itemId: ITEM_ID, products: ['ACCOUNTS'], createdAt: '2026-10-01T00:00:00.000Z', expiresAt: '2027-10-01T00:00:00.000Z' }] },
    [`/items/${ITEM_ID}/resources`]: { page: 1, total: 0, totalPages: 1, results: [] },
    '/accounts': accounts(),
    [`/accounts/${CHECKING_ID}/balance`]: { balance: 1500, currencyCode: 'BRL', updateDateTime: '2026-11-02T09:00:00.000Z' },
    [`/v2/transactions?accountId=${CHECKING_ID}`]: page([transaction('t1'), transaction('t2', { description: 'MERCADO EXEMPLO', amount: -80 })]),
    [`/v2/transactions?accountId=${CARD_ID}`]: page([
      transaction('c1', { accountId: CARD_ID, providerId: 'prov-1', description: 'LOJA EXEMPLO', amount: 45.9, creditCardMetadata: { installmentNumber: 1, totalInstallments: 3, payeeMCC: 5411 } }),
    ]),
    '/bills': { page: 1, total: 1, totalPages: 1, results: [{ id: 'bill-1', dueDate: '2026-11-10T00:00:00.000Z', totalAmount: 830.1, totalAmountCurrencyCode: 'BRL', minimumPaymentAmount: 124.5 }] },
    '/investments': { page: 1, total: 1, totalPages: 1, results: [{ id: 'inv-1', type: 'FIXED_INCOME', subtype: 'CDB', name: 'CDB Exemplo', balance: 1000.01, amount: 1000.01, currencyCode: 'BRL' }] },
    '/investments/inv-1/transactions': { page: 1, total: 1, totalPages: 1, results: [{ id: 'mov-1', date: '2026-10-01T00:00:00.000Z', type: 'BUY', amount: 1000 }] },
    '/identity': { id: 'identity-1', fullName: 'Pessoa Exemplo', document: '000.000.000-00' },
    '/categories': { page: 1, total: 1, totalPages: 1, results: [{ id: '01000000', description: 'Income', descriptionTranslated: 'Renda' }] },
    ...overrides,
  };
}
