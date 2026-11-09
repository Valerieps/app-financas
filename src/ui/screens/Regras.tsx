import { Fragment, useEffect, useState, type FormEvent } from 'react';
import type { RulePreviewView, RuleView, TagLayerView } from '../../application/api-contract';
import { dayLabel } from '../../domain/lancamentos';
import type { CategoryOption } from '../../domain/pluggy-categories';
import { containsExpression, LANCAMENTO_TYPES, MAX_RULE_PARTS, MAX_RULE_TEXT_LENGTH, MAX_RULES, RULE_MATCHES, ruleMatchesSearch, type RuleAction, type RuleCondition, type RuleDefinition, type RuleMatch } from '../../domain/rules';
import { strings } from '../../domain/strings';
import { cleanName, type TagAssignment } from '../../domain/tags';
import { saoPauloDate } from '../../domain/vault';
import { useServices } from '../backend-context';
import { useQuery } from '../use-query';
import { PageHeader } from '../shell/PageHeader';

const text = strings.regras;

/** How long the editor waits after the last keystroke before it looks for the lançamentos the rule catches. */
const PREVIEW_DELAY_MS = 400;

const amount = (item: { amountCents: number; currency: string; direction: 'in' | 'out' }) =>
  `${item.direction === 'in' ? '+ ' : ''}${(item.amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: item.currency })}`;

type ConditionField = keyof typeof text.conditionSubjects;
type ActionField = keyof typeof text.actionVerbs;

const CONDITION_FIELDS: Record<RuleCondition['kind'], ConditionField> = { descriptionContains: 'description', type: 'type', payerContains: 'payer', operationContains: 'operation', category: 'category' };
const conditionField = (c: RuleCondition): ConditionField => CONDITION_FIELDS[c.kind];
const actionField = (a: RuleAction): ActionField => (a.kind === 'addTags' ? 'tags' : a.kind === 'setCategory' ? 'category' : 'description');

function newCondition(field: ConditionField): RuleCondition {
  if (field === 'description') return { kind: 'descriptionContains', text: '' };
  if (field === 'payer') return { kind: 'payerContains', text: '' };
  if (field === 'operation') return { kind: 'operationContains', text: '' };
  if (field === 'category') return { kind: 'category', categoryId: '' };
  return { kind: 'type', type: 'out' };
}

/** The conditions that compare a text, with "|" and "&". */
const isTextCondition = (c: RuleCondition): c is Extract<RuleCondition, { text: string }> => 'text' in c;

/** A new action; "substitua" starts with the first "descrição contém" text, when it is a plain one. */
function newAction(field: ActionField, conditions: readonly RuleCondition[]): RuleAction {
  if (field === 'tags') return { kind: 'addTags', tags: {} };
  if (field === 'category') return { kind: 'setCategory', categoryId: '' };
  const contains = conditions.find((c) => c.kind === 'descriptionContains');
  const find = contains && !/[|&]/.test(contains.text) ? cleanName(contains.text) : '';
  return { kind: 'replaceInDescription', find, replace: '' };
}

