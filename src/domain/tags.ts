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
