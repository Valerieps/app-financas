// Pluggy's category tree as the list I pick a lançamento's category from (docs/spec/classificacao.md).

export interface PluggyCategory {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
}

/** One choice in the list: `depth` 0 for the top of the tree. */
export interface CategoryOption {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
}

/**
 * The tree flattened in reading order: each category right after its parent, siblings by id (Pluggy's
 * ids follow the tree). A category whose parent is unknown sits at the top.
 */
export function categoryOptions(categories: readonly PluggyCategory[]): CategoryOption[] {
  const ids = new Set(categories.map((c) => c.id));
  const children = new Map<string | null, PluggyCategory[]>();
  for (const category of categories) {
    const parent = category.parentId !== null && category.parentId !== category.id && ids.has(category.parentId) ? category.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), category]);
  }
  const options: CategoryOption[] = [];
  const seen = new Set<string>();
  const visit = (parent: string | null, depth: number) => {
    for (const category of [...(children.get(parent) ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
      if (seen.has(category.id)) continue;
      seen.add(category.id);
      options.push({ id: category.id, name: category.name, depth });
      visit(category.id, depth + 1);
    }
  };
  visit(null, 0);
  return options;
}
