// The roundel and cartouche composer (lab roundel.js composeRoundel): the groups of a phrase are placed by simulated
// annealing to fill a disc or an oval, keeping the reading order, with word moves, variant swaps, and lifts onto
// shelves (an elongation, a long final) and into cradles (a great bowl). A recorded layout (`fixed`) rebuilds a chosen
// arrangement exactly, so letters can be refined without the layout reshuffling.
import { discKernel } from '../../../kernels/roundel';
import type { Thuluth } from '../engine';
import type { ThuluthStyle } from '../types';
import { isLetter } from '../engine';
import { parkMiller } from '../rng';
import { allahSpan, ligate, parseVowels, splitGroups, STEM_LETTERS } from '../shape';
import type { FieldName } from './fields';
import { FIELDS, fieldLanes } from './fields';
import type { ReadingPath } from './paths';
import { fitLanes, pathTargets, PATHS } from './paths';
import type { GroupShape, RGroup, StackOptions } from './shapes';
import { groupVariants } from './shapes';

export interface Disc {
  cx: number;
  cy: number;
  r: number;
  ink: number;
  /** Width over height (1 = a circle). */
  oval: number;
  /** A shaped field instead (fields.ts): r is then its half-height. */
  field?: FieldName;
}
/** A pinned arrangement: the variant of each group, and where each word sits. */
export interface Layout {
  lv: number[];
  wp: { x: number; y: number }[];
  /** The stacked pieces (by index), if any. */
  up?: number[];
  /** Pieces moved from where their word puts them (pen units, y up): a hand adjustment, as the tuning page makes. */
  nudge?: { i: number; x: number; y: number }[];
}
export interface RoundelOptions extends StackOptions {
  tries?: number;
  iters?: number;
  seed?: number;
  /** Stems may pass through horizontals cheaply; stems may merge with stems. */
  cross?: boolean;
  merge?: boolean;
  /** Girift, interpenetration: a stem crossing a horizontal earns this much per pixel instead of costing, and overlap
   *  touching a curve or an eye costs 1.6 (0.04 is safe; 0.12 collapses a text into one knot, which the owner ranked
   *  4th and 5th for the basmala). */
  girift?: number;
  /** Fill to aim for, and the field's proportion. */
  fillTarget?: number;
  oval?: number;
  /** A later word may not rise above the start of the one before; one top line for the stems; the word read first
   *  on top where words overlap. */
  noRise?: boolean;
  ceiling?: boolean;
  topFirst?: boolean;
  /** Words may sit in great bowls. */
  cradle?: boolean;
  /** Kern the pieces of a word broken by a non-joining letter (slide together on bare ink), and how much touch is
   *  allowed. */
  kern?: boolean;
  kernTouch?: number;
  /** Nest the piece of a word after a tailed letter (ra, zay, waw, ya) into the curve of its tail: slid right over it
   *  and dropped into it, as far as it goes without touching. */
  nest?: boolean;
  /** Stack: the search may lift a piece of a word above the piece before it, slid back over it, so a word rises in
   *  layers (each lift is a move it can make or undo). */
  stack?: boolean;
  /** Groups (by their letters) written only with a stacked join where they have one (the shin above the mim of
   *  شمير), so a word gains height about that letter. */
  stackAt?: string[];
  /** A short companion text set smaller among the words, and its scale. */
  companion?: string;
  companionScale?: number;
  /** A shaped field (fields.ts: pear, drop, tulip, mihrab, hull): the letters keep inside its outline, its proportion
   *  replaces oval, and lanes become its chords. */
  field?: FieldName;
  /** A reading path (paths.ts): the words keep near their targets along it, in reading order. A name from PATHS, the
   *  path itself, or 'auto' (buildRoundel tries each of AUTO_PATHS and keeps the best as finished). */
  path?: string | ReadingPath;
  /** Fitted lanes: parallel lanes across the field at `deg` (180, level, by default), their number and spacing
   *  chosen to suit the text. Ignored with `path`. */
  lanes?: { deg?: number; n?: number; bandFrac?: number };
  /** The path's length as a share of the text's width (0.7); how far a word may stray from its target before it
   *  pays (1.4), and how much (0.6). */
  pathFill?: number;
  pathTol?: number;
  pathW?: number;
  /** On a path, the reading rules (on by default): a later word at about the same height as an earlier one lies to
   *  its left (readW), and no later word's baseline climbs more than orderSlack above the one before (orderFirm).
   *  Heights are read from baselines, not boxes: tall stems make boxes overlap. */
  readRule?: boolean;
  readW?: number;
  orderFirm?: number;
  orderSlack?: number;
  /** Ruled composition, the constrained mode (true for the defaults): see RuledOptions. Replaces path and lanes. */
  ruled?: boolean | RuledOptions;
  fixed?: Layout;
  /** The clear space kept between words that follow each other on a line (pen units, ink edge to ink edge; a nib is
   *  the pen's `nib`; absent or 0: none asked, and words may touch). Ruled: a word slides in after the one before
   *  only until this much space is left between them, instead of until they touch. On a path or in lanes: two words
   *  in turn on the same stretch of the path pay for standing closer; with neither, two words in turn on about the
   *  same baseline do, unless one lies over the other (riding on its shelf or in its bowl, which sets its own space).
   *  The pieces of one word are not held apart by it: stacking, nesting and kerning place those. */
  wordGap?: number;
  /** The clear space set between the pieces of a word broken by a non-joining letter (pen units, ink edge to ink edge;
   *  absent or 0: off, and `kern` alone places them). Each piece slides in after the one before, on their baseline,
   *  until exactly this much space is left between their inks, measured on the pen's own outlines wherever the two
   *  come nearest: so it runs in over a tail (a ra's, a waw's) and under an overhanging head (an initial hah's) as
   *  far as the letters' bodies allow, and it stops short of an alif it would otherwise touch. It keeps the space
   *  from every piece before it on the baseline, not only the last; dots keep half of it. It kerns whether or not
   *  `kern` is set; a piece that is stacked, or nested in a tail (`nest`), is placed by those instead. */
  innerGap?: number;
}
/** Ruled composition: the structure is fixed and the search only fills it. The baselines are ruled as the field's
 *  chords, read from the top down; each word sits exactly on its line, the words of a line in reading order from the
 *  right, packed tight (each slides in until it would touch the one before, so tails run under the next word), and the
 *  line's slack is shared out evenly between its words. The search moves the line breaks, the variants (elongations
 *  take up slack, so a line is justified by kashida rather than space), the stacks, the anchors and the line pitch;
 *  stem rhythm and the axis are preferences it weighs. */
export interface RuledOptions {
  /** The number of lines (fitted to the text, and varied from try to try, if not given). */
  lines?: number;
  /** A word may ride on the elongation or in the bowl of the word before it on its line, read straight after it. */
  anchors?: boolean;
  /** The widest even gap between words (pen units, 2) before a line pays, and how much a line's slack or overflow
   *  costs (4). */
  maxGap?: number;
  justify?: number;
  /** Weights (1 each): the stems' rhythm (their tops evenly spaced along each line, and on one or two common
   *  heights), and the axis (the longest stroke centred on it). */
  rhythm?: number;
  axis?: number;
}
export interface Roundel {
  E: number;
  overlap: number;
  disc: Disc;
  /** Group positions. */
  st: { x: number; y: number }[];
  shapes: GroupShape[];
  groups: RGroup[];
  lv: number[];
  wp: { x: number; y: number }[];
  /** The stacked pieces (by index). */
  up: number[];
  /** How much the great bowl had to widen to clear the letters (0: not at all), once it is drawn. */
  bowlGrow?: number;
  /** The lanes fitted, if lanes were asked for (and the lines of a ruled composition). */
  lanes?: { n: number; gap: number };
  /** A ruled composition: the first word of each line, and the words riding on the word before them. */
  ruled?: { breaks: number[]; anchored: number[] };
  /** Tails drawn out under what nests in them; stems risen into the space above. */
  tailsDrawn?: number;
  risen?: number;
}

/** Where a group's reading starts: the right edge of its first letter, and that letter's baseline, in the group's own
 *  coordinates. Reading order is judged from these, not from boxes: a tall stem or a long tail makes a word's box
 *  reach far from where the eye starts reading it. */
// (kept for each shape with what it was read from: a shape is redrawn in place when its group is scaled, bowl.ts
// scaleGroup, and what was kept before that is then not its head)
const HEADS = new WeakMap<GroupShape, { head: { x: number; y: number }; g: unknown; ox: number; oy: number; sc: number; x1: number }>(); // prettier-ignore
export function headOf(S: GroupShape): { x: number; y: number } {
  const p = S.b.placed.find(isLetter),
    ox = p?.ox ?? 0,
    oy = p?.oy || 0,
    sc = p?.sc ?? 1;
  let h = HEADS.get(S);
  if (!h || h.g !== p?.g || h.ox !== ox || h.oy !== oy || h.sc !== sc || h.x1 !== S.x1) {
    const head = p
      ? { x: ox + Math.max(...p.g.s.flatMap(st => st.pts.map(q => q[0] * sc))), y: oy }
      : { x: S.x1, y: 0 };
    HEADS.set(S, (h = { head, g: p?.g, ox, oy, sc, x1: S.x1 }));
  }
  return h.head;
}

/** Reading order of stacked pieces: a piece lifted above the one before it must stay in its own word's line, not land
 *  in an earlier word's (a ta marbuta stacked up onto another word's stroke reads out of order). How far each such
 *  piece rises above the line of an earlier piece it lies over, squared and summed; 0 when the order holds. */
