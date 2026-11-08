import { useState, type FormEvent } from 'react';
import type { RulePreviewView, RuleView, TagLayerView } from '../../application/api-contract';
import { dayLabel } from '../../domain/lancamentos';
import type { CategoryOption } from '../../domain/pluggy-categories';
import { containsExpression, LANCAMENTO_TYPES, MAX_RULE_PARTS, MAX_RULE_TEXT_LENGTH, MAX_RULES, type RuleAction, type RuleCondition, type RuleDefinition } from '../../domain/rules';
import { strings } from '../../domain/strings';
import { cleanName, type TagAssignment } from '../../domain/tags';
import { saoPauloDate } from '../../domain/vault';
import { useServices } from '../backend-context';
import { useQuery } from '../use-query';
import { PageHeader } from '../shell/PageHeader';

const text = strings.regras;

const amount = (item: { amountCents: number; currency: string; direction: 'in' | 'out' }) =>
  `${item.direction === 'in' ? '+ ' : ''}${(item.amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: item.currency })}`;

type ConditionField = keyof typeof text.conditionFields;
type ActionField = keyof typeof text.actionFields;

const conditionField = (c: RuleCondition): ConditionField => (c.kind === 'descriptionContains' ? 'description' : c.kind === 'payerContains' ? 'payer' : 'type');
const actionField = (a: RuleAction): ActionField => (a.kind === 'addTags' ? 'tags' : a.kind === 'setCategory' ? 'category' : 'description');

function newCondition(field: ConditionField): RuleCondition {
  if (field === 'description') return { kind: 'descriptionContains', text: '' };
  if (field === 'payer') return { kind: 'payerContains', text: '' };
  return { kind: 'type', type: 'out' };
}

/** The conditions that compare a text, with "|" and "&". */
const isTextCondition = (c: RuleCondition): c is Extract<RuleCondition, { text: string }> => c.kind === 'descriptionContains' || c.kind === 'payerContains';

/** A new action; "substitua" starts with the first "descrição contém" text, when it is a plain one. */
function newAction(field: ActionField, conditions: readonly RuleCondition[]): RuleAction {
  if (field === 'tags') return { kind: 'addTags', tags: {} };
  if (field === 'category') return { kind: 'setCategory', categoryId: '' };
  const contains = conditions.find((c) => c.kind === 'descriptionContains');
  const find = contains && !/[|&]/.test(contains.text) ? cleanName(contains.text) : '';
  return { kind: 'replaceInDescription', find, replace: '' };
}

function conditionSummary(c: RuleCondition): string {
  if (c.kind === 'descriptionContains') return text.containsSummary(c.text);
  if (c.kind === 'payerContains') return text.payerSummary(c.text);
  return text.typeLine(text.typeSummary[c.type]);
}

/** Why the text of a "contém" condition cannot be saved; null when it can. */
function containsProblem(raw: string, empty: string): string | null {
  const cleaned = cleanName(raw);
  if (!cleaned) return empty;
  if ([...cleaned].length > MAX_RULE_TEXT_LENGTH) return text.textTooLong;
  if (!containsExpression(cleaned)) return text.loneOperator;
  return null;
}

function conditionsProblem(conditions: readonly RuleCondition[]): string | null {
  for (const c of conditions) {
    const problem = isTextCondition(c) ? containsProblem(c.text, c.kind === 'payerContains' ? text.needPayer : text.needText) : null;
    if (problem) return problem;
  }
  return null;
}

function actionsProblem(actions: readonly RuleAction[]): string | null {
  for (const a of actions) {
    if (a.kind === 'addTags' && Object.keys(a.tags).length === 0) return text.needTag;
    if (a.kind === 'setCategory' && !a.categoryId) return text.needCategory;
    if (a.kind === 'replaceInDescription') {
      if (!cleanName(a.find)) return text.needFind;
      if ([...cleanName(a.find)].length > MAX_RULE_TEXT_LENGTH || [...a.replace].length > MAX_RULE_TEXT_LENGTH) return text.textTooLong;
    }
  }
  return null;
}

const cleanConditions = (conditions: readonly RuleCondition[]): RuleCondition[] =>
  conditions.map((c) => (isTextCondition(c) ? { kind: c.kind, text: cleanName(c.text) } : c));
