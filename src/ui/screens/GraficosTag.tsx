// Finanças › Gráficos › Por tag (docs/spec/graficos.md): the month's gastos split among the tags of
// one layer, as a donut and a table. A slice opens its lançamentos below, with the boxes and the batch
// actions of the Lançamentos list, so I can tag what is still "Sem tag" right there.
import type { ChangeEvent } from 'react';
import type { LancamentoView, TagLayerView } from '../../application/api-contract';
import { dayCell, dayLabel } from '../../domain/lancamentos';
import { money, moneyWhole } from '../../domain/money';
import { strings } from '../../domain/strings';
import { arcs, sliceItems, tagChart, type TagChart, type TagSlice } from '../../domain/tag-chart';
import { saoPauloDate } from '../../domain/vault';
import { Link, navigate } from '../router';
import { graficosPath, modulePath, tabPath, withQuery } from '../shell/routes';
import { useQuery } from '../use-query';
import { SelectionActions, signed, TagCell, useSelection } from './LancamentoBatch';

const text = strings.graficos.tag;
const list = strings.lancamentos;
const SERIES = 8;
/** The donut's circle, in the SVG's own units: a ring of this radius is about 100 long. */
const RADIUS = 15.915;
const RING = 6;

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '');

/** The color class of each slice: the tags cycle through the series, "Sem tag" is grey. */
function seriesClass(slices: readonly TagSlice[], key: string): string {
  const index = slices.findIndex((s) => s.key === key);
  const slice = slices[index];
  if (!slice || slice.tagId === null) return 'series-none';
  return `series-${(index % SERIES) + 1}`;
}

export function PorTag({ month, search }: { month: string; search: URLSearchParams }) {
  const layersQuery = useQuery('tagLayers', {}, ['tags']);
  const query = useQuery('lancamentos', { month }, ['vault', 'tags', 'categories', 'rules']);
  const layers = layersQuery.data;
  const view = query.data?.month === month ? query.data : undefined;
  const error = layersQuery.error ?? query.error;

  if (error && (!layers || !view)) {
    if (error === 'locked') return null;
    return (
      <p className="notice" role="alert">
        {error === 'unauthenticated' ? strings.forbidden : strings.genericError}{' '}
        {error !== 'unauthenticated' && (
          <button type="button" className="secondary" onClick={() => (layersQuery.error ? layersQuery.reload() : query.reload())}>
            {strings.retry}
          </button>
        )}
      </p>
    );
  }
  if (!layers || !view) return <p className="muted">{strings.graficos.loading}</p>;
  const layer = layers.find((l) => l.id === search.get('camada')) ?? layers[0];
  if (!layer) {
    return (
      <section className="charts-answer">
        <h2 className="text-title">{text.noLayers}</h2>
        <p>
          <Link to={modulePath('categorias')}>{text.createLayers}</Link>
        </p>
      </section>
    );
  }
  return <TagView layers={layers} layer={layer} items={view.items} month={month} search={search} />;
}

