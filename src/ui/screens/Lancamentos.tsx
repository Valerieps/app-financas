// Finanças › Lançamentos (docs/spec/lancamentos.md): every transaction of the month, money out and
// money in, by day; each row opens in the detail panel. Categoria and importância arrive with
// phase 2; the category shown is Pluggy's.
import type { LancamentoView } from '../../application/api-contract';
import { isBareDay } from '../../domain/calendar';
import { dayLabel, groupByDay, matchesFilter, parseDirectionFilter, totals, type DirectionFilter } from '../../domain/lancamentos';
import { monthKey, type Month } from '../../domain/month';
import { strings } from '../../domain/strings';
import { saoPauloDate } from '../../domain/vault';
import { Link } from '../router';
import { tabPath, withQuery } from '../shell/routes';
import { useQuery } from '../use-query';

const text = strings.lancamentos;
const FILTERS: readonly DirectionFilter[] = ['todos', 'saidas', 'entradas'];

const money = (cents: number, currency: string) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });
const signed = (item: { amountCents: number; currency: string; direction: 'in' | 'out' }) =>
  `${item.direction === 'in' ? '+ ' : ''}${money(item.amountCents, item.currency)}`;

function account(item: LancamentoView): string {
  const type = item.accountType ? text.accountTypes[item.accountType] : undefined;
  return [item.accountName, type].filter(Boolean).join(' ') || '—';
}

function LoadError({ error, reload }: { error: string | undefined; reload: () => void }) {
  if (!error || error === 'unauthenticated' || error === 'locked') return null;
  return (
    <p className="notice" role="alert">
      {strings.genericError}{' '}
      <button type="button" className="secondary" onClick={reload}>
        {strings.retry}
      </button>
    </p>
  );
}

export function Lancamentos({ month, search, selectedId }: { month: Month; search: URLSearchParams; selectedId: string | null }) {
  const query = useQuery('lancamentos', { month: monthKey(month) }, ['vault']);
  const filter = parseDirectionFilter(search.get('tipo'));
  const view = query.data?.month === monthKey(month) ? query.data : undefined;
  const items = (view?.items ?? []).filter((item) => matchesFilter(filter, item.direction));
  const monthTotals = view?.totals ?? [];
  const today = saoPauloDate(new Date());
  const listPath = tabPath('lancamentos');

  return (
    <div className="lanc">
      <section className="tile lanc-summary" aria-label={text.title}>
        <div className="lanc-totals">
          {(monthTotals.length > 0 ? monthTotals : [{ currency: 'BRL', inCents: 0, outCents: 0 }]).map((t) => (
            <dl key={t.currency} className="lanc-figures">
              <div>
                <dt className="text-over muted">{text.out}</dt>
                <dd className="text-number">{money(t.outCents, t.currency)}</dd>
              </div>
              <div>
                <dt className="text-over muted">{text.in}</dt>
                <dd className="text-number lanc-in">{money(t.inCents, t.currency)}</dd>
              </div>
              <div>
                <dt className="text-over muted">{text.balance}</dt>
                <dd className="text-number">{money(t.inCents - t.outCents, t.currency)}</dd>
              </div>
            </dl>
          ))}
        </div>
        {view && <p className="text-label muted">{text.summary(view.items.length)}</p>}
      </section>

      <section className="tile">
        <div className="lanc-toolbar" role="group" aria-label={text.filters}>
          {FILTERS.map((f) => (
            <Link
              key={f}
              to={withQuery(listPath, search, { tipo: f === 'todos' ? null : f })}
              className="chip lanc-filter"
              aria-current={f === filter ? 'true' : undefined}
            >
              {text.filter[f]}
            </Link>
          ))}
        </div>

        <LoadError error={query.error} reload={query.reload} />
        {view && items.length === 0 && <p className="muted">{view.items.length === 0 ? text.empty : text.emptyFiltered}</p>}

        {items.length > 0 && (
          <div className="lanc-table">
            <div className="lanc-row lanc-row--head text-over muted" aria-hidden="true">
              <span>{text.columns.description}</span>
              <span>{text.columns.category}</span>
              <span>{text.columns.account}</span>
              <span className="lanc-amount">{text.columns.amount}</span>
            </div>
            {groupByDay(items).map((group) => {
              const [dayTotal] = totals(group.items.filter((i) => i.currency === 'BRL'));
              return (
                <section key={group.day} aria-label={dayLabel(group.day, today, text)}>
                  <h3 className="lanc-day text-label">
                    <span>{dayLabel(group.day, today, text)}</span>
                    {dayTotal && (
                      <span className="muted">
                        {[dayTotal.inCents > 0 && `+ ${money(dayTotal.inCents, 'BRL')}`, dayTotal.outCents > 0 && money(dayTotal.outCents, 'BRL')]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </h3>
                  <ul className="lanc-list">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={withQuery(`${listPath}/${encodeURIComponent(item.id)}`, search)}
                          className="lanc-row"
                          aria-current={item.id === selectedId ? 'true' : undefined}
                          aria-label={`${text.open(item.description ?? text.noDescription)}, ${signed(item)}`}
                        >
                          <span className="lanc-description">
                            <span className="text-strong">{item.description ?? text.noDescription}</span>
                            {item.pending && <span className="chip lanc-badge">{text.pending}</span>}
                            {item.installment && (
                              <span className="text-caption muted">{text.installment(item.installment.number, item.installment.total)}</span>
                            )}
                          </span>
                          <span className="muted">{item.category ?? text.noCategory}</span>
                          <span className="muted">{account(item)}</span>
                          <span className={`lanc-amount text-strong${item.direction === 'in' ? ' lanc-in' : ''}`}>{signed(item)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'medium', timeStyle: 'short' });

/** The detail panel of one lançamento: what the bank told about it. Nothing is edited yet. */
export function LancamentoDetail({ id }: { id: string }) {
  const query = useQuery('lancamento', { id }, ['vault']);
  const item = query.data?.id === id ? query.data : undefined;
  const d = text.detail;

  if (query.error === 'not_found') return <p className="muted">{d.notFound}</p>;
  if (!item) return <LoadError error={query.error} reload={query.reload} />;

  const rows: [string, string | null][] = [
    [d.when, isBareDay(item.date) ? dayLabel(item.day, saoPauloDate(new Date()), text) : dateTime(item.date)],
    [d.account, account(item)],
    [d.category, item.category],
    [d.status, item.pending ? d.pending : d.posted],
    [item.direction === 'in' ? d.counterpartIn : d.counterpartOut, item.counterpart],
    [d.operation, [item.operationType, item.paymentMethod].filter(Boolean).join(' · ') || null],
    [d.installment, item.installment && `${item.installment.number}/${item.installment.total}`],
    [d.card, item.cardDigits],
    [d.bankText, item.descriptionRaw],
    [d.firstSeen, dateTime(item.firstSeenAt)],
  ];

  return (
    <div className="lanc-detail">
      <div>
        <p className="text-over muted">{item.direction === 'in' ? d.in : d.out}</p>
        <p className={`text-number${item.direction === 'in' ? ' lanc-in' : ''}`}>{signed(item)}</p>
        <p className="text-strong">{item.description ?? text.noDescription}</p>
      </div>
      <dl className="lanc-facts">
        {rows
          .filter((row): row is [string, string] => Boolean(row[1]))
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-label muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
