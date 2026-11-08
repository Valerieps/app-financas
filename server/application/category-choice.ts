// The category I chose for a lançamento counts over Pluggy's everywhere (docs/spec/classificacao.md).
// Queries over `transactions t` join my choice and read these expressions instead of Pluggy's columns.
import { CARD_PAYMENT_CATEGORY } from '../../src/domain/lancamentos';

export const CHOICE_JOIN = 'LEFT JOIN transaction_categories tc ON tc.transaction_id = t.id';

/** The category that counts: mine, or else Pluggy's. */
export const CATEGORY_ID = 'COALESCE(tc.pluggy_category_id, t.pluggy_category_id)';

/** Whether it is a card bill payment: cardPaymentWithChoice (src/domain/lancamentos.ts) in SQL. */
export const CARD_PAYMENT = `CASE WHEN tc.pluggy_category_id IS NULL THEN t.card_payment
  WHEN tc.pluggy_category_id LIKE '${CARD_PAYMENT_CATEGORY}%' THEN 1 ELSE 0 END`;
