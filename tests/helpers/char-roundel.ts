// The letters-first roundel composer, for any text (owner's experiments, 15 November 2026): level, upright text;
// stem-bearing words on one low ground line with their stems redrawn to rise; the other words in the bays; the
// canopy, the cradle, and the nested arcs on circles concentric with the rim. Moved here whole from
// tests/char-nested-sheet.test.ts so that it can be run on the wider set of texts (tests/char-wide-sheet.test.ts);
// the rules are numbered in the comments below, and every number is at the top.
import type { Built } from '../../src/script/thuluth/engine';
import { cleanOutline } from '../../src/script/thuluth/outline';
import type { Poly, Sample } from '../../src/script/thuluth/types';
import { forms } from '../../src/script/thuluth';
import './char-pure';
import type { Cols, Cradle, Head, Pt, Stem } from './char-first';
import { BOWL, CAP, CLEAR, FLOOR, LINE_SPACE, MARGIN, NIB, SPAN_MAX, STEP, TIP_LEN, bowlPen, colsOf, cradleCompose, cradleOf, discOf, findStems, hull, nearPairs, need, profile, raise, room, sweep, takeOver, th } from './char-first'; // prettier-ignore

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
/** Which stroke is drawn out: an entry into the first letter (a), a join of the first word (b), a stem (c). */
export type Mode = 'entry' | 'kashida' | 'stem' | null;

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
export function canopyArc(C: Pt, back: Pt, wC: number, ang: number, rho: number, tip = TIP, runMin = RUN_MIN) {
  // (the helper's sweep runs along the bottom to the left: this is that, upside down)
  const sw = sweep([C[0], -C[1]], [back[0], -back[1]], wC, rho, phi0 => -Math.max(tip, runMin - phi0), NECK);
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
}
/** The ink of a line, word by word, with its stems drawn `extra` taller; `body`: without the heads of its stems. And
 *  the samples of the cradle stroke up to where the bowl is taken over. */
function inked(
  l: Omit<Line, 'x0' | 'x1' | 'whole' | 'body' | 'cols' | 'heads' | 'entry'>,
  extra: readonly number[],
  body = false,
  swaps: readonly Swap[] = [],
  stub = false,
) {
  const raised = raise(l.b, l.stems, extra),
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
  l.b.dots.slice(0, l.b.dots.length - (l.take?.head.dots ?? 0)).forEach(([x, y], k) => words[l.dotWord[k] ?? 0].push(...th.dotPolysAt(x, y))); // prettier-ignore
  return { words, pre };
}
const lineCache = new Map<string, Line>();
function lineOf(text: string, cradle = false): Line {
  const key = (cradle ? '*' : '') + text,
    had = lineCache.get(key);
  if (had) return had;
  const b = th.buildStrokes(text, {}),
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
    };
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
}
const inkAt = (p: Placed, stub = false): Poly[] =>
  inked(p.l, p.extra, false, p.swaps, stub).words.flatMap((w, k) =>
    w.map(q => q.map(([x, y]) => [x + p.off[k], y + p.dy] as Pt)),
  );
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
    if (c > 0) continue;
    const e = (-b + Math.sqrt(b * b - a * c)) / a,
      arc = canopyArc([x + m.lean * e, y + e], [m.lean / n, 1 / n], q.w, st.ang, rho, tip, runMin);
    if (!arc) continue;
    return {
      extra: e,
      swap: { si: m.si, from: m.cut, s: arc.s.map(v => ({ ...v, x: v.x - dx, y: v.y - p.dy })) } as Swap,
      loose: th.strokePolys({ ang: st.ang, s: arc.s.slice(0, -STUB) }),
      from: arc.phi0 * DEG,
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
    loose: th.strokePolys({ ang: st.ang, s: arc.s.slice(0, -STUB) }),
    from: arc.phi0 * DEG,
    to: arc.phiEnd * DEG,
  };
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

/** How far to the right the last word of a placed line reaches. */
const rightOf = (p: Placed) => Math.max(...p.l.whole[p.l.nw - 1].map(q => q[0])) + p.off[p.l.nw - 1];

