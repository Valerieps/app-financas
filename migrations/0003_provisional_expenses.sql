-- Phase 2: phone notifications (MacroDroid) and the provisional expenses they create
-- (docs/spec/gastos-provisorios.md). The raw body stays in R2, indexed by raw_payloads; a
-- notification that is not an expense (Pix received, declined purchase...) or that repeats one
-- just received gets no row here.
CREATE TABLE provisional_expenses (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,            -- 'nubank' | 'wise' | 'flash' | 'swile' | 'caju' | 'outra'
  app TEXT NOT NULL,               -- the Android package MacroDroid reported
  title TEXT NOT NULL,
  text TEXT NOT NULL,              -- the notification's text, as received
  kind TEXT NOT NULL,              -- 'card' | 'pix'
  amount_cents INTEGER,            -- null while unreadable
  currency_code TEXT,
  merchant TEXT,
  posted_at TEXT,                  -- when the phone showed it, if MacroDroid sent it
  received_at TEXT NOT NULL,
  raw_payload_id TEXT NOT NULL REFERENCES raw_payloads (id),
  status TEXT NOT NULL,            -- 'provisional' | 'unreadable'; matching adds more
  transaction_id TEXT REFERENCES transactions (id) -- the Pluggy transaction it matched
);
CREATE INDEX provisional_expenses_received ON provisional_expenses (received_at);
