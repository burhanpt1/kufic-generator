// Cell grids for monograms and mazes (y down; values 1 letter, 3 dot, 4 stem ending), and the lab's grid tools.
export interface CellGrid {
  w: number;
  h: number;
  data: Uint8Array;
}
export const G = (w: number, h: number): CellGrid => ({ w, h, data: new Uint8Array(w * h) });
export const gAt = (g: CellGrid, x: number, y: number) =>
  x < 0 || y < 0 || x >= g.w || y >= g.h ? 0 : g.data[y * g.w + x];
export const isL = (g: CellGrid, x: number, y: number) => {
  const v = gAt(g, x, y);
  return v === 1 || v === 4;
};
/** Union: a letter stroke wins over a dot. */
export function gPut(dst: CellGrid, src: CellGrid, ox: number, oy: number) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const v = src.data[y * src.w + x];
      if (!v) continue;
      const X = x + ox,
        Y = y + oy;
      if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
      const i = Y * dst.w + X;
      if (!dst.data[i] || v === 1) dst.data[i] = v;
    }
}
const gMap = (g: CellGrid, w: number, h: number, f: (x: number, y: number) => [number, number]) => {
  const n = G(w, h);
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const v = g.data[y * g.w + x];
      if (v) {
        const [X, Y] = f(x, y);
        n.data[Y * w + X] = v;
      }
    }
  return n;
};
export const flipX = (g: CellGrid) => gMap(g, g.w, g.h, (x, y) => [g.w - 1 - x, y]);
export const flipY = (g: CellGrid) => gMap(g, g.w, g.h, (x, y) => [x, g.h - 1 - y]);
export const rot90 = (g: CellGrid) => gMap(g, g.h, g.w, (x, y) => [g.h - 1 - y, x]);
export const rot180 = (g: CellGrid) => flipX(flipY(g));
/** Crop to the ink with `pad` empty cells around; also returns where the old origin went. */
export function trimAt(g: CellGrid, pad = 0): { g: CellGrid; dx: number; dy: number } {
  let x0 = g.w,
    y0 = g.h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++)
      if (g.data[y * g.w + x]) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return { g: G(1, 1), dx: 0, dy: 0 };
  const n = G(x1 - x0 + 1 + 2 * pad, y1 - y0 + 1 + 2 * pad);
  gPut(n, g, pad - x0, pad - y0);
  return { g: n, dx: pad - x0, dy: pad - y0 };
}
export const trim = (g: CellGrid, pad = 0) => trimAt(g, pad).g;
export const square = (g: CellGrid) => {
  const s = Math.max(g.w, g.h),
    n = G(s, s);
  gPut(n, g, Math.floor((s - g.w) / 2), Math.floor((s - g.h) / 2));
  return n;
};
/** Stem endings: a stroke cell with exactly one inked neighbour and a straight run of 3+ behind it. */
export function markEnds(g: CellGrid): CellGrid {
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      if (!isL(g, x, y)) continue;
      const nb = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ].filter(([dx, dy]) => isL(g, x + dx, y + dy));
      if (nb.length !== 1) continue;
      const [dx, dy] = nb[0];
      let run = 1;
      while (
        isL(g, x + dx * run, y + dy * run) &&
        !isL(g, x + dx * run - dy, y + dy * run - dx) &&
        !isL(g, x + dx * run + dy, y + dy * run + dx)
      )
        run++;
      if (run >= 3) g.data[y * g.w + x] = 4;
    }
  return g;
}
/** Sprinkle diamond dots in open pockets, a common seal texture. */
export function dotFill(g: CellGrid): CellGrid {
  const n = G(g.w, g.h);
  n.data.set(g.data);
  for (let y = 1; y < g.h - 1; y++)
    for (let x = 1; x < g.w - 1; x++) {
      if ((x + y) % 2 || g.data[y * g.w + x]) continue;
      let ok = true;
      for (let dy = -2; dy <= 2 && ok; dy++)
        for (let dx = -2; dx <= 2; dx++)
          if (gAt(g, x + dx, y + dy)) {
            ok = false;
            break;
          }
      if (!ok) continue;
      let enclosed = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        for (let k = 3; k < Math.max(g.w, g.h); k++)
          if (isL(g, x + dx * k, y + dy * k)) {
            enclosed++;
            break;
          }
      if (enclosed === 4) n.data[y * g.w + x] = 3;
    }
  return n;
}
export function frameIt(g: CellGrid, frame: string): CellGrid {
  if (frame === 'none') return g;
  const s = Math.max(g.w, g.h) + (frame === 'double' ? 6 : 4),
    out = G(s, s);
  gPut(out, g, Math.floor((s - g.w) / 2), Math.floor((s - g.h) / 2));
  const ring = (o: number) => {
    for (let t = o; t < s - o; t++) {
      out.data[o * s + t] = out.data[(s - 1 - o) * s + t] = 1;
      out.data[t * s + o] = out.data[t * s + (s - 1 - o)] = 1;
    }
  };
  ring(0);
  if (frame === 'double') ring(2);
  return out;
}
