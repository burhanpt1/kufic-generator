// Text bands along any outline (lab composeShape / fitRing). The complete-text rule: a band holds its text a whole
// number of times; the fit is found by searching letter scale and repeat count together for the least slack, never
// by cutting the text. Groups go round the outline clockwise from the bottom: runs are stored counter-clockwise, so
// group g sits on run (G − g) % G.
import { frameAt, runMinRadius } from '../geometry/runs';
import type { ShapeGeometry } from '../geometry/shape';
import type { Pt, Run } from '../geometry/types';
import { greedyOK, partition } from '../layout/solvers';
import type { Segs } from '../types';
import { repeat } from '../script/kufi';
import type { LayoutOptions, Prepared, ScriptEngine, Segments, Strip } from '../script/types';
import type { Style } from '../model/schema';
import type { StripPlace } from './placed';

/** Empty rows a text band keeps below its letters (`bot`) and above them (`top`), in cells at the letter scale. */
export interface BandPad {
  bot: number;
  top: number;
}
export const NO_PAD: BandPad = { bot: 0, top: 0 };
/** Ink may come no nearer a band's edge (its separator, or the outline) than this, in cells. */
export const EDGE_CLEAR = 0.5;
/** The tallest ink should end at about this share of the band's height (the rest is headroom). */
const INK_SHARE = 0.86;

/** How far ink can reach past its cell's edge, in cells: a stem ending rises above its cell (render/prims
 *  termCmds, upwards only), and strokes wider than a cell overshoot it. */
export function inkReach(terminal: Style['terminals']['kind'], weight: number): { up: number; out: number } {
  const out = Math.max(0, weight / 2 - 0.5),
    k = 0.8 + 0.4 * weight,
    tip = terminal === 'leaf' ? 0.3 + 1.05 * k : terminal === 'palmette' ? 0.3 + k : terminal === 'bevel' ? 0.72 : terminal === 'notch' ? 0.62 : 0;
  return { up: Math.max(out, tip - 0.5), out };
} // prettier-ignore

/** Headroom for a band of Hb letter rows: at least EDGE_CLEAR beyond any ink on both sides, and the tallest ink
 *  ending at about INK_SHARE of the band's height. */
export function bandPad(Hb: number, style: Pick<Style, 'terminals' | 'stroke'>): BandPad {
  const r = inkReach(style.terminals.kind, style.stroke.weight),
    bot = Math.ceil(EDGE_CLEAR + r.out - 1e-9),
    top = Math.max(Math.ceil(EDGE_CLEAR + r.up - 1e-9), Math.ceil((bot + Hb) / INK_SHARE - (bot + Hb) - 1e-9));
  return { bot, top };
}

/** A prepared line as the band sees it: its height includes the headroom. */
export const padded = (p: Prepared, pad: BandPad): Prepared =>
  pad.bot || pad.top ? { ...p, Hb: p.Hb + pad.bot + pad.top } : p;

/** Shift a laid-out strip up by pad.bot rows inside a band pad.top rows taller. */
export function padStrip(st: Strip, pad: BandPad): Strip {
  if (!pad.bot && !pad.top) return st;
  const Hb = st.Hb + pad.bot + pad.top;
  if (st.kind === 'vector') return { ...st, Hb, base: st.base + pad.bot }; // a cursive engine's paths would shift too
  const data = new Uint8Array(st.W * Hb),
    tag = new Uint8Array(st.W * Hb);
  data.set(st.data, pad.bot * st.W);
  tag.set(st.tag, pad.bot * st.W);
  return { ...st, Hb, base: st.base + pad.bot, data, tag };
}

export interface BandGeom {
  kind: 'circle' | 'closed' | 'runs';
  /** Circle: outer radius in cells. */
  R: number;
  runs: Run[];
}

export function bandGeom(shape: ShapeGeometry, size: number, inset: number): BandGeom | null {
  if (shape.kind === 'circle') {
    const R = size - inset;
    return R > 0 ? { kind: 'circle', R, runs: [] } : null;
  }
  const ring = shape.ring(size, inset);
  if (!ring) return null;
  const runs = shape.runs(size, inset);
  return { kind: runs.length === 1 && !runs[0].start ? 'closed' : 'runs', R: 0, runs };
}

/** A run may curve no tighter than this many band heights (radius of curvature). */
export const MIN_CURVE = 1.25;

