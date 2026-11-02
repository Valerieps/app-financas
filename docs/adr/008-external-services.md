# ADR-008: External services the Worker calls

**Status:** Accepted
**Date:** 2026-11-02
**Decision:** `SERVER_ORIGINS` in `network-policy.ts` lists every server the Worker calls; the app (browser) still calls only its own origin.
- **Pluggy** (`https://api.pluggy.ai`), personal use through Meu Pluggy. `PLUGGY_CLIENT_ID` and `PLUGGY_CLIENT_SECRET` create an API key (valid for hours) on demand, cached in memory until shortly before it expires. Pages of 500 transactions; after a 429, retry with backoff. Item ids are registered by hand (`GET /v2/items` does not exist in Meu Pluggy).
- **Telegram Bot API** (`https://api.telegram.org`): alerts and commands; `TELEGRAM_BOT_TOKEN`. Incoming updates reach `/webhooks/telegram`, checked with the `X-Telegram-Bot-Api-Secret-Token` header.
- **Google Gemini** (`https://generativelanguage.googleapis.com`): classification, phase 2. The model name comes from `GEMINI_MODEL`, so changing models needs no deploy. Only the description, the amount and Pluggy's category are sent, never documents of third parties.
- **Cloudflare Access certs** (`https://<team>.cloudflareaccess.com`), to validate the Access JWT (ADR-007); added to `SERVER_ORIGINS` once the owner creates the Zero Trust team.

**Why:** Secrets live only in the Worker (docs/SEGURANCA.md); one list makes every outgoing call reviewable and testable by `src/security.test.ts`.
