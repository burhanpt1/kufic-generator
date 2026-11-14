// Checks on a finished roundel, made exact by stroke ownership (every sample knows its group and letter). They are
// reported numbers, not part of the score, until the owner's ratings show they predict his choices (PLAN-2 §1).
//   wordSpace: a word broken by too wide a gap between its pieces reads as two words;
//   strayMarks: a vowel nearer another word's letters than its own reads as that word's;
//   strayDots: a dot group nearer another letter than its own is misread;
//   doubled: ink run twice along the same course by two different letters. A letter's own overlaps are its design,
//   and a redraw cannot leave old ink behind (redraw() replaces it).
//   wordClear, wordsRunOn: words that follow each other on a line standing so close that the line reads as one run of
//   letters (the tightest gap between two such words; how many pairs stand no further apart than the pieces inside
//   one of them do).
import type { Thuluth } from '../engine';
import { STEM_LETTERS } from '../shape';
import type { Poly, Stroke } from '../types';
import type { Roundel } from './compose';
import { headOf, twoLevels } from './compose';
import type { Finished } from './finish';

interface Pt {
  x: number;
  y: number;
  /** Group, letter in its word (−1 for a join), stroke, sample. */
  g: number;
  li: number;
  st: number;
  k: number;
}
/** Every letter stroke's samples in composition coordinates, with their owners. */
function inkPoints(r: Roundel): Pt[] {
  const out: Pt[] = [];
  let st = 0;
  r.shapes.forEach((S, g) =>
    S.b.strokes.forEach(s => {
      if (s.mark) return;
      s.s.forEach((q, k) => out.push({ x: q.x + r.st[g].x, y: q.y + r.st[g].y, g, li: s.own?.[k] ?? -1, st, k }));
      st++;
    }),
  );
  return out;
}
/** A grid for nearest-point queries. */
function grid(pts: Pt[], cell: number) {
  const m = new Map<string, Pt[]>(),
    key = (x: number, y: number) => Math.floor(x / cell) + ',' + Math.floor(y / cell);
  for (const p of pts) {
    const k = key(p.x, p.y);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(p);
  }
  return {
    near(x: number, y: number, r: number): Pt[] {
      const out: Pt[] = [],
        n = Math.ceil(r / cell),
        cx = Math.floor(x / cell),
        cy = Math.floor(y / cell);
      for (let dx = -n; dx <= n; dx++)
        for (let dy = -n; dy <= n; dy++)
          for (const p of m.get(cx + dx + ',' + (cy + dy)) || []) if (Math.hypot(p.x - x, p.y - y) <= r) out.push(p);
      return out;
    },
  };
}
const nearest = (pts: Pt[], x: number, y: number, keep: (p: Pt) => boolean) => {
  let d = Infinity;
  for (const p of pts) if (keep(p)) d = Math.min(d, Math.hypot(p.x - x, p.y - y));
  return d;
};

export interface RoundelChecks {
  /** Pen units by which the gaps between the pieces of a word (ink edge to ink edge) exceed 2 pens, summed. */
  wordSpace: number;
  /** Vowels and dot groups nearer another word's (another letter's) ink than their own by more than a pen. */
  strayMarks: number;
  strayDots: number;
  /** Length of ink (pen units) run along the same course by two different letters. */
  doubled: number;
  /** Dots and marks left lying on ink once the marks are placed (Finished.marksUnplaced): the measure the score's
   *  "marks without room" was meant to be, which with the solver on is always 0. A candidate for the score. */
  marksUnplaced: number;
  /** Words that follow each other on a line (wordGaps()): how many such pairs there are; the tightest gap between
   *  two of them, ink edge to ink edge (pen units, and in nibs; 0 when they touch, null when no two words share a
   *  line); the widest gap between the pieces inside any of those words (pen units); and how many pairs stand no
   *  further apart than the widest gap inside either of their two words (a pair that touches always counts). */
  wordPairs: number;
  wordClear: number | null;
  wordClearNibs: number | null;
  wordInner: number;
  wordsRunOn: number;
  /** Alignment (alignment()). */
  baselines: number;
  stemRhythm: number;
  topLevels: number;
}

