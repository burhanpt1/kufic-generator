// The letters-first roundel composer, for any text (owner's experiments, 15 November 2026): level, upright text;
// stem-bearing words on one low ground line with their stems redrawn to rise; the other words in the bays; the
// canopy, the cradle, and the nested arcs on circles concentric with the rim. Moved here whole from
// tests/char-nested-sheet.test.ts so that it can be run on the wider set of texts (tests/char-wide-sheet.test.ts);
// the rules are numbered in the comments below, and every number is at the top.
import type { Built } from '../../src/script/thuluth/engine';
import { cleanOutline } from '../../src/script/thuluth/outline';
import type { Poly, Sample } from '../../src/script/thuluth/types';
import { forms } from '../../src/script/thuluth';
import type { Bend, Cols, Cradle, CradleLaid, Head, Profile, Pt, Stem } from './char-first';
import { BOWL, CAP, CLEAR, EASE, FLOOR, LINE_SPACE, MARGIN, NIB, SPAN_MAX, STEP, TIP_LEN, bowlPen, colsOf, cradleCompose, cradleOf, discOf, findStems, hull, mendDots, meridians, nearPairs, need, profile, raise, room, sweep, takeOver, th } from './char-first'; // prettier-ignore

// ---- the numbers of the nested arcs ----
export const AIR = +(process.env.NESTED_AIR ?? 1.2) * NIB, // between a stroke on one circle and the stroke on the next circle in
  STEPIN = FLOOR + AIR, // so each circle is this far inside the one before
  SUB_STEPS = [1, 1.5, 2, 2.5, 3], // a sub-canopy takes the first circle in that clears what hangs from the canopy
  SUB_SHARE = +(process.env.NESTED_SHARE ?? 0.62), // an inner arc follows its circle for this share of what the arc outside it follows,
  SUB_BACK = (+(process.env.NESTED_BACK ?? 14) * Math.PI) / 180, // and its tip stops at least this short of the outer one's: the tips step back
  SUB_RUN_MIN = (25 * Math.PI) / 180, // a sub-canopy follows its circle for at least this much
  GROW_MAX = 1.12, // an inner arc that needs a circle more than this much larger than the canopy's is dropped
  /** How well a final letter becomes a sub-cradle: the cradle's bowls, and further the tails and feet (a tail is
   *  short, which suits an inner arc). */
  SUB_BOWL: Record<string, number> = { ...BOWL, م: 0.6, ر: 0.5, ز: 0.5, و: 0.5, د: 0.3, ذ: 0.3 },
  SUB_AFTER = 0.12,
  FEET = 'دذ', // a foot is taken over at its end: the letter is kept whole, and the arc returns from its tip
  FOOT_BACK = 3; // (this many samples before its end)
/** Where a foot is taken over: near the end of its stroke. */
function footOver(b: Built): { si: number; head: Head } {
  const t = takeOver(b, CUT),
    s = b.strokes[t.si].s,
    cut = s.length - 1 - FOOT_BACK,
    ux = s[cut].x - s[cut - 2].x,
    uy = s[cut].y - s[cut - 2].y,
    ul = Math.hypot(ux, uy);
  return { si: t.si, head: { ...t.head, pre: s.slice(0, cut + 1), C: [s[cut].x, s[cut].y], u: [ux / ul, uy / ul] } };
} // each word after it (inside the sub-cradle) costs this much, as the cradle's
/** The sub-cradle letter: the best final bowl, tail or foot among the words after the cradle word (they sit in the
 *  cradle, so its arc can run inside the cradle's); a later word wins a tie. */
export function subCradleOf(words: readonly string[], ci: number): Cradle | null {
  let best: Cradle | null = null;
  for (let wi = ci + 1; wi < words.length; wi++) {
    const c = forms(words[wi]).pop()?.c ?? '',
      shape = SUB_BOWL[c],
      after = words.length - 1 - wi;
    if (!shape || after > 1) continue;
    const score = shape - SUB_AFTER * after;
    if (!best || score >= best.score) best = { wi, c, score, why: `the final ${c} of ${words[wi]}: shape ${shape}, ${after} after it` }; // prettier-ignore
  }
  return best;
}
/** Which letter of its word a stem is, in words. */
const nth = (l: Line, k: number) => {
  const st = l.b.strokes[l.stems[k].si],
    li = st.own?.[Math.min(l.stems[k].cut, st.own.length - 1)] ?? 0;
  return `letter ${li + 1}`;
};

// ---- the numbers of the one ground line, as tests/char-canopy-sheet.test.ts has them (pen units) ----
const NECK = 2 * NIB, // the bowl has its full weight, and its pen has turned to the rim's, within this of its start
  CUT = 0, // the bowl is taken over where its letter last leaves the line of writing
  GIVE = (20 * Math.PI) / 180, // a stem that would meet the rim lower than this above the level diameter stays down
  MIN_RISE = 0.15, // a stem rises by at least this share of its height, or not at all
  UNRISEN = 1, // what a text none of whose stems rise costs, against a larger circle
  SCAN = 0.4, // the step an upper word is tried at, sideways
  SLIDES = [0, -2.4, 2.4, -4.8, 4.8, -7.2, 7.2, -9.6, 9.6], // how far the ground line may be slid from the middle
  OPEN = [0, 2.4], // how far a word space of the ground line may be opened
  VOID = 0.6, // what an empty band between the writing and the bowl costs: its share of the circle's height
  BREACH = 0.2, // what each ground word read out of order costs
  STEM_HALF = 0.75, // half the width a shaft takes on its way up
  TRIES = 5, // places an upper word is measured at before the setting is given up
  MAX_GROUND = 3, // the ground line holds no more words than this
  LARGER = 1.1; // a ground-line arrangement may take a circle this much larger than the smallest that stands

// ---- the numbers of the canopy ----
export const TIP = (25 * Math.PI) / 180, // the canopy ends this far past the top of the circle, to the left,
  RUN_MIN = (40 * Math.PI) / 180, // and follows the rim for at least this much
  STUB = Math.ceil((2 * NIB) / STEP), // the canopy is checked as a piece of its own from two nibs before its letter
  FULL_W = 0.9, // an entry is taken over where its letter's first stroke has this share of the pen's weight,
  ENTRY_IN = 16, // and no further into it than this many samples
  HANG_MIN = (22 * Math.PI) / 180, // the opening word hangs no lower than this above the level diameter,
  HANG_MAX = (60 * Math.PI) / 180, // and no higher,
  HANG_STEP = (9.5 * Math.PI) / 180, // and is tried lower by this much at a time
  DROPS = [2.2, 3, 4, 5, 6.5, 8], // how far inside the canopy's circle the opening stroke is taken over (the least that clears)
  DROPS_STEM = [4, 5, 6.5], // the same for a stem: the shoulder where it turns into the rim
  MORE_SLIDES = [-12, -14.4, -16.8], // the ground line slides further to let the opening word hang beside it
  KASH_SPAN = (115 * Math.PI) / 180, // (b) the opening word, drawn out, spans this much of the upper rim
  KASH_EASE = 7, // and its drawn-out join rises to the rim's circle over this length at each end
  KASH_TURN = 0; // the drawn-out word is turned this far clockwise: it opens at the upper right // and its drawn-out join rises to the rim's circle over this length at each end
// ---- the numbers of the rules for any text (W1 to W7, at the end of this file) ----
const ENTRY_INTO = process.env.WIDE_RIDE ? 'بيئسمنتثش' : 'بيئسم', // an entry is led into a tooth or a head with no dot above it (owner, round two's grades: an arc led into a nun, a ta or a tha hides the letter, and a dot moved off its letter to ride the arc makes it unreadable; WIDE_RIDE=1 shows round two's)
  ROOFED = 'حجخعغ', // letters that open with a roof written to the left: the roof's line is drawn on, to the left, along the rim
  ROOF_TIP = (+(process.env.WIDE_ROOF ?? 75) * Math.PI) / 180, // a roof drawn out ends this far left of the top (9:30),
  ROOF_TIPS = [1, 0.85, 0.7, 0.55], // or at this share of it, the longest that is clear
  ROOF_DROPS = [3, 4, 5, 6.5, 8, 10], // how far inside the rim's circle the roof's top stands: the least that stands
  ROOF_LAP = 8, // the drawn-out roof is a stroke of its own from this many samples before the roof's top
  RIDE = 1.3 * NIB, // a dot that rides outside the neck of an entry: this far from the stroke's middle,
  RIDE_STEP = 1.2 * NIB, // each further dot of the letter this much further out
  TAILS = 'رزوم', // final letters whose tail runs forth; they never return as a cradle
  FORTH_RUN = (55 * Math.PI) / 180, // a tail running forth follows the rim for this much,
  FORTH_TOP = (10 * Math.PI) / 180, // and ends no nearer the level diameter than this
  FORTH_DROP = +(process.env.WIDE_DROP ?? 5) * NIB, // a tail runs forth only if it is taken over within this of the rim's circle: a longer way down would make a stem of it
  SEAT_DROP = +(process.env.WIDE_SEAT ?? 5) * NIB, // an opening stroke is led to the rim from a word on the ground line only from within this of the rim's circle
  SINGLE_LIFTS = Array.from({ length: 16 }, (_, i) => i * 1.5), // a single word may stand this far above its lowest place: it is drawn large, and stands where its strokes reach the rim
  SINGLE_GROW = +(process.env.WIDE_SINGLE ?? 1.15), // a single word takes no arc that needs a circle this much larger than its smallest
  SINGLE_LARGER = 1.1, // a single word takes the arc at its other end instead, if it is then drawn this much larger
  SUB_END = 50, // an inner arc above stays over the top: it ends no further left of the top than this (degrees), or its stem is not bowed
  HOLLOW_MAX = +(process.env.WIDE_HOLLOW ?? 0.2), // a ground line with no cradle is sound only if no more than this share of the circle's height is empty under it
  MAX_BARE = 4, // a ground line with no cradle word holds no more words than this
  VOID_BARE = 1, // what an empty band under a ground line with no cradle costs (VOID's measure): nothing will fill it
  CANOPY_FROM = +(process.env.WIDE_FROM ?? 5), // a stem carries the canopy only if its top stands at least this far right of the top of the circle (degrees): the arc must cross the top
  SOUND = +(process.env.WIDE_SOUND ?? 1.25), // a ground line is sound only if its circle is no more than this many times the circle level lines need, and no word is read out of order
  /** Final letters whose bowl returns of itself (jim, hah, khah, ayn, ghayn): cradles, with rule 1's bowls. */
  RETURNING: Record<string, number> = { ج: 0.9, ح: 0.9, خ: 0.9, ع: 0.9, غ: 0.9 };
/** The cradle's letters for any text (W2), while `f` runs: the bowls with the returning bowls, without the tails.
 *  (The table is the helper's, which the level lines read: it is put back as it was.) */
function wideBowls<T>(f: () => T): T {
  const kept = Object.entries(BOWL);
  for (const [c] of kept) if (TAILS.includes(c)) Reflect.deleteProperty(BOWL, c);
  Object.assign(BOWL, RETURNING);
  try {
    return f();
  } finally {
    for (const c of Object.keys(BOWL)) Reflect.deleteProperty(BOWL, c);
    for (const [c, v] of kept) BOWL[c] = v;
  }
}
/** The cradle of an arrangement: its letter (none: null), and whether it is a tail running forth. */
export interface Plan {
  cr: Cradle | null;
  forth?: boolean;
}
/** Which stroke is drawn out: an entry into the first letter (a), a join of the first word (b), a stem (c). */
export type Mode = 'entry' | 'kashida' | 'stem' | 'roof' | null;

/** CANOPY_SAY=1: what the searches weighed, written beside the sheet (debug.txt). */
const SAY: string[] | null = process.env.CANOPY_SAY ? [] : null;
const WHY = new Map<string, number>();
const no = (why: string) => {
  WHY.set(why, (WHY.get(why) ?? 0) + 1);
  return null;
};

// ======== the canopy stroke ========
/** The opening arc, redrawn: the cradle's great bowl turned half round. From the point C where a stroke is taken over
 *  (the pen heading `back` when the stroke is followed backwards from there) the path climbs to the rim's circle
 *  (radius rho), runs along it over the top and ends `tip` past the top in a thinning tip. The pen is the cradle's:
 *  turned with the rim, one weight along it. The samples run as the pen writes them, from the tip to C (without C). */
export function canopyArc(
  C: Pt,
  back: Pt,
  wC: number,
  ang: number,
  rho: number,
  tip = TIP,
  runMin = RUN_MIN,
  neck = NECK,
) {
  // (the helper's sweep runs along the bottom to the left: this is that, upside down)
  // (on a small circle the least run is the least length a stroke that thins to a tip can have)
  const sw = sweep([C[0], -C[1]], [back[0], -back[1]], wC, rho, phi0 => -Math.max(tip, Math.max(runMin, (TIP_LEN * 1.65) / rho) - phi0), neck); // prettier-ignore
  if (!sw) return null;
  const pen = bowlPen({ pre: [], ang, C: [0, 0], u: [-back[0], -back[1]], dots: 0 }, sw.s);
  return { s: pen.map((q): Sample => ({ x: -q.x, y: -q.y, w: q.w, rot: q.rot })).reverse(), phi0: sw.phi0, phiEnd: sw.phiEnd }; // prettier-ignore
}
/** A stroke of a line whose beginning is redrawn: the samples before `from` give way to `s` (the line's own frame). */
interface Swap {
  si: number;
  from: number;
  s: Sample[];
}
/** The canopy as drawn: the part checked as a piece of its own, what it is, and the rim it follows (degrees clockwise
 *  from the top: where it lands, where it ends). */
interface Roof {
  loose: Poly[];
  what: string;
  from: number;
  to: number;
  /** The radius of its circle (the pen's middle). */
  r?: number;
}
const DEG = 180 / Math.PI;

// ---- a stretch of the text written as one line ----
interface Line {
  text: string;
  b: Built;
  nw: number;
  stems: Stem[];
  /** For a line that ends in the cradle word: where its bowl is taken over. */
  take?: { si: number; head: Head };
  strokeWord: number[];
  dotWord: number[];
  /** The extent of its ink as written (without the cradle's bowl). */
  x0: number;
  x1: number;
  /** For each word: the hull of its ink, the hull of it without the heads of its stems, and its ink on the grid. */
  whole: Pt[][];
  body: Pt[][];
  cols: Cols[];
  /** For each stem: the hull of what rises. */
  heads: Pt[][];
  /** Where the first letter's first stroke is taken over by an entry, and the pen's heading there followed
   *  backwards; null when the pen starts that stroke upwards (a qaf, a fa, a waw). */
  entry: { si: number; cut: number; back: Pt } | null;
  /** Where the first letter's roof ends (its highest point, written leftwards), and the pen's heading there. */
  roofed: { si: number; cut: number; u: Pt } | null;
}
/** The ink of a line, word by word, with its stems drawn `extra` taller; `body`: without the heads of its stems. And
 *  the samples of the cradle stroke up to where the bowl is taken over. */
function inked(
  l: Omit<Line, 'x0' | 'x1' | 'whole' | 'body' | 'cols' | 'heads' | 'entry' | 'roofed'>,
  extra: readonly number[],
  body = false,
  swaps: readonly Swap[] = [],
  stub = false,
  /** Dots set elsewhere than written (by their place in the line's list). */
  dots?: ReadonlyMap<number, Pt>,
  /** How each stem is bent (curved stems): null or absent, straight. */
  bends?: readonly (Bend | null)[],
) {
  const raised = bends?.some(v => v) ? meridians(l.b, l.stems, extra, bends).strokes : raise(l.b, l.stems, extra),
    riders = new Set(l.stems.flatMap(m => m.riders)),
    words: Poly[][] = Array.from({ length: l.nw }, () => []);
  let pre: Sample[] = [];
  raised.forEach((st, si) => {
    let a = 0,
      z = st.s.length - 1;
    // (a lam's stem and its bowl are one stroke: the take-over point moves down the list as the shaft is lengthened)
    if (l.take && si === l.take.si) {
      z = l.take.head.pre.length - 1 + (st.s.length - l.b.strokes[si].s.length);
      pre = st.s.slice(0, z + 1);
    }
    if (body) {
      if (riders.has(si)) return;
      const m = l.stems.find(q => q.si === si);
      if (m) a = m.cut;
    }
    // (the canopy: the stroke's beginning redrawn; `stub`: without it, the canopy being checked as a piece of its own)
    const swap = swaps.find(q => q.si === si);
    if (swap && !body)
      return void words[l.strokeWord[si]].push(...th.strokePolys({ ...st, s: [...(stub ? [] : swap.s), ...st.s.slice(swap.from, z + 1)], own: undefined })); // prettier-ignore
    words[l.strokeWord[si]].push(...th.strokePolys(a === 0 && z === st.s.length - 1 ? st : { ...st, s: st.s.slice(a, z + 1), own: undefined })); // prettier-ignore
  });
  l.b.dots.slice(0, l.b.dots.length - (l.take?.head.dots ?? 0)).forEach(([x, y], k) => {
    const at = dots?.get(k);
    words[l.dotWord[k] ?? 0].push(...th.dotPolysAt(at ? at[0] : x, at ? at[1] : y));
  });
  return { words, pre };
}
/** The dots above a line's first letter, set outside the neck of an entry taken over at C (the line's frame), the
 *  arc leaving C along `back` and bearing left: they ride on its right, the first RIDE from the stroke. */
