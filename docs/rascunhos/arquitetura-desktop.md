# Arquitetura de informação da versão desktop

Proposta de como a versão desktop se organiza: módulos, telas, navegação e os fluxos principais.

- **Entra aqui:** o mapa das telas do desktop, o esqueleto da janela, como se navega entre módulos
  e telas, os fluxos principais e o lugar reservado para Investimentos e Patrimônio.
- **Não entra aqui:** as regras de cada feature (ficam em `../spec/`), o visual (cores, tipografia)
  e os textos finais da interface. O spec vence este rascunho quando eles divergem.

## Em aberto

- [ ] **Em que fase entram o desktop, Metas, Caixinhas e o cadastro manual?** Proposta: uma fase
      nova depois da 3 (o feedback vem primeiro). Com a fase definida, as regras deste rascunho
      vão para `spec/metas.md`, `spec/caixinhas.md` e `spec/classificacao.md`, e as linhas para o
      `ROADMAP.md`.
- [ ] **Gasto manual que o Pluggy também traz.** Com o cadastro livre, eu posso cadastrar uma compra
      do Nubank que o Pluggy vai trazer depois. Proposta: todo gasto manual tenta casar com o
      Pluggy, como o `/gastei`; se não casar, ele fica valendo como gasto manual e não vira órfão.
- [ ] **As Caixinhas do próprio Nubank.** O Nubank já separa dinheiro em Caixinhas, e o Pluggy as
      traz como saldos. Proposta: cada Caixinha do Nubank aparece aqui como uma caixinha pronta,
      vinculada ao próprio saldo dela, sem eu precisar criar.

## Princípios da navegação

1. **Um lugar para cada coisa.** Cada dado tem uma tela-casa; as outras telas mostram um resumo e
   levam até ela.
2. **Responder primeiro, detalhar depois.** Cada tela abre com a resposta (quanto posso gastar, se
   estou dentro da meta) e o detalhe vem abaixo ou um clique adiante. Nada de começar por uma
   tabela.
3. **Raso.** No máximo três níveis: módulo › tela › detalhe. O detalhe abre num painel lateral, sem
   trocar de tela, para eu não perder o lugar.
4. **Os módulos têm a mesma forma.** Todo módulo tem uma Visão geral e as mesmas peças (lista,
   gráfico, metas). Quando Investimentos e Patrimônio chegarem, eu já sei usar.
5. **O período é global.** O mês escolhido vale para todas as telas até eu trocar.

## Mapa

```
Sinal Verde (desktop)
│
├── Início ............................ o painel de todos os módulos
│
├── Finanças
│   ├── Visão geral ................... Livre do dia, semáforo, mês até aqui, metas em risco
│   ├── Lançamentos ................... lista, filtros, cadastro, mudar categoria e importância
│   ├── Gráficos ...................... por categoria, por importância, evolução no tempo
│   ├── Metas ......................... todas as metas e o progresso de cada uma
│   └── Caixinhas ..................... o saldo de cada conta e investimento dividido em caixinhas
│
├── Investimentos ..................... (a definir) reservado
│   └── Visão geral ................... por enquanto: posições e retratos que o Cofre já guarda
│
├── Patrimônio ........................ (a definir) reservado
│   └── Visão geral ................... por enquanto: soma de saldos e investimentos no tempo
│
└── (rodapé da barra lateral)
    ├── Cofre ......................... conexões e o que está guardado (já existe)
    └── Ajustes ....................... renda, custos fixos, regras de classificação, categorias,
                                        importâncias, Telegram, exportação, acesso
```

Cofre e Ajustes ficam fora dos módulos porque servem a todos: as conexões alimentam Finanças,
Investimentos e Patrimônio ao mesmo tempo.

## Esqueleto da janela

```
┌────────────┬──────────────────────────────────────────────────────┬────────────────┐
│ ● Sinal    │  Finanças › Lançamentos             ◀ nov 2026 ▶ Ctrl+K│                │
│   Verde    ├──────────────────────────────────────────────────────┤  Painel de     │
│            │[Visão geral][Lançamentos][Gráficos][Metas][Caixinhas]│  detalhe       │
│ Início     ├──────────────────────────────────────────────────────┤  (abre ao      │
│ Finanças ◀ │                                                      │  clicar num    │
│ Investim.  │                 conteúdo da tela                     │  gasto, meta   │
│ Patrimônio │                                                      │  ou caixinha;  │
│            │                                                      │  fecha com Esc)│
│ ─────────  │                                                      │                │
│ Cofre      │                                                      │                │
│ Ajustes    │                                                      │                │
│ R$ 82 hoje │                                                      │                │
└────────────┴──────────────────────────────────────────────────────┴────────────────┘
```

