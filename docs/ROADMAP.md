# Roadmap

O que ainda não está pronto.

- **Entra aqui:** o que falta construir, onde o código ainda não segue o spec, o que foi adiado de
  propósito e as lacunas do spec que o agente decidiu sozinho.
- **Não entra aqui:** o que já está pronto (quando uma linha fica pronta, ela sai daqui; o git e as
  issues fechadas guardam o histórico), bugs e débito técnico (issues do GitHub) e as regras (`spec/`).

## Falta construir

| Feature | Fase | Spec | Observação |
| --- | --- | --- | --- |
| Casamento e órfãos | 2 | `spec/gastos-provisorios.md` | |
| Categoria, importância, regras e Gemini | 2 | `spec/classificacao.md` | |
| Gráficos por importância | 2 | `spec/graficos.md` | Depende da importância; a aba mostra "Em construção" |
| Livre do dia, semáforo e termômetro | 3 | `spec/livre-do-dia.md` | |
| Bot do Telegram | 3 | `spec/telegram.md` | |
| Tela do semáforo | 3 | `spec/tela-do-celular.md` | |
| Faturas e parcelas futuras | 4 | `spec/cartao-de-credito.md` | |
| Reembolsos | 4 | `spec/classificacao.md` | |
| Avisos de renovação e de erro nas conexões | 4 | `spec/cofre-de-dados.md` | |
| Holerite e conferência do líquido | 4 | `spec/holerite.md` | Responder o "Em aberto" antes de construir |
| Exportação e API de dados | 4 | `spec/exportacao-e-api.md` | |
| Wise e várias moedas | 5 | `spec/cofre-de-dados.md` | |

## O código ainda não segue o spec

(Nada: o código segue o spec da fase 1)

## Adiado

- Uma tela própria para os investimentos, com mais detalhes de cada um; por enquanto o Cofre mostra
  só o nome, o CNPJ e o saldo de hoje (`spec/cofre-de-dados.md`).

- Os lançamentos de ações do holerite ligados à emissão do Carnê-leão; por enquanto o app só guarda
  esses lançamentos com o tipo Ações (`spec/holerite.md`).

## Revisar as lacunas que o agente decidiu

- [ ] O app pede a digital quando é aberto e a última vez foi há mais de 1 hora (`spec/acesso.md`).
- [ ] Num aparelho sem digital cadastrada, o login Google basta (`spec/acesso.md`).
- [ ] O `/gastei` vale a partir da fase 3, junto com o bot (`spec/gastos-provisorios.md`).
- [ ] A mesma notificação repetida em até 2 minutos conta uma vez (`spec/gastos-provisorios.md`).
- [ ] Os nomes das categorias e como a árvore do Pluggy se agrupa nelas (`spec/graficos.md`).
- [ ] Nos gráficos, uma diferença menor que R$ 10 e menor que 10% aparece como "igual" (`spec/graficos.md`).
- [ ] A média conta só os meses que têm algum gasto (`spec/graficos.md`).
- [ ] Uma conexão substituída fica de fora dos gráficos, e os gastos provisórios ainda não entram (`spec/graficos.md`).