export function orderFault(
  groups: readonly RGroup[],
  boxes: readonly { x0: number; x1: number; y0: number; y1: number; base: number }[],
  up: ArrayLike<number>,
): number {
  let f = 0;
  for (let j = 0; j < groups.length; j++) {
    if (!up[j]) continue;
    const B = boxes[j],
      mid = (B.y0 + B.y1) / 2;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].word >= groups[j].word) continue;
      const A = boxes[i];
      if (Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) < 0.5) continue;
      const v = mid - (A.base - 0.5);
      if (v > 0) f += v * v;
    }
  }
  return f;
}

/** The order fault of a composed roundel (for the critic). */
export const roundelOrderFault = (r: Roundel) =>
  orderFault(
    r.groups,
    r.shapes.map((S, i) => ({ x0: r.st[i].x + S.x0, x1: r.st[i].x + S.x1, y0: r.st[i].y + S.y0, y1: r.st[i].y + S.y1, base: r.st[i].y })), // prettier-ignore
    Object.assign(new Uint8Array(r.groups.length), Object.fromEntries((r.up || []).map(i => [i, 1]))),
  );

/** How far heights fall from one or two common levels: the least sum of squared deviations over every split of the
 *  sorted heights into a lower and an upper level. */
export function twoLevels(ys: readonly number[]): number {
  const v = [...ys].sort((a, b) => a - b),
    // (of v from `from` up to `to`)
    sse = (from: number, to: number) => {
      let s = 0,
        e = 0;
      for (let k = from; k < to; k++) s += v[k];
      const m = s / (to - from || 1);
      for (let k = from; k < to; k++) e += (v[k] - m) ** 2;
      return e;
    };
  let best = sse(0, v.length);
  for (let k = 1; k < v.length; k++) best = Math.min(best, sse(0, k) + sse(k, v.length));
  return best;
}

/** For the clear space between words (wordGap): how far each pixel round a shape's ink lies from it (pixels, up to
 *  `P` away, P + 1 beyond; the bitmap grown by P on every side), and the ink's edge pixels (x, y in turn). */
interface Near {
  P: number;
  W: number;
  H: number;
  d: Float32Array;
  edge: Int32Array;
}
const NEARS = new WeakMap<GroupShape, Near>();
function nearOf(S: GroupShape, P: number): Near {
  const kept = NEARS.get(S);
  if (kept && kept.P >= P) return kept;
  const W = S.W + 2 * P,
    H = S.H + 2 * P,
    d = new Float32Array(W * H).fill(P + 1),
    edge: number[] = [],
    m = S.mask,
    // the pixels within P of one, and how far each is
    disc: number[] = [];
  for (let dy = -P; dy <= P; dy++)
    for (let dx = -P; dx <= P; dx++) {
      const r = Math.hypot(dx, dy);
      if (r <= P) disc.push(dy * W + dx, r);
    }
  for (let y = 0; y < S.H; y++)
    for (let x = 0; x < S.W; x++) {
      if (!m[y * S.W + x]) continue;
      const at = (y + P) * W + x + P;
      // ink with ink on every side is no nearer anything than its neighbours are
      if (x > 0 && x + 1 < S.W && y > 0 && y + 1 < S.H && m[y * S.W + x - 1] && m[y * S.W + x + 1] && m[(y - 1) * S.W + x] && m[(y + 1) * S.W + x]) {
        d[at] = 0;
        continue;
      } // prettier-ignore
      edge.push(x, y);
      for (let k = 0; k < disc.length; k += 2) if (disc[k + 1] < d[at + disc[k]]) d[at + disc[k]] = disc[k + 1];
    }
  const f = { P, W, H, d, edge: Int32Array.from(edge) };
  NEARS.set(S, f);
  return f;
}

/** For the space inside a word (innerGap): a shape's ink as the pen draws it, seen from the left and from the right.
 *  In bands SIDE_H high (band k holds the heights from (k0 + k) * SIDE_H up), the least and the greatest x of the
 *  letters' ink (lo, hi: ±Infinity where a band has none), and the same with the dots counted (dlo, dhi). */
interface Sides {
  k0: number;
  n: number;
  lo: Float64Array;
  hi: Float64Array;
  dlo: Float64Array;
  dhi: Float64Array;
}
/** The space a piece keeps from a tall stem it faces in its word, in nibs, with the drafted stems (alts.stems). */
export const STEM_CLEAR = 0.6;
const SIDE_H = 0.1,
  SIDES = new WeakMap<GroupShape, Sides>();
function sidesOf(th: Thuluth, S: GroupShape): Sides {
  let f = SIDES.get(S);
  if (f) return f;
  const k0 = Math.floor(S.y0 / SIDE_H) - 1,
    n = Math.ceil(S.y1 / SIDE_H) + 2 - k0,
    lo = new Float64Array(n).fill(Infinity),
    hi = new Float64Array(n).fill(-Infinity),
    // (an outline's extremes in a band lie on its edges: each edge walked in steps well under a band)
    walk = (polys: readonly (readonly (readonly number[])[])[], a: Float64Array, b: Float64Array) => {
      for (const q of polys)
        for (let i = 0; i < q.length; i++) {
          const [ax, ay] = q[i],
            [bx, by] = q[(i + 1) % q.length],
            m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (SIDE_H * 0.4)));
          for (let t = 0; t <= m; t++) {
            const x = ax + ((bx - ax) * t) / m,
              k = Math.floor((ay + ((by - ay) * t) / m) / SIDE_H) - k0;
            if (k < 0 || k >= n) continue;
            if (x < a[k]) a[k] = x;
            if (x > b[k]) b[k] = x;
          }
        }
    };
  for (const st of S.b.strokes) if (!st.mark) walk(th.strokePolys(st), lo, hi);
  const dlo = lo.slice(),
    dhi = hi.slice();
  for (const [x, y, sc, rot] of S.b.dots) walk(th.dotPolysAt(x, y, sc ?? 1, rot ?? 0), dlo, dhi);
  f = { k0, n, lo, hi, dlo, dhi };
  SIDES.set(S, f);
  return f;
}
/** How far to the right a shape B, its ink lying to the left of A's on the same baseline, can move before less than
 *  `c` is left between the two (pen units; Infinity when it could pass A by): the first place where any of B's ink
 *  seen from the right comes within c of any of A's seen from the left. Heights are taken band by band, two bands
 *  counted a band nearer than they are, so it errs by at most that on the side of more space. */
function slideRoom(lo: Float64Array, k0a: number, hi: Float64Array, k0b: number, c: number): number {
  const reach = Math.ceil(c / SIDE_H) + 1,
    near = new Float64Array(reach + 1);
  for (let d = 0; d <= reach; d++) {
    const dy = Math.max(0, d - 1) * SIDE_H;
    near[d] = dy < c ? Math.sqrt(c * c - dy * dy) : -1;
  }
  let room = Infinity;
  for (let b = 0; b < hi.length; b++) {
    const xb = hi[b];
    if (xb === -Infinity) continue;
    const at = b + k0b - k0a;
    for (let a = Math.max(0, at - reach), e = Math.min(lo.length - 1, at + reach); a <= e; a++) {
      const w = near[Math.abs(a - at)];
      if (w >= 0 && lo[a] - xb - w < room) room = lo[a] - xb - w;
    }
  }
  return room;
}

/** Each row's first and one-past-last nonzero column of a W × H bitmap (an empty row gives [W, 0]). */
const SPANS = new WeakMap<Uint8Array, Int32Array>();
function spans(m: Uint8Array, W: number, H: number): Int32Array {
  let r = SPANS.get(m);
  if (!r) {
    r = new Int32Array(2 * H);
    for (let y = 0; y < H; y++) {
      let a = W,
        b = 0;
      for (let x = 0; x < W; x++)
        if (m[y * W + x]) {
          if (a === W) a = x;
          b = x + 1;
        }
      r[2 * y] = a;
      r[2 * y + 1] = b;
    }
    SPANS.set(m, r);
  }
  return r;
}

/** The points of a hull that can be the farthest of it from anywhere: those on its convex outline, or within a hair
 *  (a millionth of a pen unit) of it, in their order. The enclosing disc is the same number with only these: a point
 *  left out lies inside the outline by that margin, so from any centre, in any oval's metric, a point kept is farther
 *  by a margin far beyond rounding, and the box of the points is the box of the outline. */
const RIMS = new WeakMap<readonly (readonly [number, number])[], [number, number][]>();
function rimOf(hull: [number, number][]): [number, number][] {
  let rim = RIMS.get(hull);
  if (rim) return rim;
  rim = hull;
  if (hull.length > 6 && hull.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))) {
    const cross = (o: readonly number[], a: readonly number[], b: readonly number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); // prettier-ignore
    const sorted = [...hull].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
      H: [number, number][] = [];
    for (const p of sorted) {
      while (H.length >= 2 && cross(H[H.length - 2], H[H.length - 1], p) <= 0) H.pop();
      H.push(p);
    }
    const lower = H.length + 1;
    for (let k = sorted.length - 2; k >= 0; k--) {
      while (H.length >= lower && cross(H[H.length - 2], H[H.length - 1], sorted[k]) <= 0) H.pop();
      H.push(sorted[k]);
    }
    H.pop();
    // (the outline runs anticlockwise, so inside is to the left of each edge)
    if (H.length >= 3) {
      const len = H.map((a, k) => Math.hypot(H[(k + 1) % H.length][0] - a[0], H[(k + 1) % H.length][1] - a[1]));
      rim = hull.filter(p => H.some((a, k) => !(cross(a, H[(k + 1) % H.length], p) >= 1e-6 * len[k])));
    }
  }
  RIMS.set(hull, rim);
  return rim;
}

/** A text's groups as the composer arranges them (with a companion text's, and each group's marks, as the pen with
 *  this style writes them), and the options its group variants are built with; null when the text has no letters. */
