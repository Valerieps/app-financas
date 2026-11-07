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
- Quando o Pluggy avisa de uma conexão que ainda não está cadastrada, o Cofre a mostra como
  "conexão nova encontrada", com um botão para cadastrar com um toque, sem copiar o itemId. *(1)*
  Por quê: o aviso do Pluggy é o único jeito de o app saber de uma conexão nova.
- Ao cadastrar uma conexão, o app baixa tudo o que ela oferece, incluindo os 12 meses de transações
  disponíveis. *(1)*
- A autorização do Meu Pluggy vence em 1 ano. Ao renovar, o Pluggy pode dar um itemId novo para a
  mesma instituição: eu cadastro o novo, e o app liga as transações às que já tem, sem duplicar. *(1)*
- Quando eu cadastro o itemId novo de uma instituição que já tem conexão, a antiga fica marcada como
  "substituída" e sai da varredura diária; as contas da nova são ligadas às da antiga pela
  instituição, pelo tipo e pelo final do número. *(1)*

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
- Uma vez por dia, às 7h de Brasília, mesmo sem aviso, o app relê contas, faturas, investimentos e
  empréstimos de todas as conexões e guarda o retrato do dia, datado pelo dia de Brasília. *(1)*
  Por quê: o Pluggy atualiza a cada 24 horas, sem hora fixa, e um aviso pode se perder.
- Na mesma varredura, o app relê as transações dos últimos 40 dias de cada conta; a que sumiu do
  Pluggy fica marcada como apagada. *(1)*
  Por quê: se um aviso de transação se perder, nada mais a recuperaria.
- O relatório do SCR é relido uma vez por mês; se o Pluggy não o liberar, ele fica como "não
  disponível". *(1)*
  Por quê: o SCR é mensal e depende de o Pluggy habilitar o recurso na conta.

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
- **As minhas decisões ficam separadas.** Categoria, importância, notas, reembolso e projeto especial
  sobrevivem a qualquer nova sincronização. *(2)*
- Valores em centavos, com a moeda sempre junto. Datas guardadas em UTC e mostradas no horário de
  Brasília. *(1)*
- Toda noite, às 23h30, uma cópia completa vai para o meu computador (`Documentos\SinalVerde-espelho`),
  com uma cópia criptografada no meu Google Drive. *(1)*

## Tela Cofre

- Eu vejo cada conexão com o status, o último sync, o erro (se houver) e quantos dias faltam para
  a autorização vencer. *(1)*
- Eu vejo quantas transações, contas, faturas e investimentos estão guardados por conexão, e o que o
  banco não compartilhou. *(1)*
  Por quê: é assim que eu confiro os 7 dias de sync sem perda contra o app do Nubank.
- Eu vejo cada investimento da conexão com o nome, o CNPJ do emissor e o saldo total de hoje. *(1)*
- Eu vejo, para cada conta da conexão (a corrente e o cartão, separados), um calendário dos últimos
  12 meses, um mês por vez, que eu troco com setinhas. Cada dia é uma bolinha com a quantidade de
  transações daquele dia. *(1)*
  Por quê: assim eu confiro dia a dia contra o extrato e a fatura do Nubank e acho o dia que falta.
- Um dia sem nenhuma transação fica com a bolinha vermelha, até eu confirmar que zero é o certo
  naquele dia; depois de confirmado, a bolinha fica neutra. Eu posso desfazer a confirmação. *(1)*
- O dia de uma transação é o dia em Brasília. *(1)*

## Saúde das conexões

- O Telegram me avisa 30, 7 e 1 dia antes de a autorização vencer, com o passo a passo da
  renovação. *(4)*
- O Telegram me avisa quando uma conexão entra em erro. *(4)*

## Várias moedas

- Transações da Wise guardam a moeda e o valor originais. *(5)*
- O orçamento usa o valor em reais: o valor que o Pluggy manda convertido para a moeda da conta ou,
  na falta dele, a cotação do dia. *(5)*
