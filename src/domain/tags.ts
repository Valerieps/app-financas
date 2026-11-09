// Categories as tags in layers (docs/spec/categorias.md): each layer has its own meaning
// ("Impulso ou planejado", "Tipo"), and a lançamento gets at most one tag from each layer.

/** At most this many layers. */
export const MAX_LAYERS = 5;
/** A layer's or a tag's name has at most this many characters. */
export const MAX_NAME_LENGTH = 40;

export type NameProblem = 'empty' | 'too_long' | 'duplicate';

/** Trims the name and collapses inner spaces. */
export function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Names compare without case or accents: "Mercado" and "mercádo" are the same. */
export function nameKey(name: string): string {
  return cleanName(name)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

/**
 * What is wrong with a new name among its siblings (the other layers, or the other tags of the
 * same layer); null when it is fine. `siblings` must not include the item being renamed.
 */
export function nameProblem(raw: string, siblings: readonly string[]): NameProblem | null {
  const name = cleanName(raw);
  if (!name) return 'empty';
  if ([...name].length > MAX_NAME_LENGTH) return 'too_long';
  const key = nameKey(name);
  return siblings.some((s) => nameKey(s) === key) ? 'duplicate' : null;
}

export function canAddLayer(layerCount: number): boolean {
  return layerCount < MAX_LAYERS;
}

/** The layer order after moving `id` one place up or down; unchanged at the ends or if absent. */
export function moveInOrder(ids: readonly string[], id: string, direction: 'up' | 'down'): string[] {
  const order = [...ids];
  const from = order.indexOf(id);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= order.length) return order;
  [order[from], order[to]] = [order[to] as string, order[from] as string];
  return order;
}

/** `ids` with `id` taken out and put at position `to` (dragged there); unchanged when either is out of range. */
export function moveToIndex(ids: readonly string[], id: string, to: number): string[] {
  const order = [...ids];
  const from = order.indexOf(id);
  if (from < 0 || !Number.isInteger(to) || to < 0 || to >= order.length) return order;
  order.splice(from, 1);
  order.splice(to, 0, id);
  return order;
}

/** A lançamento's tags: for each layer that has one, the tag id. */
export type TagAssignment = Readonly<Record<string, string>>;

/** Gives the lançamento `tag`, replacing the tag it had in the same layer. */
export function assignTag(assignment: TagAssignment, tag: { readonly id: string; readonly layerId: string }): TagAssignment {
  return { ...assignment, [tag.layerId]: tag.id };
}

/** Takes away the lançamento's tag in `layerId`, if any. */
export function clearLayer(assignment: TagAssignment, layerId: string): TagAssignment {
  const { [layerId]: _removed, ...rest } = assignment;
  return rest;
}

/** A change to many lançamentos at once: the layer gets `tagId`, or loses its tag when null. */
export interface TagChange {
  readonly layerId: string;
  readonly tagId: string | null;
}

/** At most this many lançamentos change in one save. */
export const MAX_BULK_TAGGING = 500;

/**
 * The tags every one of `assignments` shares, layer by layer: what the "Adicionar tags" form
 * starts with. A layer where they differ, or where one has no tag, is absent.
 */
export function commonTags(assignments: readonly TagAssignment[]): TagAssignment {
  const [first, ...rest] = assignments;
  if (!first) return {};
  const common: Record<string, string> = {};
  for (const [layerId, tagId] of Object.entries(first)) {
    if (rest.every((a) => a[layerId] === tagId)) common[layerId] = tagId;
  }
  return common;
}

/** The form's choice after a tap on a tag: marks it (replacing its layer's), or unmarks it. */
export function toggleTag(chosen: TagAssignment, tag: { readonly id: string; readonly layerId: string }): TagAssignment {
  return chosen[tag.layerId] === tag.id ? clearLayer(chosen, tag.layerId) : assignTag(chosen, tag);
}

/**
 * What saving the form changes: each layer whose choice differs from what the lançamentos shared
 * at the start. A layer I did not touch keeps each lançamento's own tag.
 */
export function tagChanges(initial: TagAssignment, chosen: TagAssignment): TagChange[] {
  const layers = new Set([...Object.keys(initial), ...Object.keys(chosen)]);
  return [...layers]
    .filter((layerId) => initial[layerId] !== chosen[layerId])
    .map((layerId) => ({ layerId, tagId: chosen[layerId] ?? null }));
}

const EMPTY_PREFIX = 'vazio:';

/** The filter choice "Vazio" of a layer (`?tag=vazio:<layerId>`): lançamentos with no tag in it. */
export function emptyTagKey(layerId: string): string {
  return EMPTY_PREFIX + layerId;
}

/**
 * The tag filter (`?tag=a&tag=b`): with tags chosen in several layers, the lançamento needs one of
 * the chosen tags in each of those layers; a layer's "Vazio" counts as one more choice in it, met
 * when the lançamento has no tag there. None chosen keeps every lançamento.
 */
export function matchesTags(chosen: readonly string[], layerOf: ReadonlyMap<string, string>, assignment: TagAssignment): boolean {
  const byLayer = new Map<string, (string | null)[]>();
  for (const key of chosen) {
    const empty = key.startsWith(EMPTY_PREFIX);
    const layerId = empty ? key.slice(EMPTY_PREFIX.length) : layerOf.get(key);
    if (layerId) byLayer.set(layerId, [...(byLayer.get(layerId) ?? []), empty ? null : key]);
  }
  return [...byLayer].every(([layerId, tags]) => tags.includes(assignment[layerId] ?? null));
}
