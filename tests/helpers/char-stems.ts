// Stems first (owner's experiment, 15 November 2026). The letters-first roundel (tests/helpers/char-roundel.ts) works
// where a text has bowls to become a cradle; a text that is all stems (the shahada, الحمد لله) gets a small block of
// writing in a large circle. Here the stems carry the circle, as they do in jali thuluth: the text is written level,
// in tiers that sit at the foot of the circle, and every tall stem is redrawn to rise from its tier to the rim, so
// the row of uprights fills the upper part and their tops draw the dome. The rules, in the order they are applied
// (the numbers are just below):
//   S1. THE RIBS. The tall stems of a line are found by their geometry (char-first.ts `findStems`); and both arms
//       of a lam-alif are ribs, the arm without a head too (it is found here: a near-upright stroke of a lam-alif
//       that is not already a stem). A lam-alif with one arm risen and one not is no longer a lam-alif.
//   S2. A RIB IS ONE STROKE. A rib is not cut and pieced out with a straight shaft. Its skeleton between the head
//       (what lies within HEAD of its top) and the foot (FOOT above the line where the stroke runs on into a join or
//       a bowl, FREE_FOOT where the stroke ends at the line) is drawn out as it stands: a sample that stood at the
//       share u of that stretch stands at u still, moved up by e s(u), s(u) = 3u^2 - 2u^3 (so the stroke leaves its
//       foot and enters its head with the direction it had), and keeps the pen's weight it had at u, so the taper
//       of the written stem is the taper of the risen one, spread over its whole length. The head rides the top
//       whole, turned with the stem there; the pen turns with the stem.
//   S3. WHERE IT GOES. Straight: along the stem's own lean. Curved (`curved`): on its meridian, rule 30 of
//       docs/letters-first/rules.md (at height y it stands at x0 w(y)/w(y0)), added to its lean; a rib that stops
//       under the tier above it (S5) stays straight. Crossed (`arms:
//       'cross'`): the two arms of a lam-alif each take over the other's line within the first CROSS_BY of the
//       rise, so they cross low and stand apart above, the classical crossed lam-alif.
//   S4. THE TIERS. The words are split into consecutive level lines (tiers), read from the top down; the bottom
//       tier stands as low as its ink allows inside the margin and each tier above rests on the one below at
//       LINE_SPACE of ink, measured without the ribs that pass it (S5). With `low: false` the stack is centred.
//   S5. BAYS. A tier above another is slid sideways (SLIDES) and its word spaces opened (up to `open`) so that as
//       many ribs of the tiers below as can stand in a word space of it, or beside it: the setting that lets the
//       most ribs pass, then the least of half the opening plus one and a half times the slide (nibs). Ribs of one
//       word that stand within PIER of each other pass together or not at all. A tier is slid no further than
//       OVERHANG past the end of the tier under it.
//   S6. HOW FAR. Ribs are settled from the upright axis outward. Each rises until its head meets the margin or
//       its ink comes within CLEAR of another word's ink (bodies, and the ribs settled before it) or, from APART
//       above its foot, of another rib of its own word, measured on a raster; the two arms of a lam-alif rise by
//       one length. A rib that could rise by less than MIN_RISE of its
//       written height stays as written.
//   S7. THE CIRCLE. For each opening tried, the circles from the smallest in which the tiers stand (S4) to LARGER
//       times that; of all those, the one with the least cost: the radius, times (1 + UNREACHED x the share of
//       ribs that do not come within NEAR_RIM of the margin), times (1 + EMPTY x the share of the circle that
//       lies further than FAR of the radius from any ink).
//   S8. THE SPLIT (when it is not given): every split of the words into one, two or three tiers is laid out by S4
//       to S7 and the cheapest taken; a tier holds at most MAX_TIER words.
//   S9. ONE-POINT CONVERGENCE (`vanish`, the owner's suggestion; not part of the rule as recommended): a point V
//       on the circle's upright axis; a point of a stroke at height y, whose foot stands at height f, is moved to
//       x (y - V)/(f - V), so every upright, drawn on, passes through V, and the lines of writing stay level.
//       With `uprights` the whole tier is so sheared about its line (the short uprights lean too); without, only
//       the ribs, each about its foot.
// Nothing here names a text or a word.
import { isLetter } from '../../src/script/thuluth';
import type { Built } from '../../src/script/thuluth/engine';
import { cleanOutline } from '../../src/script/thuluth/outline';
import { Alpha, toPixels } from '../../src/script/thuluth/raster';
import type { Poly, Sample, Stroke } from '../../src/script/thuluth/types';
import type { Cols, Profile } from './char-first';
import { CELL, CLEAR, MARGIN, NIB, colsOf, findStems, meridianShift, need, profile, th } from './char-first';