function conditionSummary(c: RuleCondition, categories: readonly CategoryOption[]): string {
  if (c.kind === 'category') {
    const category = categories.find((option) => option.id === c.categoryId);
    return category ? text.inCategorySummary(category.name) : text.deletedConditionCategory;
  }
  if (c.kind === 'descriptionContains') return text.containsSummary(c.text);
  if (c.kind === 'payerContains') return text.payerSummary(c.text);
  if (c.kind === 'operationContains') return text.operationSummary(c.text);
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

const PLACEHOLDERS = { descriptionContains: text.whenPlaceholder, payerContains: text.payerPlaceholder, operationContains: text.operationPlaceholder };
const TEXT_NEEDED = { descriptionContains: text.needText, payerContains: text.needPayer, operationContains: text.needOperation };
const CHIP_FIELDS = { descriptionContains: text.chips.contains.description, payerContains: text.chips.contains.payer, operationContains: text.chips.contains.operation };

function conditionsProblem(conditions: readonly RuleCondition[]): string | null {
  for (const c of conditions) {
    const problem = isTextCondition(c) ? containsProblem(c.text, TEXT_NEEDED[c.kind]) : c.kind === 'category' && !c.categoryId ? text.needCategory : null;
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

const optionLabel = (option: CategoryOption) => `${'   '.repeat(option.depth)}${option.name}`;

/** ["Tipo: Restaurante", "Origem: Impulso"], in the layers' order. */
function tagNames(tags: TagAssignment, layers: readonly TagLayerView[]): string[] {
  return layers.flatMap((layer) => {
    const tag = layer.tags.find((t) => t.id === tags[layer.id]);
    return tag ? [`${layer.name}: ${tag.name}`] : [];
  });
}

interface Choices {
  readonly layers: readonly TagLayerView[];
  readonly categories: readonly CategoryOption[];
}

/** A condition as a short chip: "descrição contém ifood | rappi", "saída"; `missing` when its category was deleted. */
function conditionChip(c: RuleCondition, categories: readonly CategoryOption[]): { label: string; missing?: boolean } {
  if (isTextCondition(c)) return { label: text.chips.containsChip(CHIP_FIELDS[c.kind], c.text) };
  if (c.kind === 'type') return { label: text.types[c.type] };
  const category = categories.find((option) => option.id === c.categoryId);
  return category ? { label: text.chips.inCategory(category.name) } : { label: text.chips.deletedCategory, missing: true };
}

/** An action as chips; `missing` when its tags or its category were deleted. */
function actionChips(a: RuleAction, { layers, categories }: Choices): { label: string; missing?: boolean }[] {
  if (a.kind === 'replaceInDescription') return [{ label: text.chips.replace(a.find, a.replace.trim()) }];
  if (a.kind === 'setCategory') {
    const category = categories.find((c) => c.id === a.categoryId);
    return [category ? { label: text.chips.category(category.name) } : { label: text.chips.deletedCategory, missing: true }];
  }
  const names = tagNames(a.tags, layers);
  return names.length > 0 ? names.map((label) => ({ label })) : [{ label: text.chips.deletedTags, missing: true }];
}

/** A rule as one sentence, for screen readers and the search. */
function ruleSentence(rule: RuleDefinition, choices: Choices): string {
  const when = rule.conditions.map((c, i) => text.whenLine(conditionSummary(c, choices.categories), i === 0, rule.match === 'any')).join(' ');
  const then = rule.actions
    .map((a) => {
      if (a.kind === 'replaceInDescription') return text.replaceSummary(a.find, a.replace.trim());
      if (a.kind === 'setCategory') {
        const category = choices.categories.find((c) => c.id === a.categoryId);
        return category ? text.categorySummary(category.name) : text.deletedCategory;
      }
      const names = tagNames(a.tags, choices.layers);
      return names.length > 0 ? text.tagsSummary(names.join(', ')) : text.deletedTags;
    })
    .join('; ');
  return `${when}: ${then}`;
}

type Panel = { mode: 'new' } | { mode: 'edit'; id: string } | null;

// Regras automáticas (docs/spec/regras-automaticas.md): the rules as a dense numbered list, and a
// panel beside it where I write a rule as a sentence and see, as I type, which lançamentos it catches.
export function Regras() {
  const { backend } = useServices();
  const rulesQuery = useQuery('rules', {}, ['rules', 'tags']);
  const layersQuery = useQuery('tagLayers', {}, ['tags']);
  const categoriesQuery = useQuery('pluggyCategories', {}, ['vault']);
  const rules = rulesQuery.data ?? [];
  const layers = layersQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const choices: Choices = { layers, categories };
  const error = rulesQuery.error ?? layersQuery.error ?? categoriesQuery.error;
  const loaded = rulesQuery.data && layersQuery.data && categoriesQuery.data;
  const [panel, setPanel] = useState<Panel>(null);
  const [search, setSearch] = useState('');
  const [moveError, setMoveError] = useState(false);
  const [drag, setDrag] = useState<{ id: string; from: number; over: number } | null>(null);

  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);

  const editing = panel?.mode === 'edit' ? rules.find((r) => r.id === panel.id) : undefined;
  const editingIndex = editing ? rules.indexOf(editing) : -1;
  const shown = rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => ruleMatchesSearch([ruleSentence(rule, choices), ...rule.actions.flatMap((a) => actionChips(a, choices).map((c) => c.label))], search));

  async function move(input: { id: string; direction: 'up' | 'down' } | { id: string; to: number }) {
    setMoveError(false);
    if (!(await backend.command('rule.move', input)).ok) setMoveError(true);
  }

  /** Where the dragged rule would land, drawn as a line above or below the row it is over. */
  function dropClass(index: number): string {
    if (!drag || drag.over !== index || drag.from === index) return '';
    return drag.over < drag.from ? ' rules-item--drop-above' : ' rules-item--drop-below';
  }

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
      {loaded && (
        <div className="rules-layout">
          <article className="tile rules-list-tile">
            <div className="rules-toolbar">
              <h2 className="text-label rules-count">{text.count(rules.length)}</h2>
              {rules.length > 0 && <ApplyRules />}
              {rules.length < MAX_RULES && (
                <button type="button" onClick={() => setPanel({ mode: 'new' })}>
                  {text.newRule}
                </button>
              )}
            </div>
            {rules.length >= MAX_RULES && <p className="muted">{text.limit}</p>}
            {rules.length > 0 && <input type="search" className="rules-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={text.searchPlaceholder} aria-label={text.search} />}
            {moveError && (
              <p className="notice" role="alert">
                {strings.genericError}
              </p>
            )}
            {rules.length === 0 && <p className="muted">{text.empty}</p>}
            {rules.length > 0 && shown.length === 0 && <p className="muted">{text.noMatch}</p>}
            <ol className="rules-list">
              {shown.map(({ rule, index }) => (
                <li
                  key={rule.id}
                  className={`rules-item${editing?.id === rule.id ? ' rules-item--selected' : ''}${drag?.id === rule.id ? ' rules-item--dragging' : ''}${dropClass(index)}`}
                  onDragOver={(event) => {
                    if (!drag) return;
                    event.preventDefault();
                    if (drag.over !== index) setDrag({ ...drag, over: index });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (drag && drag.from !== index) void move({ id: drag.id, to: index });
                    setDrag(null);
                  }}
                >
                  <button
                    type="button"
                    className="rules-handle"
                    draggable
                    aria-label={`${text.ruleNumber(index + 1)}: ${text.handle}`}
                    title={text.handle}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', rule.id);
                      const row = event.currentTarget.closest('li');
                      if (row) event.dataTransfer.setDragImage(row, 0, 0);
                      setDrag({ id: rule.id, from: index, over: index });
                    }}
                    onDragEnd={() => setDrag(null)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' && index > 0) {
                        event.preventDefault();
                        void move({ id: rule.id, direction: 'up' });
                      }
                      if (event.key === 'ArrowDown' && index < rules.length - 1) {
                        event.preventDefault();
                        void move({ id: rule.id, direction: 'down' });
                      }
                    }}
                  >
                    ⋮⋮
                  </button>
                  <span className="rules-num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <button type="button" className="rules-open" onClick={() => setPanel({ mode: 'edit', id: rule.id })} aria-label={`${text.ruleNumber(index + 1)}: ${ruleSentence(rule, choices)}`}>
                    {rule.conditions.map((c, i) => {
                      const chip = conditionChip(c, categories);
                      return (
                        <Fragment key={`c${i}`}>
                          {i > 0 && rule.match === 'any' && (
                            <span className="rules-joiner" aria-hidden="true">
                              {text.or}
                            </span>
                          )}
                          <span className={chip.missing ? 'rules-chip rules-chip--missing' : 'rules-chip rules-chip--when'}>{chip.label}</span>
                        </Fragment>
                      );
                    })}
                    <span className="rules-arrow" aria-hidden="true">
                      →
                    </span>
                    {rule.actions.flatMap((a, i) =>
                      actionChips(a, choices).map((chip, j) => (
                        <span key={`a${i}-${j}`} className={chip.missing ? 'rules-chip rules-chip--missing' : 'rules-chip rules-chip--then'}>
                          {chip.label}
                        </span>
                      )),
                    )}
                  </button>
                  <span className="rules-move">
                    <button type="button" className="icon-button" aria-label={text.up} title={text.up} disabled={index === 0} onClick={() => void move({ id: rule.id, direction: 'up' })}>
                      ↑
                    </button>
                    <button type="button" className="icon-button" aria-label={text.down} title={text.down} disabled={index === rules.length - 1} onClick={() => void move({ id: rule.id, direction: 'down' })}>
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          </article>
        </div>
      )}
      {loaded && panel && (panel.mode === 'new' || editing) && (
        <div className="scrim rule-drawer-scrim" onClick={() => setPanel(null)}>
          <aside role="dialog" aria-modal="true" aria-labelledby="rule-drawer-title" className="rule-drawer" onClick={(event) => event.stopPropagation()}>
            <header className="rule-drawer-head">
              <div>
                <h2 id="rule-drawer-title" className="text-title">
                  {editing ? text.ruleNumber(editingIndex + 1) : text.newRule}
                </h2>
                <p className="text-caption muted">{text.drawerHint}</p>
              </div>
              <button type="button" className="icon-button" aria-label={text.close} title={text.close} onClick={() => setPanel(null)}>
                ×
              </button>
            </header>
            <RuleForm key={editing?.id ?? 'new'} {...choices} initial={editing} onDone={() => setPanel(null)} />
          </aside>
        </div>
      )}
    </section>
  );
}

