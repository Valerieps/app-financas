import type { ProvisionalExpenseView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { useQuery } from '../use-query';

const text = strings.provisorios;
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const money = (cents: number, currency: string) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });

// The provisional expenses the phone's notifications created (docs/spec/gastos-provisorios.md),
// on the Cofre screen until the phone screen arrives in phase 3.
export function Provisorios() {
  const query = useQuery('provisionalExpenses', {}, []);
  const list = query.data ?? [];

  return (
    <section className="tile">
      <header>
        <h2 className="text-title">{text.title}</h2>
        <p className="muted">{text.subtitle}</p>
      </header>
      {query.error && query.error !== 'unauthenticated' && query.error !== 'locked' && (
        <p className="notice" role="alert">
          {strings.genericError}{' '}
          <button type="button" className="secondary" onClick={query.reload}>
            {strings.retry}
          </button>
        </p>
      )}
      {query.data && list.length === 0 && <p className="muted">{text.empty}</p>}
      {list.length > 0 && (
        <ul className="list stack">
          {list.map((expense) => (
            <Expense key={expense.id} expense={expense} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Expense({ expense }: { expense: ProvisionalExpenseView }) {
  const unreadable = expense.status === 'unreadable';
  return (
    <li className="row space-between align-center">
      <div>
        <strong>{unreadable ? text.unreadable : (expense.merchant ?? text.kinds[expense.kind])}</strong>{' '}
        <span className="badge">{unreadable ? text.unreadableBadge : text.badge}</span>
        <br />
        <small className="muted">
          {text.sources[expense.source]} · {text.kinds[expense.kind]} · {dateTime(expense.at)}
        </small>
        {unreadable && expense.text && (
          <>
            <br />
            <small className="muted">{expense.text}</small>
          </>
        )}
      </div>
      {expense.amountCents !== null && expense.currency && <strong>{money(expense.amountCents, expense.currency)}</strong>}
    </li>
  );
}