// ---- the numbers (pen units unless it says nibs) ----
export const HEAD = 2.2, // the head of a rib: what lies within this of its top
  FOOT = 3, // a rib that runs on into a join or a bowl is drawn out from this far above its line,
  FREE_FOOT = 1.2, // one that ends at the line (an alif) from this far: its taper runs the whole length
  SHAFT = 0.3, // a drawn-out rib has a sample this often
  APART = 1.5, // ribs keep CLEAR of each other from this far above their feet (below, they are their letters)
  EASE = 3, // a curved rib has turned to its meridian within about this length (rule 30)
  CROSS_BY = 0.3, // crossed arms have changed sides within this share of their rise
  MIN_RISE = 0.15, // a rib rises by at least this share of its written height, or not at all
  OVERHANG = 2.5 * NIB, // a tier is slid no further than this past the end of the tier under it
  TIER = 12, // about how far one tier stands above the next (for where a leaning rib will stand there)
  PIER = 2.2, // ribs of one word whose columns stand no further apart than this are one pier
  NEAR_RIM = 1.5 * NIB, // a rib whose head stands within this of the margin has reached the rim
  UNREACHED = 0.6, // what the ribs that do not reach cost
  EMPTY = 2, // what the empty share of the circle costs,
  FAR = 0.15, // empty: further than this share of the radius from any ink
  GRID = 96,
  LARGER = 1.22, // a circle up to this many times the smallest that holds the tiers is tried
  MAX_TIER = 7, // words in a tier at the most
  SLIDES = [0, 1, -1, 2, -2, 3, -3, 4.5, -4.5, 6, -6, 8, -8].map(v => v * NIB), // how far a tier may be slid
  K = 5; // raster cells to a pen unit

/** A rib: a stem that can be drawn out. Its stroke's samples from the top down (`s`: an arm is written upward, and is
 *  turned round here), the last sample of its head (`h`) and its foot (`f`). */
export interface Rib {
  si: number;
  s: Sample[];
  h: number;
  f: number;
  /** The word, the line it stands on, its top as written above that line, and its own lean (sideways for each unit
   *  of rise) between foot and head. */
  wi: number;
  base: number;
  written: number;
  lean: number;
  /** Strokes that ride with the head (a shadda). */
  riders: number[];
  /** The other arm of its lam-alif (its index among the line's ribs), or -1. */
  pair: number;
}
/** A tier as the engine writes it. */
export interface Tier {
  text: string;
  b: Built;
  nw: number;
  ribs: Rib[];
  /** For each word: its ink without the ribs' upper parts (above their feet), and all of it as written. */
  low: Poly[][];
  full: Poly[][];
  lowCols: Cols[];
  fullCols: Cols[];
  /** For each rib: its upper part as written, on the grid. */
  ribCols: Cols[];
  x0: number;
  x1: number;
}
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const moved = (ps: readonly Poly[], dx: number, dy: number): Poly[] =>
  ps.map(q => q.map(([x, y]) => [x + dx, y + dy] as [number, number]));

/** S1: the ribs of a written line. */
export function ribsOf(b: Built, text: string): Rib[] {
  const letters = b.placed.filter(isLetter),
    out: Rib[] = [],
    make = (si: number, s: Sample[], top: number, wi: number, base: number, riders: number[]): Rib | null => {
      const n = s.length;
      let it = 0;
      for (let i = 0; i <= top; i++) if (s[i].y > s[it].y) it = i;
      // the foot: down the upright run from `top`, no lower than FOOT (FREE_FOOT where the stroke ends at the line)
      const run = (floor: number) => {
        let i = top;
        while (i + 1 < n && s[i + 1].y < s[i].y && Math.abs(s[i + 1].x - s[i].x) <= 0.25 * (s[i].y - s[i + 1].y) + 0.02 && s[i + 1].y >= floor) i++; // prettier-ignore
        return i;
      };
      const end = run(-Infinity),
        free = Math.hypot(s[n - 1].x - s[end].x, s[n - 1].y - s[end].y) < 0.8 && s[n - 1].y < base + 1,
        f = run(base + (free ? FREE_FOOT : FOOT));
      let h = it;
      while (h < f - 2 && s[h].y > s[it].y - HEAD) h++;
      if (f - h < 3 || s[h].y - s[f].y < 0.8) return null;
      return { si, s, h, f, wi, base, written: s[it].y - base, lean: (s[h].x - s[f].x) / (s[h].y - s[f].y), riders, pair: -1 }; // prettier-ignore
    };
  for (const m of findStems(b, text)) {
    const r = make(m.si, b.strokes[m.si].s, m.cut, m.wi, m.base, m.riders);
    if (r) out.push(r);
  }
  // the other arm of a lam-alif: a stroke of that letter alone, near upright, that is not a stem already
  b.strokes.forEach((st, si) => {
    if (!st.own || st.nib || out.some(r => r.si === si)) return;
    const li = st.own[0],
      letter = letters.find(p => p.wi === st.wi && p.li === li);
    if (!letter || !'ﻻﻼ'.includes(letter.c) || st.own.some(o => o !== li)) return;
    const up = st.s[0].y < st.s[st.s.length - 1].y,
      s = up ? st.s.slice().reverse() : st.s,
      rise = s[0].y - s[s.length - 1].y;
    if (rise < 6 || Math.abs(s[0].x - s[s.length - 1].x) > 0.25 * rise) return;
    // (its upright run is taken from where the pen is fullest)
    let top = 0;
    for (let i = 0; i < s.length; i++) if (s[i].w >= s[top].w && s[i].y >= letter.oy + FOOT + 1) top = i;
    const r = make(si, s, top, st.wi ?? 0, letter.oy, []),
      mate = out.findIndex(o => o.wi === st.wi && b.strokes[o.si].own?.includes(li));
    if (!r || mate < 0) return;
    r.pair = mate;
    out[mate].pair = out.length;
    out.push(r);
  });
  return out;
}

