// The RawStore port over R2 (ADR-006): the raw archive, one JSON object per payload.
import type { RawStore } from '../application/ports';

export function r2RawStore(bucket: R2Bucket): RawStore {
  return {
    put: async (key, body) => {
      await bucket.put(key, body, { httpMetadata: { contentType: 'application/json' } });
    },
    get: async (key) => (await bucket.get(key))?.text() ?? null,
  };
}
