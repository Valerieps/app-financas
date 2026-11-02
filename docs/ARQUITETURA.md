# Arquitetura

O desenho técnico que o código não mostra sozinho.

- **Entra aqui:** as invariantes (o que precisa ser sempre verdade), o modelo de dados, o fluxo de
  eventos e as migrações.
- **Não entra aqui:** um passeio pelos arquivos (o código mostra), o porquê de cada decisão (`adr/`),
  o que falta construir (`ROADMAP.md`) e as regras de produto (`spec/`).

O código ainda está no desenho do template (Durable Object, PIN, conexão ao vivo); a troca para o
desenho abaixo é o primeiro item da fase 1 em [ROADMAP.md](ROADMAP.md).

## Visão geral

- **App:** web app (Vite + React + TypeScript), instalável (PWA). Fala só com a própria origem.
- **Servidor:** um Cloudflare Worker serve os arquivos do app, a API em `/api`, os webhooks em
  `/webhooks/*` e o cron. É o único que escreve no banco. Ver ADR-004 e ADR-006.
- **Dados:** tabelas normalizadas no D1; o bruto (cada resposta do Pluggy e cada webhook, em JSON) no
  R2. Ver ADR-006.
- **Acesso:** Cloudflare Access com login Google na frente de tudo, menos os webhooks; trava por
  passkey no celular. Ver ADR-007.
- **Serviços externos:** Pluggy, Telegram e Gemini, só a partir do Worker. Ver ADR-008.

```
Pluggy ──webhook──► /webhooks/pluggy ───────┐
MacroDroid ──POST─► /webhooks/notification ─┼─► Worker ──1. bruto──► R2
Telegram ──update─► /webhooks/telegram ─────┘     │
                                                   ├──2. normaliza──► D1
cron ──► varredura diária, retratos, reprocessa ───┤
                                                   ├──► Telegram (alertas)
app (celular) ──Access──► /api/query|command ──────┘
outros apps ──Access + token──► /v1/... (fase 4)
espelho noturno (desktop) ◄── wrangler d1 export + sync do R2
```

## Camadas

`domain` ← `application` ← `infrastructure` e `ui`, no app e no servidor.

- `src/domain/`: regras puras (Livre do dia, semáforo, casamento, normalização) e textos da interface (`strings.ts`). O app e o servidor compartilham esse código.
- `src/application/api-contract.ts`: os nomes, entradas e saídas das consultas (`Queries`) e comandos (`Commands`).
- `server/application/`: os casos de uso do servidor, sobre as portas `Sql`, `Clock`, `IdGenerator`, `RawStore` e o cliente do Pluggy; os testes rodam sobre `node:sqlite` e fixtures anonimizadas do Pluggy.
- `server/infrastructure/` e `server/entry/`: Worker, D1, R2, Access, passkey e criptografia.
- A interface chama `Backend` (porta em `src/application/ports.ts`), nunca a rede direto.

## Invariantes

- Só o Worker grava. O app e os outros apps não têm acesso ao banco; toda escrita passa pela API.
- **Bruto primeiro:** nenhum dado do Pluggy ou de webhook é normalizado antes de estar no R2 com uma
  linha em `raw_payloads`.
- **Webhook responde em menos de 1 segundo:** grava o bruto e o evento, devolve 2xx e processa em
  `waitUntil`. Evento sem `processed_at` é reprocessado pelo cron.
- **Idempotência:** `webhook_events.event_id` é único; um evento repetido não tem efeito.
- **Re-buscar, não deduzir:** um evento de transação dispara uma releitura da conta pela API.
- **Nada é apagado:** exclusão é `deleted_at`; mudança gera uma linha em `transaction_versions`.
- **Id próprio:** `transactions.id` é do app. A ligação com o Pluggy é pelo `providerId`; na falta,
  por data + valor + descrição. O `pluggy_id` muda quando o cartão recria a transação.
