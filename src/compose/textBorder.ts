// Text bands along any outline (lab composeShape / fitRing). The complete-text rule: a band holds its text a whole
// number of times; the fit is found by searching letter scale and repeat count together for the least slack, never
// by cutting the text. Groups go round the outline clockwise from the bottom: runs are stored counter-clockwise, so
// group g sits on run (G − g) % G.
import { frameAt, makeRun, runMinRadius, runsOf } from '../geometry/runs';
import type { ShapeGeometry } from '../geometry/shape';
import type { Corner, Frame, Pt, Run } from '../geometry/types';
import type { BandOpening, BorderSide } from '../model/schema';
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
  /** A closed ring's gap, in cells, where its text starts and ends (TextBorder.seam). */
  seam?: number;
  /** The text runs up to concave corners (TextBorder.insideCorners 'meet'). */
  meet?: boolean;
  /** A circle's text starts this far round from the bottom, clockwise, in radians (TextBorder.start). */
  turn?: number;
  /** The openings cut in the band: the frames at each one's two edges, on the band's outer line. */
  gaps?: { a: Frame; b: Frame }[];
}

/** What a border asks of its band beyond its place in the outline. */
export interface BandAsk {
  seam?: number;
  start?: BorderSide;
  openings?: BandOpening[];
  insideCorners?: 'clear' | 'meet';
}

/** How far the text keeps from the edge of an opening, in band depths. */
const OPENING_KEEP = 0.1;
const TURNS: Record<BorderSide, number> = { bottom: 0, left: 1, top: 2, right: 3 };

/** The points of a run from arc length a to b. */
function slicePts(rn: Run, a: number, b: number): Pt[] {
  const out: Pt[] = [frameAt(rn, a).p];
  for (let i = 0; i < rn.pts.length; i++) if (rn.cum[i] > a + 1e-9 && rn.cum[i] < b - 1e-9) out.push(rn.pts[i]);
  out.push(frameAt(rn, b).p);
  return out;
}
const edge = (f: Frame): Corner => ({
  index: -1,
  p: f.p,
  interior: Math.PI / 2,
  convex: true,
  bisector: f.n,
  clearance: OPENING_KEEP,
});
/** Nearest point of the runs to p: the run and the arc length along it. */
function nearest(runs: Run[], p: Pt): { run: number; at: number } {
  let best = { run: 0, at: 0 },
    bd = Infinity;
  runs.forEach((rn, r) => {
    for (let i = 0; i + 1 < rn.pts.length; i++) {
      const [ax, ay] = rn.pts[i],
        [bx, by] = rn.pts[i + 1],
        dx = bx - ax,
        dy = by - ay,
        l2 = dx * dx + dy * dy || 1,
        t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)),
        d = Math.hypot(p[0] - ax - dx * t, p[1] - ay - dy * t);
      if (d < bd) {
        bd = d;
        best = { run: r, at: rn.cum[i] + Math.sqrt(l2) * t };
      }
    }
  });
  return best;
}
/** A closed run (a ring without corners) restarted at arc length a. */
function restart(rn: Run, a: number): Run {
  const ring = rn.pts.slice(0, -1),
    out: Pt[] = [frameAt(rn, a).p];
  let k = ring.findIndex((_, i) => rn.cum[i] > a + 1e-9);
  if (k < 0) k = 0;
  for (let i = 0; i < ring.length; i++) out.push(ring[(k + i) % ring.length]);
  out.push(out[0]);
  return makeRun(out, null, null);
}

/** A border's band: its place in the outline (bandGeom), then the side its text starts on, its openings and how it
 *  meets inside corners. toCells takes an opening's point (the outline's own coordinates) to cells. */
