// Generations (lab runGeneration / breedFrom). Nothing here composes: evaluating a candidate is evaluate.ts.
import type { Composition } from '../model/schema';
import { crossover, mutate, randomComposition } from './operators';
import type { OperatorOptions } from './operators';

export type { Evaluated } from './evaluate';

/** A fresh generation: optionally a given first composition, then random ones. */
export function freshGeneration(
  n: number,
  texts: Composition['texts'],
  o: OperatorOptions & { first?: Composition[] },
): Composition[] {
  const out = (o.first ?? []).slice(0, n);
  while (out.length < n) out.push(randomComposition(texts, o));
  return out;
}

/** Children of one or two parents: the parents themselves, then mutants (crossed first when there are two),
 *  a third of them gentle and the rest bolder. */
export function breedFrom(parents: Composition[], n: number, rate: number, o: OperatorOptions): Composition[] {
  const kids = parents.slice(0, n).map(p => structuredClone(p));
  while (kids.length < n) {
    const base = parents.length > 1 ? crossover(parents[0], parents[1], o) : parents[0];
    kids.push(mutate(base, kids.length < n / 3 ? rate * 0.6 : rate * 1.4, o));
  }
  return kids;
}

/** A rough relative cost of evaluating a composition, for scheduling the slow ones first (seal monograms and mazes
 *  search; pen strokes and many borders cost more to draw). */
export function costOf(c: Composition): number {
  const f = c.root.child.fill;
  let k = 1 + 0.4 * c.root.child.borders.length;
  if (f?.type === 'monogram') k += f.method === 'seal' || f.method === 'tughra' ? 6 : 1;
  if (f?.type === 'maze') k += 4;
  if (f?.type === 'lines') k += 1 + (f.vary ?? 0);
  if (f?.type === 'flow') k += 3;
  if (f?.type === 'strapwork' || f?.type === 'lattice') k += 3;
  if (f?.type === 'region') k += 2;
  if (c.style.stroke.kind === 'pen') k += 1;
  if (c.root.spandrels?.type === 'pattern') k += 0.5;
  return k;
}