/** Alignment, the deliberateness of a layout: how far each word's baseline (its first letter's) lies from the nearest
 *  other word's (pens, at most 3, averaged: 0 when words share ruled lines); how unevenly the stems' tops are spaced
 *  along each line of words (the spread of the gaps over their mean, averaged over lines with three stems or more);
 *  and how far the tops fall from one or two common heights (pens, root mean square). */
export function alignment(r: Roundel, nib: number): { baselines: number; stemRhythm: number; topLevels: number } {
  const first = new Map<number, number>();
  r.groups.forEach((g, i) => !first.has(g.word) && first.set(g.word, i));
  const base = [...first.entries()].map(([w, g]) => ({ w, y: r.st[g].y + headOf(r.shapes[g]).y }));
  let baselines = 0;
  base.forEach(p => {
    const d = Math.min(3, ...base.filter(q => q !== p).map(q => Math.abs(q.y - p.y) / nib));
    baselines += d / base.length;
  });
  // lines of words: baselines within 3 pens of the line's first, from the top down
  const lines: { y: number; ws: number[] }[] = [];
  [...base]
    .sort((a, b) => b.y - a.y)
    .forEach(p => {
      const L = lines.find(q => Math.abs(q.y - p.y) < 3 * nib);
      if (L) L.ws.push(p.w);
      else lines.push({ y: p.y, ws: [p.w] });
    });
  let rhythm = 0,
    counted = 0;
  const tops: number[] = [];
  lines.forEach(L => {
    const xs: number[] = [];
    r.groups.forEach((g, i) => {
      if (!L.ws.includes(g.word)) return;
      r.shapes[i].stemTops.forEach(([tx, ty]) => (xs.push(r.st[i].x + tx), tops.push(r.st[i].y + ty)));
    });
    xs.sort((a, b) => a - b);
    const gaps = xs.slice(1).map((x, k) => x - xs[k]);
    if (gaps.length < 2) return;
    const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    rhythm += Math.sqrt(gaps.reduce((a, g) => a + (g - m) ** 2, 0) / gaps.length) / Math.max(1e-6, m);
    counted++;
  });
  return {
    baselines,
    stemRhythm: counted ? rhythm / counted : 0,
    topLevels: tops.length ? Math.sqrt(twoLevels(tops) / tops.length) / nib : 0,
  };
}

/** A quad of ink, with its box. */
export interface Quad {
  p: Poly;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
/** The ink of strokes as the pen draws it, moved by (dx, dy): a quad for each step of each stroke that is not a
 *  mark, with its box. */
export function strokeQuads(th: Thuluth, strokes: readonly Stroke[], dx = 0, dy = 0): Quad[] {
  return strokes
    .filter(s => !s.mark)
    .flatMap(s => th.strokePolys(s))
    .map(q => {
      const p: Poly = q.map(([x, y]) => [x + dx, y + dy]),
        xs = p.map(v => v[0]),
        ys = p.map(v => v[1]);
      return { p, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    });
}
/** The ink of each piece as the pen draws it (a quad for each step of each letter stroke; no vowels or dots, which are
 *  placed afterwards and have their own checks), in composition coordinates. */
function inkQuads(th: Thuluth, r: Roundel): Quad[][] {
  return r.shapes.map((S, g) => strokeQuads(th, S.b.strokes, r.st[g].x, r.st[g].y));
}
const segPoint = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax,
    dy = by - ay,
    l2 = dx * dx + dy * dy,
    t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
const inside = (P: Poly, x: number, y: number) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++)
    if (P[i][1] > y !== P[j][1] > y && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0])
      c = !c;
  return c;
};
/** The distance between two polygons (0 when they meet). */
function polyGap(P: Poly, Q: Poly): number {
  let d = Infinity;
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i],
      [bx, by] = P[(i + 1) % P.length];
    for (let j = 0; j < Q.length; j++) {
      const [cx, cy] = Q[j],
        [ex, ey] = Q[(j + 1) % Q.length],
        den = (ey - cy) * (bx - ax) - (ex - cx) * (by - ay);
      if (den) {
        const u = ((ex - cx) * (ay - cy) - (ey - cy) * (ax - cx)) / den,
          v = ((bx - ax) * (ay - cy) - (by - ay) * (ax - cx)) / den;
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) return 0;
      }
      d = Math.min(d, segPoint(ax, ay, cx, cy, ex, ey), segPoint(cx, cy, ax, ay, bx, by));
    }
  }
  return inside(Q, P[0][0], P[0][1]) || inside(P, Q[0][0], Q[0][1]) ? 0 : d;
}
/** The gap between two sets of quads, ink edge to ink edge (0 when they touch). */
export function inkGap(A: readonly Quad[], B: readonly Quad[]): number {
  let d = Infinity;
  for (const a of A)
    for (const b of B) {
      // (apart by more than the least found so far: no need to look closer)
      if (Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1)) >= d) continue;
      d = Math.min(d, polyGap(a.p, b.p));
      if (d === 0) return 0;
    }
  return d;
}