export function borderBand(
  shape: ShapeGeometry,
  size: number,
  inset: number,
  ask: BandAsk,
  toCells: (p: Pt) => Pt = p => [p[0] * size, p[1] * size],
): BandGeom | null {
  let bg = bandGeom(shape, size, inset);
  if (!bg) return null;
  if (ask.seam) bg = { ...bg, seam: ask.seam };
  if (ask.insideCorners === 'meet') bg = { ...bg, meet: true };
  const openings = ask.openings ?? [];
  // a circle with openings is written along its outline like any other closed curve
  if (openings.length && bg.kind === 'circle') {
    const ring = shape.ring(size, inset)!;
    bg = { ...bg, kind: 'closed', R: 0, runs: runsOf(ring) };
  }
  const side = ask.start ?? 'bottom';
  if (side !== 'bottom') {
    if (bg.kind === 'circle') bg = { ...bg, turn: (TURNS[side] * Math.PI) / 2 };
    else {
      // how far towards that side a point lies (y is down)
      const reach = ([x, y]: Pt) => (side === 'top' ? -y : side === 'left' ? -x : x);
      if (bg.kind === 'closed') {
        const rn = bg.runs[0];
        let k = 0;
        rn.pts.forEach((q, i) => {
          if (reach(q) > reach(rn.pts[k]) + 1e-9) k = i;
        });
        bg = { ...bg, runs: [restart(rn, rn.cum[k])] };
      } else {
        const mids = bg.runs.map(rn => reach(frameAt(rn, rn.len / 2).p));
        let k = 0;
        // the side's own run: the farthest that way, and of equals the longest
        bg.runs.forEach((rn, i) => {
          if (mids[i] > mids[k] + 1e-6 || (Math.abs(mids[i] - mids[k]) <= 1e-6 && rn.len > bg!.runs[k].len)) k = i;
        });
        bg = { ...bg, runs: bg.runs.slice(k).concat(bg.runs.slice(0, k)) };
      }
    }
  }
  if (openings.length) {
    let runs = bg.runs;
    const gaps: NonNullable<BandGeom['gaps']> = [];
    let closed = bg.kind === 'closed';
    for (const o of openings) {
      const hit = nearest(runs, toCells(o.at as Pt)),
        rn = runs[hit.run];
      if (closed) {
        // one run all the way round: it now starts after the opening and ends before it
        const w = Math.min(o.width, rn.len * 0.8),
          r2 = restart(rn, (hit.at + w / 2) % rn.len),
          a = frameAt(r2, r2.len - w),
          b = frameAt(r2, 0);
        runs = [makeRun(slicePts(r2, 0, r2.len - w), edge(b), edge(a))];
        gaps.push({ a, b });
        closed = false;
        continue;
      }
      const a0 = Math.max(0, hit.at - o.width / 2),
        a1 = Math.min(rn.len, hit.at + o.width / 2),
        a = frameAt(rn, a0),
        b = frameAt(rn, a1),
        parts: Run[] = [];
      if (a0 > 1e-6) parts.push(makeRun(slicePts(rn, 0, a0), rn.start, edge(a)));
      if (a1 < rn.len - 1e-6) parts.push(makeRun(slicePts(rn, a1, rn.len), edge(b), rn.end));
      if (!parts.length) continue; // the opening takes the whole side: it stays as it is
      runs = runs.slice(0, hit.run).concat(parts, runs.slice(hit.run + 1));
      gaps.push({ a, b });
    }
    bg = { ...bg, kind: closed ? 'closed' : 'runs', runs, gaps };
  }
  return bg;
}

/** Where one repeat of the text ends and the next begins within a strip of cell letters: the middle and width of
 *  each such gap, in strip cells. */
