// Two names in a thuluth cartouche (src/model/names, where the tree is built), in colours from one primary and one
// accent (namePalette): both names in the primary, their eyes and the conjunction in the accent.
import { namesCartouche } from '../model/names';
import type { NamesOptions } from '../model/names';
import type { Composition } from '../model/schema';
import { namePalette } from '../ornament/palette';

export { NAMES_RECIPE } from '../model/names';
export type { NamesOptions } from '../model/names';

/** The cartouche for a text of two names joined by و (vocalised as it should be written), in the given colours. */
export function namesComposition(text: string, primary: string, accent: string, o: NamesOptions = {}): Composition {
  return namesCartouche(text, namePalette(primary, accent), o);
}
