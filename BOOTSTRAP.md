# Bootstrap

Roteiro da primeira sessão com o Claude Code / Antigravity num repositório criado a partir deste template.
Para começar, abra o assistente na pasta do repositório e diga: **"leia o BOOTSTRAP.md e siga"**.

- **Entra aqui:** a entrevista inicial e os passos para transformar o template num app pessoal.
- **Não entra aqui:** regras específicas do app (vão para `docs/spec/`) e decisões técnicas (`docs/adr/`).

Este arquivo é apagado no fim do bootstrap.

## O que já vem pronto

Um app web pessoal com backend serverless:
- **Proteção por PIN:** tela de PIN numérico simplificada com cookie de sessão duradoura (180 dias).
- **Entrada para Webhooks:** endpoint `/api/webhook` pronto para receber notificações externas (MacroDroid, Tasker, iOS Shortcuts, n8n, cURL) com chave de autorização Bearer.
- **Atualização ao Vivo:** WebSocket nativo com Hibernation API via Durable Object (reatividade instantânea).
- **Persistência Serverless:** SQLite transacional síncrono embutido no Durable Object.
- **Automação:** Cron trigger de 5 em 5 minutos para tarefas agendadas em segundo plano.

Ver `docs/ARQUITETURA.md` e `docs/SEGURANCA.md`.

## Instruções para o Assistente

Faça a entrevista abaixo numa mensagem só, com as perguntas numeradas, e espere as respostas.
Depois siga os passos em uma branch `bootstrap` e abra um PR.

## 1. Entrevista

**O app**
1. Qual é o nome do app? E o endereço que você quer (`<nome>.<sua-conta>.workers.dev` ou um domínio seu)?
2. Que problema pessoal ele resolve? Qual é a sua rotina diária de uso nele?
3. Qual é a menor versão que já seria útil (o MVP pessoal)? E o que vem depois, em fases?
4. Que palavras você usa para as coisas do app? (Elas viram o glossário e os textos da interface em `strings.ts`.)

**Dados e integrações**
5. Que dados o app guarda? Algum é sensível (saúde, dinheiro, rotina)? Precisa exportar os dados (JSON/CSV)?
6. O app precisa falar com outros serviços (APIs externas, webhook de entrada, Telegram Bot, notificações)? Cada saída vira uma origem em `network-policy.ts` e um ADR.
7. Algo precisa acontecer sozinho com o tempo (lembretes diários, recálculos na virada do dia, fechamentos)? Em que fuso horário?

**Aparelhos e visual**
8. Em que aparelho você mais vai usar: celular Android/iOS, computador? Precisa ser instalável na tela de início (PWA)?
9. Quais cores ou clima visual combinam com o app? (Virão nos tokens em `tokens.css`.)

**Como você trabalha**
10. Quer que eu teste no navegador depois de cada mudança, ou só com o typecheck e os testes (`npm test`)?
11. Quer que eu faça o merge dos meus PRs quando o build passar?

## 2. Passos depois da entrevista

1. **Nome:** `package.json` (`name`), `wrangler.jsonc` (`name`), `index.html` (`<title>`), `public/manifest.webmanifest`, `strings.appName` e `strings.auth.tagline` em `src/domain/strings.ts`, títulos do `CLAUDE.md` e do `README.md`.
2. **Rede:** cada serviço externo da resposta 6 vai para `SERVER_ORIGINS` em `network-policy.ts`, com um ADR. Escreva em `docs/SEGURANCA.md` quais dados o app guarda.
3. **Produto:** escreva o `docs/SPEC.md` (o que o app é, as fases) e um arquivo em `docs/spec/` por feature da primeira fase, em primeira pessoa na sua voz.
4. **Termos:** `docs/GLOSSARIO.md` com as palavras da pergunta 4.
5. **Roadmap:** `docs/ROADMAP.md` com as features da primeira fase como "falta construir".
6. **Arquitetura:** o parágrafo de abertura do `CLAUDE.md`; as tabelas novas em `docs/ARQUITETURA.md` e a primeira migration em `server/application/schema.ts`.
7. **Identidade:** cores em `src/ui/theme/tokens.css`, e as mesmas em `index.html` e manifest (`src/app-identity.test.ts` confere).
8. **Exemplo:** troque a tela `Home.tsx` e o starter entity pela primeira tela real do app.
9. **Verificação:** `npm run build` e `npm run docs:check` passam.
10. **Fim:** apague este arquivo e a seção "Usar o template" do `README.md`, e abra o PR.

## 3. O que só a dona faz

1. **Configuração de Segredos:**
   * Defina a chave do webhook: `npx wrangler secret put WEBHOOK_SECRET` e adicione em `.dev.vars` para desenvolvimento local.
2. **Cloudflare:**
   * Em `dash.cloudflare.com` > Workers & Pages > Create > Import a repository: conecte o repositório.
   * Build command: `npm run build`
   * Deploy command: `npx wrangler deploy`
3. **Conferir no celular:**
   * Abrir o app no navegador mobile, definir o primeiro PIN e testar a instalação como PWA.
