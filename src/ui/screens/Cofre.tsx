import { strings } from '../../domain/strings';
import { useQuery } from '../use-query';

// The vault screen (docs/spec/cofre-de-dados.md). For now it only says how many connections exist.
export function Cofre() {
  const vault = useQuery('vault', {}, ['vault']);

  return (
    <section className="stack">
      <header>
        <h1>{strings.cofre.title}</h1>
        <p className="muted">{strings.cofre.subtitle}</p>
      </header>
      {vault.error === 'unauthenticated' && (
        <p className="notice" role="alert">
          {strings.forbidden}
        </p>
      )}
      {vault.error && vault.error !== 'unauthenticated' && (
        <p className="notice" role="alert">
          {strings.genericError}{' '}
          <button type="button" className="secondary" onClick={vault.reload}>
            {strings.retry}
          </button>
        </p>
      )}
      {vault.data && <p className="badge">{strings.cofre.connections(vault.data.connectionCount)}</p>}
    </section>
  );
}
