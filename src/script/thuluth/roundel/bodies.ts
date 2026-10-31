// Letter bodies, and the reading order between words judged from them. A reader finds a word by its letters' bodies:
// the teeth, heads, loops and feet that sit on the baseline. Stems rise out of the body and tails sweep away from it,
// and both may pass through another word without confusing the eye; a body may not. So a composition reads in order
// (from the top down, each line from the right) when, for any two words, every body of the later word lies to the left
// of the earlier word's bodies where it is level with them, and below them otherwise. A dropped letter (a stacked مـن)
// that lands under the next word, a word slid in to the right of another's dropped letters, or a word set up and away
// from the one before it breaks this, and that was what made the dense roundels unreadable: the letters were clear,
// the order was not.
import { isLetter } from '../engine';
import type { Roundel } from './compose';
import { FAM, familyOf } from '../shape';
import type { Family } from '../types';
import type { GroupShape, RGroup, Shelf } from './shapes';

/** A letter's body: the box of its ink about the baseline, in the group's own coordinates. */
export interface Body {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** The letter's index in its word. */
  li: number;
}

/** Final letters whose tail sweeps below the baseline (the tail is not part of the body). */
const TAILED = new Set<Family>(['nun', 'ra', 'ya', 'waw', 'mim', 'sad', 'qaf', 'ain', 'lam', 'fa', 'sin', 'kaf']);
/** Letters whose stem rises out of a low foot or bowl: the body stops where the stem begins. */
const STEMMED = new Set<Family>(['alif', 'lam', 'lamalif', 'kaf']);
/** How far a body reaches above its baseline (pen units at a group scale of 1): a stemmed letter's foot, any other
 *  letter's head (the medial hah's head stands 5.1 high at the roundel pen); and below it: a tail is cut just under the
 *  baseline, a loop (the medial mim dips 2 under) is kept. */
const FOOT = 2.8,
  HEAD = 5.4,
  UNDER = 2.3,
  UNDER_TAIL = 0.9;

const BODIES = new WeakMap<GroupShape, { sc: number; bodies: Body[] }>();
/** The bodies of a group's letters, each the box of the skeleton points that lie in the body's band, grown by half a
 *  pen. Kashidas, stacked joins and dots are not bodies. `scale` is the group's (a conjunction scaled down by hand
 *  after it was built keeps its letters' placement but not their scale). */
export function letterBodies(S: GroupShape, nib = 1.6, scale?: number): Body[] {
  const hit = BODIES.get(S);
  if (hit && hit.sc === (scale ?? -1)) return hit.bodies;
  const out: Body[] = [];
  for (const p of S.b.placed) {
    if (!isLetter(p)) continue;
    const sc = scale ?? p.sc ?? 1,
      fam = familyOf(p.c, p.form) ?? FAM[p.c],
      tailed = TAILED.has(fam) && (p.form === 'fin' || p.form === 'iso'),
      lo = -(tailed ? UNDER_TAIL : UNDER) * sc,
      hi = (STEMMED.has(fam) ? FOOT : HEAD) * sc,
      oy = p.oy || 0;
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const st of p.g.s)
      for (const q of st.pts) {
        const y = q[1] * sc;
        if (y < lo || y > hi) continue;
        const x = q[0] * sc + p.ox;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y + oy);
        y1 = Math.max(y1, y + oy);
      }
    if (x0 === Infinity) continue;
    const m = (nib / 2) * sc;
    out.push({ x0: x0 - m, x1: x1 + m, y0: y0 - m, y1: y1 + m, li: p.li });
  }
  BODIES.set(S, { sc: scale ?? -1, bodies: out });
  return out;
}

export interface ReadingInput {
  groups: readonly RGroup[];
  shapes: readonly GroupShape[];
  pos: ArrayLike<{ x: number; y: number }>;
  nib?: number;
  /** Judge one body lying on another too (true). Girift seeks interpenetration, so a composition with the dial on is
   *  judged for level and column order only. */
  clash?: boolean;
}
/** A pair of bodies out of reading order: the earlier and the later group and letter, and how far they overlap in
 *  the direction that puts them out of order (pen units). */
export interface ReadingFaultPair {
  a: { g: number; li: number };
  b: { g: number; li: number };
  /** 'level': the later body is level with the earlier one and to its right; 'above': it stands higher; 'clash': it
   *  lies on it. */
  kind: 'level' | 'above' | 'clash';
  v: number;
}

/** Bodies overlap by more than this (pen units) before they count as level, and a later body may stand this much
 *  above an earlier one's top before it counts as higher. A single pair's fault is capped at CAP, so one bad pair
 *  cannot outweigh everything else. */
