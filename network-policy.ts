/**
 * The one place that says which servers the app and its server may talk to (docs/SEGURANCA.md).
 *
 * The app (browser) talks to its own origin only: the Worker serves the files and the API under
 * /api, so the production CSP has `connect-src 'self'` plus ALLOWED_ORIGINS.
 * Requests may only be made from src/infrastructure/; src/security.test.ts checks it.
 */
export const ALLOWED_ORIGINS: readonly string[] = [];

/** Where images may load from (CSP `img-src`). */
export const IMAGE_ORIGINS: readonly string[] = [];

/** The Cloudflare Access team, whose certs sign the Access JWT the Worker checks (ADR-007). */
export const ACCESS_TEAM_ORIGIN = 'https://vesper-apps.cloudflareaccess.com';

/** The only external servers the Worker (server/) calls: Pluggy, Telegram, Gemini and Access (ADR-008). */
export const SERVER_ORIGINS: readonly string[] = [
  'https://api.pluggy.ai',
  'https://api.telegram.org',
  'https://generativelanguage.googleapis.com',
  ACCESS_TEAM_ORIGIN,
];
