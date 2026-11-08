// Finanças › Lançamentos (docs/spec/lancamentos.md): every transaction of the month, money out and
// money in, newest day first; each row opens in the detail panel. The category shown is the one I
// chose from Pluggy's tree, or else Pluggy's (docs/spec/classificacao.md); I change it in the panel or
// on many lançamentos at once. My tags (docs/spec/categorias.md) show in their own column. Each column
// title sorts the list and carries its filter; every filter takes several choices. The Colunas menu
// shows or hides the table's columns, remembered on this device.
import { useEffect, useMemo, useRef, useState } from 'react';
import { isBareDay } from '../../domain/calendar';
import {
  columnTemplate,
  DIRECTION_FILTERS,
  EMPTY_CHOICE,
  dayCell,
  dayLabel,
  FIXED_COLUMNS,
  lancamentoKind,
  LIST_COLUMNS,
  matchesAccounts,
  matchesChoice,
  matchesDirections,
  nextSort,
  parseColumns,
  parseDirectionFilters,
  parseSort,
  sortLancamentos,
  sortParams,
  toggleChoice,
  toggleColumn,
  totals,
  type ListColumn,
  type Sort,
  type SortColumn,
} from '../../domain/lancamentos';
import { monthKey, type Month } from '../../domain/month';
import { strings } from '../../domain/strings';
import { emptyTagKey, matchesTags } from '../../domain/tags';
import { saoPauloDate } from '../../domain/vault';
import { useServices } from '../backend-context';
import { Link } from '../router';
import { Icon } from '../shell/Icon';
import { tabPath, withQuery } from '../shell/routes';
import { useQuery } from '../use-query';
import type { LancamentoView, TagLayerView } from '../../application/api-contract';
import { account, money, optionLabel, PLUGGY, SelectionActions, signed, TagCell, useSelection } from './LancamentoBatch';

const text = strings.lancamentos;

// The shown columns, remembered on this device only (a layout preference, not financial data).
const COLUMNS_KEY = 'sinal-verde:lancamentos-colunas';

function loadColumns(): ListColumn[] {
  try {
    return parseColumns(localStorage.getItem(COLUMNS_KEY));
  } catch {
    return parseColumns(null);
  }
}

