// Cookies the Worker sets. `__Host-` pins them to this origin, HTTPS and path /;
// HttpOnly keeps them away from scripts. Lax lets the Access redirect bring them back.

/** The unlocked session; the server ends it an hour after the last use (docs/spec/acesso.md). */
export const SESSION_COOKIE = '__Host-sessao';
/** Marks a device that registered a passkey, so the API asks it to unlock (ADR-007). */
export const DEVICE_COOKIE = '__Host-aparelho';

export const SESSION_COOKIE_SECONDS = 24 * 60 * 60;
/** The longest browsers keep a cookie. */
export const DEVICE_COOKIE_SECONDS = 400 * 24 * 60 * 60;

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(name: string): string {
  return setCookie(name, '', 0);
}
