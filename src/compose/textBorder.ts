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
import type { StripPlace } from './placed';

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

/** Capacity (strip width in cells) of each run at letter scale s, or null if the band doesn't fit. room = the band's
 *  depth in cells (letters plus headroom), Hb by default. */
export function capacities(bg: BandGeom, Hb: number, s: number, room = Hb): number[] | null {
  if (bg.kind === 'circle') {
    const r = bg.R / s;
    if (r - room < Math.max(3, room * 0.9)) return null;
    return [Math.round(2 * Math.PI * (r - Hb / 2)) - 1];
  }
  // letters fan out on a curve tighter than the band is tall: no ring there at this size
  if (bg.runs.some(rn => runMinRadius(rn) < Hb * s * MIN_CURVE)) return null;
  if (bg.kind === 'closed') return [Math.floor(bg.runs[0].len / s) - 1];
  return bg.runs.map(rn => Math.floor((rn.len - room * s * (rn.start!.clearance + rn.end!.clearance) - s) / s));
}

export interface RingFit {
  s: number;
  rep: number;
  groups: Segs[];
  caps: number[];
  mode: 'words' | 'breaks';
  score: number;
  /** Band depth in cells. */
  room: number;
  /** Mean share of each run left to stretching. */
  slack: number;
}

export interface FitOptions {
  /** Target letter scale; the search runs from 0.7× to 1.3× of it (within 0.36 … 1.15). */
  sTarget: number;
  /** Fixed scale instead of a search. */
  fixed?: number;
  once: boolean;
  wordGap: number;
  /** Largest scale the band may grow to when its text is too short for it (see MAX_SLACK). */
  sMax: number;
  /** Largest scale of the normal search (the band's inner edge still exists); sMax when absent. */
  sHi?: number;
  /** Band depth in cells (letters plus headroom); the letters' height by default. */
  room?: number;
}

/** Runs too short to hold any segment may stay empty (just the band) when they add up to no more than this share of
 *  the ring's length: a silhouette's finial or notch shouldn't force the whole composition larger. */
const MAX_SKIP = 0.35;
/** A run counts as a small feature (a finial, a notch) when it is under this share of the ring's length. */
const TINY_RUN = 0.08;
/** Score cost per unit of skipped length share. */
const SKIP_COST = 1.5;
/** A run holding less than this many of the shortest segment may be left blank instead of taking a lone word. */
const ORPHAN_RUN = 2.5;
/** Score cost per run holding a single segment. */
const ORPHAN_COST = 0.04;

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

/** Slack (share of the band left to stretching) above which a fit reads as gappy: words pulled apart by long
 *  kashidas. A master fills a band before stretching it, so past this the search tries more repeats, larger letters
 *  and, last, breaking words at non-joining letters. */
export const MAX_SLACK = 0.12;