const tiers = new Map<string, Tier>();
export function tierOf(text: string): Tier {
  let t = tiers.get(text);
  if (t) return t;
  const b = th.buildStrokes(text, {}),
    nw = text.trim().split(/\s+/).length,
    ribs = ribsOf(b, text),
    ext = Array.from({ length: nw }, () => [Infinity, -Infinity]);
  for (const st of b.strokes)
    if (st.wi != null && st.wi >= 0)
      for (const q of st.s) {
        ext[st.wi][0] = Math.min(ext[st.wi][0], q.x);
        ext[st.wi][1] = Math.max(ext[st.wi][1], q.x);
      }
  const wordAt = (x: number) => {
      let k = 0;
      for (let w = 1; w < nw; w++) if (Math.abs(x - (ext[w][0] + ext[w][1]) / 2) < Math.abs(x - (ext[k][0] + ext[k][1]) / 2)) k = w; // prettier-ignore
      return k;
    },
    low: Poly[][] = Array.from({ length: nw }, () => []),
    full: Poly[][] = Array.from({ length: nw }, () => []),
    upper: Poly[][] = ribs.map(() => []);
  b.strokes.forEach((st, si) => {
    const k = ribs.findIndex(r => r.si === si),
      rider = ribs.findIndex(r => r.riders.includes(si)),
      w = st.wi != null && st.wi >= 0 ? st.wi : rider >= 0 ? ribs[rider].wi : wordAt(st.s.reduce((a, q) => a + q.x, 0) / st.s.length), // prettier-ignore
      ink = th.strokePolys(st);
    full[w].push(...ink);
    if (k >= 0) {
      low[w].push(...th.strokePolys({ ...st, s: ribs[k].s.slice(ribs[k].f) }));
      upper[k].push(...th.strokePolys({ ...st, s: ribs[k].s.slice(0, ribs[k].f + 1) }));
    } else if (rider >= 0) upper[rider].push(...ink);
    else low[w].push(...ink);
  });
  let d = 0;
  for (const g of b.dotGroups)
    for (let i = 0; i < g.n; i++) {
      const [x, y] = b.dots[d++],
        ink = th.dotPolysAt(x, y);
      low[g.wi].push(...ink);
      full[g.wi].push(...ink);
    }
  const xs = full.flat(2).map(p => p[0]);
  t = { text, b, nw, ribs, low, full, lowCols: low.map(colsOf), fullCols: full.map(colsOf), ribCols: upper.map(colsOf), x0: Math.min(...xs), x1: Math.max(...xs) }; // prettier-ignore
  tiers.set(text, t);
  return t;
}

/** Where a rib is led. `ox`, `oy`: where its line stands in the circle; `rho`: the circle its meridian belongs to
 *  (unset: straight); `to`: the rib whose line it takes over (crossed arms). */
export interface Lead {
  ox: number;
  oy: number;
  rho?: number;
  to?: Rib;
  /** Drawn out upright, without its own lean (S9 leans it afterwards); the arms of a lam-alif keep theirs, or the
   *  letter would be two alifs. */
  upright?: boolean;
}
/** S2 and S3: rib `r` drawn `e` taller, as its stroke and the strokes that ride with its head; and the part of them
 *  that stands clear of the letters' bodies (from APART above the foot), which keeps CLEAR of the other ribs. */
