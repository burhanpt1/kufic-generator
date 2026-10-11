// Plaited stems (lab port §5), as on Fatimid bands: neighbouring tall stems cross in an X near the top and each
// carries on in the other's column. The crossing cell has four diagonal neighbours, so the renderer's over/under
// at diagonal crossings draws the plait. Applied after justification, before stem endings are marked.
import type { Strip } from '../types';

/** Plait pairs of free-standing tall stems an even 2–maxD cells apart with nothing between them near the top.
 *  base = baseline row, H = ascender height (needs 9 or more). Changes the strip in place. */
export function plaitStrip(st: Strip, Hb: number, base: number, H: number, maxD = 8): Strip {
  const { W, data: d } = st,
    at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= Hb ? 0 : d[y * W + x]),
    isL = (x: number, y: number) => {
      const v = at(x, y);
      return v === 1 || v === 4;
    };
  const top = base + H - 1;
  if (top >= Hb || H < 9) return st;
  // continuous ink from base + 3 to the top, nothing beside it
  const stems: number[] = [];
  for (let x = 0; x < W; x++) {
    let ok = true;
    for (let y = base + 3; y <= top && ok; y++) if (!isL(x, y) || isL(x - 1, y) || isL(x + 1, y)) ok = false;
    if (ok) stems.push(x);
  }
  for (let i = 0; i + 1 < stems.length; i++) {
    const a = stems[i],
      b = stems[i + 1],
      D = b - a;
    if (D < 2 || D > maxD || D % 2) continue;
    const y1 = top - D - 1;
    if (y1 < base + 3) continue;
    let clear = true;
    for (let x = a + 1; x < b && clear; x++)
      for (let y = y1; y <= top; y++)
        if (at(x, y)) {
          clear = false;
          break;
        }
    if (!clear) continue;
    for (let y = y1 + 1; y <= top; y++) d[y * W + a] = d[y * W + b] = 0; // cut the upper stems
    for (let k = 1; k <= D; k++) d[(y1 + k) * W + a + k] = d[(y1 + k) * W + b - k] = 1; // the crossing diagonals
    for (let y = y1 + D + 1; y <= top; y++) d[y * W + a] = d[y * W + b] = 1; // carry on up
    i++;
  }
  return st;
}
