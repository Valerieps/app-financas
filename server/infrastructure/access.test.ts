import { describe, expect, it } from 'vitest';
import { accessEmail } from './access';

const request = (url: string) => new Request(url, { method: 'POST' });

describe('accessEmail', () => {
  it('accepts DEV_ACCESS_EMAIL on a local host', async () => {
    expect(await accessEmail(request('http://localhost:8787/api/query/vault'), { DEV_ACCESS_EMAIL: 'me@example.com' })).toBe('me@example.com');
    expect(await accessEmail(request('http://127.0.0.1:8787/api/query/vault'), { DEV_ACCESS_EMAIL: 'me@example.com' })).toBe('me@example.com');
  });

  it('never reads DEV_ACCESS_EMAIL on a public host', async () => {
    const url = 'https://sinal-verde.souza-pereira-valeria.workers.dev/api/query/vault';
    expect(await accessEmail(request(url), { DEV_ACCESS_EMAIL: 'me@example.com' })).toBeNull();
  });

  it('refuses everything without it', async () => {
    expect(await accessEmail(request('http://localhost:8787/api/query/vault'), {})).toBeNull();
  });
});
