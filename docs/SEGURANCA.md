# Segurança

As regras que todo código do app segue. Curtas de propósito: as que podem ser testadas são
conferidas pelo `src/security.test.ts`, que roda em todo build.

- **Entra aqui:** as regras de segurança e de privacidade.
- **Não entra aqui:** como cada regra foi implementada (`adr/`) e o que falta verificar (issues
  `t:debito-tecnico` e `t:vulnerability`).

## 1. Rede

- O app fala só com a própria origem (o Worker) e com as listadas em `network-policy.ts`; a CSP abre
  `connect-src` e `img-src` só para elas. O servidor (`server/`) chama só as origens de
  `SERVER_ORIGINS`.
- As chamadas de rede ficam em `src/infrastructure/`; o resto do código não as faz.
- Sem analytics nem telemetria de terceiros sem uma decisão registrada num ADR. O Wrangler roda com
  `send_metrics: false`.
- Segredos nunca vão para o código do cliente: tudo que está no bundle é público. Client ID e secret
  do Pluggy, token do bot do Telegram, chave do Gemini e segredos dos webhooks ficam só no Worker
  (`wrangler secret put`; localmente no `.dev.vars`). A API key do Pluggy é gerada sob demanda e fica
  só em memória.

## 2. Que dados o app guarda

Dado bancário completo: é tudo sensível.

- Contas, saldos, transações (com pagador e recebedor, documento e banco), faturas, investimentos,
  empréstimos, consentimentos, dados cadastrais (identidade) e o relatório do SCR do Banco Central.
- O texto bruto das notificações de compra do celular.
- Os lançamentos e os totais de cada holerite; o PDF não fica guardado e não sai para nenhum
  serviço de fora.
- As minhas decisões: categoria, importância, notas, reembolsos, regras.
- Tudo fica no D1 e no R2 da conta Cloudflare, mais o espelho noturno no desktop, com uma cópia
  criptografada fora da máquina. Tudo pode ser exportado em JSON, CSV e SQLite.
- CPF, números de conta e dados cadastrais nunca vão para logs nem para o Telegram.
- Para o Gemini vão só a descrição, o valor e a categoria do Pluggy, sem documentos de terceiros.

## 3. Acesso

- O Cloudflare Access, com login Google, fica na frente do app e da API; só o meu e-mail entra. O
  Worker confere o JWT do Access em toda requisição (ADR-007).
- Num aparelho com passkey cadastrada, o app pede a digital ao abrir; o desbloqueio vira um cookie
  `__Host-sessao` (`HttpOnly`, `Secure`, `SameSite=Lax`), e o banco guarda só o hash do token. O
  aparelho com passkey é marcado pelo cookie `__Host-aparelho`, também guardado só como hash.
- O app não acessa o banco diretamente: toda leitura e escrita passa pela API, que confere o acesso
  no servidor. Outros apps leem pela API de dados, nunca direto do D1.
- Chamadas internas ao app exigem verificação de mesma origem (`Origin`).
- Cada webhook tem o seu segredo, comparado em tempo constante: `/webhooks/pluggy`
  (`PLUGGY_WEBHOOK_SECRET`), `/webhooks/notification` (`NOTIFICATION_WEBHOOK_SECRET`) e
  `/webhooks/telegram` (token secreto do Telegram). O resto é rejeitado.

## 4. Para todo app

- Texto do usuário nunca é inserido como HTML (`textContent`, nunca `innerHTML` ou `dangerouslySetInnerHTML`).
- Links abrem com `target="_blank" rel="noopener noreferrer"`.
- Dependências mínimas, com versões exatas, instaladas com `npm ci` e empacotadas no build; nada de CDN.
- A CSP é injetada no build de produção (ADR-002) e os cabeçalhos ficam em `public/_headers`.
- Nenhum dado pessoal vai para a URL: as entradas da API vão sempre no corpo JSON.
