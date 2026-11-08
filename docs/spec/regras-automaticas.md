# Regras automáticas

Eu ensino o app a classificar sozinho: "sempre que isso, então aquilo".

- **Entra aqui:** o que é uma regra, as condições e as ações que existem, quando as regras rodam, a
  ordem entre elas e a tela Regras automáticas.
- **Não entra aqui:** as camadas e as tags em si (`categorias.md`), a ordem de decisão entre as
  minhas regras, o Pluggy e o Gemini, e a oferta de criar regra ao mudar a categoria
  (`classificacao.md`).

## Em aberto

- [ ] **Próximas condições e ações.** Quais vêm depois de "a descrição contém", "o tipo é",
  "aplique as tags" e "substitua na descrição": valor, data, conta, quem pagou ou recebeu; mudar a
  categoria, a importância?

## Regras

- Uma regra é "sempre que <condições>, faça <ações>". Todas as condições precisam valer. *(2)*
- Cada condição tem duas partes: o **campo** do lançamento que ela olha e a **condição** em si, que
  depende do campo (um texto para a descrição; uma data pediria outra coisa). Cada ação também tem
  duas partes: o **campo** que ela muda e a **consequência** em si. *(2)*
  Por quê: outras condições e ações entram depois sem refazer as regras nem a tela.
- Hoje existem duas condições, **a descrição contém um texto** e **o lançamento é de um tipo**
  (entrada, saída ou transferência), e duas ações, **aplique as tags** (no máximo uma por camada) e
  **substitua, na descrição, um texto por outro**. *(2)*
  Por quê: começo pelo que mais uso.
- O texto é comparado sem diferença entre maiúsculas e minúsculas nem acentos: "ifood" casa com
  "IFOOD *Restaurante" e "padaria" com "Padaría". *(2)*
- No texto, `|` quer dizer "ou" e `&` quer dizer "e": "ifood | rappi" casa com qualquer um dos dois,
  e "uber & eats" só com descrições que tenham os dois, em qualquer ordem. O `&` vale antes do `|`:
  "ifood | uber & eats" é ifood, ou uber e eats juntos. Cada `|` ou `&` precisa de texto dos dois
  lados. *(2)*
  Por quê: uma regra só cobre os vários nomes com que a mesma loja aparece no extrato.
- **Substituir** troca só o pedaço da descrição, não ela inteira: "Sempre que a descrição contiver
  "ifood", substitua "IFOOD *" por "iFood "" deixa "IFOOD *Restaurante" como "iFood Restaurante".
  O pedaço é achado sem diferença entre maiúsculas e minúsculas nem acentos, e trocado todas as
  vezes que aparece. O novo texto pode ser vazio, para apagar o pedaço. *(2)*
- A substituição não mexe na descrição que o banco mandou, que fica guardada: o app guarda, ao lado
  dela, a descrição trocada, como guarda a categoria que eu escolho. Ela vale em todos os
  lançamentos, novos e já guardados, é refeita quando eu crio, edito, movo ou excluo uma regra ou
  mudo a categoria de um lançamento, e some se eu excluo a regra. No detalhe do lançamento, eu vejo
  também a descrição do banco. *(2)*
  Por quê: o cofre guarda o que o banco mandou para sempre; a regra só muda o que eu leio. Guardar
  a descrição trocada evita refazer todas as regras a cada vez que o app mostra um lançamento.
- As condições de todas as regras olham sempre a descrição do banco, não a que outra regra trocou.
  Quando várias regras substituem, cada uma, em ordem, troca no que as de cima deixaram. *(2)*
- Um lançamento é uma **transferência** quando a categoria que vale (a minha, ou a do Pluggy) é do
  grupo Transferências do Pluggy (inclui as transferências entre as minhas contas) ou quando é um
  pagamento de fatura; senão, é uma **entrada** ou uma **saída**, pelo sentido do dinheiro. *(2)*
- Uma regra de tags só preenche camadas vazias: a tag que eu pus à mão, ou que outra regra já pôs, fica. *(2)*
  Por quê: a minha decisão vale mais que a automática.
- Quando duas regras querem a mesma camada, vence a de cima na lista. Eu posso subir e descer as
  regras. *(2)*
- As regras rodam sozinhas em cada lançamento novo que chega do Pluggy. *(2)*
- Para os lançamentos que já estão guardados, eu rodo as regras com um botão; também ali só as
  camadas vazias recebem tag. *(2)*
- Excluir uma regra não tira as tags que ela já pôs. Se eu excluo uma tag ou uma camada, ela sai das
  regras. *(2)*
- No máximo 200 regras. *(2)*

## Tela Regras automáticas

- Fica no menu da esquerda, logo acima de Categorias. *(2)*
- Mostra as regras em ordem, cada uma numa frase ("Sempre que a descrição contiver "ifood" e o
  lançamento for uma saída, aplique Tipo: Restaurante"), com subir, descer, editar e excluir. *(2)*
- Mostra as substituições numa frase também: "Troque "IFOOD *" por "iFood " na descrição", ou
  "Apague "*" da descrição" quando o novo texto é vazio. *(2)*
- Para criar uma regra, eu monto uma lista de condições e uma lista de consequências, até 5 de
  cada. Em cada linha eu escolho o campo (Descrição ou Tipo do lançamento nas condições; Tags ou
  Descrição nas consequências), depois a condição ou a consequência que esse campo oferece, e
  preencho o resto: o texto, o tipo, as tags (uma por camada) ou o texto a trocar e o novo. A regra
  nova começa com "Descrição contém" e, se já existem tags, "Tags: aplique". Ao trocar uma
  consequência para "Descrição: substitua", o texto a trocar já vem com o texto da primeira
  condição de descrição, quando ele não tem `|` nem `&`. *(2)*
- O botão **Testar** mostra até 10 lançamentos guardados que a regra pega, os mais recentes
  primeiro, e quantos ela pega ao todo, antes de eu salvar; quando a regra substitui, cada
  lançamento aparece com a descrição já trocada. *(2)*
