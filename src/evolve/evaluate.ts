// Evaluation of one candidate: the only part of evolution that needs the composing engine. Kept apart from the
// operators and the generations (breed.ts), which a page runs in its own thread while its workers evaluate.
import { resolve } from '../compose';
import type { Placed } from '../compose/placed';
import type { Composition } from '../model/schema';
import { renderPlaced } from '../render/composition';
import { metrics } from './critic';
import type { Metrics } from './critic';

export interface Evaluated {
  svg: string;
  metrics: Metrics | null;
  meta: Placed['meta'];
  ms: number;
}
/** Resolve, render and judge one composition. */
export function evaluate(comp: Composition, idPrefix?: string): Evaluated {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const placed = resolve(comp);
  const svg = renderPlaced(placed, { idPrefix });
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { svg, metrics: metrics(placed), meta: placed.meta, ms: t1 - t0 };
}