function saveColumns(columns: readonly ListColumn[]): void {
  try {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

const COLUMN_LABEL: Record<ListColumn, string> = {
  data: text.columns.date,
  descricao: text.columns.description,
  tipo: text.columns.kind,
  categoria: text.columns.category,
  tags: text.columns.tags,
  operacao: text.columns.operation,
  pagador: text.columns.payer,
  valor: text.columns.amount,
};

const SORTABLE: readonly ListColumn[] = ['data', 'descricao', 'categoria', 'valor'];

/** The URL lists that hold the filters. */
type ListKey = 'tipo' | 'conta' | 'categoria' | 'tag' | 'operacao' | 'pagador';
const LIST_KEYS: readonly ListKey[] = ['tipo', 'conta', 'categoria', 'tag', 'operacao', 'pagador'];

/** The list path with the filter `key` set to `chosen` (`?conta=a&conta=b`, `?tag=x&tag=y`). */
function withList(path: string, search: URLSearchParams, key: ListKey, chosen: readonly string[]): string {
  const params = new URLSearchParams(search);
  params.delete(key);
  for (const a of chosen) params.append(key, a);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** The list path with no filter, keeping the sort. */
function withoutFilters(path: string, search: URLSearchParams): string {
  const params = new URLSearchParams(search);
  for (const key of LIST_KEYS) params.delete(key);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** The distinct non-empty values of a column, sorted, plus chosen ones the month lacks (so I can take them out). */
function valuesOf(items: readonly LancamentoView[], value: (item: LancamentoView) => string | null, chosen: readonly string[]): string[] {
  const all = new Set<string>();
  for (const item of items) {
    const v = value(item);
    if (v) all.add(v);
  }
  for (const c of chosen) if (c !== EMPTY_CHOICE) all.add(c);
  return [...all].sort((a, b) => a.localeCompare(b, 'pt-BR'));
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

interface FilterOption {
  readonly key: string;
  readonly label: string;
  readonly checked: boolean;
  readonly to: string;
}

/** A set of choices in a column's filter; with none checked, "Todos" is. */
interface FilterGroup {
  readonly title: string;
  /** Where "Todos" goes: the list without this group's choices. */
  readonly allTo: string;
  readonly options: readonly FilterOption[];
}

export function Lancamentos({ month, search, selectedId }: { month: Month; search: URLSearchParams; selectedId: string | null }) {
  const query = useQuery('lancamentos', { month: monthKey(month) }, ['vault', 'tags', 'categories', 'rules']);
  const layersQuery = useQuery('tagLayers', {}, ['tags']);
  const layers = useMemo(() => layersQuery.data ?? [], [layersQuery.data]);
  const view = query.data?.month === monthKey(month) ? query.data : undefined;
  const all = view?.items ?? [];
  const chosenDirections = parseDirectionFilters(search.getAll('tipo'));
  const chosenAccounts = search.getAll('conta');
  const chosenCategories = search.getAll('categoria');
  const chosenTags = search.getAll('tag');
  const chosenOperations = search.getAll('operacao');
  const chosenPayers = search.getAll('pagador');
  const layerOf = useMemo(() => new Map(layers.flatMap((l) => l.tags.map((t) => [t.id, l.id] as const))), [layers]);
  const accounts = [...new Set([...all.map(account), ...chosenAccounts])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  // The month's categories by name; a chosen one the month lacks still shows, so I can take it out.
  const categoryNames = new Map<string, string>();
  for (const item of all) if (item.categoryId) categoryNames.set(item.categoryId, item.category ?? item.categoryId);
  for (const id of chosenCategories) if (id !== EMPTY_CHOICE && !categoryNames.has(id)) categoryNames.set(id, id);
  const categories = [...categoryNames].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const sort = parseSort(search.get('ordem'), search.get('sentido'));
  const items = sortLancamentos(
    all.filter(
      (item) =>
        matchesDirections(chosenDirections, item) &&
        matchesAccounts(chosenAccounts, account(item)) &&
        matchesChoice(chosenCategories, item.categoryId) &&
        matchesTags(chosenTags, layerOf, item.tags) &&
        matchesChoice(chosenOperations, item.operation) &&
        matchesChoice(chosenPayers, item.payer),
    ),
    sort,
  );
  const filtering = LIST_KEYS.some((key) => search.getAll(key).length > 0);
  const { selection, setSelection, selected, allSelected, clickBox, toggleAll } = useSelection(items, monthKey(month));
  // The totals follow the filters: they add up only what the list shows.
  const monthTotals = filtering ? totals(items) : (view?.totals ?? []);
  // What left the accounts to pay the card, per currency: out of the totals, but said so.
  const cardPaid = new Map<string, number>();
  for (const item of items) {
    if (item.cardPayment && item.direction === 'out') cardPaid.set(item.currency, (cardPaid.get(item.currency) ?? 0) + item.amountCents);
  }
  const today = saoPauloDate(new Date());
  const listPath = tabPath('lancamentos');
  const [columns, setColumns] = useState(loadColumns);
  const grid = { gridTemplateColumns: columnTemplate(columns) };
  const flipColumn = (column: ListColumn) => {
    const next = toggleColumn(columns, column);
    setColumns(next);
    saveColumns(next);
  };

  /** A filter group over the URL list `key`: "Todos" clears it, each option toggles its key. */
  const group = (title: string, key: ListKey, chosen: readonly string[], options: readonly { key: string; label: string }[]): FilterGroup => ({
    title,
    allTo: withList(listPath, search, key, []),
    options: options.map((o) => ({
      key: o.key,
      label: o.label,
      checked: chosen.includes(o.key),
      to: withList(listPath, search, key, toggleChoice(chosen, o.key)),
    })),
  });
  /** A filter over a column that may be empty: "Vazio" first, then the month's values. */
  const withEmpty = (title: string, key: ListKey, chosen: readonly string[], values: readonly string[]) =>
    group(title, key, chosen, [{ key: EMPTY_CHOICE, label: text.emptyChoice }, ...values.map((v) => ({ key: v, label: v }))]);

  // One group per layer; "Todos" in a layer clears only that layer's choices.
  const tagFilter: FilterGroup[] = layers
    .filter((layer) => layer.tags.length > 0)
    .map((layer) => {
      const inLayer = (id: string) => id === emptyTagKey(layer.id) || layerOf.get(id) === layer.id;
      return {
        title: layer.name,
        allTo: withList(listPath, search, 'tag', chosenTags.filter((id) => !inLayer(id))),
        options: [{ id: emptyTagKey(layer.id), name: text.emptyChoice }, ...layer.tags].map((tag) => ({
          key: tag.id,
          label: tag.name,
          checked: chosenTags.includes(tag.id),
          to: withList(listPath, search, 'tag', toggleChoice(chosenTags, tag.id)),
        })),
      };
    });
  const directionFilter = [group(text.kinds, 'tipo', chosenDirections, DIRECTION_FILTERS.map((f) => ({ key: f, label: text.filter[f] })))];
  // Each column's filter. The kind filter sits on Tipo, or on Valor while Tipo is hidden.
  const FILTERS: Record<ListColumn, readonly FilterGroup[]> = {
    data: [],
    descricao: accounts.length > 1 ? [group(text.accounts, 'conta', chosenAccounts, accounts.map((a) => ({ key: a, label: a })))] : [],
    tipo: directionFilter,
    categoria: [
      group(text.categories, 'categoria', chosenCategories, [
        { key: EMPTY_CHOICE, label: text.emptyChoice },
        ...categories.map(([id, name]) => ({ key: id, label: name })),
      ]),
    ],
    tags: tagFilter,
    operacao: [withEmpty(text.columns.operation, 'operacao', chosenOperations, valuesOf(all, (i) => i.operation, chosenOperations))],
    pagador: [withEmpty(text.columns.payer, 'pagador', chosenPayers, valuesOf(all, (i) => i.payer, chosenPayers))],
    valor: columns.includes('tipo') ? [] : directionFilter,
  };

  return (
    <div className="lanc">
      <section className="tile lanc-panel" aria-label={text.title}>
        <div className="lanc-sticky">
        <div className="lanc-summary">
          {(monthTotals.length > 0 ? monthTotals : [{ currency: 'BRL', inCents: 0, outCents: 0 }]).map((t) => (
            <dl key={t.currency} className="lanc-figures">
              <div>
                <dt className="text-label muted">{text.out}</dt>
                <dd className="text-title lanc-figure">{money(t.outCents, t.currency)}</dd>
              </div>
              <div>
                <dt className="text-label muted">{text.in}</dt>
                <dd className="text-title lanc-figure lanc-in">{money(t.inCents, t.currency)}</dd>
              </div>
              <div>
                <dt className="text-label muted">{text.balance}</dt>
                <dd className="text-title lanc-figure">{money(t.inCents - t.outCents, t.currency)}</dd>
              </div>
            </dl>
          ))}
          {view && (
            <p className="text-label muted lanc-count">
              {filtering ? text.summaryFiltered(items.length, view.items.length) : text.summary(view.items.length)}
            </p>
          )}
          {[...cardPaid].map(([currency, cents]) => (
            <p key={currency} className="text-label muted lanc-count">
              {text.cardPaymentsOut(money(cents, currency))}
            </p>
          ))}
        </div>

        {selected.length > 0 ? (
          <SelectionActions selected={selected} layers={layers} onClear={() => setSelection([])} />
        ) : (
          <div className="lanc-toolbar" role="group" aria-label={text.filters}>
            {filtering && (
              <Link to={withoutFilters(listPath, search)} className="lanc-clear text-label">
                {text.clearFilters}
              </Link>
            )}
            <ColumnsMenu columns={columns} onFlip={flipColumn} />
          </div>
        )}

        {view && view.items.length > 0 && (
          <div className="lanc-line lanc-line--head">
            <input
              type="checkbox"
              className="lanc-check"
              aria-label={text.selectAll}
              checked={allSelected}
              disabled={items.length === 0}
              ref={(box) => {
                if (box) box.indeterminate = selected.length > 0 && !allSelected;
              }}
              onChange={toggleAll}
            />
            <div className="lanc-row lanc-row--head text-over muted" style={grid}>
              {columns.map((c) => (
                <HeadCell
                  key={c}
                  label={COLUMN_LABEL[c]}
                  sort={SORTABLE.includes(c) ? { column: c as SortColumn, current: sort, path: listPath, search } : undefined}
                  filter={FILTERS[c]}
                  end={c === 'valor'}
                />
              ))}
            </div>
          </div>
        )}
        </div>

        <LoadError error={query.error} reload={query.reload} />
        {view && items.length === 0 && <p className="muted">{view.items.length === 0 ? text.empty : text.emptyFiltered}</p>}

        {items.length > 0 && (
          <div className="lanc-table">
            <ul className="lanc-list">
              {items.map((item) => (
                <li key={item.id} className="lanc-line">
                  <input
                    type="checkbox"
                    className="lanc-check"
                    aria-label={text.select(item.description ?? text.noDescription)}
                    checked={selection.includes(item.id)}
                    // Without this, a shift-click also selects the page text between the two boxes.
                    onMouseDown={(e) => {
                      if (e.shiftKey) e.preventDefault();
                    }}
                    onChange={(e) => clickBox(item.id, (e.nativeEvent as MouseEvent).shiftKey === true)}
                  />
                  <Link
                    to={withQuery(`${listPath}/${encodeURIComponent(item.id)}`, search)}
                    className="lanc-row"
                    style={grid}
                    aria-current={item.id === selectedId ? 'true' : undefined}
                    aria-label={`${text.open(item.description ?? text.noDescription)}, ${dayLabel(item.day, today, text)}, ${signed(item)}`}
                  >
                    {columns.map((c) => (
                      <Cell key={c} column={c} item={item} layers={layers} today={today} />
                    ))}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

    </div>
  );
}

/** One cell of a row, by column. */
function Cell({ column, item, layers, today }: { column: ListColumn; item: LancamentoView; layers: readonly TagLayerView[]; today: string }) {
  switch (column) {
    case 'data':
      return <span className="muted">{dayCell(item.day, today, text)}</span>;
    case 'descricao':
      return (
        <span className="lanc-description">
          <span className="text-strong">{item.description ?? text.noDescription}</span>
          {item.pending && <span className="chip lanc-badge">{text.pending}</span>}
          {item.installment && <span className="text-caption muted">{text.installment(item.installment.number, item.installment.total)}</span>}
        </span>
      );
    case 'tipo':
      return <span className="muted">{text.kind[lancamentoKind(item)]}</span>;
    case 'categoria':
      return <span className="muted">{item.category ?? text.noCategory}</span>;
    case 'tags':
      return <TagCell layers={layers} tags={item.tags} />;
    case 'operacao':
      return (
        <span className="muted" title={item.operation ?? undefined}>
          {item.operation ?? text.noValue}
        </span>
      );
    case 'pagador':
      return (
        <span className="muted" title={item.payer ?? undefined}>
          {item.payer ?? text.noValue}
        </span>
      );
    case 'valor':
      return <span className={`lanc-amount text-strong${item.direction === 'in' ? ' lanc-in' : ''}`}>{signed(item)}</span>;
  }
}

/**
 * A column title: the name sorts the list by it (a second click flips the direction; the sort lives in
 * the URL), and the funnel opens the column's filter.
 */
function HeadCell({
  label,
  sort,
  filter,
  end,
}: {
  label: string;
  sort?: { column: SortColumn; current: Sort; path: string; search: URLSearchParams };
  filter: readonly FilterGroup[];
  end: boolean;
}) {
  const active = sort !== undefined && sort.current.column === sort.column;
  return (
    <div className={`lanc-head${end ? ' lanc-head--end' : ''}`}>
      {sort ? (
        <Link
          to={withQuery(sort.path, sort.search, sortParams(nextSort(sort.current, sort.column)))}
          className="lanc-sort"
          aria-label={text.sortBy(label)}
          aria-current={active ? 'true' : undefined}
        >
          <span className="lanc-head-label">{label}</span>
          <Icon name={active && sort.current.direction === 'desc' ? 'sortDesc' : 'sortAsc'} />
        </Link>
      ) : (
        <span className="lanc-head-label">{label}</span>
      )}
      {filter.length > 0 && <FilterMenu label={label} groups={filter} end={end} />}
    </div>
  );
}

/** A menu that opens below its button and closes on a click outside or Escape. */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, toggle: () => setOpen((o) => !o), root };
}

/**
 * A column's filter: a funnel that opens its choices, "Todos" first in each group. Each choice is a
 * link (the filter lives in the URL), and the list stays open so I can pick several.
 */
function FilterMenu({ label, groups, end }: { label: string; groups: readonly FilterGroup[]; end: boolean }) {
  const { open, toggle, root } = useDropdown();
  const chosen = groups.flatMap((g) => g.options.filter((o) => o.checked).map((o) => o.label));
  const name = chosen.length > 0 ? text.filteredBy(label, chosen.join(', ')) : text.filterBy(label);
  return (
    <div className="lanc-menu" ref={root}>
      <button
        type="button"
        className="lanc-filter-button"
        aria-expanded={open}
        aria-current={chosen.length > 0 ? 'true' : undefined}
        aria-label={name}
        title={name}
        onClick={toggle}
      >
        <Icon name="filter" />
      </button>
      {open && (
        <div className={`lanc-menu-list${end ? ' lanc-menu-list--end' : ''}`} role="group" aria-label={text.filterBy(label)}>
          {groups.map((g) => {
            const none = !g.options.some((o) => o.checked);
            return (
              <div key={g.title} className="lanc-menu-group" role="group" aria-label={g.title}>
                <p className="text-over muted lanc-menu-title">{g.title}</p>
                <Link to={g.allTo} className="lanc-menu-item" aria-current={none ? 'true' : undefined}>
                  <MenuCheck checked={none} label={text.allChoices} />
                </Link>
                {g.options.map((o) => (
                  <Link key={o.key} to={o.to} className="lanc-menu-item" aria-current={o.checked ? 'true' : undefined} title={o.label}>
                    <MenuCheck checked={o.checked} label={o.label} />
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** "Colunas": shows or hides each column; the fixed ones stay. */
function ColumnsMenu({ columns, onFlip }: { columns: readonly ListColumn[]; onFlip: (column: ListColumn) => void }) {
  const { open, toggle, root } = useDropdown();
  return (
    <div className="lanc-menu lanc-menu--end" ref={root}>
      <button type="button" className="chip lanc-menu-button" aria-expanded={open} onClick={toggle}>
        <span>{text.columnsMenu}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="lanc-menu-list lanc-menu-list--end" role="group" aria-label={text.columnsMenuLabel}>
          {LIST_COLUMNS.map((c) => (
            <button
              key={c}
              type="button"
              className="lanc-menu-item"
              aria-pressed={columns.includes(c)}
              disabled={FIXED_COLUMNS.includes(c)}
              title={COLUMN_LABEL[c]}
              onClick={() => onFlip(c)}
            >
              <MenuCheck checked={columns.includes(c)} label={COLUMN_LABEL[c]} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuCheck({ checked, label }: { checked: boolean; label: string }) {
  return (
    <>
      <span aria-hidden="true" className="lanc-menu-check">
        {checked ? '✓' : ''}
      </span>
      <span className="lanc-menu-label">{label}</span>
    </>
  );
}

/** The category in the detail panel: a list that saves as soon as I pick, with Pluggy's on top. */
function CategoryPicker({ id, chosen, categoryId, pluggyCategory }: { id: string; chosen: boolean; categoryId: string | null; pluggyCategory: string | null }) {
  const { backend } = useServices();
  const options = useQuery('pluggyCategories', {}, ['vault']).data ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = chosen && categoryId ? categoryId : PLUGGY;

  async function pick(next: string) {
    if (next === value) return;
    setBusy(true);
    setError(null);
    const result = await backend.command('lancamentos.categorize', { ids: [id], categoryId: next === PLUGGY ? null : next });
    setBusy(false);
    if (!result.ok) setError(strings.genericError);
  }

  return (
    <>
      <select aria-label={text.detail.category} value={value} disabled={busy} onChange={(e) => void pick(e.target.value)}>
        <option value={PLUGGY}>{text.detail.fromPluggy(pluggyCategory)}</option>
        {/* The chosen category shows even before the list arrives. */}
        {chosen && categoryId && !options.some((o) => o.id === categoryId) && <option value={categoryId}>{categoryId}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
      {error && (
        <span className="notice" role="alert">
          {error}
        </span>
      )}
    </>
  );
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'medium', timeStyle: 'short' });

/** The detail panel of one lançamento: what the bank told about it, and the category, which I can change. */
export function LancamentoDetail({ id }: { id: string }) {
  const query = useQuery('lancamento', { id }, ['vault', 'categories', 'rules']);
  const item = query.data?.id === id ? query.data : undefined;
  const d = text.detail;

  if (query.error === 'not_found') return <p className="muted">{d.notFound}</p>;
  if (!item) return <LoadError error={query.error} reload={query.reload} />;

  const rows: [string, string | null][] = [
    [d.when, isBareDay(item.date) ? dayLabel(item.day, saoPauloDate(new Date()), text) : dateTime(item.date)],
    [d.account, account(item)],
    [d.status, item.pending ? d.pending : d.posted],
    [item.direction === 'in' ? d.counterpartIn : d.counterpartOut, item.counterpart],
    [d.operation, item.operation],
    [d.installment, item.installment && `${item.installment.number}/${item.installment.total}`],
    [d.card, item.cardDigits],
    [d.originalDescription, item.descriptionOriginal],
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
        <div>
          <dt className="text-label muted">{d.category}</dt>
          <dd>
            <CategoryPicker id={item.id} chosen={item.categoryChosen} categoryId={item.categoryId} pluggyCategory={item.pluggyCategory} />
          </dd>
        </div>
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
