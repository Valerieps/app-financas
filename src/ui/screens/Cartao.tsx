// Finanças › Cartão (docs/spec/cartao-de-credito.md): one card bill per row, its status, how much
// of it is installments, and the payments from the bank account linked to it.
import type { BillView } from '../../application/api-contract';
import { money, moneyDiff } from '../../domain/money';
import { strings } from '../../domain/strings';
import { Link } from '../router';
import { tabPath, withMonth } from '../shell/routes';
import { useQuery } from '../use-query';

const text = strings.cartao;

/** "05/10" from yyyy-mm-dd. */
const short = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function Cartao() {
  const query = useQuery('cartao', {}, ['vault']);
  const bills = query.data?.bills ?? [];

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
      {query.data && bills.length === 0 && <p className="muted">{text.empty}</p>}
      {bills.length > 0 && (
        <ul className="bill-list">
          {bills.map((bill) => (
            <Bill key={bill.id} bill={bill} />
          ))}
        </ul>
      )}
    </section>
  );
}

function title(bill: BillView): string {
  if (!bill.dueDay) return text.openBill;
  return text.bill(Number(bill.dueDay.slice(5, 7)), Number(bill.dueDay.slice(0, 4)));
}

function Bill({ bill }: { bill: BillView }) {
  const facts = [
    bill.dueDay ? text.due(short(bill.dueDay)) : null,
    bill.firstDay && bill.lastDay ? text.period(short(bill.firstDay), short(bill.lastDay)) : text.noPurchases,
    bill.installmentCents !== 0 ? text.installments(money(bill.installmentCents)) : null,
  ].filter((f): f is string => f !== null);
  const showDifference = bill.status === 'nao-bateu' && bill.differenceCents !== null;

  return (
    <li className="bill">
      <div className="bill-head">
        <div className="bill-name">
          <span className="text-strong">{title(bill)}</span>
          <span className={`chip bill-status bill-status--${bill.status}`}>{text.status[bill.status]}</span>
        </div>
        <span className="text-strong num">{bill.totalCents === null ? text.noValue : money(bill.totalCents)}</span>
      </div>
      <p className="text-caption muted">{facts.join(' · ')}</p>
      {bill.payments.length > 0 ? (
        <ul className="bill-payments">
          {bill.payments.map((payment) => (
            <li key={payment.id}>
              <Link
                to={withMonth(`${tabPath('lancamentos')}/${encodeURIComponent(payment.id)}`, payment.day.slice(0, 7))}
                className="bill-payment text-label"
                aria-label={text.openPayment(money(payment.amountCents), short(payment.day))}
              >
                <span className="muted">{short(payment.day)}</span>
                <span>{payment.accountName ?? ''}</span>
                <span className="num">{money(payment.amountCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        bill.dueDay && <p className="text-caption muted">{text.noPayments}</p>
      )}
      {showDifference && (
        <p className="text-label bill-difference">
          {text.paid(money(bill.paidCents))} · {text.difference(moneyDiff(bill.differenceCents!))}
        </p>
      )}
    </li>
  );
}
