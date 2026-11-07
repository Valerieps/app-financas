// Finanças › Lançamentos (docs/spec/lancamentos.md): every transaction of the month, money out and
// money in, newest day first; each row opens in the detail panel. Categoria and importância arrive with
// phase 2; the category shown is Pluggy's. My tags (docs/spec/categorias.md) show in their own
// column, filter the list, and go on many lançamentos at once from the checkboxes.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LancamentoView, TagLayerView } from '../../application/api-contract';
import { isBareDay } from '../../domain/calendar';
import { dayCell, dayLabel, matchesAccounts, matchesFilter, parseDirectionFilter, sortByDay, toggleAccount, type DirectionFilter } from '../../domain/lancamentos';
import { monthKey, type Month } from '../../domain/month';
import { strings } from '../../domain/strings';
import { commonTags, matchesTags, MAX_BULK_TAGGING, tagChanges, toggleTag, type TagAssignment } from '../../domain/tags';
import { saoPauloDate } from '../../domain/vault';
import { useServices } from '../backend-context';
import { Link } from '../router';
import { Icon } from '../shell/Icon';
import { modulePath, tabPath, withQuery } from '../shell/routes';
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

/** The list path with the filter `key` set to `chosen` (`?conta=a&conta=b`, `?tag=x&tag=y`). */
function withList(path: string, search: URLSearchParams, key: 'conta' | 'tag', chosen: readonly string[]): string {
  const params = new URLSearchParams(search);
  params.delete(key);
  for (const a of chosen) params.append(key, a);
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
  const query = useQuery('lancamentos', { month: monthKey(month) }, ['vault', 'tags']);
  const layersQuery = useQuery('tagLayers', {}, ['tags']);
  const layers = useMemo(() => layersQuery.data ?? [], [layersQuery.data]);
  const filter = parseDirectionFilter(search.get('tipo'));
  const view = query.data?.month === monthKey(month) ? query.data : undefined;
  const chosenAccounts = search.getAll('conta');
  const chosenTags = search.getAll('tag');
  const layerOf = useMemo(() => new Map(layers.flatMap((l) => l.tags.map((t) => [t.id, l.id] as const))), [layers]);
  const accounts = [...new Set([...(view?.items ?? []).map(account), ...chosenAccounts])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const items = sortByDay(
    (view?.items ?? []).filter(
      (item) => matchesFilter(filter, item.direction) && matchesAccounts(chosenAccounts, account(item)) && matchesTags(chosenTags, layerOf, item.tags),
    ),
  );
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [tagging, setTagging] = useState(false);
  const monthId = monthKey(month);
  useEffect(() => setSelection([]), [monthId]);
  // Only what the list shows counts: a filter that hides a lançamento takes it out of the batch.
  const selected = items.filter((item) => selection.includes(item.id));
  const allSelected = items.length > 0 && selected.length === items.length;
  const toggle = (id: string) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
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
        {accounts.length > 1 && (
          <div className="lanc-toolbar" role="group" aria-label={text.accounts}>
            <Link
              to={withList(listPath, search, 'conta', [])}
              className="chip lanc-filter"
              aria-current={chosenAccounts.length === 0 ? 'true' : undefined}
            >
              {text.allAccounts}
            </Link>
            {accounts.map((a) => (
              <Link
                key={a}
                to={withList(listPath, search, 'conta', toggleAccount(chosenAccounts, a))}
                className="chip lanc-filter"
                aria-current={chosenAccounts.includes(a) ? 'true' : undefined}
              >
                {a}
              </Link>
            ))}
          </div>
        )}

        {layers.map((layer) =>
          layer.tags.length === 0 ? null : (
            <div key={layer.id} className="lanc-toolbar" role="group" aria-label={text.tagFilter(layer.name)}>
              <span className="text-label muted lanc-toolbar-label">{layer.name}</span>
              {layer.tags.map((tag) => (
                <Link
                  key={tag.id}
                  to={withList(listPath, search, 'tag', toggleAccount(chosenTags, tag.id))}
                  className="chip lanc-filter"
                  aria-current={chosenTags.includes(tag.id) ? 'true' : undefined}
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          ),
        )}

        <div className="lanc-actions">
          <button type="button" disabled={selected.length === 0} onClick={() => setTagging(true)}>
            {text.addTags}
          </button>
          {selected.length > 0 && (
            <>
              <span className="text-label muted">{text.selected(selected.length)}</span>
              <button type="button" className="secondary" onClick={() => setSelection([])}>
                {text.clearSelection}
              </button>
            </>
          )}
        </div>

        <LoadError error={query.error} reload={query.reload} />
        {view && items.length === 0 && <p className="muted">{view.items.length === 0 ? text.empty : text.emptyFiltered}</p>}

        {items.length > 0 && (
          <div className="lanc-table">
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
              <div className="lanc-row lanc-row--head text-over muted" aria-hidden="true">
                <span>{text.columns.date}</span>
                <span>{text.columns.description}</span>
                <span>{text.columns.category}</span>
                <span>{text.columns.tags}</span>
                <span className="lanc-amount">{text.columns.amount}</span>
              </div>
            </div>
            <ul className="lanc-list">
              {items.map((item) => (
                <li key={item.id} className="lanc-line">
                  <input
                    type="checkbox"
                    className="lanc-check"
                    aria-label={text.select(item.description ?? text.noDescription)}
                    checked={selection.includes(item.id)}
                    onChange={() => toggle(item.id)}
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
