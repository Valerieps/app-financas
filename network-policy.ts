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

/** The only external servers the Worker (server/) calls: Pluggy, Telegram and Gemini (ADR-008). */
export const SERVER_ORIGINS: readonly string[] = [
  'https://api.pluggy.ai',
  'https://api.telegram.org',
  'https://generativelanguage.googleapis.com',
];
