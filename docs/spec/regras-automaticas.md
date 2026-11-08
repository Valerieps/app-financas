# Regras automáticas

Eu ensino o app a classificar sozinho: "sempre que isso, então aquilo".

- **Entra aqui:** o que é uma regra, as condições e as ações que existem, quando as regras rodam, a
  ordem entre elas e a tela Regras automáticas.
- **Não entra aqui:** as camadas e as tags em si (`categorias.md`), a ordem de decisão entre as
  minhas regras, o Pluggy e o Gemini, e a oferta de criar regra ao mudar a categoria
  (`classificacao.md`).

## Em aberto

- [ ] **Próximas condições e ações.** Quais vêm depois de "a descrição contém", "o tipo é" e
  "aplique as tags": valor, conta, quem pagou ou recebeu; mudar a categoria, a importância?

## Regras

- Uma regra é "sempre que <condições>, aplique <ações>". Todas as condições precisam valer. *(2)*
- Hoje existem duas condições, **a descrição contém um texto** e **o lançamento é de um tipo**
  (entrada, saída ou transferência), e uma ação, **aplique as tags** (no máximo uma por camada). *(2)*
  Por quê: começo pelo que mais uso; outras condições e ações entram depois sem refazer as regras.
- O texto é comparado sem diferença entre maiúsculas e minúsculas nem acentos: "ifood" casa com
  "IFOOD *Restaurante" e "padaria" com "Padaría". *(2)*
- No texto, `|` quer dizer "ou" e `&` quer dizer "e": "ifood | rappi" casa com qualquer um dos dois,
  e "uber & eats" só com descrições que tenham os dois, em qualquer ordem. O `&` vale antes do `|`:
  "ifood | uber & eats" é ifood, ou uber e eats juntos. Cada `|` ou `&` precisa de texto dos dois
  lados. *(2)*
  Por quê: uma regra só cobre os vários nomes com que a mesma loja aparece no extrato.
- Um lançamento é uma **transferência** quando a categoria que vale (a minha, ou a do Pluggy) é do
  grupo Transferências do Pluggy (inclui as transferências entre as minhas contas) ou quando é um
  pagamento de fatura; senão, é uma **entrada** ou uma **saída**, pelo sentido do dinheiro. *(2)*
- Uma regra só preenche camadas vazias: a tag que eu pus à mão, ou que outra regra já pôs, fica. *(2)*
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
- Para criar uma regra, eu escrevo o texto, escolho o tipo de lançamento (qualquer tipo, saída,
  entrada ou transferência; começa em qualquer tipo) e escolho as tags, uma por camada. *(2)*
- O botão **Testar** mostra até 10 lançamentos guardados que a regra pega, os mais recentes
  primeiro, e quantos ela pega ao todo, antes de eu salvar. *(2)*
