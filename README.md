# Sinal Verde

O meu app pessoal de finanças: quanto posso gastar hoje, sem culpa. O Pluggy e as notificações do
celular registram os gastos sozinhos, o Telegram responde segundos depois de cada compra com o Livre
do dia e o semáforo, e todos os meus dados financeiros ficam guardados para sempre.

Um Cloudflare Worker (Vite + React + TypeScript no navegador), D1 e R2, Cloudflare Access com login
Google, testes com Vitest, CI no GitHub Actions e deploy pelo Cloudflare Workers Builds.

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

`npm test` roda os testes; `npm run preview` serve o app exatamente como em produção.

## Onde está cada coisa

- `CLAUDE.md`: instruções para o assistente de IA e o mapa das docs.
- `docs/SPEC.md` e `docs/spec/`: o que o app faz.
- `docs/ROADMAP.md`: o que falta construir.
- `docs/ARQUITETURA.md` e `docs/adr/`: como o app é construído e por quê.
- `docs/SEGURANCA.md`: as regras de segurança e privacidade.
