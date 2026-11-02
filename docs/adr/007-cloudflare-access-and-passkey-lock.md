# ADR-007: Cloudflare Access with Google sign-in, and a passkey lock on the phone

**Status:** Accepted
**Date:** 2026-11-02
**Decision:**
- **Cloudflare Access** (Zero Trust, free plan) sits in front of `sinal-verde.souza-pereira-valeria.workers.dev`, with Google as the identity provider and one Allow policy: the owner's e-mail. The Worker also validates the `Cf-Access-Jwt-Assertion` header (signature against the team's certs, `aud` tag in `ACCESS_AUD`), so a request that bypasses Access is refused.
- **Bypass** policies for `/webhooks/pluggy`, `/webhooks/notification` and `/webhooks/telegram`: these paths are authenticated by the Worker instead, each with its own secret (`PLUGGY_WEBHOOK_SECRET` in a custom header set when the Pluggy webhook is registered; `NOTIFICATION_WEBHOOK_SECRET` as `Authorization: Bearer`; Telegram's secret token, ADR-008), compared in constant time.
- **Passkey lock:** on a device where the owner registered a passkey, opening the app asks for it (WebAuthn, platform authenticator, `userVerification: 'required'`: the fingerprint on the phone). Registration stores the credential id and the public key from `AuthenticatorAttestationResponse.getPublicKey()` (SPKI), so the Worker verifies assertions with WebCrypto (ES256) and needs no CBOR parser or npm package. A successful assertion sets the `__Host-sessao` cookie (HttpOnly, Secure, SameSite=Lax) for the unlock period in [spec/acesso.md](../spec/acesso.md).
- **Locally**, without Access, `npm run dev:api` accepts requests when `DEV_ACCESS_EMAIL` is set in `.dev.vars`; production never reads it.
- **Data API** for other apps (phase 4): `/v1/...` behind Access with a service token.

**Why:** The owner asked for Google sign-in and her fingerprint on the phone. Access gives Google sign-in with no OAuth code in the app and protects the API too; a passkey turns the spec's optional PIN into a fingerprint.
**Alternatives:** The template's PIN (ADR-005; the owner preferred the fingerprint); Google OAuth inside the Worker (more code and secrets than Access, same result); a PIN as fallback (left out: Access already guards devices without a passkey).