/** The words that follow each other on a line, as pairs (the earlier first). The composer's own lines where it has
 *  them: a ruled composition's (a word riding on another is not on the line: its place is its host's to give); fitted
 *  lanes', found again as the split of the words, in reading order, into that many runs whose baselines agree best.
 *  Otherwise two words in turn whose baselines (their first letters') lie within 3 pens of each other. A companion
 *  text's words are not counted. */
export function linePairs(r: Roundel, nib: number): [number, number][] {
  const first: number[] = [];
  r.groups.forEach((g, i) => !g.comp && first[g.word] === undefined && (first[g.word] = i));
  const ws = first.map((_, w) => w).filter(w => first[w] !== undefined),
    base = (w: number) => r.st[first[w]].y + headOf(r.shapes[first[w]]).y,
    out: [number, number][] = [];
  if (r.ruled) {
    const rides = new Set(r.ruled.anchored),
      lineOf = (w: number) => r.ruled!.breaks.reduce((l, b, k) => (b <= w ? k : l), 0);
    let prev = -1;
    for (const w of ws) {
      if (rides.has(w)) continue;
      if (prev >= 0 && lineOf(prev) === lineOf(w)) out.push([prev, w]);
      prev = w;
    }
    return out;
  }
  if (r.lanes && ws.length > 1) {
    // the split into n runs with the least spread of baselines inside the runs
    const n = Math.min(r.lanes.n, ws.length),
      m = ws.length,
      ys = ws.map(base),
      sse = (a: number, b: number) => {
        const v = ys.slice(a, b),
          mu = v.reduce((s, y) => s + y, 0) / v.length;
        return v.reduce((s, y) => s + (y - mu) ** 2, 0);
      },
      best = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity)),
      cut = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    best[0][0] = 0;
    for (let k = 1; k <= n; k++)
      for (let e = k; e <= m; e++)
        for (let s = k - 1; s < e; s++) {
          const c = best[k - 1][s] + sse(s, e);
          if (c < best[k][e]) {
            best[k][e] = c;
            cut[k][e] = s;
          }
        }
    for (let k = n, e = m; k >= 1; e = cut[k][e], k--)
      for (let i = cut[k][e] + 1; i < e; i++) out.push([ws[i - 1], ws[i]]);
    return out.sort((a, b) => a[0] - b[0]);
  }
  for (let i = 1; i < ws.length; i++)
    if (Math.abs(base(ws[i]) - base(ws[i - 1])) < 3 * nib) out.push([ws[i - 1], ws[i]]);
  return out;
}

export interface WordGaps {
  /** Each pair of words that follow each other on a line: the gap between their inks (pen units, 0 when they touch),
   *  and the widest gap between the pieces inside either word. */
  pairs: { a: number; b: number; clear: number; inner: number }[];
  wordPairs: number;
  wordClear: number | null;
  wordClearNibs: number | null;
  wordInner: number;
  wordsRunOn: number;
}
/** The space between words that follow each other on a line, against the space inside them: a reader finds the words
 *  by the gaps between them being wider than the gaps within them (after ر, د, و, ا). */
