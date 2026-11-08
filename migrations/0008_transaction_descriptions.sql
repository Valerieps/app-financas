-- Phase 2: the description my rules leave on a lançamento (docs/spec/regras-automaticas.md), kept
-- beside the bank's, which stays untouched in transactions.description. A row exists only when the
-- rules changed the description (description NULL: they left nothing). The server rewrites the rows
-- in the same batch as every write that can change them: a rule, my category choice, a lançamento
-- the collection stores; the cron rewrites them all once a day as a safety net.
CREATE TABLE transaction_descriptions (
  transaction_id TEXT PRIMARY KEY REFERENCES transactions (id),
  description TEXT,
  described_at TEXT NOT NULL
);