export function repeatGaps(strip: Strip): { x: number; w: number }[] {
  if (strip.kind !== 'cells') return [];
  const out: { x: number; w: number }[] = [];
  let lastX = -1,
    lastTag = 0;
  for (let x = 0; x < strip.W; x++) {
    let tag = 0;
    for (let y = 0; y < strip.Hb && !tag; y++) tag = strip.tag[y * strip.W + x];
    if (!tag) continue;
    if (lastTag && tag !== lastTag) out.push({ x: (lastX + 1 + x) / 2, w: x - lastX - 1 });
    lastX = x;
    lastTag = tag;
  }
  return out;
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

/** How far a band keeps back from a corner at the end of a run, in band depths. At a convex corner the two bands
 *  would cross, so each keeps the corner's clearance. At a concave one (the inside corner of an L, the valley of a
 *  star) they turn away from each other and nothing is in the way: the text runs up to the corner, less a little so
 *  the two lines don't touch at their feet. */
export const CONCAVE_KEEP = 0.12;
export const keepBack = (c: Corner, meet?: boolean): number =>
  c.convex || !meet ? c.clearance : Math.min(c.clearance, CONCAVE_KEEP);

/** A run may curve no tighter than this many band heights (radius of curvature). */
export const MIN_CURVE = 1.25;

/** Capacity (strip width in cells) of each run at letter scale s, or null if the band doesn't fit. room = the band's
 *  depth in cells (letters plus headroom), Hb by default. */
export function capacities(bg: BandGeom, Hb: number, s: number, room = Hb): number[] | null {
  if (bg.kind === 'circle') {
    const r = bg.R / s;
    if (r - room < Math.max(3, room * 0.9)) return null;
    return [Math.round(2 * Math.PI * (r - Hb / 2)) - 1 - (bg.seam ?? 0)];
  }
  // letters fan out on a curve tighter than the band is tall: no ring there at this size
  if (bg.runs.some(rn => runMinRadius(rn) < Hb * s * MIN_CURVE)) return null;
  if (bg.kind === 'closed') return [Math.floor(bg.runs[0].len / s) - 1 - (bg.seam ?? 0)];
  return bg.runs.map(rn =>
    Math.floor((rn.len - room * s * (keepBack(rn.start!, bg.meet) + keepBack(rn.end!, bg.meet)) - s) / s),
  );
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
  /** Cells left between one repeat of the text and the next, beyond the word gap (room for a mark). */
  repeatGap?: number;
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

/** Cells a closed ring's line of cell letters needs beyond its width where its end meets its start (no seam set): a
 *  word gap, less the one cell the placement leaves there. Vector scripts close the ring with what room is left. */
const closeGap = (bg: BandGeom, script: ScriptEngine, wordGap: number) =>
  script.capabilities.grid && bg.kind !== 'runs' && !bg.seam ? Math.max(0, wordGap - 1) : 0;

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
    const segs0 = script.segments(prepared, mode, o.wordGap) as Segs;
    if (!segs0.length) return null;
    const rg = o.repeatGap ?? 0,
      one = segs0.reduce((a, x) => a + x.minW, 0) + o.wordGap * segs0.length + rg,
      // the text rep times over, with the wider gap after each repeat but the last
      times = (rep: number): Segs => {
        const all = repeat(segs0, rep);
        if (!rg) return all;
        const out: Segs = all.map((x, i) => (i < all.length - 1 && all[i + 1].rep !== x.rep ? { ...x, gap: rg } : x));
        out.wg = all.wg;
        return out;
      },
      minSeg = Math.min(...segs0.map(x => x.minW)),
      close = closeGap(bg, script, o.wordGap);
    // every (scale, runs used) to try, with the least score any fit there can have: its partition's slack is never
    // negative, so the rest of the score is a floor. Tried cheapest floor first, a candidate whose floor can't beat
    // the best so far is skipped without partitioning; ties go to the earlier candidate in scale order, as when they
    // were tried in that order, so the fit found is the same.
    type Cand = { s: number; c: number[]; use: NonNullable<ReturnType<typeof usableRuns>>; sc: number; floor: number; order: number }; // prettier-ignore
    const cands: Cand[] = [];
    scales.forEach((s, si) => {
      const c = capacities(bg, prepared.Hb, s, room);
      if (!c) return;
      // runs that would hold only a lone word may also stay blank, as a master leaves a finial or a neck plain
      const uses = [usableRuns(bg, c, minSeg), usableRuns(bg, c, minSeg * ORPHAN_RUN)].filter(
        (u, i, a): u is NonNullable<typeof u> => !!u && (i === 0 || u.ord.length !== a[0]?.ord.length),
      );
      uses.forEach((use, ui) => {
        const sc = o.fixed || !scaleCost ? 0 : (0.5 * Math.abs(s - o.sTarget)) / o.sTarget,
          // a hair under the true floor, so rounding can never skip a candidate that could win
          floor = sc + (mode === 'breaks' ? 0.15 : 0) + SKIP_COST * use.skip - 1e-9;
        cands.push({ s, c, use, sc, floor, order: si * 2 + ui });
      });
    });
    cands.sort((a, b) => a.floor - b.floor || a.order - b.order);
    let best: RingFit | null = null,
      bestOrder = Infinity;
    for (const { s, c, use, sc, floor, order } of cands) {
      if (best && floor > best.score) continue;
      const G = c.length,
        cOrd = use.ord.map(g => c[(G - g) % G]),
        sum = cOrd.reduce((a, b) => a + b, 0);
      const rep0 = Math.max(1, Math.ceil(cOrd.length / segs0.length)),
        // enough repeats to fill the band, however short the text is against it
        repMax = o.once ? rep0 : Math.max(14, Math.ceil((sum + o.wordGap) / one) + 1);
      if (o.once && rep0 > 1) continue;
      for (let rep = rep0; rep <= repMax; rep++) {
        if (rep * one - o.wordGap - rg > sum + 1) break;
        const p = partition(times(rep), close ? cOrd.map(x => x - close) : cOrd);
        if (!p) continue;
        const orphans = cOrd.length > 1 ? p.groups.filter(g => g.length === 1).length : 0,
          // summed in the same order as ever, so equal fits compare equal
          score: number = p.score + sc + (mode === 'breaks' ? 0.15 : 0) + SKIP_COST * use.skip + ORPHAN_COST * orphans;
        if (!best || score < best.score || (score === best.score && order < bestOrder)) {
          // groups in reading order for every run; skipped runs get none
          const groups: Segs[] = Array.from({ length: G }, () => [] as unknown as Segs);
          use.ord.forEach((g, k) => (groups[g] = p.groups[k] as Segs));
          best = { s, rep, groups, caps: c, mode, score, room, slack: p.score };
          bestOrder = order;
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
      need = Math.max(1, Math.ceil(cOrd.length / segs.length)),
      close = closeGap(bg, script, wordGap),
      caps = (use.skip ? cOrd : c).map(x => x - close);
    if (greedyOK(repeat(segs, need), caps)) return true;
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
    const strip = script.layout(fit.groups[gg] as Segments, prepared, W, {
      ...opts,
      wrap: bg.kind !== 'runs' && !bg.seam,
    });
    if (!strip) continue;
    let place: StripPlace;
    // a seam leaves its gap centred where the ring starts (the bottom of a circle, the outline's first point)
    const seam = bg.seam ?? 0,
      N = W + 1 + seam;
    if (bg.kind === 'circle')
      place = { type: 'arc', C: [0, 0], R: bg.R / s, N, s, rot: (seam ? (-Math.PI * (seam + 1)) / N : 0) + (bg.turn ?? 0) }; // prettier-ignore
    else if (bg.kind === 'closed') {
      const rn = bg.runs[0],
        sx = rn.len / N;
      place = { type: 'run', pts: rn.pts, cum: rn.cum, off: seam ? ((seam + 1) / 2) * sx : 0, sx, s };
    } else {
      const rn = bg.runs[gi],
        cA = keepBack(rn.start!, bg.meet),
        cB = keepBack(rn.end!, bg.meet),
        usable = rn.len - fit.room * s * (cA + cB),
        off = fit.room * s * cA + (usable - W * s) / 2;
      if (rn.pts.length === 2) {
        const f = frameAt(rn, 0),
          O: Pt = [rn.pts[0][0] + f.t[0] * off, rn.pts[0][1] + f.t[1] * off];
        // a straight band reads upright: one whose letters would hang upside down (the top of a frame) is turned
        // half round in place, as an inscription across the top of a portal is; curved bands follow their curve
        if (f.n[1] > UPRIGHT) {
          // turned within the band's full depth, so the headroom above the letters turns with them; the letters' feet
          // now face the next band's separator, whose margin is set at that band's (smaller) scale, so they keep a
          // quarter cell off it (the headroom they give up is at least a cell)
          const D = fit.room - FLIP_CLEAR,
            O2: Pt = [O[0] + (f.t[0] * W + f.n[0] * D) * s, O[1] + (f.t[1] * W + f.n[1] * D) * s];
          place = { type: 'line', O: O2, t: [-f.t[0], -f.t[1]], n: [-f.n[0], -f.n[1]], s };
        } else place = { type: 'line', O, t: f.t, n: f.n, s };
      } else place = { type: 'run', pts: rn.pts, cum: rn.cum, off, sx: s, s };
    }
    out.push({ strip, place, group: gg, run: gi });
  }
  return out;
}

/** A straight band whose letters' up direction points this far down the page (sine of the tilt below level) is
 *  turned upright. */
export const UPRIGHT = 0.5;
/** Cells a turned band's letters keep off the band's far edge. */
const FLIP_CLEAR = 0.25;

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
