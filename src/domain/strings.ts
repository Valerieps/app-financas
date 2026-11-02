// Every user-facing text, in Brazilian Portuguese, in the app's voice.
// The UI imports from here; it never writes its own text.
export const strings = {
  appName: 'Sinal Verde',
  genericError: 'Algo deu errado. Tenta de novo?',
  retry: 'Tentar de novo',
  forbidden: 'Acesso não autorizado.',
  offline: 'Sem conexão. Mostrando o último estado carregado.',

  auth: {
    tagline: 'Quanto posso gastar hoje, sem culpa.',
    setupTitle: 'Defina seu PIN de acesso',
    setupSubtitle: 'Escolha um PIN de 4 a 8 dígitos para proteger seu app.',
    unlockTitle: 'Digite seu PIN',
    unlockSubtitle: 'Insira seu PIN para desbloquear o app.',
    pinLabel: 'PIN numérico',
    submitSetup: 'Criar PIN e Entrar',
    submitUnlock: 'Desbloquear',
    invalidPin: 'O PIN deve ter entre 4 e 8 dígitos numéricos.',
    wrongPin: 'PIN incorreto. Tente novamente.',
    alreadyConfigured: 'O PIN já foi configurado.',
    lock: 'Bloquear',
  },

  nav: {
    main: 'Navegação principal',
    home: 'Início',
    lock: 'Bloquear',
    liveConnected: 'Conectado em tempo real',
    liveDisconnected: 'Reconectando...',
  },

  home: {
    title: 'Painel Pessoal',
    subtitle: 'Template Cloudflare Workers + SQLite + Conexão ao Vivo + Webhook',
    addItem: 'Adicionar Item',
    itemPlaceholder: 'Título do novo item...',
    add: 'Adicionar',
    empty: 'Nenhum item cadastrado ainda.',
    delete: 'Excluir',
    webhookCard: 'Webhook em Tempo Real',
    webhookDesc: 'Envie eventos externos (MacroDroid, Tasker, Shortcuts, cURL) para atualizar o app instantaneamente.',
    webhookExample: 'Exemplo de chamada cURL:',
  },
};
