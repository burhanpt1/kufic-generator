// The one routine for redrawing part of a stroke (a great bowl, a drawn-out tail): the ink from a given sample on is
// replaced by a new skeleton, sampled as one curve, and the new samples are owned by the letter that draws them, so
// every later check still knows which letter each piece of ink belongs to.
import { sampleStroke } from './pen';
import type { SkelPt, Stroke } from './types';

/** Replace the samples of `st` from index `from` on (0: the whole stroke) by `skel`, sampled with `tension`, owned by
 *  letter `owner`. The kept samples keep their owners. */
export function redraw(st: Stroke, from: number, skel: readonly SkelPt[], owner: number, tension: number): void {
  const drawn = sampleStroke(skel, tension);
  st.s = st.s.slice(0, from).concat(drawn);
  if (st.own) st.own = st.own.slice(0, from).concat(drawn.map(() => owner));
}
