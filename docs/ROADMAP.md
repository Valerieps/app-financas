# Roadmap

O que ainda não está pronto.

- **Entra aqui:** o que falta construir, onde o código ainda não segue o spec, o que foi adiado de
  propósito e as lacunas do spec que o agente decidiu sozinho.
- **Não entra aqui:** o que já está pronto (quando uma linha fica pronta, ela sai daqui; o git e as
  issues fechadas guardam o histórico), bugs e débito técnico (issues do GitHub) e as regras (`spec/`).

## Falta construir

| Feature | Fase | Spec | Observação |
| --- | --- | --- | --- |
| Login Google (Cloudflare Access) e digital | 1 | `spec/acesso.md` | ADR-007; substitui o PIN do template |
| Cliente do Pluggy | 1 | `spec/cofre-de-dados.md` | API key sob demanda, páginas de 500, nova tentativa após 429 (ADR-008) |
| Carga inicial e cadastro de conexões | 1 | `spec/cofre-de-dados.md` | |
| Webhooks do Pluggy | 1 | `spec/cofre-de-dados.md` | Responder 2xx na hora, processar depois; idempotência por `eventId` |
| Varredura diária e retratos do dia | 1 | `spec/cofre-de-dados.md` | |
| Espelho noturno no desktop | 1 | `spec/cofre-de-dados.md` | Script de `wrangler d1 export` + sync do R2 |
| Tela Cofre | 1 | `spec/cofre-de-dados.md` | Substitui a tela de exemplo do template |
| Notificações do MacroDroid e gastos provisórios | 2 | `spec/gastos-provisorios.md` | |
| Casamento e órfãos | 2 | `spec/gastos-provisorios.md` | |
| Categoria, caixinha, regras e Gemini | 2 | `spec/classificacao.md` | |
| Livre do dia, semáforo e termômetro | 3 | `spec/livre-do-dia.md` | |
| Bot do Telegram | 3 | `spec/telegram.md` | |
| Tela do semáforo | 3 | `spec/tela-do-celular.md` | |
| Faturas e parcelas futuras | 4 | `spec/cartao-de-credito.md` | |
| Reembolsos | 4 | `spec/classificacao.md` | |
| Avisos de renovação e de erro nas conexões | 4 | `spec/cofre-de-dados.md` | |
| Exportação e API de dados | 4 | `spec/exportacao-e-api.md` | |
| Wise e várias moedas | 5 | `spec/cofre-de-dados.md` | |

## O código ainda não segue o spec

- Acesso (`spec/acesso.md`) — o código ainda não confere o JWT do Access; até conferir, a API em
  produção recusa tudo e só responde localmente, com `DEV_ACCESS_EMAIL`.
- Tela Cofre — por enquanto só mostra quantas conexões existem.

## Adiado

- A origem dos certificados do Cloudflare Access em `SERVER_ORIGINS` — até a dona criar o time do Zero Trust (ADR-008).

## Revisar as lacunas que o agente decidiu

- [ ] O app pede a digital quando é aberto e a última vez foi há mais de 1 hora (`spec/acesso.md`).
- [ ] Num aparelho sem digital cadastrada, o login Google basta (`spec/acesso.md`).
- [ ] O `/gastei` vale a partir da fase 3, junto com o bot (`spec/gastos-provisorios.md`).
