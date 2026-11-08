// Finanças › Gráficos (docs/spec/graficos.md): reading, not editing. Each chart sits next to a table
// of the same numbers, and a bar leads to the gastos behind it.
import type { ChangeEvent } from 'react';
import { parseMonth } from '../../domain/month';
import { money, moneyDiff, moneyShort, moneyWhole } from '../../domain/money';
import { below, furthestAbove, trend, type CategoryChart, type Comparison, type MonthlyChart } from '../../domain/spending';
import { strings } from '../../domain/strings';
import { Link, navigate } from '../router';
import { EmConstrucao } from '../shell/EmConstrucao';
import { GRAFICOS_CHARTS, graficosPath, tabPath, withQuery, type GraficosChart } from '../shell/routes';
import { useQuery } from '../use-query';

const text = strings.graficos;

/** `comparar` in the URL: absent for the average, `mes-anterior` for the month before. */
const PREVIOUS = 'mes-anterior';
const NO_PARAMS = new URLSearchParams();

export function Graficos({
  chart,
  month,
  monthParam,
  compareParam,
}: {
  chart: GraficosChart;
  /** The selected month, yyyy-mm. */
  month: string;
  monthParam: string | null;
  compareParam: string | null;
}) {
  const compare: Comparison = compareParam === PREVIOUS ? 'previous' : 'average';
  const link = (to: GraficosChart, over: { mes?: string | null; comparar?: string | null } = {}) =>
    withQuery(graficosPath(to), NO_PARAMS, { mes: monthParam, comparar: compare === 'previous' ? PREVIOUS : null, ...over });

  const onCompare = (event: ChangeEvent<HTMLSelectElement>) =>
    navigate(link(chart, { comparar: event.target.value === 'previous' ? PREVIOUS : null }), { replace: true });

  return (
    <div className="charts">
      <div className="charts-bar">
        <nav className="segs" aria-label={text.chartsLabel}>
          {GRAFICOS_CHARTS.map((c) => (
            <Link key={c} to={link(c)} className="segs-item" aria-current={c === chart ? 'page' : undefined}>
              {text.charts[c]}
            </Link>
          ))}
        </nav>
        {chart === 'categoria' && (
          <label className="text-label muted charts-compare">
            {text.compareLabel}
            <select value={compare} onChange={onCompare}>
              <option value="average">{text.compare.average}</option>
              <option value="previous">{text.compare.previous}</option>
            </select>
          </label>
        )}
      </div>
      {chart === 'categoria' && <PorCategoria month={month} monthParam={monthParam} compare={compare} />}
      {chart === 'importancia' && <EmConstrucao title={text.importancia.title} hint={text.importancia.hint} tall />}
      {chart === 'tempo' && <AoLongoDoTempo month={month} link={(mes) => link('categoria', { mes })} />}
    </div>
  );
}

function Failure({ error, reload }: { error: string; reload: () => void }) {
  if (error === 'locked') return null;
  return (
    <p className="notice" role="alert">
      {error === 'unauthenticated' ? strings.forbidden : strings.genericError}{' '}
      {error !== 'unauthenticated' && (
        <button type="button" className="secondary" onClick={reload}>
          {strings.retry}
        </button>
      )}
    </p>
  );
}

const monthNumber = (key: string) => parseMonth(key)?.month ?? 1;
const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '');

function PorCategoria({ month, monthParam, compare }: { month: string; monthParam: string | null; compare: Comparison }) {
  const query = useQuery('spendingByCategory', { month, compare }, ['vault', 'categories']);
  const data = query.data;
  if (query.error && !data) return <Failure error={query.error} reload={query.reload} />;
  if (!data) return <p className="muted">{text.loading}</p>;
  return <CategoryView chart={data} monthParam={monthParam} />;
}