// ---- the bowl, with its neck mended ----
interface Bowl {
  /** The whole stroke, from its letter's head, with the letter's dots; and the part that is checked as a piece of
   *  its own (from two nibs past where it leaves its letter). */
  ink: Poly[];
  loose: Poly[];
  phi0: number;
  phiEnd: number;
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
    pre = inked(p.l, p.extra).pre,
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
    // the letter's dots: in the bowl where it begins, along the floor
    rd = rho - FLOOR / 2 - 1.25 * NIB,
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
export function ground(text: string, mode: Mode = null, nest: Nest = {}): Canopied | null {
  const words = text.split(' '),
    n = words.length,
    stemmed = words.map(w => lineOf(w).stems.length > 0),
    cr = groundCradle(text);
  if (!cr) return null;
  const ci = cr.wi,
    onGround = words.map((_, k) => k === ci || (k < ci && stemmed[k])),
    gi = words.map((_, k) => k).filter(k => onGround[k]),
    ui = words.map((_, k) => k).filter(k => k < ci && !onGround[k]),
    g = lineOf(gi.map(k => words[k]).join(' '), true),
    uppers = ui.map(k => lineOf(words[k])),
    // the opening word stands apart when it hangs from the canopy or is the canopy
    apart = (mode === 'entry' || mode === 'kashida') && ui[0] === 0,
    sub = nest.cradle ? subCradleOf(words, ci) : null,
    // the words after the cradle word, in its bowl: on one line, or on two
    afters: Line[][] = [];
  if (nest.cradle && !sub) return null;
  if ((mode === 'entry' || mode === 'kashida') && !apart) return null;
  if (mode === 'entry' && !uppers[0].entry) return null;
  // (with a sub-cradle: up to its word on one line, whose last letter it is; the words after it on a line inside it)
  if (sub)
    afters.push([lineOf(words.slice(ci + 1, sub.wi + 1).join(' '), true), ...(sub.wi < n - 1 ? [lineOf(words.slice(sub.wi + 1).join(' '))] : [])]); // prettier-ignore
  else if (ci === n - 1) afters.push([]);
  for (let k = ci + 2; !sub && k <= n; k++) afters.push([[ci + 1, k], [k, n]].filter(([a, b]) => b > a).map(([a, b]) => lineOf(words.slice(a, b).join(' ')))); // prettier-ignore
  afters.reverse();
  /** One setting in a circle of radius R. */
  const at = (R: number, slide: number, gaps: number[], lift: number, aft: Line[]): Canopied | null => {
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
    } else hg = lowest(g, off, Rt - FLOOR - CLEAR) + lift;
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
    if (mode === 'entry') {
      const u = uppers[0];
      // as high as the rim runs the way the stroke starts, or lower if it must: never over a stem, so to the right
      // of them all
      for (let hang = hangOf(u.entry!.back); hang >= HANG_MIN - 1e-9 && !hung; hang -= HANG_STEP)
        for (const drop of DROPS) {
          const c = entryCanopy(u, rho, hang, drop);
          if (!c || !within(u.whole[0], c.dx, c.dy, Rt)) continue;
          if (Math.min(...u.whole[0].map(q => q[0])) + c.dx < rightmost + STEM_HALF) break;
          const q: Placed = { l: u, off: [c.dx], dy: c.dy, extra: [], swaps: [c.swap] };
          if (nearPairs([inkAt(q, true), c.loose], R, CLEAR).length) continue;
          hung = q;
          roof = { loose: c.loose, what: `an entry into the first letter of ${words[0]}, taken over ${drop} inside the rim's circle, the word hung ${(hang * DEG).toFixed(0)} degrees above the level diameter`, from: c.from, to: c.to }; // prettier-ignore
          break;
        }
      if (!hung) return no('6');
    } else if (mode === 'stem') {
      const c = stemCanopy(pg, 0, rho);
      if (!c || c.extra > (CAP - 1) * g.stems[0].top + 1e-6) return no('7');
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
      bowed: [number, number][] = [];
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
          if (nearPairs([...others, c.loose], R, CLEAR).some(pr => pr.includes(others.length))) continue;
          pg.swaps = [...(pg.swaps ?? []), c.swap];
          bowed.push([k2, c.extra]);
          made = { loose: c.loose, what: `the stem of ${nth(g, k2)} of ${g.text.split(' ')[m2.wi]}, risen x${(1 + c.extra / m2.top).toFixed(2)} and bowed over`, from: c.from, to: c.to, r: r2 }; // prettier-ignore
          break;
        }
        if (!made) return no('14');
        subs.push(made);
        others.push(made.loose);
        outer = made;
      }
    }
    const roofs = roof ? [...roof.loose, ...subs.flatMap(q => q.loose)] : [];
    if (roof) g.stems.forEach((_, s) => (f[s] = Math.min(f[s], under(pg, s, roofs))));
    for (const [k2, e] of bowed) f[k2] = e;
    pg.extra = stops(g.stems, f);
    if (forced >= 0) f[0] = pg.extra[0] = forced;
    for (const [k2, e] of bowed) pg.extra[k2] = e;
    const reached = g.stems.filter((_, s) => pg.extra[s] > 0 && pg.extra[s] >= f[s] - 0.01).length,
      bowl = bowlOf(pg, R, pas.length ? null : rightOf(pg));
    if (!bowl) return no('9');
    // ---- the sub-cradle: the bowl or tail of a letter in the bowl, returning along the next circle in ----
    let bowl2: Bowl | null = null;
    if (sub) {
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
    const bowls = bowl2 ? [bowl.loose, bowl2.loose] : [bowl.loose];
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
        (1 + VOID * hollow) *
        (1 + 0.004 * moved),
      // as drawn: the canopy with its stroke
      drawn = [inkAt(pg), ...pas.map(p => inkAt(p)), ...(hung ? [inkAt(hung)] : []), ...(lid ? [lid] : []), ...ups.map(p => inkAt(p)), bowl.ink, ...(bowl2 ? [bowl2.ink] : [])], // prettier-ignore
      arcs: Arc[] = [];
    if (roof) arcs.push({ name: 'canopy', what: roof.what, r: rho, from: roof.from, to: roof.to });
    for (const q of subs) arcs.push({ name: 'sub-canopy', what: q.what, r: q.r!, from: q.from, to: q.to });
    arcs.push({ name: 'cradle', what: `the final ${cr.c} of ${words[ci]}`, r: rho, from: bowl.phi0 * DEG, to: bowl.phiEnd * DEG }); // prettier-ignore
    if (bowl2) arcs.push({ name: 'sub-cradle', what: `the final ${sub!.c} of ${words[sub!.wi]}`, r: rho - STEPIN, from: bowl2.phi0 * DEG, to: bowl2.phiEnd * DEG }); // prettier-ignore
    return {
      R,
      polys: drawn.flatMap(k => cleanOutline(k)),
      lines: [...ui.map(k => `(${words[k]})`), g.text, ...aft.map(l => l.text)],
      cradle: cr,
      arc: ((bowl.phi0 - bowl.phiEnd) * 180) / Math.PI,
      stems: total,
      factors,
      cost,
      roof,
      arcs,
      note: `${reached} of ${g.stems.length} ground stems reach the rim${roof ? ' or the canopy' : ''}; ${breaches} ground word${breaches === 1 ? '' : 's'} read out of order; spaces opened ${(tot / NIB).toFixed(1)} nibs, line slid ${(slide / NIB).toFixed(1)} nibs`,
    };
  };
  // every opening of the word spaces
  const opens: number[][] = [[0]];
  for (let k = 1; k < g.nw; k++) opens.splice(0, opens.length, ...opens.flatMap(q => OPEN.map(v => [...q, v])));
  let best: Canopied | null = null;
  for (let R = 10; R < 150 && !(best && R > best.R * LARGER); R *= 1.02)
    for (const slide of mode === 'entry' ? [...SLIDES.filter(v => v <= 0), ...MORE_SLIDES] : SLIDES)
      for (const gaps of opens)
        for (const aft of afters)
          for (const lift of [0, 2, 5]) {
            const l = at(R, slide, gaps, lift, aft);
            if (!l) continue;
            if (SAY)
              SAY.push(
                `${l.cost.toFixed(1)} R${R.toFixed(1)} slide ${slide} gaps ${gaps.join(',')} lift ${lift}: ${l.note}`,
              );
            if (!best || l.cost < best.cost) best = l;
            break;
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
export function levels(text: string, nest: Nest = {}): Canopied | null {
  const l = cradleCompose(text, { roof: FLOOR + CLEAR + 0.3 + (nest.canopy ? STEPIN : 0), floor: nest.cradle ? STEPIN : 0 }); // prettier-ignore
  if (!l || l.lines.length < 2 || !l.cradle) return null;
  const words = text.split(' '),
    line = lineOf(l.lines[0]),
    R = l.R,
    rho = R - MARGIN - FLOOR / 2 - 0.05,
    p: Placed = { l: line, off: centred(line), dy: l.hs[0], extra: line.stems.map(() => 0) },
    k = line.stems.findIndex(m => m.wi === 0),
    word = l.lines[0].split(' ')[0],
    stem = k >= 0 && (!line.entry || line.b.strokes[line.stems[k].si].own?.[0] === 0),
    rest = l.pieces.slice(1),
    arcs: Arc[] = [];
  if (!stem && !line.entry) return null;
  // ---- the sub-cradle ----
  let bowl2: Bowl | null = null;
  if (nest.cradle) {
    const sub = subCradleOf(words, l.cradle.wi);
    if (!sub) return null;
    // the line it ends
    let seen = 0;
    const li = l.lines.findIndex(t => (seen += t.split(' ').length) === sub.wi + 1);
    if (li < 1 || li < l.lines.length - l.inside) return null;
    const whole = lineOf(l.lines[li]),
      taken = lineOf(l.lines[li], true),
      q: Placed = { l: taken, off: centred(whole), dy: l.hs[li], extra: taken.stems.map(() => 0) },
      others = [inkAt(q), ...l.pieces.filter((_, i) => i !== li)];
    for (let share = SUB_SHARE; share > 0.2 && !bowl2; share -= 0.08) {
      const b = bowlOf(q, R, null, NECK, STEPIN, phi0 => Math.max(phi0 - share * (l.ends[0] - l.ends[1]), l.ends[1] + SUB_BACK)); // prettier-ignore
      if (b && !nearPairs([...others, b.loose], R, CLEAR).some(pr => pr.includes(others.length))) bowl2 = b;
    }
    if (!bowl2) return null;
    rest[li - 1] = cleanOutline([...inkAt(q), ...bowl2.ink]);
    arcs.push({ name: 'sub-cradle', what: `the final ${sub.c} of ${words[sub.wi]}`, r: rho - STEPIN, from: bowl2.phi0 * DEG, to: bowl2.phiEnd * DEG }); // prettier-ignore
  }
  arcs.unshift({ name: 'cradle', what: `the final ${l.cradle.c} of ${words[l.cradle.wi]}`, r: rho, from: l.ends[0] * DEG, to: l.ends[1] * DEG }); // prettier-ignore
  for (let tip = TIP; tip > -0.6; tip -= 0.1) {
    let roof: Roof;
    if (stem) {
      const c = stemCanopy(p, k, rho, tip);
      if (!c) continue;
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
      roof = { loose: th.strokePolys({ ang: st.ang, s: arc.s.slice(0, -STUB) }), what: `an entry into the first letter of ${word}`, from: arc.phi0 * DEG, to: arc.phiEnd * DEG }; // prettier-ignore
    }
    if (nearPairs([inkAt(p, true), ...rest, roof.loose], R, CLEAR).some(pr => pr.includes(rest.length + 1))) continue;
    arcs.unshift({ name: 'canopy', what: roof.what, r: rho, from: roof.from, to: roof.to });
    // ---- the sub-canopy ----
    if (nest.canopy) {
      const k2 = (stem ? k + 1 : 0) + (nest.skip ?? 0),
        m2 = line.stems[k2],
        one = p.swaps;
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
          p.extra[k2] = c.extra;
          p.swaps = [...one, c.swap];
          if (nearPairs([inkAt(p, true), ...rest, roof.loose, c.loose], R, CLEAR).some(pr => pr.includes(rest.length + 2))) continue; // prettier-ignore
          arcs.splice(1, 0, { name: 'sub-canopy', what: `the stem of the ${nth(line, k2)} of ${l.lines[0].split(' ')[m2.wi]}, risen x${(1 + c.extra / m2.top).toFixed(2)} and bowed over`, r: r2, from: c.from, to: c.to }); // prettier-ignore
          done = true;
          break each;
        }
      }
      if (!done) return null;
    }
    return {
      R,
      polys: [...cleanOutline(inkAt(p)), ...rest.flat()],
      lines: l.lines,
      cradle: l.cradle,
      arc: l.arc,
      stems: line.stems.length,
      factors: line.stems.map((m, j) => 1 + p.extra[j] / m.top).filter(v => v > 1.001),
      cost: 0,
      note: 'the cradle on level lines',
      roof,
      arcs,
    };
  }
  return null;
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
/** STUB (replaced by the widened rules). */
export function arrange(t: string, said: string[]): Canopied | null {
  const base = plain(t);
  return base && nested(t, base, said);
}
export function carriers(t: string): string {
  return modeOf(t.split(' ')[0]) ?? 'none';
}
