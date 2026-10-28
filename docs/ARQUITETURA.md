# Arquitetura

O desenho técnico que o código não mostra sozinho.

- **Entra aqui:** as invariantes (o que precisa ser sempre verdade), o modelo de dados, o fluxo de
  eventos e as migrações.
- **Não entra aqui:** um passeio pelos arquivos (o código mostra), o porquê de cada decisão (`adr/`),
  o que falta construir (`ROADMAP.md`) e as regras de produto (`spec/`).

## Visão geral

- **App:** web app (Vite + React + TypeScript), instalável (PWA). Fala só com a própria origem.
- **Servidor:** um Cloudflare Worker serve os arquivos estáticos do app, a API em `/api`, a conexão
  ao vivo via WebSocket e o cron. Todos os dados pessoais ficam num único Durable Object, `AppObject`,
  com SQLite. Ver ADR-004.
- **Autenticação:** PIN numérico de 4 a 8 dígitos com cookie de sessão `__Host-sessao`. Ver ADR-005.
- **Webhooks:** endpoint `/api/webhook` protegido por Bearer Token (`WEBHOOK_SECRET`) para automações
  externas (MacroDroid, Tasker, iOS Shortcuts, n8n, etc.).

```
app (celular) ──POST /api/query|command──► Worker ──RPC──► AppObject (Durable Object, SQLite)
     ▲                                       ▲                    │
     └──────── WebSocket /api/live ──────────┤                    │ "mudou: items, status…"
                                             │                    ▼
webhook (MacroDroid/cURL) ──POST /api/webhook┘   todos os apps abertos refazem a consulta
                                             │
                                     cron 5 min ──► tick (limpeza de sessões)
```

## Camadas

`domain` ← `application` ← `infrastructure` e `ui`, no app e no servidor.

- `src/domain/`: regras puras (como validação de PIN) e textos da interface (`strings.ts`). O app e o servidor compartilham esse código.
- `src/application/api-contract.ts`: os nomes, entradas e saídas das consultas (`Queries`), comandos (`Commands`) e tópicos de tempo real (`Topic`).
- `server/application/`: os casos de uso do servidor (`AppService`). Síncronos, dependem só das portas `Sql`, `Clock` e `IdGenerator`; os testes rodam sobre `node:sqlite`.
- `server/infrastructure/` e `server/entry/`: Worker, Durable Object, cookies e criptografia.
- A interface chama `Backend` e `LiveUpdates` (portas em `src/application/ports.ts`), nunca a rede direto.

## Invariantes

- Só o servidor grava. O app não tem acesso ao banco; toda escrita é um comando que o `AppObject` confere (sessão ativa, regras de negócio) e grava numa transação atômica.
- Um comando roda sozinho: o Durable Object processa uma chamada por vez de forma síncrona.
- Um comando ou webhook devolve os tópicos (`Topic`) alterados; o `AppObject` avisa todos os clientes conectados via WebSocket, que refazem as consultas desses tópicos.
- Sessões expiram após 180 dias ou são invalidadas no bloqueio manual (`/api/auth/lock`).

## Modelo de dados

| Tabela | Campos principais | Observação |
| --- | --- | --- |
| `settings` | `key` (PK), `value` | Guarda o hash do PIN (`pin_hash`) e preferências do app |
| `sessions` | `token_hash` (PK), `created_at`, `expires_at` | Guarda os hashes dos tokens de sessão; limpas no cron |
| `items` | `id` (PK), `title`, `created_at` | Tabela de exemplo inicial para validação de queries, comandos e webhooks |

## Migrações

`MIGRATIONS` em `server/application/schema.ts` é uma lista numerada; o `AppObject` aplica as pendentes ao iniciar, cada uma em uma transação, e registra em `schema_migrations`.
