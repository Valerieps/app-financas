# Holerite

Eu envio o PDF do meu holerite e o app entende cada lançamento, sem IA, e confere se o líquido
caiu na minha conta.

- **Entra aqui:** o envio do holerite, o que o app lê dele, como ele lida com lançamentos novos, a
  conferência do líquido e onde eu vejo os holerites.
- **Não entra aqui:** como o salário é reconhecido entre as transações do Pluggy
  ([classificacao.md](classificacao.md#entradas)) e a renda usada no orçamento
  ([livre-do-dia.md](livre-do-dia.md)).

## Em aberto

- [ ] Onde eu envio o holerite: no celular, no desktop ou nos dois? Proposta: nos dois, numa seção
  Holerites dentro do Cofre.
- [ ] O 13º, as férias e a PLR saem num holerite separado do mensal? Se sim, me mande um exemplo de
  cada, para o app reconhecer o tipo pelo título.
- [ ] Quando eu envio de novo um holerite do mesmo período e tipo, o app substitui o anterior ou
  recusa? Proposta: mostra o que mudou e substitui depois que eu confirmo.
- [ ] Na conferência, quantos dias antes e depois da data de pagamento o app procura o crédito?
  Proposta: 3 dias úteis para cada lado.
- [ ] Os tipos de lançamento abaixo bastam? Salário, Adiantamento, Imposto, Previdência privada,
  Benefício, Ações, Outro.

## Envio

- Eu envio um ou vários PDFs de holerite de uma vez, inclusive os antigos. *(4)*
- O app só aceita holerite da minha empresa, no formato que ela usa; qualquer outro PDF é recusado
  com uma mensagem que diz por quê, e nada é guardado. *(4)*
- O app lê o PDF sem IA e sem mandar o arquivo para nenhum serviço de fora. *(4)*
  Por quê: o holerite tem CPF, conta e salário; regras fixas bastam porque o formato não muda.
- O app não guarda o PDF: guarda tudo o que leu dele. *(4)*
  Por quê: eu já arquivo os PDFs por fora; o app precisa dos números, não do arquivo.

## O que o app lê

- Do cabeçalho: o período, a data de pagamento, o cargo, o centro de custo, o salário base e a data
  de admissão. O app não guarda meu nome, meu código de funcionário, banco, agência e conta. *(4)*
- Cada lançamento: o código, a descrição, a referência (horas, dias ou porcentagem), se é vencimento
  ou desconto, e o valor. *(4)*
- Do rodapé: o total de vencimentos, o total de descontos, o valor líquido, o salário de
  contribuição do INSS, a base e o depósito do FGTS do mês, a base do IRRF, as alíquotas e o número
  de dependentes. *(4)*

## Lançamentos novos

- Um lançamento com um código que o app nunca viu é lido e guardado como veio, com o código e a
  descrição; ele nunca impede o holerite de entrar. *(4)*
  Por quê: a empresa cria lançamentos novos (bônus, ações, benefícios) sem aviso.
- Cada código tem um tipo: Salário, Adiantamento, Imposto, Previdência privada, Benefício, Ações ou
  Outro. O app já conhece os códigos dos holerites que eu enviei; um código novo entra como Outro e
  aparece marcado como novo até eu escolher o tipo. *(4)*
- Quando eu mudo o tipo de um código, a mudança vale para esse código em todos os holerites, os
  antigos e os que vierem. *(4)*

## As contas precisam fechar

- O app só aceita um holerite quando as contas dele fecham, centavo por centavo: a soma dos
  vencimentos dá o total de vencimentos, a soma dos descontos dá o total de descontos, e o total de
  vencimentos menos o total de descontos dá o líquido. *(4)*
  Por quê: um valor lido na linha errada estragaria a conferência e, depois, o Carnê-leão. É melhor
  recusar do que guardar errado.
- Quando uma conta não fecha, o app recusa o holerite, diz qual conta não fechou e por quanto, e não
  guarda nada. *(4)*

## Conferência do líquido

- O app procura, nas transações do Pluggy, o crédito da empresa perto da data de pagamento com o
  valor líquido, e liga o holerite a ele. *(4)*
- O adiantamento descontado no holerite é conferido do mesmo jeito, contra o crédito do adiantamento
  no meio do mês. *(4)*
- Cada holerite mostra o resultado: bateu; valor diferente, com a diferença; ou crédito não
  encontrado. *(4)*
- Quando o crédito chega depois do envio do holerite, o app confere de novo sozinho. *(4)*

## Onde eu vejo

- Uma lista dos holerites por mês, com o total de vencimentos, o total de descontos, o líquido e o
  resultado da conferência; ao abrir um, vejo cada lançamento com o tipo dele. *(4)*
- Os holerites entram na exportação, como os outros dados ([exportacao-e-api.md](exportacao-e-api.md)). *(4)*
