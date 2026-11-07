# Telegram

O feedback chega no Telegram segundos depois da compra, ligando o gasto ao que sobra no dia.

- **Entra aqui:** a resposta a cada gasto, os comandos e os alertas que o bot manda sozinho.
- **Não entra aqui:** o cálculo do Livre do dia (`livre-do-dia.md`) e os avisos de renovação das
  conexões (`cofre-de-dados.md`).

## Em aberto

(Nenhuma pergunta em aberto)

## Resposta a cada gasto

- Quando um gasto chega, o bot me responde em menos de 3 segundos com o valor, o estabelecimento, a
  categoria, a importância, o Livre de hoje com a cor do semáforo e o termômetro de impulso. *(3)*
  Exemplo: **R$ 38,50** no **iFood** · Restaurante · importância Impulso. **R$ 71,50** livres para hoje
  (verde). Impulso no mês: R$ 320 / R$ 500.
- A resposta tem os botões "Mudar importância" e "Ver semáforo". O botão mexe só na importância, não na
  categoria. *(3)*

## Comandos

| Comando | Resposta |
| --- | --- |
| `/hoje` | O Livre de hoje e o semáforo *(3)* |
| `/gastei 25 Padaria` | Registra um gasto em dinheiro vivo *(3)* |
| `/resumo` | A semana e a projeção do mês *(3)* |
| `/saldo` | Os saldos das contas *(3)* |
| `/fatura` | A fatura atual e a próxima *(4)* |
| `/conexoes` | A saúde das conexões e os dias até a renovação *(4)* |

## Alertas que o bot manda sozinho

- Nenhuma notificação do celular em 48 horas enquanto o Pluggy mostra gastos. *(3)*
  Por quê: mudanças no Android ou no app do banco quebram o MacroDroid em silêncio.
- Gastos provisórios órfãos para revisar. *(3)*
- A renovação da autorização e as conexões com erro (`cofre-de-dados.md`). *(4)*
- CPF, números de conta e dados cadastrais nunca aparecem no Telegram. *(3)*