/** Capacity (strip width in cells) of each run at letter scale s, or null if the band doesn't fit. */
export function capacities(bg: BandGeom, Hb: number, s: number): number[] | null {
  if (bg.kind === 'circle') {
    const r = bg.R / s;
    if (r - Hb < Math.max(3, Hb * 0.9)) return null;
    return [Math.round(2 * Math.PI * (r - Hb / 2)) - 1];
  }
  // letters fan out on a curve tighter than the band is tall: no ring there at this size
  if (bg.runs.some(rn => runMinRadius(rn) < Hb * s * MIN_CURVE)) return null;
  if (bg.kind === 'closed') return [Math.floor(bg.runs[0].len / s) - 1];
  return bg.runs.map(rn => Math.floor((rn.len - Hb * s * (rn.start!.clearance + rn.end!.clearance) - s) / s));
}

export interface RingFit {
  s: number;
  rep: number;
  groups: Segs[];
  caps: number[];
  mode: 'words' | 'breaks';
  score: number;
}

export interface FitOptions {
  /** Target letter scale; the search runs from 0.7× to 1.3× of it (within 0.36 … 1.15). */
  sTarget: number;
  /** Fixed scale instead of a search. */
  fixed?: number;
  once: boolean;
  wordGap: number;
  /** Largest scale at which the band's inner edge still exists. */
  sMax: number;
}

/** Runs too short to hold any segment may stay empty (just the band) when they add up to no more than this share of
 *  the ring's length: a silhouette's finial or notch shouldn't force the whole composition larger. */
const MAX_SKIP = 0.35;
/** A run counts as a small feature (a finial, a notch) when it is under this share of the ring's length. */
const TINY_RUN = 0.08;
/** Score cost per unit of skipped length share. */
const SKIP_COST = 1.5;

/** The runs (in reading order) that take text at these capacities, and the skipped share of the ring's length; null
 *  when too much would be skipped. All runs take text whenever every one can hold a segment. */
function usableRuns(bg: BandGeom, c: number[], minSeg: number): { ord: number[]; skip: number } | null {
  const G = c.length,
    ord = Array.from({ length: G }, (_, g) => g),
    need = Math.max(2, minSeg);
  if (c.every(x => x >= need)) return { ord, skip: 0 };
  if (bg.kind !== 'runs') return c.every(x => x >= 2) ? { ord, skip: 0 } : null;
  const ok = (g: number) => c[(G - g) % G] >= need,
    total = bg.runs.reduce((a, r) => a + r.len, 0),
    len = (g: number) => bg.runs[(G - g) % G].len;
  // only small features of the outline may stay empty, whatever the size: a long run that is merely short at this
  // scale must take text, as before
  if (ord.some(g => !ok(g) && len(g) > TINY_RUN * total)) return null;
  const skipped = ord.filter(g => !ok(g)).reduce((a, g) => a + len(g), 0),
    use = ord.filter(ok);
  return use.length && skipped <= MAX_SKIP * total ? { ord: use, skip: skipped / total } : null;
}

/** Best (scale, repeats) for one ring. */
export function fitRing(bg: BandGeom, script: ScriptEngine, prepared: Prepared, o: FitOptions): RingFit | null {
  let best: RingFit | null = null;
  const hi = Math.min(o.sMax, Math.min(1.15, o.sTarget * 1.3)),
    lo = Math.max(0.36, o.sTarget * 0.7);
  if (!o.fixed && hi < lo) return null; // the band can't be drawn at an acceptable size here
  const scales = o.fixed ? [o.fixed] : Array.from({ length: 29 }, (_, i) => hi - (i * (hi - lo)) / 28);
  for (const mode of ['words', 'breaks'] as const) {
    const segs0 = script.segments(prepared, mode, o.wordGap) as Segs;
    if (!segs0.length) return null;
    const one = segs0.reduce((a, x) => a + x.minW, 0) + o.wordGap * segs0.length,
      minSeg = Math.min(...segs0.map(x => x.minW));
    for (const s of scales) {
      const c = capacities(bg, prepared.Hb, s);
      if (!c) continue;
      const use = usableRuns(bg, c, minSeg);
      if (!use) continue;
      const G = c.length,
        cOrd = use.ord.map(g => c[(G - g) % G]),
        sum = cOrd.reduce((a, b) => a + b, 0);
      const rep0 = Math.max(1, Math.ceil(cOrd.length / segs0.length)),
        repMax = o.once ? rep0 : 14;
      if (o.once && rep0 > 1) continue;
      for (let rep = rep0; rep <= repMax; rep++) {
        if (rep * one - o.wordGap > sum + 1) break;
        const p = partition(repeat(segs0, rep), cOrd);
        if (!p) continue;
        const score =
          p.score +
          (o.fixed ? 0 : (0.5 * Math.abs(s - o.sTarget)) / o.sTarget) +
          (mode === 'breaks' ? 0.15 : 0) +
          SKIP_COST * use.skip;
        if (!best || score < best.score) {
          // groups in reading order for every run; skipped runs get none
          const groups: Segs[] = Array.from({ length: G }, () => [] as unknown as Segs);
          use.ord.forEach((g, k) => (groups[g] = p.groups[k] as Segs));
          best = { s, rep, groups, caps: c, mode, score };
        }
      }
    }
    if (best) break; // whole words worked
  }
  return best;
}

