# Rascunhos

Rascunhos de tela e briefs de implementação.

- **Entra aqui:** rascunhos de tela (HTML, imagens) e briefs, com o status de cada um na tabela abaixo.
- **Não entra aqui:** regras (o spec vence o rascunho quando eles divergem).

Quando a tela de um rascunho fica pronta, o rascunho é apagado: o código passa a ser a referência.

| Rascunho | Status |
| --- | --- |
| [arquitetura-desktop.md](arquitetura-desktop.md) | Proposta de arquitetura de informação e navegação do desktop; aguarda as respostas do "Em aberto". O esqueleto da janela e os endereços já estão no código (`src/ui/shell/`); o que ainda não existe aparece como "Em construção" |
| [desktop-visual.md](desktop-visual.md) e [desktop-telas/](desktop-telas/) | Proposta visual do desktop (psicologia financeira, tipografia, espaçamento, cores) e o rascunho de cada tela; tokens já em `tokens.css`; aguarda o "Em aberto". A barra lateral, o cabeçalho, as abas, o painel de detalhe e a Visão geral já seguem este visual, com cada bloco ainda "Em construção"; a aba Gastos virou Lançamentos e a lista já existe (`spec/lancamentos.md`), sem categoria/importância editáveis, filtros finos e seleção múltipla; Gráficos já está construída e a prancha dela saiu daqui |
