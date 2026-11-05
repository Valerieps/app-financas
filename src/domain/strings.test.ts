import { describe, expect, it } from 'vitest';
import { strings } from './strings';

describe('cofre.add messages', () => {
  // The Cofre form shows strings.cofre.add[error]; a missing key falls back to the generic error.
  it('has a message for every error connection.add can return', () => {
    const add: Record<string, string> = strings.cofre.add;
    for (const code of ['invalid', 'not_found', 'conflict', 'unavailable']) {
      expect(add[code], code).toBeTypeOf('string');
    }
  });
});
