# Cofre de dados

Guardar para sempre tudo o que o Pluggy deixar coletar das minhas contas, sem perder nada.

- **Entra aqui:** as conexões, o que é coletado do Pluggy e quando, como os dados são guardados, a
  tela Cofre e as várias moedas.
- **Não entra aqui:** as notificações do celular (`gastos-provisorios.md`), a classificação
  (`classificacao.md`), os comandos do Telegram (`telegram.md`) e a exportação (`exportacao-e-api.md`).

## Em aberto

(Nenhuma pergunta em aberto)

## Conexões

- As minhas conexões são o Nubank (fase 1) e a Wise (fase 5), pelo Meu Pluggy, até o limite de 5. *(1)*
- Eu cadastro cada conexão com o itemId copiado do Pluggy Dashboard. *(1)*
  Por quê: o Meu Pluggy não lista as conexões pela API.
- Ao cadastrar uma conexão, o app baixa tudo o que ela oferece, incluindo os 12 meses de transações
  disponíveis. *(1)*
- A autorização do Meu Pluggy vence em 1 ano. Ao renovar, o Pluggy pode dar um itemId novo para a
  mesma instituição: eu cadastro o novo, e o app liga as transações às que já tem, sem duplicar. *(1)*

## O que é coletado

Para cada conexão, o app coleta todos estes produtos. O que o banco não compartilhar fica marcado
como "não disponível", não como erro. *(1)*

- A conexão (status, erro, vencimento da autorização, último sync), o que o banco declarou
  compartilhar e os consentimentos.
- Contas (corrente, poupança, cartão) com saldos e limite, e o saldo em tempo real.
- Transações, com todos os campos que o Pluggy devolve.
- Faturas do cartão.
- Investimentos, com as aplicações e os resgates de cada um.
- Empréstimos.
- Dados cadastrais.
- A árvore de categorias do Pluggy.
- O relatório do SCR do Banco Central.

Fora do escopo: pagamentos, Pix Automático, boletos e Smart Transfers.

## Quando é coletado

- Quando o Pluggy avisa que algo mudou numa conexão ou nas transações, o app relê da API o estado
  atual da conta, em vez de deduzir pelo aviso. *(1)*
- Um aviso repetido do Pluggy não tem efeito duplicado. *(1)*
- Uma vez por dia, mesmo sem aviso, o app relê contas, faturas, investimentos e empréstimos de
  todas as conexões e guarda o retrato do dia. *(1)*
  Por quê: o Pluggy atualiza a cada 24 horas, sem hora fixa, e um aviso pode se perder.

## Como os dados são guardados

- **Bruto primeiro.** Toda resposta do Pluggy e todo webhook é guardado inteiro antes de qualquer
  processamento. *(1)*
  Por quê: assim tudo pode ser reprocessado quando a normalização mudar.
- **Histórico, não sobrescrita.** Quando um registro muda, a versão anterior fica guardada. Saldos e
  posições de investimento viram séries diárias. *(1)*
- **Nada é apagado.** Uma transação que o Pluggy apaga fica marcada como apagada; ela pode voltar
  no sync seguinte. *(1)*
- **Uma transação, um registro.** No cartão, quando a data, o valor ou a descrição mudam, o Pluggy
  devolve a mesma transação com outro id; o app a reconhece e não duplica. *(1)*
- **As minhas decisões ficam separadas.** Categoria, caixinha, notas, reembolso e projeto especial
  sobrevivem a qualquer nova sincronização. *(2)*
- Valores em centavos, com a moeda sempre junto. Datas guardadas em UTC e mostradas no horário de
  Brasília. *(1)*
- Toda noite, uma cópia completa vai para o meu computador, com uma cópia criptografada fora dele. *(1)*

## Tela Cofre

- Eu vejo cada conexão com o status, o último sync, o erro (se houver) e quantos dias faltam para
  a autorização vencer. *(1)*
- Eu vejo quantas transações, contas, faturas e investimentos estão guardados por conexão, e o que o
  banco não compartilhou. *(1)*
  Por quê: é assim que eu confiro os 7 dias de sync sem perda contra o app do Nubank.

## Saúde das conexões

- O Telegram me avisa 30, 7 e 1 dia antes de a autorização vencer, com o passo a passo da
  renovação. *(4)*
- O Telegram me avisa quando uma conexão entra em erro. *(4)*

## Várias moedas

- Transações da Wise guardam a moeda e o valor originais. *(5)*
- O orçamento usa o valor em reais: o valor que o Pluggy manda convertido para a moeda da conta ou,
  na falta dele, a cotação do dia. *(5)*