- **Barra lateral (navegação global):** os módulos em cima, Cofre e Ajustes embaixo. No pé, o Livre
  do dia com a cor do semáforo, sempre visível, em qualquer tela. Um clique leva à Visão geral de
  Finanças.
- **Cabeçalho:** onde estou (Módulo › Tela), o seletor de mês e a busca/comandos (Ctrl+K).
- **Abas (navegação local):** as telas do módulo. Mudam conforme o módulo; a posição não muda.
- **Painel de detalhe:** abre à direita sem sair da tela. É onde eu edito um gasto, uma meta ou uma
  caixinha.

## Telas do módulo Finanças

### Visão geral

A resposta do mês em um olhar. De cima para baixo:

1. Livre do dia e semáforo, grandes.
2. O mês até aqui: gasto contra orçamento flexível, termômetro de impulso.
3. Metas em risco (só as amarelas ou vermelhas), cada uma levando à sua meta.
4. Gastos para revisar: provisórios sem casamento, órfãos, sem importância. Cada um abre no painel.
5. Caixinhas com prazo próximo.

Daqui tudo é atalho: nada é editado nesta tela.

### Lançamentos

A casa dos lançamentos: gastos e créditos. As regras da lista já construída estão em
[`spec/lancamentos.md`](../spec/lancamentos.md).

- Tabela com data, descrição, valor, categoria, importância, conta e estado (provisório, definitivo ou
  manual).
- Filtros combináveis em cima (categoria, importância, conta, caixinha, estado, valor, texto). Os filtros
  ficam na URL, então um clique num gráfico ou numa meta abre esta tela já filtrada.
- Seleção múltipla para mudar categoria ou importância de vários gastos de uma vez, e para criar uma regra
  a partir deles.
- **Novo gasto** abre o painel com o formulário. O cadastro é livre: qualquer gasto, de qualquer
  conta ou em dinheiro.
- Clicar numa linha abre o gasto no painel: categoria, importância, caixinha de onde saiu, histórico,
  casamento.

### Gráficos

Leitura, não edição. Já construída; as regras estão em [../spec/graficos.md](../spec/graficos.md).

### Metas

A casa das metas. Todas as metas têm a mesma forma: **o que mede**, **o alvo**, **o período** e o
**progresso**, com a cor do semáforo. Os tipos de meta:

| Tipo de meta | Exemplo | Mede |
| --- | --- | --- |
| Teto por categoria | Restaurante até R$ 600/mês | Soma da categoria no mês |
| Teto por importância | Impulso até R$ 300/mês | Soma da importância no mês |
| Teto do total | Gastar até R$ 5.000/mês | Soma de todos os gastos |
| Proporção | Gastos até 70% da renda | Gastos ÷ entradas do mês |
| Economia mensal | Guardar R$ 1.000/mês | Entradas − gastos do mês |
| Objetivo de caixinha | Viagem: R$ 6.000 até julho | Saldo da caixinha (a meta mora na caixinha) |

- O teto de impulso de hoje passa a ser uma meta "Teto por importância" (Impulso), e o termômetro de
  impulso lê essa meta.
- A meta de reserva de hoje passa a ser a meta de economia mensal: uma só, editada aqui, que o
  orçamento flexível e o Livre do dia leem. Ela sai da gaveta do celular.
- O alvo de uma caixinha é configurado na própria caixinha; Metas mostra a meta e leva até ela.
- Lista agrupada por estado: em risco, no caminho, cumpridas.
- **Nova meta** abre o painel: primeiro escolho o tipo de meta, depois só os campos daquele tipo.
- Clicar numa meta abre o painel com o histórico mês a mês e um link "ver os gastos" para
  **Lançamentos** filtrado.
- Investimentos e Patrimônio poderão adicionar tipos de meta aqui (ex.: patrimônio de R$ X até
  2030) sem mudar a tela.

### Caixinhas

A casa das caixinhas. Uma caixinha é sempre uma parte de um saldo que já existe: de uma conta ou de
um investimento.

- Agrupadas pela conta ou investimento de onde vêm. Cada grupo mostra o saldo real, a soma das
  caixinhas e o que está **Sem caixinha**.