export function roundelGroups(
  style: ThuluthStyle,
  text: string,
  o: RoundelOptions = {},
): { groups: RGroup[]; vopts: StackOptions } | null {
  const { bare, marks } = parseVowels(text);
  const groups: RGroup[] = splitGroups(bare);
  if (!groups.length) return null;
  // companion text joins the arrangement as extra, smaller words
  if (o.companion && o.companion.trim()) {
    const pc = parseVowels(o.companion),
      base = Math.max(...groups.map(g => g.word)) + 1,
      sc = o.companionScale || 0.42,
      wl = pc.bare.split(' ').map(w => [...ligate(w)].length),
      cm: { li: number; m: (typeof marks)[0][0]['m'] }[] = [];
    let lastW = -1;
    pc.marks.forEach((ms, wi) => {
      let o2 = 0;
      for (let j = 0; j < wi; j++) o2 += wl[j];
      ms.forEach(m => cm.push({ li: m.li + o2, m: m.m }));
    });
    splitGroups(pc.bare).forEach(g => {
      const gg: RGroup = { ...g, newWord: g.word !== lastW && lastW >= 0, word: base, sc, comp: true };
      lastW = g.word;
      groups.push(gg);
    });
    marks[base] = cm;
  }
  // marks per group: letter positions inside each group
  const wordStart: Record<number, number> = {};
  groups.forEach((g, i) => (wordStart[g.word] ??= i));
  groups.forEach((g, i) => {
    let off = 0;
    for (let j = wordStart[g.word]; j < i; j++) off += [...groups[j].s].length;
    g.marks = (marks[g.word] || [])
      .filter(m => m.li >= off && m.li < off + [...g.s].length)
      .map(m => ({ k: m.li - off, m: m.m }));
    // the ligature of the name of God draws the second lam's marks itself: the shadda on the lam, and the small alif,
    // when the text writes it, over the heh
    if (style.allah && g.allah) {
      const name = allahSpan(g.s),
        k = name ? name.lam + 1 : [...g.s].length - 2;
      if (g.marks.some(m => m.k === k && m.m === 'alifk')) g.alif = true;
      g.marks = g.marks.filter(m => m.k !== k);
    }
  });
  // alts.stems c: a piece that follows a tall stem in its word opens with the lesser head
  if (style.alts?.stems === 'c' && !style.labLetters)
    groups.forEach((g, i) => {
      const p = groups[i - 1];
      if (p && p.word === g.word && !g.newWord && !g.comp === !p.comp && STEM_LETTERS.has([...p.s].pop()!))
        g.led = true;
    });
  return { groups, vopts: { ...o, deep: true, tails: true, levels: o.levels ?? [0, 2, 4, 7] } };
}

/** The pieces of a phrase (its groups, with their marks) and every variant of each that the composer chooses among;
 *  a layout's `lv` indexes these. Null when the text has no letters. */
export function roundelPieces(
  th: Thuluth,
  text: string,
  o: RoundelOptions = {},
): { groups: RGroup[]; shapes: GroupShape[][] } | null {
  const K = o.K ?? 1.6,
    prep = roundelGroups(th.style, text, o);
  if (!prep) return null;
  const { groups, vopts } = prep;
  const shapes = groups.map(g => {
    const vs = groupVariants(th, g, vopts, K),
      st = o.stackAt?.includes(g.s) ? vs.filter(v => v.stacked) : [];
    return st.length ? st : vs;
  });
  return { groups, shapes };
}

/** The composer's tries (each from its own seed), best first. `only`: just those tries, in that order and unsorted
 *  (each try is independent of the others, so tries run apart and merged by number come out as all run together). */
