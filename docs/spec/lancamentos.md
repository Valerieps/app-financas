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
- Eu posso ligar mais três colunas: **Tipo** (Entrada, Saída ou Pgto. cartão), **Operação** (o tipo
  de operação e o meio de pagamento, como no painel) e **Quem pagou** (o nome que o banco mandou;
  vazio quando não mandou). *(2)*
- O botão **Colunas**, acima da tabela à direita, mostra ou oculta cada coluna; a descrição e o
  valor ficam sempre. A escolha fica guardada neste aparelho, não na URL, e continua quando eu troco
  de mês ou volto à tela. Na primeira vez, aparecem as colunas de sempre, sem as três novas. *(2)*
  Por quê: é uma preferência de como eu leio a tabela, não um filtro que eu queira mandar num link.
- No topo, numa linha discreta, eu vejo quantos lançamentos há e o saldo (entradas menos saídas)
  em reais e em dólar, os dois sempre, mesmo zerados; não vejo o total de saídas e de entradas. *(1)*
  Por quê: o topo não é o principal da tela; a lista é. Um número só por moeda basta.
- Com algum filtro ligado, o topo diz quantos lançamentos a lista mostra de quantos há no mês
  ("12 de 106"), e o saldo (e o pagamento de cartão à parte) passa a somar só o que a lista
  mostra. *(1)*
- O **pagamento de cartão** fica fora do saldo do topo, que diz à parte
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

- Cada filtro fica no título da sua coluna, num funil ao lado do nome; o nome continua ordenando a
  tabela. O funil fica cheio quando o filtro daquela coluna está ligado. "Limpar filtros", acima da
  tabela, aparece com algum filtro ligado e desliga todos de uma vez. *(2)*
- Todo filtro aceita várias escolhas e começa com "Todos", que desliga as escolhas daquele filtro.
  Onde um lançamento pode não ter valor (categoria, operação, quem pagou e cada camada de tags), há
  também "Vazio". *(2)*
  Por quê: o tipo e a conta nunca ficam vazios, então ali "Vazio" não mostraria nada.
- No Tipo (ou no Valor, enquanto a coluna Tipo está oculta), eu escolho entre saídas, entradas e
  pagamentos de cartão, um ou mais. Saídas e Entradas
  não mostram pagamento de cartão. A escolha fica na URL (`?tipo=saidas&tipo=cartao`) e continua
  quando eu troco de mês. *(2)*
- Na Descrição, eu escolho uma ou mais contas e cartões para ver só os lançamentos deles (aparece
  quando há mais de uma conta). A escolha fica na URL (`?conta=...`) e continua quando eu troco de
  mês. *(2)*
- Na Categoria, eu escolho uma ou mais categorias do mês, ou "Vazio" para os lançamentos sem
  categoria. A escolha fica na URL (`?categoria=...`) e continua quando eu troco de mês. *(2)*
- Na Operação e em Quem pagou, eu escolho um ou mais dos valores do mês, ou "Vazio". A escolha fica
  na URL (`?operacao=...`, `?pagador=...`) e continua quando eu troco de mês. *(2)*
- Nas Tags, cada camada é um grupo. Tags da mesma camada somam (Mercado ou Restaurante); camadas
  diferentes se cruzam (Mercado e Impulso). "Vazio" mostra os lançamentos sem tag naquela camada e
  soma com as outras tags dela; "Todos" desliga só aquela camada. A escolha fica na URL (`?tag=...`)
  e continua quando eu troco de mês. *(2)*

## Seleção

- Eu marco um lançamento, seguro Shift e marco outro: todos os que estão entre os dois, na ordem em
  que a lista mostra, ficam marcados. Se o segundo já estava marcado, Shift desmarca o intervalo. *(2)*
- Com lançamentos selecionados, eu ponho ou tiro tags de todos de uma vez (`categorias.md`). *(2)*
- Com lançamentos selecionados, eu mudo a categoria de todos de uma vez, ou volto à do Pluggy
  (`classificacao.md`). *(2)*
- Enquanto há lançamentos selecionados, as ações com eles aparecem acima da tabela, no lugar de
  "Limpar filtros" e de Colunas; limpar a seleção os traz de volta. *(2)*

## Painel de detalhe

- Clicar num lançamento abre o painel ao lado, sem sair da lista, com o valor, quando aconteceu, a
  conta, a categoria, se está pendente, quem pagou (numa entrada) ou quem recebeu (numa saída), o tipo
  de operação, a parcela, o final do cartão, o texto original do banco e quando o app o viu pela
  primeira vez. *(1)*
- No painel, eu mudo a categoria numa lista com a árvore do Pluggy; a primeira opção mostra a
  categoria do Pluggy e volta a ela (`classificacao.md`). Mudar a importância vem com a fase 2. *(2)*
