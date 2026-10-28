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
- Segredos nunca vão para o código do cliente: tudo que está no bundle é público. O segredo do login
  Google, e qualquer chave de API, ficam só no Worker (`wrangler secret put`; localmente no `.dev.vars`).
- <O `BOOTSTRAP.md` escreve aqui quais dados pessoais o app guarda e se algum é sensível.>

## 2. Acesso e dados

- O acesso é protegido por um PIN numérico (4 a 8 dígitos) configurado na primeira execução.
- A sessão autenticada é guardada em um cookie `__Host-sessao` (`HttpOnly`, `Secure`, `SameSite=Lax`, 180 dias); o banco guarda apenas o hash SHA-256 do token de sessão.
- Bloquear o app (`/api/auth/lock`) apaga o token de sessão do banco e limpa o cookie imediatamente.
- O app não acessa o banco diretamente: toda leitura e escrita passa pela API sob verificação da sessão.
- Chamadas internas ao app exigem verificação de mesma origem (`Origin`).
- Webhooks externos (`/api/webhook`) exigem o cabeçalho `Authorization: Bearer <WEBHOOK_SECRET>`, comparado em tempo constante (`constantTimeEqual`).

## 3. Para todo app

- Texto do usuário nunca é inserido como HTML (`textContent`, nunca `innerHTML` ou `dangerouslySetInnerHTML`).
- Links abrem com `target="_blank" rel="noopener noreferrer"`.
- Dependências mínimas, com versões exatas, instaladas com `npm ci` e empacotadas no build; nada de CDN.
- A CSP é injetada no build de produção (ADR-002) e os cabeçalhos ficam em `public/_headers`.
- Nenhum dado pessoal vai para a URL: as entradas da API vão sempre no corpo JSON.
