import { useState, type FormEvent } from 'react';
import type { ApiError, ApiResult, TagLayerView, TagView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { canAddLayer, cleanName, nameProblem } from '../../domain/tags';
import { useServices } from '../backend-context';
import { useQuery } from '../use-query';
import { PageHeader } from '../shell/PageHeader';

const text = strings.categorias;

// Categorias (docs/spec/categorias.md): the layers of tags, each with its own meaning. Here I
// create, rename, reorder and delete layers, and add, rename and delete each layer's tags.
export function Categorias() {
  const query = useQuery('tagLayers', {}, ['tags']);
  const layers = query.data ?? [];

  return (
    <section className="page tags">
      <PageHeader title={text.title} subtitle={text.subtitle} />
      {query.error && query.error !== 'unauthenticated' && query.error !== 'locked' && (
        <p className="notice" role="alert">
          {strings.genericError}{' '}
          <button type="button" className="secondary" onClick={query.reload}>
            {strings.retry}
          </button>
        </p>
      )}
      {query.data && layers.length === 0 && <p className="muted">{text.empty}</p>}
      {layers.map((layer, index) => (
        <Layer key={layer.id} layer={layer} siblings={layers} first={index === 0} last={index === layers.length - 1} />
      ))}
      {query.data && <NewLayer layers={layers} />}
    </section>
  );
}

/** The message for a name the domain or the server refused; null when the call worked. */
function nameError(result: ApiResult<unknown>, duplicate = text.names.duplicate): string | null {
  if (result.ok) return null;
  const messages: Partial<Record<ApiError, string>> = { invalid: text.names.too_long, conflict: duplicate };
  return messages[result.error] ?? strings.genericError;
}

/** Checks a name before sending it, so the common mistakes need no round trip. */
function localProblem(name: string, siblings: readonly string[]): string | null {
  const problem = nameProblem(name, siblings);
  return problem ? text.names[problem] : null;
}

function NameForm({
  label,
  initial = '',
  placeholder,
  submit,
  onCancel,
  siblings,
  save,
}: {
  label: string;
  initial?: string;
  placeholder?: string;
  submit: string;
  onCancel?: () => void;
  siblings: readonly string[];
  /** Sends the name; returns an error message, or null when it worked. */
  save: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = localProblem(name, siblings);
    if (problem) return setError(problem);
    setBusy(true);
    const failure = await save(cleanName(name));
    setBusy(false);
    setError(failure);
    if (!failure && !onCancel) setName('');
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <div className="tags-form">
        <label className="grow">
          <span className="text-label muted">{label}</span>
          <input
            value={name}
            placeholder={placeholder}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            autoFocus={Boolean(onCancel)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && onCancel) {
                e.stopPropagation();
                onCancel();
              }
            }}
          />
        </label>
        <button type="submit" disabled={busy || !cleanName(name)}>
          {submit}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            {text.cancel}
          </button>
        )}
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function NewLayer({ layers }: { layers: readonly TagLayerView[] }) {
  const { backend } = useServices();
  return (
    <article className="tile">
      <h2 className="text-title">{text.newLayer.title}</h2>
      {canAddLayer(layers.length) ? (
        <NameForm
          label={text.newLayer.field}
          placeholder={text.newLayer.placeholder}
          submit={text.newLayer.submit}
          siblings={layers.map((l) => l.name)}
          save={async (name) => {
            const result = await backend.command('tagLayer.create', { name });
            // The server says conflict for a repeated name and for a sixth layer; the form only
            // shows while there are fewer than 5, so here it is the name.
            return nameError(result);
          }}
        />
      ) : (
        <p className="muted">{text.newLayer.limit}</p>
      )}
    </article>
  );
}

function Layer({ layer, siblings, first, last }: { layer: TagLayerView; siblings: readonly TagLayerView[]; first: boolean; last: boolean }) {
  const { backend } = useServices();
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(call: Promise<ApiResult<unknown>>) {
    setError(null);
    const result = await call;
    if (!result.ok) setError(strings.genericError);
  }

  function remove() {
    if (window.confirm(text.layer.confirmDelete(layer.name, layer.tags.length))) void run(backend.command('tagLayer.delete', { id: layer.id }));
  }

  const others = siblings.filter((l) => l.id !== layer.id).map((l) => l.name);
  const tagNames = layer.tags.map((t) => t.name);

  return (
    <article className="tile" aria-label={layer.name}>
      {renaming ? (
        <NameForm
          label={text.layer.field}
          initial={layer.name}
          submit={text.save}
          siblings={others}
          onCancel={() => setRenaming(false)}
          save={async (name) => {
            const failure = nameError(await backend.command('tagLayer.rename', { id: layer.id, name }));
            if (!failure) setRenaming(false);
            return failure;
          }}
        />
      ) : (
        <div className="tile-head">
          <div>
            <h2 className="text-title">{layer.name}</h2>
            <span className="text-caption muted">{text.layer.count(layer.tags.length)}</span>
          </div>
          <div className="tags-actions">
            <button type="button" className="icon-button" aria-label={text.layer.up} title={text.layer.up} disabled={first} onClick={() => void run(backend.command('tagLayer.move', { id: layer.id, direction: 'up' }))}>
              ↑
            </button>
            <button type="button" className="icon-button" aria-label={text.layer.down} title={text.layer.down} disabled={last} onClick={() => void run(backend.command('tagLayer.move', { id: layer.id, direction: 'down' }))}>
              ↓
            </button>
            <button type="button" className="button-outline" onClick={() => setRenaming(true)}>
              {text.rename}
            </button>
            <button type="button" className="button-outline tags-danger" onClick={remove}>
              {text.delete}
            </button>
          </div>
        </div>
      )}
      {layer.tags.length === 0 ? (
        <p className="muted">{text.layer.empty}</p>
      ) : (
        <ul className="list tags-chips">
          {layer.tags.map((tag) =>
            editing === tag.id ? (
              <li key={tag.id} className="tags-editing">
                <TagEditor tag={tag} siblings={tagNames.filter((n) => n !== tag.name)} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={tag.id}>
                <button type="button" className="chip tags-chip" aria-label={text.tag.edit(tag.name)} onClick={() => setEditing(tag.id)}>
                  {tag.name}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      <NameForm
        label={text.tag.field}
        placeholder={text.tag.placeholder}
        submit={text.tag.add}
        siblings={tagNames}
        save={async (name) => nameError(await backend.command('tag.create', { layerId: layer.id, name }))}
      />
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function TagEditor({ tag, siblings, onDone }: { tag: TagView; siblings: readonly string[]; onDone: () => void }) {
  const { backend } = useServices();
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(text.tag.confirmDelete(tag.name))) return;
    const result = await backend.command('tag.delete', { id: tag.id });
    if (result.ok) onDone();
    else setError(strings.genericError);
  }

  return (
    <div className="stack">
      <NameForm
        label={text.tag.editField}
        initial={tag.name}
        submit={text.save}
        siblings={siblings}
        onCancel={onDone}
        save={async (name) => {
          const failure = nameError(await backend.command('tag.rename', { id: tag.id, name }));
          if (!failure) onDone();
          return failure;
        }}
      />
      <div>
        <button type="button" className="button-outline tags-danger" onClick={() => void remove()}>
          {text.delete}
        </button>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
