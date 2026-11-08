// Finanças › Lançamentos (docs/spec/lancamentos.md): every transaction of the month, money out and
// money in, newest day first; each row opens in the detail panel. The category shown is the one I
// chose from Pluggy's tree, or else Pluggy's (docs/spec/classificacao.md); I change it in the panel or
// on many lançamentos at once. My tags (docs/spec/categorias.md) show in their own column, filter the
// list, and go on many lançamentos at once from the checkboxes.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LancamentoView, TagLayerView } from '../../application/api-contract';
import type { CategoryOption } from '../../domain/pluggy-categories';
import { isBareDay } from '../../domain/calendar';
import {
  clickSelection,
  dayCell,
  dayLabel,
  matchesAccounts,
  matchesFilter,
  nextSort,
  parseDirectionFilter,
  parseSort,
  sortLancamentos,
  sortParams,
  toggleAccount,
  totals,
  type DirectionFilter,
  type Sort,
  type SortColumn,
} from '../../domain/lancamentos';
import { monthKey, type Month } from '../../domain/month';
import { strings } from '../../domain/strings';
import { commonTags, emptyTagKey, matchesTags, MAX_BULK_TAGGING, tagChanges, toggleTag, type TagAssignment } from '../../domain/tags';
import { saoPauloDate } from '../../domain/vault';
import { useServices } from '../backend-context';
import { Link } from '../router';
import { Icon } from '../shell/Icon';
import { modulePath, tabPath, withQuery } from '../shell/routes';
import { useQuery } from '../use-query';

const text = strings.lancamentos;
const FILTERS: readonly DirectionFilter[] = ['todos', 'saidas', 'entradas', 'cartao'];

const money = (cents: number, currency: string) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });
const signed = (item: { amountCents: number; currency: string; direction: 'in' | 'out' }) =>
  `${item.direction === 'in' ? '+ ' : ''}${money(item.amountCents, item.currency)}`;

function account(item: LancamentoView): string {
  const type = item.accountType ? text.accountTypes[item.accountType] : undefined;
  return [item.accountName, type].filter(Boolean).join(' ') || '—';
}

