# ADR-008: External services the Worker calls

**Status:** Accepted
**Date:** 2026-11-02
**Decision:** `SERVER_ORIGINS` in `network-policy.ts` lists every server the Worker calls; the app (browser) still calls only its own origin.
- **Pluggy** (`https://api.pluggy.ai`), personal use through Meu Pluggy. `PLUGGY_CLIENT_ID` and `PLUGGY_CLIENT_SECRET` create an API key (valid for 2 hours) on demand, cached in memory until 10 minutes before it expires, and renewed once if Pluggy answers 401. Transactions come from `GET /v2/transactions` (cursor, 500 per page; the page-numbered `GET /transactions` stops on 2026-12-31); the other lists use `page`/`pageSize=500`. After a 429, the client waits `RateLimit-Reset` seconds (at most 60) and tries again, up to 3 attempts. Item ids are registered by hand (`GET /v2/items` does not exist in Meu Pluggy), and Meu Pluggy items cannot be refreshed on demand (they sync every 24 hours).
- **Pluggy webhook:** Pluggy signs nothing; the webhook is registered through the API (`scripts/pluggy-webhook.mjs`, event `all`) with a custom `X-Webhook-Secret` header carrying `PLUGGY_WEBHOOK_SECRET`. Pluggy expects a 2xx within 10 seconds and tries 3 times (at once, after ~15 minutes, after ~2 hours); a 401 is not retried.
- **Telegram Bot API** (`https://api.telegram.org`): alerts and commands; `TELEGRAM_BOT_TOKEN`. Incoming updates reach `/webhooks/telegram`, checked with the `X-Telegram-Bot-Api-Secret-Token` header.
- **Google Gemini** (`https://generativelanguage.googleapis.com`): classification, phase 2. The model name comes from `GEMINI_MODEL`, so changing models needs no deploy. Only the description, the amount and Pluggy's category are sent, never documents of third parties.
- **Cloudflare Access certs** (`https://vesper-apps.cloudflareaccess.com`, `ACCESS_TEAM_ORIGIN` in `network-policy.ts`), to validate the Access JWT (ADR-007).

**Why:** Secrets live only in the Worker (docs/SEGURANCA.md); one list makes every outgoing call reviewable and testable by `src/security.test.ts`.