- A soma das caixinhas de um saldo nunca passa dele. Se o saldo cair abaixo da soma (um gasto
  grande, um resgate), o grupo fica vermelho e me pede para tirar dinheiro de alguma caixinha.
- Cada caixinha: nome, saldo, alvo e prazo (opcionais), barra de progresso.
- Ações no painel: criar, mover dinheiro entre caixinhas do mesmo saldo (ou de "Sem caixinha"),
  definir alvo, arquivar.
- Um gasto pode sair de uma caixinha (ex.: a passagem sai de Viagem). Isso aparece no gasto e no
  histórico da caixinha.

## Fluxos principais

**Ver por que o semáforo ficou vermelho**
Barra lateral (Livre do dia vermelho) → Finanças › Visão geral → "Gastos de hoje" → Lançamentos filtrado
por hoje → clique num gasto → painel → troco a importância para Projetos especiais → o Livre do dia na
barra lateral atualiza.

**Descobrir para onde foi o dinheiro**
Finanças › Gráficos › Por categoria → clique em "Restaurante" → Lançamentos filtrado por Restaurante no
mês → "Criar meta para esta categoria" → painel de nova meta já preenchido.

**Criar uma meta**
Finanças › Metas → Nova meta → escolho "Proporção" → alvo 70% → salvar → a meta aparece "no
caminho" e, se entrar em risco, também na Visão geral e no Início.

**Separar dinheiro para um projeto**
Finanças › Caixinhas → conta Nubank → "Sem caixinha: R$ 2.400" → Nova caixinha "Viagem", alvo
R$ 6.000, prazo julho → mover R$ 1.000 → a caixinha aparece em Metas como objetivo.

**Cadastrar um gasto que o banco não vê**
Finanças › Lançamentos → Novo gasto → valor, descrição, categoria, importância, conta ou "dinheiro" → salvar →
o gasto entra na lista e no Livre do dia na hora.

**Revisar o que o automático não resolveu**
Início ou Finanças › Visão geral → "3 gastos para revisar" → Lançamentos filtrado por "precisa de
revisão" → resolvo cada um no painel, um depois do outro, sem voltar à lista.

## Como Investimentos e Patrimônio entram

Os dois módulos ainda não têm regras, mas a arquitetura já reserva o lugar deles:

1. **Já estão na barra lateral**, com uma Visão geral simples feita com o que o Cofre já guarda
   (posições de investimento e retratos do dia). Assim a barra não muda de forma quando chegarem.
2. **Seguem o mesmo molde de Finanças:** Visão geral + telas próprias nas abas + o painel de
   detalhe. Uma proposta inicial, a confirmar quando os módulos forem definidos:
   - Investimentos: Visão geral · Posições · Rentabilidade · Aportes e resgates · Metas.
   - Patrimônio: Visão geral · Bens e dívidas · Evolução · Metas.
3. **As peças transversais são compartilhadas, não copiadas:**
   - **Metas** aceita tipos de meta de qualquer módulo; cada módulo mostra só as suas, mas a casa é
     uma só.
   - **Caixinhas** podem dividir o saldo de um investimento, então Investimentos mostra quanto de
     cada posição está separado para cada projeto.
   - **Início** junta a Visão geral de cada módulo num cartão, na ordem da barra lateral.
4. **As fronteiras entre módulos:** uma aplicação ou resgate não é gasto
   (`spec/classificacao.md`); ela aparece em Investimentos, e em Finanças só como movimentação. O
   Patrimônio só lê: soma o que Finanças (saldos) e Investimentos (posições) já sabem, mais o que
   eu cadastrar lá (imóvel, carro, dívidas).

## Endereços

Cada tela tem uma URL, para eu poder voltar, favoritar e para os gráficos levarem a listas
filtradas:

```
/                         Início
/financas                 Visão geral
/financas/lancamentos?categoria=restaurante&mes=2026-11
/financas/lancamentos/:id      (abre o painel por cima da lista)
/financas/graficos/categoria
/financas/metas  /financas/metas/:id
/financas/caixinhas  /financas/caixinhas/:id
/investimentos  /patrimonio
/cofre  /ajustes/:secao
```

## Relação com o celular e o Telegram

O desktop não substitui o celular: o celular continua sendo o semáforo e a troca rápida de importância, e
o Telegram continua sendo o feedback na hora. O desktop é onde eu **olho para trás e planejo**:
gráficos, metas, caixinhas, cadastro, revisão em lote e ajustes. Por isso a Visão geral do desktop
abre com a mesma resposta do celular (Livre do dia e cor), e o resto vem depois.