/** The list path with the filter `key` set to `chosen` (`?conta=a&conta=b`, `?tag=x&tag=y`). */
function withList(path: string, search: URLSearchParams, key: 'conta' | 'tag', chosen: readonly string[]): string {
  const params = new URLSearchParams(search);
  params.delete(key);
  for (const a of chosen) params.append(key, a);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** The list path with no direction, account or tag filter, keeping the sort. */
function withoutFilters(path: string, search: URLSearchParams): string {
  const params = new URLSearchParams(search);
  for (const key of ['tipo', 'conta', 'tag']) params.delete(key);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
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
  const query = useQuery('lancamentos', { month: monthKey(month) }, ['vault', 'tags', 'categories']);
  const layersQuery = useQuery('tagLayers', {}, ['tags']);
  const layers = useMemo(() => layersQuery.data ?? [], [layersQuery.data]);
  const filter = parseDirectionFilter(search.get('tipo'));
  const view = query.data?.month === monthKey(month) ? query.data : undefined;
  const chosenAccounts = search.getAll('conta');
  const chosenTags = search.getAll('tag');
  const layerOf = useMemo(() => new Map(layers.flatMap((l) => l.tags.map((t) => [t.id, l.id] as const))), [layers]);
  const accounts = [...new Set([...(view?.items ?? []).map(account), ...chosenAccounts])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const sort = parseSort(search.get('ordem'), search.get('sentido'));
  const items = sortLancamentos(
    (view?.items ?? []).filter(
      (item) => matchesFilter(filter, item) && matchesAccounts(chosenAccounts, account(item)) && matchesTags(chosenTags, layerOf, item.tags),
    ),
    sort,
  );
  const filtering = filter !== 'todos' || chosenAccounts.length > 0 || chosenTags.length > 0;
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [tagging, setTagging] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const monthId = monthKey(month);
  useEffect(() => setSelection([]), [monthId]);
  // Only what the list shows counts: a filter that hides a lançamento takes it out of the batch.
  const selected = items.filter((item) => selection.includes(item.id));
  const allSelected = items.length > 0 && selected.length === items.length;
  // The last box clicked: a shift-click selects everything between it and the box clicked.
  const anchor = useRef<string | null>(null);
  const clickBox = (id: string, shift: boolean) => {
    const order = items.map((i) => i.id);
    // Read the anchor now: React may run the updater after the line below has moved it to `id`.
    const from = anchor.current;
    setSelection((s) => clickSelection(s, order, from, id, shift));
    anchor.current = id;
  };
  // The totals follow the filters: they add up only what the list shows.
  const monthTotals = filtering ? totals(items) : (view?.totals ?? []);
  // What left the accounts to pay the card, per currency: out of the totals, but said so.
  const cardPaid = new Map<string, number>();
  for (const item of items) {
    if (item.cardPayment && item.direction === 'out') cardPaid.set(item.currency, (cardPaid.get(item.currency) ?? 0) + item.amountCents);
  }
  const today = saoPauloDate(new Date());
  const listPath = tabPath('lancamentos');

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
          <div className="lanc-toolbar lanc-toolbar--selection" role="group" aria-label={text.selectionActions}>
            <span className="text-strong">{text.selected(selected.length)}</span>
            <button type="button" className="lanc-small" onClick={() => setTagging(true)}>
              {text.addTags}
            </button>
            <button type="button" className="lanc-small" onClick={() => setCategorizing(true)}>
              {text.changeCategory}
            </button>
            <button type="button" className="secondary lanc-small" onClick={() => setSelection([])}>
              {text.clearSelection}
            </button>
          </div>
        ) : (
          <div className="lanc-toolbar" role="group" aria-label={text.filters}>
            <div className="lanc-segmented" role="group" aria-label={text.directionFilter}>
              {FILTERS.map((f) => (
                <Link
                  key={f}
                  to={withQuery(listPath, search, { tipo: f === 'todos' ? null : f })}
                  className="lanc-segment"
                  aria-current={f === filter ? 'true' : undefined}
                >
                  {text.filter[f]}
                </Link>
              ))}
            </div>
            {accounts.length > 1 && (
              <FilterMenu
                label={text.accounts}
                chosen={accounts.filter((a) => chosenAccounts.includes(a))}
                clearTo={withList(listPath, search, 'conta', [])}
                options={accounts.map((a) => ({
                  key: a,
                  label: a,
                  checked: chosenAccounts.includes(a),
                  to: withList(listPath, search, 'conta', toggleAccount(chosenAccounts, a)),
                }))}
              />
            )}
            {layers.map((layer) =>
              layer.tags.length === 0 ? null : (
                <FilterMenu
                  key={layer.id}
                  label={layer.name}
                  chosen={[
                    ...(chosenTags.includes(emptyTagKey(layer.id)) ? [text.emptyTag] : []),
                    ...layer.tags.filter((t) => chosenTags.includes(t.id)).map((t) => t.name),
                  ]}
                  clearTo={withList(
                    listPath,
                    search,
                    'tag',
                    chosenTags.filter((id) => id !== emptyTagKey(layer.id) && layerOf.get(id) !== layer.id),
                  )}
                  options={[{ id: emptyTagKey(layer.id), name: text.emptyTag }, ...layer.tags].map((tag) => ({
                    key: tag.id,
                    label: tag.name,
                    checked: chosenTags.includes(tag.id),
                    to: withList(listPath, search, 'tag', toggleAccount(chosenTags, tag.id)),
                  }))}
                />
              ),
            )}
            {filtering && (
              <Link to={withoutFilters(listPath, search)} className="lanc-clear text-label">
                {text.clearFilters}
              </Link>
            )}
          </div>
        )}

        {items.length > 0 && (
          <div className="lanc-line lanc-line--head">
            <input
              type="checkbox"
              className="lanc-check"
              aria-label={text.selectAll}
              checked={allSelected}
              ref={(box) => {
                if (box) box.indeterminate = selected.length > 0 && !allSelected;
              }}
              onChange={() => setSelection(allSelected ? [] : items.map((i) => i.id))}
            />
            <div className="lanc-row lanc-row--head text-over muted">
              <SortHeader column="data" sort={sort} path={listPath} search={search} />
              <SortHeader column="descricao" sort={sort} path={listPath} search={search} />
              <SortHeader column="categoria" sort={sort} path={listPath} search={search} />
              <span>{text.columns.tags}</span>
              <SortHeader column="valor" sort={sort} path={listPath} search={search} />
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
                    aria-current={item.id === selectedId ? 'true' : undefined}
                    aria-label={`${text.open(item.description ?? text.noDescription)}, ${dayLabel(item.day, today, text)}, ${signed(item)}`}
                  >
                    <span className="muted">{dayCell(item.day, today, text)}</span>
                    <span className="lanc-description">
                      <span className="text-strong">{item.description ?? text.noDescription}</span>
                      {item.pending && <span className="chip lanc-badge">{text.pending}</span>}
                      {item.installment && (
                        <span className="text-caption muted">{text.installment(item.installment.number, item.installment.total)}</span>
                      )}
                    </span>
                    <span className="muted">{item.category ?? text.noCategory}</span>
                    <TagCell layers={layers} tags={item.tags} />
                    <span className={`lanc-amount text-strong${item.direction === 'in' ? ' lanc-in' : ''}`}>{signed(item)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {tagging && selected.length > 0 && (
        <TagDialog
          layers={layers}
          items={selected}
          onClose={() => setTagging(false)}
          onSaved={() => {
            setTagging(false);
            setSelection([]);
          }}
        />
      )}
      {categorizing && selected.length > 0 && (
        <CategoryDialog
          ids={selected.map((i) => i.id)}
          onClose={() => setCategorizing(false)}
          onSaved={() => {
            setCategorizing(false);
            setSelection([]);
          }}
        />
      )}
    </div>
  );
}

const SORT_LABEL: Record<SortColumn, string> = {
  data: text.columns.date,
  descricao: text.columns.description,
  categoria: text.columns.category,
  valor: text.columns.amount,
};

/** A column title that sorts the list by it; a second click flips the direction. The sort lives in the URL. */
function SortHeader({ column, sort, path, search }: { column: SortColumn; sort: Sort; path: string; search: URLSearchParams }) {
  const active = sort.column === column;
  const label = SORT_LABEL[column];
  return (
    <Link
      to={withQuery(path, search, sortParams(nextSort(sort, column)))}
      className={`lanc-sort${column === 'valor' ? ' lanc-amount' : ''}`}
      aria-label={text.sortBy(label)}
      aria-current={active ? 'true' : undefined}
    >
      {label}
      <span aria-hidden="true" className="lanc-sort-arrow">
        {active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </Link>
  );
}

interface FilterOption {
  readonly key: string;
  readonly label: string;
  readonly checked: boolean;
  readonly to: string;
}

/**
 * One filter as a compact button that opens a list of choices. Each choice is a link (the filter lives
 * in the URL), and the list stays open so I can pick several.
 */
function FilterMenu({ label, chosen, options, clearTo }: { label: string; chosen: readonly string[]; options: readonly FilterOption[]; clearTo: string }) {
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

  const summary = chosen.length === 0 ? null : chosen.length === 1 ? chosen[0] : String(chosen.length);
  return (
    <div className="lanc-menu" ref={root}>
      <button
        type="button"
        className="chip lanc-menu-button"
        aria-expanded={open}
        aria-current={chosen.length > 0 ? 'true' : undefined}
        title={chosen.length > 0 ? `${label}: ${chosen.join(', ')}` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        {summary && <span className="lanc-menu-value">{summary}</span>}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="lanc-menu-list" role="group" aria-label={text.filterBy(label)}>
          {options.map((o) => (
            <Link key={o.key} to={o.to} className="lanc-menu-item" aria-current={o.checked ? 'true' : undefined} title={o.label}>
              <span aria-hidden="true" className="lanc-menu-check">
                {o.checked ? '✓' : ''}
              </span>
              <span className="lanc-menu-label">{o.label}</span>
            </Link>
          ))}
          {chosen.length > 0 && (
            <Link to={clearTo} className="lanc-menu-item lanc-menu-clear">
              <span aria-hidden="true" className="lanc-menu-check" />
              {text.clearChoice}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** The lançamento's tag names, in the layers' order. */
function tagNames(layers: readonly TagLayerView[], tags: TagAssignment): string[] {
  return layers.flatMap((layer) => layer.tags.filter((t) => t.id === tags[layer.id]).map((t) => t.name));
}

function TagCell({ layers, tags }: { layers: readonly TagLayerView[]; tags: TagAssignment }) {
  const names = tagNames(layers, tags);
  if (names.length === 0) return <span className="muted">{text.noTags}</span>;
  return (
    <span className="lanc-tags" title={names.join(', ')}>
      {names.map((name, index) => (
        <span key={index} className="chip lanc-tag">
          {name}
        </span>
      ))}
    </span>
  );
}

/**
 * "Adicionar tags": every layer with its tags; I tap the tags and save. It starts with the tags
 * the chosen lançamentos share, and saving changes only the layers I touched.
 */
function TagDialog({
  layers,
  items,
  onClose,
  onSaved,
}: {
  layers: readonly TagLayerView[];
  items: readonly LancamentoView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = text.tagging;
  const { backend } = useServices();
  // Fixed when the form opens, so a refetch behind it does not reset what I marked.
  const [initial] = useState(() => commonTags(items.map((i) => i.tags)));
  const [ids] = useState(() => items.map((i) => i.id));
  const [chosen, setChosen] = useState<TagAssignment>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const changes = tagChanges(initial, chosen);
  const tooMany = ids.length > MAX_BULK_TAGGING;

  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await backend.command('lancamentos.tag', { ids, changes });
    setBusy(false);
    if (result.ok) onSaved();
    else setError(strings.genericError);
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t.title(ids.length)} className="search-dialog lanc-tagging" onClick={(e) => e.stopPropagation()}>
        <div className="tile-head">
          <h2 className="text-title">{t.title(ids.length)}</h2>
          <button ref={first} type="button" className="icon-button" aria-label={t.close} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {layers.length === 0 ? (
          <p className="muted">
            {t.noLayers} <Link to={modulePath('categorias')}>{t.createLayers}</Link>
          </p>
        ) : (
          <>
            <p className="text-label muted">{t.hint}</p>
            <div className="lanc-tagging-layers">
              {layers.map((layer) => (
                <fieldset key={layer.id} className="lanc-tagging-layer">
                  <legend className="text-strong">{layer.name}</legend>
                  {layer.tags.length === 0 ? (
                    <p className="text-label muted">{t.emptyLayer}</p>
                  ) : (
                    <div className="tags-chips">
                      {layer.tags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          className="chip tags-chip"
                          aria-pressed={chosen[layer.id] === tag.id}
                          onClick={() => setChosen((c) => toggleTag(c, { id: tag.id, layerId: layer.id }))}
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </fieldset>
              ))}
            </div>
          </>
        )}
        {tooMany && <p className="notice">{t.tooMany(MAX_BULK_TAGGING)}</p>}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="lanc-tagging-actions">
          <button type="button" className="secondary" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="button" disabled={busy || tooMany || changes.length === 0} onClick={() => void save()}>
            {busy ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A category's label in the list, indented by its depth in Pluggy's tree. */
const optionLabel = (option: CategoryOption) => `${'\u00a0\u00a0\u00a0'.repeat(option.depth)}${option.name}`;

/** "Mudar categoria": one category from Pluggy's tree for every chosen lançamento, or Pluggy's back. */
function CategoryDialog({ ids, onClose, onSaved }: { ids: readonly string[]; onClose: () => void; onSaved: () => void }) {
  const t = text.categorizing;
  const { backend } = useServices();
  const options = useQuery('pluggyCategories', {}, ['vault']).data ?? [];
  // Fixed when the form opens, so a refetch behind it does not change what I am saving.
  const [chosenIds] = useState(() => [...ids]);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const tooMany = chosenIds.length > MAX_BULK_TAGGING;

  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await backend.command('lancamentos.categorize', { ids: chosenIds, categoryId: choice === PLUGGY ? null : choice });
    setBusy(false);
    if (result.ok) onSaved();
    else setError(strings.genericError);
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t.title(chosenIds.length)} className="search-dialog lanc-tagging" onClick={(e) => e.stopPropagation()}>
        <div className="tile-head">
          <h2 className="text-title">{t.title(chosenIds.length)}</h2>
          <button ref={first} type="button" className="icon-button" aria-label={t.close} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <p className="text-label muted">{t.hint}</p>
        <label className="lanc-category-field">
          <span className="text-label muted">{t.label}</span>
          <select value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="" disabled>
              {t.choose}
            </option>
            <option value={PLUGGY}>{t.backToPluggy}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {optionLabel(o)}
              </option>
            ))}
          </select>
        </label>
        {tooMany && <p className="notice">{t.tooMany(MAX_BULK_TAGGING)}</p>}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="lanc-tagging-actions">
          <button type="button" className="secondary" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="button" disabled={busy || tooMany || choice === ''} onClick={() => void save()}>
            {busy ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The select's value for "Pluggy's category": no category of my own. */
const PLUGGY = 'pluggy';

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
  const query = useQuery('lancamento', { id }, ['vault', 'categories']);
  const item = query.data?.id === id ? query.data : undefined;
  const d = text.detail;

  if (query.error === 'not_found') return <p className="muted">{d.notFound}</p>;
  if (!item) return <LoadError error={query.error} reload={query.reload} />;

  const rows: [string, string | null][] = [
    [d.when, isBareDay(item.date) ? dayLabel(item.day, saoPauloDate(new Date()), text) : dateTime(item.date)],
    [d.account, account(item)],
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
