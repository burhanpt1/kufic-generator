// Letters of one ring or grid, drawn in "cell space": mapPt(x, y) -> screen, where x, y are continuous cell
// coordinates (y down for square grids; for circle strips the map does the bending).
import type { CircleRing, Grid } from '../types';
import { diag, prims, termCmds } from './prims';
import type { RenderOptions, Shapes } from './svg';
import { U, diamondR, f2, keyColour, markW, pathFrom } from './svg';

type MapPt = (x: number, y: number) => number[];
/** Filled region x0..x1 × y0..y1 in cell space (a rect, or an annular sector on a circle). */
type SectorFn = (x0: number, x1: number, y0: number, y1: number, inner?: boolean) => string;

export interface Source {
  w: number;
  h: number;
  at: (x: number, y: number) => number;
  key: (x: number, y: number) => number;
  maxKey: number;
  /** Direction a stem at (x, y) points, in cell space. */
  up: (x: number, y: number) => number[];
  right?: (x: number, y: number) => number[];
}

// Returns { ink: Map(colour -> [svg]), vow: [svg] }. Paper-coloured halos for over-under crossings go in ink.
export function letterShapes(
  src: Source,
  opt: RenderOptions,
  mapPt: MapPt,
  sectorOf: SectorFn,
  solid: string | null,
): Shapes {
  const w = opt.weight,
    ts = opt.terminal,
    ink = new Map<string, string[]>(),
    vow: string[] = [];
  const push = (c: string, s: string) => {
    if (!ink.has(c)) ink.set(c, []);
    ink.get(c)!.push(s);
  };
  const keys = new Set<number>();
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.at(x, y)) keys.add(src.key(x, y));
  const paper = opt.paper;
  const draw = (pred: (x: number, y: number) => boolean, ww: number, col: string, inner: boolean) => {
    const P = prims(pred, src.w, src.h),
      e = ww / 2;
    P.H.forEach(([x0, x1, y]) => push(col, sectorOf(x0 + 0.5 - e, x1 + 0.5 + e, y + 0.5 - e, y + 0.5 + e, inner)));
    P.V.forEach(([x, y0, y1]) => push(col, sectorOf(x + 0.5 - e, x + 0.5 + e, y0 + 0.5 - e, y1 + 0.5 + e, inner)));
    P.D.forEach(([x, y]) => push(col, sectorOf(x + 0.5 - e, x + 0.5 + e, y + 0.5 - e, y + 0.5 + e, inner)));
    // diagonals: draw one direction, then the other over a paper halo so crossings read as over and under
    const back = P.X.filter(([x1, y1, x2, y2]) => (x2 - x1) * (y2 - y1) > 0),
      fwd = P.X.filter(([x1, y1, x2, y2]) => (x2 - x1) * (y2 - y1) < 0);
    back.forEach(([x1, y1, x2, y2]) => push(col, diag(x1 + 0.5, y1 + 0.5, x2 + 0.5, y2 + 0.5, ww, mapPt)));
    fwd.forEach(([x1, y1, x2, y2]) => {
      if (!inner) {
        const ax = x1 + 0.5 + (x2 - x1) * 0.3,
          ay = y1 + 0.5 + (y2 - y1) * 0.3,
          bx = x2 + 0.5 - (x2 - x1) * 0.3,
          by = y2 + 0.5 - (y2 - y1) * 0.3;
        push(col, diag(ax, ay, bx, by, ww * 1.9, mapPt).replace('<path ', `<path fill="${paper}" `));
      }
      push(col, diag(x1 + 0.5, y1 + 0.5, x2 + 0.5, y2 + 0.5, ww, mapPt));
    });
  };
  const banded = opt.letterStyle === 'banded';
  for (const key of keys) {
    const col = solid || keyColour(opt, key, src.maxKey),
      kk = (x: number, y: number) => src.key(x, y) === key;
    const letter = (x: number, y: number) => {
      const v = src.at(x, y);
      return kk(x, y) && (v === 1 || (v === 4 && ts === 'none'));
    };
    draw(letter, w, col, false);
    const terms: number[][] = [];
    if (ts !== 'none')
      for (let y = 0; y < src.h; y++)
        for (let x = 0; x < src.w; x++) if (src.at(x, y) === 4 && kk(x, y)) terms.push([x, y]);
    const termAt = (x: number, y: number, ww: number, c: string) => {
      const [ux, uy] = src.up(x, y);
      if (ux === 0 && uy === 0) return;
      const [rx, ry] = src.right ? src.right(x, y) : [-uy, ux];
      push(
        c,
        pathFrom(termCmds(ts, ww), (u, v) => mapPt(x + 0.5 + u * rx + v * ux, y + 0.5 + u * ry + v * uy)),
      );
    };
    terms.forEach(([x, y]) => termAt(x, y, w, col));
    if (banded) {
      const iw = w * 0.4;
      draw(letter, iw, paper, true);
      terms.forEach(([x, y]) => termAt(x, y, iw, paper));
    }
    const P3 = prims((x, y) => src.at(x, y) === 3 && kk(x, y), src.w, src.h),
      mw = markW(w) / 2,
      d = diamondR(w);
    P3.H.forEach(([x0, x1, y]) => push(col, sectorOf(x0 + 0.5 - mw, x1 + 0.5 + mw, y + 0.5 - mw, y + 0.5 + mw)));
    P3.V.forEach(([x, y0, y1]) => push(col, sectorOf(x + 0.5 - mw, x + 0.5 + mw, y0 + 0.5 - mw, y1 + 0.5 + mw)));
    P3.D.forEach(([x, y]) =>
      push(
        col,
        pathFrom([['M', 0, -d], ['L', d, 0], ['L', 0, d], ['L', -d, 0], ['Z']], (u, v) =>
          mapPt(x + 0.5 + u, y + 0.5 + v),
        ),
      ),
    );
  }
  const P2 = prims((x, y) => src.at(x, y) === 2, src.w, src.h),
    mw = markW(w) / 2,
    d = diamondR(w);
  P2.H.forEach(([x0, x1, y]) => vow.push(sectorOf(x0 + 0.5 - mw, x1 + 0.5 + mw, y + 0.5 - mw, y + 0.5 + mw)));
  P2.V.forEach(([x, y0, y1]) => vow.push(sectorOf(x + 0.5 - mw, x + 0.5 + mw, y0 + 0.5 - mw, y1 + 0.5 + mw)));
  P2.D.forEach(([x, y]) =>
    vow.push(
      pathFrom([['M', 0, -d], ['L', d, 0], ['L', 0, d], ['L', -d, 0], ['Z']], (u, v) =>
        mapPt(x + 0.5 + u, y + 0.5 + v),
      ),
    ),
  );
  return { ink, vow };
}

