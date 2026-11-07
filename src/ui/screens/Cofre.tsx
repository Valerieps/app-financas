import { useState, type FormEvent } from 'react';
import type { ConnectionView, InvestmentView, PendingConnectionView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { daysUntil } from '../../domain/vault';
import { useServices } from '../backend-context';
import { useQuery } from '../use-query';
import { Aparelhos } from './Aparelhos';
import { CofreCalendar } from './CofreCalendar';
import { Provisorios } from './Provisorios';

const text = strings.cofre;
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const money = (cents: number, currency: string) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });

// The vault screen (docs/spec/cofre-de-dados.md, "Tela Cofre"): each connection, what is stored for
// it, and what the bank did not share; this is where the owner checks 7 days of sync against Nubank.
export function Cofre({ onPasskeysChanged }: { onPasskeysChanged: () => void }) {
  const vault = useQuery('vault', {}, ['vault']);
  const connections = vault.data?.connections ?? [];
  const pending = vault.data?.pending ?? [];

  return (
    <section className="stack">
      <header>
        <h1>{text.title}</h1>
        <p className="muted">{text.subtitle}</p>
      </header>
      {vault.error === 'unauthenticated' && (
        <p className="notice" role="alert">
          {strings.forbidden}
        </p>
      )}
      {vault.error && vault.error !== 'unauthenticated' && vault.error !== 'locked' && (
        <p className="notice" role="alert">
          {strings.genericError}{' '}
          <button type="button" className="secondary" onClick={vault.reload}>
            {strings.retry}
          </button>
        </p>
      )}
      {pending.length > 0 && <PendingConnections pending={pending} />}
      {vault.data && connections.length === 0 && <p className="muted">{text.empty}</p>}
      {connections.map((connection) => (
        <Connection key={connection.itemId} connection={connection} />
      ))}
      <Provisorios />
      <AddConnection />
      <Aparelhos onChanged={onPasskeysChanged} />
    </section>
  );
}

function Connection({ connection }: { connection: ConnectionView }) {
  const { counts } = connection;
  const days = connection.consentExpiresAt ? daysUntil(new Date(), connection.consentExpiresAt) : null;
  return (
    <article className="card stack">
      <header className="row space-between align-center">
        <h2>{connection.institution ?? connection.itemId}</h2>
        {connection.status && <span className="badge">{text.status[connection.status] ?? connection.status}</span>}
      </header>
      {connection.replacedBy && <p className="muted">{text.replaced}</p>}
      {connection.lastSyncedAt ? <p>{text.lastSync(dateTime(connection.lastSyncedAt))}</p> : <p className="muted">{text.firstLoad}</p>}
      {days !== null && !connection.replacedBy && <p>{text.consentDays(days)}</p>}
      {connection.errorMessage && (
        <p className="notice" role="alert">
          {text.error(connection.errorMessage)}
        </p>
      )}
      {connection.lastError && (
        <p className="notice" role="alert">
          {text.lastError(dateTime(connection.lastError.at), connection.lastError.message)}
        </p>
      )}
      <div>
        <strong>{text.stored}</strong>
        <ul>
          <li>{text.counts.accounts(counts.accounts)}</li>
          <li>
            {text.counts.transactions(counts.transactions)}
            {counts.deletedTransactions > 0 && ` · ${text.counts.deletedTransactions(counts.deletedTransactions)}`}
          </li>
          <li>{text.counts.bills(counts.bills)}</li>
          <li>{text.counts.investments(counts.investments)}</li>
        </ul>
      </div>
      {connection.investments.length > 0 && <Investments investments={connection.investments} />}
      {connection.unavailable.length > 0 && (
        <p className="muted">
          {text.notShared}: {connection.unavailable.map((product) => text.products[product] ?? product).join(', ')}
        </p>
      )}
      <CofreCalendar itemId={connection.itemId} />
      <small className="muted">itemId {connection.itemId}</small>
    </article>
  );
}

function Investments({ investments }: { investments: readonly InvestmentView[] }) {
  return (
    <div>
      <strong>{text.investments.title}</strong>
      <ul>
        {investments.map((investment) => (
          <li key={investment.id}>
            {investment.name ?? '—'}
            {investment.issuerCnpj && <span className="muted"> · {text.investments.cnpj(investment.issuerCnpj)}</span>}
            {' · '}
            {investment.balanceCents === null ? (
              <span className="muted">{text.investments.noBalance}</span>
            ) : (
              <strong>{money(investment.balanceCents, investment.currency)}</strong>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Connections Pluggy told about that are not registered yet: one tap registers each.
function PendingConnections({ pending }: { pending: readonly PendingConnectionView[] }) {
  const { backend } = useServices();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function register(itemId: string) {
    setBusy(itemId);
    setError(null);
    const result = await backend.command('connection.add', { itemId });
    setBusy(null);
    if (result.ok) return;
    const messages: Partial<Record<string, string>> = text.add;
    setError(messages[result.error] ?? strings.genericError);
  }

  return (
    <article className="card stack">
      <h2>{text.pending.title}</h2>
      <p className="muted">{text.pending.hint}</p>
      {pending.map((connection) => (
        <div key={connection.itemId} className="row space-between align-center">
          <div>
            <p>{text.pending.seenAt(dateTime(connection.firstSeenAt))}</p>
            <small className="muted">itemId {connection.itemId}</small>
          </div>
          <button type="button" disabled={busy !== null} onClick={() => void register(connection.itemId)}>
            {text.pending.submit}
          </button>
        </div>
      ))}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function AddConnection() {
  const { backend } = useServices();
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await backend.command('connection.add', { itemId: itemId.trim() });
    setBusy(false);
    if (result.ok) {
      setItemId('');
      return;
    }
    const messages: Partial<Record<string, string>> = text.add;
    setError(messages[result.error] ?? strings.genericError);
  }

  return (
    <form className="card stack" onSubmit={(event) => void submit(event)}>
      <h2>{text.add.title}</h2>
      <p className="muted">{text.add.hint}</p>
      <label>
        <span className="muted">{text.add.field}</span>
        <input required value={itemId} onChange={(e) => setItemId(e.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <button type="submit" disabled={busy || !itemId.trim()}>
        {text.add.submit}
      </button>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