/**
 * The rule as a sentence: "Sempre que <a descrição> contiver <texto> e ..., então <aplique as tags>
 * <tags> e ...". Each underlined word is a menu; the preview below follows what I type.
 */
function RuleForm({ layers, categories, initial, onDone }: { initial?: RuleView; onDone: () => void } & Choices) {
  const { backend } = useServices();
  const hasTags = layers.some((layer) => layer.tags.length > 0);
  const actionFields = (Object.keys(text.actionVerbs) as ActionField[]).filter((field) => field !== 'tags' || hasTags);
  const [match, setMatch] = useState<RuleMatch>(initial?.match ?? 'all');
  const [conditions, setConditions] = useState<RuleCondition[]>(() => (initial ? [...initial.conditions] : [newCondition('description')]));
  const [actions, setActions] = useState<RuleAction[]>(() => (initial ? [...initial.actions] : [newAction(actionFields[0], [])]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = usePreview(match, conditions, actions);

  const changeCondition = (index: number, c: RuleCondition) => setConditions(conditions.map((old, i) => (i === index ? c : old)));
  const changeAction = (index: number, a: RuleAction) => setActions(actions.map((old, i) => (i === index ? a : old)));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = conditionsProblem(conditions) ?? actionsProblem(actions);
    if (problem) return setError(problem);
    setBusy(true);
    const rule: RuleDefinition = { match, conditions: cleanConditions(conditions), actions: cleanActions(actions) };
    const result = initial ? await backend.command('rule.update', { id: initial.id, ...rule }) : await backend.command('rule.create', rule);
    setBusy(false);
    if (!result.ok) return setError(strings.genericError);
    onDone();
  }

  async function remove() {
    if (!initial || !window.confirm(text.confirmDelete)) return;
    setBusy(true);
    const result = await backend.command('rule.delete', { id: initial.id });
    setBusy(false);
    if (result.ok) onDone();
    else setError(strings.genericError);
  }

  const removeButton = (onClick: () => void, hidden: boolean) =>
    hidden ? null : (
      <button type="button" className="icon-button rule-remove" aria-label={text.removeRow} title={text.removeRow} onClick={onClick}>
        ×
      </button>
    );

  const categoryOptions = categories.map((option) => (
    <option key={option.id} value={option.id}>
      {optionLabel(option)}
    </option>
  ));

  return (
    <form className="rule-form" onSubmit={(event) => void onSubmit(event)}>
      <div className="rule-form-body">
        <section className="rule-block" aria-labelledby="rule-block-when">
          <BlockHead step={1} id="rule-block-when" {...text.blocks.when} />
          {conditions.length > 1 && (
            <div className="rule-match" role="group" aria-label={text.matchLabel}>
              <span className="text-caption muted">{text.matchLabel}</span>
              <span className="rule-segmented">
                {RULE_MATCHES.map((m) => (
                  <button key={m} type="button" className="rule-segment" aria-pressed={match === m} onClick={() => setMatch(m)}>
                    {text.matches[m]}
                  </button>
                ))}
              </span>
            </div>
          )}
          <ol className="rule-rows">
            {conditions.map((condition, index) => (
              <li key={index} className="rule-row">
                {index > 0 && <span className="rule-joiner">{match === 'any' ? text.or : text.and}</span>}
                <div className="rule-row-fields">
                  <select className="rule-control rule-control--subject" aria-label={text.conditionFieldLabel} value={conditionField(condition)} onChange={(e) => changeCondition(index, newCondition(e.target.value as ConditionField))}>
                    {(Object.keys(text.conditionSubjects) as ConditionField[]).map((field) => (
                      <option key={field} value={field}>
                        {text.conditionSubjects[field]}
                      </option>
                    ))}
                  </select>
                  <span className="rule-op">{isTextCondition(condition) ? text.contains : condition.kind === 'category' ? text.within : text.is}</span>
                  {isTextCondition(condition) ? (
                    <input
                      className="rule-control rule-control--grow"
                      value={condition.text}
                      placeholder={PLACEHOLDERS[condition.kind]}
                      aria-label={text.conditionSubjects[conditionField(condition)]}
                      onChange={(e) => changeCondition(index, { kind: condition.kind, text: e.target.value })}
                      autoComplete="off"
                      autoFocus={index === 0}
                    />
                  ) : condition.kind === 'category' ? (
                    <select className="rule-control rule-control--grow" aria-label={text.conditionSubjects.category} value={condition.categoryId} onChange={(e) => changeCondition(index, { kind: 'category', categoryId: e.target.value })}>
                      <option value="">{text.chooseCategory}</option>
                      {categoryOptions}
                    </select>
                  ) : (
                    <select className="rule-control rule-control--grow" aria-label={text.conditionSubjects.type} value={condition.type} onChange={(e) => changeCondition(index, { kind: 'type', type: LANCAMENTO_TYPES.find((t) => t === e.target.value) ?? 'out' })}>
                      {LANCAMENTO_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {text.typeSummary[t]}
                        </option>
                      ))}
                    </select>
                  )}
                  {removeButton(() => setConditions(conditions.filter((_, i) => i !== index)), conditions.length === 1)}
                </div>
              </li>
            ))}
          </ol>
          {conditions.length < MAX_RULE_PARTS && (
            <button type="button" className="rule-add" onClick={() => setConditions([...conditions, newCondition('description')])}>
              {text.addCondition[match]}
            </button>
          )}
          {conditions.some(isTextCondition) && <p className="rule-hint text-caption">{text.whenHint}</p>}
          {conditions.some((c) => c.kind === 'category') && <p className="rule-hint text-caption">{text.categoryHint}</p>}
        </section>

        <section className="rule-block" aria-labelledby="rule-block-then">
          <BlockHead step={2} id="rule-block-then" {...text.blocks.then} />
          <ol className="rule-rows">
            {actions.map((action, index) => (
              <li key={index} className="rule-row">
                {index > 0 && <span className="rule-joiner">{text.and}</span>}
                <div className="rule-row-fields">
                  <select className="rule-control rule-control--subject" aria-label={text.actionKindLabel} value={actionField(action)} onChange={(e) => changeAction(index, newAction(e.target.value as ActionField, conditions))}>
                    {actionFields.map((field) => (
                      <option key={field} value={field}>
                        {text.actionVerbs[field]}
                      </option>
                    ))}
                  </select>
                  {action.kind === 'addTags' ? (
                    <span className="rule-tags">
                      <TagPicker tags={action.tags} layers={layers} onChange={(tags) => changeAction(index, { kind: 'addTags', tags })} />
                    </span>
                  ) : action.kind === 'setCategory' ? (
                    <select className="rule-control rule-control--grow" aria-label={text.actionVerbs.category} value={action.categoryId} onChange={(e) => changeAction(index, { kind: 'setCategory', categoryId: e.target.value })}>
                      <option value="">{text.chooseCategory}</option>
                      {categoryOptions}
                    </select>
                  ) : (
                    <span className="rule-replace">
                      <input className="rule-control rule-control--grow" value={action.find} placeholder={text.findPlaceholder} aria-label={text.actionVerbs.description} onChange={(e) => changeAction(index, { ...action, find: e.target.value })} autoComplete="off" />
                      <span className="rule-op">{text.replaceBy}</span>
                      <input className="rule-control rule-control--grow" value={action.replace} placeholder={text.replacePlaceholder} aria-label={text.replacePlaceholder} onChange={(e) => changeAction(index, { ...action, replace: e.target.value })} autoComplete="off" />
                    </span>
                  )}
                  {removeButton(() => setActions(actions.filter((_, i) => i !== index)), actions.length === 1)}
                </div>
              </li>
            ))}
          </ol>
          {actions.length < MAX_RULE_PARTS && (
            <button type="button" className="rule-add" onClick={() => setActions([...actions, newAction(actionFields[0], conditions)])}>
              {text.addAction}
            </button>
          )}
          {actions.some((a) => a.kind === 'replaceInDescription') && <p className="rule-hint text-caption">{text.replaceHint}</p>}
        </section>

        <section className="rule-block" aria-labelledby="rule-block-preview">
          <BlockHead step={3} id="rule-block-preview" {...text.blocks.preview} />
          <Preview state={preview} />
        </section>
      </div>

      <footer className="rule-form-foot">
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="rule-form-buttons">
          <button type="submit" disabled={busy}>
            {initial ? text.save : text.create}
          </button>
          <button type="button" className="secondary" onClick={onDone}>
            {text.cancel}
          </button>
          {initial && (
            <button type="button" className="button-outline tags-danger rule-delete" disabled={busy} onClick={() => void remove()}>
              {text.delete}
            </button>
          )}
        </div>
      </footer>
    </form>
  );
}