- **Decisões separadas:** `user_overrides`, `classification_rules` e `category_bucket_map` nunca são
  tocadas pela sincronização.
- Valores em centavos (inteiro), sempre com a moeda; datas em UTC, convertidas para
  `America/Sao_Paulo` só na exibição e na virada do dia.
- Toda tabela que espelha a API tem `raw_json`, `first_seen_at` e `last_seen_at`.

## Modelo de dados

Coleta (fase 1):

| Tabela | Uma linha por | Campos principais |
| --- | --- | --- |
| `raw_payloads` | resposta da API ou webhook | origem, endpoint, `received_at`, chave no R2, hash |
| `webhook_events` | evento recebido | `event_id` (único), tipo, `item_id`, `processed_at` |
| `sync_runs` | execução de sincronização | `item_id`, início, fim, contagens, erro |
| `items` | conexão | `item_id`, instituição, status, `consent_expires_at`, último sync |
| `consents` | consentimento | produtos, permissões, criado, expira, revogado |
| `item_resources` | produto por conexão | produto, disponível |
| `accounts` | conta | tipo, subtipo, número mascarado, moeda, limite |
| `account_balance_snapshots` | conta por dia | saldo, limite disponível, data |
| `transactions` | transação definitiva | `id` próprio, `pluggy_id`, `provider_id`, `provider_code`, data, valor, moeda, valor em reais, status, tipo, `operation_type`, descrição, conta, fatura, `deleted_at` |
| `transaction_versions` | mudança numa transação | transação, versão anterior em JSON, `changed_at` |
| `transaction_payment_data` | transação com pagamento | pagador e recebedor (nome, documento, banco), método, motivo, boleto |
| `transaction_card_data` | transação de cartão | parcela n/total, valor total, data da compra, MCC, final do cartão |
| `bills` | fatura | conta, fechamento, vencimento, valor, mínimo |
| `investments` | investimento | tipo, subtipo, nome, saldo, rentabilidade |
| `investment_snapshots` | investimento por dia | saldo, valor bruto e líquido |
| `investment_transactions` | aplicação ou resgate | investimento, data, valor, tipo |
| `loans` | contrato | taxa, parcelas, saldo devedor |
| `identity` | versão dos dados cadastrais | `collected_at` |
| `scr_reports` | consulta ao SCR | `item_id`, `collected_at` |

Acesso (fase 1): `passkeys` (id da credencial, chave pública SPKI, criada, último uso) e `sessions`
(hash do token, `created_at`, `expires_at`).

Classificação, orçamento e decisões (fases 2 a 4):

| Tabela | Uma linha por | Campos principais |
| --- | --- | --- |
| `settings` | (única) | renda líquida, meta de reserva, teto de impulso, chat do Telegram, janela de casamento |
| `fixed_expenses` | custo fixo | nome, valor, dia de vencimento, ativo |
| `provisional_expenses` | notificação capturada | fonte, texto bruto, valor, estabelecimento, `received_at`, transação casada, status |
| `categories` | categoria | nome, pai, id do Pluggy de origem |
| `value_buckets` | caixinha | nome, conta no orçamento, ordem |
| `category_bucket_map` | ligação categoria → caixinha | categoria, caixinha, vigente de/até |
| `classification_rules` | regra | condição (estabelecimento, pagador, `operation_type`), categoria e/ou caixinha |
| `user_overrides` | decisão sobre uma transação | categoria, caixinha, reembolsável (%), nota |
| `reimbursements` | reembolso ↔ gasto | gasto, reembolso, valor coberto |

O mapa categoria → caixinha tem vigência para que mudar o mapa hoje não reescreva meses fechados.
No código e no banco, caixinha é `bucket` (`value_buckets`).

## Migrações

Arquivos SQL numerados em `migrations/`, aplicados com `wrangler d1 migrations apply` (ADR-006). Um
arquivo já aplicado em produção nunca é editado: a mudança vai no próximo número.