export function drawn(t: Tier, r: Rib, e: number, g: Lead): { all: Stroke[]; upper: Stroke[] } {
  const st = t.b.strokes[r.si],
    riders = r.riders.map(i => t.b.strokes[i]),
    give = (s: Sample[], rest: Stroke[]) => {
      const one = { ...st, s, own: undefined };
      let up = 0;
      while (up < s.length && (up <= r.h || s[up].y >= r.s[r.f].y + APART)) up++;
      return { all: [one, ...rest], upper: [{ ...one, s: s.slice(0, up) }, ...rest] };
    };
  if (!(e > 0)) return give(r.s, riders);
  const s = r.s,
    F = s[r.f],
    A = s[r.h],
    H = A.y - F.y,
    n = Math.max(4, Math.ceil((H + e) / SHAFT)),
    // the line a rib stands on: its lean, and its meridian's shift from upright
    line = (q: Rib, y: number) => {
      const P = q.s[q.f];
      return (
        P.x +
        (g.upright && q.pair < 0 ? 0 : q.lean) * (y - P.y) +
        (g.rho ? meridianShift(P.x + g.ox, P.y + g.oy, y + g.oy, g.rho, 1, EASE)[0] : 0)
      );
    },
    xs: number[] = [],
    ys: number[] = [],
    xo: number[] = [],
    yo: number[] = [],
    ws: number[] = [],
    rs: number[] = [];
  let j = r.f;
  for (let i = 0; i <= n; i++) {
    const u = i / n,
      y0 = F.y + u * H;
    while (j > r.h && s[j - 1].y <= y0) j--;
    const a = s[j],
      c = s[Math.max(r.h, j - 1)],
      v = c.y > a.y ? Math.min(1, Math.max(0, (y0 - a.y) / (c.y - a.y))) : 0,
      x0 = a.x + (c.x - a.x) * v,
      y = y0 + e * smooth(u),
      own = line(r, y),
      over = g.to ? smooth((y - F.y) / (CROSS_BY * (H + e))) : 0;
    xo.push(x0);
    yo.push(y0);
    ws.push(a.w + (c.w - a.w) * v);
    rs.push((a.rot ?? 0) + ((c.rot ?? 0) - (a.rot ?? 0)) * v);
    ys.push(y);
    // (what the written stem wavers from its own lean is kept, drawn out with it)
    xs.push(own + (g.to ? (line(g.to, y) - own) * over : 0) + x0 - (F.x + r.lean * (y0 - F.y)));
  }
  const slope = (X: number[], Y: number[], i: number) => {
      const a = Math.max(0, i - 1),
        c = Math.min(n, i + 1);
      return (X[c] - X[a]) / (Y[c] - Y[a]);
    },
    turn = (i: number) => Math.atan(slope(xo, yo, i)) - Math.atan(slope(xs, ys, i)),
    phi = turn(n),
    cos = Math.cos(phi),
    sin = Math.sin(phi),
    rigid = (q: Sample): Sample => ({ ...q, x: xs[n] + (q.x - A.x) * cos - (q.y - A.y) * sin, y: ys[n] + (q.x - A.x) * sin + (q.y - A.y) * cos, rot: (q.rot ?? 0) + phi }), // prettier-ignore
    shaft: Sample[] = [];
  for (let i = n - 1; i >= 1; i--) shaft.push({ x: xs[i], y: ys[i], w: ws[i], rot: rs[i] + turn(i) });
  return give(
    [...s.slice(0, r.h + 1).map(rigid), ...shaft, ...s.slice(r.f)],
    riders.map(k => ({ ...k, s: k.s.map(rigid), own: undefined })),
  );
}

// ---- the ink on a raster: which words stand within CLEAR of a cell ----
class Field {
  readonly W: number;
  readonly halo: Uint16Array;
  /** The same for the risen parts of the ribs, each rib (or pair of arms) a bit of its own. */
  readonly ribs: Uint32Array;
  private readonly disc: [number, number][] = [];
  constructor(readonly R: number) {
    this.W = Math.ceil(2 * R * K) + 4;
    this.halo = new Uint16Array(this.W * this.W);
    this.ribs = new Uint32Array(this.W * this.W);
    const r = CLEAR * K;
    for (let dy = -Math.ceil(r); dy <= r; dy++) for (let dx = -Math.ceil(r); dx <= r; dx++) if (dx * dx + dy * dy <= r * r) this.disc.push([dx, dy]); // prettier-ignore
  }
  private cells(polys: readonly Poly[], each: (i: number, x: number, y: number) => boolean): boolean {
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const q of polys)
      for (const [x, y] of q) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    if (!(x1 >= x0)) return false;
    const { R, W } = this,
      cx = Math.floor((x0 + R) * K),
      cy = Math.floor((R - y1) * K),
      w = Math.ceil((x1 + R) * K) - cx + 2,
      h = Math.ceil((R - y0) * K) - cy + 2,
      A = new Alpha(w, h);
    A.fill(toPixels(polys as Poly[], x => (x + R) * K + 2 - cx, y => (R - y) * K + 2 - cy)); // prettier-ignore
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        if (A.a[py * w + px] <= 127) continue;
        const gx = px + cx,
          gy = py + cy;
        if (gx < 0 || gy < 0 || gx >= W || gy >= W) return true;
        if (each(gy * W + gx, gx, gy)) return true;
      }
    return false;
  }
  /** Whether this ink of word `id` stands within CLEAR of another word's (or off the grid). */
  hits(polys: readonly Poly[], id: number): boolean {
    const not = ~(1 << id) & 0xffff;
    return this.cells(polys, i => (this.halo[i] & not) !== 0);
  }
  /** Whether the risen part of rib `rib` stands within CLEAR of another rib's. */
  crowds(polys: readonly Poly[], rib: number): boolean {
    const not = ~(1 << (rib % 32));
    return this.cells(polys, i => (this.ribs[i] & not) !== 0);
  }
  stamp(polys: readonly Poly[], id: number, rib = -1): void {
    const { W, disc } = this,
      halo = rib < 0 ? this.halo : this.ribs,
      bit = 1 << (rib < 0 ? id : rib % 32);
    this.cells(polys, (_, gx, gy) => {
      for (const [dx, dy] of disc) {
        const x = gx + dx,
          y = gy + dy;
        if (x >= 0 && y >= 0 && x < W && y < W) halo[y * W + x] |= bit;
      }
      return false;
    });
  }
}

