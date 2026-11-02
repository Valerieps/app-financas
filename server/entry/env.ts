/** Bindings and settings from wrangler.jsonc; secrets are set with `wrangler secret put`. */
export interface Env {
  readonly ASSETS: Fetcher;
  readonly DB: D1Database;
  readonly RAW: R2Bucket;
  /** Local development only: stands in for Cloudflare Access (ADR-007). */
  readonly DEV_ACCESS_EMAIL?: string;
}