const TOL = 0.6,
  CAP = 4;

/** The reading-order fault of an arrangement: for each pair of words in reading order, the sum over their body pairs
 *  that break the order of the squared breach (pen units, capped), so one dropped letter under the next word costs
 *  more than many near misses. 0 when the composition reads in order: every later body stands left of the earlier
 *  bodies it is level with, and no higher than any other.
 *
 *  A word riding on another word's shelf (an elongation or a bowl, with every body over the shelf's span) is a
 *  deliberate device and is not judged against its host; companion text, read apart, is not judged at all. */
export function readingFault(inp: ReadingInput, detail?: ReadingFaultPair[]): number {
  const { groups, shapes, pos } = inp,
    nib = inp.nib ?? 1.6;
  // bodies in composition coordinates, by group
  const B: Body[][] = shapes.map(
    (S, i) =>
    letterBodies(S, nib, groups[i].sc).map(b => ({ ...b, x0: b.x0 + pos[i].x, x1: b.x1 + pos[i].x, y0: b.y0 + pos[i].y, y1: b.y1 + pos[i].y })), // prettier-ignore
  );
  const words = new Map<number, number[]>();
  groups.forEach((g, i) => {
    if (g.comp) return;
    if (!words.has(g.word)) words.set(g.word, []);
    words.get(g.word)!.push(i);
  });
  const shelvesOf = (gs: number[]): Shelf[] =>
    gs.flatMap(i => shapes[i].shelves.map(sh => ({ ...sh, x0: sh.x0 + pos[i].x, x1: sh.x1 + pos[i].x, y: sh.y + pos[i].y }))); // prettier-ignore
  // on an elongation, every body within its span; in a bowl, the word's middle within the bowl's span (the bowl is
  // redrawn wider once the layout is chosen, so its recorded span is the narrower)
  const rides = (bs: Body[], shelves: Shelf[]) => {
    if (!bs.length) return false;
    const mid = (Math.min(...bs.map(b => b.x0)) + Math.max(...bs.map(b => b.x1))) / 2;
    return shelves.some(sh =>
      sh.cradle
        ? mid >= sh.x0 - 1 && mid <= sh.x1 + 1 && bs.every(b => b.y0 >= sh.y - 0.5)
        : bs.every(b => b.x0 >= sh.x0 - 1 && b.x1 <= sh.x1 + 1 && b.y0 >= sh.y - 0.5),
    );
  };
  let f = 0;
  const ws = [...words.keys()].sort((a, b) => a - b);
  for (let ia = 0; ia < ws.length; ia++)
    for (let ib = ia + 1; ib < ws.length; ib++) {
      const ga = words.get(ws[ia])!,
        gb = words.get(ws[ib])!,
        bb = gb.flatMap(i => B[i]);
      // a later word set on an earlier word's shelf, or an earlier word in a later word's bowl: a deliberate device
      if (
        rides(bb, shelvesOf(ga)) ||
        rides(
          ga.flatMap(i => B[i]),
          shelvesOf(gb),
        )
      )
        continue;
      for (const i of ga)
        for (const A of B[i])
          for (const j of gb)
            for (const Bb of B[j]) {
              const ox = Math.min(A.x1, Bb.x1) - Math.max(A.x0, Bb.x0),
                oy = Math.min(A.y1, Bb.y1) - Math.max(A.y0, Bb.y0);
              let kind: ReadingFaultPair['kind'] | null = null,
                v = 0;
              if (oy > TOL && ox > TOL) {
                // one body on another
                if (inp.clash === false) continue;
                kind = 'clash';
                v = Math.min(ox, oy);
              } else if (oy > TOL) {
                // level: the later body must end left of where the earlier one begins
                v = Bb.x1 - A.x0 - TOL;
                if (v > 0) kind = 'level';
              } else if (Bb.y0 > A.y1 + TOL) {
                // higher: the later body must lie below the earlier one (how far it would have to drop)
                v = Bb.y1 - A.y0 - TOL;
                if (v > 0) kind = 'above';
              }
              if (!kind) continue;
              v = Math.min(CAP, v);
              f += v * v;
              detail?.push({ a: { g: i, li: A.li }, b: { g: j, li: Bb.li }, kind, v });
            }
    }
  return f;
}

/** The reading fault of a composed roundel (for the judge, the checks and the critic). */
export const roundelReadingFault = (r: Roundel, nib?: number, detail?: ReadingFaultPair[]) =>
  readingFault({ groups: r.groups, shapes: r.shapes, pos: r.st, nib }, detail);
