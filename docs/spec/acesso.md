# Acesso

Só eu entro no app: login Google e, no celular, a minha digital.

- **Entra aqui:** como eu entro no app e como ele se tranca.
- **Não entra aqui:** a autenticação dos webhooks e da API de dados (`SEGURANCA.md`) e a
  implementação técnica (ADR-007).

## Em aberto

(Nenhuma pergunta em aberto)

## Login

- Eu entro com a minha conta Google; nenhum outro e-mail entra. *(1)*
- Sem login, nem a tela nem a API respondem. *(1)*

## Digital no celular

- Eu posso cadastrar a minha digital no celular. *(1)*
- Num aparelho com a digital cadastrada, o app pede a digital quando eu o abro e o último uso foi
  há mais de 1 hora; cada uso renova essa hora. *(1)*
  Por quê: o celular guarda dados bancários completos; a digital é rápida o bastante para não virar atrito.
- Num aparelho sem digital cadastrada, como o computador, o login Google basta. *(1)*
- Eu posso trancar o app na hora, e ele pede a digital de novo. *(1)*
- Eu posso apagar uma digital cadastrada, por exemplo quando troco de celular. *(1)*
- Eu cadastro, tranco e apago as digitais na seção "Aparelhos" da tela Cofre. *(1)*
  Por quê: até a tela de configurações existir (fase 3), o Cofre é a única tela do app.
