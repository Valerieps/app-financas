export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 8;

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin.trim());
}

export function normalizePin(pin: string): string {
  return pin.trim();
}
