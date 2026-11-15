// The canopy (owner's experiment, 15 November 2026). In the one ground line (tests/char-crown-cradle-sheet.test.ts)
// the cradle is strongest in the lower left of the circle and the upper right is empty. Here the text's opening
// stroke answers it: one stroke of the first word is drawn out into a great arc along the upper rim, on the cradle's
// own circle, so that the opening arc and the cradle between them draw most of the circle; and, further, the writing
// itself follows circles concentric with the rim.
//   ground   the one ground line as it was (the same rules, written again here: that file is not changed)
//   canopy   the ground line with the canopy: the opening word at the upper right, the stems giving way under it
//   rings    concentric circles: the canopy and the cradle on the outermost, a line of words bent along the next,
//            a level core inside
// The rules and every number are in the comments below, in the order they are applied.
// `CANOPY=1 CANOPY_OUT=<dir> npx vitest run tests/char-canopy-sheet.test.ts --maxWorkers=2` writes the sheets.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPNG } from '../scripts/raster.mjs';
import type { Built } from '../src/script/thuluth/engine';
import { cleanOutline } from '../src/script/thuluth/outline';
import type { Poly, Sample } from '../src/script/thuluth/types';
import type { Cols, Cradle, Head, Pt, Stem } from './helpers/char-first';
import { CAP, CLEAR, FLOOR, LINE_SPACE, MARGIN, NIB, SPAN_MAX, STEP, TEXTS, TIP_LEN, bowlPen, colsOf, cradleCompose, cradleOf, findStems, hull, nearPairs, need, profile, raise, room, sheetOf, svgOf, sweep, takeOver, th } from './helpers/char-first'; // prettier-ignore

