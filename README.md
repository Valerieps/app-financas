# Personal App Cloudflare Template

Template para aplicativos web pessoais construídos com Claude Code / Antigravity:
Vite + React + TypeScript no navegador, um Cloudflare Worker único com banco SQLite (Durable Object) no servidor, autenticação simplificada por PIN numérico, porta de entrada nativa para Webhooks externos, atualização instantânea ao vivo via WebSocket (Hibernation API), rotinas agendadas com Cron, testes unitários com Vitest, CI no GitHub Actions e deploy automático pelo Cloudflare Workers Builds.

Para um app local-first sem servidor, use o [claude-web-app-template](https://github.com/Valerieps/claude-web-app-template).  
Para um app colaborativo multi-usuário com Google OAuth e convites, use o [claude-web-app-cloudflare-template](https://github.com/Valerieps/claude-web-app-cloudflare-template).

## Usar o template

1. No GitHub, **Use this template > Create a new repository**.
2. Clone o repositório novo e rode `npm ci`.
3. Abra seu assistente de IA (Claude Code / Antigravity) na pasta e diga **"leia o BOOTSTRAP.md e siga"**.
4. Ele fará uma entrevista rápida sobre o seu app pessoal, configurará as especificações e abrirá o primeiro PR.

## Rodar localmente

```bash
cp .dev.vars.example .dev.vars
```

Gere o `dist/` inicial uma vez (o Worker local precisa dele):

```bash
npm run build
```

Depois, em dois terminais:

```bash
npm run dev:api
```

```bash
npm run dev
```

Abra o endereço indicado pelo Vite, defina seu primeiro PIN numérico e comece a usar!
`npm test` roda os testes; `npm run preview` serve o app exatamente como em produção.

## Webhooks Externos

O template já inclui um endpoint para receber automações externas (MacroDroid, Tasker, iOS Shortcuts, n8n, cURL):

```bash
curl -X POST http://localhost:8787/api/webhook \
  -H "Authorization: Bearer dev-webhook-secret-12345" \
  -H "Content-Type: application/json" \
  -d '{"topic":"item.create","data":{"title":"Nova nota"}}'
```

Ao receber a requisição, o Worker grava a informação no SQLite e avisa os navegadores abertos via WebSocket no mesmo instante.

## Onde está cada coisa

- `CLAUDE.md`: instruções para o assistente de IA e o mapa das docs.
- `docs/SPEC.md` e `docs/spec/`: o que o app faz.
- `docs/ROADMAP.md`: o que falta construir.
- `docs/ARQUITETURA.md` e `docs/adr/`: como o app é construído e por quê.
- `docs/SEGURANCA.md`: as regras de segurança e privacidade.
