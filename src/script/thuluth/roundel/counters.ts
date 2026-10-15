// Counters (lab counters.js): the enclosed spaces inside letters (heh, waw, mim, qaf, fa, sad, tah loops), found on a
// raster of the ink, so they can be filled with colour as on the Topkapı tile bands (turquoise inside white letters).
import type { Thuluth } from '../engine';
import { Alpha, toPixels } from '../raster';
import type { Poly, Stroke } from '../types';

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const; // prettier-ignore

export interface CounterOptions {
  /** Pixels per pen unit of the raster, and how far each run is grown so neighbours overlap. */
  K?: number;
  grow?: number;
  /** Largest counter, in square pen units (bigger spaces are a great bowl's, not a letter's). */
  max?: number;
}
/** Counters of the strokes as row-run rectangles in pen units (y up), one list per counter. */
export function findCounters(th: Thuluth, strokes: readonly Stroke[], o: CounterOptions = {}): Poly[][] {
  const K = o.K ?? 4,
    grow = o.grow ?? 0.25,
    max = o.max ?? 9;
  let a0 = 1e9,
    a1 = -1e9,
    b0 = 1e9,
    b1 = -1e9;
  strokes.forEach(s =>
    s.s.forEach(q => {
      a0 = Math.min(a0, q.x);
      a1 = Math.max(a1, q.x);
      b0 = Math.min(b0, q.y);
      b1 = Math.max(b1, q.y);
    }),
  );
  if (a0 > a1) return [];
  const X0 = a0 - 1,
    Y0 = b1 + 1,
    Wp = Math.ceil((a1 - a0 + 2) * K),
    Hp = Math.ceil((b1 - b0 + 2) * K),
    A = new Alpha(Wp, Hp),
    X = (x: number) => (x - X0) * K,
    Y = (y: number) => (Y0 - y) * K;
  strokes.forEach(s => A.fill(toPixels(th.strokePolys(s), X, Y)));
  const ink = A.mask(90),
    N = Wp * Hp;
  // flood the outside; anything empty that the flood cannot reach is a counter
  const seen = new Uint8Array(N),
    st: number[] = [];
  for (let x = 0; x < Wp; x++) st.push(x, (Hp - 1) * Wp + x);
  for (let y = 0; y < Hp; y++) st.push(y * Wp, y * Wp + Wp - 1);
  while (st.length) {
    const i = st.pop()!;
    if (seen[i] || ink[i]) continue;
    seen[i] = 1;
    const x = i % Wp,
      y = (i - x) / Wp;
    if (x > 0) st.push(i - 1);
    if (x < Wp - 1) st.push(i + 1);
    if (y > 0) st.push(i - Wp);
    if (y < Hp - 1) st.push(i + Wp);
  }
  const reg = new Int32Array(N).fill(-1),
    out: Poly[][] = [];
  let nreg = 0;
  for (let i = 0; i < N; i++) {
    if (ink[i] || seen[i] || reg[i] >= 0) continue;
    const q = [i],
      cells: number[] = [];
    reg[i] = nreg;
    while (q.length) {
      const j = q.pop()!;
      cells.push(j);
      const x = j % Wp,
        y = (j - x) / Wp;
      for (const [a, b] of STEPS) {
        const xx = x + a,
          yy = y + b;
        if (xx < 0 || yy < 0 || xx >= Wp || yy >= Hp) continue;
        const k2 = yy * Wp + xx;
        if (!ink[k2] && !seen[k2] && reg[k2] < 0) {
          reg[k2] = nreg;
          q.push(k2);
        }
      }
    }
    nreg++;
    // specks are ignored, and so is the space a great bowl encloses
    if (cells.length < K * K * 0.6 || cells.length > K * K * max) continue;
    // each row's runs, as rectangles grown a little so they overlap
    const rows = new Map<number, number[]>();
    cells.forEach(j => {
      const x = j % Wp,
        y = (j - x) / Wp;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push(x);
    });
    const rects: Poly[] = [];
    rows.forEach((xs, y) => {
      xs.sort((a, b) => a - b);
      let s0 = xs[0],
        prev = xs[0];
      for (let t = 1; t <= xs.length; t++) {
        if (t < xs.length && xs[t] === prev + 1) {
          prev = xs[t];
          continue;
        }
        const ux0 = X0 + s0 / K - grow,
          ux1 = X0 + (prev + 1) / K + grow,
          uy0 = Y0 - y / K + grow * 0.3,
          uy1 = Y0 - (y + 1) / K - grow * 0.3;
        rects.push([[ux0, uy0], [ux1, uy0], [ux1, uy1], [ux0, uy1]]); // prettier-ignore
        if (t < xs.length) s0 = prev = xs[t];
      }
    });
    out.push(rects);
  }
  return out;
}