export function wordGaps(th: Thuluth, r: Roundel): WordGaps {
  const nib = th.style.nib,
    quads = inkQuads(th, r),
    lines = linePairs(r, nib),
    ofWord = (w: number) => r.groups.flatMap((g, i) => (g.word === w && !g.comp ? quads[i] : [])),
    // the widest gap between a piece and the piece before it in its word
    innerOf = new Map<number, number>(),
    inner = (w: number) => {
      let v = innerOf.get(w);
      if (v === undefined) {
        v = 0;
        for (let i = 1; i < r.groups.length; i++)
          if (r.groups[i].word === w && r.groups[i - 1].word === w && !r.groups[i].newWord && !r.groups[i].comp)
            v = Math.max(v, inkGap(quads[i - 1], quads[i]));
        innerOf.set(w, v);
      }
      return v;
    },
    pairs = lines.map(([a, b]) => ({ a, b, clear: inkGap(ofWord(a), ofWord(b)), inner: Math.max(inner(a), inner(b)) })),
    wordClear = pairs.length ? Math.min(...pairs.map(p => p.clear)) : null;
  return {
    pairs,
    wordPairs: pairs.length,
    wordClear,
    wordClearNibs: wordClear == null ? null : wordClear / nib,
    wordInner: Math.max(0, ...pairs.map(p => p.inner)),
    wordsRunOn: pairs.filter(p => p.clear <= p.inner).length,
  };
}

export function roundelChecks(th: Thuluth, r: Roundel, f: Finished): RoundelChecks {
  const nib = th.style.nib,
    pts = inkPoints(r);
  // space within a word: the closest approach of consecutive pieces of one word
  let wordSpace = 0;
  for (let i = 1; i < r.groups.length; i++) {
    if (r.groups[i].word !== r.groups[i - 1].word || r.groups[i].newWord) continue;
    const A = pts.filter(p => p.g === i - 1),
      B = grid(
        pts.filter(p => p.g === i),
        2,
      );
    let d = Infinity;
    for (const p of A) for (const q of B.near(p.x, p.y, 8)) d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y));
    // centrelines: the gap between the ink edges is about a pen less
    if (d - nib > 2 * nib) wordSpace += Math.min(d, 9) - 3 * nib;
  }
  // marks and dots: their own letter's ink against everyone else's
  let strayMarks = 0,
    strayDots = 0;
  for (const it of f.solved?.items ?? []) {
    if (!it.key || (it.kind !== 'mark' && it.kind !== 'dots')) continue;
    const [g, li] = it.key.split(':').map(Number),
      word = r.groups[g]?.word;
    if (it.kind === 'mark') {
      const own = nearest(pts, it.x, it.y, p => r.groups[p.g].word === word),
        other = nearest(pts, it.x, it.y, p => r.groups[p.g].word !== word);
      if (other + nib < own) strayMarks++;
    } else {
      const own = nearest(pts, it.x, it.y, p => p.g === g && p.li === li),
        other = nearest(pts, it.x, it.y, p => (p.g !== g || p.li !== li) && p.li >= 0);
      if (other + nib < own) strayDots++;
    }
  }
  // doubled ink: a sample running along another stroke (or a far part of its own) within a fifth of a pen, the same way
  const G = grid(pts, nib),
    byStroke = new Map<number, Pt[]>();
  for (const p of pts) {
    if (!byStroke.has(p.st)) byStroke.set(p.st, []);
    byStroke.get(p.st)!.push(p);
  }
  const tangent = (p: Pt) => {
    const line = byStroke.get(p.st)!,
      a = line[Math.max(0, p.k - 1)],
      b = line[Math.min(line.length - 1, p.k + 1)],
      l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return [(b.x - a.x) / l, (b.y - a.y) / l];
  };
  let doubled = 0;
  for (const line of byStroke.values())
    for (let k = 1; k < line.length; k++) {
      const p = line[k],
        seg = Math.hypot(p.x - line[k - 1].x, p.y - line[k - 1].y),
        // each pair once, and only between different letters: a letter retracing its own course or built of strokes
        // that overlap (the initial hah's head, a lam's stem over its join) is its design
        twin = G.near(p.x, p.y, nib * 0.2).find(
          q =>
            (q.st > p.st || (q.st === p.st && q.k > p.k + 20)) &&
            (q.g !== p.g || (q.li !== p.li && q.li >= 0 && p.li >= 0)),
        );
      if (!twin) continue;
      const [ax, ay] = tangent(p),
        [bx, by] = tangent(twin);
      if (Math.abs(ax * bx + ay * by) > 0.9) doubled += seg;
    }
  const { wordPairs, wordClear, wordClearNibs, wordInner, wordsRunOn } = wordGaps(th, r);
  return { wordSpace, strayMarks, strayDots, doubled, marksUnplaced: f.marksUnplaced, wordPairs, wordClear, wordClearNibs, wordInner, wordsRunOn, ...alignment(r, nib) }; // prettier-ignore
}

