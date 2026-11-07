# Visual da versão desktop

Proposta visual das telas do desktop: os princípios de psicologia financeira que guiam as telas, a
tipografia, o espaçamento, as cores, o layout e o rascunho de cada tela.

- **Entra aqui:** as regras visuais do desktop, o que cada prancha mostra e o que falta decidir para
  implementar.
- **Não entra aqui:** o mapa de telas e a navegação (`arquitetura-desktop.md`), as regras de cada
  feature (`../spec/`) e os valores dos tokens (`../../src/ui/theme/tokens.css`, a casa deles).
  O spec vence este rascunho quando eles divergem.

## Em aberto

- [ ] **Fonte.** As pranchas usam Inter. No app, a Inter teria que ir empacotada (woff2 próprio em
      `public/`, sem CDN). Proposta: manter a fonte do sistema (Segoe UI no Windows) até eu ver as
      telas prontas, e só então decidir.
- [ ] **"R$ X por dia" nas metas em risco.** A meta de Restaurante mostra "R$ 2,65 por dia até o fim
      do mês" (o que falta ÷ dias restantes). O spec ainda não tem essa regra.
- [ ] **Marcador de ritmo.** A linha preta nas barras é onde eu estaria hoje se gastasse igual todos
      os dias (dia de hoje ÷ dias do mês). Vale para tetos mensais; para proporção, a linha é o alvo.

## As pranchas

O canvas publicado: <https://claude.ai/artifact/WE31aQ8Q2PZ3qJoKuxfQXd>. A cópia dos arquivos está
em [desktop-telas/](desktop-telas/): cada `*.dc.html` é uma prancha, `Sidebar.dc.html` é a barra
lateral que as telas importam, e `canvas.json` diz onde cada uma fica no canvas. Elas rodam só no
canvas (dependem do runtime dele), mas o HTML e o CSS servem de referência direta para o React. Os
números são exemplos coerentes entre si (7 de novembro, Livre de hoje R$ 114,00, orçamento flexível
R$ 3.420,00), não dados reais.

| Prancha | O que mostra |
| --- | --- |
| `Main.dc.html` | Fundamentos: princípios, tipografia, espaçamento, layout, cores, números e tom |
| `Inicio.dc.html` | A frase-resposta, "Precisa de você" e um cartão por módulo |
| `VisaoGeral.dc.html` | Livre do dia em destaque, mês até aqui, termômetro, revisar, metas em risco, caixinhas com prazo |
| `Gastos.dc.html` | Total do mês, filtros, tabela agrupada por dia e o painel de detalhe aberto |
| `Metas.dc.html` | Metas agrupadas por estado, com barra, ritmo e o que falta |
| `Caixinhas.dc.html` | Cada saldo como barra empilhada, as caixinhas e o "Sem caixinha"; um saldo abaixo das caixinhas |

## Psicologia financeira

Cada princípio vira uma regra de tela:

1. **Uma resposta por tela.** Um só número no estilo Display por tela; o resto espera.
2. **Dizer o que sobra.** O número grande é o que ainda está livre, não o que foi gasto.
3. **Vermelho sem vergonha.** Alerta é fundo suave e frase neutra ("passou R$ 12 do livre"), nunca
   "estourou", e toda frase de alerta diz o que acontece a seguir. O semáforo vem sempre com palavra
   e forma (● ▲ ■), nunca só a cor.
4. **Progresso visível.** Toda barra de meta mostra quanto falta e o marcador de ritmo.
5. **Dinheiro com nome.** Caixinhas como barra empilhada do saldo; "Sem caixinha" fica à vista.
6. **Comparar comigo mesma.** A comparação é com a minha média dos últimos 3 meses.
7. **Corrigir em um clique.** Importância em botões segmentados; o que dá para desfazer não pede
   confirmação, mostra "Desfazer".
8. **Terminar é visível.** A revisão anda de um gasto para o próximo e o contador chega a zero.

## Tipografia

Seis tamanhos, pesos 400, 500 e 600. Os tokens estão em `tokens.css` (`--font-size-*`,
`--line-height-*`, `--font-weight-*`).

