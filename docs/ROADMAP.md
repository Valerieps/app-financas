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
| Lançamentos: filtros por categoria, importância, caixinha, valor e texto; outras ações em lote; novo lançamento manual | 2 | `spec/lancamentos.md`, `rascunhos/arquitetura-desktop.md` | Responder o "Em aberto" de `spec/lancamentos.md` |
| Tags no painel de detalhe | 2 | `spec/categorias.md` | Marcar em lote, filtrar, a coluna Tags e o gráfico por tag já existem; responder o "Em aberto" de `spec/categorias.md` |
| Categoria, importância, regras e Gemini | 2 | `spec/classificacao.md` | Mudar a categoria de um lançamento (da árvore do Pluggy), à mão ou por regra, já existe; falta a lista própria de categorias, a importância, regras que mudam a importância, a oferta de criar regra e o Gemini |
| Regras automáticas: outras condições e ações | 2 | `spec/regras-automaticas.md` | "Descrição contém", "o tipo é", "quem pagou contém" e "a operação contém" → "aplique as tags", "substitua na descrição" e "mude a categoria" já existem; responder o "Em aberto". O botão Testar ainda não mostra a categoria que a regra poria || Gráficos por importância | 2 | `spec/graficos.md` | Depende da importância; a aba mostra "Em construção" |
| Livre do dia, semáforo e termômetro | 3 | `spec/livre-do-dia.md` | |
| Bot do Telegram | 3 | `spec/telegram.md` | |
| Tela do semáforo | 3 | `spec/tela-do-celular.md` | |
| Parcelas futuras | 4 | `spec/cartao-de-credito.md` | A tela Cartão já mostra as faturas e os pagamentos; responder o "Em aberto" de `spec/cartao-de-credito.md` |
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

- [ ] Uma fatura só recebe pagamentos da primeira compra dela até o vencimento da seguinte; a fatura
  aberta são as compras sem fatura depois da última fechada; o período é da primeira à última
  compra (`spec/cartao-de-credito.md`).
- [ ] Em Lançamentos, a descrição e o valor não se ocultam; as colunas Tipo, Operação e Quem pagou
  começam ocultas e não ordenam a tabela; Quem pagou mostra o nome do banco também nas saídas; a
  escolha de colunas fica no aparelho (`spec/lancamentos.md`).
- [ ] O app pede a digital quando é aberto e a última vez foi há mais de 1 hora (`spec/acesso.md`).
- [ ] Num aparelho sem digital cadastrada, o login Google basta (`spec/acesso.md`).
- [ ] O `/gastei` vale a partir da fase 3, junto com o bot (`spec/gastos-provisorios.md`).
- [ ] A mesma notificação repetida em até 2 minutos conta uma vez (`spec/gastos-provisorios.md`).
- [ ] Os nomes das categorias e como a árvore do Pluggy se agrupa nelas (`spec/graficos.md`).
- [ ] Nos gráficos, uma diferença menor que R$ 10 e menor que 10% aparece como "igual" (`spec/graficos.md`).
- [ ] A média conta só os meses que têm algum gasto (`spec/graficos.md`).
- [ ] Nas regras, transferência é a categoria do grupo Transferências do Pluggy (04 e 05) ou um
  pagamento de fatura; o resto é entrada ou saída pelo sentido (`spec/regras-automaticas.md`).
- [ ] A substituição na descrição fica guardada ao lado da descrição do banco, sem mexer nela, para
  todos os lançamentos; as condições olham sempre a descrição do banco; o pedaço é achado sem
  maiúsculas nem acentos e trocado todas as vezes; o detalhe mostra a descrição do banco
  (`spec/regras-automaticas.md`).
- [ ] Uma regra que muda a categoria grava como se eu a tivesse escolhido, só onde não há escolha,
  a de cima vence, e excluir a regra não desfaz; "quem pagou" só casa com entradas
  (`spec/regras-automaticas.md`).
- [ ] O nome de uma camada ou tag tem até 40 caracteres, e maiúsculas e acentos não distinguem nomes (`spec/categorias.md`).
- [ ] As tags aparecem em ordem alfabética, e as camadas sobem e descem uma posição por vez (`spec/categorias.md`).
- [ ] Excluir uma tag ou camada tira as tags dos lançamentos, depois de uma confirmação (`spec/categorias.md`).
- [ ] O formulário de tags em lote começa com as tags em comum e muda só as camadas em que eu mexi (`spec/categorias.md`).
- [ ] Um lançamento escondido por um filtro sai da seleção; trocar de mês ou salvar limpa a seleção; até 500 de uma vez (`spec/categorias.md`).
- [ ] No filtro por tags, tags da mesma camada somam e camadas diferentes se cruzam (`spec/lancamentos.md`).
- [ ] Uma conexão substituída fica de fora dos gráficos, e os gastos provisórios ainda não entram (`spec/graficos.md`).
- [ ] Pagamento de cartão: as descrições que o reconhecem sem a categoria do Pluggy, Todos ainda o mostra, e o topo diz à parte quanto foi pago (`spec/lancamentos.md`).
- [ ] No gráfico por tag: só o mês escolhido, sem comparação; "Sem tag" por último; a camada começa na primeira; a lista da fatia abre na mesma tela e um lançamento abre o detalhe em Lançamentos; por enquanto ele lê a lista de Lançamentos, que ainda mostra as conexões substituídas (`spec/graficos.md`).
