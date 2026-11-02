// Every user-facing text, in Brazilian Portuguese, in the app's voice.
// The UI imports from here; it never writes its own text.
export const strings = {
  appName: 'Sinal Verde',
  genericError: 'Algo deu errado. Tenta de novo?',
  retry: 'Tentar de novo',
  forbidden: 'Acesso não autorizado.',

  lock: {
    title: 'App trancado',
    subtitle: 'Use a digital para abrir.',
    unlock: 'Usar a digital',
    lockNow: 'Trancar',
    cancelled: 'A digital não foi lida. Tenta de novo?',
  },

  cofre: {
    title: 'Cofre',
    subtitle: 'Tudo o que o Pluggy coletou das minhas contas.',
    connections: (n: number) => (n === 1 ? '1 conexão' : `${n} conexões`),
  },

  aparelhos: {
    title: 'Aparelhos',
    subtitle: 'Num aparelho com a digital cadastrada, o app pede a digital depois de 1 hora sem uso.',
    empty: 'Nenhuma digital cadastrada.',
    labelField: 'Nome deste aparelho',
    labelPlaceholder: 'Meu celular',
    register: 'Cadastrar a digital neste aparelho',
    unsupported: 'Este aparelho não tem leitor de digital.',
    thisDevice: 'este aparelho',
    createdAt: (date: string) => `cadastrada em ${date}`,
    lastUsedAt: (date: string) => `último uso em ${date}`,
    remove: 'Apagar',
    confirmRemove: (label: string) => `Apagar a digital de "${label}"? Esse aparelho deixa de pedir a digital.`,
  },
};