/** Letters with an eye (a closed or nearly closed head): a crossing there blinds it. */
const EYED = new Set(['ف', 'ق', 'و', 'م', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ه', 'ة']);
export interface Crossings {
  /** A stem passing through a horizontal: the crossing girift seeks. */
  stemHorizontal: number;
  /** Crossings touching a curve or an elbow, and those through a letter's eye (Derman: crossings only on straight
   *  runs, never at the heads of eyed letters). */
  curve: number;
  eye: number;
}
/** Crossings between the strokes of different words, found exactly (segment against segment) and classed by the
 *  letter each segment belongs to and its direction. */
export function crossings(r: Roundel): Crossings {
  type Seg = { ax: number; ay: number; bx: number; by: number; word: number; kind: 'stem' | 'horizontal' | 'curve' | 'eye' }; // prettier-ignore
  const segs: Seg[] = [];
  r.shapes.forEach((S, g) => {
    const letter = new Map(S.b.placed.flatMap(p => ('g' in p ? [[p.li, p.c] as [number, string]] : [])));
    S.b.strokes.forEach(st => {
      if (st.mark) return;
      for (let k = 0; k + 1 < st.s.length; k += 2) {
        const p = st.s[k],
          q = st.s[Math.min(st.s.length - 1, k + 2)],
          c = letter.get(st.own?.[k] ?? -1) ?? '',
          a = Math.abs(Math.atan2(q.y - p.y, q.x - p.x)),
          horiz = a < 0.38 || a > Math.PI - 0.38,
          upright = Math.abs(a - Math.PI / 2) < 0.45,
          kind = upright && STEM_LETTERS.has(c) ? 'stem' : horiz ? 'horizontal' : EYED.has(c) ? 'eye' : 'curve';
        segs.push({ ax: p.x + r.st[g].x, ay: p.y + r.st[g].y, bx: q.x + r.st[g].x, by: q.y + r.st[g].y, word: r.groups[g].word, kind }); // prettier-ignore
      }
    });
  });
  const cross = (s: Seg, t: Seg) => {
    const d = (t.by - t.ay) * (s.bx - s.ax) - (t.bx - t.ax) * (s.by - s.ay);
    if (!d) return false;
    const u = ((t.bx - t.ax) * (s.ay - t.ay) - (t.by - t.ay) * (s.ax - t.ax)) / d,
      v = ((s.bx - s.ax) * (s.ay - t.ay) - (s.by - s.ay) * (s.ax - t.ax)) / d;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1;
  };
  const out: Crossings = { stemHorizontal: 0, curve: 0, eye: 0 };
  // a grid of cells, so only nearby segments are compared
  const cell = 3,
    grid = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (let x = Math.floor(Math.min(s.ax, s.bx) / cell); x <= Math.floor(Math.max(s.ax, s.bx) / cell); x++)
      for (let y = Math.floor(Math.min(s.ay, s.by) / cell); y <= Math.floor(Math.max(s.ay, s.by) / cell); y++) {
        const k = x + ',' + y;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push(i);
      }
  });
  const seen = new Set<string>();
  for (const ids of grid.values())
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++) {
        const [i, j] = ids[a] < ids[b] ? [ids[a], ids[b]] : [ids[b], ids[a]],
          s = segs[i],
          t = segs[j];
        if (s.word === t.word || seen.has(i + ':' + j) || !cross(s, t)) continue;
        seen.add(i + ':' + j);
        const kinds = [s.kind, t.kind];
        if (kinds.includes('eye')) out.eye++;
        else if (kinds.includes('curve')) out.curve++;
        else if (kinds.includes('stem') && kinds.includes('horizontal')) out.stemHorizontal++;
      }
  return out;
}
