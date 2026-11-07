# Lançamentos

A tela onde eu vejo tudo o que entrou e saiu das minhas contas e cartões no mês.

- **Entra aqui:** a lista de lançamentos do mês no desktop, seus filtros e o painel de detalhe.
- **Não entra aqui:** categoria, importância e regras (`classificacao.md`), gastos provisórios e
  casamento (`gastos-provisorios.md`), faturas e parcelas futuras (`cartao-de-credito.md`).

## Em aberto

- [ ] Os gastos provisórios ainda sem casamento aparecem na lista, marcados como provisórios, ou só
  no Cofre até casarem?
- [ ] O pagamento da fatura do cartão e as transferências entre as minhas próprias contas contam nas
  entradas e saídas do mês, ou ficam fora do total?

## Lista

- A aba se chama **Lançamentos**, não Gastos, porque mostra também o que entra (créditos). *(1)*
- Eu vejo todos os lançamentos do mês escolhido no cabeçalho, de todas as contas e cartões, numa
  tabela só, do dia mais novo para o mais antigo, sem total por dia. *(1)*
- Cada linha mostra uma caixinha para selecionar, a data, a descrição, a categoria do Pluggy, as
  minhas tags (na ordem das camadas) e o valor; a data diz "Hoje" ou
  "Ontem" quando for o caso, senão o dia da semana e o dia ("qui, 5 nov"). As entradas aparecem em
  verde, com "+". Um lançamento que o banco ainda não fechou aparece como **pendente**, e uma compra
  parcelada mostra a parcela. *(1)*
- No topo, eu vejo o total de saídas, de entradas e o saldo do mês, separados por moeda. *(1)*
- Com algum filtro ligado, o topo diz quantos lançamentos a lista mostra de quantos há no mês
  ("12 de 106"); os totais continuam sendo os do mês inteiro. *(1)*
- Eu posso ordenar a tabela clicando no título da data, da descrição, da categoria ou do valor; um
  segundo clique inverte. A data e o valor começam do maior, os textos de A a Z. A ordem fica na URL
  (`?ordem=valor`) e continua quando eu troco de mês. *(1)*
- O dia de cada lançamento é o dia em Brasília. *(1)*
- Um lançamento que o Pluggy apagou não aparece (o Cofre continua guardando). *(1)*

## Filtros

- Os filtros ficam numa linha só: Todos, Saídas e Entradas lado a lado, e um botão para as contas e
  um para cada camada de tags, que abre a lista para eu escolher. "Limpar filtros" desliga todos de
  uma vez. *(1)*
- Eu posso mostrar todos, só as saídas ou só as entradas. O filtro fica na URL (`?tipo=entradas`) e
  continua quando eu troco de mês. *(1)*
- Eu posso escolher uma ou mais contas e cartões para ver só os lançamentos deles; sem nenhum
  escolhido, vejo todos. A escolha fica na URL (`?conta=...`) e continua quando eu troco de mês. *(1)*
- Eu posso escolher uma ou mais tags, numa linha por camada. Tags da mesma camada somam (Mercado ou
  Restaurante); camadas diferentes se cruzam (Mercado e Impulso). Sem nenhuma escolhida, vejo todos.
  A escolha fica na URL (`?tag=...`) e continua quando eu troco de mês. *(2)*
- Cada camada também tem a opção "Vazio", que mostra os lançamentos sem tag nessa camada; ela soma
  com as tags da mesma camada como qualquer outra. *(2)*

## Seleção

- Com lançamentos selecionados, eu ponho ou tiro tags de todos de uma vez (`categorias.md`). *(2)*
- Enquanto há lançamentos selecionados, a barra de filtros dá lugar às ações com eles; limpar a
  seleção traz os filtros de volta. *(2)*

## Painel de detalhe

- Clicar num lançamento abre o painel ao lado, sem sair da lista, com o valor, quando aconteceu, a
  conta, a categoria, se está pendente, quem pagou (numa entrada) ou quem recebeu (numa saída), o tipo
  de operação, a parcela, o final do cartão, o texto original do banco e quando o app o viu pela
  primeira vez. *(1)*
- Por enquanto o painel só mostra; mudar categoria e importância vem com a fase 2. *(2)*
