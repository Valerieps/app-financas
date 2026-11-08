# Spec

O que o app faz. É a fonte da verdade: quando outro documento diverge daqui, vale o spec.

- **Entra aqui:** o que o app é, para quem, os princípios, as fases e qual arquivo de `spec/` cobre
  cada feature.
- **Não entra aqui:** as regras em si (ficam em `spec/`), o que falta construir (`ROADMAP.md`) e
  como o app é construído (`ARQUITETURA.md` e `adr/`).

## O app

O Sinal Verde é o meu app pessoal de finanças. Eu tenho TDAH, e ele foi feito para eu regular os
meus gastos em tempo real sem ter que registrar nada à mão: a notificação do banco e o Pluggy fazem
o registro, e segundos depois de uma compra o Telegram me diz quanto ainda posso gastar hoje. Ele
também guarda para sempre todos os meus dados financeiros que o Pluggy deixar coletar.

A minha rotina: eu compro, o Telegram me responde com o Livre do dia e o semáforo; quando quero,
abro o app no celular, olho a cor e troco a importância de um gasto com um toque.

## Princípios

1. **Atrito zero na entrada.** Nada de abrir o app depois de pagar um café.
2. **Cegueira temporal resolvida.** O orçamento do mês vira um número tangível: quanto posso gastar hoje.
3. **Feedback na hora.** O Telegram responde segundos depois da compra, ligando a ação ao que sobra.
4. **Sem culpa.** Passar do limite hoje não quebra o mês; o excedente se espalha pelos dias seguintes.
5. **Autonomia por padrão.** A classificação é automática; eu só corrijo quando quero.
6. **Os dados são meus.** Tudo fica guardado em formatos abertos, exportável e disponível para outros apps.

## Fases

Cada fase precisa ser usável sozinha. Cada regra em `spec/` diz de que fase vale, como *(1)*.
Começar a acumular histórico vem primeiro: cada mês sem coletar é um mês que a janela de 12 meses
do Pluggy apaga.

| Fase | O que entra | Pronto quando |
| --- | --- | --- |
| 1 | **Cofre de dados:** acesso, carga inicial do Nubank, webhooks do Pluggy, varredura diária, retratos diários, espelho noturno e a tela Cofre | 7 dias seguidos de sync sem perda, conferidos contra o app do Nubank |
| 2 | **Classificação e reconciliação:** notificações do MacroDroid, gastos provisórios, casamento, categoria e importância, regras, separação do que não é gasto | 2 semanas de gastos reais com todos os provisórios casados ou explicados |
| 3 | **Feedback:** Livre do dia, bot do Telegram e a tela do semáforo | O alerta chega em menos de 3 segundos depois da notificação |
| 4 | **Visão completa:** faturas e parcelas futuras, investimentos, reembolsos, holerites, saúde das conexões, exportação e API de dados | |
| 5 | **Wise e demais conexões:** várias moedas, até o limite de 5 conexões | |

## Arquivos

| Arquivo | O que cobre |
| --- | --- |
| [spec/acesso.md](spec/acesso.md) | Login Google e a digital no celular |
| [spec/cofre-de-dados.md](spec/cofre-de-dados.md) | Coleta do Pluggy, como os dados são guardados, conexões, tela Cofre, várias moedas |
| [spec/lancamentos.md](spec/lancamentos.md) | A lista de lançamentos do mês no desktop, os filtros e o painel de detalhe |
| [spec/gastos-provisorios.md](spec/gastos-provisorios.md) | Notificações do celular, `/gastei` e o casamento com o Pluggy |
| [spec/categorias.md](spec/categorias.md) | Camadas de tags, as tags de cada lançamento e a tela Categorias |
| [spec/classificacao.md](spec/classificacao.md) | Categoria, importância, ordem de decisão, o que não é gasto, entradas e reembolsos |
| [spec/regras-automaticas.md](spec/regras-automaticas.md) | Regras "se isso, então aquilo", quando rodam e a tela Regras automáticas |
| [spec/livre-do-dia.md](spec/livre-do-dia.md) | Orçamento flexível, Livre do dia, semáforo, termômetro de impulso, custos fixos |
| [spec/telegram.md](spec/telegram.md) | Alertas e comandos do bot |
| [spec/tela-do-celular.md](spec/tela-do-celular.md) | A tela do semáforo e as configurações |
| [spec/cartao-de-credito.md](spec/cartao-de-credito.md) | Faturas e parcelas futuras |
| [spec/exportacao-e-api.md](spec/exportacao-e-api.md) | Exportação e a API de dados para outros apps |
| [spec/graficos.md](spec/graficos.md) | Para onde foi o dinheiro: gastos por categoria, por importância e ao longo do tempo, comparados com os meses anteriores |
| [spec/holerite.md](spec/holerite.md) | Envio do holerite, leitura dos lançamentos e conferência do líquido |
| [spec/_modelo.md](spec/_modelo.md) | Modelo para um arquivo de feature novo |

Os termos estão definidos em [GLOSSARIO.md](GLOSSARIO.md).
