// Checks on a finished roundel, made exact by stroke ownership (every sample knows its group and letter). They are
// reported numbers, not part of the score, until the owner's ratings show they predict his choices (PLAN-2 §1).
//   wordSpace: a word broken by too wide a gap between its pieces reads as two words;
//   strayMarks: a vowel nearer another word's letters than its own reads as that word's;
//   strayDots: a dot group nearer another letter than its own is misread;
//   doubled: ink run twice along the same course by two different letters. A letter's own overlaps are its design,
//   and a redraw cannot leave old ink behind (redraw() replaces it).
import type { Thuluth } from '../engine';
import type { Roundel } from './compose';
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
  return { wordSpace, strayMarks, strayDots, doubled };
}