function ridden(l: Line, C: Pt, back: Pt): Map<number, Pt> {
  const out = new Map<number, Pt>();
  let k = 0,
    i = 0;
  for (const g of l.b.dotGroups) {
    if (g.wi === 0 && g.li === 0 && g.side > 0)
      for (let j = 0; j < g.n; j++, i++)
        out.set(k + j, [C[0] + back[0] * 0.3 * NIB + back[1] * (RIDE + i * RIDE_STEP), C[1] + back[1] * 0.3 * NIB - back[0] * (RIDE + i * RIDE_STEP)]); // prettier-ignore
    k += g.n;
  }
  return out;
}
const lineCache = new Map<string, Line>();
function lineOf(text: string, cradle = false): Line {
  const key = (cradle ? '*' : '') + text,
    had = lineCache.get(key);
  if (had) return had;
  const b = mendDots(th.buildStrokes(text, {})),
    stems = findStems(b, text),
    nw = text.trim().split(/\s+/).length,
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
    strokeWord = b.strokes.map(st => st.wi != null && st.wi >= 0 ? st.wi : wordAt(st.s.reduce((t, q) => t + q.x, 0) / st.s.length)), // prettier-ignore
    dotWord = b.dotGroups.flatMap(g => new Array<number>(g.n).fill(g.wi)),
    part = {
      text,
      b,
      nw,
      stems,
      take: cradle ? (FEET.includes([...text].pop() ?? '') ? footOver(b) : takeOver(b, CUT)) : undefined,
      strokeWord,
      dotWord,
    },
    none = stems.map(() => 0),
    first = b.strokes.findIndex(st => st.wi === 0 && !st.nib && st.own?.[0] === 0),
    ink = inked(part, none).words,
    xs = ink.flat(2).map(p => p[0]),
    l: Line = {
      ...part,
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      whole: ink.map(q => hull(q.flat())),
      body: inked(part, none, true).words.map(q => hull(q.flat())),
      cols: ink.map(colsOf),
      heads: stems.map(m => hull([th.strokePolys({ ...b.strokes[m.si], s: b.strokes[m.si].s.slice(0, m.cut + 1) }), ...m.riders.map(r => th.strokePolys(b.strokes[r]))].flat(2))), // prettier-ignore
      entry: null,
      roofed: null,
    };
  if (first >= 0 && ROOFED.includes(text[0])) {
    // the roof: written to the left from the stroke's start, as far as it rises
    const q = b.strokes[first].s;
    let top = 0;
    while (top + 1 < q.length && q[top + 1].x < q[top].x && q[top + 1].y >= q[top].y - 0.005) top++;
    if (top > ROOF_LAP + 3) {
      const ux = q[top].x - q[top - 3].x,
        uy = q[top].y - q[top - 3].y,
        n = Math.hypot(ux, uy);
      l.roofed = { si: first, cut: top, u: [ux / n, uy / n] };
    }
  }
  if (first >= 0 && !stems.some(m => m.si === first)) {
    const q = b.strokes[first].s;
    let cut = 0;
    while (cut < ENTRY_IN && q[cut].w < FULL_W) cut++;
    const hx = q[cut + 2].x - q[cut].x,
      hy = q[cut + 2].y - q[cut].y,
      n = Math.hypot(hx, hy);
    // an entry comes from above or from the right: the pen must start the stroke downwards or to the right
    if (hy / n < -0.3 || (hx / n > 0.3 && hy <= 0)) l.entry = { si: first, cut, back: [-hx / n, -hy / n] };
  }
  lineCache.set(key, l);
  return l;
}
/** A line where it stands: each word's shift sideways, its baseline, and how much taller each stem is drawn. */
interface Placed {
  l: Line;
  off: number[];
  dy: number;
  extra: number[];
  swaps?: Swap[];
  /** Dots set elsewhere than written (the line's frame), and ink drawn with the line where it stands (a roof drawn
   *  out: a stroke of its own). */
  dots?: ReadonlyMap<number, Pt>;
  more?: Poly[];
  /** Curved stems: how each stem is bent (null: straight). */
  bends?: (Bend | null)[];
}
const inkAt = (p: Placed, stub = false): Poly[] => [
  ...inked(p.l, p.extra, false, p.swaps, stub, p.dots, p.bends).words.flatMap((w, k) =>
    w.map(q => q.map(([x, y]) => [x + p.off[k], y + p.dy] as Pt)),
  ),
  ...(stub ? [] : (p.more ?? [])),
];
/** How much taller stem s of a placed line can be drawn before what rises of it comes within CLEAR of ink above it
 *  (the canopy): the stems give way. */
function under(p: Placed, s: number, above: readonly Poly[]) {
  const m = p.l.stems[s],
    h = p.l.heads[s],
    pad = CLEAR + 0.3,
    x0 = Math.min(...h.map(q => q[0])) + p.off[m.wi] - pad + Math.min(0, m.lean * 14),
    x1 = Math.max(...h.map(q => q[0])) + p.off[m.wi] + pad + Math.max(0, m.lean * 14),
    top = Math.max(...h.map(q => q[1])) + p.dy;
  let low = Infinity;
  for (const q of above) for (const [x, y] of q) if (x >= x0 && x <= x1 && y > top - 1 && y < low) low = y;
  return low - CLEAR - 0.25 - top;
}
/** Whether some ink comes within CLEAR of a dot of a placed line. */
function nearDots(p: Placed, ink: Poly[]): boolean {
  const pts = ink.flat();
  return p.l.b.dots.some(([x, y], k) => {
    const X = x + p.off[p.l.dotWord[k] ?? 0],
      Y = y + p.dy;
    return pts.some(v => Math.hypot(v[0] - X, v[1] - Y) < 0.75 * NIB + CLEAR);
  });
}
/** (c) A stem as the canopy: stem k of a placed line rises until its split stands a little inside the rim's circle,
 *  and its head gives way to the arc. */
function stemCanopy(p: Placed, k: number, rho: number, tip = TIP, runMin = RUN_MIN) {
  const m = p.l.stems[k],
    st = p.l.b.strokes[m.si],
    q = st.s[m.cut],
    dx = p.off[m.wi],
    x = q.x + dx,
    y = q.y + p.dy,
    a = m.lean * m.lean + 1,
    b = x * m.lean + y,
    n = Math.hypot(m.lean, 1);
  for (const drop of DROPS_STEM) {
    const c = x * x + y * y - (rho - drop) ** 2;
    if (c > 0) {
      if (process.env.WIDE_DEBUG) no(`stemCanopy: split outside, ${Math.hypot(x, y).toFixed(1)} of ${rho.toFixed(1)}`);
      continue;
    }
    const e = (-b + Math.sqrt(b * b - a * c)) / a,
      arc = canopyArc([x + m.lean * e, y + e], [m.lean / n, 1 / n], q.w, st.ang, rho, tip, runMin);
    if (!arc) {
      if (process.env.WIDE_DEBUG)
        no(
          `stemCanopy: no arc from ${(x + m.lean * e).toFixed(1)},${(y + e).toFixed(1)} lean ${m.lean.toFixed(2)} rho ${rho.toFixed(1)} drop ${drop} tip ${tip.toFixed(2)}`,
        );
      continue;
    }
    // (the arc's neck too keeps clear of every dot of its line: a dot swallowed by the arc is a letter lost)
    if (nearDots(p, th.strokePolys({ ang: st.ang, s: arc.s }))) continue;
    return {
      extra: e,
      swap: { si: m.si, from: m.cut, s: arc.s.map(v => ({ ...v, x: v.x - dx, y: v.y - p.dy })) } as Swap,
      loose: th.strokePolys({ ang: st.ang, s: arc.s.slice(0, -STUB) }),
      from: arc.phi0 * DEG,
      at: Math.atan2(x + m.lean * e, y + e) * DEG,
      to: arc.phiEnd * DEG,
    };
  }
  return null;
}
/** (a) An entry as the canopy: a line whose first stroke is taken over at C, set so that C stands `drop` inside the
 *  rim's circle, `hang` above the level diameter on the right. */
function entryCanopy(l: Line, rho: number, hang: number, drop: number, tip = TIP) {
  const en = l.entry!,
    st = l.b.strokes[en.si],
    q = st.s[en.cut],
    C: Pt = [(rho - drop) * Math.cos(hang), (rho - drop) * Math.sin(hang)],
    dx = C[0] - q.x,
    dy = C[1] - q.y,
    arc = canopyArc(C, en.back, q.w, st.ang, rho, tip);
  if (!arc) return null;
  return {
    dx,
    dy,
    swap: { si: en.si, from: en.cut, s: arc.s.map(v => ({ ...v, x: v.x - dx, y: v.y - dy })) } as Swap,
    dots: ridden(l, [q.x, q.y], en.back),
    loose: th.strokePolys({ ang: st.ang, s: arc.s.slice(0, -STUB) }),
    from: arc.phi0 * DEG,
    to: arc.phiEnd * DEG,
  };
}
/** A roof drawn out as the canopy: the line stands with its first letter's roof-top at T (the circle's frame), and
 *  the roof's line is drawn on from there, to the left, up to the rim's circle and along it to `tip` left of the
 *  top. The letter is kept whole: the drawn-out roof is a stroke of its own, begun a little before the roof's top. */
function roofArc(l: Line, T: Pt, rho: number, tip: number) {
  const rf = l.roofed!,
    st = l.b.strokes[rf.si],
    q = st.s[rf.cut],
    arc = canopyArc(T, rf.u, q.w, st.ang, rho, tip);
  if (!arc) return null;
  const lead = st.s.slice(rf.cut - ROOF_LAP, rf.cut + 1).map(v => ({ ...v, x: v.x - q.x + T[0], y: v.y - q.y + T[1] })),
    s = arc.s.slice().reverse();
  return {
    ink: th.strokePolys({ ang: st.ang, s: [...lead, ...s] }),
    loose: th.strokePolys({ ang: st.ang, s: s.slice(STUB) }),
    from: arc.phi0 * DEG,
    to: arc.phiEnd * DEG,
  };
}
/** The same for a word hung from the top: centred, or moved `shift` to the right, its roof-top `drop` inside the
 *  rim's circle. */
function roofCanopy(l: Line, rho: number, shift: number, drop: number, tip: number) {
  const rf = l.roofed!,
    q = l.b.strokes[rf.si].s[rf.cut],
    dx = -(l.x0 + l.x1) / 2 + shift,
    x = q.x + dx,
    r = rho - drop;
  if (Math.abs(x) >= r) return null;
  const dy = Math.sqrt(r * r - x * x) - q.y,
    arc = roofArc(l, [x, q.y + dy], rho, tip);
  return arc && { dx, dy, ...arc };
}
/** Where the rim runs the way a stroke starts: the angle above the level diameter, on the right. */
const hangOf = (back: Pt) => Math.min(HANG_MAX, Math.max(HANG_MIN, Math.atan2(-back[0], back[1])));
/** Where the stems of a line stop: each at the circle, none taller than CAP times its height as written; the stems of
 *  the name of God together or not at all (each to the rim: off the circle's axis one factor for all three would hold
 *  the name down to its outermost stem). */
function stops(stems: readonly Stem[], room: readonly number[]): number[] {
  const e = stems.map((m, k) => Math.max(0, Math.min(room[k], (CAP - 1) * m.top)));
  return stems.map((m, k) =>
    m.name && stems.some((o, j) => o.name && o.wi === m.wi && e[j] < MIN_RISE * o.top) ? 0 : e[k],
  );
}
/** How much taller stem s of a placed line can be drawn before it meets the circle; nothing, if it would meet it
 *  within GIVE of the level diameter: there the rim is the bowl's. */
function free(p: Placed, s: number, Rt: number) {
  const m = p.l.stems[s],
    e = room(p.l.heads[s], p.off[m.wi], p.dy, m.lean, Rt);
  return e > 0 && p.dy + m.base + m.top + e < Rt * Math.sin(GIVE) ? 0 : e;
}

// ======== curved stems: the risen stems of a line as meridians (tests/char-meridian-sheet.test.ts) ========
// C1. A risen stem keeps its share of the circle's width as it rises (char-first.ts `meridianShift`, strength 1): it
//     leaves its foot upright and leans to the pole as the circle narrows. Unrisen stems stay straight; so does a
//     stem bowed over as a sub-canopy, and a stem that is one stroke with the cradle's bowl.
// C2. The name of God is bent as one body, on its middle stem's meridian.
// C3. Not on a line whose stems stand higher than NAME_LAT of the radius: near the pole the meridians tip over.
// C4. A stem that is the canopy rises on its meridian and flows into the rim from the direction it then has.
// C5. Each stem rises until it meets the margin or comes within CLEAR of the canopy; two stems that come within
//     CLEAR of each other: the outer is drawn shorter. Whatever then comes within CLEAR of other writing: all are
//     drawn shorter together; if that does not clear it, the stems stay straight.
// C6. Only where at least CURVE_MIN stems rise and curve, with one at least CURVE_SIDE of the radius to each side of
//     the upright axis: one or two curved stems read as a slip of the pen, stems all on one side as a slant; three
//     or more about the axis as a dome.
// The layout is not changed by any of this: it is found with straight stems, and the stems are then redrawn.
const CURVED = !process.env.WIDE_STRAIGHT,
  CURVE_MIN = +(process.env.WIDE_CURVE_MIN ?? 3),
  CURVE_SIDE = +(process.env.WIDE_CURVE_SIDE ?? 0.15), // of the radius: a stem at least this far from the upright axis, on each side
  NAME_LAT = 0.4,
  SLACK = 0.3, // what the raster needs over CLEAR to call two inks clear
  TRIM = 0.6, // a stem that comes too near its neighbour is drawn this much shorter at a time
  NECK_BENT = 5 * NIB, // a curved stem's pen turns to the rim's over this length
  DROPS_BENT = [2.2, 3, 4, 5, 6.5]; // how far inside the rim a curved stem is led into it: the least that stands
const footOf = (p: Placed, s: number) => p.l.b.strokes[p.l.stems[s].si].s[p.l.stems[s].cut + 1];
/** C1 to C3: how each stem of a placed line is bent (`which`: the stems that are). */
function bendsOf(p: Placed, rho: number, which: ReadonlySet<number>): (Bend | null)[] {
  return p.l.stems.map((m, s) => {
    if (!which.has(s)) return null;
    const ox = p.off[m.wi],
      bd: Bend = { ox, oy: p.dy, rho, k: 1, ease: EASE };
    if (m.name) {
      const mine = p.l.stems.map((o, j) => (o.name && o.wi === m.wi ? footOf(p, j) : null)).filter(v => !!v).sort((a, b) => a.x - b.x); // prettier-ignore
      bd.x0 = mine[(mine.length - 1) >> 1].x + ox;
      bd.y0 = Math.max(...mine.map(q => q.y)) + p.dy;
    }
    return bd;
  });
}
/** Some ink as points, one to a cell of 0.3: what a stem is kept clear of. */
function thin(polys: readonly Poly[]): Pt[] {
  const seen = new Map<string, Pt>();
  for (const q of polys) for (const v of q) seen.set(`${Math.round(v[0] / 0.3)},${Math.round(v[1] / 0.3)}`, v as Pt);
  return [...seen.values()];
}
/** C5: how much taller stem s can be drawn on its meridian before what rises of it leaves a circle of radius `stop`
 *  or comes within CLEAR of `roof`. */
