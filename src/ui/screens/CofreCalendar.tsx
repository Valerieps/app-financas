import { useState } from 'react';
import type { CalendarAccountView } from '../../application/api-contract';
import { addMonths, dayState, monthGrid } from '../../domain/calendar';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { useQuery } from '../use-query';

const text = strings.cofre.calendar;
const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const dayName = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });

// One connection's last 12 months, one month at a time, a dot per day with that day's transactions
// (docs/spec/cofre-de-dados.md, "Tela Cofre"). An empty day is red until the owner confirms it.
export function CofreCalendar({ itemId }: { itemId: string }) {
  const calendar = useQuery('calendar', { itemId }, ['vault']);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const data = calendar.data;
  if (!data) return null;
  if (data.accounts.length === 0) return <p className="muted">{text.noAccounts}</p>;

  const account = data.accounts.find((a) => a.id === accountId) ?? data.accounts[0]!;
  const first = data.from.slice(0, 7);
  const last = data.to.slice(0, 7);
  const shown = month ?? last;
  const go = (months: number) => {
    setMonth(addMonths(shown, months));
    setSelected(null);
  };

  return (
    <div className="stack">
      <div>
        <strong>{text.title}</strong>
        <p className="muted calendar-hint">{text.hint}</p>
      </div>
      {data.accounts.length > 1 && (
        <div className="row calendar-accounts" role="group" aria-label={text.account}>
          {data.accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              className="secondary"
              aria-pressed={a.id === account.id}
              onClick={() => {
                setAccountId(a.id);
                setSelected(null);
              }}
            >
              {accountLabel(a)}
            </button>
          ))}
        </div>
      )}
      <div className="row space-between align-center calendar-nav">
        <button type="button" className="secondary" aria-label={text.previous} disabled={shown <= first} onClick={() => go(-1)}>
          ‹
        </button>
        <span className="calendar-month">{monthName(shown)}</span>
        <button type="button" className="secondary" aria-label={text.next} disabled={shown >= last} onClick={() => go(1)}>
          ›
        </button>
      </div>
      <div className="calendar-grid" role="grid">
        {text.weekdays.map((weekday, i) => (
          <span key={i} className="calendar-weekday muted" aria-hidden="true">
            {weekday}
          </span>
        ))}
        {monthGrid(shown)
          .flat()
          .map((day, i) => {
            if (!day) return <span key={i} />;
            const count = account.counts[day] ?? 0;
            const state = dayState(day, data, count, account.confirmedEmpty.includes(day));
            return (
              <div key={day} className="calendar-day">
                <span className="calendar-date muted">{Number(day.slice(8))}</span>
                {state === 'outside' ? (
                  <span className={`calendar-dot calendar-dot--outside`} />
                ) : (
                  <button
                    type="button"
                    className={`calendar-dot calendar-dot--${state}`}
                    aria-pressed={selected === day}
                    aria-label={text.dayLabel(dayName(day), count)}
                    onClick={() => setSelected(selected === day ? null : day)}
                  >
                    {count}
                  </button>
                )}
              </div>
            );
          })}
      </div>
      {selected && <SelectedDay day={selected} account={account} />}
    </div>
  );
}

function SelectedDay({ day, account }: { day: string; account: CalendarAccountView }) {
  const { backend } = useServices();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const count = account.counts[day] ?? 0;
  const confirmed = account.confirmedEmpty.includes(day);

  async function toggle() {
    setBusy(true);
    setError(false);
    const result = await backend.command('day.confirmEmpty', { accountId: account.id, day, confirmed: !confirmed });
    setBusy(false);
    if (!result.ok) setError(true);
  }

  return (
    <div className="notice stack">
      <span>
        <strong>{dayName(day)}</strong> · {accountLabel(account)}
      </span>
      {count > 0 ? (
        <span>{text.some(count)}</span>
      ) : (
        <div className="row space-between align-center calendar-confirm">
          <span>{confirmed ? text.confirmed : text.missing}</span>
          <button type="button" className={confirmed ? 'secondary' : undefined} disabled={busy} onClick={() => void toggle()}>
            {confirmed ? text.undo : text.confirm}
          </button>
        </div>
      )}
      {error && <span role="alert">{strings.genericError}</span>}
    </div>
  );
}

function accountLabel(account: CalendarAccountView): string {
  const type = account.type ? text.accountTypes[account.type] : undefined;
  return type && account.name ? `${type} · ${account.name}` : (account.name ?? type ?? text.account);
}
