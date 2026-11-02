// The nightly mirror (docs/spec/cofre-de-dados.md, ADR-006): a full copy of the vault on the
// owner's computer, plus an encrypted copy on her Google Drive. Runs on her Windows desktop, from
// the Task Scheduler, at 23:30:
//
//   node scripts/espelho.mjs [folder]          (default: Documents\SinalVerde-espelho)
//
// It needs, on that computer:
// - `npx wrangler login` done once (the D1 export uses her Cloudflare login);
// - rclone (https://rclone.org), with two remotes created by `rclone config`:
//   - `sinal-verde-r2`: type "s3", provider "Cloudflare", with an R2 API token (read only);
//   - `sinal-verde-cofre`: type "crypt" over a Google Drive folder (both passwords kept apart).
//   Other names go in SINAL_VERDE_R2_REMOTE and SINAL_VERDE_CRYPT_REMOTE.
//
// Nothing here ever deletes from Cloudflare. Locally it keeps the last 30 D1 exports; the raw
// archive and the encrypted copy only grow (`rclone copy`, never `sync`).
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const KEEP_EXPORTS = 30;
const folder = process.argv[2] ?? join(homedir(), 'Documents', 'SinalVerde-espelho');
const r2Remote = process.env.SINAL_VERDE_R2_REMOTE ?? 'sinal-verde-r2';
const cryptRemote = process.env.SINAL_VERDE_CRYPT_REMOTE ?? 'sinal-verde-cofre';
const exportsDir = join(folder, 'd1');
const rawDir = join(folder, 'r2');
const log = join(folder, 'espelho.log');

mkdirSync(exportsDir, { recursive: true });
mkdirSync(rawDir, { recursive: true });

function note(message) {
  appendFileSync(log, `${new Date().toISOString()} ${message}\n`);
  console.log(message);
}

function run(command, args) {
  // shell: true lets Windows find npx.cmd and rclone.exe on the PATH; no argument comes from outside.
  execFileSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
}

try {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const file = join(exportsDir, `sinal-verde-${stamp}.sql`);
  run('npx', ['wrangler', 'd1', 'export', 'sinal-verde', '--remote', '--output', `"${file}"`]);
  note(`D1 exportado: ${file}`);

  for (const old of readdirSync(exportsDir).filter((name) => name.endsWith('.sql')).sort().slice(0, -KEEP_EXPORTS)) {
    rmSync(join(exportsDir, old));
  }

  run('rclone', ['copy', `${r2Remote}:sinal-verde-raw`, `"${rawDir}"`]);
  note('R2 copiado');

  run('rclone', ['copy', `"${folder}"`, `${cryptRemote}:`, '--exclude', 'espelho.log']);
  note('Cópia criptografada enviada');
} catch (error) {
  note(`FALHOU: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