| Estilo | Tamanho / altura | Peso | Uso |
| --- | --- | --- | --- |
| Display | 56 / 64, −2% | 600 | O número-resposta da tela. Um por tela |
| Número | 32 / 40, −1% | 600 | O valor principal de cada cartão |
| Título | 20 / 28 | 600 | Títulos de tela e de seção |
| Corpo forte | 15 / 22 | 600 | Título de cartão, nome de meta e de caixinha |
| Corpo | 15 / 22 | 400 (500 em botões e abas) | Texto, linhas de tabela |
| Rótulo | 13 / 18 | 500 | Chips, rótulos de campo, metadados |
| Legenda | 12 / 16 | 400–500 | Horários; cabeçalhos de tabela em maiúsculas, +6% |

- Todo número usa `font-variant-numeric: tabular-nums`.
- No Display e no Número, os centavos ficam a 55% do tamanho e mais claros.
- No máximo três níveis de texto por cartão (Rótulo, Número, uma linha de Corpo).
- Hierarquia por tamanho e cor; o cinza (`--color-text-muted`) é o "menos importante".
- Texto corrido com no máximo ~72 caracteres por linha (640 px). Valores à direita nas tabelas.

## Espaçamento e layout

Grade de 4 px: `--space-1` (4), `-2` (8), `-3` (12), `-4` (16), `-6` (24), `-8` (32), `-12` (48),
`-16` (64). O espaço de dentro de um grupo é sempre menor que o espaço entre grupos.

| Passo | Uso |
| --- | --- |
| 4 | Ícone e texto dentro de um chip |
| 8 | Rótulo e valor; ícone e texto do botão; entre chips |
| 12 | Padding das células de tabela; itens de lista |
| 16 | Entre blocos dentro de um cartão; entre campos do formulário |
| 24 | Padding do cartão; entre cartões; padding do painel de detalhe |
| 32 | Margem da página; entre seções |
| 48 | Separar o bloco-resposta do resto (Início, Visão geral) |
| 64 | Respiro de topo em estados vazios |

- Barra lateral 240 px fixa; conteúdo até 1200 px com margem de 32; painel de detalhe 400 px, que
  abre por cima do conteúdo abaixo de 1280 px e fecha com Esc. Abaixo de 1024 px a barra lateral vira
  só ícones.
- Cabeçalho de 64 px (onde estou, seletor de mês, Ctrl+K); abas com 32 px entre elas.
- Cantos: 8 px em controles, 12 px em cartões, pílula em chips. Sombra só no painel de detalhe e no
  Ctrl+K; o resto é borda de 1 px.
- Botões e campos com 40 px de altura; botões pequenos 32 px; botões de importância 44 px.

## Cores

A base é a de `tokens.css`. Entraram: `--color-sunken` (trilho de barras), `--color-brand-strong`,
`--color-brand-soft` (item ativo, linha selecionada), o semáforo (`--color-ok*`, `--color-warn*`,
`--color-risk*`, fundo e texto) e as importâncias (`--color-obrigatorio`, `--color-rotina`,
`--color-impulso`, `--color-projetos`). Impulso é laranja para nunca parecer o vermelho do semáforo.
A cor só aparece onde significa algo; as cores dos bancos (roxo Nubank) só como ponto pequeno.

## Prompt para a sessão de implementação

Para abrir numa sessão nova, quando a fase do desktop estiver definida:

> Implemente o esqueleto da versão desktop do Sinal Verde seguindo `docs/rascunhos/arquitetura-desktop.md`
> (telas e navegação) e `docs/rascunhos/desktop-visual.md` (visual, tipografia, espaçamento). Os
> rascunhos HTML de cada tela estão em `docs/rascunhos/desktop-telas/` e os tokens já estão em
> `src/ui/theme/tokens.css`. Comece pelo layout (barra lateral com o Livre do dia, cabeçalho com
> seletor de mês, abas de Finanças, painel de detalhe que fecha com Esc) e pela tela Finanças › Visão
> geral, lendo dados reais pela API; use só os tokens, nada de cor ou tamanho solto no CSS. Antes de
> implementar, traga numa lista só as perguntas do "Em aberto" dos dois rascunhos que bloqueiam essas
> telas. Siga o CLAUDE.md (testes, typecheck, PR e merge quando o build passar).
