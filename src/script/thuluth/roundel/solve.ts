// The global mark solver (lab marks2.js): after the letters, vowels and dots are placed together as one even
// distribution that counterweights the letters. Vowels take a pen a third of the letters'; dot groups may shift and
// regroup but stay with their letter, on its side; optionally the clarifying letters (huruf idahiyya: a small hah under
// hah, a small seen under seen, and so for sad, ta, ayn, kaf and mim) and ornaments (plume or trefoil) fill the largest
// gaps left. The rules for the marks follow the Egyptian Cultural Development Fund's notes on tashkil and ornaments in
// thuluth and naskh: three pens, each fatha as long as its space allows, all fathas parallel, and the dagger alif of
// الله seated on its shadda.
import type { Dot, Thuluth } from '../engine';
import { isLetter } from '../engine';
import { gapKernel } from '../../../kernels/roundel';
import { ALIF_ANG, ALIF_PEN, ALIF_SCALE, MARK_PEN, MARK_SHAPES, MARK_SIZE, SIGN_PEN } from '../marks';
import { sampleStroke } from '../pen';
import { Alpha, toPixels } from '../raster';
import type { MarkName } from '../shape';
import { BELOW } from '../shape';
import type { SkelPt, Stroke } from '../types';
import type { Roundel } from './compose';
import { fieldTest } from './fields';

const DOT_ARR: Record<number, string[]> = { 2: ['h', 'v'], 3: ['up', 'down'] };
export function dotOffsets(n: number, arr: string, nib: number): [number, number][] {
  const s = nib * 1.15;
  if (n === 1) return [[0, 0]];
  if (n === 2) return arr === 'v' ? [[0, -s * 0.5], [0, s * 0.5]] : [[-s / 2, 0], [s / 2, 0]]; // prettier-ignore
  if (arr === 'row') return [[-s, 0], [0, 0], [s, 0]]; // prettier-ignore
  const up = arr === 'up' ? 1 : -1;
  return [[-s / 2, -s * 0.45 * up], [s / 2, -s * 0.45 * up], [0, s * 0.55 * up]]; // prettier-ignore
}
export type Ornament = 'plume' | 'tirfil' | 'tirnak' | 'minihah' | 'minisin';
/** An ornament, or a clarifying letter made from the engine's own letter ('mini:' and the letter). */
type OrnKey = Ornament | `mini:${string}`;
export const ORN_SHAPES: Record<Ornament, SkelPt[][]> = {
  plume: [[[0.05, -1.0, 0.3], [0.2, -0.35, 0.9], [0.55, 0.35, 1], [0.35, 0.95, 0.7], [-0.15, 1.05, 0.5], [-0.35, 0.55, 0.8], [-0.1, -0.1, 0.9], [0.05, -1.0, 0.3]], [[0.1, -0.5, 0.4], [0.15, 0.35, 0.6], [0.0, 0.8, 0.3]]],
  tirfil: [[[0.0, 0.55, 0.6], [-0.35, 0.95], [-0.05, 1.2], [0.25, 0.9], [0.0, 0.55, 0.6]], [[-0.1, 0.4, 0.6], [-0.75, 0.35], [-0.8, 0.0], [-0.35, 0.05], [-0.1, 0.4, 0.6]], [[0.1, 0.4, 0.6], [0.75, 0.35], [0.8, 0.0], [0.35, 0.05], [0.1, 0.4, 0.6]], [[0.0, 0.3, 0.8], [0.0, -0.9, 0.3]]],
  tirnak: [[[0.8, 0.5, 0.2], [0.2, 0.1, 0.9], [-0.4, -0.15, 1], [-0.85, 0.1, 0.4]]],
  minihah: [[[0.75, 0.55, 0.3], [0.1, 0.45, 0.9], [-0.45, 0.5, 0.9, 1], [-0.1, 0.0], [-0.5, -0.55], [0.1, -0.95], [0.85, -0.8, 0.3]]],
  minisin: [[[1.0, 0.4, 0.4], [0.85, -0.1, 0.9, 1], [0.6, 0.35, 0.6, 1], [0.4, -0.1, 0.9, 1], [0.15, 0.35, 0.6, 1], [-0.05, -0.1, 0.9], [-0.6, -0.35], [-1.0, -0.05, 0.4]]],
}; // prettier-ignore
const ORN_SIZE: Record<Ornament, [number, number]> = { plume: [1.3, 2.3], tirfil: [1.7, 2.2], tirnak: [1.8, 0.8], minihah: [1.7, 1.8], minisin: [2.1, 0.9] }; // prettier-ignore

