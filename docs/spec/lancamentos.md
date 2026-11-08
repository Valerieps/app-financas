# Lançamentos

A tela onde eu vejo tudo o que entrou e saiu das minhas contas e cartões no mês.

- **Entra aqui:** a lista de lançamentos do mês no desktop, seus filtros e o painel de detalhe.
- **Não entra aqui:** categoria, importância e regras (`classificacao.md`), gastos provisórios e
  casamento (`gastos-provisorios.md`), faturas e parcelas futuras (`cartao-de-credito.md`).

## Em aberto

- [ ] Os gastos provisórios ainda sem casamento aparecem na lista, marcados como provisórios, ou só
  no Cofre até casarem?
- [ ] As transferências entre as minhas próprias contas contam nas entradas e saídas do mês, ou
  ficam fora do total, como o pagamento do cartão?

## Lista

- A aba se chama **Lançamentos**, não Gastos, porque mostra também o que entra (créditos). *(1)*
- Eu vejo todos os lançamentos do mês escolhido no cabeçalho, de todas as contas e cartões, numa
  tabela só, do dia mais novo para o mais antigo, sem total por dia. *(1)*
- Cada linha mostra uma caixinha para selecionar, a data, a descrição, a categoria (a que eu
  escolhi ou, sem ela, a do Pluggy), as
  minhas tags (na ordem das camadas) e o valor; a data diz "Hoje" ou
  "Ontem" quando for o caso, senão o dia da semana e o dia ("qui, 5 nov"). As entradas aparecem em
  verde, com "+". Um lançamento que o banco ainda não fechou aparece como **pendente**, e uma compra
  parcelada mostra a parcela. *(1)*
- No topo, eu vejo o total de saídas, de entradas e o saldo do mês, separados por moeda. *(1)*
- Com algum filtro ligado, o topo diz quantos lançamentos a lista mostra de quantos há no mês
  ("12 de 106"), e os totais (e o pagamento de cartão à parte) passam a somar só o que a lista
  mostra. *(1)*
- O **pagamento de cartão** fica fora das saídas, das entradas e do saldo do topo, que diz à parte
  quanto saiu das contas para pagar o cartão no mês. *(1)*
  Por quê: as compras no cartão já são saídas; contar o pagamento da fatura somaria o mesmo gasto
  duas vezes, e o crédito no cartão inflaria as entradas.
- Pagamento de cartão é o débito na conta que paga a fatura e o crédito que entra no cartão. O app
  reconhece cada um quando o dado chega, sempre: pela categoria do Pluggy de pagamento de cartão
  ou, sem ela, pela descrição que começa com "Pagamento de fatura", "Pagamento da fatura" ou
  "Pagamento fatura" (saindo da conta) ou com essas ou "Pagamento recebido" (entrando no cartão). *(1)*
  A categoria que eu escolher para um lançamento vale por cima disso (`classificacao.md`). *(2)*
- Eu posso ordenar a tabela clicando no título da data, da descrição, da categoria ou do valor; um
  segundo clique inverte. A data e o valor começam do maior, os textos de A a Z. A ordem fica na URL
  (`?ordem=valor`) e continua quando eu troco de mês. *(1)*
- O dia de cada lançamento é o dia em Brasília. *(1)*
- Um lançamento que o Pluggy apagou não aparece (o Cofre continua guardando). *(1)*

## Filtros

- Os filtros ficam numa linha só: Todos, Saídas, Entradas e Cartão de crédito lado a lado, e um
  botão para as contas e um para cada camada de tags, que abre a lista para eu escolher. "Limpar
  filtros" desliga todos de uma vez. *(1)*
- Eu posso mostrar todos, só as saídas, só as entradas ou só os pagamentos de cartão. Saídas e
  Entradas não mostram pagamento de cartão; Todos mostra tudo. O filtro fica na URL
  (`?tipo=cartao`) e continua quando eu troco de mês. *(1)*
- Eu posso escolher uma ou mais contas e cartões para ver só os lançamentos deles; sem nenhum
  escolhido, vejo todos. A escolha fica na URL (`?conta=...`) e continua quando eu troco de mês. *(1)*
- Eu posso escolher uma ou mais tags, numa linha por camada. Tags da mesma camada somam (Mercado ou
  Restaurante); camadas diferentes se cruzam (Mercado e Impulso). Sem nenhuma escolhida, vejo todos.
  A escolha fica na URL (`?tag=...`) e continua quando eu troco de mês. *(2)*
- Cada camada também tem a opção "Vazio", que mostra os lançamentos sem tag nessa camada; ela soma
  com as tags da mesma camada como qualquer outra. *(2)*

## Seleção

- Eu marco um lançamento, seguro Shift e marco outro: todos os que estão entre os dois, na ordem em
  que a lista mostra, ficam marcados. Se o segundo já estava marcado, Shift desmarca o intervalo. *(2)*
- Com lançamentos selecionados, eu ponho ou tiro tags de todos de uma vez (`categorias.md`). *(2)*
- Com lançamentos selecionados, eu mudo a categoria de todos de uma vez, ou volto à do Pluggy
  (`classificacao.md`). *(2)*
- Enquanto há lançamentos selecionados, a barra de filtros dá lugar às ações com eles; limpar a
  seleção traz os filtros de volta. *(2)*

## Painel de detalhe

- Clicar num lançamento abre o painel ao lado, sem sair da lista, com o valor, quando aconteceu, a
  conta, a categoria, se está pendente, quem pagou (numa entrada) ou quem recebeu (numa saída), o tipo
  de operação, a parcela, o final do cartão, o texto original do banco e quando o app o viu pela
  primeira vez. *(1)*
- No painel, eu mudo a categoria numa lista com a árvore do Pluggy; a primeira opção mostra a
  categoria do Pluggy e volta a ela (`classificacao.md`). Mudar a importância vem com a fase 2. *(2)*
