# ADR-005: PIN authentication, session cookie and webhook token

**Status:** Accepted
**Date:** 2026-10-26
**Decision:** A simplified, frictionless single-user authentication mechanism based on a numeric PIN (4 to 8 digits) and a session cookie:
- **First Run (Setup):** On the first visit, if no PIN is configured in `settings`, the app displays the setup screen. The user creates a numeric PIN. The Worker computes its SHA-256 digest, stores it in `settings`, generates a secure random token, and sets the `__Host-sessao` cookie (HttpOnly, Secure, SameSite=Lax, 180 days).
- **Subsequent Unlocks:** Entering the PIN validates its hash with `constantTimeEqual`. A successful unlock issues a new session token cookie.
- **Locking:** Calling `POST /api/auth/lock` deletes the session token hash from the `sessions` table and clears the cookie.
- **Webhook Ingress:** Machine-to-machine integrations bypass browser cookies and must provide a secret bearer token (`Authorization: Bearer <WEBHOOK_SECRET>`).
- **Secret Management:** `WEBHOOK_SECRET` is configured via `npx wrangler secret put WEBHOOK_SECRET` and locally in `.dev.vars`.

**Why:** Strictly personal web apps should not require third-party OAuth providers (Google Cloud Console, consent screens, domain verification) or multi-user invite systems. A PIN provides practical screen-level privacy with zero login friction on mobile devices.
**Alternatives:** Google OAuth (excessive setup overhead for personal solo apps); HTTP Basic Auth (poor mobile browser UX and inability to customize PIN screen).