// square grid source (cells, y down)
export function gridSource(g: Grid, keyArr: ArrayLike<number> | null): Source {
  let maxKey = 1;
  if (keyArr) {
    maxKey = 0;
    for (const v of Array.from(keyArr)) if (v > maxKey) maxKey = v;
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? 0 : g.data[y * g.w + x]);
  return {
    w: g.w,
    h: g.h,
    at,
    maxKey,
    key: (x, y) => (keyArr ? keyArr[y * g.w + x] : 1),
    up: (x, y) => {
      const nb = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ].find(([dx, dy]) => {
        const v = at(x + dx, y + dy);
        return v === 1 || v === 4;
      });
      return nb ? [-nb[0], -nb[1]] : [0, 0];
    },
  };
}
export function gridSVG(
  g: Grid,
  opt: RenderOptions,
  ox: number,
  oy: number,
  s: number,
  keyArr: ArrayLike<number> | null,
  solid: string | null,
  maxKeyOverride?: number,
): Shapes {
  const src = gridSource(g, keyArr);
  if (maxKeyOverride) src.maxKey = maxKeyOverride;
  const map = (x: number, y: number) => [ox + x * s * U, oy + y * s * U];
  const rx = f2(((opt.soft * opt.weight) / 2) * s * U);
  const sector: SectorFn = (x0, x1, y0, y1, inner) =>
    `<rect x="${f2(ox + x0 * s * U)}" y="${f2(oy + y0 * s * U)}" width="${f2((x1 - x0) * s * U)}" height="${f2((y1 - y0) * s * U)}"${opt.soft && !inner ? ` rx="${rx}"` : ''}/>`;
  return letterShapes(src, opt, map, sector, solid);
}
// circle strip source; strip rows y=0 at the outer edge
export function ringSVG(
  ring: CircleRing,
  opt: RenderOptions,
  C: number,
  rot: number,
  keyMode: string,
  maxKey: number,
  solid: string | null,
): Shapes {
  const { data, tag, W, N, Hb, Rout } = ring,
    sc = ring.scale || 1;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= Hb ? 0 : data[y * W + x]);
  const phi = (xc: number) => rot + Math.PI / 2 + (2 * Math.PI * (N - xc)) / N;
  const map = (xs: number, ys: number) => {
    const a = phi(xs),
      r = (Rout - ys) * sc;
    return [C + r * U * Math.cos(a), C + r * U * Math.sin(a)];
  };
  const P = (r: number, a: number) => `${f2(C + r * sc * U * Math.cos(a))} ${f2(C + r * sc * U * Math.sin(a))}`;
  const sector: SectorFn = (x0, x1, y0, y1) => {
    const a0 = phi(x1),
      a1 = phi(x0),
      r1 = Rout - y0,
      r0 = Rout - y1,
      big = a1 - a0 > Math.PI ? 1 : 0;
    return `<path d="M${P(r1, a0)}A${f2(r1 * sc * U)} ${f2(r1 * sc * U)} 0 ${big} 1 ${P(r1, a1)}L${P(r0, a1)}A${f2(r0 * sc * U)} ${f2(r0 * sc * U)} 0 ${big} 0 ${P(r0, a0)}Z"/>`;
  };
  const src: Source = {
    w: W,
    h: Hb,
    at,
    maxKey,
    key: (x, y) => (keyMode === 'ring' ? ring.ring : keyMode === 'repeat' ? tag[y * W + x] : 1),
    up: () => [0, 1],
    right: () => [1, 0],
  };
  return letterShapes(src, opt, map, sector, solid);
}