function reach(p: Placed, s: number, stop: number, roof: readonly Pt[]): number {
  const m = p.l.stems[s],
    ox = p.off[m.wi],
    bd = p.bends?.[s],
    cap = (CAP - 1) * m.top,
    x0 = footOf(p, s).x + ox,
    near = roof.filter(v => v[0] > Math.min(x0, 0) - 5 && v[0] < Math.max(x0, 0) + 5),
    ok = (e: number) => {
      for (const st of meridians(p.l.b, [m], [e], [bd]).rise[0])
        for (const q of st.s) {
          const x = q.x + ox,
            y = q.y + p.dy,
            h = ((st.nib ?? NIB) / 2) * q.w;
          if (Math.hypot(x, y) + h > stop) return false;
          for (const v of near) if (Math.hypot(v[0] - x, v[1] - y) < h + CLEAR + SLACK) return false;
        }
      return true;
    };
  if (!ok(0)) return 0;
  if (ok(cap)) return cap;
  let lo = 0,
    hi = cap;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
/** What rises of each stem of a placed line, as ink where it stands (`keep`: the canopy's stem, without its head). */
function risenInk(p: Placed, extra: readonly number[], bent: boolean, keep: ReadonlySet<number> = new Set()): Poly[][] {
  return meridians(p.l.b, p.l.stems, extra, bent ? (p.bends ?? []) : []).rise.map((r, s) => {
    const m = p.l.stems[s];
    return r
      .flatMap((st, i) => th.strokePolys(keep.has(s) && i === 0 ? { ...st, s: st.s.slice(m.cut) } : st))
      .map(v => v.map(([x, y]) => [x + p.off[m.wi], y + p.dy] as Pt));
  });
}
/** C5: a stem whose risen part comes within CLEAR of another's is drawn shorter, the outer of the two, until they
 *  are clear. Pairs that are as near as written are left. */
function trimStems(p: Placed, R: number, keep: ReadonlySet<number>) {
  const stems = p.l.stems,
    key = ([i, j]: [number, number]) => i * 100 + j,
    was = new Set(nearPairs(risenInk(p, stems.map(() => 0), false), R, CLEAR).map(key)), // prettier-ignore
    out = (s: number) => Math.abs(footOf(p, s).x + p.off[stems[s].wi]);
  for (let n = 0; n < 120; n++) {
    const hits = nearPairs(risenInk(p, p.extra, true, keep), R, CLEAR).filter(pr => !was.has(key(pr)));
    if (!hits.length) break;
    for (const pr of hits) {
      const can = pr.filter(s => !keep.has(s) && p.bends?.[s] && p.extra[s] > 0).sort((a, b) => out(b) - out(a));
      if (!can.length) {
        was.add(key(pr));
        continue;
      }
      const v = can[0];
      p.extra[v] = p.extra[v] - TRIM < MIN_RISE * stems[v].top ? 0 : p.extra[v] - TRIM;
    }
  }
}
/** C4: a stem as the canopy, on its meridian: stem k rises until its split stands a little inside the rim's circle,
 *  and is led into the rim from there with the direction it has. */
function stemCanopyBent(p: Placed, k: number, rho: number, tip = TIP, runMin = RUN_MIN) {
  const m = p.l.stems[k],
    st = p.l.b.strokes[m.si],
    dx = p.off[m.wi],
    bd = p.bends?.[k],
    at = (e: number) => meridians(p.l.b, [m], [e], [bd]).strokes[m.si].s,
    rad = (e: number) => Math.hypot(at(e)[m.cut].x + dx, at(e)[m.cut].y + p.dy),
    big = 2 * rho;
  for (const drop of DROPS_BENT) {
    if (rad(0) > rho - drop || rad(big) < rho - drop) continue;
    let lo = 0,
      hi = big;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (rad(mid) < rho - drop) lo = mid;
      else hi = mid;
    }
    const s = at(lo),
      q = s[m.cut],
      z = s[m.cut + 1],
      n = Math.hypot(q.x - z.x, q.y - z.y),
      phi = q.rot ?? 0,
      // (the pen is already turned with the stem: the arc's pen starts from that)
      arc = canopyArc([q.x + dx, q.y + p.dy], [(q.x - z.x) / n, (q.y - z.y) / n], q.w, st.ang + phi * DEG, rho, tip, runMin, NECK_BENT); // prettier-ignore
    if (!arc || lo > (CAP - 1) * m.top + 1e-6) continue;
    const led = arc.s.map(v => ({ ...v, rot: (v.rot ?? 0) + phi }));
    return {
      extra: lo,
      swap: { si: m.si, from: m.cut, s: led.map(v => ({ ...v, x: v.x - dx, y: v.y - p.dy })) } as Swap,
      loose: th.strokePolys({ ang: st.ang, s: led.slice(0, -STUB) }),
      from: arc.phi0 * DEG,
      to: arc.phiEnd * DEG,
    };
  }
  return null;
}
/** C1 to C6 on a placed line whose layout is settled: its risen stems are redrawn as meridians of the circle of
 *  radius rho. `canopy`: the stem that is the canopy (-1: none) and its tip; `keep`: stems that stay straight;
 *  `roof`: the canopy as a piece of its own; `above`: other ink the stems stop under; `others`: every other piece.
 *  Returns the canopy redrawn (true: there is none) or null, the line left as it was. */
interface Led {
  loose: Poly[];
  from: number;
  to: number;
}
function curve(
  p: Placed,
  R: number,
  rho: number,
  o: {
    canopy: number;
    tip?: number;
    /** Stems bowed over as sub-canopies: each on its circle, to its tip. */
    subs: { k: number; r: number; tip: number; run: number }[];
    roof: Poly[] | null;
    above: Poly[];
    others: Poly[][];
  },
): { roof: Led | null; subs: Led[] } | null {
  if (!CURVED) return null;
  const stems = p.l.stems,
    was = { extra: p.extra.slice(), swaps: p.swaps, bends: p.bends },
    fail = (why: string) => {
      if (process.env.WIDE_DEBUG) console.log(`curve ${p.l.text}: ${why}`);
      p.extra = was.extra;
      p.swaps = was.swaps;
      p.bends = was.bends;
      return null;
    },
    which = new Set(stems.map((_, s) => s).filter(s => p.extra[s] > 0 && stems[s].si !== p.l.take?.si && footOf(p, s).y + p.dy <= NAME_LAT * rho)), // prettier-ignore
    xs = [...which].map(s => footOf(p, s).x + p.off[stems[s].wi]);
  if (which.size < CURVE_MIN || Math.max(...xs) < CURVE_SIDE * rho || Math.min(...xs) > -CURVE_SIDE * rho) return null;
  // (a stem that leads an arc is bent with the others, or the line is left as it was)
  if ((o.canopy >= 0 && !which.has(o.canopy)) || o.subs.some(q => !which.has(q.k))) return null;
  p.bends = bendsOf(p, rho, which);
  let roof: Led | null = null;
  const k = o.canopy,
    led = new Set(o.subs.map(q => q.k)),
    subs: Led[] = [];
  if (k >= 0) {
    led.add(k);
    const c = stemCanopyBent(p, k, rho, o.tip);
    if (!c) return fail('the canopy stem cannot be led into the rim');
    p.swaps = (p.swaps ?? []).map(q => (q.si === stems[k].si ? c.swap : q));
    p.extra[k] = c.extra;
    roof = c;
  }
  for (const q of o.subs) {
    const c = stemCanopyBent(p, q.k, q.r, q.tip, q.run);
    if (!c) return fail('a bowed stem cannot be led into its circle');
    p.swaps = (p.swaps ?? []).map(v => (v.si === stems[q.k].si ? c.swap : v));
    p.extra[q.k] = c.extra;
    subs.push(c);
  }
  const arcs = [...(roof ? [roof.loose] : o.roof ? [o.roof] : []), ...subs.map(q => q.loose)],
    pts = thin([...arcs.flat(), ...o.above]),
    f = stems.map((_, s) => (led.has(s) || !which.has(s) ? p.extra[s] : reach(p, s, R - MARGIN, pts))),
    e = stops(stems, f);
  p.extra = stems.map((_, s) => (led.has(s) || !which.has(s) ? f[s] : e[s]));
  trimStems(p, R, led);
  const rest = [...arcs, ...o.others];
  for (let n = 0; ; n++) {
    const ink = inkAt(p, true);
    if (Math.max(...ink.flat().map(([x, y]) => Math.hypot(x, y))) <= R - MARGIN + 0.02 && !nearPairs([ink, ...rest], R, CLEAR).some(pr => Math.min(...pr) <= arcs.length)) break; // prettier-ignore
    if (n >= 6) return fail('not clear of the writing');
    p.extra = p.extra.map((v, s) => (led.has(s) || !which.has(s) ? v : v * 0.85));
  }
  return { roof, subs };
}

/** How far to the right the last word of a placed line reaches. */
const rightOf = (p: Placed) => Math.max(...p.l.whole[p.l.nw - 1].map(q => q[0])) + p.off[p.l.nw - 1];

/** The cradle stroke of a placed line up to where the bowl is taken over (without a beginning that an entry has
 *  redrawn: a short word may be one stroke from its first letter to its last). */
function preOf(p: Placed): Sample[] {
  const pre = inked(p.l, p.extra).pre,
    sw = p.swaps?.find(q => q.si === p.l.take!.si);
  return sw ? pre.slice(sw.from) : pre;
}
// ---- the bowl, with its neck mended ----
interface Bowl {
  /** The whole stroke, from its letter's head, with the letter's dots; and the part that is checked as a piece of
   *  its own (from two nibs past where it leaves its letter). */
  ink: Poly[];
  loose: Poly[];
  phi0: number;
  phiEnd: number;
}
/** A dot stays with its letter (A6): a dot written above the line, over a bowl that is redrawn, stays where it was
 *  written; if the new stroke would pass within DOT_CLEAR of it, it is lifted straight up until it is clear. (The
 *  placed line is given the dot's new place.) */
const DOT_OWN = 1.5 * NIB, // other words keep this far from a dot that stays over a redrawn bowl
  DOT_CLEAR = FLOOR / 2 + 0.75 * NIB + CLEAR,
  DOT_LIFT = 0.3 * NIB;
function liftDots(p: Placed, head: Head, pen: readonly Sample[], dx: number): number {
  let n = 0;
  for (const d of head.stay ?? []) {
    let y = d.y;
    const near = () => pen.some(q => Math.hypot(q.x - (d.x + dx), q.y - (y + p.dy)) < DOT_CLEAR);
    while (near() && y < d.y + 6 * NIB) y += DOT_LIFT;
    if (y === d.y) continue;
    p.dots = new Map([...(p.dots ?? []), [d.k, [d.x, y] as Pt]]);
    n++;
  }
  return n;
}
/** The great bowl of a placed line's last letter (the cradle's, from the helper). `hold`: how far to the right the
 *  line it holds reaches, when it is to end just past it; otherwise it ends as high on the right as it lands on the
 *  left. `neck`: 0 draws it as the cradle first did. */
function bowlOf(
  p: Placed,
  R: number,
  hold: number | null,
  neck = NECK,
  /** The sub-cradle: its circle is this far inside the cradle's, and it ends where `end` says. */
  inset = 0,
  end?: (phi0: number, rho: number) => number,
): Bowl | null {
  const { head } = p.l.take!,
    dx = p.off[p.l.nw - 1],
    rho = R - MARGIN - FLOOR / 2 - 0.05 - inset,
    pre = preOf(p),
    bowl = sweep(
      [-(head.C[0] + dx), head.C[1] + p.dy],
      [-head.u[0], head.u[1]],
      head.pre[head.pre.length - 1].w,
      rho,
      phi0 => end ? end(phi0, rho) : hold != null ? Math.min(-Math.asin(Math.min(0.95, Math.max(0, hold + 2 * NIB) / rho)), phi0 - (TIP_LEN * 1.7) / rho) : -Math.min(SPAN_MAX, Math.max(phi0, 0.5)), // prettier-ignore
      neck || undefined,
    );
  if (!bowl) return null;
  const pen = bowlPen(head, bowl.s),
    s = [...pre.map(q => ({ ...q, x: q.x + dx, y: q.y + p.dy })), ...pen],
    // (its dots above the line stay with it, lifted clear of the new stroke if they must be)
    rd = rho - FLOOR / 2 - 1.25 * NIB + 0 * liftDots(p, head, pen, dx),
    // the letter's dots: in the bowl where it begins, along the floor
    dots = Array.from({ length: head.dots }, (_, i) => {
      const phi = bowl.phi0 - (2.2 * NIB + i * 1.2 * NIB) / rd;
      return th.dotPolysAt(-rd * Math.sin(phi), -rd * Math.cos(phi), 1, -phi);
    }).flat();
  return {
    ink: [...th.strokePolys({ ang: head.ang, s }), ...dots],
    loose: [...th.strokePolys({ ang: head.ang, s: pen.slice(Math.ceil((2 * NIB) / STEP)) }), ...dots],
    phi0: bowl.phi0,
    phiEnd: bowl.phiEnd,
  };
}

/** A tail running forth (rule W3): the final ra, zay, waw or mim of the last word, taken over as a bowl is, comes
 *  down to the rim's circle the way it is already going (down and to the left) and follows it on, up the left side,
 *  for FORTH_RUN, never higher than FORTH_TOP below the level diameter. Nothing sits in it. Its angles are given as
 *  the cradle's (from the bottom, positive to the left). */
function forthOf(p: Placed, R: number, run = FORTH_RUN): Bowl | null {
  const { head } = p.l.take!,
    dx = p.off[p.l.nw - 1],
    rho = R - MARGIN - FLOOR / 2 - 0.05,
    pre = preOf(p),
    sw = sweep([head.C[0] + dx, head.C[1] + p.dy], head.u, head.pre[head.pre.length - 1].w, rho, phi0 => Math.max(phi0 - run, -(Math.PI / 2 - FORTH_TOP)), NECK); // prettier-ignore
  if (sw) liftDots(p, head, bowlPen(head, sw.s.map(q => ({ ...q, x: -q.x }))), dx); // prettier-ignore
  if (!sw || rho - Math.hypot(head.C[0] + dx, head.C[1] + p.dy) > FORTH_DROP)
    return no(
      `forth: drop ${(rho - Math.hypot(head.C[0] + dx, head.C[1] + p.dy)).toFixed(1)}, at ${(Math.atan2(head.C[0] + dx, -(head.C[1] + p.dy)) * DEG).toFixed(0)} degrees, u ${head.u.map(v => v.toFixed(2)).join(' ')}, sweep ${sw ? 'drawn' : 'none'}`,
    );
  // (the helper's pen mirrors a bowl back to the right: a tail running forth is given to it mirrored)
  const pen = bowlPen(head, sw.s.map(q => ({ ...q, x: -q.x }))), // prettier-ignore
    s = [...pre.map(q => ({ ...q, x: q.x + dx, y: q.y + p.dy })), ...pen],
    rd = rho - FLOOR / 2 - 1.25 * NIB,
    dots = Array.from({ length: head.dots }, (_, i) => {
      const phi = sw.phi0 - (2.2 * NIB + i * 1.2 * NIB) / rd;
      return th.dotPolysAt(rd * Math.sin(phi), -rd * Math.cos(phi), 1, phi);
    }).flat();
  return {
    ink: [...th.strokePolys({ ang: head.ang, s }), ...dots],
    loose: [...th.strokePolys({ ang: head.ang, s: pen.slice(Math.ceil((2 * NIB) / STEP)) }), ...dots],
    phi0: -sw.phi0,
    phiEnd: -sw.phiEnd,
  };
}

export interface Laid {
  R: number;
  polys: Poly[];
  lines: string[];
  cradle: Cradle | null;
  /** The bowl's angle of rim (degrees), the stems of the text, and how many times its height each risen stem is. */
  arc: number;
  stems: number;
  factors: number[];
  cost: number;
  note: string;
  /** The ground line's stems, how many of them reach the rim or the canopy, and its words read out of order. */
  ground?: [stems: number, reached: number, breaches: number, hollow: number];
}
const within = (pts: readonly Pt[], dx: number, dy: number, r: number) =>
  pts.every(([x, y]) => (x + dx) ** 2 + (y + dy) ** 2 <= r * r);
/** How low a line can sit with all its ink inside a circle of radius r (Infinity: it is too wide). */
function lowest(l: Line, off: readonly number[], r: number) {
  let h = -Infinity;
  l.whole.forEach((q, k) => {
    for (const [x, y] of q)
      h = Math.max(h, Math.abs(x + off[k]) < r ? -Math.sqrt(r * r - (x + off[k]) ** 2) - y : Infinity);
  });
  return h;
}
const centred = (l: Line) => new Array<number>(l.nw).fill(-(l.x0 + l.x1) / 2);
const profOf = (l: Line, off: readonly number[]) => profile(l.cols.map((c, k) => [c, off[k]] as const));

