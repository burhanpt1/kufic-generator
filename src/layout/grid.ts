// Square cell grids: placing strips as the sides of a square ring, rotation, and line layout.
import type { Grid, Strip } from '../types';

export const makeGrid = (w: number, h: number): Grid => ({
  w,
  h,
  data: new Uint8Array(w * h),
  tag: new Uint8Array(w * h),
  ring: new Uint8Array(w * h),
});

/** Pinwheel placement: side s (0..3) of a ring of side Lk at offset o; the strip is U wide. */
export function placeSide(
  grid: Grid,
  st: Strip,
  U: number,
  Hb: number,
  o: number,
  Lk: number,
  s: number,
  ring: number,
) {
  const L = grid.w;
  for (let y = 0; y < Hb; y++)
    for (let x = 0; x < U; x++) {
      const v = st.data[y * U + x];
      if (!v) continue;
      let a = Hb + 1 + x,
        b = Lk - 1 - y;
      for (let r = 0; r < s; r++) {
        const t = a;
        a = Lk - 1 - b;
        b = t;
      }
      const i = (o + b) * L + (o + a);
      grid.data[i] = v;
      grid.tag[i] = st.tag[y * U + x];
      grid.ring[i] = ring + 1;
    }
}
// Not used by compose(); kept from the prototype.
export function centreFill(grid: Grid, o: number, center: string) {
  const L = grid.w,
    C = L - 2 * o;
  if (C <= 0 || center === 'none') return;
  if (center === 'solid') {
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) grid.data[(o + y) * L + o + x] = 1;
    return;
  }
  for (let i = 0; 2 * i < C; i += 2) {
    const a = o + i,
      b = o + C - 1 - i;
    for (let t = a; t <= b; t++) {
      grid.data[a * L + t] = grid.data[b * L + t] = 1;
      grid.data[t * L + a] = grid.data[t * L + b] = 1;
    }
  }
}
export function rotate(g: Grid, deg: number): Grid {
  const L = g.w;
  for (let r = 0; r < deg / 90; r++) {
    const n = makeGrid(L, L);
    for (let y = 0; y < L; y++)
      for (let x = 0; x < L; x++) {
        const i = y * L + x,
          j = x * L + (L - 1 - y);
        n.data[j] = g.data[i];
        n.tag[j] = g.tag[i];
        n.ring[j] = g.ring[i];
      }
    g = n;
  }
  return g;
}
/** Strip (y up) -> grid (y down). */
export function stripToGrid(st: Strip, Hb: number): Grid {
  const g = makeGrid(st.W, Hb);
  for (let y = 0; y < Hb; y++)
    for (let x = 0; x < st.W; x++) {
      const v = st.data[y * st.W + x];
      if (v) {
        const i = (Hb - 1 - y) * st.W + x;
        g.data[i] = v;
        g.tag[i] = st.tag[y * st.W + x] || 1;
        g.ring[i] = 1;
      }
    }
  return g;
}