const cleanActions = (actions: readonly RuleAction[]): RuleAction[] =>
  actions.map((a) => (a.kind === 'replaceInDescription' ? { kind: a.kind, find: cleanName(a.find), replace: a.replace } : a));

const optionLabel = (option: CategoryOption) => `${'\u00a0\u00a0\u00a0'.repeat(option.depth)}${option.name}`;

/** "Tipo: Restaurante, Origem: Impulso", in the layers' order. */
function tagNames(tags: TagAssignment, layers: readonly TagLayerView[]): string {
  return layers
    .flatMap((layer) => {
      const tag = layer.tags.find((t) => t.id === tags[layer.id]);
      return tag ? [`${layer.name}: ${tag.name}`] : [];
    })
    .join(', ');
}

// Regras automáticas (docs/spec/regras-automaticas.md): "sempre que <campo> <condição>, faça
// <campo> <consequência>". Here I create, test, edit, reorder and delete rules, and run them over what is stored.
export function Regras() {
  const rulesQuery = useQuery('rules', {}, ['rules', 'tags']);
  const layersQuery = useQuery('tagLayers', {}, ['tags']);
  const categoriesQuery = useQuery('pluggyCategories', {}, ['vault']);
  const rules = rulesQuery.data ?? [];
  const layers = layersQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const error = rulesQuery.error ?? layersQuery.error ?? categoriesQuery.error;
  const loaded = rulesQuery.data && layersQuery.data && categoriesQuery.data;

  return (
    <section className="page tags">
      <PageHeader title={text.title} subtitle={text.subtitle} />
      {error && error !== 'unauthenticated' && error !== 'locked' && (
        <p className="notice" role="alert">
          {strings.genericError}{' '}
          <button
            type="button"
            className="secondary"
            onClick={() => {
              rulesQuery.reload();
              layersQuery.reload();
              categoriesQuery.reload();
            }}
          >
            {strings.retry}
          </button>
        </p>
      )}
      {loaded && rules.length > 0 && <ApplyRules />}
      {loaded &&
        (rules.length >= MAX_RULES ? (
          <p className="muted">{text.limit}</p>
        ) : (
          <article className="tile">
            <h2 className="text-title">{text.newRule}</h2>
            <RuleForm layers={layers} categories={categories} submit={text.create} />
          </article>
        ))}
      {loaded && rules.length === 0 && <p className="muted">{text.empty}</p>}
      {rules.map((rule, index) => (
        <Rule key={rule.id} rule={rule} layers={layers} categories={categories} first={index === 0} last={index === rules.length - 1} />
      ))}
    </section>
  );
}

interface Choices {
  readonly layers: readonly TagLayerView[];
  readonly categories: readonly CategoryOption[];
}

/** A rule's consequence in one sentence. */
function ActionSummary({ action, layers, categories }: { action: RuleAction } & Choices) {
  if (action.kind === 'replaceInDescription') return <>{text.replaceSummary(action.find, action.replace.trim())}</>;
  if (action.kind === 'setCategory') {
    const category = categories.find((c) => c.id === action.categoryId);
    return category ? <>{text.categorySummary(category.name)}</> : <span className="tags-danger">{text.deletedCategory}</span>;
  }
  const tags = tagNames(action.tags, layers);
  return tags ? <>{text.tagsSummary(tags)}</> : <span className="tags-danger">{text.deletedTags}</span>;
}

