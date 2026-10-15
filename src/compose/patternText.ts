// A star pattern drawn in words: each line of the pattern is a row of the text, repeated at its natural spacing and
// centred on the line, in the accent colour plain pattern lines take. The outlines of the stars are made of the word.
import { inside } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import type { PatternSpec, Style } from '../model/schema';
import { picLines } from '../ornament/patterns/pic';
import { tiles } from '../ornament/patterns/tilings';
import type { Tiling } from '../ornament/patterns/tilings';
import { repeat } from '../script/kufi';
import type { ScriptEngine, Segments, Strip } from '../script/types';
import { parsePolys } from '../script/vector';
import type { PlacedItem } from './placed';
import { layoutOpts } from './resolve';

const TILING: Record<PatternSpec['tiling'], Tiling> = { square: 'sq', '488': '488', hex: 'hex', '31212': '31212' };
/** Height of the letters' ink as a share of the tile edge (a plain pattern line is 0.16 of it). */
export const WORD_LINE = 0.09;

/** Rows of ink (lowest, highest) in a strip; for a vector strip, the rows its outlines reach into. */
function inkRows(st: Strip): [number, number] {
  if (st.kind === 'vector') {
    const ys = st.paths
      .flatMap(p => parsePolys(p.d))
      .flat()
      .map(q => q[1]);
    return ys.length ? [Math.floor(Math.min(...ys)), Math.ceil(Math.max(...ys)) - 1] : [st.Hb, -1];
  }
  let lo = st.Hb,
    hi = -1;
  for (let y = 0; y < st.Hb; y++)
    for (let x = 0; x < st.W; x++)
      if (st.data[y * st.W + x]) {
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
        break;
      }
  return [lo, hi];
}

/** Trim segment PQ to the part inside polygon R (both ends inside, or one end pulled in to the boundary). */
function trim(P: Pt, Q: Pt, R: Pt[]): [Pt, Pt] | null {
  const inP = inside(R, P[0], P[1]),
    inQ = inside(R, Q[0], Q[1]);
  if (inP && inQ) return [P, Q];
  if (!inP && !inQ) return null;
  const [a, b] = inP ? [P, Q] : [Q, P];
  let lo = 0,
    hi = 1;
  for (let k = 0; k < 20; k++) {
    const m = (lo + hi) / 2;
    if (inside(R, a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m)) lo = m;
    else hi = m;
  }
  const e: Pt = [a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo];
  return inP ? [P, e] : [e, Q];
}

/** Strip items writing the pattern's lines in the text, within region R (centred on c, out to radius). */
export function patternTextItems(
  text: string,
  pattern: PatternSpec,
  R: Pt[],
  c: Pt,
  radius: number,
  style: Style,
  script: ScriptEngine,
  sid: number,
  ring: number,
): PlacedItem[] {
  // short ascenders: the band is only as tall as the word needs
  const lt = { ...style.letter, ascenders: 7 as const },
    prep = script.prepareLines([text], lt)[0],
    segs = script.segments(prep, 'words', 2),
    one = script.layout(segs, prep, null, { ...layoutOpts(style, 2), wrap: false }) as Strip | null;
  if (!one) return [];
  const [lo, hi] = inkRows(one),
    a = pattern.scale,
    s = (WORD_LINE * a) / (hi - lo + 1),
    gap = 0.35 * WORD_LINE * a,
    unitW = one.W + 2,
    mid = (lo + hi + 1) / 2,
    cache = new Map<number, Strip | null>(),
    stripOf = (k: number) => {
      if (!cache.has(k))
        cache.set(
          k,
          script.layout(repeat(segs as Segments, k), prep, null, {
            ...layoutOpts(style, 2),
            wrap: false,
          }) as Strip | null,
        );
      return cache.get(k)!;
    };
  const items: PlacedItem[] = [];
  const lay = (P: Pt, Q: Pt) => {
    const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]),
      // words as many as fit at their natural spacing, then centred on the line
      k = Math.floor((L - 2 * gap) / s / unitW + 2 / unitW);
    if (k < 1) return;
    const st = stripOf(k);
    if (!st || st.W * s > L - 2 * gap + 1e-6) return;
    items.push(stripOnSegment(P, Q, st, s, mid, sid, ring));
  };
  for (const [P, Q] of patternSegments(pattern, R, c, radius)) lay(P, Q);
  return items;
}

/** The pattern's lines as straight segments within region R: the two rays crossing at each tile-edge midpoint
 *  joined into one line, and at each crossing one line passing over whole and the other broken, as in interlace. */
