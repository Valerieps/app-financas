/** Bindings and settings from wrangler.jsonc; secrets are set with `wrangler secret put`. */
export interface Env {
  readonly ASSETS: Fetcher;
  readonly DB: D1Database;
  readonly RAW: R2Bucket;
  /** The Access application's audience tag (ADR-007). */
  readonly ACCESS_AUD?: string;
  /** Secret: the only e-mail allowed in. */
  readonly OWNER_EMAIL?: string;
  /** Secrets: Pluggy's application credentials and the header the Pluggy webhook carries (ADR-008). */
  readonly PLUGGY_CLIENT_ID?: string;
  readonly PLUGGY_CLIENT_SECRET?: string;
  readonly PLUGGY_WEBHOOK_SECRET?: string;
  /** Local development only: stands in for Cloudflare Access (ADR-007). */
  readonly DEV_ACCESS_EMAIL?: string;
}