function TagView({
  layers,
  layer,
  items,
  month,
  search,
}: {
  layers: readonly TagLayerView[];
  layer: TagLayerView;
  items: readonly LancamentoView[];
  month: string;
  search: URLSearchParams;
}) {
  const shape = { id: layer.id, tagIds: layer.tags.map((t) => t.id) };
  const chart = tagChart(items, shape);
  const chosen = search.get('fatia');
  const open = chart.slices.find((s) => s.key === chosen) ?? null;
  const name = (slice: TagSlice) => (slice.tagId === null ? text.noTag : (layer.tags.find((t) => t.id === slice.tagId)?.name ?? text.noTag));
  const path = graficosPath('tag');
  // A second click on the open slice closes its list.
  const sliceLink = (slice: TagSlice) => withQuery(path, search, { fatia: slice.key === open?.key ? null : slice.key });

  const onLayer = (event: ChangeEvent<HTMLSelectElement>) =>
    navigate(withQuery(path, search, { camada: event.target.value, fatia: null }), { replace: true });

  return (
    <>
      <label className="text-label muted charts-compare">
        {text.layerLabel}
        <select value={layer.id} onChange={onLayer}>
          {layers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <Answer chart={chart} layerName={layer.name} name={name} />
      {chart.slices.length > 0 && (
        <div className="charts-pair charts-pair--fit">
          <section className="tile" aria-label={text.chartLabel(layer.name)}>
            <Donut chart={chart} open={open?.key ?? null} onPick={(slice) => navigate(sliceLink(slice))} title={(s) => text.sliceTitle(name(s))} />
            <p className="text-caption muted">{text.hint}</p>
          </section>
          <section className="tile tag-table-tile" aria-label={text.tableLabel}>
            <div className="tag-table-scroll">
            <table className="chart-table">
              <thead>
                <tr>
                  <th>{text.columns.tag}</th>
                  <th className="num">{text.columns.value}</th>
                  <th className="num">{text.columns.share}</th>
                </tr>
              </thead>
              <tbody>
                {chart.slices.map((slice) => (
                  <tr key={slice.key} aria-current={slice.key === open?.key ? 'true' : undefined}>
                    <td>
                      <Link to={sliceLink(slice)} title={text.sliceTitle(name(slice))} className={seriesClass(chart.slices, slice.key)}>
                        <span className="charts-swatch charts-swatch--series" aria-hidden="true" />
                        {name(slice)}
                      </Link>
                    </td>
                    <td className="num">{money(slice.cents)}</td>
                    <td className="num muted">{percent(slice.cents, chart.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="strong">
                  <td>{text.total}</td>
                  <td className="num">{money(chart.totalCents)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            </div>
          </section>
        </div>
      )}
      {open && (
        <SliceList
          key={`${layer.id}:${open.key}`}
          title={name(open)}
          items={sliceItems(items, shape, open.key)}
          layers={layers}
          month={month}
          closeTo={withQuery(path, search, { fatia: null })}
        />
      )}
    </>
  );
}

function Answer({ chart, layerName, name }: { chart: TagChart; layerName: string; name: (slice: TagSlice) => string }) {
  const top = chart.slices.find((s) => s.tagId !== null);
  const none = chart.slices.find((s) => s.tagId === null);
  let answer: string;
  if (chart.slices.length === 0) answer = text.empty;
  else if (!top) answer = text.allUntagged(layerName);
  else answer = text.top(name(top), moneyWhole(top.cents), percent(top.cents, chart.totalCents));
  return (
    <section className="charts-answer">
      <h2 className="text-title">{answer}</h2>
      {top && none && <p className="muted">{text.untagged(moneyWhole(none.cents), percent(none.cents, chart.totalCents))}</p>}
    </section>
  );
}

/** The ring: each slice an arc of one circle, drawn as a dash of its length. */
function Donut({
  chart,
  open,
  onPick,
  title,
}: {
  chart: TagChart;
  open: string | null;
  onPick: (slice: TagSlice) => void;
  title: (slice: TagSlice) => string;
}) {
  const size = (RADIUS + RING) * 2;
  const center = size / 2;
  return (
    <div className={`donut${open ? ' donut--focus' : ''}`}>
      {/* The table beside it holds the same links for the keyboard and screen readers. */}
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {arcs(chart).map((arc) => {
          const slice = chart.slices.find((s) => s.key === arc.key);
          if (!slice) return null;
          const length = arc.length * 100;
          return (
            <circle
              key={arc.key}
              className={`donut-slice ${seriesClass(chart.slices, arc.key)}${arc.key === open ? ' donut-slice--on' : ''}`}
              cx={center}
              cy={center}
              r={RADIUS}
              fill="none"
              strokeWidth={RING}
              pathLength={100}
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-arc.start * 100}
              onClick={() => onPick(slice)}
            >
              <title>{title(slice)}</title>
            </circle>
          );
        })}
      </svg>
      <div className="donut-center">
        <span className="text-title num">{moneyWhole(chart.totalCents)}</span>
        <span className="text-caption muted">{text.center}</span>
      </div>
    </div>
  );
}

/** The lançamentos of the open slice, with the boxes and the batch actions of Lançamentos. */
function SliceList({
  title,
  items,
  layers,
  month,
  closeTo,
}: {
  title: string;
  items: readonly LancamentoView[];
  layers: readonly TagLayerView[];
  month: string;
  closeTo: string;
}) {
  const { selection, setSelection, selected, allSelected, clickBox, toggleAll } = useSelection(items, month);
  const today = saoPauloDate(new Date());
  const detail = (id: string) => withQuery(`${tabPath('lancamentos')}/${encodeURIComponent(id)}`, new URLSearchParams(), { mes: month });

  return (
    <section className="tile tag-slice-list" aria-label={text.listLabel(title)}>
      <div className="tile-head">
        <h2 className="text-title">{text.listTitle(title, items.length)}</h2>
        <Link to={closeTo} className="text-label">
          {text.close}
        </Link>
      </div>
      {selected.length > 0 && <SelectionActions selected={selected} layers={layers} onClear={() => setSelection([])} />}
      {items.length > 0 && (
        <div className="lanc-line lanc-line--head">
          <input
            type="checkbox"
            className="lanc-check"
            aria-label={list.selectAll}
            checked={allSelected}
            ref={(box) => {
              if (box) box.indeterminate = selected.length > 0 && !allSelected;
            }}
            onChange={toggleAll}
          />
          <div className="lanc-row lanc-row--head text-over muted">
            <span>{list.columns.date}</span>
            <span>{list.columns.description}</span>
            <span>{list.columns.category}</span>
            <span>{list.columns.tags}</span>
            <span className="lanc-amount">{list.columns.amount}</span>
          </div>
        </div>
      )}
      <div className="lanc-table">
        <ul className="lanc-list">
          {items.map((item) => (
            <li key={item.id} className="lanc-line">
              <input
                type="checkbox"
                className="lanc-check"
                aria-label={list.select(item.description ?? list.noDescription)}
                checked={selection.includes(item.id)}
                // Without this, a shift-click also selects the page text between the two boxes.
                onMouseDown={(e) => {
                  if (e.shiftKey) e.preventDefault();
                }}
                onChange={(e) => clickBox(item.id, (e.nativeEvent as MouseEvent).shiftKey === true)}
              />
              <Link
                to={detail(item.id)}
                className="lanc-row"
                aria-label={`${list.open(item.description ?? list.noDescription)}, ${dayLabel(item.day, today, list)}, ${signed(item)}`}
              >
                <span className="muted">{dayCell(item.day, today, list)}</span>
                <span className="lanc-description">
                  <span className="lanc-description-text">{item.description ?? list.noDescription}</span>
                  {item.pending && <span className="chip lanc-badge">{list.pending}</span>}
                  {item.installment && <span className="text-caption muted">{list.installment(item.installment.number, item.installment.total)}</span>}
                </span>
                <span className="muted">{item.category ?? list.noCategory}</span>
                <TagCell layers={layers} tags={item.tags} />
                <span className={`lanc-amount${item.direction === 'in' ? ' lanc-in' : ''}`}>{signed(item)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
