# ADR-004: Cloudflare Workers backend with one Durable Object for the personal app

**Status:** Accepted
**Date:** 2026-10-26
**Decision:** One Cloudflare Worker (`server/entry/worker.ts`, configured in `wrangler.jsonc`) serves
the built app from `dist/` (static assets, single-page fallback), the API under `/api`, the live
WebSocket connection and the cron. All personal app data lives in a single SQLite-backed Durable Object,
`AppObject` (`server/entry/app-object.ts`), addressed by the fixed name `default`. The app never reaches the
database directly: it calls `POST /api/query/<name>` and `POST /api/command/<name>`, typed by
`src/application/api-contract.ts`.
- **Commands:** The Durable Object processes one call at a time. `AppService` (`server/application/`)
  verifies the session, applies the domain rules (`src/domain/`) and writes inside a single transaction.
  Use cases are synchronous and depend only on the `Sql`, `Clock` and `IdGenerator` ports, so tests run
  them on `node:sqlite`.
- **Live updates:** Each open app instance keeps one WebSocket to `/api/live`, accepted with the hibernation
  API. After a command or an external webhook, the object sends `{type: 'changed', topics}`; screens refetch
  those topics, and refetch everything after a reconnect.
- **Webhook Ingress:** External automations (MacroDroid, Tasker, iOS Shortcuts, cURL) call `POST /api/webhook`
  authenticated with `Authorization: Bearer <WEBHOOK_SECRET>`. The Durable Object mutates data and broadcasts
  live updates to connected clients.
- **Time-based jobs:** One cron every 5 minutes calls `AppObject.tick()`; each job decides whether it is
  due. Cron runs in UTC.
- **Plan:** Workers Free. Durable Objects with SQLite storage and cron triggers are included.
- **Deploy:** Workers Builds, connected to the GitHub repository, runs `npm run build` and deploys `main`.

**Why:** A personal app fits comfortably in a single Durable Object: writes are serialized and transactional
without locks, and the object holds the live connections. One Worker means one origin, so the app's CSP
is `connect-src 'self'`.
**Alternatives:** D1 (no interactive transactions and no live WebSockets); Pages plus a separate Worker
for the cron (two deploys, two origins).
