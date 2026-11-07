-- Card bill payments (docs/spec/lancamentos.md): the debit in the bank account that pays the card
-- bill, and the credit that lands on the card. The collection sets the flag on every transaction it
-- writes (isCardPayment in src/domain/lancamentos.ts); this backfills what was stored before, with
-- the same rule: Pluggy's "Credit card payment" category, or else the description's prefix on money
-- out of an account or money into a card.
ALTER TABLE transactions ADD COLUMN card_payment INTEGER NOT NULL DEFAULT 0;

UPDATE transactions
SET card_payment = 1
WHERE pluggy_category_id LIKE '0510%'
   OR EXISTS (
     SELECT 1 FROM accounts a
     WHERE a.id = transactions.account_id
       AND (
         (
           COALESCE(a.type, '') <> 'CREDIT'
           AND (transactions.type = 'DEBIT' OR (transactions.type IS NULL AND transactions.amount_cents < 0))
           AND (
             lower(trim(transactions.description)) LIKE 'pagamento de fatura%'
             OR lower(trim(transactions.description)) LIKE 'pagamento da fatura%'
             OR lower(trim(transactions.description)) LIKE 'pagamento fatura%'
           )
         )
         OR (
           a.type = 'CREDIT'
           AND (transactions.type = 'CREDIT' OR (transactions.type IS NULL AND transactions.amount_cents <= 0))
           AND (
             lower(trim(transactions.description)) LIKE 'pagamento de fatura%'
             OR lower(trim(transactions.description)) LIKE 'pagamento da fatura%'
             OR lower(trim(transactions.description)) LIKE 'pagamento fatura%'
             OR lower(trim(transactions.description)) LIKE 'pagamento recebido%'
           )
         )
       )
   );