/** The letters that take a clarifying letter beneath them. */
export const CLARIFY = new Set(['ح', 'س', 'ص', 'ط', 'ع', 'ك', 'م']);
/** The clarifying letters' size (their longer side, in pen units at a group scale of 1). */
export const SIGN_SIZE = 2.5;
interface OrnShape {
  shapes: SkelPt[][];
  size: [number, number];
  /** Drawn at this scale (with the group's). */
  scale: number;
}
const SIGNS = new WeakMap<Thuluth, Map<string, OrnShape | null>>();
/** A clarifying letter: the engine's own isolated letter, centred and normalised to SIGN_SIZE (lab miniSign). */
export function miniSign(th: Thuluth, c: string): OrnShape | null {
  let m = SIGNS.get(th);
  if (!m) SIGNS.set(th, (m = new Map()));
  if (m.has(c)) return m.get(c)!;
  const g = th.glyphFor(c, 'iso');
  let out: OrnShape | null = null;
  if (g && g.s.length) {
    const pts = g.s.flatMap(st => st.pts),
      x0 = Math.min(...pts.map(q => q[0])),
      x1 = Math.max(...pts.map(q => q[0])),
      y0 = Math.min(...pts.map(q => q[1])),
      y1 = Math.max(...pts.map(q => q[1])),
      sc = 2 / Math.max(x1 - x0, y1 - y0),
      cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2,
      w = (x1 - x0) * sc,
      h = (y1 - y0) * sc,
      k = SIGN_SIZE / Math.max(w, h);
    out = {
      shapes: g.s.map(st => st.pts.map(q => [(q[0] - cx) * sc, (q[1] - cy) * sc, q[2] ?? 1, q[3]] as SkelPt)),
      size: [w * k, h * k],
      scale: k,
    };
  }
  m.set(c, out);
  return out;
}
const ornShape = (th: Thuluth, m: OrnKey): OrnShape | null =>
  m.startsWith('mini:')
    ? miniSign(th, m.slice(5))
    : { shapes: ORN_SHAPES[m as Ornament], size: ORN_SIZE[m as Ornament], scale: 1 };

/** The fathas' one slant (all fathas are parallel), and the lengths they may take, in dots (a dot is the main pen's
 *  width): short, medium when the free run along the slant is at least 6, long (with the main pen) when it is 11. */
const FATHA_SLANT = Math.atan2(0.8, 1.5);
export const FATHA_DOTS = { short: 3.5, medium: 5, long: 10 } as const;
/** The density from which each mark is written (see SolveOptions.markDensity). */
const markLevel = (m: MarkName): number =>
  ['shadda', 'madda', 'hamza', 'hamzaB', 'alifk'].includes(m) ? 0 : ['sukun', 'fathatan', 'kasratan', 'dammatan'].includes(m) ? 0.25 : m === 'fatha' ? 0.75 : 0.5; // prettier-ignore

export interface SolveOptions {
  discScale?: number;
  markScale?: number;
  /** How far (in pen units) a vowel may sit from its letter (4: two and a half pens; the even-texture term would otherwise
   *  carry vowels off into the gaps, where they read as another word's or as ornament). */
  markReach?: number;
  /** Ornaments in the gaps, and how many (0–1); plume or trefoil. */
  ornaments?: boolean;
  density?: number;
  ornStyle?: 'plume' | 'trefoil';
  markIters?: number;
  /** Vowel pen, as a share of the letters'. */
  markPen?: number;
  /** The clarifying letters' pen, and the dagger alif's (shares of the letters'), and the dagger alif's size. */
  signPen?: number;
  alifPen?: number;
  alifScale?: number;
  /** Each fatha as long as the space along its slant allows (false: the short mark); the long fatha may be used. */
  fathaRule?: boolean;
  longFatha?: boolean;
  /** With ornaments: a clarifying letter under each of ح س ص ط ع ك م (false: only the small ح and س, as drawn). */
  allSigns?: boolean;
  /** Clearance as a rule: every vowel, dot group and sign keeps at least this far (pen units) from the letters and
   *  from each other; the solver pays heavily for less, and reports what it could not clear (clearFaults). */
  clearance?: number;
  /** The density of marks, from Râkım's sparse (0) to Sâmi's dense (1), as Derman describes them: below a quarter
   *  only the shadda, madda, hamza and dagger alif; then sukun and tanwin; from a half damma and kasra; from three
   *  quarters every fatha; the clarifying letters from 0.6; the ornaments' density follows it unless set. */
  markDensity?: number;
  /** The long fatha (main pen) only where it spans a gap: its centre at least two pens from any letter. */
  fathaGap?: boolean;
  /** The pen of the ornaments in the gaps, as a share of the letters' at full size (0.38; the lab drew 0.42 before
   *  the three-pen rule). */
  ornPen?: number;
  /** Ornaments only in pockets among the letters (true): ink within reach on three sides, or to both left and right.
   *  false: in the largest gaps anywhere in the field, as the lab placed them (out by the rim they read as stray
   *  dots). */
  pockets?: boolean;
  /** Ink that is not the roundel's letters but blocks marks (a companion text). */
  extraInk?: { strokes: Stroke[]; dots: Dot[] } | null;
}
export interface Solved {
  strokes: Stroke[];
  dots: Dot[];
  count: number;
  fillers: number;
  E: number;
  /** Where each item went; key is 'group:letter' for dots and vowels (the letter they belong to), m the mark's name. */
  items: { kind: string; x: number; y: number; w: number; h: number; key?: string; m?: string }[];
  /** Each fatha's length in dots, in order (0 for the plain mark). */
  fathas: number[];
  /** The clarifying letters placed. */
  signs: string[];
  /** Items left nearer the letters or each other than the clearance (0 without a clearance). */
  clearFaults: number;
}