// ---- 3. one ground line ----
// 1. Of the words up to the cradle word, those that have a tall stem, and the cradle word itself, are the ground
//    line, written as one line in their order; the others are upper words. The cradle letter is the cradle's best
//    whose ground line holds no more than MAX_GROUND words (a longer line needs a circle so large that its stems
//    cannot reach the rim).
// 2. The words after the cradle word are in its bowl, on one line or on two, the lowest on the floor; the ground
//    line stands just over them (or on the floor, if there are none), and all its stems rise to the rim (CAP, GIVE,
//    the name's together or not at all).
// 3. Each upper word, in the order of the text, is tried at every place sideways (SCAN), resting on what is under it
//    at LINE_SPACE; never over a stem, so in a bay or beside the line. Its place is the one where the fewest ground
//    words are read out of order (the reading rule: the bowl's words last; before them the ground line from right
//    to left, and an upper word just before the ground word it stands over), then the lowest; measured by raster,
//    and lifted a little or moved on if it comes too near.
// 4. The ground line may be slid (SLIDES) and its word spaces opened (OPEN) to make a bay; the circle is the smallest
//    in which all this stands, or one up to LARGER times that if it costs less: the radius, raised by the share of
//    stems that do not reach the rim (UNRISEN), by each ground word read out of order (BREACH) and by an empty band
//    between the writing and the bowl (VOID).
// 5. THE CANOPY (mode set; modeOf is the rule as code). Which stroke, for any first word, the first that applies:
//    c. the first letter is a tall stem (the word then stands at the right end of the ground line): that stem rises
//       to the rim and its head gives way to the arc, which runs on over the top.
//    b. the word has no stem, is not the stacked name, and has a join the hand draws out (بسم): the last such join
//       is drawn out until the word spans KASH_SPAN of the upper rim, and the word is bent along a circle concentric
//       with the rim, its letters upright at the top; the drawn-out join rises to the rim's own circle (KASH_EASE).
//    a. the pen starts the first letter downwards or to the right (a tooth, the head of a mim or a hah): an entry is
//       led into it from the rim. The word, if it has no stem, leaves the bays: it hangs at the upper right, where the
//       rim runs the way that stroke starts (HANG_MAX down to HANG_MIN above the level diameter, the highest that
//       stands), to the right of every stem; the ground line slides left to let it.
//    c'. otherwise (the pen starts the first letter upwards: a qaf, a fa, a waw) the word's first stem, as in c.
//    The arc runs on the cradle's circle and ends TIP past the top (and follows the rim for RUN_MIN at least). Stems
//    give way: a stem under the canopy rises only until it is CLEAR under it, so their tops trace a circle inside the
//    rim's. Reading rule: the opening word first (upper right, or along the top from the right); then the ground line
//    from right to left, an upper word just before the ground word it stands over; the bowl's words last.
// THE NESTED ARCS (nest set). The circles: the rim's own (the canopy's and the cradle's), and each next one STEPIN
// inside the one before: the stroke's thickness and AIR.
// 6. The sub-cradle letter (subCradleOf): of the words after the cradle word (they sit in the cradle), the final
//    letter that best makes a returning arc: the cradle's bowls, then a mim's tail, a ra's or a waw's, then a dal's
//    foot (SUB_BOWL), less SUB_AFTER for a word after it; no more than one word after it. The words up to its word
//    are one line in the bowl; a word after it sits inside the sub-cradle, on the inner circle's floor. No word in
//    the cradle: no sub-cradle.
// 7. The sub-cradle is the cradle's stroke on the next circle in: from where its letter leaves the line (a foot:
//    from its tip, the letter kept whole) down to that circle and along it to the right. It follows its circle for
//    SUB_SHARE of what the cradle follows, at least past the line it holds, and its tip stops SUB_BACK short of the
//    cradle's tip at the least: the tips step back. The lowest line stands CLEAR over the inner arc, not the outer.
// 8. The sub-canopy: the next tall stem to the left of the canopy's letter (the first stem of the ground line, if
//    the canopy is an entry or a drawn-out word) rises to the next circle in and is bowed over along it to the left:
//    its bow is its top. It takes the first circle (SUB_STEPS) on which it clears what hangs from the canopy and is
//    no taller than CAP; it follows it for SUB_SHARE of what the canopy follows, SUB_RUN_MIN at least, and stops
//    SUB_BACK short of the canopy's tip where it can. The stems under it stop CLEAR beneath it, so their tops trace
//    the circle after. `canopies: 2` bows the stem after it too, on the circle after (the third ripple).
// 9. The circle is searched as before; an inner arc that needs one more than GROW_MAX times the canopy
//    arrangement's is dropped (both, then the dearer one, then none: `nested`).
/** A stroke that follows a circle, as reported: its circle's radius (the pen's middle) and the rim it follows, in
 *  degrees clockwise of the top (canopies) or anticlockwise of the bottom (cradles: from the left to the right). */
