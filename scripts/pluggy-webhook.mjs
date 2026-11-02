// Registers (or updates) the Pluggy webhook that points to the Worker's /webhooks/pluggy, with the
// secret header the Worker checks (ADR-007, ADR-008). Pluggy accepts custom headers only through
// its API, so this runs once from the owner's computer:
//
//   node scripts/pluggy-webhook.mjs https://sinal-verde.souza-pereira-valeria.workers.dev
//
// Reads PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET and PLUGGY_WEBHOOK_SECRET from .dev.vars; the same
// PLUGGY_WEBHOOK_SECRET must be set in the Worker (`npx wrangler secret put PLUGGY_WEBHOOK_SECRET`).
import { readFileSync } from 'node:fs';

const API = 'https://api.pluggy.ai';
const HEADER = 'X-Webhook-Secret';

const origin = process.argv[2];
if (!origin || !/^https:\/\/[^/]+$/.test(origin)) {
  console.error('Uso: node scripts/pluggy-webhook.mjs https://<o-endereço-do-app>');
  process.exit(1);
}

const vars = Object.fromEntries(
  readFileSync('.dev.vars', 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]),
);
for (const name of ['PLUGGY_CLIENT_ID', 'PLUGGY_CLIENT_SECRET', 'PLUGGY_WEBHOOK_SECRET']) {
  if (!vars[name]) {
    console.error(`Falta ${name} no .dev.vars`);
    process.exit(1);
  }
}

async function call(method, path, body, apiKey) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'X-API-KEY': apiKey } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  return response.json();
}

const { apiKey } = await call('POST', '/auth', { clientId: vars.PLUGGY_CLIENT_ID, clientSecret: vars.PLUGGY_CLIENT_SECRET });
const url = `${origin}/webhooks/pluggy`;
const webhook = { url, event: 'all', headers: { [HEADER]: vars.PLUGGY_WEBHOOK_SECRET } };

const { results = [] } = await call('GET', '/webhooks', null, apiKey);
const existing = results.find((hook) => hook.url === url);
if (existing) {
  await call('PATCH', `/webhooks/${existing.id}`, webhook, apiKey);
  console.log(`Webhook atualizado: ${url}`);
} else {
  await call('POST', '/webhooks', webhook, apiKey);
  console.log(`Webhook cadastrado: ${url}`);
}
