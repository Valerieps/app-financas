# Regras automáticas

Eu ensino o app a classificar sozinho: "sempre que isso, então aquilo".

- **Entra aqui:** o que é uma regra, as condições e as ações que existem, quando as regras rodam, a
  ordem entre elas e a tela Regras automáticas.
- **Não entra aqui:** as camadas e as tags em si (`categorias.md`), a ordem de decisão entre as
  minhas regras, o Pluggy e o Gemini, e a oferta de criar regra ao mudar a categoria
  (`classificacao.md`).

## Em aberto

- [ ] **Próximas condições e ações.** Quais vêm depois de "a descrição contém", "o tipo é", "quem
  pagou contém", "a operação contém", "a categoria está em", "aplique as tags", "substitua na
  descrição" e "mude a categoria": valor, data,
  conta, quem recebeu; mudar a importância?

## Regras

- Uma regra é "sempre que <condições>, faça <ações>". Todas as condições precisam valer. *(2)*
- Cada condição tem duas partes: o **campo** do lançamento que ela olha e a **condição** em si, que
  depende do campo (um texto para a descrição; uma data pediria outra coisa). Cada ação também tem
  duas partes: o **campo** que ela muda e a **consequência** em si. *(2)*
  Por quê: outras condições e ações entram depois sem refazer as regras nem a tela.
- Hoje existem cinco condições, **a descrição contém um texto**, **o lançamento é de um tipo**
  (entrada, saída ou transferência), **quem pagou contém um texto**, **a operação contém um
  texto** e **a categoria está em** uma da árvore do Pluggy, e três ações, **aplique as
  tags** (no máximo uma por camada), **substitua, na descrição, um texto por outro** e **mude a
  categoria** (para uma da árvore do Pluggy). *(2)*
  Por quê: começo pelo que mais uso.
- **Quem pagou** só vale para entradas: olha o nome de quem pagou, como o banco manda, e nunca casa
  com uma saída ou uma entrada sem esse nome. Uma transferência recebida (categoria Transferências
  do Pluggy) conta como entrada aqui. O texto funciona como o da
  descrição, com `|` e `&`. *(2)*
  Por quê: numa entrada, quem pagou diz o que ela é (salário, aluguel, reembolso) melhor que a
  descrição.
- **Operação** vale para qualquer lançamento: olha a operação como o detalhe do lançamento mostra
  (o tipo da operação e o meio de pagamento que o banco manda, como "PIX · PIX"), e nunca casa com
  um lançamento sem operação. O texto funciona como o da descrição, com `|` e `&`. *(2)*
- **Categoria** olha a categoria que vale (a minha, ou a do Pluggy) e casa com a categoria
  escolhida na regra e com todas as que ficam abaixo dela na árvore: "a categoria estiver em
  Compras" pega também "Compras online". Nunca casa com um lançamento sem categoria. *(2)*
  Por quê: uma regra cobre o grupo inteiro sem eu listar cada subcategoria.
- A categoria que uma regra põe já vale para as condições de categoria das regras de tags e de
  troca na descrição. As regras que mudam a categoria olham a categoria de antes de qualquer regra.
  *(2)*
  Por quê: assim "mude a categoria" e depois "categoria em X, aplique a tag" funcionam juntas, sem
  uma regra de categoria depender da outra.
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
- **Mudar a categoria** põe a categoria como se eu a tivesse escolhido, e só num lançamento que ainda
  não tem categoria escolhida: a que eu escolhi, ou que outra regra já pôs, fica. Quando várias
  regras mudam a categoria, vence a de cima. Depois disso, ela vale como a minha escolha em tudo
  (`classificacao.md`), e eu posso trocá-la ou voltar à do Pluggy. *(2)*
- Quando duas regras querem a mesma camada, vence a de cima na lista. Eu posso subir e descer as
  regras. *(2)*
- As regras rodam sozinhas em cada lançamento novo que chega do Pluggy. *(2)*
- Para os lançamentos que já estão guardados, eu rodo as regras com um botão; também ali só as
  camadas vazias recebem tag, e só os lançamentos sem categoria escolhida mudam de categoria. O
  botão diz quantos receberam tags, quantos mudaram de categoria e quantas descrições as regras
  trocam. *(2)*
- Excluir uma regra não tira as tags nem as categorias que ela já pôs. Se eu excluo uma tag ou uma
  camada, ela sai das regras. *(2)*
- No máximo 200 regras. *(2)*

## Tela Regras automáticas

- Fica no menu da esquerda, logo acima de Categorias. *(2)*
- Mostra as regras numa lista compacta, uma por linha, numeradas na ordem em que valem. Cada
  linha mostra as condições e, depois de uma seta, o que a regra faz, em etiquetas curtas
  ("descrição contém ifood", "saída" → "Tipo de Gasto: Restaurante", ""IFOOD *" → "iFood"",
  "Categoria: Salário"), alinhadas à esquerda. Uma alça à esquerda de cada linha muda a ordem:
  eu arrasto a regra para onde quero, ou, com a alça em foco, uso as setas ↑ ↓ do teclado. Numa tela
  de toque, onde não dá para arrastar, a linha mostra subir e descer. *(2)*
  Por quê: com dezenas de regras, eu preciso ver todas de uma vez e achar a regra pelo gatilho.
- Uma busca no topo filtra as regras por qualquer palavra delas (o texto, a tag, a categoria), sem
  diferença entre maiúsculas e minúsculas nem acentos; os números continuam os da ordem. *(2)*
- No topo também ficam quantas regras eu tenho, o botão **Aplicar aos guardados** e o botão **Nova
  regra**. *(2)*
- Ao clicar numa regra, ou em Nova regra, ela abre num painel ao lado da lista (numa tela estreita,
  por cima dela), que fecha com Esc. Lá eu salvo, cancelo ou excluo a regra. *(2)*
  Por quê: a lista não some nem pula enquanto eu edito.
- No painel, a regra é escrita como uma frase: "Sempre que **a descrição** contiver [ifood | rappi]
  e **o lançamento** for **uma saída**, então **aplique as tags** [Tipo de Gasto: Restaurante]". Cada
  palavra sublinhada é um menu: nas condições, a descrição, o lançamento (o tipo), quem pagou
  (entrada), a operação ou a categoria (da árvore do Pluggy); nas ações, aplique as tags, mude a categoria para (da árvore do Pluggy)
  ou troque na descrição [texto] por [novo]. As tags escolhidas aparecem como etiquetas que eu tiro
  com ×, e um menu "+ tag" põe outra (uma por camada: a nova troca a da mesma camada). Até 5
  condições e 5 ações. *(2)*
- A regra nova começa com "a descrição contiver" e, se já existem tags, "aplique as tags". Ao trocar
  uma ação para "troque na descrição", o texto a trocar já vem com o texto da primeira condição de
  descrição, quando ele não tem `|` nem `&`. *(2)*
- Enquanto eu escrevo, o painel mostra sozinho até 10 lançamentos guardados que a regra pega, os
  mais recentes primeiro, e quantos ela pega ao todo; quando a regra substitui, cada lançamento
  aparece com a descrição já trocada. *(2)*
  Por quê: ver o resultado sem apertar Testar evita salvar uma regra que pega demais.