interface Item {
  kind: 'dots' | 'mark' | 'orn';
  key?: string;
  n?: number;
  arrs?: string[];
  arr?: string;
  m?: string;
  /** A fatha's length, set by the fatha rule, and whether it is written with the main pen. */
  fathaLen?: number;
  mainPen?: boolean;
  side: number;
  w?: number;
  h?: number;
  x: number;
  y: number;
  ax: number;
  ay: number;
  lx0: number;
  lx1: number;
  top: number;
  bot: number;
  sc: number;
}

export function solveMarks(th: Thuluth, r: Roundel, o: SolveOptions = {}): Solved {
  const nib = th.style.nib,
    K = 2,
    D = r.disc,
    // the field marks may use: the disc or oval, or a shaped field's outline (fields.ts), less a margin
    FT = fieldTest(D, o.discScale || 1.18, 1.0),
    ms = o.markScale || 1.6;
  // the letters' ink (no dots), rasterised
  const x0 = FT.x0 - 4,
    x1 = FT.x1 + 4,
    y0 = FT.y0 - 4,
    y1 = FT.y1 + 4,
    Wd = Math.ceil((x1 - x0) * K),
    Hd = Math.ceil((y1 - y0) * K);
  const X = (x: number) => (x - x0) * K,
    Y = (y: number) => (y1 - y) * K,
    A = new Alpha(Wd, Hd);
  r.shapes.forEach((S, i) =>
    S.b.strokes.forEach(
      s =>
      A.fill(toPixels(th.strokePolys({ ...s, s: s.s.map(q => ({ x: q.x + r.st[i].x, y: q.y + r.st[i].y, w: q.w })) }, 1.35), X, Y)), // prettier-ignore
    ),
  );
  if (o.extraInk) {
    // the companion text is an obstacle too
    o.extraInk.strokes.forEach(s => A.fill(toPixels(th.strokePolys(s, 1.5), X, Y)));
    o.extraInk.dots.forEach(d => A.fill(toPixels(th.dotPolysAt(d[0], d[1], (d[2] || 1) * 1.5), X, Y)));
  }
  const ink = A.mask(60);
  // distance from every cell to the nearest ink (chamfer), to measure the gaps
  const dist = new Float32Array(Wd * Hd);
  for (let i = 0; i < Wd * Hd; i++) dist[i] = ink[i] ? 0 : 1e6;
  for (let y = 0; y < Hd; y++)
    for (let x = 0; x < Wd; x++) {
      const i = y * Wd + x;
      if (x) dist[i] = Math.min(dist[i], dist[i - 1] + 1);
      if (y) dist[i] = Math.min(dist[i], dist[i - Wd] + 1);
      if (x && y) dist[i] = Math.min(dist[i], dist[i - Wd - 1] + 1.414);
      if (y && x < Wd - 1) dist[i] = Math.min(dist[i], dist[i - Wd + 1] + 1.414);
    }
  for (let y = Hd - 1; y >= 0; y--)
    for (let x = Wd - 1; x >= 0; x--) {
      const i = y * Wd + x;
      if (x < Wd - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1);
      if (y < Hd - 1) dist[i] = Math.min(dist[i], dist[i + Wd] + 1);
      if (x < Wd - 1 && y < Hd - 1) dist[i] = Math.min(dist[i], dist[i + Wd + 1] + 1.414);
      if (y < Hd - 1 && x) dist[i] = Math.min(dist[i], dist[i + Wd - 1] + 1.414);
    }
  const inkHits = (cx: number, cy: number, w: number, h: number) => {
    const ax = Math.floor(X(cx - w / 2)),
      bx = Math.ceil(X(cx + w / 2)),
      ay = Math.floor(Y(cy + h / 2)),
      by = Math.ceil(Y(cy - h / 2));
    let c = 0;
    for (let y = ay; y <= by; y++)
      for (let x = ax; x <= bx; x++) {
        if (x < 0 || y < 0 || x >= Wd || y >= Hd) {
          c++;
          continue;
        }
        if (ink[y * Wd + x]) c++;
      }
    return c;
  };
  // the items: vowel marks, dot groups and (optionally) muhmal signs
  const items: Item[] = [];
  r.shapes.forEach((S, i) => {
    const g = r.groups[i],
      sc = g.sc || 1,
      ox = r.st[i].x,
      oy = r.st[i].y;
    const letterBox = (li: number) => {
      const p = S.b.placed.find(q => isLetter(q) && q.li === li);
      if (!p || !isLetter(p)) return null;
      const pts = p.g.s.flatMap(st => st.pts.map(q => [q[0] * sc + p.ox + ox, q[1] * sc + (p.oy || 0) + oy]));
      return { lx: pts.reduce((a, q) => a + q[0], 0) / pts.length, x0: Math.min(...pts.map(q => q[0])), x1: Math.max(...pts.map(q => q[0])), top: Math.max(...pts.map(q => q[1])), bot: Math.min(...pts.map(q => q[1])), c: p.c }; // prettier-ignore
    };
    S.b.dotGroups.forEach(dg => {
      const n = dg.n,
        // three dots keep their triangle: one over two above a letter (shin), two over one below
        arrs = n === 3 ? [dg.side > 0 ? 'up' : 'down'] : DOT_ARR[n] || ['h'];
      items.push({ kind: 'dots', key: i + ':' + dg.li, n, arrs, arr: arrs[0], side: dg.side, x: dg.x + ox, y: dg.y + oy, ax: dg.x + ox, ay: dg.y + oy, lx0: dg.x0 + ox, lx1: dg.x1 + ox, top: dg.top + oy, bot: dg.bot + oy, sc: dg.sc || 1 }); // prettier-ignore
    });
    const byLetter: Record<number, MarkName[]> = {};
    (g.marks || []).filter(m => o.markDensity == null || o.markDensity >= markLevel(m.m)).forEach(m => (byLetter[m.k] ??= []).push(m.m)); // prettier-ignore
    Object.entries(byLetter).forEach(([k, list]) => {
      const L = letterBox(+k);
      if (!L) return;
      list.sort((a, b) => (a === 'shadda' ? -1 : b === 'shadda' ? 1 : 0));
      list.forEach((m, j) => {
        const [w0, h0] = MARK_SIZE[m] || [1.4, 1.2],
          below = BELOW.has(m),
          w = w0 * ms * sc,
          h = h0 * ms * sc;
        const ay = below ? L.bot - h / 2 - 0.5 * sc : Math.max(L.top, oy + 2.2 * sc) + h / 2 + 0.5 * sc + j * 1.2 * sc;
        items.push({ kind: 'mark', key: i + ':' + k, m, side: below ? -1 : 1, w, h, x: L.lx, y: ay, ax: L.lx, ay, lx0: L.x0, lx1: L.x1, top: L.top, bot: L.bot, sc }); // prettier-ignore
      });
    });
    if (o.ornaments && (o.markDensity == null || o.markDensity >= 0.6))
      [...g.s].forEach((c, li) => {
        const sign: OrnKey | null =
          o.allSigns === false
            ? c === 'ح' ? 'minihah' : c === 'س' ? 'minisin' : null
            : CLARIFY.has(c) ? (miniSign(th, c) ? `mini:${c}` : c === 'ح' ? 'minihah' : c === 'س' ? 'minisin' : null) : null; // prettier-ignore
        if (!sign) return;
        const L = letterBox(li);
        if (!L) return;
        const [w0, h0] = ornShape(th, sign)!.size,
          w = w0 * sc,
          h = h0 * sc,
          ay = L.bot - h / 2 - 0.6 * sc;
        items.push({ kind: 'orn', m: sign, side: -1, w, h, x: L.lx, y: ay, ax: L.lx, ay, lx0: L.x0, lx1: L.x1, top: L.top, bot: L.bot, sc }); // prettier-ignore
      });
  });
  // (a dots item's box is kept until its arrangement changes: the same numbers, without measuring again)
  const boxes = new WeakMap<Item, { arr: unknown; n: number; sc: number; box: [number, number] }>();
  const boxOf = (it: Item): [number, number] => {
    if (it.kind !== 'dots') return [it.w!, it.h!];
    const kept = boxes.get(it);
    if (kept && kept.arr === it.arr && kept.n === it.n && kept.sc === it.sc) return kept.box;
    const box = measure(it);
    boxes.set(it, { arr: it.arr, n: it.n!, sc: it.sc, box });
    return box;
  };
  const measure = (it: Item): [number, number] => {
    const off = dotOffsets(it.n!, it.arr!, nib * it.sc),
      xs = off.map(q => q[0]),
      ys = off.map(q => q[1]);
    return [
      Math.max(...xs) - Math.min(...xs) + nib * it.sc * 1.1,
      Math.max(...ys) - Math.min(...ys) + nib * it.sc * 1.1,
    ];
  };
  // where an item may go: on its letter's side, within reach of the letter, inside the disc
  const allowed = (it: Item) => {
    const [w, h] = boxOf(it),
      reach = (it.kind === 'dots' ? 1.6 : 3.0) * it.sc;
    // dots stand over (or under) their letter's centre and close to it; vowels stay roughly over their letter
    if (it.kind === 'dots' && (Math.abs(it.x - it.ax) > 0.35 * it.sc || Math.abs(it.y - it.ay) > 1.4 * it.sc))
      return false;
    if (it.kind === 'mark' && Math.abs(it.x - (it.lx0 + it.lx1) / 2) > (it.lx1 - it.lx0) / 2 + 1.0 * it.sc)
      return false;
    // a clearance asked for needs room: the reach grows with it
    const reachV = (o.markReach ?? 4) + 4 * (o.clearance ?? 0);
    if (it.kind === 'mark' && reachV && (it.side > 0 ? it.y - h / 2 - Math.max(it.top, it.ay - h / 2 - 0.5 * it.sc) : Math.min(it.bot, it.ay + h / 2) - (it.y + h / 2)) > reachV * it.sc) return false; // prettier-ignore
    if (it.x < it.lx0 - reach || it.x > it.lx1 + reach) return false;
    if (it.side > 0 ? it.y - h / 2 < Math.min(it.top, it.ay - h / 2) - (it.kind === 'dots' ? 1.2 : 0.2) * it.sc : it.y + h / 2 > Math.max(it.bot, it.ay + h / 2) + (it.kind === 'dots' ? 1.2 : 0.2) * it.sc) return false; // prettier-ignore
    return FT.inside(it.x, it.y, Math.hypot(w, h) / 2);
  };
  // gaps: on a coarse grid inside the disc, the distance to the nearest ink or mark
  const cells: [number, number, number][] = [];
  for (let gy = FT.y0 + 0.7; gy < FT.y1; gy += 1.4)
    for (let gx = FT.x0 + 0.7; gx < FT.x1; gx += 1.4)
      if (FT.inside(gx, gy, 0.7)) {
        const ix = Math.round(X(gx)),
          iy = Math.round(Y(gy));
        cells.push([gx, gy, ix >= 0 && iy >= 0 && ix < Wd && iy < Hd ? dist[iy * Wd + ix] / K : 0]);
      }
  // each item's clearance to every cell, measured lazily (an entry is good while its stamp matches its item's); an
  // annealing step moves one item, and only the cells it could now be nearest to, or was nearest to, are measured
  // again: the same distances and the same exact minimum, at a fraction of the work
  const nC = cells.length,
    nI = items.length,
    CX = Float64Array.from(cells, q => q[0]),
    CY = Float64Array.from(cells, q => q[1]),
    CB = Float64Array.from(cells, q => q[2]),
    rowX = new Float64Array(nI).fill(NaN),
    rowY = new Float64Array(nI),
    rowR = new Float64Array(nI),
    ver = new Int32Array(nI),
    // the same measure in WebAssembly (src/kernels/roundel.c), when it loads; the tables below are the TypeScript's
    GK = gapKernel(CX, CY, CB, nI),
    big = GK ? 0 : nI * nC,
    rows = new Float64Array(big),
    stamp = new Int32Array(big).fill(-1),
    // each cell's nearest (the minimum, and which item gives it: -1 for the ink)
    cellMin = new Float64Array(nC),
    cellArg = new Int32Array(nC);
  let fresh = true;
  const clearance = (c: number, k: number) => {
    const o = c * nI + k;
    if (stamp[o] !== ver[k]) {
      rows[o] = Math.max(0, Math.hypot(CX[c] - rowX[k], CY[c] - rowY[k]) - rowR[k]);
      stamp[o] = ver[k];
    }
    return rows[o];
  };
  const rescan = (c: number) => {
    let d = CB[c],
      a = -1;
    for (let j = 0; j < nI; j++) {
      const v = clearance(c, j);
      if (v < d) {
        d = v;
        a = j;
      }
    }
    cellMin[c] = d;
    cellArg[c] = a;
  };
  // item k has moved: of every cell, those it could now be nearest to (judged on squares, with room to spare) or was
  // nearest to are measured again; the rest wait until a measure is needed
  const moved = (k: number) => {
    const x = rowX[k],
      y = rowY[k],
      r = rowR[k];
    for (let c = 0; c < nC; c++) {
      const dx = CX[c] - x,
        dy = CY[c] - y,
        reach = cellMin[c] + r + 1e-6;
      if (cellArg[c] !== k && dx * dx + dy * dy > reach * reach * (1 + 1e-9)) continue;
      const v = clearance(c, k);
      if (v < cellMin[c]) {
        cellMin[c] = v;
        cellArg[c] = k;
      } else if (cellArg[c] === k && v > cellMin[c]) rescan(c); // the nearest item moved away: look again
    }
  };
  const gapCost = () => {
    let e2 = 0;
    for (let k = 0; k < nI; k++) {
      const it = items[k],
        [w, h] = boxOf(it),
        r = Math.hypot(w, h) / 2;
      if (it.x === rowX[k] && it.y === rowY[k] && r === rowR[k]) continue;
      rowX[k] = it.x;
      rowY[k] = it.y;
      rowR[k] = r;
      if (GK) GK.move(k, it.x, it.y, r, fresh);
      else {
        ver[k]++;
        if (!fresh) moved(k);
      }
    }
    if (fresh) {
      fresh = false;
      if (GK) GK.rescanAll();
      else for (let c = 0; c < nC; c++) rescan(c);
    }
    if (GK) return GK.sum();
    for (let c = 0; c < nC; c++) {
      const d = cellMin[c];
      if (d > 1.6) e2 += (d - 1.6) ** 2;
    }
    return e2 / Math.max(1, nC);
  };
  const clear = o.clearance ?? 0;
  const itemCost = (it: Item) => {
    const [w, h] = boxOf(it);
    return (
      30 * inkHits(it.x, it.y, w + 0.5, h + 0.5) +
      (clear ? 200 * inkHits(it.x, it.y, w + 2 * clear, h + 2 * clear) : 0) +
      (0.5 * ((it.x - it.ax) ** 2 + (it.y - it.ay) ** 2)) / (it.sc * it.sc)
    );
  };
  const pairCost = () => {
    let c = 0;
    for (let a = 0; a < items.length; a++)
      for (let b = a + 1; b < items.length; b++) {
        const A2 = items[a],
          B = items[b],
          [wa, ha] = boxOf(A2),
          [wb, hb] = boxOf(B);
        const m = Math.max(0.4, clear),
          ox2 = Math.min(A2.x + wa / 2, B.x + wb / 2) - Math.max(A2.x - wa / 2, B.x - wb / 2) + m,
          oy2 = Math.min(A2.y + ha / 2, B.y + hb / 2) - Math.max(A2.y - ha / 2, B.y - hb / 2) + m;
        if (ox2 > 0 && oy2 > 0) c += (clear ? 200 : 40) * ox2 * oy2;
      }
    return c;
  };
  // a vowel on the same side of the same letter as its dots sits beyond them, further from the letter
  const orderCost = () => {
    let c = 0;
    items.forEach(v => {
      if (v.kind !== 'mark') return;
      items.forEach(d => {
        if (d.kind !== 'dots' || d.key !== v.key || d.side !== v.side) return;
        const [, hv] = boxOf(v),
          [, hd] = boxOf(d),
          gap = v.side > 0 ? v.y - hv / 2 - (d.y + hd / 2) : d.y - hd / 2 - (v.y + hv / 2);
        if (gap < 0.2) c += 60 * (0.2 - gap) + 20;
      });
    });
    return c;
  };
  const energy = () => items.reduce((a, it) => a + itemCost(it), 0) + pairCost() + orderCost() + 8 * gapCost();
  // start from the plain positions, nudged into free space, then search
  let sd = 12345;
  const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  items.forEach(v => {
    if (v.kind !== 'mark') return;
    const d = items.find(q => q.kind === 'dots' && q.key === v.key && q.side === v.side);
    if (!d) return;
    const [, hd] = boxOf(d);
    if (v.side > 0) v.y = v.ay = Math.max(v.ay, d.y + hd / 2 + v.h! / 2 + 0.35);
    else v.y = v.ay = Math.min(v.ay, d.y - hd / 2 - v.h! / 2 - 0.35);
  });
  items.forEach(it => {
    if (!allowed(it)) {
      it.x = it.ax;
      it.y = it.ay;
    }
  });
  let E = energy(),
    T = 6;
  const iters = o.markIters || 2500;
  for (let t = 0; t < iters && items.length; t++) {
    const it = items[Math.floor(R() * items.length)],
      old = { x: it.x, y: it.y, arr: it.arr };
    if (it.kind === 'dots' && R() < 0.2 && it.arrs!.length > 1) it.arr = it.arrs![Math.floor(R() * it.arrs!.length)];
    else {
      const s = (T > 1 ? 1.2 : 0.5) * it.sc;
      it.x += (R() - 0.5) * 2 * s;
      it.y += (R() - 0.5) * 2 * s;
    }
    if (!allowed(it)) {
      Object.assign(it, old);
      continue;
    }
    const E2 = energy();
    if (E2 <= E || R() < Math.exp((E - E2) / T)) E = E2;
    else Object.assign(it, old);
    T = Math.max(0.02, T * Math.pow(0.02 / 6, 1 / iters));
  }
  // ornaments in the largest gaps that remain, as many as the density asks for. A gap is a pocket among the letters,
  // with ink within reach on three sides, or to both left and right (between two words on a line): the open field by
  // the rim is not a gap, and an ornament set there reads as a stray dot
  const fillers: { m: Ornament; x: number; y: number; w: number; h: number; sz: number }[] = [];
  if (o.ornaments) {
    const density = o.density ?? o.markDensity ?? 0.5,
      thresh = 3.2 - 1.6 * density,
      maxN = Math.round(2 + 10 * density),
      reach = 6 * nib,
      enclosed = (gx: number, gy: number) => {
        let hits = 0,
          across = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          // prettier-ignore
          for (let s = 0.5; s <= reach; s += 0.5) {
            const ix = Math.round(X(gx + dx * s)),
              iy = Math.round(Y(gy + dy * s));
            if (ix < 0 || iy < 0 || ix >= Wd || iy >= Hd) break;
            if (ink[iy * Wd + ix]) {
              hits++;
              if (dy === 0) across++;
              break;
            }
          }
        return hits >= 3 || across === 2;
      },
      pockets = o.pockets === false ? cells : cells.filter(([gx, gy]) => enclosed(gx, gy));
    for (let n2 = 0; n2 < maxN; n2++) {
      let best: [number, number, number] | null = null;
      for (const [gx, gy, d0] of pockets) {
        let d = d0;
        for (const it of [...items, ...fillers]) {
          const [w, h] = 'kind' in it ? boxOf(it) : [it.w, it.h];
          d = Math.min(d, Math.max(0, Math.hypot(gx - it.x, gy - it.y) - Math.hypot(w, h) / 2));
        }
        // in a shaped field an ornament keeps its whole size inside the outline (its pointed or narrow parts)
        if (D.field) d = Math.min(d, FT.room(gx, gy));
        if (!best || d > best[2]) best = [gx, gy, d];
      }
      if (!best || best[2] < thresh) break;
      // only the trefoil or plume: the tirnak looked like a stray fatha; ornaments stay about a vowel's size
      const m: Ornament = o.ornStyle === 'trefoil' ? 'tirfil' : 'plume',
        [w, h] = ORN_SIZE[m],
        sz = Math.min(0.85, best[2] / 2.8);
      fillers.push({ m, x: best[0], y: best[1], w: w * sz, h: h * sz, sz });
    }
  }
  // the shadda and the dagger alif over one letter (as in الله) are one compound mark: the alif stands on the shadda
  items.forEach(it => {
    if (it.kind !== 'mark' || it.m !== 'alifk') return;
    const sh = items.find(q => q.kind === 'mark' && q.m === 'shadda' && q.key === it.key);
    if (!sh) return;
    const [, hs] = boxOf(sh),
      [, ha] = boxOf(it);
    it.x = sh.x + 0.1 * nib;
    it.y = sh.y + hs / 2 + ha / 2 - 0.15 * nib;
  });
  // each fatha as long as the space along its slant allows: the free run is measured both ways from its centre (stopped
  // by letter ink within 0.9 of a pen, the field's edge, other marks, dots and ornaments), and the fatha is centred in it
  if (o.fathaRule !== false) {
    const dx = Math.cos(FATHA_SLANT),
      dy = Math.sin(FATHA_SLANT),
      reach = 7 * nib;
    const blocked = (x: number, y: number, self: Item) => {
      const gx = Math.round(X(x)),
        gy = Math.round(Y(y));
      if (gx < 0 || gy < 0 || gx >= Wd || gy >= Hd || dist[gy * Wd + gx] < nib * 0.9 * K) return true;
      if (!FT.inside(x, y)) return true;
      const near = (cx: number, cy: number, w: number, h: number) => Math.abs(x - cx) < w / 2 + 0.3 && Math.abs(y - cy) < h / 2 + 0.3; // prettier-ignore
      return items.some(q => q !== self && near(q.x, q.y, ...boxOf(q))) || fillers.some(f => near(f.x, f.y, f.w, f.h));
    };
    items.forEach(it => {
      if (it.kind !== 'mark' || it.m !== 'fatha') return;
      const run = [1, -1].map(sg => {
        let s2 = 0.4;
        while (s2 < reach && !blocked(it.x + sg * dx * s2, it.y + sg * dy * s2, it)) s2 += 0.25;
        return s2;
      });
      // the long fatha spans a gap: with fathaGap, only where its centre stands two pens clear of the letters
      const free = run[0] + run[1],
        gx = Math.round(X(it.x)),
        gy = Math.round(Y(it.y)),
        spans = !o.fathaGap || (gx >= 0 && gy >= 0 && gx < Wd && gy < Hd && dist[gy * Wd + gx] / K >= 2 * nib),
        len = free >= 11 * nib && o.longFatha !== false && spans ? FATHA_DOTS.long : free >= 6 * nib ? FATHA_DOTS.medium : FATHA_DOTS.short; // prettier-ignore
      it.fathaLen = len * nib;
      it.mainPen = len === FATHA_DOTS.long;
      // centred in its free run where the run is lopsided, so the longer stroke stays clear on both sides
      const lo = it.fathaLen / 2 - run[1],
        hi = run[0] - it.fathaLen / 2,
        shift = lo <= hi ? Math.max(lo, Math.min(hi, 0)) : (run[0] - run[1]) / 2;
      it.x += dx * shift;
      it.y += dy * shift;
    });
  }
  // drawn: vowels and ornaments with a third of the pen, the clarifying letters with a little less, the dagger alif
  // with half at the stems' angle, long fathas with the full pen; dots as rhombs of the full pen
  const strokes: Stroke[] = [],
    dots: Dot[] = [];
  items.forEach(it => {
    const tint = it.key != null ? r.groups[+it.key.split(':')[0]]?.tint : undefined;
    if (it.kind === 'dots') {
      dotOffsets(it.n!, it.arr!, nib * it.sc).forEach(([dx, dy]) => dots.push([it.x + dx, it.y + dy, it.sc, 0, tint]));
      return;
    }
    if (it.fathaLen) {
      // a straight fatha of the chosen length, thinning at both ends
      const L = it.fathaLen / 2,
        cx = Math.cos(FATHA_SLANT) * L,
        sy = Math.sin(FATHA_SLANT) * L,
        pen = it.mainPen ? 1 : (o.markPen || MARK_PEN) * 1.15;
      strokes.push({ tint, mark: true, ang: 70, nib: nib * pen * it.sc, s: sampleStroke([[it.x + cx, it.y + sy, 0.3], [it.x + cx * 0.5, it.y + sy * 0.5, 1], [it.x - cx * 0.6, it.y - sy * 0.6, 1], [it.x - cx, it.y - sy, 0.35]], th.style.tension) }); // prettier-ignore
      return;
    }
    const orn = it.kind === 'orn' ? ornShape(th, it.m as OrnKey) : null,
      alif = it.m === 'alifk',
      shapes = orn ? orn.shapes : MARK_SHAPES[it.m as MarkName],
      s2 = orn ? it.sc * orn.scale : ms * it.sc * (alif ? (o.alifScale ?? ALIF_SCALE) : 1),
      pen = orn
        ? it.m!.startsWith('mini:') ? (o.signPen ?? SIGN_PEN) : MARK_PEN * 1.3
        : alif ? (o.alifPen ?? ALIF_PEN) : (o.markPen || MARK_PEN); // prettier-ignore
    (shapes || []).forEach(
      sh =>
      strokes.push({ tint, mark: true, ang: alif ? ALIF_ANG : 70, nib: nib * pen * it.sc, s: sampleStroke(sh.map(([a2, b2, ww, c]) => [it.x + a2 * s2, it.y + b2 * s2, ww ?? 1, c] as SkelPt), th.style.tension) }), // prettier-ignore
    );
  });
  fillers.forEach(f =>
    ORN_SHAPES[f.m].forEach(
      sh =>
      strokes.push({ mark: true, orn: true, ang: 70, nib: nib * (o.ornPen ?? 0.38) * f.sz, s: sampleStroke(sh.map(([a2, b2, ww, c]) => [f.x + a2 * f.sz, f.y + b2 * f.sz, ww ?? 1, c] as SkelPt), th.style.tension) }), // prettier-ignore
    ),
  );
  return {
    strokes,
    dots,
    count: items.length,
    fillers: fillers.length,
    fathas: items.filter(it => it.m === 'fatha').map(it => (it.fathaLen ? +(it.fathaLen / nib).toFixed(1) : 0)),
    signs: items.filter(it => it.kind === 'orn').map(it => it.m!),
    clearFaults: clear
      ? items.filter((it, a) => {
          const [w, h] = boxOf(it);
          if (inkHits(it.x, it.y, w + 2 * clear, h + 2 * clear) > 0) return true;
          return items.some((q, b) => {
            if (a === b) return false;
            const [w2, h2] = boxOf(q);
            return Math.abs(it.x - q.x) < (w + w2) / 2 + clear && Math.abs(it.y - q.y) < (h + h2) / 2 + clear;
          });
        }).length
      : 0,
    E,
    items: items.map(it => {
      const [w, h] = boxOf(it);
      return { kind: it.kind, x: it.x, y: it.y, w, h, key: it.key, m: it.m };
    }),
  };
}