/** A numbered block of the form: "1 Quando", with one line saying what it is for. */
function BlockHead({ step, id, title, hint }: { step: number; id: string; title: string; hint: string }) {
  return (
    <header className="rule-block-head">
      <span className="rule-step" aria-hidden="true">
        {step}
      </span>
      <div>
        <h3 id={id} className="text-strong">
          {title}
        </h3>
        <p className="text-caption muted">{hint}</p>
      </div>
    </header>
  );
}

/** The chosen tags as chips, and one menu that adds a tag (one per layer: a tag replaces its layer's). */
function TagPicker({ tags, layers, onChange }: { tags: TagAssignment; layers: readonly TagLayerView[]; onChange: (tags: TagAssignment) => void }) {
  return (
    <>
      {layers.flatMap((layer) => {
        const tag = layer.tags.find((t) => t.id === tags[layer.id]);
        if (!tag) return [];
        const label = `${layer.name}: ${tag.name}`;
        return [
          <span key={layer.id} className="rules-chip rules-chip--then">
            {label}
            <button
              type="button"
              className="rules-chip-remove"
              aria-label={text.removeTag(label)}
              title={text.removeTag(label)}
              onClick={() => {
                const { [layer.id]: _removed, ...rest } = tags;
                onChange(rest);
              }}
            >
              ×
            </button>
          </span>,
        ];
      })}
      <select
        className="rule-control rule-control--tag"
        aria-label={text.addTag}
        value=""
        onChange={(e) => {
          const layer = layers.find((l) => l.tags.some((t) => t.id === e.target.value));
          if (layer) onChange({ ...tags, [layer.id]: e.target.value });
        }}
      >
        <option value="">{text.addTag}</option>
        {layers
          .filter((layer) => layer.tags.length > 0)
          .map((layer) => (
            <optgroup key={layer.id} label={layer.name}>
              {layer.tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </optgroup>
          ))}
      </select>
    </>
  );
}

type PreviewState = { status: 'waiting' } | { status: 'loading' } | { status: 'failed' } | { status: 'ready'; preview: RulePreviewView };

/** The lançamentos the rule catches, looked up again a moment after each change. */
function usePreview(match: RuleMatch, conditions: readonly RuleCondition[], actions: readonly RuleAction[]): PreviewState {
  const { backend } = useServices();
  const [state, setState] = useState<PreviewState>({ status: 'waiting' });
  const key = JSON.stringify([match, conditions, actions]);

  useEffect(() => {
    if (conditionsProblem(conditions)) {
      setState({ status: 'waiting' });
      return;
    }
    let current = true;
    setState({ status: 'loading' });
    const timer = window.setTimeout(() => {
      void backend.query('rulePreview', { match, conditions: cleanConditions(conditions), ...(actionsProblem(actions) ? {} : { actions: cleanActions(actions) }) }).then((result) => {
        if (current) setState(result.ok ? { status: 'ready', preview: result.value } : { status: 'failed' });
      });
    }, PREVIEW_DELAY_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
    // The key stands for match, conditions and actions, which are new arrays on every render.
  }, [key, backend]);

  return state;
}

function Preview({ state }: { state: PreviewState }) {
  const today = saoPauloDate(new Date());
  return (
    <div className="rules-preview" aria-live="polite">
      {state.status === 'waiting' && <p className="text-caption muted">{text.preview.waiting}</p>}
      {state.status === 'loading' && <p className="text-caption muted">{text.preview.loading}</p>}
      {state.status === 'failed' && <p className="text-caption muted">{strings.genericError}</p>}
      {state.status === 'ready' && state.preview.total === 0 && <p className="text-caption muted">{text.preview.none}</p>}
      {state.status === 'ready' && state.preview.total > 0 && (
        <>
          <p className="text-caption muted">{text.preview.count(state.preview.total, state.preview.items.length)}</p>
          <ul className="list">
            {state.preview.items.map((item) => (
              <li key={item.id} className="rules-preview-row">
                <span className="text-over">{item.description ?? text.preview.noDescription}</span>
                <span className="muted">{dayLabel(item.day, today, strings.lancamentos)}</span>
                <span className="rules-preview-amount">{amount(item)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
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
    setMessage(result.ok ? text.apply.done(result.value.tagged, result.value.described, result.value.categorized) : text.apply.failed);
  }

  return (
    <>
      <button type="button" className="secondary" title={text.apply.hint} disabled={running} onClick={() => void apply()}>
        {running ? text.apply.running : text.apply.button}
      </button>
      {message && (
        <p role="status" className="rules-apply-message text-caption">
          {message}
        </p>
      )}
    </>
  );
}
