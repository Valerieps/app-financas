// Every user-facing text, in Brazilian Portuguese, in the app's voice.
// The UI imports from here; it never writes its own text.
export const strings = {
  appName: 'Sinal Verde',
  genericError: 'Algo deu errado. Tenta de novo?',
  retry: 'Tentar de novo',
  forbidden: 'Acesso não autorizado.',

  cofre: {
    title: 'Cofre',
    subtitle: 'Tudo o que o Pluggy coletou das minhas contas.',
    connections: (n: number) => (n === 1 ? '1 conexão' : `${n} conexões`),
  },
};