function Rule({ rule, layers, categories, first, last }: { rule: RuleView; first: boolean; last: boolean } & Choices) {
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
        <RuleForm layers={layers} categories={categories} initial={rule} submit={text.save} onDone={() => setEditing(false)} />
      </article>
    );
  }

  return (
    <article className="tile">
      <div className="tile-head">
        <div className="rules-summary">
          {rule.actions.map((action, index) => (
            <p key={index} className="rules-summary-main">
              <ActionSummary action={action} layers={layers} categories={categories} />
            </p>
          ))}
          {rule.conditions.map((condition, index) => (
            <p key={index}>{text.whenLine(conditionSummary(condition), index === 0)}</p>
          ))}
        </div>
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

/**
 * "Sempre que <campo> <condição> (e ...), faça <campo> <consequência> (e ...)", with a test button.
 * Each condition and each consequence is a row: the field it looks at or changes, then what.
 */
function RuleForm({ layers, categories, initial, submit, onDone }: { initial?: RuleView; submit: string; onDone?: () => void } & Choices) {
  const { backend } = useServices();
  const hasTags = layers.some((layer) => layer.tags.length > 0);
  const actionFields = (Object.keys(text.actionFields) as ActionField[]).filter((field) => field !== 'tags' || hasTags);
  const blank = (): { conditions: RuleCondition[]; actions: RuleAction[] } => {
    const conditions = [newCondition('description')];
    return { conditions, actions: [newAction(actionFields[0], conditions)] };
  };
  const [conditions, setConditionsState] = useState<RuleCondition[]>(() => (initial ? [...initial.conditions] : blank().conditions));
  const [actions, setActions] = useState<RuleAction[]>(() => (initial ? [...initial.actions] : blank().actions));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RulePreviewView | null>(null);
  const [testing, setTesting] = useState(false);

  function setConditions(next: RuleCondition[]) {
    setConditionsState(next);
    setPreview(null);
  }
  const changeCondition = (index: number, c: RuleCondition) => setConditions(conditions.map((old, i) => (i === index ? c : old)));
  function changeActions(next: RuleAction[]) {
    setActions(next);
    setPreview(null);
  }
  const changeAction = (index: number, a: RuleAction) => changeActions(actions.map((old, i) => (i === index ? a : old)));

  async function test() {
    const problem = conditionsProblem(conditions);
    if (problem) return setError(problem);
    setError(null);
    setTesting(true);
    const result = await backend.query('rulePreview', { conditions: cleanConditions(conditions), ...(actionsProblem(actions) ? {} : { actions: cleanActions(actions) }) });
    setTesting(false);
    if (result.ok) setPreview(result.value);
    else setError(strings.genericError);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = conditionsProblem(conditions) ?? actionsProblem(actions);
    if (problem) return setError(problem);
    setBusy(true);
    const rule: RuleDefinition = { conditions: cleanConditions(conditions), actions: cleanActions(actions) };
    const result = initial ? await backend.command('rule.update', { id: initial.id, ...rule }) : await backend.command('rule.create', rule);
    setBusy(false);
    if (!result.ok) return setError(strings.genericError);
    setError(null);
    setPreview(null);
    if (onDone) onDone();
    else {
      const fresh = blank();
      setConditionsState(fresh.conditions);
      setActions(fresh.actions);
    }
  }

  const removeButton = (onClick: () => void, disabled: boolean) => (
    <button type="button" className="icon-button" aria-label={text.removeRow} title={text.removeRow} disabled={disabled} onClick={onClick}>
      ×
    </button>
  );

  return (
    <form className="stack rules-form" onSubmit={(event) => void onSubmit(event)}>
      <fieldset className="rules-group">
        <legend className="text-label muted">{text.when}</legend>
        {conditions.map((condition, index) => (
          <div key={index} className="rules-row">
            <label className="lanc-category-field">
              <span className="text-caption muted">{text.field}</span>
              <select value={conditionField(condition)} onChange={(e) => changeCondition(index, newCondition(e.target.value as ConditionField))}>
                {(Object.keys(text.conditionFields) as ConditionField[]).map((field) => (
                  <option key={field} value={field}>
                    {text.conditionFields[field]}
                  </option>
                ))}
              </select>
            </label>
            <label className="lanc-category-field">
              <span className="text-caption muted">{text.condition}</span>
              <select defaultValue={condition.kind}>
                <option value={condition.kind}>{isTextCondition(condition) ? text.operators.contains : text.operators.is}</option>
              </select>
            </label>
            {isTextCondition(condition) ? (
              <label className="grow">
                <span className="text-caption muted">&nbsp;</span>
                <input
                  value={condition.text}
                  placeholder={condition.kind === 'payerContains' ? text.payerPlaceholder : text.whenPlaceholder}
                  onChange={(e) => changeCondition(index, { kind: condition.kind, text: e.target.value })}
                  autoComplete="off"
                  autoFocus={Boolean(initial) && index === 0}
                />
              </label>
            ) : (
              <label className="lanc-category-field rules-type">
                <span className="text-caption muted">&nbsp;</span>
                <select value={condition.type} onChange={(e) => changeCondition(index, { kind: 'type', type: LANCAMENTO_TYPES.find((t) => t === e.target.value) ?? 'out' })}>
                  {LANCAMENTO_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {text.types[t]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {removeButton(() => setConditions(conditions.filter((_, i) => i !== index)), conditions.length === 1)}
          </div>
        ))}
        {conditions.some(isTextCondition) && <p className="text-caption muted">{text.whenHint}</p>}
        <div className="tags-actions">
          {conditions.length < MAX_RULE_PARTS && (
            <button type="button" className="button-outline" onClick={() => setConditions([...conditions, newCondition('description')])}>
              {text.addCondition}
            </button>
          )}
          <button type="button" className="secondary" disabled={testing || conditionsProblem(conditions) !== null} onClick={() => void test()}>
            {testing ? text.testing : text.test}
          </button>
        </div>
      </fieldset>
      <fieldset className="rules-group">
        <legend className="text-label muted">{text.then}</legend>
        {actions.map((action, index) => (
          <div key={index} className="rules-row">
            <label className="lanc-category-field">
              <span className="text-caption muted">{text.field}</span>
              <select value={actionField(action)} onChange={(e) => changeAction(index, newAction(e.target.value as ActionField, conditions))}>
                {actionFields.map((field) => (
                  <option key={field} value={field}>
                    {text.actionFields[field]}
                  </option>
                ))}
              </select>
            </label>
            <label className="lanc-category-field">
              <span className="text-caption muted">{text.consequence}</span>
              <select defaultValue={action.kind}>
                <option value={action.kind}>{text.operators[action.kind === 'addTags' ? 'addTags' : action.kind === 'setCategory' ? 'setCategory' : 'replace']}</option>
              </select>
            </label>
            {action.kind === 'addTags' ? (
              <div className="rules-tags">
                {layers
                  .filter((layer) => layer.tags.length > 0)
                  .map((layer) => (
                    <label key={layer.id} className="lanc-category-field">
                      <span className="text-caption muted">{layer.name}</span>
                      <select
                        value={action.tags[layer.id] ?? ''}
                        onChange={(e) => {
                          const { [layer.id]: _old, ...rest } = action.tags;
                          changeAction(index, { kind: 'addTags', tags: e.target.value ? { ...rest, [layer.id]: e.target.value } : rest });
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
              </div>
            ) : action.kind === 'setCategory' ? (
              <label className="lanc-category-field grow">
                <span className="text-caption muted">&nbsp;</span>
                <select value={action.categoryId} onChange={(e) => changeAction(index, { kind: 'setCategory', categoryId: e.target.value })}>
                  <option value="">{text.chooseCategory}</option>
                  {categories.map((option) => (
                    <option key={option.id} value={option.id}>
                      {optionLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="grow">
                  <span className="text-caption muted">&nbsp;</span>
                  <input value={action.find} placeholder={text.findPlaceholder} onChange={(e) => changeAction(index, { ...action, find: e.target.value })} autoComplete="off" />
                </label>
                <span className="rules-by">{text.replaceBy}</span>
                <label className="grow">
                  <span className="text-caption muted">&nbsp;</span>
                  <input value={action.replace} placeholder={text.replacePlaceholder} onChange={(e) => changeAction(index, { ...action, replace: e.target.value })} autoComplete="off" />
                </label>
              </>
            )}
            {removeButton(() => changeActions(actions.filter((_, i) => i !== index)), actions.length === 1)}
          </div>
        ))}
        {actions.some((a) => a.kind === 'replaceInDescription') && <p className="text-caption muted">{text.replaceHint}</p>}
        {actions.length < MAX_RULE_PARTS && (
          <div>
            <button type="button" className="button-outline" onClick={() => changeActions([...actions, newAction(actionFields[0], conditions)])}>
              {text.addAction}
            </button>
          </div>
        )}
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
    setMessage(result.ok ? text.apply.done(result.value.tagged, result.value.described, result.value.categorized) : strings.genericError);
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
