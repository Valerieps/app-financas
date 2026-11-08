-- Phase 2: the category I choose for a lançamento (docs/spec/classificacao.md), from Pluggy's own
-- tree. It counts over Pluggy's everywhere: the list, the charts, what is a gasto and the card bill
-- payment. Pluggy's category stays untouched in transactions; taking my choice off brings it back.
CREATE TABLE transaction_categories (
  transaction_id TEXT PRIMARY KEY REFERENCES transactions (id),
  pluggy_category_id TEXT NOT NULL REFERENCES pluggy_categories (id),
  chosen_at TEXT NOT NULL
);