// ---- S4 to S7: the layout ----
export interface StemOptions {
  /** How many words in each tier, from the top down (unset: S8). */
  tiers?: number[];
  /** The stack centred in the circle, not at its foot. */
  low?: boolean;
  /** Ribs on their meridians. */
  curved?: boolean;
  /** The arms of a lam-alif: both risen along their own lean (the default), crossed, or as any stem (the arm without
   *  a head stays as written: the letters-first rule as it stood). */
  arms?: 'rise' | 'cross' | 'stem';
  /** The word spaces of a tier may be opened by up to these (nibs): each is tried. */
  opens?: number[];
  /** Ribs stay as written (to show the tiers alone). */
  still?: boolean;
  /** S9, one-point convergence: the uprights lean so that each, drawn on, passes through a point on the circle's
   *  upright axis this many radii above its centre (negative: below, and the uprights fan open upward). */
  vanish?: number;
  /** With `vanish`: every upright leans, the short ones too (the whole tier is sheared about its line); unset, only
   *  the ribs, each about its foot. */
  uprights?: boolean;
}
export interface StemLaid {
  R: number;
  polys: Poly[];
  lines: string[];
  /** Ribs, how many reach the rim, and how many times its written height each risen one stands. */
  ribs: number;
  reach: number;
  factors: number[];
  /** The share of the circle far from any ink, the opening taken, and the cost (S7). */
  empty: number;
  open: number;
  cost: number;
}
const inside = (polys: readonly Poly[], Rt: number) => {
  for (const q of polys) for (const [x, y] of q) if (x * x + y * y > Rt * Rt) return false;
  return true;
};
/** The share of the circle that lies further than FAR of its radius from any ink (on a grid of GRID cells to the
 *  diameter; the ink is its polygons' corners, which the pen sets every SHAFT or closer). */