export interface Arc {
  name: 'canopy' | 'sub-canopy' | 'cradle' | 'sub-cradle';
  what: string;
  r: number;
  from: number;
  to: number;
}
/** Which inner arcs are asked for; `skip`: the sub-canopy passes over this many stems (0: the next to the left). */
export interface Nest {
  canopy?: boolean;
  cradle?: boolean;
  skip?: number;
  /** How many stems are bowed over, each on the next circle in (1). */
  canopies?: number;
}
export type Canopied = Laid & { roof: Roof | null; arcs: Arc[] };
/** The cradle letter of the one ground line (rule 1). */
export function groundCradle(text: string) {
  const stemmed = text.split(' ').map(w => lineOf(w).stems.length > 0);
  return cradleOf(text, wi => stemmed.slice(0, wi).filter(v => v).length + 1 > MAX_GROUND);
}
export function ground(
  text: string,
  mode: Mode = null,
  nest: Nest = {},
  plan?: Plan,
  /** The largest circle the caller would take: no first arrangement is looked for beyond it. */
  Rmax = Infinity,
): Canopied | null {
  const words = text.split(' '),
    n = words.length,
    stemmed = words.map(w => lineOf(w).stems.length > 0),
    cr = plan ? plan.cr : groundCradle(text);
  if (!cr && !plan) return null;
  // (no cradle: every word that has a tall stem is on the ground line)
  const ci = cr ? cr.wi : n,
    // (a single word is its own ground line, stem or none)
    onGround = words.map((_, k) => k === ci || (k < ci && stemmed[k]) || (n === 1 && !!plan)),
    gi = words.map((_, k) => k).filter(k => onGround[k]),
    ui = words.map((_, k) => k).filter(k => k < ci && !onGround[k]),
    g = lineOf(gi.length ? gi.map(k => words[k]).join(' ') : words[0], !!cr),
    uppers = ui.map(k => lineOf(words[k])),
    // the opening word stands apart when it hangs from the canopy or is the canopy
    apart = (mode === 'entry' || mode === 'kashida' || mode === 'roof') && ui[0] === 0,
    // or, where it is the ground line's first word, stays seated there: the arc is led from where it stands
    seated = (mode === 'entry' || mode === 'roof') && gi[0] === 0 && !!plan,
    sub = nest.cradle && cr && !plan?.forth ? subCradleOf(words, ci) : null,
    // the words after the cradle word, in its bowl: on one line, or on two
    afters: Line[][] = [];
  if (nest.cradle && !sub) return null;
  if (!gi.length || (!cr && gi.length > MAX_BARE)) return null;
  if ((mode === 'entry' || mode === 'kashida' || mode === 'roof') && !apart && !seated) return null;
  if (mode === 'entry' && !(seated ? g : uppers[0]).entry) return null;
  if (mode === 'roof' && !(seated ? g : uppers[0]).roofed) return null;
  // (with a sub-cradle: up to its word on one line, whose last letter it is; the words after it on a line inside it)
  if (sub)
    afters.push([lineOf(words.slice(ci + 1, sub.wi + 1).join(' '), true), ...(sub.wi < n - 1 ? [lineOf(words.slice(sub.wi + 1).join(' '))] : [])]); // prettier-ignore
  else if (ci >= n - 1) afters.push([]);
  for (let k = ci + 2; !sub && k <= n; k++) afters.push([[ci + 1, k], [k, n]].filter(([a, b]) => b > a).map(([a, b]) => lineOf(words.slice(a, b).join(' ')))); // prettier-ignore
  afters.reverse();
  const roofAt = new Map<number, [Placed, Roof] | null>();
  let curvedNote = '';
  /** One setting in a circle of radius R. */
  const at = (R: number, slide: number, gaps: number[], lift: number, aft: Line[], bent = false): Canopied | null => {
    const Rt = R - MARGIN,
      rho = Rt - FLOOR / 2 - 0.05,
      tot = gaps.reduce((t, v) => t + v, 0);
    let G = 0;
    const off = gaps.map(v => -(g.x0 - tot + g.x1) / 2 + slide - (G += v)),
      pas: Placed[] = aft.map(l => ({ l, off: centred(l), dy: 0, extra: l.stems.map(() => 0) })),
      m = pas.length - 1;
    let hg: number;
    if (pas.length) {
      pas[m].dy = lowest(pas[m].l, pas[m].off, Rt - FLOOR - CLEAR - (sub ? STEPIN : 0)) + lift;
      for (let i = m - 1; i >= 0; i--) pas[i].dy = pas[i + 1].dy + need(profOf(pas[i].l, pas[i].off), profOf(pas[i + 1].l, pas[i + 1].off)); // prettier-ignore
      hg = pas[0].dy + need(profOf(g, off), profOf(pas[0].l, pas[0].off));
    } else hg = lowest(g, off, cr ? Rt - FLOOR - CLEAR : Rt) + lift;
    if (!(hg < Infinity)) return no('1');
    const pg: Placed = { l: g, off, dy: hg, extra: g.stems.map(() => 0) };
    if (!g.body.every((q, k) => within(q, off[k], hg, Rt))) return no('2');
    if (!pas.every(p => p.l.whole.every(q => within(q, p.off[0], p.dy, Rt)))) return no('3');
    const f = g.stems.map((_, s) => free(pg, s, Rt));
    if (f.some(e => e < 0)) return no('4');
    // ---- the canopy ----
    let roof: Roof | null = null,
      hung: Placed | null = null, // the opening word, hung from its entry
      lid: Poly[] | null = null, // (b) the opening word, drawn out along the rim
      forced = -1;
    const rightmost = Math.max(...g.stems.map(q => q.x + off[q.wi]));
    if (seated) {
      // the opening word on the ground line: its first stroke is led to the rim from where it stands, if that is
      // near (a long way up would make a stem of a tooth)
      const at = mode === 'entry' ? g.entry! : g.roofed!,
        st = g.b.strokes[at.si],
        q = st.s[at.cut],
        C: Pt = [q.x + off[0], q.y + hg];
      if (rho - Math.hypot(C[0], C[1]) > SEAT_DROP) return no('18');
      if (mode === 'entry') {
        const arc = canopyArc(C, g.entry!.back, q.w, st.ang, rho);
        if (!arc) return no('18');
        pg.swaps = [{ si: at.si, from: at.cut, s: arc.s.map(v => ({ ...v, x: v.x - off[0], y: v.y - hg })) }];
        pg.dots = ridden(g, [q.x, q.y], g.entry!.back);
        roof = { loose: th.strokePolys({ ang: st.ang, s: arc.s.slice(0, -STUB) }), what: `an entry into the first letter of ${words[0]}, where it stands`, from: arc.phi0 * DEG, to: arc.phiEnd * DEG }; // prettier-ignore
      } else {
        // (clear of its own line as written, by points here; the raster decides at the end)
        const own = inkAt(pg, true).flat();
        for (const share of ROOF_TIPS) {
          const arc = roofArc(g, C, rho, ROOF_TIP * share);
          if (!arc || arc.loose.some(v => v.some(([x, y]) => own.some(w => Math.abs(w[0] - x) < CLEAR + 0.3 && Math.hypot(w[0] - x, w[1] - y) < CLEAR + 0.3)))) continue; // prettier-ignore
          pg.more = arc.ink;
          roof = { loose: arc.loose, what: `the roof of the first letter of ${words[0]} drawn out to the left, where it stands`, from: arc.from, to: arc.to }; // prettier-ignore
          break;
        }
        if (!roof) return no('18');
      }
    } else if (mode === 'entry') {
      const u = uppers[0];
      // as high as the rim runs the way the stroke starts, or lower if it must: never over a stem, so to the right
      // of them all
      for (let hang = hangOf(u.entry!.back); hang >= HANG_MIN - 1e-9 && !hung; hang -= HANG_STEP)
        for (const drop of DROPS) {
          const c = entryCanopy(u, rho, hang, drop);
          if (!c || !within(u.whole[0], c.dx, c.dy, Rt)) continue;
          if (Math.min(...u.whole[0].map(q => q[0])) + c.dx < rightmost + STEM_HALF) break;
          const q: Placed = { l: u, off: [c.dx], dy: c.dy, extra: [], swaps: [c.swap], dots: c.dots };
          if (c.dots.size && !inkAt(q).every(v => v.every(([x, y]) => Math.hypot(x, y) <= Rt))) continue;
          if (nearPairs([inkAt(q, true), c.loose], R, CLEAR).length) continue;
          hung = q;
          roof = { loose: c.loose, what: `an entry into the first letter of ${words[0]}, taken over ${drop} inside the rim's circle, the word hung ${(hang * DEG).toFixed(0)} degrees above the level diameter`, from: c.from, to: c.to }; // prettier-ignore
          break;
        }
      if (!hung) return no('6');
    } else if (mode === 'roof') {
      const u = uppers[0];
      // hung from the top, centred or a little to the right; the longest roof that is clear of its own word
      // (it depends on the circle alone: found once for each)
      if (!roofAt.has(R)) {
        roofAt.set(R, null);
        each: for (const shift of [0, 0.12 * Rt, 0.24 * Rt])
          for (const drop of ROOF_DROPS)
            for (const share of ROOF_TIPS) {
              const c = roofCanopy(u, rho, shift, drop, ROOF_TIP * share);
              if (!c || !within(u.whole[0], c.dx, c.dy, Rt)) continue;
              const q: Placed = { l: u, off: [c.dx], dy: c.dy, extra: u.stems.map(() => 0), more: c.ink };
              if (!c.ink.every(v => v.every(([x, y]) => Math.hypot(x, y) <= Rt + 0.02))) continue;
              if (nearPairs([inkAt(q, true), c.loose], R, CLEAR).length) continue;
              roofAt.set(R, [q, { loose: c.loose, what: `the roof of the first letter of ${words[0]} drawn out to the left, its top ${drop} inside the rim's circle`, from: c.from, to: c.to }]); // prettier-ignore
              break each;
            }
      }
      const had = roofAt.get(R);
      if (!had) return no('17');
      [hung, roof] = had;
    } else if (mode === 'stem') {
      const c = stemCanopy(pg, 0, rho);
      if (!c || c.extra > (CAP - 1) * g.stems[0].top + 1e-6) return no('7');
      if (plan && c.at < CANOPY_FROM) return no('15');
      pg.swaps = [c.swap];
      forced = c.extra;
      roof = { loose: c.loose, what: `the first stem of ${g.text.split(' ')[g.stems[0].wi]}, risen x${(1 + c.extra / g.stems[0].top).toFixed(2)} and turned into the rim`, from: c.from, to: c.to }; // prettier-ignore
    } else if (mode === 'kashida') {
      const c = drawnOut(words[0], Rt, rho);
      if (!c) return no('8');
      lid = c.ink;
      roof = { loose: c.ink, what: `the last join of ${words[0]} drawn out by ${(c.len / NIB).toFixed(1)} nibs, the word bent along the rim`, from: c.from, to: c.to }; // prettier-ignore
    }
    // ---- the sub-canopy: the next stem to the left, bowed over on the next circle in ----
    const subs: Roof[] = [],
      bowed: [number, number][] = [],
      bowedAt: { k: number; r: number; tip: number; run: number }[] = [];
    if (nest.canopy) {
      if (!roof) return no('13');
      const others = [roof.loose, ...(hung ? [inkAt(hung, true)] : [])];
      let outer: Roof = { ...roof, r: rho };
      for (let j = 0; j < (nest.canopies ?? 1); j++) {
        const k2 = (mode === 'stem' ? 1 : 0) + (nest.skip ?? 0) + j,
          m2 = g.stems[k2];
        let made: Roof | null = null;
        for (const steps of m2 ? SUB_STEPS : []) {
          const r2 = outer.r! - steps * STEPIN,
            c0 = stemCanopy(pg, k2, r2);
          if (!c0) continue;
          const tip = Math.min(-outer.to / DEG - SUB_BACK, (SUB_SHARE * (outer.from - outer.to) - c0.from) / DEG),
            c = stemCanopy(pg, k2, r2, tip, Math.max(SUB_RUN_MIN, (TIP_LEN * 1.65) / r2));
          if (!c || c.extra > (CAP - 1) * m2.top + 1e-6) continue;
          if (plan && c.to < -SUB_END) continue;
          if (nearPairs([...others, c.loose], R, CLEAR).some(pr => pr.includes(others.length))) continue;
          pg.swaps = [...(pg.swaps ?? []), c.swap];
          bowed.push([k2, c.extra]);
          bowedAt.push({ k: k2, r: r2, tip, run: Math.max(SUB_RUN_MIN, (TIP_LEN * 1.65) / r2) });
          made = { loose: c.loose, what: `the stem of ${nth(g, k2)} of ${g.text.split(' ')[m2.wi]}, risen x${(1 + c.extra / m2.top).toFixed(2)} and bowed over`, from: c.from, to: c.to, r: r2 }; // prettier-ignore
          break;
        }
        if (!made) return no('14');
        subs.push(made);
        others.push(made.loose);
        outer = made;
      }
    }
    const roofs = roof ? [...roof.loose, ...subs.flatMap(q => q.loose), ...(mode === 'roof' && hung ? inkAt(hung, true) : [])] : []; // prettier-ignore
    if (roof) g.stems.forEach((_, s) => (f[s] = Math.min(f[s], under(pg, s, roofs))));
    for (const [k2, e] of bowed) f[k2] = e;
    pg.extra = stops(g.stems, f);
    if (forced >= 0) f[0] = pg.extra[0] = forced;
    for (const [k2, e] of bowed) pg.extra[k2] = e;
    const reached = g.stems.filter((_, s) => pg.extra[s] > 0 && pg.extra[s] >= f[s] - 0.01).length,
      bowl = !cr ? null : plan?.forth ? forthOf(pg, R) : bowlOf(pg, R, pas.length ? null : rightOf(pg));
    if (cr && !bowl) return no('9');
    // ---- the sub-cradle: the bowl or tail of a letter in the bowl, returning along the next circle in ----
    let bowl2: Bowl | null = null;
    if (sub && bowl) {
      const held = pas.length > 1 ? rightOf(pas[1]) : null;
      bowl2 = bowlOf(pas[0], R, null, NECK, STEPIN, (phi0, r2) =>
        Math.max(
          Math.min(
            phi0 - SUB_SHARE * (bowl.phi0 - bowl.phiEnd),
            held != null ? -Math.asin(Math.min(0.95, Math.max(0, held + 2 * NIB) / r2)) : Infinity,
          ),
          bowl.phiEnd + SUB_BACK,
        ),
      );
      if (!bowl2) return no('12');
    }
    const bowls = !bowl ? [] : bowl2 ? [bowl.loose, bowl2.loose] : [bowl.loose],
      kept = (g.take?.head.stay ?? []).flatMap(d => {
        const at = pg.dots?.get(d.k) ?? [d.x, d.y];
        return th.dotPolysAt(at[0] + off[g.nw - 1], at[1] + hg);
      });
    // the upper words, each resting on the ground line as risen and on the upper words before it
    const ink = inked(g, pg.extra).words.flatMap((w, k) => w.map(q => q.map(([x, y]) => [x + off[k], y] as Pt))),
      below: [Cols, number][] = [[colsOf(ink), 0]],
      ups: Placed[] = [],
      // where each ground word stands
      mid = g.whole.map((q, k) => (Math.min(...q.map(p => p[0])) + Math.max(...q.map(p => p[0]))) / 2 + off[k]);
    let breaches = 0;
    const fixed = [inkAt(pg, true), ...pas.map(p => inkAt(p))];
    if (hung) {
      fixed.push(inkAt(hung, true));
      below.push([colsOf(inkAt(hung).map(q => q.map(([x, y]) => [x, y - hg] as Pt))), 0]);
    }
    if (roof) fixed.push(roof.loose);
    for (const q of subs) fixed.push(q.loose);
    for (const [j, u] of uppers.entries()) {
      if (apart && j === 0) continue;
      const under = profile(below),
        wide = (u.x1 - u.x0) / 2,
        // the ground words before it in the text
        before = gi.filter(k => k < ui[j]).length,
        places: { x: number; y: number; br: number }[] = [];
      for (let x = -Rt + wide; x <= Rt - wide; x += SCAN) {
        const dx = x - (u.x0 + u.x1) / 2,
          y = hg + need(profOf(u, [dx]), under);
        if (!within(u.whole[0], dx, y, Rt)) continue;
        // no upper word stands over a stem
        if (g.stems.some(q => Math.abs(q.x + off[q.wi] - x) < wide + STEM_HALF)) continue;
        // the ground word it stands over: the nearest
        let over = 0;
        mid.forEach((v, k) => {
          if (Math.abs(v - x) < Math.abs(mid[over] - x)) over = k;
        });
        places.push({ x: dx, y, br: over < before ? before - over : over - before });
      }
      places.sort((p, q) => p.br - q.br || p.y - q.y);
      // measured: the first place that keeps LINE_SPACE from the writing and CLEAR from the bowl, lifted a little
      // if it must be
      let put: Placed | null = null,
        br = 0,
        failed = Infinity,
        tries = 0;
      for (const c of places) {
        if (Math.abs(c.x - failed) < NIB) continue;
        if (++tries > TRIES) break;
        for (let up = 0; up <= 2 * NIB && !put; up += 0.5) {
          const q: Placed = { l: u, off: [c.x], dy: c.y + up, extra: [] },
            ink = inkAt(q),
            k = fixed.length + ups.length;
          if (!within(u.whole[0], c.x, c.y + up, Rt)) break;
          if (nearPairs([...fixed, ...ups.map(p => inkAt(p)), ink], R, LINE_SPACE).some(pr => pr.includes(k))) continue;
          if (nearPairs([...bowls, ink], R, CLEAR).some(pr => pr.includes(bowls.length))) continue;
          // (a dot is nearer its own letter than any other writing: an upper word keeps DOT_OWN from the cradle
          // letter's dots)
          if (kept.length && nearPairs([kept, ink], R, DOT_OWN).length) continue;
          put = q;
          br = c.br;
        }
        if (put) break;
        failed = c.x;
      }
      if (!put) return no('10');
      breaches += br;
      ups.push(put);
      // (in the ground line's own frame)
      below.push([colsOf(inkAt(put).map(q => q.map(([x, y]) => [x, y - hg] as Pt))), 0]);
    }
    const pieces = [...fixed, ...ups.map(p => inkAt(p)), ...bowls];
    if (nearPairs(pieces, R, CLEAR).length) return no('11');
    // ---- curved stems: the layout stands; its risen stems are redrawn as meridians (C1 to C6) ----
    if (bent) {
      const c = curve(pg, R, rho, {
        canopy: mode === 'stem' ? 0 : -1,
        subs: bowedAt,
        roof: roof ? roof.loose : null,
        above: hung && mode === 'roof' ? inkAt(hung, true) : [],
        others: [...pas.map(p => inkAt(p)), ...(hung ? [inkAt(hung, true)] : []), ...ups.map(p => inkAt(p)), ...bowls], // prettier-ignore
      });
      if (c?.roof && roof) roof = { ...roof, loose: c.roof.loose, from: c.roof.from, to: c.roof.to };
      c?.subs.forEach((q, j) => (subs[j] = { ...subs[j], loose: q.loose, from: q.from, to: q.to }));
      curvedNote = c ? `; ${pg.bends?.filter(v => v).length ?? 0} stems curved as meridians` : '';
    }
    const factors = g.stems.map((q, s) => 1 + pg.extra[s] / q.top).filter(v => v > 1.001),
      total = g.stems.length + aft.reduce((t, l) => t + l.stems.length, 0),
      // the empty band between the lowest ink and the bowl's floor, as a share of the circle's height
      hollow =
        (Math.min(...[inkAt(pg, true), ...pas.map(p => inkAt(p))].flat(2).map(q => q[1])) + Rt - FLOOR) / (2 * Rt),
      moved = (tot + Math.abs(slide)) / NIB,
      cost =
        R *
        (1 + UNRISEN * (total ? 1 - reached / total : 0)) *
        (1 + BREACH * breaches) *
        (1 + (n === 1 && plan ? 0 : cr ? VOID : VOID_BARE) * hollow) *
        (1 + 0.004 * moved),
      // as drawn: the canopy with its stroke
      drawn = [inkAt(pg), ...pas.map(p => inkAt(p)), ...(hung ? [inkAt(hung)] : []), ...(lid ? [lid] : []), ...ups.map(p => inkAt(p)), ...(bowl ? [bowl.ink] : []), ...(bowl2 ? [bowl2.ink] : [])], // prettier-ignore
      arcs: Arc[] = [];
    // (any text: nothing may leave the margin, an arc's neck no more than a word)
    if (plan && Math.max(...drawn.flat(2).map(([x, y]) => Math.hypot(x, y))) > Rt + 0.02) return no('16');
    if (roof) arcs.push({ name: 'canopy', what: roof.what, r: rho, from: roof.from, to: roof.to });
    for (const q of subs) arcs.push({ name: 'sub-canopy', what: q.what, r: q.r!, from: q.from, to: q.to });
    if (cr && bowl) arcs.push({ name: 'cradle', what: `the final ${cr.c} of ${words[ci]}${plan?.forth ? ', its tail running forth' : ''}`, r: rho, from: bowl.phi0 * DEG, to: bowl.phiEnd * DEG }); // prettier-ignore
    if (bowl2) arcs.push({ name: 'sub-cradle', what: `the final ${sub!.c} of ${words[sub!.wi]}`, r: rho - STEPIN, from: bowl2.phi0 * DEG, to: bowl2.phiEnd * DEG }); // prettier-ignore
    return {
      R,
      polys: drawn.flatMap(k => cleanOutline(k)),
      lines: [...ui.map(k => `(${words[k]})`), g.text, ...aft.map(l => l.text)],
      ground: [g.stems.length, reached, breaches, hollow],
      cradle: cr,
      arc: bowl ? Math.abs(bowl.phi0 - bowl.phiEnd) * DEG : 0,
      stems: total,
      factors,
      cost,
      roof,
      arcs,
      note: `${reached} of ${g.stems.length} ground stems reach the rim${roof ? ' or the canopy' : ''}; ${breaches} ground word${breaches === 1 ? '' : 's'} read out of order; spaces opened ${(tot / NIB).toFixed(1)} nibs, line slid ${(slide / NIB).toFixed(1)} nibs${curvedNote}`,
    };
  };
  // every opening of the word spaces
  const opens: number[][] = [[0]];
  for (let k = 1; k < g.nw; k++) opens.splice(0, opens.length, ...opens.flatMap(q => OPEN.map(v => [...q, v])));
  let best: Canopied | null = null,
    args: [number, number, number[], number, Line[]] | null = null;
  for (let R = 10; R < 150 && (best ? R <= best.R * LARGER : R <= Rmax); R *= 1.02)
    for (const slide of mode === 'entry' ? [...SLIDES.filter(v => v <= 0), ...MORE_SLIDES] : SLIDES)
      for (const gaps of opens)
        for (const aft of afters)
          for (const lift of n === 1 ? SINGLE_LIFTS : [0, 2, 5]) {
            const l = at(R, slide, gaps, lift, aft);
            if (!l) continue;
            if (SAY)
              SAY.push(
                `${l.cost.toFixed(1)} R${R.toFixed(1)} slide ${slide} gaps ${gaps.join(',')} lift ${lift}: ${l.note}`,
              );
            if (!best || l.cost < best.cost) {
              best = l;
              args = [R, slide, gaps, lift, aft];
            }
            break;
          }
  // (any text: the stems of the arrangement found are then curved, the layout held)
  if (best && args && plan && CURVED) {
    WHY.clear();
    const c = at(...args, true);
    if (!c && process.env.WIDE_DEBUG) console.log(`curve: the arrangement no longer stands (${[...WHY].map(([k, v]) => `${k}:${v}`).join(' ')})`); // prettier-ignore
    best = c ?? best;
  }
  return best;
}

// ---- (b) the opening word drawn out and bent along the rim ----
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** A word with its last join drawn out until it spans KASH_SPAN of the upper rim, bent along a circle concentric with
 *  the rim (letters upright at the top); the drawn-out join rises from the line of writing to the rim's own circle. */
function drawnOut(word: string, Rt: number, rho: number) {
  const plain = lineOf(word),
    rb = Rt - Math.max(...plain.whole[0].map(q => q[1])) - 0.05,
    len = KASH_SPAN * rb - (plain.x1 - plain.x0);
  if (len < 2 * KASH_EASE) return null;
  for (let k = [...word].length - 1; k > 0; k--) {
    const b = th.buildStrokes(word, { kashMap: { [k]: len }, sag: 0 }),
      kp = b.placed.find(q => 'kash' in q);
    if (!kp || !('kash' in kp)) continue;
    const xs = b.strokes.flatMap(st => st.s.map(q => q.x)),
      mid = (Math.min(...xs) + Math.max(...xs)) / 2,
      rise = (x: number) => (rho - rb) * smooth((x - (kp.ox - kp.len)) / KASH_EASE) * smooth((kp.ox - x) / KASH_EASE),
      carry = (x: number, y: number) => {
        const phi = (x - mid) / rb + KASH_TURN,
          r = rb + y + rise(x);
        return { x: r * Math.sin(phi), y: r * Math.cos(phi), a: -phi };
      },
      ink = [
        ...b.strokes.flatMap(st => th.strokePolys({ ...st, s: st.s.map(q => { const c = carry(q.x, q.y); return { ...q, x: c.x, y: c.y, rot: (q.rot ?? 0) + c.a }; }), own: undefined })), // prettier-ignore
        ...b.dots.flatMap(([x, y, sc, rot]) => {
          const c = carry(x, y);
          return th.dotPolysAt(c.x, c.y, sc ?? 1, (rot ?? 0) + c.a);
        }),
      ];
    return {
      ink,
      len: kp.len,
      from: ((kp.ox - mid) / rb + KASH_TURN) * DEG,
      to: ((kp.ox - kp.len - mid) / rb + KASH_TURN) * DEG,
    };
  }
  return null;
}

// ---- which stroke (rule 5, as code) ----
/** The stacked name rides whole and is never drawn out (tests/curved-letters-sheet.test.ts). */
const RIGID = /^[وفبتك]?محمد$/;
export function modeOf(word: string): Mode {
  const l = lineOf(word);
  if (l.stems.some(m => l.b.strokes[m.si].own?.[0] === 0)) return 'stem';
  // (a word with a stem cannot lie along the rim: its stem would leave the circle)
  if (!l.stems.length && !RIGID.test(word) && drawnOut(word, 30, 29)) return 'kashida';
  return l.entry ? 'entry' : l.stems.length ? 'stem' : null;
}

// ---- the 15-word text: the cradle's level lines (helper), with the canopy and the inner arcs ----
// The cradle's arrangement, its upper half kept FLOOR + CLEAR further from the circle (and STEPIN more under a
// sub-canopy), its bottom line STEPIN further from the floor over a sub-cradle. The first word stands at the right
// end of the top line, and its stroke (rule 5) is drawn out from there; the next stem to its left on the top line is
// bowed over on the next circle in. The sub-cradle letter must end a line in the bowl. Each arc is shortened until
// it is CLEAR of the writing.
// ---- nesting in bowls (N1 to N4), on level lines ----
// N1. Every line but the first that ends in a bowl letter (NEST_BOWL), above the cradle's line (or above the last
//     line, where there is no cradle), has that bowl drawn out as a cradle round all the lines after it: the last
//     NEST_MAX such lines at most.
// N2. The bowls are concentric with the rim: the earliest in the text on the rim's own circle, each later one STEPIN
//     further in, the cradle itself innermost; the bottom line keeps clear of the innermost.
// N3. Each ends SUB_BACK further up the right side than the one inside it: the tips step back inwards.
// N4. Only if every bowl is CLEAR of all the writing and the circle grows no more than GROW_MAX; else none.
// Reading: unchanged, the lines from the top down; a bowl closes its line and holds what follows.
const NESTING = !process.env.WIDE_NONEST,
  RISE_LOWER = !process.env.WIDE_NORISE,
  NEST_BOWL = 'نيىلقسشصضجحخعغ',
  NEST_MAX = 2;