/** Does the text fit once at scale 1 (the auto-size test)? */
export function fitsAtFullSize(bg: BandGeom, script: ScriptEngine, prepared: Prepared, wordGap: number): boolean {
  const c = capacities(bg, prepared.Hb, 1);
  if (!c) return false;
  for (const mode of ['words', 'breaks'] as const) {
    const segs = script.segments(prepared, mode, wordGap) as Segs,
      use = usableRuns(bg, c, Math.min(...segs.map(x => x.minW)));
    if (!use) continue;
    const G = c.length,
      cOrd = use.ord.map(g => c[(G - g) % G]),
      need = Math.max(1, Math.ceil(cOrd.length / segs.length));
    if (greedyOK(repeat(segs, need), use.skip ? cOrd : c)) return true;
  }
  return false;
}

/** Lay out a fitted ring: one strip per run, with its placement. `prepared` is the unpadded line (the fit was made
 *  with it padded); each strip gets the headroom rows. */
export function layRing(
  bg: BandGeom,
  fit: RingFit,
  script: ScriptEngine,
  prepared: Prepared,
  opts: Omit<LayoutOptions, 'wrap'>,
  pad: BandPad = NO_PAD,
): { strip: Strip; place: StripPlace; group: number; run: number }[] {
  const G = fit.caps.length,
    s = fit.s,
    Hb = prepared.Hb + pad.bot + pad.top,
    out: { strip: Strip; place: StripPlace; group: number; run: number }[] = [];
  for (let gi = 0; gi < G; gi++) {
    const gg = (G - gi) % G,
      W = fit.caps[gi];
    if (!fit.groups[gg]?.length) continue; // a run too short for text stays empty
    const laid = script.layout(fit.groups[gg] as Segments, prepared, W, { ...opts, wrap: bg.kind !== 'runs' });
    if (!laid) continue;
    const strip = padStrip(laid, pad);
    let place: StripPlace;
    if (bg.kind === 'circle') place = { type: 'arc', C: [0, 0], R: bg.R / s, N: W + 1, s, rot: 0 };
    else if (bg.kind === 'closed') {
      const rn = bg.runs[0];
      place = { type: 'run', pts: rn.pts, cum: rn.cum, off: 0, sx: rn.len / (W + 1), s };
    } else {
      const rn = bg.runs[gi],
        cA = rn.start!.clearance,
        cB = rn.end!.clearance,
        usable = rn.len - Hb * s * (cA + cB),
        off = Hb * s * cA + (usable - W * s) / 2;
      if (rn.pts.length === 2) {
        const f = frameAt(rn, 0),
          O: Pt = [rn.pts[0][0] + f.t[0] * off, rn.pts[0][1] + f.t[1] * off];
        place = { type: 'line', O, t: f.t, n: f.n, s };
      } else place = { type: 'run', pts: rn.pts, cum: rn.cum, off, sx: s, s };
    }
    out.push({ strip, place, group: gg, run: gi });
  }
  return out;
}

/** Strip (x, y) -> canvas point for a placement. */
export function placeMap(place: StripPlace): (x: number, y: number) => Pt {
  switch (place.type) {
    case 'line': {
      const { O, t, n, s } = place;
      return (x, y) => [O[0] + (x * t[0] + y * n[0]) * s, O[1] + (x * t[1] + y * n[1]) * s];
    }
    case 'arc': {
      const { C, R, N, s, rot } = place;
      return (x, y) => {
        const a = rot + Math.PI / 2 + (2 * Math.PI * (N - x)) / N,
          r = (R - y) * s;
        return [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)];
      };
    }
    case 'run': {
      const run: Run = { pts: place.pts, cum: place.cum, len: place.cum[place.cum.length - 1], start: null, end: null };
      return (x, y) => {
        const f = frameAt(run, place.off + x * place.sx);
        return [f.p[0] + f.n[0] * y * place.s, f.p[1] + f.n[1] * y * place.s];
      };
    }
  }
}
