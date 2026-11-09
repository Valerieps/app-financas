# Arquitetura

O desenho técnico que o código não mostra sozinho.

- **Entra aqui:** as invariantes (o que precisa ser sempre verdade), o modelo de dados, o fluxo de
  eventos e as migrações.
- **Não entra aqui:** um passeio pelos arquivos (o código mostra), o porquê de cada decisão (`adr/`),
  o que falta construir (`ROADMAP.md`) e as regras de produto (`spec/`).

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
  A notificação do MacroDroid é a exceção: ler o texto não chama ninguém de fora, então o gasto
  provisório entra no mesmo `batch` da linha de `raw_payloads`, antes da resposta.
- **Idempotência:** `webhook_events.event_id` é único; um evento repetido não tem efeito.
- **Re-buscar, não deduzir:** um evento de transação dispara uma releitura da conta pela API (os
  últimos 40 dias, mais as criadas desde `transactionsCreatedAtFrom`); `item/updated` relê a conexão
  inteira. O cron tenta de novo um evento que falhou, até 5 vezes.
- **Uma leitura vazia ou de uma conexão em erro não apaga nada:** só uma lista completa, de uma
  conexão com status `UPDATED`, marca como apagado o que sumiu.
- **Nada é apagado:** exclusão é `deleted_at`; mudança gera uma linha em `transaction_versions`.
- **Id próprio:** `transactions.id` é do app. A ligação com o Pluggy é pelo `providerId`; na falta,
  por data + valor + descrição + posição entre as idênticas do dia (`match_key`). O `pluggy_id` muda
  quando o cartão recria a transação. Contas de uma conexão renovada são ligadas às da antiga por
  tipo + subtipo + final do número; faturas, investimentos e empréstimos da conexão nova começam
  registros novos.
- **Decisões separadas:** `user_overrides`, `classification_rules` e `category_importance_map` nunca são
  tocadas pela sincronização.
- **Só a coleta grava o cofre:** as tabelas que guardam o que o Pluggy devolveu (do `raw_payloads`
  ao `pluggy_categories` na tabela abaixo) só são escritas pelo código de
  `server/application/collect/`. Ajustes manuais, categorias e importâncias vão para tabelas próprias,
  nunca editam o cofre. O `server/application/vault-writes.test.ts` confere isso em todo build e
  obriga cada tabela nova a ser classificada como cofre ou não.
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
| `items` | conexão | `item_id`, instituição, status, `consent_expires_at`, último sync, `replaced_by` (a conexão que a substituiu ao renovar) |
| `consents` | consentimento | produtos, permissões, criado, expira, revogado |
| `item_resources` | produto por conexão | produto, disponível, motivo |
| `accounts` | conta | `id` próprio, `pluggy_id`, tipo, subtipo, final do número, moeda, limite |
| `account_balance_snapshots` | conta por dia | saldo, limite disponível, data |
| `transactions` | transação definitiva | `id` próprio, `pluggy_id`, `provider_id`, `provider_code`, data, valor, moeda, valor em reais, status, tipo, `operation_type`, descrição, conta, fatura, `card_payment` (pagamento de cartão, decidido a cada escrita pela coleta), `deleted_at` |
| `transaction_versions` | mudança numa transação | transação, versão anterior em JSON, `changed_at` |
| `transaction_payment_data` | transação com pagamento | pagador e recebedor (nome, documento, banco), método, motivo, boleto |
| `transaction_card_data` | transação de cartão | parcela n/total, valor total, data da compra, MCC, final do cartão |
| `bills` | fatura | conta, fechamento, vencimento, valor, mínimo |
| `investments` | investimento | tipo, subtipo, nome, saldo, rentabilidade |
| `investment_snapshots` | investimento por dia | saldo, valor bruto e líquido |
| `investment_transactions` | aplicação ou resgate | investimento, data, valor, tipo |
| `loans` | contrato | taxa, parcelas, saldo devedor |
| `identity` | versão dos dados cadastrais | hash, `collected_at`; linha nova só quando muda |
| `scr_reports` | consulta ao SCR | `item_id`, `collected_at` |
| `record_versions` | mudança em conta, fatura, investimento, empréstimo ou consentimento | tabela, registro, versão anterior em JSON, `changed_at` |
| `pluggy_categories` | categoria do Pluggy | descrição, pai |
| `job_runs` | tarefa do cron | última execução |
| `confirmed_empty_days` | conta e dia sem transação que eu confirmei | conta, dia em Brasília, `confirmed_at` |

Acesso (fase 1): `passkeys` (id da credencial, chave pública SPKI, contador de assinaturas, hash do
token do aparelho, criada, último uso), `webauthn_challenges` (desafio de uso único, validade) e
`sessions` (hash do token, passkey, `created_at`, `expires_at`).

Classificação, orçamento e decisões (fases 2 a 4):

| Tabela | Uma linha por | Campos principais |
| --- | --- | --- |
| `settings` | (única) | renda líquida, meta de reserva, teto de impulso, chat do Telegram, janela de casamento |
| `fixed_expenses` | custo fixo | nome, valor, dia de vencimento, ativo |
| `provisional_expenses` | notificação de gasto (compra ou Pix enviado) | fonte, app, título e texto, tipo, valor, moeda, estabelecimento, `posted_at`, `received_at`, bruto, status (`provisional`, `unreadable`), transação casada |
| `tag_layers` | camada de tags | nome, posição (até 5 camadas, conferido pelo app) |
| `tags` | tag | camada, nome |
| `transaction_tags` | tag num lançamento | transação, camada, tag; a chave (transação, camada) garante uma tag por camada |
| `transaction_categories` | categoria que eu escolhi num lançamento | transação, categoria do Pluggy; vale por cima de `transactions.pluggy_category_id` e de `card_payment` nas leituras (`server/application/category-choice.ts`) |
| `transaction_descriptions` | lançamento cuja descrição as regras trocaram | transação, descrição trocada (nula se as regras apagaram tudo); vale por cima de `transactions.description` nas leituras. Derivada das regras: toda escrita que pode mudá-la (regra, categoria escolhida, coleta) a regrava no mesmo `batch`, e o cron refaz todas uma vez por dia (`server/application/descriptions.ts`, ADR-009) |
| `categories` | categoria | nome, pai, id do Pluggy de origem |
| `importance_levels` | importância | nome, conta no orçamento, ordem |
| `category_importance_map` | ligação categoria → importância | categoria, importância, vigente de/até |
| `rules` | regra automática | posição, como as condições se juntam (`condition_match`: todas ou qualquer uma), condições e ações em JSON (ADR-009) |
| `user_overrides` | decisão sobre uma transação | importância, reembolsável (%), nota (a categoria fica em `transaction_categories`) |
| `reimbursements` | reembolso ↔ gasto | gasto, reembolso, valor coberto |

O mapa categoria → importância tem vigência para que mudar o mapa hoje não reescreva meses fechados.
No código e no banco, importância é `importance` (`importance_levels`).

## Migrações

Arquivos SQL numerados em `migrations/`, aplicados com `wrangler d1 migrations apply` (ADR-006) antes
de cada deploy e de `npm run dev:api`; os testes aplicam os mesmos arquivos no `node:sqlite`. Um
arquivo já aplicado em produção nunca é editado: a mudança vai no próximo número.

O D1 não tem transação interativa: um caso de uso lê, decide e manda todas as escritas que precisam
cair juntas num único `batch` da porta `Sql`.
