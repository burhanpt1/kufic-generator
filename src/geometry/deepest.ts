// The point furthest inside a region (pole of inaccessibility), for placing centrepieces. polylabel works on
// polygons with y in any direction.
import polylabel from 'polylabel';
import type { Pt } from './types';

export function deepestPoint(P: Pt[], precision?: number): { p: Pt; r: number } {
  let x0 = Infinity,
    x1 = -Infinity;
  for (const [x] of P) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  const res = polylabel([P], precision ?? Math.max(1e-6, (x1 - x0) * 1e-3)) as number[] & { distance: number };
  return { p: [res[0], res[1]], r: res.distance };
}
