// Who is calling (ADR-007). Until the Access JWT check lands, production refuses every API call:
// the template's PIN is gone and nothing else may stand in for it.

export interface AccessEnv {
  readonly DEV_ACCESS_EMAIL?: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The signed-in e-mail, or null when the request must be refused. */
export async function accessEmail(request: Request, env: AccessEnv): Promise<string | null> {
  // Locally there is no Access: DEV_ACCESS_EMAIL stands in, and only on a local host, so a value
  // set by mistake in production is never read.
  const { hostname } = new URL(request.url);
  if (env.DEV_ACCESS_EMAIL && LOCAL_HOSTS.has(hostname)) return env.DEV_ACCESS_EMAIL;
  return null;
}