export function emptyShare(ink: readonly Poly[], R: number): number {
  const N = GRID,
    c = (2 * R) / N,
    d = new Float32Array(N * N).fill(1e9);
  for (const q of ink)
    for (const [x, y] of q) {
      const i = Math.floor((x + R) / c),
        j = Math.floor((R - y) / c);
      if (i >= 0 && j >= 0 && i < N && j < N) d[j * N + i] = 0;
    }
  // (a chamfer distance, there and back)
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= N || j >= N ? 1e9 : d[j * N + i]);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++)
      d[j * N + i] = Math.min(d[j * N + i], at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + 1.414, at(i + 1, j - 1) + 1.414); // prettier-ignore
  for (let j = N - 1; j >= 0; j--)
    for (let i = N - 1; i >= 0; i--)
      d[j * N + i] = Math.min(d[j * N + i], at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + 1.414, at(i - 1, j + 1) + 1.414); // prettier-ignore
  let inCircle = 0,
    far = 0;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if (Math.hypot((i + 0.5) * c - R, (j + 0.5) * c - R) > R) continue;
      inCircle++;
      if (d[j * N + i] * c > FAR * R) far++;
    }
  return far / inCircle;
}
/** Whether a stretch of columns of the circle (pen units) is free of a tier's ink, each word standing at `off`. */
function free(t: Tier, off: readonly number[], xa: number, xb: number): boolean {
  for (let w = 0; w < t.nw; w++) {
    const c = t.fullCols[w],
      a = Math.floor((xa - off[w]) / CELL) - c.c0,
      b = Math.ceil((xb - off[w]) / CELL) - c.c0;
    for (let i = Math.max(0, a); i <= Math.min(c.lo.length - 1, b); i++) if (c.hi[i] >= c.lo[i]) return false;
  }
  return true;
}
/** A rib of a lower tier on its way up: the stretch of columns it needs at a tier above. */
interface Column {
  t: number;
  ks: number[];
  wi: number;
  xa: number;
  xb: number;
  /** How far sideways it moves in rising one tier (its lean; on a meridian, its share of the width). */
  drift: number;
}
/** The stretch a column needs `up` tiers above its own. */
const span = (c: Column, up: number): [number, number] => [
  c.xa + Math.min(0, c.drift * up),
  c.xb + Math.max(0, c.drift * up),
];
/** Why layouts did not stand (for the facts). */
export const WHY = new Map<string, number>();
const no = (why: string) => {
  WHY.set(why, (WHY.get(why) ?? 0) + 1);
  return null;
};
function layout(ts: readonly Tier[], R: number, o: StemOptions, open: number, air = 0, lift = 0): StemLaid | null {
  const Rt = R - MARGIN,
    V = o.vanish == null ? null : o.vanish * R,
    n = ts.length,
    offs: number[][] = ts.map(t => new Array<number>(t.nw).fill(-(t.x0 + t.x1) / 2)),
    oy = new Array<number>(n).fill(0),
    spread = new Array<number>(n).fill(0),
    passes: boolean[][] = ts.map(t => t.ribs.map(() => true));
  // (twice: where a curved rib stands at a tier above depends on the heights, which depend on what passes)
  for (let round = 0; round < (o.curved && n > 1 ? 2 : 1); round++) {
    const cols: Column[] = [],
      before = oy.slice();
    for (let t = n - 1; t >= 0; t--) {
      const T = ts[t];
      if (t < n - 1 && cols.length) {
        // S5: the setting of this tier that lets the most ribs from below pass
        const steps = open > 0 ? [0, open / 2, open] : [0],
          gaps = T.nw - 1,
          mid = -(T.x0 + T.x1) / 2;
        let best: { score: number; off: number[]; sum: number } | null = null;
        const g = new Array<number>(gaps).fill(0);
        const each = (i: number) => {
          if (i < gaps) {
            for (const v of steps) {
              g[i] = v;
              each(i + 1);
            }
            return;
          }
          const sum = g.reduce((a, v) => a + v, 0),
            under = ts[t + 1],
            reachOf = Math.abs(under.x1 - under.x0 + spread[t + 1] - (T.x1 - T.x0 + sum)) / 2 + OVERHANG;
          for (const slide of SLIDES) {
            // (never further than OVERHANG beyond the end of the tier under it)
            if (Math.abs(slide) > reachOf) continue;
            // (word 0 is the rightmost: each opening moves the words after it to the left)
            const off = Array.from({ length: T.nw }, (_, w) => mid + slide + sum / 2 - g.slice(0, w).reduce((a, v) => a + v, 0)), // prettier-ignore
              pass = cols.filter(c => free(T, off, ...span(c, c.t - t))).length,
              score = pass * 100 - (0.5 * sum) / NIB - (1.5 * Math.abs(slide)) / NIB;
            if (!best || score > best.score + 1e-9) best = { score, off, sum };
          }
        };
        each(0);
        offs[t] = best!.off;
        spread[t] = best!.sum;
        for (let i = cols.length - 1; i >= 0; i--)
          if (!free(T, offs[t], ...span(cols[i], cols[i].t - t))) {
            for (const k of cols[i].ks) passes[cols[i].t][k] = false;
            cols.splice(i, 1);
          }
      }
      const own: Column[] = [];
      T.ribs.forEach((r, k) => {
        passes[t][k] = true;
        const c = T.ribCols[k],
          x = offs[t][r.wi],
          F = r.s[r.f];
        // (where it will stand a tier higher: its lean, and on its meridian)
        let drift = (V == null ? r.lean : 0) * TIER;
        if (o.curved && round > 0 && t > 0) {
          const y0 = F.y + before[t],
            y1 = before[t - 1] + 4,
            w0 = Math.sqrt(Math.max(1, Rt * Rt - y0 * y0)),
            w1 = Math.sqrt(Math.max(1, Rt * Rt - y1 * y1));
          drift += (F.x + x) * (w1 / w0 - 1);
        }
        own.push({ t, ks: [k], wi: r.wi, xa: c.c0 * CELL + x - CLEAR - 0.3, xb: (c.c0 + c.lo.length) * CELL + x + CLEAR + 0.3, drift }); // prettier-ignore
      });
      // (ribs of one word that stand within PIER of each other are one pier: they pass together or not at all)
      own.sort((p, q) => p.xa - q.xa);
      for (const c of own) {
        const last = cols[cols.length - 1];
        if (last && last.t === t && last.wi === c.wi && c.xa - last.xb <= PIER) {
          last.ks.push(...c.ks);
          last.xb = Math.max(last.xb, c.xb);
          last.drift = Math.abs(c.drift) > Math.abs(last.drift) ? c.drift : last.drift;
        } else cols.push(c);
      }
    }
    // S4: the bottom tier as low as its ink allows, each tier above resting on the one below
    for (let t = n - 1; t >= 0; t--) {
      const T = ts[t];
      if (t === n - 1) {
        let y = -Infinity;
        for (let w = 0; w < T.nw; w++)
          for (const q of T.full[w])
            for (const [px, py] of q) {
              const x = px + offs[t][w];
              if (Math.abs(x) >= Rt) return no('bottom tier too wide');
              y = Math.max(y, -Math.sqrt(Rt * Rt - x * x) - py);
            }
        oy[t] = y + lift;
        continue;
      }
      const U = ts[t + 1],
        above: Profile = profile(T.fullCols.map((c, w) => [c, offs[t][w]] as const)),
        below: Profile = profile([
          ...U.lowCols.map((c, w) => [c, offs[t + 1][w]] as const),
          ...U.ribCols.flatMap((c, k) =>
            passes[t + 1][k] && !o.still ? [] : [[c, offs[t + 1][U.ribs[k].wi]] as const],
          ),
        ]);
      oy[t] = oy[t + 1] + need(above, below) + air;
    }
  }
  // S9: a point at height y, of a stroke whose foot stands at height `foot`, keeps its share of the way to V
  const lean = (ps: Poly[], foot: number): Poly[] =>
      V == null ? ps : ps.map(q => q.map(([x, y]) => [y > foot || o.uprights ? (x * (y - V)) / (foot - V) : x, y] as [number, number])), // prettier-ignore
    body = (t: number, w: number, what: Poly[][]) => {
      const b = moved(what[w], offs[t][w], oy[t]);
      return o.uprights ? lean(b, oy[t]) : b;
    };
  if (o.low === false) {
    const ys = ts.flatMap((T, t) => T.full.flatMap((_, w) => body(t, w, T.full).flat().map(p => p[1]))), // prettier-ignore
      dy = -(Math.min(...ys) + Math.max(...ys)) / 2;
    for (let t = 0; t < n; t++) oy[t] += dy;
  }
  for (let t = 0; t < n; t++)
    for (let w = 0; w < ts[t].nw; w++)
      if (!inside(body(t, w, ts[t].full), Rt))
        // (a sheared bottom tier may need to stand a little higher than it was measured to need upright)
        return V != null && o.uprights && t === n - 1 && lift < 3 * NIB
          ? layout(ts, R, o, open, air, lift + 0.25 * NIB)
          : no(`tier ${t} outside`);
  // S6: the bodies on the raster, then the ribs from the axis outward
  const field = new Field(R),
    id = (t: number, w: number) => ts.slice(0, t).reduce((a, T) => a + T.nw, 0) + w,
    ink: Poly[][] = [];
  for (let t = 0; t < n; t++)
    for (let w = 0; w < ts[t].nw; w++) {
      const b = body(t, w, ts[t].low);
      // (sheared tiers may need more air between them than they were measured to need upright)
      if (field.hits(b, id(t, w)))
        return V != null && air < 4 * NIB
          ? layout(ts, R, o, open, air + 0.5 * NIB, lift)
          : no(`bodies touch, tier ${t}`);
      ink[id(t, w)] = b;
    }
  ink.forEach((b, i) => field.stamp(b, i));
  const todo: { t: number; ks: number[]; x: number }[] = [];
  ts.forEach((T, t) =>
    T.ribs.forEach((r, k) => {
      const two = (o.arms ?? 'rise') !== 'stem' && r.pair >= 0;
      if (two && r.pair < k) return;
      const ks = two ? [k, r.pair] : [k];
      todo.push({ t, ks, x: Math.min(...ks.map(i => Math.abs(T.ribs[i].s[T.ribs[i].f].x + offs[t][T.ribs[i].wi]))) });
    }),
  );
  todo.sort((p, q) => p.x - q.x || p.t - q.t);
  let reach = 0,
    count = 0,
    groups = 0;
  const factors: number[] = [];
  for (const { t, ks } of todo) {
    const T = ts[t],
      rs = ks.map(k => T.ribs[k]),
      w = rs[0].wi,
      // (a rib that stops under the tier above it stays straight: bent, so short a stem reads as a slip)
      bent = !!o.curved && ks.every(k => passes[t][k]),
      lead = (r: Rib): Lead => ({ ox: offs[t][w], oy: oy[t], rho: bent ? Rt : undefined, upright: V != null, to: o.arms === 'cross' && ks.length > 1 ? T.ribs[r.pair] : undefined }), // prettier-ignore
      at = (e: number) => {
        const d = rs.map(r => drawn(T, r, e, lead(r))),
          ink = (ss: Stroke[], r: Rib) => lean(moved(ss.flatMap(k => th.strokePolys(k)), offs[t][w], oy[t]), o.uprights ? oy[t] : r.s[r.f].y + oy[t]); // prettier-ignore
        return { all: d.flatMap((v, i) => ink(v.all, rs[i])), upper: d.flatMap((v, i) => ink(v.upper, rs[i])) };
      },
      g = groups++,
      hit = (d: { all: Poly[]; upper: Poly[] }) => field.hits(d.all, id(t, w)) || field.crowds(d.upper, g),
      // (an arm written without a head on the line counts as a rib only if it rises)
      written = Math.max(...rs.map(r => r.written));
    count += ks.length;
    let e = 0;
    if (!o.still) {
      // as far as the margin lets it, then as far as the other words' ink
      let lo = 0,
        hi = 2 * R;
      for (let i = 0; i < 12; i++) {
        const m = (lo + hi) / 2;
        if (inside(at(m).all, Rt)) lo = m;
        else hi = m;
      }
      const rim = lo;
      if (hit(at(rim))) {
        lo = 0;
        hi = rim;
        for (let i = 0; i < 11; i++) {
          const m = (lo + hi) / 2;
          if (!hit(at(m))) lo = m;
          else hi = m;
        }
      }
      e = lo >= MIN_RISE * written ? lo : 0;
      if (e > 0 && e >= rim - NEAR_RIM) reach += ks.length;
      else if (e === 0 && rim < NEAR_RIM) reach += ks.length;
      if (e > 0) for (const r of rs) factors.push((r.written + e) / r.written);
    }
    const final = at(e);
    if (e === 0 && field.hits(final.all, id(t, w))) return no(`a rib as written touches, tier ${t}`);
    field.stamp(final.all, id(t, w));
    field.stamp(final.upper, id(t, w), g);
    ink[id(t, w)].push(...final.all);
  }
  const all = ink.flat(),
    empty = emptyShare(all, R),
    cost = R * (1 + (UNREACHED * (count - reach)) / Math.max(1, count)) * (1 + EMPTY * empty);
  if (!inside(all, Rt + 1e-6)) return no('ink outside');
  return { R, polys: ink.flatMap(b => cleanOutline(b)), lines: ts.map(t => t.text), ribs: count, reach, factors, empty, open, cost }; // prettier-ignore
}

