# ADR-006: D1 for the normalized tables and R2 for the raw archive

**Status:** Accepted
**Date:** 2026-11-02
**Decision:** The data vault follows the product spec ([spec/cofre-de-dados.md](../spec/cofre-de-dados.md)) instead of the template's single Durable Object:
- **D1** (`DB` binding, database `sinal-verde`) holds every normalized table (see `docs/ARQUITETURA.md`). Migrations are numbered SQL files in `migrations/`, applied with `wrangler d1 migrations apply`; a shipped migration is never edited.
- **R2** (`RAW` binding, bucket `sinal-verde-raw`) holds the raw archive: every Pluggy response and every webhook body, whole, as JSON, written **before** any normalization. Key: `<source>/<yyyy>/<mm>/<dd>/<received_at>-<sha256>.json`; `raw_payloads` in D1 points to it.
- **Asynchronous work:** webhooks store the raw body, record the event and return 2xx; the processing runs in `ctx.waitUntil`. A failed processing is retried by the next cron, which reprocesses events without `processed_at`.
- **Use cases** stay in `server/application/`, on ports. The `Sql` port becomes asynchronous (D1 is async); tests still run on `node:sqlite` behind the same port. Writes that must be atomic go through `DB.batch`.
- **No live WebSocket:** screens refetch when the app opens or regains focus. Real-time feedback goes through Telegram ([spec/telegram.md](../spec/telegram.md)).
- **Nightly mirror:** `scripts/espelho.mjs`, run by the Windows Task Scheduler on the owner's desktop at 23:30, runs `wrangler d1 export --remote` (keeping the last 30 exports) and copies R2 through its S3 API with rclone; rclone's `crypt` remote then copies the whole folder, encrypted, to her Google Drive. It only copies, never deletes, on the remote side.
- **Branch previews** get their own D1 (`sinal-verde-preview`) and R2 bucket (`sinal-verde-raw-preview`), set in the `previews` block of `wrangler.jsonc`, so a branch never writes to production data.
- **Deploy:** the deploy command applies pending migrations first (`npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`).
- One Worker still serves the app, the API, the webhooks and the cron (ADR-004).

**Why:** The owner chose to keep the spec's storage. D1 can be exported with standard tooling and read by other Workers through the data Worker; R2 keeps every byte the API returned, so anything can be reprocessed when the normalization changes. Volume is hundreds of transactions a month, inside the free plans.
**Alternatives:** Keep the template's SQLite Durable Object and add R2 only for the raw archive (transactions and live updates for free, but no `wrangler d1 export`, and the owner preferred the spec); Cloudflare Queues for async work (more moving parts than `waitUntil` plus a retrying cron, for this volume).
