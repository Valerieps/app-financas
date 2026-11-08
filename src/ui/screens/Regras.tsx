import { useState, type FormEvent } from 'react';
import type { RulePreviewView, RuleView, TagLayerView } from '../../application/api-contract';
import { dayLabel } from '../../domain/lancamentos';
import { LANCAMENTO_TYPES, MAX_RULE_TEXT_LENGTH, MAX_RULES, type LancamentoType, type RuleCondition, type RuleDefinition } from '../../domain/rules';
import { strings } from '../../domain/strings';
import { cleanName, type TagAssignment } from '../../domain/tags';
import { saoPauloDate } from '../../domain/vault';
import { useServices } from '../backend-context';
import { useQuery } from '../use-query';

const text = strings.regras;

const amount = (item: { amountCents: number; currency: string; direction: 'in' | 'out' }) =>
  `${item.direction === 'in' ? '+ ' : ''}${(item.amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: item.currency })}`;

/** The text of a rule's first "descrição contém" condition, the only kind the screen edits today. */
const containsText = (rule: Pick<RuleDefinition, 'conditions'>) => rule.conditions.find((c) => c.kind === 'descriptionContains')?.text ?? '';

/** The type a rule's "tipo" condition asks for; null when it takes any type. */
const ruleType = (rule: Pick<RuleDefinition, 'conditions'>): LancamentoType | null =>
  rule.conditions.reduce<LancamentoType | null>((found, c) => (c.kind === 'type' ? c.type : found), null);

/** The tags of a rule's "adicionar tags" actions, layer by layer. */
function ruleTags(rule: Pick<RuleDefinition, 'actions'>): TagAssignment {
  return Object.assign({}, ...rule.actions.map((a) => (a.kind === 'addTags' ? a.tags : {}))) as TagAssignment;
}

/** "Tipo: Restaurante, Origem: Impulso", in the layers' order. */
function tagNames(tags: TagAssignment, layers: readonly TagLayerView[]): string {
  return layers
    .flatMap((layer) => {
      const tag = layer.tags.find((t) => t.id === tags[layer.id]);
      return tag ? [`${layer.name}: ${tag.name}`] : [];
    })
    .join(', ');
}

// Regras automáticas (docs/spec/regras-automaticas.md): "sempre que a descrição contiver X (e o
// lançamento for uma saída, entrada ou transferência), aplique as tags Y". Here I create, test, edit, reorder and delete rules, and run them over what is stored.
export function Regras() {
  const rulesQuery = useQuery('rules', {}, ['rules', 'tags']);
  const layersQuery = useQuery('tagLayers', {}, ['tags']);
  const rules = rulesQuery.data ?? [];
  const layers = layersQuery.data ?? [];
  const error = rulesQuery.error ?? layersQuery.error;
  const loaded = rulesQuery.data && layersQuery.data;

  return (
    <section className="stack tags">
      <header>
        <h1>{text.title}</h1>
        <p className="muted">{text.subtitle}</p>
      </header>
      {error && error !== 'unauthenticated' && error !== 'locked' && (
        <p className="notice" role="alert">
          {strings.genericError}{' '}
          <button
            type="button"
            className="secondary"
            onClick={() => {
              rulesQuery.reload();
              layersQuery.reload();
            }}
          >
            {strings.retry}
          </button>
        </p>
      )}
      {loaded && rules.length === 0 && <p className="muted">{text.empty}</p>}
      {rules.map((rule, index) => (
        <Rule key={rule.id} rule={rule} layers={layers} first={index === 0} last={index === rules.length - 1} />
      ))}
      {loaded &&
        (layers.every((l) => l.tags.length === 0) ? (
          <p className="muted">{text.noLayers}</p>
        ) : rules.length >= MAX_RULES ? (
          <p className="muted">{text.limit}</p>
        ) : (
          <article className="tile">
            <h2 className="text-title">{text.newRule}</h2>
            <RuleForm layers={layers} submit={text.create} />
          </article>
        ))}
      {loaded && rules.length > 0 && <ApplyRules />}
    </section>
  );
}