function CategoryView({ chart, monthParam }: { chart: CategoryChart; monthParam: string | null }) {
  const t = text.categoria;
  const name = (id: CategoryChart['rows'][number]['category']) => strings.categories[id];
  const hasBaseline = chart.baselineTotalCents !== null;
  const top = furthestAbove(chart.rows);

  let answer: string;
  if (chart.throughDay === 0) answer = t.future;
  else if (chart.rows.every((r) => r.cents === 0)) answer = t.empty;
  else if (!hasBaseline) answer = t.noBaseline;
  else if (top) answer = t.above(name(top.category), moneyWhole(top.cents - (top.baselineCents ?? 0)), chart.compare);
  else answer = t.noneAbove(chart.compare);

  const detail = hasBaseline
    ? [t.period(chart.throughDay, chart.compareMonths.map(monthNumber), chart.compare), t.below(below(chart.rows).map(name))].filter(Boolean).join(' ')
    : null;

  const scale = Math.max(1, ...chart.rows.map((r) => Math.max(r.cents, r.baselineCents ?? 0)));
  const width = (cents: number) => `${(Math.max(0, cents) / scale) * 100}%`;
  const lancamentos = (category: string) => withQuery(tabPath('lancamentos'), NO_PARAMS, { categoria: category, mes: monthParam });
  const lastCompared = chart.compareMonths[chart.compareMonths.length - 1];

  return (
    <>
      <section className="charts-answer">
        <h2 className="text-title">{answer}</h2>
        {detail && <p className="muted">{detail}</p>}
      </section>
      {chart.rows.length > 0 && (
        <div className="charts-pair">
          <section className="tile" aria-label={t.chartLabel}>
            <div className="charts-legend text-label muted">
              <span className="charts-legend-item">
                <span className="charts-swatch" aria-hidden="true" />
                {t.legendMonth(monthNumber(chart.month), chart.throughDay)}
              </span>
              {hasBaseline && lastCompared && (
                <span className="charts-legend-item">
                  <span className="charts-tick" aria-hidden="true" />
                  {t.legendBaseline(chart.compare, monthNumber(lastCompared), chart.throughDay)}
                </span>
              )}
            </div>
            <div className="hbars">
              {chart.rows.map((row) => (
                <Link
                  key={row.category}
                  to={lancamentos(row.category)}
                  className={`hbar${top?.category === row.category ? ' hbar--warn' : ''}`}
                  title={t.barTitle(name(row.category))}
                >
                  <span className="text-label">{name(row.category)}</span>
                  <span className="hbar-track">
                    <i style={{ width: width(row.cents) }} />
                    {row.baselineCents !== null && <b style={{ left: width(row.baselineCents) }} />}
                  </span>
                  <span className="text-label num">{moneyShort(row.cents)}</span>
                </Link>
              ))}
            </div>
            <p className="text-caption muted">{t.hint}</p>
          </section>
          <section className="tile" aria-label={t.tableLabel}>
            <table className="chart-table">
              <thead>
                <tr>
                  <th>{t.columns.category}</th>
                  <th className="num">{t.columns.value}</th>
                  <th className="num">{t.columns.share}</th>
                  {hasBaseline && <th className="num">{t.columns.diff(chart.compare)}</th>}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row) => {
                  const strong = top?.category === row.category;
                  return (
                    <tr key={row.category} className={strong ? 'strong' : undefined}>
                      <td>{name(row.category)}</td>
                      <td className="num">{money(row.cents)}</td>
                      <td className="num muted">{percent(row.cents, chart.totalCents)}</td>
                      {hasBaseline && <DiffCell cents={row.cents} baseline={row.baselineCents} warn={strong} />}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="strong">
                  <td>{t.total}</td>
                  <td className="num">{money(chart.totalCents)}</td>
                  <td />
                  {hasBaseline && <DiffCell cents={chart.totalCents} baseline={chart.baselineTotalCents} />}
                </tr>
              </tfoot>
            </table>
            {top && (
              <Link to={withQuery(tabPath('metas'), NO_PARAMS, { nova: 'teto-categoria', categoria: top.category })} className="button-outline">
                {t.createGoal(name(top.category))}
              </Link>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function DiffCell({ cents, baseline, warn = false }: { cents: number; baseline: number | null; warn?: boolean }) {
  if (baseline === null) return <td className="num muted">{text.categoria.none}</td>;
  const direction = trend(cents, baseline);
  if (direction === 'igual') return <td className="num muted">{text.categoria.same}</td>;
  const tone = warn ? ' tone-warn' : direction === 'abaixo' ? ' tone-ok' : '';
  return <td className={`num${tone}`}>{moneyDiff(cents - baseline)}</td>;
}

function AoLongoDoTempo({ month, link }: { month: string; link: (mes: string) => string }) {
  const query = useQuery('spendingByMonth', { month }, ['vault', 'categories']);
  const data = query.data;
  if (query.error && !data) return <Failure error={query.error} reload={query.reload} />;
  if (!data) return <p className="muted">{text.loading}</p>;
  return <MonthlyView chart={data} link={link} />;
}

function MonthlyView({ chart, link }: { chart: MonthlyChart; link: (mes: string) => string }) {
  const t = text.tempo;
  const scale = Math.max(1, chart.averageCents ?? 0, ...chart.months.map((m) => m.cents ?? 0));
  const height = (cents: number) => `${(Math.max(0, cents) / scale) * 100}%`;
  const last = chart.months[chart.months.length - 1];
  const parts = (key: string) => parseMonth(key) ?? { year: 0, month: 1 };

  return (
    <>
      <section className="charts-answer">
        <h2 className="text-title">{chart.averageCents === null ? t.noAverage : t.title(moneyWhole(chart.averageCents))}</h2>
        <p className="muted">
          {t.subtitle}
          {chart.partial && last ? ` ${t.running(parts(last.month).month)}` : ''}
        </p>
      </section>
      <div className="charts-pair">
        <section className="tile" aria-label={t.chartLabel}>
          {chart.averageCents !== null && (
            <div className="charts-legend text-label muted">
              <span className="charts-legend-item">
                <span className="charts-swatch" aria-hidden="true" />
                {t.legendMonths}
              </span>
              <span className="charts-legend-item">
                <span className="charts-dash" aria-hidden="true" />
                {t.averageLegend}
              </span>
            </div>
          )}
          <div className="vbars">
            {chart.months.map((m) => {
              const { year, month } = parts(m.month);
              return (
                <Link key={m.month} to={link(m.month)} className="vbar" title={t.barTitle(year, month)}>
                  <span className="text-caption num muted">{m.cents === null ? '' : moneyShort(m.cents)}</span>
                  <span className="vbar-track">
                    <i style={{ height: height(m.cents ?? 0) }} />
                    {chart.averageCents !== null && <b style={{ bottom: height(chart.averageCents) }} />}
                  </span>
                  <span className="text-caption muted">{t.monthShort(month)}</span>
                </Link>
              );
            })}
          </div>
        </section>
        <section className="tile" aria-label={t.tableLabel}>
          <table className="chart-table">
            <thead>
              <tr>
                <th>{t.columns.month}</th>
                <th className="num">{t.columns.value}</th>
                {chart.averageCents !== null && <th className="num">{t.columns.diff}</th>}
              </tr>
            </thead>
            <tbody>
              {[...chart.months].reverse().map((m) => {
                const { year, month } = parts(m.month);
                return (
                  <tr key={m.month}>
                    <td>{t.monthLong(year, month)}</td>
                    <td className={`num${m.cents === null ? ' muted' : ''}`}>{m.cents === null ? t.noData : money(m.cents)}</td>
                    {chart.averageCents !== null &&
                      (m.cents === null ? <td /> : <DiffCell cents={m.cents} baseline={chart.averageCents} />)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