/** An arrangement on lines, as the cradle's level lines give it; the tiers (T1 to T6) add what stands off a line. */
type Leveled = CradleLaid & {
  /** Ink that belongs to no line's own piece: the words stacked over a line, each a piece of its own. */
  floats?: Poly[][];
  /** For each line: its words' shifts sideways (absent: the line is centred), the last word of the text it holds,
   *  and what it is called. */
  offs?: number[][];
  lastWord?: number[];
  said?: string[];
  /** The cradle's bowl, apart from its line. */
  bowlInk?: Poly[];
};
const offOf = (l: Leveled, li: number, as: Line = lineOf(l.lines[li])) => l.offs?.[li] ?? centred(as);

// ======== tiers: short colonnades one over another, short words stacked in the bays (T1 to T6) ========
// T1. STACKING. A short word (SHORT_MAX letters at most) that is not the first word of the text, does not carry the
//     cradle, and does not end its line in a bowl, is taken off its line and set above it: at the lowest place,
//     resting on the writing at LINE_SPACE, over no tall stem, between the right end of the word before it and the
//     left end of the word after it (nearest their meeting, of places as low). No two words running are stacked; a
//     word that finds no place stays on the line. Reading: a stacked word is read after the word under its right
//     and before the word under its left.
// T2. TIERS. The words up to the cradle word are split into lines in their order (the cradle word ends its line; the
//     words after it are one line or two in its bowl); each line is written with its short words stacked or not.
// T3. The lines rest on one another at LINE_SPACE of ink, measured column by column (not at one pitch): a stem
//     stands up into the gap of the line above.
// T4. Of all splits and stackings, the one whose circle is smallest: the writing is largest. A line (not the first,
//     and above the cradle's) that ends in a bowl letter makes the circle count BOWL_END smaller, for two such
//     lines at most: the next words can nest in that bowl (N1 to N4).
// T5. The circle holds every line's ink at the margin; the first line FLOOR + CLEAR further in (the canopy's room);
//     what stands in a bowl, FLOOR + CLEAR further in (and STEPIN more for each nested bowl).
// T6. STEMS OF THE LOWER LINES rise as the first line's do, each until it comes within CLEAR of the ink above it or
//     meets the margin, and no further than the baseline of the line above: the upper line's stems to the rim, the
//     lower's to the upper line's feet.
// T7. TWO GROUND LINES. Over a line that has COLONNADE tall stems or more, the gap is opened as far as the circle
//     found by T4 lets it (at most SPREAD times that line's shortest stem; all such gaps by one share): the lower
//     line stands lower, and its stems rise through the gap (T6).
const TIERS = !process.env.WIDE_NOTIERS,
  STACKING = !process.env.WIDE_NOSTACK,
  SHORT_MAX = 3, // a short word: this many letters at most
  TIER_MAX = 6, // lines at most
  BOWL_END = +(process.env.WIDE_BOWLEND ?? 0.04), // what a line that ends in a bowl is worth, as a share of the radius
  EMPTY = +(process.env.WIDE_EMPTY ?? 0.5), // what the circle left empty beside the lines costs: its mean share of their chords
  BODY_MID = 3, // (a line's chord is measured this far over its baseline)
  STACK_COST = +(process.env.WIDE_STACKCOST ?? 0.06), // what each stacked word costs, as a share of the radius
  COLONNADE = 2, // a line with this many tall stems is a colonnade:
  SPREAD = +(process.env.WIDE_SPREAD ?? 1), // the gap over it may be opened by this many times its shortest stem, for the stems to fill
  SLIDE_X = 3 * NIB, // the first line's first stem stands at least this far right of the axis
  DIRS = 28, // a tier's hull is kept as its extreme points in this many directions
  TIER_LIFTS = [0.4, 1.2, 2.2, 3.5, 5], // how far what stands in the bowl is lifted off its floor: the least that clears
  TRY_BEST = 6; // arrangements tried, the smallest first, until one stands
interface Up {
  wi: number;
  q: Placed;
}
interface Tier {
  key: string;
  a: number;
  b: number;
  text: string;
  l: Line;
  off: number[];
  /** The words stacked over the line, in the line's frame. */
  ups: Up[];
  prof: Profile;
  pts: Pt[];
  half: number;
  /** Whether its last word is on the line and ends in a bowl. */
  bowlEnd: boolean;
}
const tierCache = new Map<string, Tier>(),
  pitchCache = new Map<string, number>();
/** T1: words a to b as one line, its short words stacked (`stack`); `ci`: the cradle word. */
function tierOf(words: readonly string[], a: number, b: number, stack: boolean, ci: number): Tier {
  const taken = ci === b - 1,
    key = `${words.slice(a, b).join(' ')}|${a === 0 ? 1 : 0}${stack ? 1 : 0}${taken ? 1 : 0}`,
    had = tierCache.get(key);
  if (had) return { ...had, a, b, ups: had.ups.map(u => ({ ...u, wi: u.wi - had.a + a })) };
  const up = new Set<number>();
  if (stack && b - a > 1)
    for (let k = a; k < b; k++) {
      if (k === 0 || k === ci || up.has(k - 1) || forms(words[k]).length > SHORT_MAX) continue;
      if (k === b - 1 && NEST_BOWL.includes(finalOf(words[k]))) continue;
      up.add(k);
    }
  for (;;) {
    const base = Array.from({ length: b - a }, (_, i) => a + i).filter(k => !up.has(k)),
      text = base.map(k => words[k]).join(' '),
      l = lineOf(text, taken),
      off = centred(l),
      zero = l.stems.map(() => 0),
      // T8: the first line is slid to the right until the first stem of its first word stands SLIDE_X right of
      // the axis: a stem on the axis or left of it cannot carry an arc over the top
      lead = a === 0 ? l.stems.find(q => q.wi === 0) : undefined,
      slid = lead && !process.env.WIDE_NOSLIDE && lead.x + off[0] < SLIDE_X ? SLIDE_X - (lead.x + off[0]) : 0;
    if (slid) off.forEach((v, j) => (off[j] = v + slid));
    const own = inkAt({ l, off, dy: 0, extra: zero }),
      below: [Cols, number][] = [[colsOf(own), 0]],
      ext = (j: number) => {
        const xs = l.whole[j].map(q => q[0] + off[j]);
        return [Math.min(...xs), Math.max(...xs)];
      },
      ups: Up[] = [];
    let failed = -1;
    for (const k of [...up].sort((p, q) => p - q)) {
      const u = lineOf(words[k]),
        wide = (u.x1 - u.x0) / 2,
        pi = base.filter(j => j < k).length - 1,
        ni = pi + 1 < base.length ? pi + 1 : -1,
        lo = ni >= 0 ? ext(ni)[0] : ext(pi)[0],
        hi = pi >= 0 ? ext(pi)[1] : ext(ni)[1],
        join = pi >= 0 && ni >= 0 ? (ext(pi)[0] + ext(ni)[1]) / 2 : pi >= 0 ? ext(pi)[0] + wide : ext(ni)[1] - wide,
        under = profile(below);
      let best: { dx: number; y: number; d: number } | null = null;
      for (let x = lo + wide; x <= hi - wide + 1e-9; x += SCAN) {
        if (l.stems.some(q => Math.abs(q.x + off[q.wi] - x) < wide + STEM_HALF)) continue;
        const dx = x - (u.x0 + u.x1) / 2,
          y = need(profOf(u, [dx]), under),
          d = Math.abs(x - join);
        if (!best || y < best.y - 0.3 || (y < best.y + 0.3 && d < best.d)) best = { dx, y, d };
      }
      if (!best) {
        failed = k;
        break;
      }
      const q: Placed = { l: u, off: [best.dx], dy: best.y, extra: u.stems.map(() => 0) };
      ups.push({ wi: k, q });
      below.push([colsOf(inkAt(q)), 0]);
    }
    if (failed >= 0) {
      up.delete(failed);
      continue;
    }
    const ink = [own, ...ups.map(u => inkAt(u.q))].flat(),
      all = hull(ink.flat() as Pt[]),
      pts = new Set<Pt>();
    for (let d = 0; d < DIRS; d++) {
      const cx = Math.cos((2 * Math.PI * d) / DIRS),
        cy = Math.sin((2 * Math.PI * d) / DIRS);
      pts.add(all.reduce((m, q) => (q[0] * cx + q[1] * cy > m[0] * cx + m[1] * cy ? q : m)));
    }
    const t: Tier = {
      key,
      a,
      b,
      text,
      l,
      off,
      ups,
      prof: profile([[colsOf(ink), 0]]),
      pts: [...pts],
      half: Math.max(...all.map(q => Math.abs(q[0]))),
      bowlEnd: !up.has(b - 1) && NEST_BOWL.includes(finalOf(words[b - 1])),
    };
    tierCache.set(key, t);
    return t;
  }
}
/** T3: how far under a tier's line the next tier's line stands. */
function pitchOf(A: Tier, B: Tier): number {
  const key = `${A.key}>${B.key}`;
  let p = pitchCache.get(key);
  if (p == null) pitchCache.set(key, (p = need(A.prof, B.prof)));
  return p;
}
const tiersDone = new Map<string, Leveled | null>();
/** T2 to T5: the text in tiers, as the cradle's level lines are given (so that the arcs are drawn the same way). */
function tiersCompose(text: string, o: { cradle?: boolean; roof?: number; floor?: number }): Leveled | null {
  const key = JSON.stringify([text, o.cradle, o.roof, o.floor, BOWL]);
  if (!tiersDone.has(key)) tiersDone.set(key, tiersCompose1(text, o));
  return tiersDone.get(key)!;
}
function tiersCompose1(text: string, o: { cradle?: boolean; roof?: number; floor?: number }): Leveled | null {
  const words = text.split(' '),
    n = words.length,
    cr = o.cradle === false ? null : cradleOf(text),
    ci = cr ? cr.wi : -1,
    roof = o.roof ?? 0,
    floor = o.floor ?? 0,
    lowM = (cr ? FLOOR + CLEAR : 0) + floor;
  if (ci === 0) return null;
  interface Cand {
    cost: number;
    R: number;
    y0: number;
    tiers: Tier[];
    ys: number[];
  }
  const cands: Cand[] = [];
  let bar = Infinity;
  /** T5: what each line keeps from the circle beyond the margin, and the lines that end in a bowl (N1). */
  const roomsOf = (tiers: Tier[], lift = 0) => {
    const T = tiers.length,
      k = cr ? tiers.findIndex(t => t.b - 1 === ci) : T - 1,
      nests = tiers.map((t, i) => (i >= 1 && i < k && t.bowlEnd ? i : -1)).filter(i => i >= 0).slice(-NEST_MAX), // prettier-ignore
      lowFrom = Math.min(cr ? (k === T - 1 ? k : k + 1) : T, floor > 0 && nests.length ? nests[0] + 1 : T);
    return { nests: nests.length, m: tiers.map((_, i) => (i === 0 ? roof : 0) + (i >= lowFrom ? lowM + (cr ? lift : 0) : 0)) }; // prettier-ignore
  };
  /** T3, T7: where each line stands under the first, the gap over each colonnade opened by `s` of what it may be. */
  const ysOf = (tiers: Tier[], s = 0) => {
    const ys = [0];
    for (let i = 1; i < tiers.length; i++) {
      const tops = tiers[i].l.stems.map(q => q.top),
        gap = tops.length >= COLONNADE ? SPREAD * Math.min(...tops) : 0;
      ys.push(ys[i - 1] - pitchOf(tiers[i - 1], tiers[i]) - s * gap);
    }
    return ys;
  };
  /** The smallest circle (to the ink's margin) about the lines as they stand, and where its centre is. */
  const fitOf = (tiers: Tier[], ys: number[], m: number[]) => {
    const rad = (y0: number) => {
      let r = 0;
      for (let i = 0; i < tiers.length; i++)
        for (const q of tiers[i].pts) r = Math.max(r, Math.hypot(q[0], q[1] + ys[i] - y0) + m[i]);
      return r;
    };
    let lo = ys[ys.length - 1] - 12,
      hi = 12;
    for (let i = 0; i < 26; i++) {
      const m1 = lo + (hi - lo) / 3,
        m2 = hi - (hi - lo) / 3;
      if (rad(m1) < rad(m2)) hi = m2;
      else lo = m1;
    }
    return { y0: (lo + hi) / 2, r: rad((lo + hi) / 2) };
  };
  /** One split with one stacking: its circle. */
  const weigh = (tiers: Tier[]) => {
    const T = tiers.length,
      { nests, m } = roomsOf(tiers),
      gain = 1 - BOWL_END * nests;
    if (Math.max(...tiers.map(t => t.half)) * gain >= bar) return;
    const ys = ysOf(tiers),
      { y0, r } = fitOf(tiers, ys, m),
      R = r + MARGIN;
    // T4: a line much shorter than the circle is wide where it stands leaves the circle empty beside it
    let empty = 0;
    for (let i = 0; i < T; i++) {
      const y = ys[i] - y0 + BODY_MID,
        chord = Math.sqrt(Math.max(1, r * r - y * y));
      empty += Math.max(0, 1 - tiers[i].half / chord) / T;
    }
    // (a stacking must earn its place: the calm of plain lines is worth STACK_COST of the radius for each stacked word)
    const cost = R * gain * (1 + EMPTY * empty) * (1 + STACK_COST * tiers.reduce((t, q) => t + q.ups.length, 0));
    if (cost >= bar) return;
    cands.push({ cost, R, y0, tiers, ys });
    cands.sort((p, q) => p.cost - q.cost);
    if (cands.length > TRY_BEST) cands.pop();
    if (cands.length === TRY_BEST) bar = cands[TRY_BEST - 1].cost;
  };
  /** Every split from word a on, each line plain or stacked. */
  const split = (a: number, tiers: Tier[], inBowl: number) => {
    if (a === n) return weigh(tiers);
    if (tiers.length === TIER_MAX || inBowl === 2) return;
    const end = a <= ci ? (a === 0 ? ci : ci + 1) : n;
    for (let b = a + 1; b <= end; b++) {
      const plainT = tierOf(words, a, b, false, ci);
      split(b, [...tiers, plainT], a > ci && cr ? inBowl + 1 : 0);
      if (!STACKING) continue;
      const st = tierOf(words, a, b, true, ci);
      if (st.ups.length) split(b, [...tiers, st], a > ci && cr ? inBowl + 1 : 0);
    }
  };
  split(0, [], 0);
  for (const c of cands)
    for (const lift of cr ? TIER_LIFTS : [0]) {
      // (what stands in the bowl is lifted off its floor until the bowl is clear of it)
      const { m } = roomsOf(c.tiers, lift),
        f0 = fitOf(c.tiers, c.ys, m),
        R = f0.r + MARGIN;
      // T7: the gap over each colonnade is opened as far as the circle lets it
      let ys = c.ys,
        y0 = f0.y0;
      for (let lo = 0, hi = 1, i = 0; i < 12; i++) {
        const mid = i ? (lo + hi) / 2 : 1,
          ys2 = ysOf(c.tiers, mid),
          f = fitOf(c.tiers, ys2, m);
        if (f.r + MARGIN <= R + 1e-6) {
          lo = mid;
          ys = ys2;
          y0 = f.y0;
          if (mid === 1) break;
        } else hi = mid;
      }
      const Rt = R - MARGIN,
        T = c.tiers.length,
        hs = ys.map(y => y - y0),
        k = cr ? c.tiers.findIndex(t => t.b - 1 === ci) : -1,
        placed: Placed[] = c.tiers.map((t, i) => ({ l: t.l, off: t.off, dy: hs[i], extra: t.l.stems.map(() => 0) })),
        inks = placed.map(q => inkAt(q)),
        floats = c.tiers.flatMap((t, i) => t.ups.map(u => inkAt({ ...u.q, dy: u.q.dy + hs[i] })));
      if (Math.max(...[...inks, ...floats].flat(2).map(([x, y]) => Math.hypot(x, y))) > Rt + 0.02) {
        no('tiers: ink leaves the margin');
        continue;
      }
      let bowl: Bowl | null = null;
      if (cr) {
        bowl = bowlOf(placed[k], R, null);
        if (!bowl) {
          no('tiers: the bowl cannot be drawn');
          continue;
        }
        if (Math.max(...bowl.ink.flat().map(([x, y]) => Math.hypot(x, y))) > Rt + 0.02) {
          no('tiers: the bowl leaves the margin');
          continue;
        }
        if (
          nearPairs([...inks, ...floats, bowl.loose], R, CLEAR).some(pr => pr.includes(inks.length + floats.length))
        ) {
          // prettier-ignore
          no('tiers: the bowl is not clear of the writing');
          continue;
        }
      }
      if (bowl) inks[k] = inkAt(placed[k]);
      const pieces = inks.map((q, i) => cleanOutline(i === k && bowl ? [...q, ...bowl.ink] : q)),
        fl = floats.map(q => cleanOutline(q));
      return {
        R,
        lines: c.tiers.map(t => t.text),
        said: c.tiers.map(t => t.text + (t.ups.length ? ` [over it: ${t.ups.map(u => words[u.wi]).join(', ')}]` : '')),
        polys: [...pieces, ...fl].flat(),
        cradle: cr,
        span: 0,
        arc: bowl ? (bowl.phi0 - bowl.phiEnd) * DEG : 0,
        ends: bowl ? [bowl.phi0, bowl.phiEnd] : [0, 0],
        inside: cr ? T - 1 - k : 0,
        pieces,
        hs,
        floats: fl,
        offs: c.tiers.map(t => t.off),
        lastWord: c.tiers.map(t => t.b - 1),
        bowlInk: bowl?.ink,
      };
    }
  return null;
}

