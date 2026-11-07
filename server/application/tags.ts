// Category layers and their tags (docs/spec/categorias.md): reading them and editing them.
// Deleting a tag takes it off every lançamento; putting tags on them is in lancamentos.ts.
import type { TagLayerView } from '../../src/application/api-contract';
import { canAddLayer, cleanName, moveInOrder, nameKey, nameProblem } from '../../src/domain/tags';
import { failure, nowIso, type CommandResult, type Context } from './context';
import { statement, type Statement } from './ports';

interface LayerRow {
  id: string;
  name: string;
  position: number;
}

interface TagRow {
  id: string;
  layer_id: string;
  name: string;
}

const CHANGED = ['tags'] as const;

const layers = (ctx: Context) => ctx.sql.all<LayerRow>('SELECT id, name, position FROM tag_layers ORDER BY position, created_at');

export async function tagLayers(ctx: Context): Promise<TagLayerView[]> {
  const [layerRows, tagRows] = await Promise.all([layers(ctx), ctx.sql.all<TagRow>('SELECT id, layer_id, name FROM tags')]);
  const byName = (a: { name: string }, b: { name: string }) => nameKey(a.name).localeCompare(nameKey(b.name), 'pt-BR');
  return layerRows.map((layer) => ({
    id: layer.id,
    name: layer.name,
    tags: tagRows
      .filter((tag) => tag.layer_id === layer.id)
      .sort(byName)
      .map((tag) => ({ id: tag.id, name: tag.name })),
  }));
}

/** `invalid` for an empty or long name, `conflict` for a name its siblings already use. */
function checkName(name: unknown, siblings: readonly string[]) {
  if (typeof name !== 'string') return failure('invalid');
  const problem = nameProblem(name, siblings);
  if (problem === 'duplicate') return failure('conflict');
  return problem ? failure('invalid') : null;
}

const done = <T>(value: T): CommandResult<T> => ({ ok: true, value, changed: CHANGED });

export async function createLayer(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<{ id: string }>> {
  const existing = await layers(ctx);
  const bad = checkName(input.name, existing.map((l) => l.name));
  if (bad) return bad;
  if (!canAddLayer(existing.length)) return failure('conflict');
  const id = ctx.ids.next();
  const position = existing.reduce((max, l) => Math.max(max, l.position + 1), 0);
  await ctx.sql.batch([
    statement('INSERT INTO tag_layers (id, name, position, created_at) VALUES (?, ?, ?, ?)', id, cleanName(input.name as string), position, nowIso(ctx)),
  ]);
  return done({ id });
}

export async function renameLayer(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const existing = await layers(ctx);
  if (!existing.some((l) => l.id === input.id)) return failure(typeof input.id === 'string' ? 'not_found' : 'invalid');
  const bad = checkName(input.name, existing.filter((l) => l.id !== input.id).map((l) => l.name));
  if (bad) return bad;
  await ctx.sql.batch([statement('UPDATE tag_layers SET name = ? WHERE id = ?', cleanName(input.name as string), input.id as string)]);
  return done(null);
}

/** The statements that save `order` as the layers' positions. */
const savePositions = (order: readonly string[]): Statement[] =>
  order.map((id, position) => statement('UPDATE tag_layers SET position = ? WHERE id = ?', position, id));

export async function deleteLayer(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const existing = await layers(ctx);
  const id = input.id;
  if (typeof id !== 'string') return failure('invalid');
  if (!existing.some((l) => l.id === id)) return failure('not_found');
  await ctx.sql.batch([
    statement('DELETE FROM transaction_tags WHERE layer_id = ?', id),
    statement('DELETE FROM tags WHERE layer_id = ?', id),
    statement('DELETE FROM tag_layers WHERE id = ?', id),
    ...savePositions(existing.filter((l) => l.id !== id).map((l) => l.id)),
  ]);
  return done(null);
}

export async function moveLayer(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const { id, direction } = input;
  if (typeof id !== 'string' || (direction !== 'up' && direction !== 'down')) return failure('invalid');
  const existing = await layers(ctx);
  if (!existing.some((l) => l.id === id)) return failure('not_found');
  await ctx.sql.batch(savePositions(moveInOrder(existing.map((l) => l.id), id, direction)));
  return done(null);
}

const tagsOf = (ctx: Context, layerId: string) => ctx.sql.all<TagRow>('SELECT id, layer_id, name FROM tags WHERE layer_id = ?', layerId);

export async function createTag(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<{ id: string }>> {
  const { layerId } = input;
  if (typeof layerId !== 'string') return failure('invalid');
  if ((await ctx.sql.all('SELECT 1 FROM tag_layers WHERE id = ?', layerId)).length === 0) return failure('not_found');
  const bad = checkName(input.name, (await tagsOf(ctx, layerId)).map((t) => t.name));
  if (bad) return bad;
  const id = ctx.ids.next();
  await ctx.sql.batch([
    statement('INSERT INTO tags (id, layer_id, name, created_at) VALUES (?, ?, ?, ?)', id, layerId, cleanName(input.name as string), nowIso(ctx)),
  ]);
  return done({ id });
}

async function findTag(ctx: Context, id: unknown): Promise<TagRow | 'invalid' | 'not_found'> {
  if (typeof id !== 'string') return 'invalid';
  const [tag] = await ctx.sql.all<TagRow>('SELECT id, layer_id, name FROM tags WHERE id = ?', id);
  return tag ?? 'not_found';
}

export async function renameTag(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const tag = await findTag(ctx, input.id);
  if (typeof tag === 'string') return failure(tag);
  const bad = checkName(input.name, (await tagsOf(ctx, tag.layer_id)).filter((t) => t.id !== tag.id).map((t) => t.name));
  if (bad) return bad;
  await ctx.sql.batch([statement('UPDATE tags SET name = ? WHERE id = ?', cleanName(input.name as string), tag.id)]);
  return done(null);
}

export async function deleteTag(ctx: Context, input: Record<string, unknown>): Promise<CommandResult<null>> {
  const tag = await findTag(ctx, input.id);
  if (typeof tag === 'string') return failure(tag);
  await ctx.sql.batch([statement('DELETE FROM transaction_tags WHERE tag_id = ?', tag.id), statement('DELETE FROM tags WHERE id = ?', tag.id)]);
  return done(null);
}
