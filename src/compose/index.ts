// The composition engine: resolve a composition tree into placed, renderer-agnostic parts. Pure: no DOM.
import './fills';
import './flow';
import './strapwork';
import './lattice';
import './roundel';
import type { Composition } from '../model/schema';
import type { RoundelWorkers } from '../script/thuluth/roundel/parallel';
import { resolve } from './resolve';
import type { ResolveOptions } from './resolve';
import { collectRoundels, prepareRoundel } from './roundel';
export { resolve } from './resolve';
export type { ResolveOptions } from './resolve';
export * from './placed';
export { placeMap } from './textBorder';

/** resolve, with the composition's roundels drawn first on workers (each roundel's tries and its best arrangements
 *  side by side, and the roundels with each other): the same result, sooner. */
export async function resolveAsync(c: Composition, workers: RoundelWorkers, o?: ResolveOptions) {
  const asked = collectRoundels(() => resolve(c, o));
  await Promise.all(asked.map(q => prepareRoundel(q, workers)));
  return resolve(c, o);
}