/** N1: the lines whose last letter's bowl is drawn out round the lines after them. */
function nestLines(l: Leveled): number[] {
  const end = l.cradle ? l.lines.length - 1 - l.inside : l.lines.length - 1,
    out: number[] = [];
  for (let li = 1; li < end; li++) if (NEST_BOWL.includes(finalOf(l.lines[li].split(' ').pop() ?? ''))) out.push(li);
  return out.slice(-NEST_MAX);
}
/** N2 to N4: the nested bowls of an arrangement on level lines, outermost first (null: they do not stand). */
function nestedBowls(l: Leveled): { li: number; q: Placed; b: Bowl; inset: number }[] | null {
  const idx = [...nestLines(l), ...(l.cradle ? [l.lines.length - 1 - l.inside] : [])],
    N = idx.length,
    made: { li: number; q: Placed; b: Bowl; inset: number }[] = [];
  let E: number | null = null;
  for (let j = N - 1; j >= 0; j--) {
    const li = idx[j],
      taken = lineOf(l.lines[li], true),
      q: Placed = { l: taken, off: offOf(l, li), dy: l.hs[li], extra: taken.stems.map(() => 0) },
      end = E,
      b = bowlOf(q, l.R, null, NECK, j * STEPIN, end == null ? undefined : () => Math.max(-SPAN_MAX, end - (N - 1 - j) * SUB_BACK)); // prettier-ignore
    if (!b) return null;
    E ??= b.phiEnd;
    made.unshift({ li, q, b, inset: j * STEPIN });
  }
  const top = lineOf(l.lines[0]),
    inks = l.lines.map((_, i) => {
      const m = made.find(v => v.li === i);
      return m ? inkAt(m.q) : i ? l.pieces[i] : inkAt({ l: top, off: offOf(l, 0), dy: l.hs[0], extra: top.stems.map(() => 0) }); // prettier-ignore
    });
  inks.push(...(l.floats ?? []));
  if (nearPairs([...inks, ...made.map(m => m.b.loose)], l.R, CLEAR).some(pr => pr[0] >= inks.length || pr[1] >= inks.length)) return null; // prettier-ignore
  if (Math.max(...made.flatMap(m => m.b.ink.flat()).map(([x, y]) => Math.hypot(x, y))) > l.R - MARGIN + 0.02)
    return null;
  return made;
}
export function levels(text: string, nest: Nest = {}, wide?: { cradle: boolean }): Canopied | null {
  const o = { cradle: wide ? wide.cradle : undefined, roof: FLOOR + CLEAR + 0.3 + (nest.canopy ? STEPIN : 0), floor: nest.cradle ? STEPIN : 0 }, // prettier-ignore
    compose = (floor: number): Leveled | null => wide ? wideBowls(() => (TIERS ? tiersCompose(text, { ...o, floor }) : null) ?? cradleCompose(text, { ...o, floor })) : cradleCompose(text, o); // prettier-ignore
  const l0 = compose(o.floor);
  if (!l0 || (!wide && (l0.lines.length < 2 || !l0.cradle))) return null;
  // (N4: the nested bowls, if they stand in a circle not much larger)
  const n0 = wide && NESTING ? nestLines(l0).length : 0,
    l2 = n0 ? compose(o.floor + n0 * STEPIN) : null,
    nest2 = l2 && l2.R <= l0.R * GROW_MAX && nestLines(l2).length === n0 ? nestedBowls(l2) : null,
    l = l2 && nest2 ? l2 : l0,
    nestB = nest2 ?? [];
  const words = text.split(' '),
    line = lineOf(l.lines[0]),
    R = l.R,
    rho = R - MARGIN - FLOOR / 2 - 0.05,
    p: Placed = { l: line, off: offOf(l, 0), dy: l.hs[0], extra: line.stems.map(() => 0) },
    k = line.stems.findIndex(m => m.wi === 0),
    word = l.lines[0].split(' ')[0],
    // (any text: an entry only into a letter that takes one, rule W1)
    entry = !!line.entry && (!wide || ENTRY_INTO.includes(word[0])),
    lead = k >= 0 && line.b.strokes[line.stems[k].si].own?.[0] === 0,
    // (any text: a roof drawn out, where the first letter is neither a stem nor takes an entry)
    roofed0 = !!wide && !lead && !entry && !!line.roofed && !process.env.WIDE_NOROOF,
    stem0 = !roofed0 && k >= 0 && (!entry || lead),
    floats = l.floats ?? [],
    rest = [...l.pieces.slice(1), ...floats],
    // (each lower line as it stands, and the bowl drawn with it: its stems rise at the end, T6)
    lower = new Map<number, { q: Placed; more: Poly[] }>(),
    arcs: Arc[] = [],
    nestIn = nestB.length && l.cradle ? nestB.length - 1 : 0, // how many circles in the cradle itself is
    line0 = { tip: TIP, subs: [] as { k: number; r: number; tip: number; run: number }[], note: '' },
    /** Without a canopy (any text): the level lines and what arcs there are; the top line's stems rise (W6). */
    bare = (roof: Roof | null, roofs: Poly[][]): Canopied => {
      if (wide) {
        const Rt = R - MARGIN,
          fixed = line.stems.map((_, j) => p.extra[j] > 0),
          f = line.stems.map((m, j) => {
            const e = fixed[j]
              ? p.extra[j]
              : Math.min(free(p, j, Rt), roofs.length || floats.length ? under(p, j, [...roofs, ...floats].flat()) : Infinity); // prettier-ignore
            return e < MIN_RISE * m.top ? 0 : e;
          });
        for (let share = 1; share > 0.2; share /= 2) {
          const e = stops(line.stems, f.map((v, j) => (fixed[j] ? v : v * share))); // prettier-ignore
          p.extra = e.map((v, j) => (fixed[j] ? f[j] : v));
          const ink = inkAt(p, true);
          if (Math.max(...ink.flat().map(([x, y]) => Math.hypot(x, y))) <= Rt + 1e-6 && !nearPairs([ink, ...roofs, ...rest], R, CLEAR).some(pr => pr.includes(0))) break; // prettier-ignore
          p.extra = f.map((v, j) => (fixed[j] ? v : 0));
        }
        // curved stems (C1 to C6), the lines held where they are
        const c = curve(p, R, rho, {
          canopy: stem && roof ? k : -1,
          tip: line0.tip,
          subs: line0.subs,
          roof: roof ? roof.loose : null,
          above: [],
          others: rest,
        });
        if (c?.roof && roof) roof.loose = c.roof.loose;
        if (c) line0.note = `; ${p.bends?.filter(v => v).length ?? 0} stems curved as meridians`;
        // T6: the stems of the lower lines rise to the feet of what is above them
        if (RISE_LOWER) {
          const ci2 = l.cradle ? l.lines.length - 1 - l.inside : -1;
          let risen = 0;
          for (let li = 1; li < l.lines.length; li++) {
            const had = lower.get(li),
              q: Placed = had?.q ?? { l: lineOf(l.lines[li], li === ci2), off: offOf(l, li), dy: l.hs[li], extra: [] },
              more = had?.more ?? (li === ci2 ? (l.bowlInk ?? null) : []),
              stems = q.l.stems;
            if (!more || !stems.length) continue;
            const others = [inkAt(p), ...rest.filter((_, i) => i !== li - 1), ...roofs],
              above = others.flat(),
              f = stems.map((m, j) => {
                if (m.si === q.l.take?.si) return 0;
                q.extra = stems.map(() => 0);
                // (no further than the feet of the line above: a stem that passed them would read with that line)
                const e = Math.min(free(q, j, Rt), under(q, j, above), l.hs[li - 1] - LINE_SPACE - (q.dy + m.base + m.top)); // prettier-ignore
                return e < MIN_RISE * m.top ? 0 : e;
              });
            for (let share = 1; share > 0.2; share /= 2) {
              q.extra = stops(stems, f.map(v => v * share)); // prettier-ignore
              if (!q.extra.some(v => v > 0)) break;
              const ink = inkAt(q);
              if (Math.max(...ink.flat().map(([x, y]) => Math.hypot(x, y))) <= Rt + 1e-6 && !nearPairs([ink, ...others, more], R, CLEAR).some(pr => pr.includes(0))) break; // prettier-ignore
              q.extra = stems.map(() => 0);
            }
            if (!q.extra.some(v => v > 0)) continue;
            rest[li - 1] = cleanOutline([...inkAt(q), ...more]);
            risen += q.extra.filter(v => v > 0).length;
          }
          if (risen) line0.note += `; ${risen} stems of the lower lines risen`;
        }
      }
      return {
        R,
        polys: [...cleanOutline(inkAt(p)), ...rest.flat()],
        lines: l.said ?? l.lines,
        cradle: l.cradle,
        arc: l.arc,
        stems: line.stems.length,
        factors: line.stems.map((m, j) => 1 + p.extra[j] / m.top).filter(v => v > 1.001),
        cost: 0,
        note: (l.offs ? 'tiers' : 'level lines') + (l.cradle ? ' with the cradle' : '') + line0.note,
        roof,
        arcs,
      };
    };
  // (a roof that cannot be drawn out past a stem of its own word gives way to that stem: it carries the canopy)
  let roofed = roofed0,
    stem = stem0;
  for (const m of nestB) {
    rest[m.li - 1] = cleanOutline([...inkAt(m.q), ...m.b.ink]);
    lower.set(m.li, { q: m.q, more: m.b.ink });
    const w = l.lines[m.li].split(' ').pop() ?? '';
    arcs.push({ name: 'cradle', what: `the final ${finalOf(w)} of ${w}${nestB.length > 1 ? `, nested on circle ${Math.round(m.inset / STEPIN) + 1} of ${nestB.length}` : ''}`, r: rho - m.inset, from: m.b.phi0 * DEG, to: m.b.phiEnd * DEG }); // prettier-ignore
  }
  if (!stem && !entry && !roofed) return wide && !nest.canopy ? bare(null, []) : null;
  // ---- the sub-cradle ----
  let bowl2: Bowl | null = null;
  if (nest.cradle) {
    const sub = l.cradle && subCradleOf(words, l.cradle.wi);
    if (!sub) return null;
    // the line it ends
    let seen = 0;
    const li = l.lastWord ? l.lastWord.indexOf(sub.wi) : l.lines.findIndex(t => (seen += t.split(' ').length) === sub.wi + 1); // prettier-ignore
    if (li < 1 || li < l.lines.length - l.inside || l.lines[li].split(' ').pop() !== words[sub.wi]) return null;
    const taken = lineOf(l.lines[li], true),
      q: Placed = { l: taken, off: offOf(l, li), dy: l.hs[li], extra: taken.stems.map(() => 0) },
      others = [inkAt(q), ...[l.pieces[0], ...rest].filter((_, i) => i !== li)];
    for (let share = SUB_SHARE; share > 0.2 && !bowl2; share -= 0.08) {
      const b = bowlOf(q, R, null, NECK, (nestIn + 1) * STEPIN, phi0 => Math.max(phi0 - share * (l.ends[0] - l.ends[1]), l.ends[1] + SUB_BACK)); // prettier-ignore
      if (b && !nearPairs([...others, b.loose], R, CLEAR).some(pr => pr.includes(others.length))) bowl2 = b;
    }
    if (!bowl2) return null;
    rest[li - 1] = cleanOutline([...inkAt(q), ...bowl2.ink]);
    lower.set(li, { q, more: bowl2.ink });
    arcs.push({ name: 'sub-cradle', what: `the final ${sub.c} of ${words[sub.wi]}`, r: rho - STEPIN, from: bowl2.phi0 * DEG, to: bowl2.phiEnd * DEG }); // prettier-ignore
  }
  // ---- a tail running forth from the last line (any text, W3), shortened until it is CLEAR of the writing ----
  if (
    wide &&
    !l.cradle &&
    !nestB.length &&
    l.lines.length > 1 &&
    TAILS.includes(finalOf(words[words.length - 1])) &&
    l.lines[l.lines.length - 1].split(' ').pop() === words[words.length - 1]
  ) {
    // prettier-ignore
    const li = l.lines.length - 1,
      taken = lineOf(l.lines[li], true),
      q: Placed = { l: taken, off: offOf(l, li), dy: l.hs[li], extra: taken.stems.map(() => 0) },
      others = [inkAt(q), ...l.pieces.filter((_, i) => i !== li), ...floats];
    for (let run = FORTH_RUN; run > 0.3; run -= 0.15) {
      const b = forthOf(q, R, run);
      if (!b) {
        no('forth: cannot be drawn');
        continue;
      }
      if (nearPairs([...others, b.loose], R, CLEAR).some(pr => pr.includes(others.length))) {
        no('forth: not clear');
        continue;
      }
      rest[li - 1] = cleanOutline([...inkAt(q), ...b.ink]);
      lower.set(li, { q, more: b.ink });
      arcs.push({ name: 'cradle', what: `the final ${finalOf(words[words.length - 1])} of ${words[words.length - 1]}, its tail running forth`, r: rho, from: b.phi0 * DEG, to: b.phiEnd * DEG }); // prettier-ignore
      break;
    }
  }
  if (l.cradle && !nestB.length) arcs.unshift({ name: 'cradle', what: `the final ${l.cradle.c} of ${words[l.cradle.wi]}`, r: rho, from: l.ends[0] * DEG, to: l.ends[1] * DEG }); // prettier-ignore
  for (const pass of roofed0 && k >= 0 && !process.env.WIDE_NOSLIDE ? [0, 1] : [0]) {
    if (pass) {
      roofed = false;
      stem = true;
      p.more = undefined;
    }
    for (let tip = roofed ? ROOF_TIP : TIP; tip > (roofed ? 0.5 : -0.6); tip -= 0.1) {
      let roof: Roof;
      if (roofed) {
        const rf = line.roofed!,
          q = line.b.strokes[rf.si].s[rf.cut],
          arc = roofArc(line, [q.x + p.off[0], q.y + p.dy], rho, tip);
        if (!arc) continue;
        p.more = arc.ink;
        roof = { loose: arc.loose, what: `the roof of the first letter of ${word} drawn out to the left`, from: arc.from, to: arc.to }; // prettier-ignore
      } else if (stem) {
        const c = stemCanopy(p, k, rho, tip);
        if (!c) {
          no('canopy: the stem cannot reach the rim');
          continue;
        }
        if (wide && c.at < CANOPY_FROM) {
          no(`canopy: the stem stands ${c.at.toFixed(0)} degrees right of the top`);
          break;
        }
        p.extra = line.stems.map((_, j) => (j === k ? c.extra : 0));
        p.swaps = [c.swap];
        roof = { loose: c.loose, what: `the first stem of ${word}, risen x${(1 + c.extra / line.stems[k].top).toFixed(2)} and turned into the rim`, from: c.from, to: c.to }; // prettier-ignore
      } else {
        const en = line.entry!,
          st = line.b.strokes[en.si],
          q = st.s[en.cut],
          arc = canopyArc([q.x + p.off[0], q.y + p.dy], en.back, q.w, st.ang, rho, tip);
        if (!arc) continue;
        p.swaps = [{ si: en.si, from: en.cut, s: arc.s.map(v => ({ ...v, x: v.x - p.off[0], y: v.y - p.dy })) }];
        p.dots = ridden(line, [q.x, q.y], en.back);
        if (p.dots.size && !inkAt(p).every(v => v.every(([x, y]) => Math.hypot(x, y) <= R - MARGIN))) continue;
        roof = { loose: th.strokePolys({ ang: st.ang, s: arc.s.slice(0, -STUB) }), what: `an entry into the first letter of ${word}`, from: arc.phi0 * DEG, to: arc.phiEnd * DEG }; // prettier-ignore
      }
      if (nearPairs([inkAt(p, true), ...rest, roof.loose], R, CLEAR).some(pr => pr.includes(rest.length + 1))) {
        no('canopy: not clear of the writing');
        p.more = undefined;
        continue;
      }
      arcs.unshift({ name: 'canopy', what: roof.what, r: rho, from: roof.from, to: roof.to });
      const roofs = [roof.loose];
      // ---- the sub-canopy ----
      if (nest.canopy) {
        const k2 = (stem ? k + 1 : 0) + (nest.skip ?? 0),
          m2 = line.stems[k2],
          one = p.swaps ?? [];
        let done = false;
        if (!m2) return null;
        each: for (const steps of SUB_STEPS) {
          const r2 = rho - steps * STEPIN,
            c0 = stemCanopy(p, k2, r2);
          if (!c0) continue;
          for (
            let tip2 = Math.min(tip - SUB_BACK, (SUB_SHARE * (roof.from - roof.to) - c0.from) / DEG);
            tip2 > -0.9;
            tip2 -= 0.1
          ) {
            const c = stemCanopy(p, k2, r2, tip2, SUB_RUN_MIN);
            if (!c || c.extra > (CAP - 1) * m2.top + 1e-6) continue;
            if (wide && c.to < -SUB_END) continue;
            p.extra[k2] = c.extra;
            p.swaps = [...one, c.swap];
            if (nearPairs([inkAt(p, true), ...rest, roof.loose, c.loose], R, CLEAR).some(pr => pr.includes(rest.length + 2))) continue; // prettier-ignore
            roofs.push(c.loose);
            line0.subs = [{ k: k2, r: r2, tip: tip2, run: SUB_RUN_MIN }];
            arcs.splice(1, 0, { name: 'sub-canopy', what: `the stem of the ${nth(line, k2)} of ${l.lines[0].split(' ')[m2.wi]}, risen x${(1 + c.extra / m2.top).toFixed(2)} and bowed over`, r: r2, from: c.from, to: c.to }); // prettier-ignore
            done = true;
            break each;
          }
        }
        if (!done) return null;
      }
      line0.tip = tip;
      return bare(roof, roofs);
    }
  }
  p.extra = line.stems.map(() => 0);
  p.swaps = undefined;
  p.dots = undefined;
  p.more = undefined;
  return wide && !nest.canopy ? bare(null, []) : null;
}