/** Best (scale, repeats) for one ring. */
export function fitRing(bg: BandGeom, script: ScriptEngine, prepared: Prepared, o: FitOptions): RingFit | null {
  const room = o.room ?? prepared.Hb;
  const hi = Math.min(o.sHi ?? o.sMax, Math.min(1.15, o.sTarget * 1.3)),
    lo = Math.max(0.36, o.sTarget * 0.7);
  if (!o.fixed && hi < lo) return null; // the band can't be drawn at an acceptable size here
  const range = (a: number, b: number) => Array.from({ length: 29 }, (_, i) => a - (i * (a - b)) / 28);
  const search = (scales: number[], mode: 'words' | 'breaks', scaleCost: boolean): RingFit | null => {
    let best: RingFit | null = null;
    const segs0 = script.segments(prepared, mode, o.wordGap) as Segs;
    if (!segs0.length) return null;
    const one = segs0.reduce((a, x) => a + x.minW, 0) + o.wordGap * segs0.length,
      minSeg = Math.min(...segs0.map(x => x.minW));
    for (const s of scales) {
      const c = capacities(bg, prepared.Hb, s, room);
      if (!c) continue;
      // runs that would hold only a lone word may also stay blank, as a master leaves a finial or a neck plain
      const uses = [usableRuns(bg, c, minSeg), usableRuns(bg, c, minSeg * ORPHAN_RUN)].filter(
        (u, i, a): u is NonNullable<typeof u> => !!u && (i === 0 || u.ord.length !== a[0]?.ord.length),
      );
      for (const use of uses) {
        const G = c.length,
          cOrd = use.ord.map(g => c[(G - g) % G]),
          sum = cOrd.reduce((a, b) => a + b, 0);
        const rep0 = Math.max(1, Math.ceil(cOrd.length / segs0.length)),
          // enough repeats to fill the band, however short the text is against it
          repMax = o.once ? rep0 : Math.max(14, Math.ceil((sum + o.wordGap) / one) + 1);
        if (o.once && rep0 > 1) continue;
        for (let rep = rep0; rep <= repMax; rep++) {
          if (rep * one - o.wordGap > sum + 1) break;
          const p = partition(repeat(segs0, rep), cOrd);
          if (!p) continue;
          const orphans = cOrd.length > 1 ? p.groups.filter(g => g.length === 1).length : 0,
            score =
              p.score +
              (o.fixed || !scaleCost ? 0 : (0.5 * Math.abs(s - o.sTarget)) / o.sTarget) +
              (mode === 'breaks' ? 0.15 : 0) +
              SKIP_COST * use.skip +
              ORPHAN_COST * orphans;
          if (!best || score < best.score) {
            // groups in reading order for every run; skipped runs get none
            const groups: Segs[] = Array.from({ length: G }, () => [] as unknown as Segs);
            use.ord.forEach((g, k) => (groups[g] = p.groups[k] as Segs));
            best = { s, rep, groups, caps: c, mode, score, room, slack: p.score };
          }
        }
      }
    }
    return best;
  };
  // a fit found by growing or breaking replaces the first only when it clearly closes the gaps
  const better = (a: RingFit | null, b: RingFit | null) => (!a ? b : !b ? a : b.slack < a.slack - 0.05 ? b : a);
  const scales = o.fixed ? [o.fixed] : range(hi, lo);
  let best = search(scales, 'words', true);
  // still gappy: larger letters, up to what the band's geometry allows
  // a repeated text fills by repeating; only a text written once grows its letters to fill
  const grow = o.once && !o.fixed && o.sMax > hi * 1.02;
  if ((!best || best.slack > MAX_SLACK) && grow)
    best = better(best, search(range(Math.min(o.sMax, o.sTarget * 3), hi), 'words', false));
  // then words broken at non-joining letters
  if (!best || best.slack > MAX_SLACK) {
    let br = search(scales, 'breaks', true);
    if ((!br || br.slack > MAX_SLACK) && grow)
      br = better(br, search(range(Math.min(o.sMax, o.sTarget * 3), hi), 'breaks', false));
    // breaking words only pays when it closes the gaps clearly
    best = better(best, br);
  }
  return best;
}

/** Does the text fit once at scale 1 (the auto-size test)? */
export function fitsAtFullSize(
  bg: BandGeom,
  script: ScriptEngine,
  prepared: Prepared,
  wordGap: number,
  room = prepared.Hb,
): boolean {
  const c = capacities(bg, prepared.Hb, 1, room);
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

/** Lay out a fitted ring: one strip per run, with its placement. */
export function layRing(
  bg: BandGeom,
  fit: RingFit,
  script: ScriptEngine,
  prepared: Prepared,
  opts: Omit<LayoutOptions, 'wrap'>,
): { strip: Strip; place: StripPlace; group: number; run: number }[] {
  const G = fit.caps.length,
    s = fit.s,
    out: { strip: Strip; place: StripPlace; group: number; run: number }[] = [];
  for (let gi = 0; gi < G; gi++) {
    const gg = (G - gi) % G,
      W = fit.caps[gi];
    if (!fit.groups[gg]?.length) continue; // a run too short for text stays empty
    const strip = script.layout(fit.groups[gg] as Segments, prepared, W, { ...opts, wrap: bg.kind !== 'runs' });
    if (!strip) continue;
    let place: StripPlace;
    if (bg.kind === 'circle') place = { type: 'arc', C: [0, 0], R: bg.R / s, N: W + 1, s, rot: 0 };
    else if (bg.kind === 'closed') {
      const rn = bg.runs[0];
      place = { type: 'run', pts: rn.pts, cum: rn.cum, off: 0, sx: rn.len / (W + 1), s };
    } else {
      const rn = bg.runs[gi],
        cA = rn.start!.clearance,
        cB = rn.end!.clearance,
        usable = rn.len - fit.room * s * (cA + cB),
        off = fit.room * s * cA + (usable - W * s) / 2;
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
