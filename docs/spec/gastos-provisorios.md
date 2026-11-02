# Gastos provisórios

Cada gasto nasce provisório pela notificação do celular e vira definitivo quando o Pluggy confirma.

- **Entra aqui:** as notificações do MacroDroid, o `/gastei`, o casamento com o Pluggy e os órfãos.
- **Não entra aqui:** como o gasto é classificado (`classificacao.md`) e o alerta no Telegram
  (`telegram.md`).

## Em aberto

(Nenhuma pergunta em aberto)

## De onde vêm

- O MacroDroid lê as notificações de compra do meu celular e manda o texto bruto, a fonte e o
  horário para o app. *(2)*
- As notificações cobrem o tempo real do Nubank e da Wise, e são a única fonte dos cartões benefício
  (Flash, Swile, Caju), que não estão no Open Finance. *(2)*
- Para dinheiro vivo, eu mando `/gastei 25 Padaria` no Telegram. *(3)*

## Provisório

- Uma notificação vira um gasto provisório, que já conta no Livre do dia e no alerta do Telegram. *(2)*
- Gastos provisórios aparecem marcados como provisórios. *(2)*

## Casamento

- Quando a transação do Pluggy chega, o app procura um provisório da mesma fonte, com o mesmo valor e
  data próxima, e casa os dois. *(2)*
- A janela de casamento é de 3 dias, e eu posso mudá-la. *(2)*
- A categoria, a caixinha e as notas do provisório passam para o definitivo. *(2)*

## Órfãos

- Um provisório sem par depois da janela vai para revisão. *(2)*
- Uma transação do Pluggy sem provisório entra normalmente, no dia em que aconteceu. *(2)*
- Cartões benefício e dinheiro vivo ficam só como provisórios: não há Pluggy para casar. *(2)*
