// Compositions as shareable links (COMPOSITION_ENGINE.md §8): the whole tree, deflated into the URL fragment (#c=...).
// Decoded trees are untrusted and validated against the schema.
import type { Composition } from '../model/schema';
import { CompositionSchema } from '../model/schema';
import { decodeJSON, encodeJSON } from '../app/codec';

const PREFIX = '#c=';
export const encodeComposition = (c: Composition) => encodeJSON(c);
/** null if the code isn't a valid composition. */
export async function decodeComposition(code: string): Promise<Composition | null> {
  const r = CompositionSchema.safeParse(await decodeJSON(code));
  return r.success ? (r.data as Composition) : null;
}
export const compositionFromHash = (hash: string) =>
  hash.startsWith(PREFIX) ? decodeComposition(hash.slice(PREFIX.length)) : Promise.resolve(null);
export const hashFor = async (c: Composition) => PREFIX + (await encodeComposition(c));
