-- Phase 1: the data vault (docs/ARQUITETURA.md, ADR-006) and access (ADR-007).
-- Applied with `wrangler d1 migrations apply DB`. Never edit this file once applied in
-- production: add 0002_*.sql instead.
--
-- Conventions: ids are the app's own (TEXT); `pluggy_id` is Pluggy's current id and may change;
-- amounts are integer cents next to their currency; timestamps are ISO 8601 in UTC; `date`
-- columns of daily snapshots are the day in America/Sao_Paulo (yyyy-mm-dd). Every table that
-- mirrors the API keeps `raw_json`, `first_seen_at` and `last_seen_at`.

-- Raw archive index: one row per API response or webhook body stored in R2.
CREATE TABLE raw_payloads (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,            -- 'pluggy-api' | 'pluggy-webhook'
  endpoint TEXT NOT NULL,          -- method and path without query, or the webhook path
  item_id TEXT,
  status INTEGER,                  -- HTTP status of an API response
  received_at TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL
);
CREATE INDEX raw_payloads_received ON raw_payloads (received_at);

CREATE TABLE webhook_events (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,            -- 'pluggy'
  event TEXT NOT NULL,
  item_id TEXT,
  raw_payload_id TEXT NOT NULL REFERENCES raw_payloads (id),
  received_at TEXT NOT NULL,
  processed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX webhook_events_pending ON webhook_events (processed_at, received_at);

CREATE TABLE items (
  item_id TEXT PRIMARY KEY,
  connector_id INTEGER,
  connector_name TEXT,
  status TEXT,
  execution_status TEXT,
  error_code TEXT,
  error_message TEXT,
  consent_expires_at TEXT,
  pluggy_updated_at TEXT,          -- Pluggy's lastUpdatedAt: its last successful sync
  resources_collected_at TEXT,
  registered_at TEXT NOT NULL,
  last_synced_at TEXT,             -- our last successful read of this item
  replaced_by TEXT REFERENCES items (item_id),
  scr_checked_at TEXT,
  raw_json TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE sync_runs (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items (item_id),
  kind TEXT NOT NULL,              -- 'initial' | 'webhook' | 'daily' | 'scr'
  started_at TEXT NOT NULL,
  finished_at TEXT,
  counts_json TEXT,
  error TEXT
);
CREATE INDEX sync_runs_item ON sync_runs (item_id, started_at);

CREATE TABLE consents (
  id TEXT PRIMARY KEY,             -- Pluggy's consent id
  item_id TEXT NOT NULL REFERENCES items (item_id),
  products_json TEXT,
  permissions_json TEXT,
  created_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  raw_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

-- What each connection offers, per product the app collects ("não disponível" is not an error).
CREATE TABLE item_resources (
  item_id TEXT NOT NULL REFERENCES items (item_id),
  product TEXT NOT NULL,           -- 'accounts' | 'transactions' | 'bills' | 'investments' | ...
  available INTEGER NOT NULL,      -- 1 or 0
  detail TEXT,                     -- why it is unavailable (HTTP status, Pluggy code)
  checked_at TEXT NOT NULL,
  PRIMARY KEY (item_id, product)
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  pluggy_id TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL REFERENCES items (item_id),
  type TEXT,
  subtype TEXT,
  name TEXT,
  number_suffix TEXT,              -- last 4 digits only; links accounts across a renewed item
  currency_code TEXT NOT NULL,
  balance_cents INTEGER,
  credit_limit_cents INTEGER,
  available_limit_cents INTEGER,
  raw_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX accounts_item ON accounts (item_id);

CREATE TABLE account_balance_snapshots (
  account_id TEXT NOT NULL REFERENCES accounts (id),
  date TEXT NOT NULL,
  balance_cents INTEGER,
  credit_limit_cents INTEGER,
  available_limit_cents INTEGER,
  currency_code TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (account_id, date)
);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  pluggy_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL REFERENCES accounts (id),
  due_date TEXT,
  total_amount_cents INTEGER,
  minimum_payment_cents INTEGER,
  currency_code TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  pluggy_id TEXT NOT NULL UNIQUE,  -- changes when the card deletes and recreates the transaction
  account_id TEXT NOT NULL REFERENCES accounts (id),
  match_key TEXT NOT NULL,         -- 'p:<providerId>', or 'f:<date>|<amount>|<description>|<n>'
  provider_id TEXT,
  provider_code TEXT,
  date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  amount_in_account_currency_cents INTEGER,
  balance_cents INTEGER,
  description TEXT,
  description_raw TEXT,
  pluggy_category_id TEXT,
  status TEXT,
  type TEXT,
  operation_type TEXT,
  bill_id TEXT,                    -- Pluggy's bill id, as the transaction carries it
  pluggy_created_at TEXT,
  pluggy_updated_at TEXT,
  deleted_at TEXT,
  raw_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE (account_id, match_key)
);
CREATE INDEX transactions_account_date ON transactions (account_id, date);

CREATE TABLE transaction_versions (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions (id),
  previous_json TEXT NOT NULL,     -- the whole row before the change
  changed_at TEXT NOT NULL
);
CREATE INDEX transaction_versions_transaction ON transaction_versions (transaction_id);

CREATE TABLE transaction_payment_data (
  transaction_id TEXT PRIMARY KEY REFERENCES transactions (id),
  payer_name TEXT,
  payer_json TEXT,
  receiver_name TEXT,
  receiver_json TEXT,
  payment_method TEXT,
  reason TEXT,
  reference_number TEXT,
  boleto_json TEXT
);

CREATE TABLE transaction_card_data (
  transaction_id TEXT PRIMARY KEY REFERENCES transactions (id),
  installment_number INTEGER,
  total_installments INTEGER,
  total_amount_cents INTEGER,
  purchase_date TEXT,
  payee_mcc INTEGER,
  card_number TEXT                 -- the last digits Pluggy sends
);

CREATE TABLE investments (
  id TEXT PRIMARY KEY,
  pluggy_id TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL REFERENCES items (item_id),
  type TEXT,
  subtype TEXT,
  name TEXT,
  code TEXT,
  status TEXT,
  currency_code TEXT NOT NULL,
  balance_cents INTEGER,
  amount_cents INTEGER,
  amount_profit_cents INTEGER,
  amount_withdrawal_cents INTEGER,
  annual_rate REAL,
  last_month_rate REAL,
  last_twelve_months_rate REAL,
  due_date TEXT,
  raw_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE investment_snapshots (
  investment_id TEXT NOT NULL REFERENCES investments (id),
  date TEXT NOT NULL,
  balance_cents INTEGER,
  amount_cents INTEGER,            -- gross
  amount_withdrawal_cents INTEGER, -- net
  captured_at TEXT NOT NULL,
  PRIMARY KEY (investment_id, date)
);

CREATE TABLE investment_transactions (
  id TEXT PRIMARY KEY,
  pluggy_id TEXT NOT NULL UNIQUE,
  investment_id TEXT NOT NULL REFERENCES investments (id),
  date TEXT,
  trade_date TEXT,
  type TEXT,
  movement_type TEXT,
  description TEXT,
  amount_cents INTEGER,
  value_cents INTEGER,
  quantity REAL,
  raw_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE loans (
  id TEXT PRIMARY KEY,
  pluggy_id TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL REFERENCES items (item_id),
  product_name TEXT,
  type TEXT,
  currency_code TEXT,
  contract_amount_cents INTEGER,
  outstanding_balance_cents INTEGER,
  cet REAL,
  raw_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

-- Bills, investments, loans, accounts and consents change in place; their previous rows go here.
CREATE TABLE record_versions (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  previous_json TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
CREATE INDEX record_versions_record ON record_versions (table_name, record_id);

-- A new row only when the identity data changed (sha256 of the response).
CREATE TABLE identity (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items (item_id),
  sha256 TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  collected_at TEXT NOT NULL
);

CREATE TABLE scr_reports (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items (item_id),
  sha256 TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  collected_at TEXT NOT NULL
);

CREATE TABLE pluggy_categories (
  id TEXT PRIMARY KEY,
  description TEXT,
  description_translated TEXT,
  parent_id TEXT,
  raw_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

-- When each cron job last ran, so one frequent cron can decide what is due.
CREATE TABLE job_runs (
  job TEXT PRIMARY KEY,
  last_run_at TEXT NOT NULL
);

-- Access (ADR-007).
CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,             -- credential id, base64url
  public_key TEXT NOT NULL,        -- SPKI, base64url
  sign_count INTEGER NOT NULL DEFAULT 0,
  device_token_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE webauthn_challenges (
  challenge TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,           -- 'register' | 'unlock'
  expires_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  passkey_id TEXT NOT NULL REFERENCES passkeys (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
