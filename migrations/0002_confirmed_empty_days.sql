-- Days the owner confirmed had no transaction on an account (docs/spec/cofre-de-dados.md, "Tela Cofre").
-- Without a row, an empty day shows red on the Cofre calendar.
CREATE TABLE confirmed_empty_days (
  account_id TEXT NOT NULL REFERENCES accounts (id),
  day TEXT NOT NULL,               -- yyyy-mm-dd, in Brasília
  confirmed_at TEXT NOT NULL,
  PRIMARY KEY (account_id, day)
);
