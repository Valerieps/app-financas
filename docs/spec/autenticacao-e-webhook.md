# Autenticação por PIN e Entrada de Webhooks

Controle de acesso simplificado para usuária única e recebimento de automações externas.

- **Entra aqui:** as regras de definição do PIN, desbloqueio, bloqueio de tela e recebimento de webhooks.
- **Não entra aqui:** implementação técnica das sessões e rotas (`ARQUITETURA.md` e `adr/005-pin-authentication-and-session-cookie.md`).

## Em aberto

(Nenhuma pergunta em aberto)

## 1. Primeiro Acesso e PIN

- No primeiro acesso, eu posso definir um PIN numérico de 4 a 8 dígitos para proteger o app. *(1)*
- Uma vez definido, eu digito esse PIN para desbloquear o app em qualquer sessão. *(1)*
- Eu posso clicar em "Bloquear" a qualquer momento para encerrar a sessão ativa. *(1)*

## 2. Webhooks Externos

- Serviços externos (como MacroDroid ou rotinas de automação) podem enviar dados via `POST /api/webhook` com um token Bearer. *(1)*
- Quando um webhook é recebido com sucesso, o app aberto atualiza os dados em tempo real na tela. *(1)*