function Rule({ rule, layers, first, last }: { rule: RuleView; layers: readonly TagLayerView[]; first: boolean; last: boolean }) {
  const { backend } = useServices();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(call: Promise<{ ok: boolean }>) {
    setError(null);
    if (!(await call).ok) setError(strings.genericError);
  }

  if (editing) {
    return (
      <article className="tile">
        <RuleForm layers={layers} initial={rule} submit={text.save} onDone={() => setEditing(false)} />
      </article>
    );
  }

  const tags = tagNames(ruleTags(rule), layers);
  const type = ruleType(rule);
  return (
    <article className="tile">
      <div className="tile-head">
        <p className="rules-summary">
          {text.summary(containsText(rule), type && text.typeSummary[type])}, {tags ? text.tagsSummary(tags) : <span className="tags-danger">{text.deletedTags}</span>}.
        </p>
        <div className="tags-actions">
          <button type="button" className="icon-button" aria-label={text.up} title={text.up} disabled={first} onClick={() => void run(backend.command('rule.move', { id: rule.id, direction: 'up' }))}>
            ↑
          </button>
          <button type="button" className="icon-button" aria-label={text.down} title={text.down} disabled={last} onClick={() => void run(backend.command('rule.move', { id: rule.id, direction: 'down' }))}>
            ↓
          </button>
          <button type="button" className="button-outline" onClick={() => setEditing(true)}>
            {text.edit}
          </button>
          <button
            type="button"
            className="button-outline tags-danger"
            onClick={() => {
              if (window.confirm(text.confirmDelete)) void run(backend.command('rule.delete', { id: rule.id }));
            }}
          >
            {text.delete}
          </button>
        </div>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

/** "Sempre que a descrição contiver <texto> e o lançamento for <tipo>, aplique as tags <uma por camada>", with a test button. */
function RuleForm({ layers, initial, submit, onDone }: { layers: readonly TagLayerView[]; initial?: RuleView; submit: string; onDone?: () => void }) {
  const { backend } = useServices();
  const [contains, setContains] = useState(initial ? containsText(initial) : '');
  const [type, setType] = useState<LancamentoType | null>(initial ? ruleType(initial) : null);
  const [tags, setTags] = useState<TagAssignment>(initial ? ruleTags(initial) : {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RulePreviewView | null>(null);
  const [testing, setTesting] = useState(false);

  const conditions: RuleCondition[] = [{ kind: 'descriptionContains', text: cleanName(contains) }, ...(type ? [{ kind: 'type', type } as const] : [])];

  function textProblem(): string | null {
    const cleaned = cleanName(contains);
    if (!cleaned) return text.needText;
    if ([...cleaned].length > MAX_RULE_TEXT_LENGTH) return text.textTooLong;
    return null;
  }

  async function test() {
    const problem = textProblem();
    if (problem) return setError(problem);
    setError(null);
    setTesting(true);
    const result = await backend.query('rulePreview', { conditions });
    setTesting(false);
    if (result.ok) setPreview(result.value);
    else setError(strings.genericError);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = textProblem() ?? (Object.keys(tags).length === 0 ? text.needTag : null);
    if (problem) return setError(problem);
    setBusy(true);
    const rule: RuleDefinition = { conditions, actions: [{ kind: 'addTags', tags }] };
    const result = initial ? await backend.command('rule.update', { id: initial.id, ...rule }) : await backend.command('rule.create', rule);
    setBusy(false);
    if (!result.ok) return setError(strings.genericError);
    setError(null);
    setPreview(null);
    if (onDone) onDone();
    else {
      setContains('');
      setType(null);
      setTags({});
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <div className="tags-form">
        <label className="grow">
          <span className="text-label muted">{text.when}</span>
          <input
            value={contains}
            placeholder={text.whenPlaceholder}
            onChange={(e) => {
              setContains(e.target.value);
              setPreview(null);
            }}
            autoComplete="off"
            autoFocus={Boolean(initial)}
          />
        </label>
        <button type="button" className="secondary" disabled={testing || !cleanName(contains)} onClick={() => void test()}>
          {testing ? text.testing : text.test}
        </button>
      </div>
      <label className="lanc-category-field rules-type">
        <span className="text-label muted">{text.type}</span>
        <select
          value={type ?? ''}
          onChange={(e) => {
            setType(LANCAMENTO_TYPES.find((t) => t === e.target.value) ?? null);
            setPreview(null);
          }}
        >
          <option value="">{text.types.any}</option>
          {LANCAMENTO_TYPES.map((t) => (
            <option key={t} value={t}>
              {text.types[t]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="rules-tags">
        <legend className="text-label muted">{text.then}</legend>
        {layers
          .filter((layer) => layer.tags.length > 0)
          .map((layer) => (
            <label key={layer.id} className="lanc-category-field">
              <span className="text-caption muted">{layer.name}</span>
              <select
                value={tags[layer.id] ?? ''}
                onChange={(e) => {
                  const { [layer.id]: _old, ...rest } = tags;
                  setTags(e.target.value ? { ...rest, [layer.id]: e.target.value } : rest);
                }}
              >
                <option value="">{text.noTag}</option>
                {layer.tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
      </fieldset>
      {preview && <Preview preview={preview} />}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="tags-actions">
        <button type="submit" disabled={busy}>
          {submit}
        </button>
        {onDone && (
          <button type="button" className="secondary" onClick={onDone}>
            {text.cancel}
          </button>
        )}
      </div>
    </form>
  );
}

function Preview({ preview }: { preview: RulePreviewView }) {
  const today = saoPauloDate(new Date());
  if (preview.total === 0) return <p className="muted">{text.preview.none}</p>;
  return (
    <div className="stack">
      <p className="text-caption muted">{text.preview.count(preview.total, preview.items.length)}</p>
      <ul className="list rules-preview">
        {preview.items.map((item) => (
          <li key={item.id} className="rules-preview-row">
            <span className="muted">{dayLabel(item.day, today, strings.lancamentos)}</span>
            <span className="text-over">{item.description ?? text.preview.noDescription}</span>
            <span className="rules-preview-amount">{amount(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApplyRules() {
  const { backend } = useServices();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function apply() {
    setRunning(true);
    setMessage(null);
    const result = await backend.command('rules.apply', {});
    setRunning(false);
    setMessage(result.ok ? text.apply.done(result.value.tagged) : strings.genericError);
  }

  return (
    <article className="tile">
      <h2 className="text-title">{text.apply.title}</h2>
      <p className="muted">{text.apply.hint}</p>
      <div>
        <button type="button" className="secondary" disabled={running} onClick={() => void apply()}>
          {running ? text.apply.running : text.apply.button}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </article>
  );
}