// ---- which arcs a text gets ----
export const short = (t: string) => t.split(' ').length <= 6;
/** The arrangement as it is now: the canopy and the cradle. */
export const plain = (t: string, mode = modeOf(t.split(' ')[0])) => (short(t) ? ground(t, mode) : levels(t));
/** With the nested arcs: both inner arcs if the circle grows no more than GROW_MAX; else the one that costs less;
 *  else none. `said`: what was dropped and why. */
export function nested(t: string, base: Canopied, said: string[], mode = modeOf(t.split(' ')[0])): Canopied {
  const make = (nest: Nest) => (short(t) ? ground(t, mode, nest) : levels(t, nest)),
    fits = (l: Canopied | null, what: string): l is Canopied => {
      if (!l) said.push(`${what}: cannot be had`);
      else if (l.R > base.R * GROW_MAX) said.push(`${what}: dropped, the circle would be ${((l.R / base.R - 1) * 100).toFixed(0)}% larger (radius ${(l.R / NIB).toFixed(1)} nibs)`); // prettier-ignore
      return !!l && l.R <= base.R * GROW_MAX;
    },
    both = make({ canopy: true, cradle: true });
  if (fits(both, 'sub-canopy and sub-cradle together')) return both;
  const one = [make({ canopy: true }), make({ cradle: true })],
    ok = one.filter((l, i) => fits(l, i ? 'sub-cradle alone' : 'sub-canopy alone'));
  return ok.sort((p, q) => p.R - q.R)[0] ?? base;
}

/** A sheet of discs with a caption under each. */
export function labelled(rows: ({ R: number; polys: Poly[] } | null)[][], caps: string[][][], cell = 480) {
  const H = cell + 70;
  let body = '';
  rows.forEach((row, j) =>
    row.forEach((l, i) => {
      if (l) {
        const { S, body: b } = discOf(l);
        body += `<g transform="translate(${i * cell} ${j * H}) scale(${(cell / S).toFixed(4)})">${b}</g>`;
      }
      (caps[j]?.[i] ?? []).forEach((c, k) => (body += `<text x="${i * cell + cell / 2}" y="${j * H + cell + 22 + 20 * k}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="${k ? 14 : 17}"${k ? '' : ' font-weight="bold"'} fill="#1d2440">${c}</text>`)); // prettier-ignore
    }),
  );
  const W = Math.max(...rows.map(r => r.length)) * cell;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${rows.length * H}" width="${W}" height="${rows.length * H}"><rect width="100%" height="100%" fill="#f3efe4"/>${body}</svg>`;
}

// ======== any text ========
// Rules 1 to 9 above were built on four texts. W1 to W8 state them so that every text gets an arrangement, and a
// plainer one where an arc has no letter to carry it: nothing is forced. No rule names a text or a word. They were
// widened on twelve unseen texts and judged on six more that were set aside first (tests/char-wide-sheet.test.ts).
// W1. THE CANOPY'S LETTER (modesWide), the first that applies to the first word:
//     c.  its first letter is a tall stem: that stem rises and turns into the rim (rule 5c);
//     a.  its first letter takes an entry (ENTRY_INTO: a tooth, a roof or a head, whose stroke starts down or to the
//         right, and whose dots are not above it: the arc arrives from above and would swallow the dot of a nun, a
//         ta, a tha or a shin) and the word has no stem, so it can hang from the rim: the arc is led into that letter
//         (rule 5a).
//         A word is never drawn out along the rim (rule 5b is not used: owner, 15 November);
//     c'. the word has a tall stem further in: its first stem (rule 5c');
//     none: no canopy. An entry is never led into a ra, zay, dal, dhal or waw (one stroke going down: an entry
//         would make a stem letter of it), nor into a loop (sad, ta, fa, qaf, heh).
//         NOT BUILT: a roof that starts up and to the right (this hand's hah and ayn) has its place at the top
//         left, drawn out to the left along the rim over its own word; the engine's test for an entry (the pen
//         starts down or to the right) passes it over, so such a word has no canopy yet.
//     A stem carries the canopy only if its top stands CANOPY_FROM right of the top of the circle at the least: the
//     arc must cross the top. Left of that the stem only rises.
// W2. THE CRADLE'S LETTER (cradleWide): the best final bowl by rule 1's scores (nun, ya, lam, qaf, sin, sad), with the
//     bowls that return of themselves (RETURNING: jim, hah, khah, ayn, ghayn); at most three words after it; on a
//     ground line, at most MAX_GROUND words. A tail (TAILS: ra, zay, waw, mim) never returns as a cradle.
// W3. A TAIL RUNS FORTH (forthOf): no bowl, and the last word ends in a tail: the tail comes down to the rim the way
//     it is going and follows it on up the left side for FORTH_RUN (shortened until it is CLEAR of the writing; never
//     nearer the level diameter than FORTH_TOP). Only where it is taken over within FORTH_DROP of the rim's circle (a
//     low ground line, the last of the level lines): a longer way down would make a stem of it. Nothing sits in it.
// W4. NO BOWL AND NO TAIL: no cradle. The words with stems are the ground line (MAX_BARE at most), their stems risen,
//     the others in the bays; an empty band under it costs VOID_BARE.
// W5. THE LADDER (arrange), for a text of up to six words: the ground line (rules 1 to 5) with the cradle and the
//     canopy; with the cradle alone; with the canopy alone; alone. The first that is SOUND is taken: no ground word
//     read out of order; a circle no more than SOUND times the circle the text needs on level lines; and, with no
//     cradle, no more than HOLLOW_MAX of the circle's height empty under the line. A single word is the same: its
//     bowl or tail if it has one, else its canopy; never both (it cannot hang from the rim and stand on the floor).
// W6. OTHERWISE, AND FOR LONGER TEXTS (levels): level lines in one circle, at smaller writing; the cradle if W2 gives
//     one among the last four words, else a tail running forth from the last line (W3); the canopy if W1 gives one
//     for the first word of the top line; the top line's other stems rise to the rim or to CLEAR under the canopy
//     (MIN_RISE at least, CAP at most, the name's together; halved until they are clear).
// W7. THE NESTED ARCS as rules 6 to 9, on whatever W5 or W6 gave, if the circle grows no more than GROW_MAX. An
//     inner arc above ends no further than SUB_END left of the top: a stem too far left for that is not bowed.
// W8. ON A SMALL CIRCLE an arc follows the rim for at least the least length a stroke that thins to a tip can have
//     (TIP_LEN), whatever its least angle.
// W9. SOUNDNESS OF THE INK: no ink of any arrangement leaves the margin (an arc's neck included); a cradle letter
//     whose dots sit on its head (HEAD_DOTS: qaf, dad, shin) keeps them there, and only dots that belong under or in
//     the bowl (nun, ya, jim) are set again along its floor. (On level lines the helper's cradle still sets every
//     dot in the bowl: tests/helpers/char-first.ts is not changed here.)
// (W1's dots, and W9, were added after the six texts set aside had been looked at: one of them showed each fault.)
const finalOf = (w: string) => forms(w).pop()?.c ?? '';
/** W1: the canopy's strokes for a first word, in the order they are tried; the last is none. */
export function modesWide(word: string): Mode[] {
  const l = lineOf(word),
    out: Mode[] = [];
  if (l.stems.some(m => l.b.strokes[m.si].own?.[0] === 0)) out.push('stem');
  else {
    // (a word with a stem cannot hang from the rim: its entry is led from where it stands on the ground line)
    if (l.entry && ENTRY_INTO.includes(word[0])) out.push('entry');
    if (l.roofed && !process.env.WIDE_NOROOF) out.push('roof');
    if (l.stems.length) out.push('stem');
  }
  return [...out, null];
}
/** W2, W3: the cradle's letter. */
export function cradleWide(text: string): Plan {
  const words = text.split(' '),
    stemmed = words.map(w => lineOf(w).stems.length > 0),
    long = (wi: number) => stemmed.slice(0, wi).filter(v => v).length + 1 > MAX_GROUND,
    cr = wideBowls(() => cradleOf(text, wi => short(text) && long(wi))),
    last = words.length - 1,
    c = finalOf(words[last]);
  if (cr) return { cr };
  if (TAILS.includes(c) && !long(last)) return { cr: { wi: last, c, score: 0.4, why: `the tail of the final ${c} of ${words[last]}, running forth` }, forth: true }; // prettier-ignore
  return { cr: null };
}
/** W5 to W7: the arrangement of any text. `said`: what was tried and dropped. */
export function arrange(t: string, said: string[]): Canopied | null {
  const modes = modesWide(t.split(' ')[0]),
    plan = cradleWide(t),
    name = (m: Mode) =>
      m === 'entry' ? 'an entry' : m === 'stem' ? 'a stem' : m === 'roof' ? 'a roof drawn out' : 'no canopy',
    flat = short(t) ? cradleCompose(t, { cradle: false }) : null;
  let base: Canopied | null = null,
    make: ((nest: Nest) => Canopied | null) | null = null,
    // (a single word: every rung that is sound is drawn; the one with the most arcs is taken, the earlier rung of
    // two that have as many, unless a rung with the other end's arc draws the word SINGLE_LARGER larger)
    pick = null as { base: Canopied; make: (nest: Nest) => Canopied | null; cradled: boolean } | null;
  const single = !t.includes(' '),
    rungs: { base: Canopied; make: (nest: Nest) => Canopied | null; cradled: boolean }[] = [];
  if (short(t))
    for (const p of plan.cr ? [plan, { cr: null }] : [plan]) {
      for (const mode of modes) {
        WHY.clear();
        base = ground(t, mode, {}, p, flat ? SOUND * flat.R : Infinity);
        if (
          base?.ground &&
          (base.ground[2] > 0 || (flat && base.R > SOUND * flat.R) || (!p.cr && base.ground[3] > HOLLOW_MAX))
        ) {
          said.push(`the ground line with ${p.cr ? (p.forth ? 'a tail running forth' : 'a cradle') : 'no cradle'} and ${name(mode)}: stands (radius ${(base.R / NIB).toFixed(1)} nibs; level lines ${flat ? (flat.R / NIB).toFixed(1) : '-'}) but is not sound: ${base.ground[2]} word(s) out of order, ${(base.ground[3] * 100).toFixed(0)}% of the height empty under it`); // prettier-ignore
          base = null;
          continue;
        }
        if (base) {
          const got = base;
          make = nest => ground(t, mode, nest, p, got.R * GROW_MAX);
          said.push(`taken: the ground line with ${p.cr ? (p.forth ? 'a tail running forth' : 'a cradle') : 'no cradle'} and ${name(mode)}: ${flat ? (base.R / flat.R).toFixed(2) : '-'} times the circle of level lines, ${((base.ground?.[3] ?? 0) * 100).toFixed(0)}% of the height empty under it`); // prettier-ignore
        } else said.push(`the ground line with ${p.cr ? (p.forth ? 'a tail running forth' : 'a cradle') : 'no cradle'} and ${name(mode)}: does not stand (${[...WHY].map(([k, v]) => `${k}:${v}`).join(' ') || 'not tried'})`); // prettier-ignore
        if (base && single) {
          rungs.push({ base, make: make!, cradled: !!p.cr });
          base = null;
        }
        if (base) break;
      }
      if (base) break;
    }
  // (an arc that needs a circle SINGLE_GROW larger than the word needs without it leaves the word small in an empty
  // circle: such a rung is passed over)
  const least = Math.min(...rungs.map(r => r.base.R));
  for (const r of rungs) {
    if (r.base.R > least * SINGLE_GROW) {
      said.push(
        `a rung with ${r.base.arcs.length} arc(s) passed over: its circle is ${(r.base.R / least).toFixed(2)} times the smallest`,
      );
      continue;
    }
    const more = pick ? r.base.arcs.length - pick.base.arcs.length : 1;
    if (more > 0 || (more === 0 && r.cradled !== pick!.cradled && r.base.R * SINGLE_LARGER < pick!.base.R)) pick = r;
  }
  // (a single word that carries no arc is not a ground line: it stands in the middle, by C)
  if (pick && !pick.base.arcs.length) pick = null;
  if (pick) ({ base, make } = pick);
  if (!base) {
    const wide = { cradle: !!wideBowls(() => cradleOf(t)) };
    WHY.clear();
    base = levels(t, {}, wide);
    make = nest => levels(t, nest, wide);
    if (WHY.size) said.push(`on level lines: ${[...WHY].map(([k, v]) => `${k} (${v})`).join('; ')}`);
  }
  if (!base || !make) return null;
  const fits = (l: Canopied | null, what: string): l is Canopied => {
      if (!l) said.push(`${what}: cannot be had`);
      else if (l.R > base.R * GROW_MAX) said.push(`${what}: dropped, the circle would be ${((l.R / base.R - 1) * 100).toFixed(0)}% larger`); // prettier-ignore
      return !!l && l.R <= base.R * GROW_MAX;
    },
    both = make({ canopy: true, cradle: true });
  if (fits(both, 'sub-canopy and sub-cradle together')) return both;
  const one = [make({ canopy: true }), make({ cradle: true })],
    ok = one.filter((l, i) => fits(l, i ? 'sub-cradle alone' : 'sub-canopy alone'));
  return ok.sort((p, q) => p.R - q.R)[0] ?? base;
}
/** The letters the rules name for a text, without drawing it: the canopy's (the first tried), the cradle's and the
 *  sub-cradle's. */
export function carriers(t: string): string {
  const words = t.split(' '),
    mode = modesWide(words[0])[0],
    plan = cradleWide(t),
    sub = plan.cr && !plan.forth ? subCradleOf(words, plan.cr.wi) : null;
  return [
    `canopy: ${mode === 'entry' ? `an entry into the ${words[0][0]} of ${words[0]}` : mode === 'stem' ? `a stem of ${words[0]}` : mode === 'roof' ? `the roof of the ${words[0][0]} of ${words[0]}` : 'none'}`,
    `cradle: ${plan.cr ? `the ${plan.cr.c} of ${words[plan.cr.wi]}${plan.forth ? ', running forth' : ''}` : 'none'}`,
    `sub-cradle: ${sub ? `the ${sub.c} of ${words[sub.wi]}` : 'none'}`,
  ].join('; ');
}
