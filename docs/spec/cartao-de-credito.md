# Cartão de crédito

Saber o que já está comprometido nas próximas faturas e conferir se cada fatura foi paga.

- **Entra aqui:** as faturas, o pagamento de cada uma e as parcelas futuras.
- **Não entra aqui:** a coleta das faturas (`cofre-de-dados.md`), o cálculo do orçamento
  (`livre-do-dia.md`) e o que é pagamento de cartão nos totais (`lancamentos.md`).

## Em aberto

- [ ] O app deve me avisar quando o total que o Nubank informa para a fatura não bate com a soma
  das transações dela ("faltam R$ 47,90 em transações")?
- [ ] Quando o app ligar um pagamento à fatura errada, eu quero poder trocar à mão?

## Faturas

- A tela Cartão fica em Finanças e mostra uma fatura por linha, dos últimos 12 meses até as
  próximas. *(4)*
- Cada fatura mostra o período das compras (do dia da primeira ao da última compra dela), o
  vencimento, o valor e a situação: **aberta**, **a pagar**, **paga** ou **não bateu**. *(4)*
  Por quê: os gastos de um mês costumam ser pagos no mês seguinte e uma fatura junta compras de
  mais de um mês; agrupar por fatura, e não pelo mês do calendário, mostra o que cada pagamento
  quitou.
- Cada fatura mostra também quanto do valor dela é de compras parceladas. *(4)*
- No cartão, valor positivo é gasto; negativo é pagamento ou estorno. *(1)*
- Por enquanto, só o cartão do Nubank. *(4)*

## Pagamento da fatura

- O app liga cada pagamento de cartão que sai da conta a uma fatura: a mais antiga que ainda não
  está paga, fechada ou aberta. *(4)*
  Por quê: volta e meia eu adianto parte da fatura aberta para liberar limite; esse adiantamento
  pertence à fatura que ainda vai fechar.
- Uma fatura só recebe pagamentos feitos a partir da primeira compra dela e até o vencimento da
  fatura seguinte. *(4)*
  Por quê: sem esse limite, uma fatura que nunca bate ficaria com todos os pagamentos depois dela.
- A fatura aberta é a das compras que o banco ainda não pôs numa fatura, feitas depois da última
  fatura fechada. *(4)*
- Uma fatura pode ter mais de um pagamento: os adiantamentos e o pagamento depois do
  fechamento. *(4)*
- A fatura está **paga** quando a soma dos pagamentos ligados a ela bate com o valor dela, com no
  máximo R$ 0,01 de diferença. *(4)*
- Uma fatura vencida cujos pagamentos não chegam ao valor dela, ou passam dele por mais de
  R$ 0,01, fica como **não bateu** e mostra a diferença. *(4)*
- Em cada fatura eu vejo os pagamentos ligados a ela, com a data e o valor, e chego ao lançamento
  na conta com um toque. *(4)*

## Parcelas futuras

- As parcelas futuras projetam quanto dos próximos meses já está comprometido, e cada mês desconta
  as suas do orçamento. *(4)*
