# Glossário

Um termo, um sentido. Estes nomes valem para os textos da interface e para as docs.

- **Entra aqui:** cada termo do app, com uma definição curta e o arquivo de `spec/` que o usa.
- **Não entra aqui:** as regras em si, que ficam em `spec/`. Se uma definição daqui e uma regra divergirem, vale o spec, e o termo daqui é corrigido.

- **Caixinha:** uma parte do saldo de uma conta ou de um investimento, separada para um projeto, com alvo e prazo opcionais. Não confundir com importância. (`rascunhos/arquitetura-desktop.md`, até virar spec)
- **Camada:** um grupo de tags com um sentido só, como "Tipo" ou "Impulso ou planejado". Até 5. (`spec/categorias.md`)
- **Casamento:** a ligação entre um gasto provisório e a transação do Pluggy que o confirma. (`spec/gastos-provisorios.md`)
- **Categoria:** o que um gasto é (Mercado, Restaurante, Assinatura). Parte da árvore do Pluggy. (`spec/classificacao.md`)
- **Cofre:** a tela que mostra cada conexão e o que está guardado dela. (`spec/cofre-de-dados.md`)
- **Conexão:** a ligação de uma instituição (Nubank, Wise) pelo Meu Pluggy, identificada por um itemId. (`spec/cofre-de-dados.md`)
- **Custo fixo:** gasto recorrente previsto, descontado do orçamento antes do Livre do dia. (`spec/livre-do-dia.md`)
- **Digital:** a trava do app no celular; uma passkey confirmada com a impressão digital. (`spec/acesso.md`)
- **Gasto definitivo:** gasto confirmado pelo Pluggy. (`spec/gastos-provisorios.md`)
- **Gasto provisório:** gasto criado por uma notificação do celular ou pelo `/gastei`, antes da confirmação do Pluggy. (`spec/gastos-provisorios.md`)
- **Holerite:** o demonstrativo de pagamento mensal da empresa, enviado em PDF. (`spec/holerite.md`)
- **Importância:** como eu julgo um gasto: Obrigatório, Rotina, Impulso ou Projetos especiais. Alimenta o orçamento e o semáforo. Não confundir com categoria nem com caixinha. (`spec/classificacao.md`)
- **Lançamento:** toda transação de uma conta ou de um cartão, de saída (gasto) ou de entrada (crédito). Dá nome à aba Lançamentos. (`spec/lancamentos.md`)
- **Lançamento do holerite:** uma linha do holerite, com código, descrição, tipo e valor, de vencimento ou de desconto. (`spec/holerite.md`)
- **Livre do dia:** quanto eu posso gastar hoje sem prejudicar o mês. (`spec/livre-do-dia.md`)
- **Orçamento flexível:** a renda líquida menos custos fixos, parcelas do mês e meta de reserva. (`spec/livre-do-dia.md`)
- **Órfão:** gasto provisório que não casou com nenhuma transação do Pluggy dentro da janela. (`spec/gastos-provisorios.md`)
- **Pagamento de cartão:** o débito na conta que paga a fatura do cartão e o crédito que entra no cartão por ele. Fica fora dos totais de Lançamentos. (`spec/lancamentos.md`)
- **Projetos especiais:** a importância que fica fora do orçamento. (`spec/classificacao.md`)
- **Renovação:** a autorização anual do Meu Pluggy, que precisa ser renovada para a coleta continuar. (`spec/cofre-de-dados.md`)
- **Retrato do dia:** os saldos e as posições de investimento guardados uma vez por dia. (`spec/cofre-de-dados.md`)
- **Semáforo:** verde, amarelo ou vermelho, conforme o gasto de hoje comparado com o Livre do dia. (`spec/livre-do-dia.md`)
- **Tag:** um valor dentro de uma camada, como Mercado na camada Tipo. Um lançamento tem no máximo uma tag de cada camada. (`spec/categorias.md`)
- **Termômetro de impulso:** a soma do mês na importância Impulso contra o teto que eu defino. (`spec/livre-do-dia.md`)
