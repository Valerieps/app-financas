import type { AppObject } from './app-object';

/** Bindings and settings from wrangler.jsonc; secrets are set with `wrangler secret put`. */
export interface Env {
  readonly ASSETS: Fetcher;
  readonly APP_STORAGE: DurableObjectNamespace<AppObject>;
  readonly WEBHOOK_SECRET?: string;
  readonly APP_PIN?: string;
}