/** The rule as recommended: the split by cost (S8), the ribs on their meridians, the lam-alifs crossed. */
export const RULE: StemOptions = { curved: true, arms: 'cross' };
/** The splits of n words into at most three consecutive tiers of at most MAX_TIER words. */
export function splits(n: number): number[][] {
  const out: number[][] = [];
  for (let a = 1; a <= n; a++) {
    if (a === n) out.push([n]);
    for (let b = 1; a + b <= n; b++) {
      if (a + b === n) out.push([a, b]);
      else out.push([a, b, n - a - b]);
    }
  }
  return out.filter(s => s.every(v => v <= MAX_TIER));
}
/** S7 for one split: the smallest circle for each opening, and the cheapest of those. */
export function stemTiers(text: string, o: StemOptions = {}): StemLaid | null {
  const words = text.trim().split(/\s+/),
    cut = o.tiers ?? [words.length],
    ts: Tier[] = [];
  let a = 0;
  for (const c of cut) {
    ts.push(tierOf(words.slice(a, a + c).join(' ')));
    a += c;
  }
  let best: StemLaid | null = null;
  for (const open of (o.opens ?? [0, 4]).map(v => v * NIB)) {
    if (open > 0 && ts.length === 1) continue;
    let least = 0;
    for (
      let R = Math.max(...ts.map(t => (t.x1 - t.x0) / 2)) + MARGIN;
      R < 220 && !(least && R > least * LARGER);
      R *= 1.04
    ) {
      const l = layout(ts, R, o, open);
      if (!l) continue;
      least ||= R;
      if (!best || l.cost < best.cost - 1e-9) best = l;
    }
  }
  return best;
}
/** S8: the cheapest split. */
export function stemsFirst(text: string, o: StemOptions = {}, said?: string[]): StemLaid | null {
  if (o.tiers) return stemTiers(text, o);
  let best: StemLaid | null = null;
  for (const tiers of splits(text.trim().split(/\s+/).length)) {
    const l = stemTiers(text, { ...o, tiers });
    said?.push(`${tiers.join('+')}: ${l ? `cost ${l.cost.toFixed(1)} (radius ${l.R.toFixed(1)}, ${l.reach} of ${l.ribs} ribs reach, ${(l.empty * 100).toFixed(0)}% empty, opened ${(l.open / NIB).toFixed(0)} nibs)` : 'does not stand'}`); // prettier-ignore
    if (l && (!best || l.cost < best.cost - 1e-9)) best = l;
  }
  return best;
}

