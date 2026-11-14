// The superellipse: the squarish oval of the cartouches.
import type { Pt } from './types';

/** A superellipse of width/height `aspect` (exponent e: 2 an ellipse, higher squarer), as outline points. */
export function superellipse(aspect: number, e: number, n = 360): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n,
      c = Math.cos(t),
      s = Math.sin(t);
    return [aspect * Math.sign(c) * Math.abs(c) ** (2 / e), Math.sign(s) * Math.abs(s) ** (2 / e)];
  });
}