export function patternSegments(pattern: PatternSpec, R: Pt[], c: Pt, radius: number, cutGap = 0): [Pt, Pt][] {
  const a = pattern.scale,
    out: [Pt, Pt][] = [];
  // the pattern's rays meet in pairs at each tile-edge midpoint, crossing straight through it: join each pair
  // into one line, and where two lines cross let one pass over whole and break the other, as in interlace
  const key = (p: number[]) => Math.round(p[0] * 100) + ',' + Math.round(p[1] * 100);
  const atMid = new Map<string, { m: Pt; far: Pt }[]>();
  for (const line of picLines(tiles(TILING[pattern.tiling], a, c[0], c[1], radius), (pattern.angle * Math.PI) / 180)) {
    const ends = [0, line.length - 1];
    for (const e of ends) {
      const m = line[e] as Pt,
        far = line[e === 0 ? 1 : line.length - 2] as Pt,
        k = key(m);
      if (!atMid.has(k)) atMid.set(k, []);
      atMid.get(k)!.push({ m, far });
    }
  }
  const angle = (u: Pt, v: Pt) => {
    const a0 = Math.atan2(v[1] - u[1], v[0] - u[0]);
    return ((a0 % Math.PI) + Math.PI) % Math.PI;
  };
  for (const rays of atMid.values()) {
    const m = rays[0].m,
      used = new Set<number>(),
      lines: { A: Pt; B: Pt; ang: number }[] = [];
    // pair rays leaving m in opposite directions
    for (let i = 0; i < rays.length; i++) {
      if (used.has(i)) continue;
      const di = [rays[i].far[0] - m[0], rays[i].far[1] - m[1]],
        li = Math.hypot(di[0], di[1]);
      let best = -1;
      for (let j = i + 1; j < rays.length; j++) {
        if (used.has(j)) continue;
        const dj = [rays[j].far[0] - m[0], rays[j].far[1] - m[1]],
          cos = (di[0] * dj[0] + di[1] * dj[1]) / (li * Math.hypot(dj[0], dj[1]));
        if (cos < -0.999) best = j;
      }
      used.add(i);
      if (best >= 0) used.add(best);
      lines.push({ A: rays[i].far, B: best >= 0 ? rays[best].far : m, ang: angle(m, rays[i].far) });
    }
    // the line at the smaller angle passes over; the others break at m
    const over = lines.reduce((x, y) => (y.ang < x.ang ? y : x), lines[0]);
    for (const l of lines) {
      const whole = l === over || lines.length === 1;
      const parts: [Pt, Pt][] = whole
        ? [[l.A, l.B]]
        : [
            [l.A, m],
            [m, l.B],
          ];
      for (const [U, V] of parts) {
        if (U === V) continue;
        const seg = trim(U, V, R);
        if (seg) out.push(seg);
      }
    }
  }
  return cutGap > 0 ? cutCrossings(out, cutGap) : out;
}

/** Where two segments cross away from their ends, the earlier one passes over and the later one breaks, leaving a
 *  gap of `gap` on each side of the crossing (interlace for lines that cross mid-span). */
export function cutCrossings(segs: [Pt, Pt][], gap: number): [Pt, Pt][] {
  const cuts: number[][] = segs.map(() => []);
  const bb = segs.map(([P, Q]) => [
    Math.min(P[0], Q[0]),
    Math.min(P[1], Q[1]),
    Math.max(P[0], Q[0]),
    Math.max(P[1], Q[1]),
  ]);
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const A = bb[i],
        B = bb[j];
      if (A[2] < B[0] || B[2] < A[0] || A[3] < B[1] || B[3] < A[1]) continue;
      const [p, q] = segs[i],
        [r, t] = segs[j],
        dx1 = q[0] - p[0],
        dy1 = q[1] - p[1],
        dx2 = t[0] - r[0],
        dy2 = t[1] - r[1],
        den = dx1 * dy2 - dy1 * dx2;
      if (Math.abs(den) < 1e-12) continue;
      const u = ((r[0] - p[0]) * dy2 - (r[1] - p[1]) * dx2) / den,
        v = ((r[0] - p[0]) * dy1 - (r[1] - p[1]) * dx1) / den,
        e = 1e-6;
      if (u <= e || u >= 1 - e || v <= e || v >= 1 - e) continue;
      // the later segment breaks (alternating which is over keeps the weave even across the field)
      if ((i + j) % 2) cuts[j].push(v);
      else cuts[i].push(u);
    }
  const out: [Pt, Pt][] = [];
  segs.forEach(([P, Q], k) => {
    const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]),
      g = gap / L,
      at = (f: number): Pt => [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f];
    let from = 0;
    for (const f of cuts[k].sort((x, y) => x - y)) {
      if (f - g > from) out.push([at(from), at(f - g)]);
      from = Math.max(from, f + g);
    }
    if (from < 1) out.push([at(from), Q]);
  });
  return out;
}

/** A strip laid centred on segment PQ (its band's row `mid` on the line), reading left to right and upright. */
export function stripOnSegment(
  P0: Pt,
  Q0: Pt,
  st: Strip,
  s: number,
  mid: number,
  sid: number,
  ring: number,
): PlacedItem {
  let P = P0,
    Q = Q0;
  const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
  // read left to right, upright: the strip's x runs along +t with t pointing right (or down on a vertical)
  if (Q[0] < P[0] - 1e-9 || (Math.abs(Q[0] - P[0]) < 1e-9 && Q[1] < P[1])) [P, Q] = [Q, P];
  const t: Pt = [(Q[0] - P[0]) / L, (Q[1] - P[1]) / L],
    n: Pt = [t[1], -t[0]],
    off = (L - st.W * s) / 2,
    O: Pt = [P[0] + t[0] * off - n[0] * mid * s, P[1] + t[1] * off - n[1] * mid * s];
  return { type: 'strip', style: sid, strip: st, place: { type: 'line', O, t, n, s }, ring };
}