// ---- the drawing: black ink on white, the circle thin ----
export const discSVG = (l: { R: number; polys: Poly[] }, x = 0, y = 0, size = 900) => {
  const R = l.R,
    pad = R * 0.03,
    S = 2 * (R + pad),
    d = l.polys.map(q => 'M' + q.map(([px, py]) => `${(px + R + pad).toFixed(2)} ${(R + pad - py).toFixed(2)}`).join('L') + 'Z').join(''); // prettier-ignore
  return `<g transform="translate(${x} ${y}) scale(${(size / S).toFixed(5)})"><circle cx="${R + pad}" cy="${R + pad}" r="${R}" fill="none" stroke="#000" stroke-width="${(R * 0.004).toFixed(3)}"/><path d="${d}" fill="#000" fill-rule="nonzero"/></g>`;
};
export const pageSVG = (l: { R: number; polys: Poly[] }, size = 900) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#fff"/>${discSVG(l, 0, 0, size)}</svg>`;
/** A contact sheet: discs in rows of `per`, each with its caption lines under it. */
export function contactSVG(items: { l: { R: number; polys: Poly[] } | null; cap: string[] }[], per = 3, cell = 480) {
  const H = cell + 78,
    rows = Math.ceil(items.length / per);
  let body = '';
  items.forEach(({ l, cap }, i) => {
    const x = (i % per) * cell,
      y = Math.floor(i / per) * H;
    if (l) body += discSVG(l, x + 8, y + 8, cell - 16);
    cap.forEach((c, k) => (body += `<text x="${x + cell / 2}" y="${y + cell + 20 + 19 * k}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="${k ? 13 : 16}"${k ? '' : ' font-weight="bold"'} fill="#000">${c}</text>`)); // prettier-ignore
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${per * cell} ${rows * H}" width="${per * cell}" height="${rows * H}"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
}