// ---- the numbers of the one ground line, as tests/char-crown-cradle-sheet.test.ts has them (pen units) ----
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
const TIP = (25 * Math.PI) / 180, // the canopy ends this far past the top of the circle, to the left,
  RUN_MIN = (40 * Math.PI) / 180, // and follows the rim for at least this much
  SLACK = 0.3, // what the raster needs over CLEAR to call two inks clear
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
type Mode = 'entry' | 'kashida' | 'stem' | null;

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
function canopyArc(C: Pt, back: Pt, wC: number, ang: number, rho: number, tip = TIP) {
  // (the helper's sweep runs along the bottom to the left: this is that, upside down)
  const sw = sweep([C[0], -C[1]], [back[0], -back[1]], wC, rho, phi0 => -Math.max(tip, RUN_MIN - phi0), NECK);
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
  swap?: Swap,
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
    if (swap && si === swap.si && !body)
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
    part = { text, b, nw, stems, take: cradle ? takeOver(b, CUT) : undefined, strokeWord, dotWord },
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
  swap?: Swap;
}
const inkAt = (p: Placed, stub = false): Poly[] =>
  inked(p.l, p.extra, false, p.swap, stub).words.flatMap((w, k) =>
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
function stemCanopy(p: Placed, k: number, rho: number, tip = TIP) {
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
      arc = canopyArc([x + m.lean * e, y + e], [m.lean / n, 1 / n], q.w, st.ang, rho, tip);
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
const median = (v: number[]) => v.slice().sort((p, q) => p - q)[Math.floor((v.length - 1) / 2)];
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
function bowlOf(p: Placed, R: number, hold: number | null, neck = NECK): Bowl | null {
  const { head } = p.l.take!,
    dx = p.off[p.l.nw - 1],
    rho = R - MARGIN - FLOOR / 2 - 0.05,
    pre = inked(p.l, p.extra).pre,
    bowl = sweep(
      [-(head.C[0] + dx), head.C[1] + p.dy],
      [-head.u[0], head.u[1]],
      head.pre[head.pre.length - 1].w,
      rho,
      phi0 => hold != null ? Math.min(-Math.asin(Math.min(0.95, Math.max(0, hold + 2 * NIB) / rho)), phi0 - (TIP_LEN * 1.7) / rho) : -Math.min(SPAN_MAX, Math.max(phi0, 0.5)), // prettier-ignore
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

interface Laid {
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
type Canopied = Laid & { roof: Roof | null };
/** What the sheet draws and reports. */
type Drawn = { R: number; polys: Poly[]; lines: string[]; cradle: Cradle | null } & Partial<Canopied> & {
    rings?: string;
  };
function ground(text: string, mode: Mode = null): Canopied | null {
  const words = text.split(' '),
    n = words.length,
    stemmed = words.map(w => lineOf(w).stems.length > 0),
    cr = cradleOf(text, wi => stemmed.slice(0, wi).filter(v => v).length + 1 > MAX_GROUND);
  if (!cr) return null;
  const ci = cr.wi,
    onGround = words.map((_, k) => k === ci || (k < ci && stemmed[k])),
    gi = words.map((_, k) => k).filter(k => onGround[k]),
    ui = words.map((_, k) => k).filter(k => k < ci && !onGround[k]),
    g = lineOf(gi.map(k => words[k]).join(' '), true),
    uppers = ui.map(k => lineOf(words[k])),
    // the opening word stands apart when it hangs from the canopy or is the canopy
    apart = (mode === 'entry' || mode === 'kashida') && ui[0] === 0,
    // the words after the cradle word, in its bowl: on one line, or on two
    afters: Line[][] = [];
  if ((mode === 'entry' || mode === 'kashida') && !apart) return null;
  if (mode === 'entry' && !uppers[0].entry) return null;
  if (ci === n - 1) afters.push([]);
  for (let k = ci + 2; k <= n; k++) afters.push([[ci + 1, k], [k, n]].filter(([a, b]) => b > a).map(([a, b]) => lineOf(words.slice(a, b).join(' ')))); // prettier-ignore
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
      pas[m].dy = lowest(pas[m].l, pas[m].off, Rt - FLOOR - CLEAR) + lift;
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
          const q: Placed = { l: u, off: [c.dx], dy: c.dy, extra: [], swap: c.swap };
          if (nearPairs([inkAt(q, true), c.loose], R, CLEAR).length) continue;
          hung = q;
          roof = { loose: c.loose, what: `an entry into the first letter of ${words[0]}, taken over ${drop} inside the rim's circle, the word hung ${(hang * DEG).toFixed(0)} degrees above the level diameter`, from: c.from, to: c.to }; // prettier-ignore
          break;
        }
      if (!hung) return no('6');
    } else if (mode === 'stem') {
      const c = stemCanopy(pg, 0, rho);
      if (!c || c.extra > (CAP - 1) * g.stems[0].top + 1e-6) return no('7');
      pg.swap = c.swap;
      forced = c.extra;
      roof = { loose: c.loose, what: `the first stem of ${g.text.split(' ')[g.stems[0].wi]}, risen x${(1 + c.extra / g.stems[0].top).toFixed(2)} and turned into the rim`, from: c.from, to: c.to }; // prettier-ignore
    } else if (mode === 'kashida') {
      const c = drawnOut(words[0], Rt, rho);
      if (!c) return no('8');
      lid = c.ink;
      roof = { loose: c.ink, what: `the last join of ${words[0]} drawn out by ${(c.len / NIB).toFixed(1)} nibs, the word bent along the rim`, from: c.from, to: c.to }; // prettier-ignore
    }
    if (roof) g.stems.forEach((_, s) => (f[s] = Math.min(f[s], under(pg, s, roof!.loose))));
    pg.extra = stops(g.stems, f);
    if (forced >= 0) f[0] = pg.extra[0] = forced;
    const reached = g.stems.filter((_, s) => pg.extra[s] > 0 && pg.extra[s] >= f[s] - 0.01).length,
      bowl = bowlOf(pg, R, pas.length ? null : rightOf(pg));
    if (!bowl) return no('9');
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
          if (nearPairs([bowl.loose, ink], R, CLEAR).length) continue;
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
    const pieces = [...fixed, ...ups.map(p => inkAt(p)), bowl.loose];
    if (nearPairs(pieces, R, CLEAR).length) return no('11');
    const factors = g.stems.map((q, s) => 1 + pg.extra[s] / q.top).filter(v => v > 1.001),
      total = g.stems.length + aft.reduce((t, l) => t + l.stems.length, 0),
      // the empty band between the lowest ink and the bowl's floor, as a share of the circle's height
      hollow = (Math.min(...[inkAt(pg, true), ...pas.map(p => inkAt(p))].flat(2).map(q => q[1])) + Rt - FLOOR) / (2 * Rt),
      moved = (tot + Math.abs(slide)) / NIB,
      cost =
        R *
        (1 + UNRISEN * (total ? 1 - reached / total : 0)) *
        (1 + BREACH * breaches) *
        (1 + VOID * hollow) *
        (1 + 0.004 * moved),
      // as drawn: the canopy with its stroke
      drawn = [inkAt(pg), ...pas.map(p => inkAt(p)), ...(hung ? [inkAt(hung)] : []), ...(lid ? [lid] : []), ...ups.map(p => inkAt(p)), bowl.ink]; // prettier-ignore
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
      note: `${reached} of ${g.stems.length} ground stems reach the rim${roof ? ' or the canopy' : ''}; ${breaches} ground word${breaches === 1 ? '' : 's'} read out of order; spaces opened ${(tot / NIB).toFixed(1)} nibs, line slid ${(slide / NIB).toFixed(1)} nibs`,
    };
  };
  // every opening of the word spaces
  const opens: number[][] = [[0]];
  for (let k = 1; k < g.nw; k++) opens.splice(0, opens.length, ...opens.flatMap(q => OPEN.map(v => [...q, v])));
  let best: Canopied | null = null;
  for (let R = 10; R < +(process.env.CANOPY_RMAX ?? 150) && !(best && R > best.R * LARGER); R *= 1.02)
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
function modeOf(word: string): Mode {
  const l = lineOf(word);
  if (l.stems.some(m => l.b.strokes[m.si].own?.[0] === 0)) return 'stem';
  // (a word with a stem cannot lie along the rim: its stem would leave the circle)
  if (!l.stems.length && !RIGID.test(word) && drawnOut(word, 30, 29)) return 'kashida';
  return l.entry ? 'entry' : l.stems.length ? 'stem' : null;
}

// ---- the canopy over the cradle's level lines (a text too long for one ground line) ----
// The cradle's arrangement (helper), its upper half kept FLOOR + CLEAR further from the circle; the first word stands
// at the right end of the top line, and its stroke (rule 5) is drawn out from there. The arc ends TIP past the top,
// or sooner if it would come within CLEAR of the top line.
function cradleCanopy(text: string): Canopied | null {
  const l = cradleCompose(text, { roof: FLOOR + CLEAR + 0.3 });
  if (!l || l.lines.length < 2) return null;
  const line = lineOf(l.lines[0]),
    R = l.R,
    rho = R - MARGIN - FLOOR / 2 - 0.05,
    p: Placed = { l: line, off: centred(line), dy: l.hs[0], extra: line.stems.map(() => 0) },
    k = line.stems.findIndex(m => m.wi === 0),
    word = l.lines[0].split(' ')[0],
    stem = k >= 0 && (!line.entry || line.b.strokes[line.stems[k].si].own?.[0] === 0),
    rest = l.pieces.slice(1);
  if (!stem && !line.entry) return null;
  for (let tip = TIP; tip > -0.6; tip -= 0.1) {
    let roof: Roof;
    if (stem) {
      const c = stemCanopy(p, k, rho, tip);
      if (!c) continue;
      p.extra = line.stems.map((_, j) => (j === k ? c.extra : 0));
      p.swap = c.swap;
      roof = { loose: c.loose, what: `the first stem of ${word}, risen x${(1 + c.extra / line.stems[k].top).toFixed(2)} and turned into the rim`, from: c.from, to: c.to }; // prettier-ignore
    } else {
      const en = line.entry!,
        st = line.b.strokes[en.si],
        q = st.s[en.cut],
        arc = canopyArc([q.x + p.off[0], q.y + p.dy], en.back, q.w, st.ang, rho, tip);
      if (!arc) continue;
      p.swap = { si: en.si, from: en.cut, s: arc.s.map(v => ({ ...v, x: v.x - p.off[0], y: v.y - p.dy })) };
      roof = { loose: th.strokePolys({ ang: st.ang, s: arc.s.slice(0, -STUB) }), what: `an entry into the first letter of ${word}`, from: arc.phi0 * DEG, to: arc.phiEnd * DEG }; // prettier-ignore
    }
    if (nearPairs([inkAt(p, true), ...rest, roof.loose], R, CLEAR).some(pr => pr.includes(rest.length + 1))) continue;
    return {
      R,
      polys: [...cleanOutline(inkAt(p)), ...rest.flat()],
      lines: l.lines,
      cradle: l.cradle,
      arc: l.arc,
      stems: 0,
      factors: [],
      cost: 0,
      note: 'the cradle on level lines',
      roof,
    };
  }
  return null;
}

// ======== concentric circles ========
// The writing follows circles concentric with the rim, and still reads as lines from the top down:
//   the rim's circle     the canopy over the top, the cradle under the foot
//   the stems' circle    CLEAR inside the canopy: every stem of the first arch rises to it
//   arches               the first words, bent along a circle (letters upright at the top, stems pointing away from
//                        the centre), one arch or two, each read from the upper right round to the upper left
//   the core             level lines in the middle; the last ends in the cradle word
//   the hanging arc      the words after the cradle word, bent along a circle just over the cradle's floor (letters
//                        upright at the bottom, stems pointing to the centre)
// 1. The cradle letter is the cradle's (helper); the words after its word are the hanging arc.
// 2. The words up to the cradle word are cut, in order, into one or two arches and one to three level lines, every
//    way. An arch's line of writing is a circle: the first so far inside the stems' circle that its tallest letter
//    reaches it; the next LINE_SPACE under the first one's deepest tail. An arch spans no more than ARCH_MAX each
//    side of the top, the hanging arc no more than HANG_ARC each side of the bottom. The level lines stand at one
//    pitch (baselines-first), as low as they clear the hanging arc (or the cradle's floor), and must lie inside the
//    innermost arch's circle.
// 3. The circle is the smallest in which some cut stands (measured by raster: no two inks within CLEAR); of the cuts
//    that stand in it, the one whose arches are fullest.
// 4. The canopy is the first word's (rule 5 of the ground line; a word that would be drawn out is entered instead,
//    since it stands on the arch): a stem rises from the arch to the rim and turns into it; an entry is led down from
//    the rim to the arch. The other stems of the first arch rise to the stems' circle, or to CLEAR under the canopy's
//    shoulder.
// Reading rule: arches from the outside in, each from the upper right to the upper left; then the level lines from
// the top down; then the hanging arc from right to left: the order of level lines.
const ARCH_MAX = (82 * Math.PI) / 180,
  HANG_ARC = (45 * Math.PI) / 180,
  MIN_ARCH = 9, // an arch's line of writing is no tighter than this (pen units)
  HOLLOW = 1.5, // what the empty bands over and under the level lines cost: their share of the circle's height
  THIN = 0.15, // what an arch that spans little costs
  ROOMIER = 1.1; // a circle up to this much larger than the smallest that stands is taken if it costs less
type Dir = 'out' | 'in';
/** A line bent along a circle of radius r about the centre, its middle at the top (`out`: letters upright there, stems
 *  away from the centre) or at the bottom (`in`: stems to the centre): every skeleton sample carried to the circle
 *  and the pen turned with it, stems first drawn `extra` taller. The stacked name rides whole. */
function carried(l: Line, extra: readonly number[], r: number, dir: Dir) {
  const mid = (l.x0 + l.x1) / 2,
    words = l.text.split(' '),
    span = l.whole.map(q => (Math.min(...q.map(v => v[0])) + Math.max(...q.map(v => v[0]))) / 2),
    at = (x: number, y: number) => {
      const t = (x - mid) / r;
      return dir === 'out'
        ? { x: (r + y) * Math.sin(t), y: (r + y) * Math.cos(t), a: -t }
        : { x: (r - y) * Math.sin(t), y: -(r - y) * Math.cos(t), a: t };
    },
    carry = (x: number, y: number, k: number) => {
      if (!RIGID.test(words[k])) return at(x, y);
      const o = at(span[k], 0),
        dx = x - span[k];
      return {
        x: o.x + dx * Math.cos(o.a) - y * Math.sin(o.a),
        y: o.y + dx * Math.sin(o.a) + y * Math.cos(o.a),
        a: o.a,
      };
    };
  return {
    strokes: raise(l.b, l.stems, extra).map((st, si) => ({ ...st, own: undefined, s: st.s.map((q): Sample => { const c = carry(q.x, q.y, l.strokeWord[si]); return { ...q, x: c.x, y: c.y, rot: (q.rot ?? 0) + c.a }; }) })), // prettier-ignore
    dots: l.b.dots.flatMap(([x, y, sc, rot], k) => {
      const c = carry(x, y, l.dotWord[k] ?? 0);
      return th.dotPolysAt(c.x, c.y, sc ?? 1, (rot ?? 0) + c.a);
    }),
  };
}
const topOf = (l: Line) => Math.max(...l.whole.flat().map(q => q[1])),
  depthOf = (l: Line) => -Math.min(0, ...l.whole.flat().map(q => q[1]));
/** Every cut of some words, in order, into p groups. */
function cutsOf(words: string[], p: number): string[][] {
  if (p === 1) return [[words.join(' ')]];
  const out: string[][] = [];
  for (let k = 1; k <= words.length - p + 1; k++) for (const rest of cutsOf(words.slice(k), p - 1)) out.push([words.slice(0, k).join(' '), ...rest]); // prettier-ignore
  return out;
}
type Ringed = Canopied & { rings: string };
function rings(text: string, dir: Dir = 'out'): Ringed | null {
  const words = text.split(' '),
    n = words.length,
    cr = cradleOf(text);
  if (!cr) return null;
  const ci = cr.wi,
    after = ci < n - 1 ? lineOf(words.slice(ci + 1).join(' ')) : null,
    first = modeOf(words[0]),
    // (stems to the centre: the first letter's head is then on the inside, and no stroke of it can reach the rim)
    mode = dir === 'in' ? null : first === 'kashida' ? (lineOf(words[0]).entry ? 'entry' : null) : first,
    cuts: { arch: string[]; core: string[] }[] = [];
  for (const na of [1, 2]) for (const nc of [1, 2, 3]) if (na + nc <= ci + 1) for (const c of cutsOf(words.slice(0, ci + 1), na + nc)) cuts.push({ arch: c.slice(0, na), core: c.slice(na) }); // prettier-ignore
  const hangs = new Map<string, ReturnType<typeof profile>>();
  /** One cut in a circle of radius R: how full its arches are, and the drawing (null if it does not stand). */
  const at = (R: number, cut: { arch: string[]; core: string[] }, lift: number) => {
    const Rt = R - MARGIN,
      rho = Rt - FLOOR / 2 - 0.05,
      c1 = rho - FLOOR / 2 - CLEAR - SLACK,
      arches: { l: Line; r: number; extra: number[] }[] = [];
    let top = dir === 'out' ? c1 : Rt - 1,
      fill = 1,
      span = 0;
    for (const t of cut.arch) {
      const l = lineOf(t),
        r = top - (dir === 'out' ? topOf(l) : depthOf(l)),
        half = (l.x1 - l.x0) / (2 * r);
      if (r < MIN_ARCH || half > ARCH_MAX) return no('r1');
      fill = Math.min(fill, half / ARCH_MAX);
      span = half;
      arches.push({ l, r, extra: l.stems.map(() => 0) });
      top = r - (dir === 'out' ? depthOf(l) : topOf(l)) - LINE_SPACE;
    }
    // the hanging arc, and the floor of the level lines
    const floor = Rt - FLOOR - CLEAR - SLACK;
    let rh = 0,
      held: ReturnType<typeof profile> | null = null;
    if (after) {
      rh = floor - depthOf(after) - lift;
      if ((after.x1 - after.x0) / (2 * rh) > HANG_ARC) return no('r2');
      const key = rh.toFixed(3);
      if (!hangs.has(key)) {
        const c = carried(after, after.stems.map(() => 0), rh, 'in'); // prettier-ignore
        hangs.set(key, profile([[colsOf([...c.strokes.flatMap(st => th.strokePolys(st)), ...c.dots]), 0]]));
      }
      held = hangs.get(key)!;
    }
    // the level lines
    const m = cut.core.length - 1,
      ls = cut.core.map((t, i) => lineOf(t, i === m)),
      offs = ls.map(centred),
      profs = ls.map((l, i) => profOf(l, offs[i])),
      pitch = Math.max(0, ...ls.slice(1).map((_, i) => need(profs[i], profs[i + 1]))),
      // (they rest on the hanging arc at LINE_SPACE, or on the cradle's floor)
      hb = Math.max(lowest(ls[m], offs[m], floor) + (after ? 0 : lift), held ? need(profs[m], held) : -Infinity);
    if (hb === Infinity) return no('r3');
    const ps: Placed[] = ls.map((l, i) => ({ l, off: offs[i], dy: hb + (m - i) * pitch, extra: l.stems.map(() => 0) }));
    // (under the innermost arch they keep inside its circle; beside it, the raster decides)
    for (const q of ps)
      for (const [k, h] of q.l.whole.entries())
        for (const [x, y] of h) {
          const d = Math.hypot(x + q.off[k], y + q.dy);
          if (d > Rt || (d > top && y + q.dy > 0 && Math.abs(Math.atan2(x + q.off[k], y + q.dy)) < span + 0.1))
            return no('r4');
        }
    // what it costs: the radius, raised by the empty bands over and under the level lines (VOID) and by a thin arch
    const gaps =
        Math.max(0, top - ps[0].dy - topOf(ls[0])) +
        Math.max(0, hb - depthOf(ls[m]) + (after ? rh - topOf(after) : floor)),
      cost = R * (1 + (HOLLOW * gaps) / (2 * Rt)) * (1 + THIN * (1 - fill));
    return { cost, cut, draw: () => drawn(R, cut, arches, ps, rh) };
  };
  const drawn = (
    R: number,
    cut: { arch: string[]; core: string[] },
    arches: { l: Line; r: number; extra: number[] }[],
    ps: Placed[],
    rh: number,
  ): Ringed | null => {
    const Rt = R - MARGIN,
      rho = Rt - FLOOR / 2 - 0.05,
      c1 = rho - FLOOR / 2 - CLEAR - SLACK,
      a0 = arches[0],
      l0 = a0.l,
      k = mode === 'stem' ? l0.stems.findIndex(q => q.wi === 0) : -1,
      rise = (lim: (s: number) => number) =>
        l0.stems.map((_, s) =>
          s === k ? a0.extra[k] : Math.max(0, lim(s) - a0.r - Math.max(...l0.heads[s].map(v => v[1]))),
        );
    let roof: Roof | null = null,
      swap: Swap | null = null;
    a0.extra = dir === 'out' ? rise(() => c1) : rise(() => a0.r + topOf(l0));
    if (mode === 'stem' && k >= 0) {
      const q = l0.stems[k],
        st = l0.b.strokes[q.si];
      for (const drop of DROPS_STEM) {
        a0.extra[k] = rho - drop - a0.r - st.s[q.cut].y;
        if (a0.extra[k] < 0) continue;
        const cs = carried(l0, a0.extra, a0.r, 'out').strokes[q.si].s,
          C = cs[q.cut],
          d = Math.hypot(C.x - cs[q.cut + 1].x, C.y - cs[q.cut + 1].y),
          arc = canopyArc([C.x, C.y], [(C.x - cs[q.cut + 1].x) / d, (C.y - cs[q.cut + 1].y) / d], C.w, st.ang, rho);
        if (!arc) continue;
        swap = { si: q.si, from: q.cut, s: arc.s };
        roof = { loose: th.strokePolys({ ang: st.ang, s: arc.s.slice(0, -STUB) }), what: `the first stem of ${words[0]}, risen x${(1 + a0.extra[k] / q.top).toFixed(2)} from its arch and turned into the rim`, from: arc.phi0 * DEG, to: arc.phiEnd * DEG }; // prettier-ignore
        break;
      }
      if (!swap) return no('r5');
    } else if (mode === 'entry') {
      const en = l0.entry!,
        st = l0.b.strokes[en.si],
        cs = carried(l0, a0.extra, a0.r, 'out').strokes[en.si].s,
        C = cs[en.cut],
        d = Math.hypot(C.x - cs[en.cut + 2].x, C.y - cs[en.cut + 2].y),
        arc = canopyArc([C.x, C.y], [(C.x - cs[en.cut + 2].x) / d, (C.y - cs[en.cut + 2].y) / d], C.w, st.ang, rho);
      if (!arc) return no('r6');
      swap = { si: en.si, from: en.cut, s: arc.s };
      roof = { loose: th.strokePolys({ ang: st.ang, s: arc.s.slice(0, -STUB) }), what: `an entry into the first letter of ${words[0]}, led down ${(rho - Math.hypot(C.x, C.y)).toFixed(1)} from the rim to its arch`, from: arc.phi0 * DEG, to: arc.phiEnd * DEG }; // prettier-ignore
    }
    // the stems give way under the canopy's shoulder
    if (swap) {
      const verts = th.strokePolys({ ang: l0.b.strokes[swap.si].ang, s: swap.s }).flat(),
        mid = (l0.x0 + l0.x1) / 2;
      a0.extra = rise(s => {
        const t = (l0.stems[s].x - mid) / a0.r,
          hw = (1.3 + CLEAR) / c1;
        let low = Infinity;
        for (const [x, y] of verts) if (Math.abs(Math.atan2(x, y) - t) < hw) low = Math.min(low, Math.hypot(x, y));
        return Math.min(c1, low - CLEAR - SLACK);
      });
    }
    const inkOf = (c: ReturnType<typeof carried>, sw: Swap | null, stub: boolean) => [
        ...c.strokes.flatMap((st, si) => th.strokePolys(sw && si === sw.si ? { ...st, s: [...(stub ? [] : sw.s), ...st.s.slice(sw.from)] } : st)), // prettier-ignore
        ...c.dots,
      ],
      // (stems to the centre: the arch is the hanging arc's kind, turned half round to the top)
      turned = (c: ReturnType<typeof carried>): ReturnType<typeof carried> =>
        dir === 'out' ? c : { strokes: c.strokes.map(st => ({ ...st, s: st.s.map(q => ({ ...q, x: -q.x, y: -q.y })) })), dots: c.dots.map(q => q.map(([x, y]) => [-x, -y] as Pt)) }, // prettier-ignore
      c0 = turned(carried(l0, a0.extra, a0.r, dir)),
      more = arches.slice(1).map(a => inkOf(turned(carried(a.l, a.extra, a.r, dir)), null, false)),
      hang = after ? [inkOf(carried(after, after.stems.map(() => 0), rh, 'in'), null, false)] : [], // prettier-ignore
      pc = ps[ps.length - 1],
      bowl = bowlOf(pc, R, after ? null : rightOf(pc));
    if (!bowl) return no('r7');
    const level = ps.map(q => inkAt(q)),
      pieces = [inkOf(c0, swap, true), ...(roof ? [roof.loose] : []), ...more, ...level, ...hang, bowl.loose];
    if (pieces.flat(2).some(([x, y]) => Math.hypot(x, y) > Rt + 1e-6)) return no('r8');
    const hits = nearPairs(pieces, R, CLEAR);
    if (hits.length) {
      const names = ['arch1', ...(roof ? ['canopy'] : []), ...more.map(() => 'arch'), ...level.map(() => 'level'), ...hang.map(() => 'hanging'), 'bowl']; // prettier-ignore
      return no('touch ' + hits.map(([i, j]) => `${names[i]}-${names[j]}`).join(','));
    }
    const factors = l0.stems.map((q, s) => 1 + a0.extra[s] / q.top).filter(v => v > 1.001);
    return {
      R,
      polys: [inkOf(c0, swap, false), ...more, ...level, ...hang, bowl.ink].flatMap(q => cleanOutline(q)),
      lines: [...cut.arch.map(t => `arch: ${t}`), ...cut.core.map(t => `level: ${t}`), ...(after ? [`hanging: ${after.text}`] : [])], // prettier-ignore
      cradle: cr,
      arc: (bowl.phi0 - bowl.phiEnd) * DEG,
      stems: l0.stems.length,
      factors,
      cost: R,
      roof,
      rings: `circles (radius in nibs): rim ${(rho / NIB).toFixed(1)}, stems ${(c1 / NIB).toFixed(1)}, ${arches.map((a, i) => `arch ${i + 1} ${(a.r / NIB).toFixed(1)} (${a.l.nw} word${a.l.nw === 1 ? '' : 's'})`).join(', ')}${after ? `, hanging arc ${(rh / NIB).toFixed(1)} (${after.nw} word${after.nw === 1 ? '' : 's'})` : ''}; level lines ${cut.core.length} (${cut.core.map(t => t.split(' ').length).join('+')} words)`,
      note: 'stems counted on the first arch',
    };
  };
  let best: Ringed | null = null;
  for (let R = 12; R < 90 && !(best && R > best.R * ROOMIER); R *= 1.025) {
    const ok = cuts.map(c => at(R, c, 0)).filter(c => c != null).sort((p, q) => p.cost - q.cost); // prettier-ignore
    each: for (const c of ok.slice(0, 5)) {
      if (best && c.cost >= best.cost) break;
      for (const lift of [0, 1.5, 3, 5]) {
        const l = lift ? at(R, c.cut, lift)?.draw() : c.draw();
        if (!l) continue;
        best = { ...l, cost: c.cost };
        break each;
      }
    }
  }
  return best;
}

describe('the canopy', () => {
  it('finds the stroke to draw out', () => {
    // a tooth and the head of a mim are entered from the rim; a qaf is not (its pen starts upwards)
    expect(['بسم', 'محمد', 'قل'].map(w => !!lineOf(w).entry)).toEqual([true, true, false]);
    expect(TEXTS.map(([, t]) => modeOf(t.split(' ')[0]))).toEqual(['entry', 'kashida', 'stem', 'stem']);
  });
  it('draws the canopy on the rim, from its tip to the stroke it enters', () => {
    const arc = canopyArc([18, 8], [0, 1], 1, 69, 24)!,
      r = arc.s.map(q => Math.hypot(q.x, q.y)),
      last = arc.s[arc.s.length - 1];
    // on the circle for most of its length, thin at its tip, arriving at the take-over point
    expect(r.filter(v => Math.abs(v - 24) < 0.01).length).toBeGreaterThan(r.length / 2);
    expect(Math.max(...r)).toBeLessThanOrEqual(24 + 1e-9);
    expect(arc.s[0].w).toBeLessThan(0.2);
    expect(Math.hypot(last.x - 18, last.y - 8)).toBeLessThan(0.5);
    expect(arc.s[0].x).toBeLessThan(0);
  });
  it.runIf(!!process.env.CANOPY)(
    'writes the sheets',
    () => {
      const out = process.env.CANOPY_OUT ?? join(import.meta.dirname, '../docs/canopy');
      mkdirSync(out, { recursive: true });
      const report: string[] = [],
        only = process.env.CANOPY_ONLY?.split(','),
        rowsWanted = process.env.CANOPY_ROWS?.split(',') ?? ['candidates', 'ground', 'canopy', 'rings', 'rings-in'],
        texts = TEXTS.filter(([id]) => !only || only.includes(id)),
        f2 = (v: number) => v.toFixed(2),
        say = (tag: string, id: string, t: string, l: Drawn | null) => {
          if (!l) return void report.push(`${tag} ${id}: no arrangement`);
          const f = (l.factors ?? []).slice().sort((p, q) => p - q);
          report.push(
            `${tag} ${id}: radius ${l.R.toFixed(1)} (${(l.R / NIB).toFixed(1)} nibs); lines: ${l.lines.join(' / ')}` +
              (l.roof
                ? `; canopy: ${l.roof.what}; it follows the rim from ${l.roof.from.toFixed(0)} to ${l.roof.to.toFixed(0)} degrees clockwise of the top, ${(l.roof.from - l.roof.to).toFixed(0)} degrees`
                : '') + // prettier-ignore
              (l.cradle ? `; cradle: the final ${l.cradle.c} of ${t.split(' ')[l.cradle.wi]}` : '') +
              (l.arc ? `, ${l.arc.toFixed(0)} degrees of rim` : '') +
              (l.stems
                ? `; stems ${l.stems}, risen ${f.length}${f.length ? ` by x${f2(f[0])} to x${f2(f[f.length - 1])} (median x${f2(median(f))}): ${f.map(f2).join(' ')}` : ''}`
                : '') + // prettier-ignore
              (l.rings ? `; ${l.rings}` : '') +
              (l.note ? `; ${l.note}` : ''),
          );
        };
      if (rowsWanted.includes('candidates')) {
        const basmala = TEXTS[1][1],
          cands = (['entry', 'kashida', 'stem'] as const).map(m => {
            WHY.clear();
            const l = ground(basmala, m);
            SAY?.push(`${m}: ${[...WHY].map(([k, v]) => `${k}:${v}`).join(' ')}`);
            say(`candidate ${m}`, 'basmala', basmala, l);
            return l;
          });
        cands.forEach((l, i) => l && writeFileSync(join(out, `candidate-${'abc'[i]}.png`), toPNG(svgOf(l), 900)));
        writeFileSync(join(out, 'canopy-candidates.png'), toPNG(sheetOf([cands], 800), 2400));
      }
      const make: Record<string, (t: string) => Drawn | null> = {
          ground: t => (t.split(' ').length <= 6 ? ground(t) : (cradleCompose(t) as Drawn | null)),
          canopy: t => (t.split(' ').length <= 6 ? ground(t, modeOf(t.split(' ')[0])) : cradleCanopy(t)),
          rings: t => rings(t),
          'rings-in': t => rings(t, 'in'),
        },
        rows = rowsWanted
          .filter(tag => tag !== 'candidates')
          .map(tag =>
            texts.map(([id, t]) => {
              WHY.clear();
              const l = make[tag](t);
              SAY?.push(`${tag} ${id}: ${[...WHY].map(([k, v]) => `${k}:${v}`).join(' ')}`);
              say(tag, id, t, l);
              if (l) writeFileSync(join(out, `${tag}-${id}.png`), toPNG(svgOf(l), 900));
              return l;
            }),
          );
      // (the sheet: the ground line as it was, with the canopy, concentric circles; stems to the centre is beside it)
      const sheet = rows.filter((_, i) => rowsWanted.filter(tag => tag !== 'candidates')[i] !== 'rings-in');
      if (sheet.length) writeFileSync(join(out, 'canopy-sheet.png'), toPNG(sheetOf(sheet), texts.length * 480));
      writeFileSync(join(out, 'numbers.txt'), report.join('\n') + '\n');
      if (SAY) writeFileSync(join(out, 'debug.txt'), SAY.join('\n') + '\n');
      expect(report.length).toBeGreaterThan(0);
    },
    1_800_000,
  );
});
