# Spec

O que o app faz. É a fonte da verdade: quando outro documento diverge daqui, vale o spec.

- **Entra aqui:** o que o app é, para quem, as fases e qual arquivo de `spec/` cobre cada feature.
- **Não entra aqui:** as regras em si (ficam em `spec/`), o que falta construir (`ROADMAP.md`) e
  como o app é construído (`ARQUITETURA.md` e `adr/`).

## O app

Um aplicativo pessoal seguro e reativo, projetado para automações e uso individual no celular ou computador.

## Fases

Cada fase precisa ser usável sozinha. Cada regra em `spec/` diz de que fase vale, como *(1)*.

| Fase | O que entra |
| --- | --- |
| 1 | Autenticação por PIN, Webhook de entrada, reatividade ao vivo e painel de itens |
| 2 | Funcionalidades específicas do app pessoal definidas no bootstrap |

## Arquivos

| Arquivo | O que cobre |
| --- | --- |
| [spec/autenticacao-e-webhook.md](spec/autenticacao-e-webhook.md) | Proteção por PIN e integração com webhooks externos |
| [spec/_modelo.md](spec/_modelo.md) | Modelo para um arquivo de feature novo |

Os termos estão definidos em [GLOSSARIO.md](GLOSSARIO.md).