export function composeRoundel(th: Thuluth, text: string, o: RoundelOptions = {}, only?: readonly number[]): Roundel[] {
  const tries = o.tries ?? 18,
    iters = o.iters ?? 6000,
    K = o.K ?? 1.6,
    seed = o.seed ?? 7;
  const pieces = roundelPieces(th, text, o);
  if (!pieces) return [];
  const { groups, shapes } = pieces;
  // a shaped field sets the proportion
  const OVAL = o.field ? FIELDS[o.field].aspect : o.oval || 1;
  const words: number[][] = [];
  groups.forEach((g, i) => (words[g.word] ??= []).push(i));
  const W = words.length,
    n = groups.length,
    GAP = 0.5;
  const pairOverlap = (A: GroupShape, ax: number, ay: number, B: GroupShape, bx: number, by: number, bare = false) => {
    const dx = Math.round((bx + B.x0 - (ax + A.x0)) * K),
      dy = Math.round((ay + A.y1 - (by + B.y1)) * K);
    const xs = Math.max(0, dx),
      xe = Math.min(A.W, dx + B.W),
      ys = Math.max(0, dy),
      ye = Math.min(A.H, dy + B.H);
    if (xs >= xe || ys >= ye) return 0;
    let c = 0;
    const gir = !!o.girift && !bare,
      cw = gir ? -o.girift! : o.cross ? 0.12 : 1,
      mw = o.merge ? 0.25 : 1,
      curve = gir ? 1.6 : 1,
      src = bare ? A.mask : A.dil;
    const sa = spans(src, A.W, A.H),
      sb = spans(B.mask, B.W, B.H);
    for (let y = ys; y < ye; y++) {
      const ra = y * A.W,
        rb = (y - dy) * B.W - dx,
        // only where both rows have ink (empty pixels add nothing)
        x0 = Math.max(xs, sa[2 * y], sb[2 * (y - dy)] + dx),
        x1 = Math.min(xe, sa[2 * y + 1], sb[2 * (y - dy) + 1] + dx);
      for (let x = x0; x < x1; x++) {
        const ta = src[ra + x],
          tb = B.mask[rb + x];
        // a stem may pass through a horizontal (in girift it is sought, and never at a curve or eye)
        if (ta && tb)
          c += (ta === 1 && tb === 2) || (ta === 2 && tb === 1) ? cw : ta === 1 && tb === 1 ? mw : ta === 3 || tb === 3 ? curve : 1; // prettier-ignore
      }
    }
    return c;
  };
  // wordGap: the clear space between two pieces (pen units, at most WG + a little), from the one's ink edge to the
  // other's distance field, on the same pixels as pairOverlap. The raster is coarse (a pixel is 1 / K of a pen unit,
  // each piece set on it to the nearest pixel, and a pixel is ink only when the pen covers enough of it), so the gap
  // is taken as the distance between pixels less CLEAR_SLOP: it errs on the side of more space.
  const WG = o.wordGap && o.wordGap > 0 ? o.wordGap : 0,
    CLEAR_SLOP = 1.5,
    NP = Math.ceil(WG * K + CLEAR_SLOP) + 1,
    pairClear = (A: GroupShape, ax: number, ay: number, B: GroupShape, bx: number, by: number) => {
      const f = nearOf(A, NP),
        e = nearOf(B, NP).edge,
        dx = Math.round((bx + B.x0 - (ax + A.x0)) * K) + f.P,
        dy = Math.round((ay + A.y1 - (by + B.y1)) * K) + f.P;
      let m = NP + 1;
      if (dx + B.W >= 0 && dx <= f.W && dy + B.H >= 0 && dy <= f.H)
        for (let k = 0; k < e.length; k += 2) {
          const x = e[k] + dx,
            y = e[k + 1] + dy;
          if (x < 0 || y < 0 || x >= f.W || y >= f.H) continue;
          const v = f.d[y * f.W + x];
          if (v < m) m = v;
        }
      return Math.max(0, m - CLEAR_SLOP) / K;
    };
  // the enclosing disc in WebAssembly (src/kernels/roundel.c), with every variant's hull registered once
  // (of each hull, only the points that can be the farthest: rimOf)
  const rims = shapes.map(vs => vs.map(v => rimOf(v.hull)));
  const DK = discKernel(rims.flat(), n);
  // How a piece sits against the piece before it in its word, for each pair of their variants: measured once and kept
  // for every try (each depends on the two shapes alone), in a table per piece (a piece always follows the same one).
  const IG = o.innerGap && o.innerGap > 0 ? o.innerGap : 0,
    touchMax = o.kernTouch ?? 3,
    tableOf = <T>(tables: (T | undefined)[][], i: number, j: number) => (tables[j] ??= new Array<T | undefined>(shapes[i].length * shapes[j].length)), // prettier-ignore
    kernT: (number | undefined)[][] = new Array(n),
    nestT: ([number, number] | undefined)[][] = new Array(n),
    stackT: ([number, number] | undefined)[][] = new Array(n);
  // innerGap: how far to the left of a piece A's place the place of a piece B on its baseline must stay for that much
  // space to be left between their letters (half of it where a dot is the nearer), kept for each pair of shapes
  const reaches = new Map<number, WeakMap<GroupShape, WeakMap<GroupShape, number>>>(),
    reachOf = (A: GroupShape, B: GroupShape, c = IG): number => {
      let forC = reaches.get(c);
      if (!forC) reaches.set(c, (forC = new WeakMap()));
      let forA = forC.get(A);
      if (!forA) forC.set(A, (forA = new WeakMap()));
      let v = forA.get(B);
      if (v === undefined) {
        const fa = sidesOf(th, A),
          fb = sidesOf(th, B);
        v = Math.min(slideRoom(fa.lo, fa.k0, fb.hi, fb.k0, c), slideRoom(fa.dlo, fa.k0, fb.dhi, fb.k0, c / 2));
        forA.set(B, v);
      }
      return v;
    };
  // The drafted stems (alts.stems) carry a head that stands out to the right of the shaft, and are as heavy as the
  // lams: where two pieces of a word face each other with a tall stem (the alif before the lam of ال, an alif before
  // any letter, a lam after a waw), the piece slid in keeps STEM_CLEAR nibs of space from the stem's ink, measured
  // on the pen's outlines as innerGap is, whether it is set by innerGap or by `kern` (which slides until the two
  // touch: a hairline lead-in could touch a shaft and pass, a head cannot).
  const stemClear = th.style.alts?.stems && !th.style.labLetters ? STEM_CLEAR * th.style.nib : 0,
    facesStem = (i: number, j: number) =>
      stemClear > 0 && (STEM_LETTERS.has([...groups[i].s].pop()!) || STEM_LETTERS.has([...groups[j].s][0])),
    // how far B may slide in after A (as kernOf counts it) with c left between them
    slideFor = (i: number, A: GroupShape, B: GroupShape, c: number) => reachOf(A, B, c) + B.x1 - A.x0 + GAP * (groups[i].sc || 1); // prettier-ignore
  // inside a word, a break after a non-joining letter is kerned: the next piece slides right until it would touch
  const kernOf = (i: number, vi: number, j: number, vj: number): number => {
    const tb = tableOf(kernT, i, j),
      at = vi * shapes[j].length + vj,
      kept = tb[at];
    if (kept !== undefined) return kept;
    const A = shapes[i][vi],
      B = shapes[j][vj];
    // innerGap: in until that much is left between the two, and no further than B's right edge reaching A's (pieces
    // that never face each other). (B's box stands GAP to the left of A's before it slides: layoutWord.)
    if (IG) return (tb[at] = Math.min(slideFor(i, A, B, facesStem(i, j) ? Math.max(IG, stemClear) : IG), A.x1 - A.x0));
    let k = 0;
    for (let s = 0.25; s <= 4.01; s += 0.25) {
      const bx = -B.x1 + A.x0 - GAP + s;
      if (pairOverlap(A, 0, 0, B, bx, 0, true) > touchMax) break;
      k = s;
    }
    // (layoutWord takes 0.15 off a kern: allowed for here, so the space kept is the space asked)
    if (facesStem(i, j)) k = Math.min(k, slideFor(i, A, B, stemClear) + 0.15);
    return (tb[at] = k);
  };
  // a piece after a ra or zay nests in its tail: of the places where it does not touch (with its margin), the one
  // furthest over the tail, a drop costing as much as half its length in slide
  const nestOf = (i: number, vi: number, j: number, vj: number): [number, number] => {
    const tb = tableOf(nestT, i, j),
      at = vi * shapes[j].length + vj,
      kept = tb[at];
    if (kept) return kept;
    const A = shapes[i][vi],
      B = shapes[j][vj];
    let best: [number, number] = [0, 0],
      bs = -1e9;
    for (let dy = 0; dy >= -3.01; dy -= 0.25)
      for (let sx = 0; sx <= 8.01; sx += 0.25) {
        const bx = -B.x1 + A.x0 - GAP + sx;
        if (pairOverlap(A, 0, 0, B, bx, dy) > touchMax) break;
        const sc = sx + dy * 0.5;
        if (sc > bs) {
          bs = sc;
          best = [sx, dy];
        }
      }
    return (tb[at] = best);
  };
  const tailed = groups.map(g => /[رزوي]$/.test(g.s));
  // a stacked piece: lifted above the one before by the least that clears it, slid back over it as far as it goes
  const stackOf = (i: number, vi: number, j: number, vj: number): [number, number] => {
    const tb = tableOf(stackT, i, j),
      at = vi * shapes[j].length + vj,
      kept = tb[at];
    if (kept) return kept;
    const A = shapes[i][vi],
      B = shapes[j][vj],
      lift0 = Math.max(1.5, A.y1 - B.y0 - 6);
    let best: [number, number] = [0, A.y1 - B.y0 + 0.8],
      bs = -1e9;
    for (let dy = lift0; dy <= A.y1 - B.y0 + 0.8; dy += 0.5)
      for (let sx = 0; sx <= A.x1 - A.x0 + 0.01; sx += 0.5) {
        const bx = -B.x1 + A.x0 - GAP + sx;
        if (pairOverlap(A, 0, 0, B, bx, dy) > touchMax) break;
        const sc = sx - dy * 0.35;
        if (sc > bs) {
          bs = sc;
          best = [sx, dy];
        }
      }
    return (tb[at] = best);
  };
  const results: Roundel[] = [];
  for (const t of only ?? Array.from({ length: tries }, (_, k) => k)) {
    const R = parkMiller(seed + t * 7919);
    const lv = groups.map((_, i) => Math.floor(R() * shapes[i].length)),
      wp = words.map(() => ({ x: 0, y: 0 })),
      gpos: { x: number; y: number }[] = new Array(n),
      // stacked pieces (lifted above the piece before them)
      up = new Uint8Array(n);
    const layoutWord = (w: number) => {
      let cur = wp[w].x,
        prev = -1;
      const ws = words[w];
      for (let q = 0; q < ws.length; q++) {
        const gi = ws[q],
          S = shapes[gi][lv[gi]];
        if (groups[gi].newWord) cur -= 1.4 * (groups[gi].sc || 1);
        let x = cur - S.x1,
          y = wp[w].y;
        if (up[gi] && prev >= 0 && !groups[gi].newWord) {
          const [sx, dy] = stackOf(prev, lv[prev], gi, lv[gi]);
          x += sx;
          y = gpos[prev].y + dy;
        } else if (o.nest && prev >= 0 && !groups[gi].newWord && tailed[prev]) {
          const [sx, dy] = nestOf(prev, lv[prev], gi, lv[gi]);
          x += sx;
          y = gpos[prev].y + dy;
        } else if (IG && prev >= 0 && !groups[gi].newWord) {
          x += kernOf(prev, lv[prev], gi, lv[gi]);
          // and clear of the pieces further back on its baseline (the tail of a waw two pieces before)
          for (let p = q - 2; p >= 0 && !groups[ws[p + 1]].newWord; p--)
            if (gpos[ws[p]].y === y) x = Math.min(x, gpos[ws[p]].x + reachOf(shapes[ws[p]][lv[ws[p]]], S));
        } else if (o.kern && prev >= 0 && !groups[gi].newWord) {
          const k = kernOf(prev, lv[prev], gi, lv[gi]) - 0.15;
          // (a piece facing a stem may have to stand back from where its box put it)
          x += facesStem(prev, gi) ? k : Math.max(0, k);
        }
        gpos[gi] = { x, y };
        cur = x + S.x0 - GAP * (groups[gi].sc || 1);
        prev = gi;
      }
    };
    let cur = 0;
    words.forEach((ws, w) => {
      wp[w].x = cur;
      layoutWord(w);
      const last = ws[ws.length - 1];
      cur = gpos[last].x + shapes[last][lv[last]].x0 - 1.2;
    });
    const wbox = (w: number) => {
      let x0 = 1e9,
        x1 = -1e9,
        y0 = 1e9,
        y1 = -1e9;
      const ws = words[w];
      for (let q = 0; q < ws.length; q++) {
        const g2 = ws[q],
          S = shapes[g2][lv[g2]],
          p = gpos[g2];
        x0 = Math.min(x0, p.x + S.x0);
        x1 = Math.max(x1, p.x + S.x1);
        y0 = Math.min(y0, p.y + S.y0);
        y1 = Math.max(y1, p.y + S.y1);
      }
      return { x0, x1, y0, y1 };
    };
    // on a reading path, words start at their targets (essential for the search to converge)
    const RU: RuledOptions | null = o.ruled && W > 1 && !o.fixed ? (o.ruled === true ? {} : o.ruled) : null;
    let PP: ReadingPath | null = RU ? null : typeof o.path === 'string' ? (PATHS[o.path] ?? null) : (o.path ?? null),
      fitted: { n: number; gap: number } | undefined;
    const pFill = o.pathFill ?? 0.7;
    if (!PP && !RU && o.lanes && W > 1) {
      const bx0 = words.map((_, w) => wbox(w)),
        // (wordGap: each word as wide as itself and its gap, so the lanes are fitted, and the words' targets set, with
        // the gaps counted; a gap of 0 leaves every width as it is)
        L = fitLanes(W, bx0.reduce((s2, q) => s2 + q.x1 - q.x0 + WG, 0), bx0.reduce((s2, q) => s2 + q.y1 - q.y0, 0) / W, o.lanes, pFill, o.field ? (n, gap) => fieldLanes(o.field!, n, gap) : undefined); // prettier-ignore
      PP = L.path;
      fitted = { n: L.n, gap: L.gap };
    }
    if (PP && W > 1) {
      const bx0 = words.map((_, w) => wbox(w)),
        T0 = pathTargets(
          PP,
          bx0.map(q => q.x1 - q.x0 + WG),
          pFill,
        );
      words.forEach((_, w) => {
        const q = bx0[w];
        wp[w].x += T0[w][0] - (q.x0 + q.x1) / 2;
        wp[w].y += T0[w][1] - (q.y0 + q.y1) / 2;
        layoutWord(w);
      });
    } else PP = null;
    const ov = Array.from({ length: W }, () => new Float64Array(W));
    const wordOverlap = (a: number, b: number) => {
      let c = 0;
      const wa = words[a],
        wb = words[b];
      for (let p = 0; p < wa.length; p++) {
        const i = wa[p],
          A = shapes[i][lv[i]],
          ga = gpos[i];
        for (let q = 0; q < wb.length; q++) {
          const j = wb[q],
            B = shapes[j][lv[j]],
            gb = gpos[j];
          c += pairOverlap(A, ga.x, ga.y, B, gb.x, gb.y) + pairOverlap(B, gb.x, gb.y, A, ga.x, ga.y);
        }
      }
      return c;
    };
    // wordGap: the clear space between two words as they stand (the least between their pieces)
    const wordClear = (a: number, b: number) => {
      let c = Infinity;
      const wa = words[a],
        wb = words[b];
      for (let p = 0; p < wa.length; p++) {
        const i = wa[p],
          A = shapes[i][lv[i]],
          ga = gpos[i];
        for (let q = 0; q < wb.length; q++) {
          const j = wb[q],
            B = shapes[j][lv[j]],
            gb = gpos[j];
          // (boxes further apart than the gap: nothing to measure)
          if (ga.x + A.x0 - (gb.x + B.x1) > WG + 1 || gb.x + B.x0 - (ga.x + A.x1) > WG + 1 || ga.y + A.y0 - (gb.y + B.y1) > WG + 1 || gb.y + B.y0 - (ga.y + A.y1) > WG + 1) continue; // prettier-ignore
          c = Math.min(c, pairClear(A, ga.x, ga.y, B, gb.x, gb.y));
        }
      }
      return c;
    };
    // and what a word and the next were last found to leave, kept while neither has moved or changed (a move undone
    // puts both back as they were, so the two last measures are kept)
    const clearKept = Array.from({ length: W }, () => [{ k: '', v: 0 }, { k: '', v: 0 }]), // prettier-ignore
      clearNext = (a: number) => {
        let k = '';
        for (const w of [a, a + 1]) for (const g of words[w]) k += gpos[g].x + ',' + gpos[g].y + ',' + lv[g] + ';';
        const kept = clearKept[a];
        if (kept[0].k === k) return kept[0].v;
        if (kept[1].k === k) {
          kept.reverse();
          return kept[0].v;
        }
        kept[1] = kept[0];
        kept[0] = { k, v: wordClear(a, a + 1) };
        return kept[0].v;
      };
    const recompute = (a: number) => {
      for (let b = 0; b < W; b++) if (b !== a) ov[a][b] = ov[b][a] = wordOverlap(a, b);
    };
    // a word's overlaps and its pieces' places as they are, to put back when a move is undone (the same numbers as
    // laying the word out and measuring it again would give; a layout replaces a piece's place and never writes into it)
    const heldRow = new Float64Array(W),
      heldAt: { x: number; y: number }[] = [];
    let held = 0;
    const back = () => {
      const ws = words[held];
      for (let q = 0; q < ws.length; q++) gpos[ws[q]] = heldAt[q];
      for (let b = 0; b < W; b++) if (b !== held) ov[held][b] = ov[b][held] = heldRow[b];
    };
    const keep = (a: number) => {
      const ws = words[a];
      held = a;
      heldRow.set(ov[a]);
      for (let q = 0; q < ws.length; q++) heldAt[q] = gpos[ws[q]];
    };
    for (let a = 0; a < W; a++) recompute(a);
    // ruled: the lines as the field's chords, scaled so their length is about the text's (pathFill)
    let brk: number[] = [0],
      pk = 1,
      wk = 1;
    const lineFit: { over: number; loose: number }[] = [],
      anc = new Uint8Array(W),
      chord: { x: number; y: number; half: number }[] = [],
      lineOf = (w: number) => {
        let l = 0;
        while (l + 1 < brk.length && brk[l + 1] <= w) l++;
        return l;
      },
      // a word as it is written (the variant of each of its pieces, and which are stacked), as one number; as text
      // for a word with more ways to be written than a number tells apart
      wordWays = words.map(ws => ws.reduce((p, g) => p * 2 * shapes[g].length, 1)),
      wkey = (w: number): number | string => {
        const ws = words[w];
        if (!(wordWays[w] < 2 ** 53)) return ws.map(g => lv[g] + (up[g] ? 'u' : '')).join(',');
        let k = 0;
        for (let q = 0; q < ws.length; q++) k = k * (2 * shapes[ws[q]].length) + 2 * lv[ws[q]] + up[ws[q]];
        return k;
      },
      // where a word sits when it slides in after the one before on a line, as an offset from that word's place
      // (kept for each pair of words, by how the two are written)
      kerns: (Map<number | string, Map<number | string, number>> | undefined)[] = new Array(W * W),
      kernAfter = (a: number, b: number) => {
        const ka = wkey(a),
          kb = wkey(b),
          forPair = (kerns[a * W + b] ??= new Map()),
          forA = forPair.get(ka) ?? (forPair.set(ka, new Map()), forPair.get(ka)!),
          kept = forA.get(kb);
        if (kept !== undefined) return kept;
        wp[b] = { x: wp[a].x, y: wp[a].y };
        layoutWord(b);
        const A = wbox(a),
          B = wbox(b),
          cap = 0.6 * Math.min(A.x1 - A.x0, B.x1 - B.x0),
          touch = () => {
            let c = 0;
            words[a].forEach(i => words[b].forEach(j => (c += pairOverlap(shapes[i][lv[i]], gpos[i].x, gpos[i].y, shapes[j][lv[j]], gpos[j].x, gpos[j].y, true)))); // prettier-ignore
            return c;
          },
          shift = (d: number) => words[b].forEach(j => (gpos[j].x += d));
        let off = A.x0 - B.x1 - 1.2;
        if (WG) {
          // wordGap: from boxes that far apart, in only while that much clear space is left between the two words
          // (by 0.4, then by 0.1), and no deeper: a tail may still run under the next word, the gap all round it
          off -= WG;
          shift(off);
          for (const step of [0.4, 0.1])
            for (let s = step; s <= cap + WG; s += step) {
              shift(step);
              if (wordClear(a, b) < WG || touch() > touchMax) {
                shift(-step);
                break;
              }
              off += step;
            }
          forA.set(kb, off);
          return off;
        }
        shift(off);
        for (let s = 0.4; s <= cap; s += 0.4) {
          shift(0.4);
          if (touch() > touchMax) break;
          off += 0.4;
        }
        // and back off a little, so words that interlock still read apart
        off -= off > A.x0 - B.x1 - 1.2 ? 0.8 : 0;
        forA.set(kb, off);
        return off;
      },
      // a word's best shelf (a bowl first, else the longest), in composition coordinates
      shelfOf = (w: number) => {
        let best: { x0: number; x1: number; y: number; cradle?: boolean } | null = null;
        words[w].forEach(g =>
          shapes[g][lv[g]].shelves.forEach(sh => {
            const c = { x0: gpos[g].x + sh.x0, x1: gpos[g].x + sh.x1, y: gpos[g].y + sh.y, cradle: sh.cradle };
            if (!best || (c.cradle && !best.cradle) || (!!c.cradle === !!best.cradle && c.x1 - c.x0 > best.x1 - best.x0)) best = c; // prettier-ignore
          }),
        );
        return best as { x0: number; x1: number; y: number; cradle?: boolean } | null;
      },
      // the words of the lines `ls`, in order, and each one's place in that order (-1: not among them)
      lineWords: number[] = [],
      turn = new Int32Array(W),
      wordsOf = (ls: number[]) => {
        lineWords.length = 0;
        turn.fill(-1);
        for (const l of ls)
          for (let w = brk[l], e = l + 1 < brk.length ? brk[l + 1] : W; w < e; w++) {
            if (turn[w] < 0) turn[w] = lineWords.length;
            lineWords.push(w);
          }
      },
      // what a move may change, as it was before the move: the places of the words of the lines it lays out again, of
      // their pieces, their overlaps and how their lines fit (the layout replaces these and never writes into them)
      was = {
        ls: [] as number[],
        words: [] as number[],
        wp: new Array<{ x: number; y: number }>(W),
        gp: new Array<{ x: number; y: number }>(n),
        ov: Array.from({ length: W }, () => new Float64Array(W)),
        lf: [] as { over: number; loose: number }[],
      },
      note = (ls: number[]) => {
        wordsOf(ls);
        was.ls = ls;
        was.words = lineWords.slice();
        for (const w of was.words) {
          was.wp[w] = wp[w];
          for (const g of words[w]) was.gp[g] = gpos[g];
          was.ov[w].set(ov[w]);
        }
        for (const l of ls) was.lf[l] = lineFit[l];
      },
      putBack = () => {
        for (const w of was.words) {
          wp[w] = was.wp[w];
          for (const g of words[w]) gpos[g] = was.gp[g];
          const row = was.ov[w];
          for (let b = 0; b < W; b++) if (b !== w) ov[w][b] = ov[b][w] = row[b];
        }
        for (const l of was.ls) lineFit[l] = was.lf[l];
      },
      layoutRuled = (ls: number[]) => {
        for (const l of ls) {
          const y = chord[l].y * pk,
            main: number[] = [],
            riders: [number, number][] = [];
          for (let w = brk[l], end = l + 1 < brk.length ? brk[l + 1] : W; w < end; w++) {
            const host = main[main.length - 1];
            if (RU!.anchors && anc[w] && host != null && shelfOf(host)) {
              riders.push([w, host]);
              continue;
            }
            if (host == null) wp[w] = { x: 0, y };
            else wp[w] = { x: wp[host].x + kernAfter(host, w), y };
            layoutWord(w);
            main.push(w);
          }
          // the line's slack shared evenly between its words, and the line centred on its chord
          let left = Infinity;
          for (let i = 0; i < main.length; i++) left = Math.min(left, wbox(main[i]).x0);
          const right = wbox(main[0]).x1,
            P = right - left,
            target = 2 * chord[l].half * wk,
            e = main.length > 1 ? Math.max(0, (target - P) / (main.length - 1)) : 0,
            dx = chord[l].x * wk - (right - (P + e * (main.length - 1)) / 2);
          for (let i = 0; i < main.length; i++) {
            wp[main[i]].x += dx - i * e;
            layoutWord(main[i]);
          }
          lineFit[l] = { over: Math.max(0, P - target), loose: Math.max(0, e - (RU!.maxGap ?? 2)) };
          // riders: over their host's shelf, centred on it, or down in its bowl
          riders.forEach(([w, host]) => {
            const sh = shelfOf(host)!;
            wp[w] = { x: 0, y: 0 };
            layoutWord(w);
            const b = wbox(w);
            wp[w] = { x: (sh.x0 + sh.x1) / 2 - (b.x0 + b.x1) / 2, y: sh.y + (sh.cradle ? 0.2 : 0.9) - b.y0 };
            layoutWord(w);
          });
        }
        // the overlaps of the words that moved, each pair measured once: between two that moved, as the later of
        // them measures it (what measuring every pair from both sides in turn left standing)
        wordsOf(ls);
        for (let k = 0; k < lineWords.length; k++) {
          const a = lineWords[k];
          if (turn[a] !== k) continue;
          for (let b = 0; b < W; b++) if (b !== a && turn[b] < k) ov[a][b] = ov[b][a] = wordOverlap(a, b);
        }
      },
      allLines = () => brk.map((_, l) => l);
    if (RU) {
      const bx0 = words.map((_, w) => wbox(w)),
        tw = bx0.reduce((s2, q) => s2 + q.x1 - q.x0, 0),
        wh = bx0.reduce((s2, q) => s2 + q.y1 - q.y0, 0) / W,
        make = o.field ? (k: number, gap: number) => fieldLanes(o.field!, k, gap) : undefined,
        lo = { bandFrac: o.lanes?.bandFrac },
        nL = Math.max(
          Math.min(W, 2),
          Math.min(W, RU.lines ?? fitLanes(W, tw, wh, lo, pFill, make).n + [0, 1, -1][t % 3]),
        ),
        L = fitLanes(W, tw, wh, { ...lo, n: nL }, pFill, make),
        len = L.path.map(sp => Math.abs(sp[0][0] - sp[sp.length - 1][0])),
        lenAll = len.reduce((a, b) => a + b, 0),
        u = (tw * pFill) / lenAll,
        sx = o.field ? 1 : OVAL;
      L.path.forEach(sp => {
        const a = sp[0],
          b = sp[sp.length - 1];
        chord.push({ x: ((a[0] + b[0]) / 2) * u * sx, y: a[1] * u, half: (Math.abs(a[0] - b[0]) / 2) * u * sx });
      });
      fitted = { n: nL, gap: L.gap };
      // the first breaks: each line takes its chord's share of the text
      let acc = 0;
      const at = bx0.map(q => {
        const mid = acc + (q.x1 - q.x0) / 2;
        acc += q.x1 - q.x0;
        let l = 0,
          c = (len[0] / lenAll) * tw;
        while (l + 1 < nL && mid > c) c += (len[++l] / lenAll) * tw;
        return l;
      });
      brk = [0];
      for (let l = 1; l < nL; l++) {
        let s0 = at.findIndex(a => a >= l);
        if (s0 < 0) s0 = W;
        brk.push(Math.max(brk[l - 1] + 1, Math.min(s0, W - (nL - l))));
      }
      layoutRuled(allLines());
    }
    // the disc: centred on the ink, radius reaching the furthest ink
    // (the points in flat arrays, reused; the farthest point found by squared distance, with Math.hypot, as before,
    // only among the near-farthest, so the same point wins and the radius is the same number)
    let px = new Float64Array(256),
      py = new Float64Array(256);
    const farthest = (m: number, cx: number, cy: number, sx: number) => {
      let best = -1;
      for (let k = 0; k < m; k++) {
        const dx = (px[k] - cx) / sx,
          dy = py[k] - cy,
          q = dx * dx + dy * dy;
        if (q > best) best = q;
      }
      let fd = -1,
        at = 0;
      const near = best * (1 - 1e-9);
      for (let k = 0; k < m; k++) {
        const dx = (px[k] - cx) / sx,
          dy = py[k] - cy;
        if (dx * dx + dy * dy < near) continue;
        const dd = Math.hypot(dx, dy);
        if (dd > fd) {
          fd = dd;
          at = k;
        }
      }
      return [fd, at];
    };
    const disc = (): Disc => {
      if (DK) {
        let sw = 0;
        groups.forEach((_, i) => {
          const S = shapes[i][lv[i]];
          sw += S.ink;
          DK.place(i, gpos[i].x, gpos[i].y, rims[i][lv[i]]);
        });
        const [cx, cy, r] = DK.run(n, OVAL)!;
        return { cx, cy, r: r + 0.8, ink: sw, oval: OVAL, field: o.field };
      }
      let sw = 0,
        m = 0;
      groups.forEach((_, i) => {
        const S = shapes[i][lv[i]],
          rim = rims[i][lv[i]];
        sw += S.ink;
        if (m + rim.length > px.length) {
          const nx = new Float64Array(2 * (m + rim.length)),
            ny = new Float64Array(2 * (m + rim.length));
          nx.set(px);
          ny.set(py);
          px = nx;
          py = ny;
        }
        for (const [hx, hy] of rim) {
          px[m] = gpos[i].x + hx;
          py[m++] = gpos[i].y + hy;
        }
      });
      let x0 = 1e9,
        x1 = -1e9,
        y0 = 1e9,
        y1 = -1e9;
      for (let k = 0; k < m; k++) {
        x0 = Math.min(x0, px[k]);
        x1 = Math.max(x1, px[k]);
        y0 = Math.min(y0, py[k]);
        y1 = Math.max(y1, py[k]);
      }
      let cx = (x0 + x1) / 2,
        cy = (y0 + y1) / 2;
      for (let it = 0; it < 12; it++) {
        // nudge the centre towards the furthest point (a quick smallest-enclosing circle)
        const k = farthest(m, cx, cy, 1)[1];
        cx += ((px[k] - cx) * 0.08) / (1 + it * 0.3);
        cy += ((py[k] - cy) * 0.08) / (1 + it * 0.3);
      }
      const ovl = OVAL,
        r = Math.max(0, farthest(m, cx, cy, ovl)[0]);
      return { cx, cy, r: r + 0.8, ink: sw, oval: ovl, field: o.field };
    };
    // The energy's working arrays, written afresh at each measure: each piece's box and each word's, where each word's
    // reading starts, and the words' targets along a path. (Every sum below adds the same terms in the same order as
    // when these were lists made anew each time, so the energy is the same number.)
    const gX0 = new Float64Array(n),
      gX1 = new Float64Array(n),
      gY0 = new Float64Array(n),
      gY1 = new Float64Array(n),
      bX0 = new Float64Array(W),
      bX1 = new Float64Array(W),
      bY0 = new Float64Array(W),
      bY1 = new Float64Array(W),
      hdX = new Float64Array(W),
      hdY = new Float64Array(W),
      tgX = new Float64Array(W),
      tgY = new Float64Array(W),
      lineAt = new Int32Array(W),
      stemX: number[] = [],
      stemY: number[] = [],
      wordOfG = Int32Array.from(groups, g => g.word);
    // the path's stretches, as pathTargets (paths.ts) measures them
    // (and which of the path's strokes each belongs to: its lane)
    const segs: { a: [number, number]; b: [number, number]; L: number; s0: number; lane: number }[] = [],
      tgLane = new Int32Array(W);
    let pathLen = 0;
    const measurePath = (path: ReadingPath) => {
      segs.length = 0;
      pathLen = 0;
      path.forEach((sp, lane) => {
        for (let i = 0; i + 1 < sp.length; i++) {
          const L = Math.hypot(sp[i + 1][0] - sp[i][0], sp[i + 1][1] - sp[i][1]);
          segs.push({ a: sp[i], b: sp[i + 1], L, s0: pathLen, lane });
          pathLen += L;
        }
      });
    };
    if (PP) measurePath(PP);
    // each word's target along the path, by the words' widths (pathTargets, into tgX and tgY)
    const targets = () => {
      let Wt = 0;
      for (let w = 0; w < W; w++) Wt += bX1[w] - bX0[w] + WG;
      const sc = (Wt * pFill) / Math.max(1e-6, pathLen);
      let cum = 0;
      for (let w = 0; w < W; w++) {
        const wd = bX1[w] - bX0[w] + WG,
          u = ((cum + wd / 2) / Wt) * pathLen;
        cum += wd;
        let g = segs[segs.length - 1];
        for (let q = 0; q < segs.length; q++)
          if (u <= segs[q].s0 + segs[q].L + 1e-9) {
            g = segs[q];
            break;
          }
        const f = Math.max(0, Math.min(1, (u - g.s0) / Math.max(1e-9, g.L)));
        tgX[w] = sc * (g.a[0] + (g.b[0] - g.a[0]) * f);
        tgY[w] = sc * (g.a[1] + (g.b[1] - g.a[1]) * f);
        tgLane[w] = g.lane;
      }
    };
    // (orderFault, on the boxes above)
    const stackOrder = () => {
      if (!o.stack) return 0;
      let f = 0;
      for (let j = 0; j < n; j++) {
        if (!up[j]) continue;
        const mid = (gY0[j] + gY1[j]) / 2;
        for (let i = 0; i < n; i++) {
          if (wordOfG[i] >= wordOfG[j]) continue;
          if (Math.min(gX1[i], gX1[j]) - Math.max(gX0[i], gX0[j]) < 0.5) continue;
          const v = mid - (gpos[i].y - 0.5);
          if (v > 0) f += v * v;
        }
      }
      return f;
    };
    // what a pen unit of missing space between two words costs, squared (at 25, a word out of reading order's price,
    // lanes kept about 0.8 of the gap asked: the words' targets along the path pull them together)
    const GAP_W = 60;
    const pathTol = o.pathTol ?? 1.4,
      pathW = o.pathW ?? 0.6,
      readW = o.readW ?? 1.5,
      orderSlack = o.orderSlack ?? 1.0,
      orderFirm = o.orderFirm ?? 3,
      FIELD = o.field ? FIELDS[o.field] : null;
    const energy = () => {
      let o2 = 0;
      for (let a = 0; a < W; a++) for (let b = a + 1; b < W; b++) o2 += ov[a][b];
      let order = 0;
      // the pieces' boxes, the words' (wbox), and all the ink's
      let bx0 = 1e9,
        bx1 = -1e9,
        by0 = 1e9,
        by1 = -1e9;
      for (let i = 0; i < n; i++) {
        const S = shapes[i][lv[i]],
          p = gpos[i];
        bx0 = Math.min(bx0, (gX0[i] = p.x + S.x0));
        bx1 = Math.max(bx1, (gX1[i] = p.x + S.x1));
        by0 = Math.min(by0, (gY0[i] = p.y + S.y0));
        by1 = Math.max(by1, (gY1[i] = p.y + S.y1));
      }
      for (let w = 0; w < W; w++) {
        const ws = words[w];
        let x0 = 1e9,
          x1 = -1e9,
          y0 = 1e9,
          y1 = -1e9;
        for (let q = 0; q < ws.length; q++) {
          const g2 = ws[q];
          x0 = Math.min(x0, gX0[g2]);
          x1 = Math.max(x1, gX1[g2]);
          y0 = Math.min(y0, gY0[g2]);
          y1 = Math.max(y1, gY1[g2]);
        }
        bX0[w] = x0;
        bX1[w] = x1;
        bY0[w] = y0;
        bY1[w] = y1;
        // where each word's reading starts (its first letter)
        const g0 = ws[0],
          h = headOf(shapes[g0][lv[g0]]);
        hdX[w] = gpos[g0].x + h.x;
        hdY[w] = gpos[g0].y + h.y;
      }
      if (PP) {
        // each word near its target along the path (the whole text may shift)
        targets();
        let mx = 0,
          my = 0;
        for (let w = 0; w < W; w++) {
          mx = mx + (bX0[w] + bX1[w]) / 2 - tgX[w];
          my = my + (bY0[w] + bY1[w]) / 2 - tgY[w];
        }
        mx /= W;
        my /= W;
        for (let w = 0; w < W; w++) {
          const d = Math.hypot((bX0[w] + bX1[w]) / 2 - tgX[w] - mx, (bY0[w] + bY1[w]) / 2 - tgY[w] - my);
          if (d > pathTol) order += pathW * (d - pathTol) ** 2;
        }
        if (o.readRule !== false) {
          // the eye reads across: a later word at about the same height as an earlier one must lie to its left
          let hs = 0;
          for (let w = 0; w < W; w++) hs = hs + bY1[w] - bY0[w];
          const rowH = (hs / W) * 0.45;
          for (let a = 0; a < W; a++)
            for (let b = a + 1; b < W; b++) {
              const dy = Math.abs(wp[b].y - wp[a].y);
              if (dy > rowH) continue;
              const v = hdX[b] - (bX0[a] + 1.0);
              if (v > 0) order += readW * v * v * (1 - dy / rowH);
            }
          // and it reads downward: no later word climbs back above the one before
          for (let a = 0; a + 1 < W; a++) {
            const back = wp[a + 1].y - wp[a].y - orderSlack;
            if (back > 0) order += orderFirm * back * back;
          }
        }
      } else if (!RU)
        for (let w = 0; w + 1 < W; w++) {
          // each word starts to the left of where the one before started
          const v = hdX[w + 1] - (hdX[w] - 1.5);
          if (v > 0) order += v * v;
        }
      if (o.topFirst)
        for (let w = 0; w + 1 < W; w++) {
          const ox2 = Math.min(bX1[w], bX1[w + 1]) - Math.max(bX0[w], bX0[w + 1]),
            wm = Math.min(bX1[w] - bX0[w], bX1[w + 1] - bX0[w + 1]);
          if (ox2 > 0.35 * wm) {
            // by their first letters' baselines
            const dv = hdY[w + 1] - hdY[w];
            if (dv > -1) order += 0.6 * (dv + 1) ** 2;
          }
        }
      let cost = 0;
      for (let i = 0; i < n; i++) {
        cost += shapes[i][lv[i]].cost;
        if (i > 0 && shapes[i][lv[i]].elong && shapes[i - 1][lv[i - 1]].elong) cost += 2.5;
      }
      const d = disc(),
        fill = d.ink / (Math.PI * d.r * d.r * OVAL * K * K);
      // balance: the ink's centre of mass near the centre of the disc
      let sx = 0,
        sy = 0;
      for (let i = 0; i < n; i++) {
        const S = shapes[i][lv[i]];
        sx += (gpos[i].x + S.cx) * S.ink;
        sy += (gpos[i].y + S.cy) * S.ink;
      }
      const bal = Math.hypot(sx / d.ink - d.cx, sy / d.ink - d.cy) / d.r;
      let shelf = 0;
      if (o.elongate || o.emph)
        for (let i = 0; i < n; i++) {
          const shelves = shapes[i][lv[i]].shelves,
            wi = wordOfG[i];
          for (let q = 0; q < shelves.length; q++) {
            const sh = shelves[q];
            let cov = 0,
              tot = 0;
            for (let x = sh.x0 + 0.5; x < sh.x1 - 0.3; x += 0.6) {
              tot++;
              const gx = gpos[i].x + x,
                gy = gpos[i].y + sh.y;
              for (let j = 0; j < n && cov < tot; j++) {
                if (wordOfG[j] === wi) continue;
                const T = shapes[j][lv[j]],
                  lx = Math.round((gx - gpos[j].x - T.x0) * K) + 1;
                if (lx < 0 || lx >= T.W) continue;
                // (the rows looked at run from the one 5.5 above the shelf down to the one 1 above: none in the
                // bitmap, no ink to find)
                if (Math.round((gpos[j].y + T.y1 - (gy + 1.0)) * K) + 1 < 0 || Math.round((gpos[j].y + T.y1 - (gy + 5.5)) * K) + 1 >= T.H) continue; // prettier-ignore
                for (let dd = 1.0; dd <= 5.5; dd += 0.75) {
                  const ly = Math.round((gpos[j].y + T.y1 - (gy + dd)) * K) + 1;
                  if (ly >= 0 && ly < T.H && T.mask[ly * T.W + lx]) {
                    cov++;
                    break;
                  }
                }
              }
            }
            shelf += tot ? cov / tot : 0;
          }
        }
      // a later word may not rise above the first letters of the word before it (so the first name is read first)
      let rise = 0;
      if (o.noRise)
        for (let w = 0; w + 1 < W; w++) {
          const g0 = words[w][0],
            S0 = shapes[g0][lv[g0]],
            top0 = gpos[g0].y + S0.y1,
            v = bY1[w + 1] - top0;
          if (v > -0.5) rise += (v + 0.5) ** 2;
        }
      // one top line: every tall stem reaches up to the same height
      let ceil = 0;
      if (o.ceiling) {
        const tops: number[] = [];
        groups.forEach((_, i) => shapes[i][lv[i]].stemTops.forEach(([, ty]) => tops.push(gpos[i].y + ty)));
        if (tops.length > 1) {
          const mx = Math.max(...tops);
          tops.forEach(tp => (ceil += (mx - tp) ** 2));
        }
      }
      // a shaped field: the letters' outline points, scaled to their own box, must fall inside the shape
      let sil = 0;
      if (FIELD) {
        const hx = (bx1 - bx0) / 2,
          hy = (by1 - by0) / 2,
          mx = (bx0 + bx1) / 2,
          my = (by0 + by1) / 2;
        let out = 0,
          tot = 0;
        for (let i = 0; i < n; i++) {
          const hull = shapes[i][lv[i]].hull,
            gx = gpos[i].x,
            gy = gpos[i].y;
          for (let q = 0; q < hull.length; q++) {
            const u = (gx + hull[q][0] - mx) / hx,
              v = (gy + hull[q][1] - my) / hy;
            tot++;
            out += Math.max(0, Math.abs(u) - FIELD.half(Math.max(-1, Math.min(1, v))));
          }
        }
        sil = tot ? out / tot : 0;
      }
      // ruled: each line filling its chord, the stems in rhythm, the longest stroke on the axis
      let ruled = 0;
      if (RU) {
        let just = 0,
          rhy = 0;
        for (let l = 0; l < lineFit.length; l++) just += lineFit[l].over ** 2 + lineFit[l].loose ** 2;
        for (let l = 0; l < brk.length; l++)
          for (let w = brk[l], e = l + 1 < brk.length ? brk[l + 1] : W; w < e; w++) lineAt[w] = l;
        // each line keeps to its band: a stacked piece no higher than a third of the way to the line above, the ink no
        // lower than half way to the line below (the last line's, than 0.7 of a line)
        const pitch = chord.length > 1 ? (chord[0].y - chord[1].y) * pk : 6;
        for (let i = 0; i < n; i++) {
          const gw = wordOfG[i],
            l = lineAt[gw];
          if (anc[gw] && gw > brk[l]) continue;
          const y = chord[l].y * pk,
            dev = gpos[i].y - y,
            lo = y - (l + 1 < chord.length ? 0.5 : 0.7) * pitch - gY0[i];
          if (dev > 0.34 * pitch) just += (dev - 0.34 * pitch) ** 2;
          if (lo > 0) just += lo * lo;
        }
        stemY.length = 0;
        for (let l = 0; l < brk.length; l++) {
          stemX.length = 0;
          for (let i = 0; i < n; i++) {
            const gw = wordOfG[i];
            if (lineAt[gw] !== l || (anc[gw] && gw > brk[l])) continue;
            const st = shapes[i][lv[i]].stemTops;
            for (let q = 0; q < st.length; q++) {
              stemX.push(gpos[i].x + st[q][0]);
              stemY.push(gpos[i].y + st[q][1]);
            }
          }
          stemX.sort((a, b) => a - b);
          const ng = stemX.length - 1;
          if (ng >= 2) {
            let m = 0,
              dev = 0;
            for (let k = 0; k < ng; k++) m += stemX[k + 1] - stemX[k];
            m /= ng;
            for (let k = 0; k < ng; k++) dev += (stemX[k + 1] - stemX[k] - m) ** 2;
            rhy += dev / ng / Math.max(1, m * m);
          }
        }
        rhy += 0.04 * twoLevels(stemY);
        // the longest stroke (the longest shelf, else the widest piece) centred on the axis
        let li = 0,
          ll = -1,
          lx = 0,
          wi = 0;
        for (let i = 0; i < n; i++) {
          const S = shapes[i][lv[i]],
            T = shapes[wi][lv[wi]];
          for (let q = 0; q < S.shelves.length; q++) {
            const sh = S.shelves[q];
            if (sh.x1 - sh.x0 > ll) {
              ll = sh.x1 - sh.x0;
              li = i;
              lx = (sh.x0 + sh.x1) / 2;
            }
          }
          if (S.x1 - S.x0 > T.x1 - T.x0) wi = i;
        }
        const W2 = shapes[wi][lv[wi]],
          ax = ll >= 0 ? gpos[li].x + lx : gpos[wi].x + (W2.x0 + W2.x1) / 2;
        ruled =
          (RU.justify ?? 4) * just + (RU.rhythm ?? 1) * 12 * rhy + (RU.axis ?? 1) * 20 * (Math.abs(ax - d.cx) / d.r);
      }
      const E0 =
        ruled + 90 * sil + 0.6 * ceil + 3 * o2 + 25 * order + 20 * stackOrder() + 30 * Math.abs(Math.log((bx1 - bx0) / (by1 - by0) / OVAL)) +
        110 * Math.max(0, (o.fillTarget || 0.36) - fill) + 25 * bal + cost - (o.emph ? 14 : 8) * shelf + 4 * rise; // prettier-ignore
      // wordGap: two words in turn on a line standing closer than the gap (ruled lines keep it as they are laid out)
      if (!WG || RU) return E0;
      let tight = 0,
        rowH = 0;
      if (!PP) {
        for (let w = 0; w < W; w++) rowH = rowH + bY1[w] - bY0[w];
        rowH = (rowH / W) * 0.45;
      }
      for (let w = 0; w + 1 < W; w++) {
        if (groups[words[w][0]].comp || groups[words[w + 1][0]].comp) continue;
        let share = 1;
        if (PP) {
          // on a path: the two on the same stroke of it
          if (tgLane[w] !== tgLane[w + 1]) continue;
        } else {
          // free: on about the same baseline, and beside each other (a word over another rides on it)
          const dy = Math.abs(hdY[w + 1] - hdY[w]),
            ox2 = Math.min(bX1[w], bX1[w + 1]) - Math.max(bX0[w], bX0[w + 1]);
          if (dy >= rowH || ox2 > 0.35 * Math.min(bX1[w] - bX0[w], bX1[w + 1] - bX0[w + 1])) continue;
          share = 1 - dy / rowH;
        }
        const v = WG - clearNext(w);
        if (v > 0) tight += share * v * v;
      }
      return E0 + GAP_W * tight;
    };
    let E = energy(),
      T = 20;
    if (o.fixed) {
      // rebuild a recorded layout: the same variant of each piece, each word in the same place
      o.fixed.lv.forEach((v, i) => i < n && (lv[i] = Math.min(v, shapes[i].length - 1)));
      o.fixed.wp.forEach((p, w) => w < W && (wp[w] = { ...p }));
      (o.fixed.up || []).forEach(i => i < n && (up[i] = 1));
      for (let w = 0; w < W; w++) layoutWord(w);
      for (const q of o.fixed.nudge || []) if (q.i < n) gpos[q.i] = { x: gpos[q.i].x + q.x, y: gpos[q.i].y + q.y };
      for (let a = 0; a < W; a++) recompute(a);
      E = energy();
    }
    // the pieces that can be stacked: not a word's first, not a companion's
    const stackable = o.stack ? groups.map((_, i) => i).filter(i => i > 0 && groups[i - 1].word === groups[i].word && !groups[i].newWord) : []; // prettier-ignore
    // a ruled move: the lines it changes laid out again, what they were kept (note) for the move to be undone by
    const relay = (ls: number[]) => {
      note(ls);
      layoutRuled(ls);
    };
    for (let it = 0; it < (o.fixed ? 0 : iters); it++) {
      const mv = R();
      // (a move that changes nothing leaves the energy as it is, to the bit, and so is taken without a draw; `still`
      // marks one, and it is not laid out or measured again. An energy that is not a number is left to the long way.)
      let undo: (() => void) | null = null,
        still = false;
      if (RU) {
        if (stackable.length && mv < 0.1) {
          // a stack lifted or set down
          const gi = stackable[Math.floor(R() * stackable.length)];
          up[gi] ^= 1;
          relay([lineOf(groups[gi].word)]);
          undo = () => {
            up[gi] ^= 1;
            putBack();
          };
        } else if (mv < 0.25 && brk.length > 1) {
          // a line break moved by a word, each line keeping one
          const l = 1 + Math.floor(R() * (brk.length - 1)),
            ob = brk[l],
            nb = ob + (R() < 0.5 ? -1 : 1);
          if (nb > brk[l - 1] && nb < (l + 1 < brk.length ? brk[l + 1] : W)) {
            brk[l] = nb;
            relay([l - 1, l]);
            undo = () => {
              brk[l] = ob;
              putBack();
            };
          } else still = true;
        } else if (RU.anchors && mv < 0.35) {
          // a word set to ride on the word before it, or back on the line
          const w = 1 + Math.floor(R() * (W - 1));
          if (!brk.includes(w)) {
            anc[w] ^= 1;
            relay([lineOf(w)]);
            undo = () => {
              anc[w] ^= 1;
              putBack();
            };
          } else still = true;
        } else if (mv < 0.45) {
          // the lines drawn closer or apart, or made shorter or longer
          const opk = pk,
            owk = wk;
          if (R() < 0.5) pk = Math.max(0.6, Math.min(1.15, pk * Math.exp((R() - 0.5) * 0.2)));
          else wk = Math.max(0.6, Math.min(1.5, wk * Math.exp((R() - 0.5) * 0.2)));
          if (pk === opk && wk === owk) still = true;
          else {
            relay(allLines());
            undo = () => {
              pk = opk;
              wk = owk;
              putBack();
            };
          }
        } else {
          const g2 = Math.floor(R() * n),
            old = lv[g2];
          lv[g2] = Math.floor(R() * shapes[g2].length);
          if (lv[g2] === old) still = true;
          else {
            relay([lineOf(groups[g2].word)]);
            undo = () => {
              lv[g2] = old;
              putBack();
            };
          }
        }
      } else if (stackable.length && mv < 0.1) {
        // lift a piece onto the one before it, or set it back down
        const gi = stackable[Math.floor(R() * stackable.length)],
          w = groups[gi].word;
        keep(w);
        up[gi] ^= 1;
        layoutWord(w);
        recompute(w);
        undo = () => {
          up[gi] ^= 1;
          back();
        };
      } else if ((o.emph || o.elongate) && !PP && W > 1 && mv > (o.cradle ? 0.75 : 0.9)) {
        // (not on a reading path: the lift teleports whole words across the field)
        // lift a word onto a shelf (an elongated stroke or a long final sweep) or into a cradle
        const withShelf = groups.map((_, i) => i).filter(i => shapes[i][lv[i]].shelves.length);
        if (withShelf.length) {
          const gi = withShelf[Math.floor(R() * withShelf.length)],
            shs = shapes[gi][lv[gi]].shelves,
            sh = shs.find(s2 => s2.cradle) || shs[0],
            others = words.map((_, w) => w).filter(w => w !== groups[gi].word),
            w = others[Math.floor(R() * others.length)];
          keep(w);
          const old = { ...wp[w] },
            bxw = wbox(w),
            sx0 = gpos[gi].x + sh.x0,
            sy = gpos[gi].y + sh.y;
          wp[w].x += sx0 + (bxw.x1 - bxw.x0) / 2 + 0.6 + R() * Math.max(0, sh.x1 - sh.x0 - (bxw.x1 - bxw.x0)) - (bxw.x0 + bxw.x1) / 2; // prettier-ignore
          wp[w].y += sy + 0.9 + R() * 1.2 - bxw.y0;
          layoutWord(w);
          recompute(w);
          undo = () => {
            wp[w] = old;
            back();
          };
        } else still = true;
      } else if (mv < 0.6 && W > 1) {
        const w = Math.floor(R() * W),
          old = { ...wp[w] },
          s = T > 2 ? 1 : 0.35;
        keep(w);
        wp[w].x += (R() - 0.5) * 8 * s;
        wp[w].y += (R() - 0.5) * 8 * s;
        layoutWord(w);
        recompute(w);
        undo = () => {
          wp[w] = old;
          back();
        };
      } else {
        const g2 = Math.floor(R() * n),
          w = groups[g2].word,
          old = lv[g2];
        lv[g2] = Math.floor(R() * shapes[g2].length);
        if (lv[g2] === old) still = true;
        else {
          keep(w);
          layoutWord(w);
          recompute(w);
          undo = () => {
            lv[g2] = old;
            back();
          };
        }
      }
      if (!still || E !== E) {
        const E2 = energy();
        if (E2 <= E || R() < Math.exp((E - E2) / T)) E = E2;
        else undo?.();
      }
      T = Math.max(0.03, T * Math.pow(0.03 / 20, 1 / iters));
    }
    let o2 = 0;
    for (let a = 0; a < W; a++) for (let b = a + 1; b < W; b++) o2 += ov[a][b];
    results.push({ E, overlap: o2, disc: disc(), st: gpos.map(p => ({ ...p })), shapes: groups.map((_, i) => shapes[i][lv[i]]), groups, lv: lv.slice(), wp: wp.map(p => ({ ...p })), up: [...up.keys()].filter(i => up[i]), lanes: fitted, ...(RU ? { ruled: { breaks: brk.slice(), anchored: [...anc.keys()].filter(w => anc[w] && !brk.includes(w)) } } : {}) }); // prettier-ignore
    if (o.fixed) break;
  }
  if (!only) results.sort((a, b) => a.E - b.E);
  return results;
}
