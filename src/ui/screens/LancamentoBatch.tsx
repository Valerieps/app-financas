// The pieces the Lançamentos list shares with the list under a slice in Gráficos › Por tag: the
// selection of many lançamentos (docs/spec/categorias.md) and the batch actions on it, "Adicionar
// tags" and "Mudar categoria", with their forms.
import { useEffect, useRef, useState } from 'react';
import type { LancamentoView, TagLayerView } from '../../application/api-contract';
import { clickSelection } from '../../domain/lancamentos';
import type { CategoryOption } from '../../domain/pluggy-categories';
import { strings } from '../../domain/strings';
import { commonTags, MAX_BULK_TAGGING, tagChanges, toggleTag, type TagAssignment } from '../../domain/tags';
import { useServices } from '../backend-context';
import { Link } from '../router';
import { Icon } from '../shell/Icon';
import { modulePath } from '../shell/routes';
import { useQuery } from '../use-query';

const text = strings.lancamentos;

export const money = (cents: number, currency: string) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });
export const signed = (item: { amountCents: number; currency: string; direction: 'in' | 'out' }) =>
  `${item.direction === 'in' ? '+ ' : ''}${money(item.amountCents, item.currency)}`;

export function account(item: LancamentoView): string {
  const type = item.accountType ? text.accountTypes[item.accountType] : undefined;
  return [item.accountName, type].filter(Boolean).join(' ') || '—';
}

/**
 * The boxes of a list: which lançamentos are chosen. Only what the list shows counts, so a filter that
 * hides a lançamento takes it out of the batch; a new `resetKey` (another month) clears it.
 */
export function useSelection(items: readonly LancamentoView[], resetKey: string) {
  const [selection, setSelection] = useState<readonly string[]>([]);
  useEffect(() => setSelection([]), [resetKey]);
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
  const toggleAll = () => setSelection(allSelected ? [] : items.map((i) => i.id));
  return { selection, setSelection, selected, allSelected, clickBox, toggleAll };
}

/** The toolbar while lançamentos are chosen: how many, the batch actions and their forms. */
export function SelectionActions({
  selected,
  layers,
  onClear,
}: {
  selected: readonly LancamentoView[];
  layers: readonly TagLayerView[];
  /** Clears the selection: on "Limpar seleção" and after a save. */
  onClear: () => void;
}) {
  const [tagging, setTagging] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  return (
    <>
      <div className="lanc-toolbar lanc-toolbar--selection" role="group" aria-label={text.selectionActions}>
        <span className="text-strong">{text.selected(selected.length)}</span>
        <button type="button" className="lanc-small" onClick={() => setTagging(true)}>
          {text.addTags}
        </button>
        <button type="button" className="lanc-small" onClick={() => setCategorizing(true)}>
          {text.changeCategory}
        </button>
        <button type="button" className="secondary lanc-small" onClick={onClear}>
          {text.clearSelection}
        </button>
      </div>
      {tagging && selected.length > 0 && (
        <TagDialog
          layers={layers}
          items={selected}
          onClose={() => setTagging(false)}
          onSaved={() => {
            setTagging(false);
            onClear();
          }}
        />
      )}
      {categorizing && selected.length > 0 && (
        <CategoryDialog
          ids={selected.map((i) => i.id)}
          onClose={() => setCategorizing(false)}
          onSaved={() => {
            setCategorizing(false);
            onClear();
          }}
        />
      )}
    </>
  );
}

/** The lançamento's tag names, in the layers' order. */
function tagNames(layers: readonly TagLayerView[], tags: TagAssignment): string[] {
  return layers.flatMap((layer) => layer.tags.filter((t) => t.id === tags[layer.id]).map((t) => t.name));
}

export function TagCell({ layers, tags }: { layers: readonly TagLayerView[]; tags: TagAssignment }) {
  const names = tagNames(layers, tags);
  if (names.length === 0) return <span className="muted">{text.noTags}</span>;
  return (
    <span className="lanc-tags" title={names.join(', ')}>
      <span className="chip lanc-tag">{names[0]}</span>
      {names.length > 1 && <span className="lanc-tag-more muted">+{names.length - 1}</span>}
    </span>
  );
}

/**
 * "Adicionar tags": every layer with its tags; I tap the tags and save. It starts with the tags
 * the chosen lançamentos share, and saving changes only the layers I touched.
 */
export function TagDialog({
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
export const optionLabel = (option: CategoryOption) => `${'\u00a0\u00a0\u00a0'.repeat(option.depth)}${option.name}`;

/** "Mudar categoria": one category from Pluggy's tree for every chosen lançamento, or Pluggy's back. */
export function CategoryDialog({ ids, onClose, onSaved }: { ids: readonly string[]; onClose: () => void; onSaved: () => void }) {
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
export const PLUGGY = 'pluggy';

