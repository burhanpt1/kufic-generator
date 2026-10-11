import type { Strip } from '../types';

// Mark stem tops (value 4) so the renderer can floriate them.
// minTop: tall stems at or above this row; tails: also upturned word-final tails (left end of a baseline stroke)
export function markTerminals(st: Strip, Hb: number, minTop: number, tails: boolean, base: number): Strip {
  const { W, data } = st,
    at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= Hb ? 0 : data[y * W + x]);
  const lo = tails ? base + 1 : minTop;
  for (let y = lo; y < Hb; y++)
    for (let x = 0; x < W; x++) {
      if (at(x, y) !== 1 || at(x, y + 1) || at(x - 1, y) || at(x + 1, y) || at(x, y - 1) !== 1) continue;
      let run = 1;
      while (at(x, y - run) === 1 && !at(x - 1, y - run) && !at(x + 1, y - run)) run++;
      if (run < 2) continue;
      const foot = y - run + 1; // bottom of the stem
      const upturn = foot - 1 === base && !at(x - 1, base) && at(x + 1, base) === 1;
      if (y >= minTop || (tails && upturn)) data[y * W + x] = 4;
    }
  return st;
}
