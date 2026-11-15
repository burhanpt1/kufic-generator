// The meridians (owner's experiment, 15 November 2026). On the ground line with the canopy and the cradle
// (tests/char-canopy-sheet.test.ts: the same rules, written again here, that file is not changed) the risen stems
// stand straight. Here they are the meridians of a globe seen from the side: the lines of writing are its parallels
// (level), a stem on the upright axis is straight, one further out leans inward as it rises and curves the more the
// further out it stands, and one at the rim is the rim. And the heads of the stems may be mirrored on one half of
// the circle, like the two sides of a dome.
// The rules, in the order they are applied (the numbers are below and in tests/helpers/char-first.ts `meridians`):
//   A1. The arrangement is the canopy's (rules 1 to 5 there), with every measure of a risen stem taken on its
//       curve: how far it may rise (to the stopping circle, CLEAR under the canopy), where an upper word may stand.
//   A2. THE RULE. A stem is cut at its split (findStems). If the split stands at (x0, y0) from the circle's centre,
//       the stem at height y stands at x0 w(y) / w(y0), w(y) = sqrt(rho^2 - y^2), rho the circle the canopy and the
//       cradle run on. Every skeleton sample above the split is moved sideways by that (times the strength), less
//       the slope the rule has at the foot, which is let in over EASE: the stem leaves its foot upright. The pen is
//       turned with the stem's direction at each sample, so the shaft keeps one weight. The head (the top HEAD_LEN
//       of the stem, and what rides with it) is not bent: it rides the top whole, turned with the stem there.
//   A3. Where stems stop: on the stopping circle (the rim's margin, or INNER inside the canopy's underside); CLEAR
//       under the canopy; and, measured on a raster, a stem that comes within CLEAR of another stem's risen part is
//       drawn shorter (the outer of the two, TRIM at a time).
//   A4. The name of God: its stems follow one meridian, the middle stem's (parallel curves: they keep their spacing);
//       on a line higher than NAME_LAT of the radius it rises straight.
//   A5. A stem that is the canopy (rule 5c) follows its meridian until it is a little inside the rim's circle and is
//       led from there into the rim with the direction it has: one stroke, no corner.
//   B.  The heads: mirrored about the stem's own line for the stems on one side of the upright axis (see SERIF).
// `MERIDIAN=1 MERIDIAN_OUT=<dir> npx vitest run tests/char-meridian-sheet.test.ts --maxWorkers=2` writes the sheets.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPNG } from '../scripts/raster.mjs';
import type { Built } from '../src/script/thuluth/engine';
import { cleanOutline } from '../src/script/thuluth/outline';
import type { Poly, Sample } from '../src/script/thuluth/types';
import type { Bend, Cols, Cradle, Head, Pt, Stem } from './helpers/char-first';
import { CAP, CLEAR, FLOOR, LINE_SPACE, MARGIN, NIB, SPAN_MAX, STEP, TEXTS, TIP_LEN, bowlPen, colsOf, cradleCompose, cradleOf, discOf, findStems, hull, meridianShift, meridians, nearPairs, need, profile, raise, room, sheetOf, svgOf, sweep, takeOver, th } from './helpers/char-first'; // prettier-ignore

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

// ---- the numbers of the meridians ----
const AXIS = 0.5 * NIB, // a stem within this of the upright axis stands on it
  TRIM = 0.6, // a stem that comes too near its neighbour is drawn this much shorter at a time
  NAME_LAT = 0.4, // the name of God is bent (as one body) only where it stands lower than this share of the radius
  NECK_BENT = 5 * NIB, // a curved stem's pen turns to the rim's over this length (the canopy's own: 2 nibs)
  DROPS_BENT = [2.2, 3, 4, 5, 6.5]; // how far inside the rim a curved stem is led into it: the least that stands
/** What is being tried. */
interface How {
  /** The strength of the rule: the share of its shift that is applied (0: straight stems, as the canopy has them). */
  k: number;
  /** The stems stop on a circle this many nibs inside the canopy's underside (null: at the rim's margin). */
  inner: number | null;
  /** The name of God: bent stem by stem, kept straight, or bent as one body about its middle stem; `kept`: as one
   *  body on a line below NAME_LAT, straight on a higher one (near the pole the meridians would tip it over). */
  name: 'curved' | 'straight' | 'body' | 'kept';
  /** Every tall stem is bent, risen or not. */
  all: boolean;
  /** The heads: as written; mirrored left of the axis (every serif outward); right of it (inward); all. */
  serif: 'none' | 'out' | 'in' | 'all';
  /** A stem on the axis: its head as written, or drawn both ways. */
  axis: 'keep' | 'both';
  ease: number;
}
const STRAIGHT: How = { k: 0, inner: null, name: 'curved', all: false, serif: 'none', axis: 'keep', ease: 3 };
let HOW: How = STRAIGHT;
const bending = () => HOW.k > 0 || HOW.serif !== 'none';

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
function canopyArc(C: Pt, back: Pt, wC: number, ang: number, rho: number, tip = TIP, neck = NECK) {
  // (the helper's sweep runs along the bottom to the left: this is that, upside down)
  const sw = sweep([C[0], -C[1]], [back[0], -back[1]], wC, rho, phi0 => -Math.max(tip, RUN_MIN - phi0), neck);
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
  pos?: Placed,
) {
  const cur = pos && bending() ? meridians(l.b, l.stems, extra, l.stems.map((_, s) => bendOf(pos, s, extra[s] > 0))) : null, // prettier-ignore
    raised = cur ? cur.strokes : raise(l.b, l.stems, extra),
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
  // (a mirrored head is a stroke of its own)
  if (cur && !body) for (const h of cur.heads) words[l.strokeWord[h.si]].push(...th.strokePolys(h.stroke));
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
  /** The circle its stems' meridians belong to (unset: its stems are straight). */
  rho?: number;
}
const inkAt = (p: Placed, stub = false): Poly[] =>
  inked(p.l, p.extra, false, p.swap, stub, p).words.flatMap((w, k) =>
    w.map(q => q.map(([x, y]) => [x + p.off[k], y + p.dy] as Pt)),
  );

// ======== the meridians ========
/** How stem s of a placed line is bent (null: it is drawn straight, as written or risen). */
function bendOf(p: Placed, s: number, risen = p.extra[s] > 0): Bend | null {
  if (!p.rho || !bending() || (!risen && !HOW.all)) return null;
  const m = p.l.stems[s],
    foot = (o: Stem) => p.l.b.strokes[o.si].s[o.cut + 1],
    ox = p.off[m.wi],
    bd: Bend = { ox, oy: p.dy, rho: p.rho, k: HOW.k, ease: HOW.ease };
  let x = foot(m).x + ox;
  if (m.name) {
    // the name of God is one form: its middle stem says which side it stands on, and (as one body) is its meridian
    const mine = p.l.stems.filter(o => o.name && o.wi === m.wi).map(foot).sort((a, b) => a.x - b.x), // prettier-ignore
      mid = mine[(mine.length - 1) >> 1];
    x = mid.x + ox;
    const y = Math.max(...mine.map(q => q.y)) + p.dy;
    if (HOW.name === 'straight' || (HOW.name === 'kept' && y > NAME_LAT * p.rho)) bd.k = 0;
    else if (HOW.name !== 'curved') {
      bd.x0 = x;
      bd.y0 = y;
    }
  }
  if (HOW.serif !== 'none' && p.swap?.si !== m.si) {
    if (HOW.serif === 'all' || (HOW.serif === 'out' ? x : -x) < -AXIS) bd.head = 'mirror';
    else if (Math.abs(x) <= AXIS && HOW.axis === 'both') bd.head = 'both';
  }
  return bd;
}
/** Some ink as points, one to a cell of 0.3: what a stem is kept clear of. */
function thin(polys: readonly Poly[]): Pt[] {
  const seen = new Map<string, Pt>();
  for (const q of polys) for (const v of q) seen.set(`${Math.round(v[0] / 0.3)},${Math.round(v[1] / 0.3)}`, v as Pt);
  return [...seen.values()];
}
/** How much taller stem s of a placed line can be drawn on its meridian before what rises of it leaves a circle of
 *  radius `stop` or comes within CLEAR of `roof` (the canopy): the nib's reach about every sample is kept inside. */
function reach(p: Placed, s: number, stop: number, roof: readonly Pt[] | null): number {
  const m = p.l.stems[s],
    ox = p.off[m.wi],
    bd = bendOf(p, s, true),
    cap = (CAP - 1) * m.top,
    x0 = p.l.b.strokes[m.si].s[m.cut + 1].x + ox,
    near = roof?.filter(v => v[0] > Math.min(x0, 0) - 5 && v[0] < Math.max(x0, 0) + 5),
    ok = (e: number) => {
      for (const st of meridians(p.l.b, [m], [e], [bd]).rise[0])
        for (const q of st.s) {
          const x = q.x + ox,
            y = q.y + p.dy,
            h = ((st.nib ?? NIB) / 2) * q.w;
          if (Math.hypot(x, y) + h > stop) return false;
          if (near) for (const v of near) if (Math.hypot(v[0] - x, v[1] - y) < h + CLEAR + SLACK) return false;
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
/** What rises of each stem of a placed line, as ink where it stands (`keep`: the stem that is the canopy, without
 *  its head). */
function risen(p: Placed, extra: readonly number[], bent: boolean, keep = -1): Poly[][] {
  const q: Placed = { ...p, extra: extra.slice() };
  return meridians(
    p.l.b,
    p.l.stems,
    extra,
    p.l.stems.map((_, s) => (bent ? bendOf(q, s) : null)),
  ).rise.map((r, s) => {
    // prettier-ignore
    const m = p.l.stems[s];
    return r
      .flatMap((st, i) => th.strokePolys(s === keep && i === 0 ? { ...st, s: st.s.slice(m.cut) } : st))
      .map(v => v.map(([x, y]) => [x + p.off[m.wi], y + p.dy] as Pt));
  });
}
/** Rule A3: a stem whose risen part comes within CLEAR of another's (on the raster) is drawn shorter, the outer of
 *  the two, until they are clear. Pairs that are as near as written are left. */
function trim(p: Placed, R: number, keep = -1): number {
  const stems = p.l.stems,
    key = ([i, j]: [number, number]) => i * 100 + j,
    was = new Set(nearPairs(risen(p, stems.map(() => 0), false), R, CLEAR).map(key)), // prettier-ignore
    out = (s: number) => Math.abs(p.l.b.strokes[stems[s].si].s[stems[s].cut + 1].x + p.off[stems[s].wi]);
  let cuts = 0;
  for (let n = 0; n < 120; n++) {
    const hits = nearPairs(risen(p, p.extra, true, keep), R, CLEAR).filter(pr => !was.has(key(pr)));
    if (!hits.length) break;
    for (const pr of hits) {
      const can = pr.filter(s => s !== keep && p.extra[s] > 0).sort((a, b) => out(b) - out(a));
      if (!can.length) {
        was.add(key(pr));
        continue;
      }
      const v = can[0];
      p.extra[v] = p.extra[v] - TRIM < MIN_RISE * stems[v].top ? 0 : p.extra[v] - TRIM;
      cuts++;
    }
  }
  return cuts;
}
/** Rule A5: a stem as the canopy, on its meridian: stem k rises until its split stands a little inside the rim's
 *  circle, and is led into the rim from there with the direction it has. */
function stemCanopyBent(p: Placed, k: number, rho: number, tip = TIP) {
  const m = p.l.stems[k],
    st = p.l.b.strokes[m.si],
    dx = p.off[m.wi],
    bd = bendOf({ ...p, swap: { si: m.si, from: 0, s: [] } }, k, true),
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
      arc = canopyArc(
        [q.x + dx, q.y + p.dy],
        [(q.x - z.x) / n, (q.y - z.y) / n],
        q.w,
        st.ang + phi * DEG,
        rho,
        tip,
        NECK_BENT,
      );
    if (!arc) continue;
    const led = arc.s.map(v => ({ ...v, rot: (v.rot ?? 0) + phi }));
    return {
      extra: lo,
      drop,
      swap: { si: m.si, from: m.cut, s: led.map(v => ({ ...v, x: v.x - dx, y: v.y - p.dy })) } as Swap,
      loose: th.strokePolys({ ang: st.ang, s: led.slice(0, -STUB) }),
      from: arc.phi0 * DEG,
      to: arc.phiEnd * DEG,
    };
  }
  return null;
}
/** The circle the stems stop on. */
const stopAt = (Rt: number, rho: number) => HOW.inner == null ? Rt : rho - FLOOR / 2 - CLEAR - SLACK - HOW.inner * NIB; // prettier-ignore
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
    pre = inked(p.l, p.extra, false, undefined, false, p).pre,
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
  /** The heads of the risen stems, where they stand: the foot's place sideways, and the top. */
  heads?: { x0: number; at: Pt }[];
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
      bent = bending(),
      pas: Placed[] = aft.map(l => ({ l, off: centred(l), dy: 0, extra: l.stems.map(() => 0), rho })),
      m = pas.length - 1;
    let hg: number;
    if (pas.length) {
      pas[m].dy = lowest(pas[m].l, pas[m].off, Rt - FLOOR - CLEAR) + lift;
      for (let i = m - 1; i >= 0; i--) pas[i].dy = pas[i + 1].dy + need(profOf(pas[i].l, pas[i].off), profOf(pas[i + 1].l, pas[i + 1].off)); // prettier-ignore
      hg = pas[0].dy + need(profOf(g, off), profOf(pas[0].l, pas[0].off));
    } else hg = lowest(g, off, Rt - FLOOR - CLEAR) + lift;
    if (!(hg < Infinity)) return no('1');
    const pg: Placed = { l: g, off, dy: hg, extra: g.stems.map(() => 0), rho };
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
      const c = bent ? stemCanopyBent(pg, 0, rho) : stemCanopy(pg, 0, rho);
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
    let cuts = 0;
    if (bent) {
      // rules A1 and A3: each stem's room is measured on its meridian
      const pts = roof ? thin(roof.loose) : null,
        stop = stopAt(Rt, rho);
      g.stems.forEach((m, s) => {
        const e = reach(pg, s, stop, null);
        f[s] = e > 0 && hg + m.base + m.top + e < Rt * Math.sin(GIVE) ? 0 : pts && e > 0 ? reach(pg, s, stop, pts) : e;
      });
      pg.extra = stops(g.stems, f);
      if (forced >= 0) f[0] = pg.extra[0] = forced;
      cuts = trim(pg, R, forced >= 0 ? 0 : -1);
      g.stems.forEach((_, s) => (f[s] = pg.extra[s] > 0 ? Math.min(f[s], pg.extra[s]) : f[s]));
    } else {
      if (roof) g.stems.forEach((_, s) => (f[s] = Math.min(f[s], under(pg, s, roof!.loose))));
      pg.extra = stops(g.stems, f);
      if (forced >= 0) f[0] = pg.extra[0] = forced;
    }
    const reached = g.stems.filter((_, s) => pg.extra[s] > 0 && pg.extra[s] >= f[s] - 0.01).length,
      bowl = bowlOf(pg, R, pas.length ? null : rightOf(pg));
    if (!bowl) return no('9');
    // the upper words, each resting on the ground line as risen and on the upper words before it
    const ink = inked(g, pg.extra, false, undefined, false, pg).words.flatMap((w, k) => w.map(q => q.map(([x, y]) => [x + off[k], y] as Pt))), // prettier-ignore
      // where each stem stands, from its foot to its head
      up = meridians(g.b, g.stems, pg.extra, g.stems.map((_, s) => bendOf(pg, s))).rise, // prettier-ignore
      spans = up.map((r, s) => {
        const xs = r.flatMap(st => st.s.map(q => q.x + off[g.stems[s].wi]));
        return [Math.min(...xs), Math.max(...xs)];
      }),
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
        if (bent ? spans.some(([a, b]) => x + wide + STEM_HALF > a && x - wide - STEM_HALF < b) : g.stems.some(q => Math.abs(q.x + off[q.wi] - x) < wide + STEM_HALF)) continue; // prettier-ignore
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
      heads: g.stems.flatMap((m, s) => pg.extra[s] > 0 && s !== (forced >= 0 ? 0 : -1) ? [{ x0: g.b.strokes[m.si].s[m.cut + 1].x + off[m.wi], at: [up[s][0].s[0].x + off[m.wi], up[s][0].s[0].y + hg] as Pt }] : []), // prettier-ignore
      note: `${cuts ? `${cuts} cuts of ${TRIM} to keep stems apart; ` : ''}${reached} of ${g.stems.length} ground stems reach the rim${roof ? ' or the canopy' : ''}; ${breaches} ground word${breaches === 1 ? '' : 's'} read out of order; spaces opened ${(tot / NIB).toFixed(1)} nibs, line slid ${(slide / NIB).toFixed(1)} nibs`,
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
    bent = bending(),
    p: Placed = { l: line, off: centred(line), dy: l.hs[0], extra: line.stems.map(() => 0), rho },
    k = line.stems.findIndex(m => m.wi === 0),
    word = l.lines[0].split(' ')[0],
    stem = k >= 0 && (!line.entry || line.b.strokes[line.stems[k].si].own?.[0] === 0),
    rest = l.pieces.slice(1);
  if (!stem && !line.entry) return null;
  // (every tall stem bent: the lines under the top one are written again, but for the cradle word's)
  if (bent && HOW.all) {
    let w = 0;
    l.lines.forEach((t, i) => {
      const nw = t.split(' ').length,
        own = l.cradle && l.cradle.wi >= w && l.cradle.wi < w + nw;
      w += nw;
      if (i === 0 || own) return;
      const li = lineOf(t);
      rest[i - 1] = cleanOutline(inkAt({ l: li, off: centred(li), dy: l.hs[i], extra: li.stems.map(() => 0), rho }));
    });
  }
  for (let tip = TIP; tip > -0.6; tip -= 0.1) {
    let roof: Roof;
    if (stem) {
      p.swap = undefined;
      p.extra = line.stems.map(() => 0);
      const c = bent ? stemCanopyBent(p, k, rho, tip) : stemCanopy(p, k, rho, tip);
      if (!c) continue;
      p.extra = line.stems.map((_, j) => (j === k ? c.extra : 0));
      p.swap = c.swap;
      if (bent) {
        // the other stems of the top line rise on their meridians, under the canopy
        const pts = thin(c.loose),
          f = line.stems.map((_, j) => (j === k ? c.extra : reach(p, j, stopAt(R - MARGIN, rho), pts)));
        p.extra = stops(line.stems, f);
        p.extra[k] = c.extra;
        trim(p, R, k);
      }
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
      stems: bent ? line.stems.length : 0,
      factors: bent ? line.stems.map((q, s) => 1 + p.extra[s] / q.top).filter(v => v > 1.001) : [],
      cost: 0,
      heads: line.stems.flatMap((m, s) => {
        if (!bent || !(p.extra[s] > 0) || (stem && s === k)) return [];
        const top = meridians(line.b, [m], [p.extra[s]], [bendOf(p, s)]).rise[0][0].s[0];
        return [
          { x0: line.b.strokes[m.si].s[m.cut + 1].x + p.off[m.wi], at: [top.x + p.off[m.wi], top.y + p.dy] as Pt },
        ];
      }),
      note: 'the cradle on level lines',
      roof,
    };
  }
  return null;
}

// ======== the sheets ========
/** What the sheets draw and report. */
type Drawn = { R: number; polys: Poly[]; lines: string[]; cradle: Cradle | null } & Partial<Canopied>;
/** The combination kept (the report says why). */
const KEPT: How = { k: 1, inner: null, name: 'kept', all: false, serif: 'out', axis: 'keep', ease: 3 },
  CURVED: How = { ...KEPT, serif: 'none' };
const made = new Map<string, Drawn | null>();
/** A text on the ground line with the canopy and the cradle (a text too long for one ground line: on the cradle's
 *  level lines, the top line's stems risen), its stems drawn as `how` says. */
function make(text: string, how: How): Drawn | null {
  const key = JSON.stringify(how) + text;
  if (!made.has(key)) {
    HOW = how;
    try {
      made.set(key, text.split(' ').length <= 6 ? ground(text, modeOf(text.split(' ')[0])) : cradleCanopy(text));
    } finally {
      HOW = STRAIGHT;
    }
  }
  return made.get(key)!;
}
/** A row of discs, and under each a crop of two of its stem heads (the rightmost and the leftmost), three times as
 *  large. */
function headsSheet(ls: (Drawn | null)[], cell = 600) {
  let body = '';
  ls.forEach((l, i) => {
    if (!l) return;
    const { S, body: b } = discOf(l),
      hs = (l.heads ?? []).slice().sort((p, q) => q.x0 - p.x0),
      side = S / 6;
    body += `<g transform="translate(${i * cell} 0) scale(${(cell / S).toFixed(4)})">${b}</g>`;
    (hs.length ? [hs[0], hs[hs.length - 1]] : []).forEach((h, j) => {
      const cx = h.at[0] + S / 2,
        cy = S / 2 - h.at[1];
      body += `<svg x="${i * cell + (j * cell) / 2 + 4}" y="${cell}" width="${cell / 2 - 8}" height="${cell / 2 - 8}" viewBox="${(cx - side / 2).toFixed(2)} ${(cy - side * 0.42).toFixed(2)} ${side.toFixed(2)} ${side.toFixed(2)}"><rect x="-999" y="-999" width="9999" height="9999" fill="#fffdf6"/>${b}</svg>`;
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ls.length * cell} ${cell * 1.5}" width="${ls.length * cell}" height="${cell * 1.5}"><rect width="100%" height="100%" fill="#f3efe4"/>${body}</svg>`;
}

describe('the meridians', () => {
  it('leaves a stem on the centre line straight, and bends one at the rim along the circle', () => {
    expect(meridianShift(0, -3, 20, 30).map(Math.abs)).toEqual([0, 0]);
    // at the rim: x0 = w(y0), and at every height it stands at w(y)
    const rho = 30,
      w = (y: number) => Math.sqrt(rho * rho - y * y);
    for (const y of [1, 10, 20, 29]) expect(w(4) + meridianShift(w(4), 4, y, rho)[0]).toBeCloseTo(w(Math.max(y, 4)), 9);
    // half way out it keeps half the width; at half strength it moves half as far
    expect(15 + meridianShift(15, 0, 18, rho)[0]).toBeCloseTo(w(18) / 2, 9);
    expect(meridianShift(15, 0, 18, rho, 0.5)[0]).toBeCloseTo(meridianShift(15, 0, 18, rho)[0] / 2, 9);
    // the redrawn stem: an alif risen by 12, its foot on the level diameter
    const l = lineOf('ا'),
      m = l.stems[0],
      z = l.b.strokes[m.si].s[m.cut + 1],
      drawn = (x0: number) => meridians(l.b, l.stems, [12], [{ ox: x0 - z.x, oy: -z.y, rho, k: 1, ease: 0 }]).rise[0][0].s, // prettier-ignore
      straight = raise(l.b, l.stems, [12])[m.si].s;
    // on the axis: as `raise` draws it (which has fewer samples on the shaft: the same line)
    drawn(0).forEach((q, i) => {
      if (i <= m.cut) expect([q.x, q.y]).toEqual([straight[i].x, straight[i].y].map(v => expect.closeTo(v, 9)));
      else expect(q.x - z.x - (q.y - z.y) * m.lean).toBeCloseTo(0, 2);
    });
    // at the rim the shaft's samples lie on the circle, the pen turned with it; the head rides the top
    const rim = drawn(rho).map(q => ({ ...q, x: q.x + rho - z.x, y: q.y - z.y })),
      shaft = rim.filter((_, i) => i > m.cut);
    expect(shaft.length).toBeGreaterThan(10);
    for (const q of shaft) {
      // (the stem keeps the lean it is written with, about three degrees: the rule's shift is added to it)
      expect(Math.hypot(q.x - m.lean * q.y, q.y)).toBeCloseTo(rho, 2);
      expect(q.rot!).toBeCloseTo(Math.atan(m.lean) - Math.atan(m.lean - q.y / w(q.y)), 6);
    }
    expect(rim[0].x).toBeLessThan(rho - 2);
  });
  it('mirrors a head about its stem: the mirrored outline, the pen mirrored with it', () => {
    const l = lineOf('ا'),
      m = l.stems[0],
      st = l.b.strokes[m.si],
      one = meridians(l.b, l.stems, [6], [{ ox: 0, oy: 0, rho: 40, k: 0, head: 'mirror' }]),
      head = one.heads[0].stroke,
      plain = meridians(l.b, l.stems, [6], [{ ox: 0, oy: 0, rho: 40, k: 0 }]).rise[0][0].s.slice(0, head.s.length),
      top = Math.max(...plain.map(q => q.y)),
      A = plain[Math.min(m.cut, plain.findIndex(q => q.y <= top - 4.2) - 1)],
      // a point mirrored about the stem's line through A
      mir = ([x, y]: Pt): Pt => {
        const t = ((x - A.x) * m.lean + (y - A.y)) / (m.lean * m.lean + 1);
        return [2 * (A.x + t * m.lean) - x, 2 * (A.y + t) - y];
      },
      want = th.strokePolys({ ang: st.ang, s: plain }).flat().map(mir),
      got = th.strokePolys(head).flat(),
      missing = (a: Pt[], b: Pt[]) => a.filter(([x, y]) => !b.some(v => Math.hypot(v[0] - x, v[1] - y) < 1e-6)).length;
    expect(one.heads).toHaveLength(1);
    expect(got.length).toBe(want.length);
    expect([missing(want, got as Pt[]), missing(got as Pt[], want)]).toEqual([0, 0]);
    // the serif is on the right as written, on the left mirrored; the foot and the join are as written
    const line = (q: { x: number; y: number }) => A.x + m.lean * (q.y - A.y);
    expect(plain[0].x).toBeGreaterThan(line(plain[0]));
    expect(head.s[0].x).toBeLessThan(line(head.s[0]));
    expect(one.strokes[m.si].s.slice(-5)).toEqual(st.s.slice(-5));
  });
  it.runIf(!!process.env.MERIDIAN)(
    'writes the sheets',
    () => {
      const out = process.env.MERIDIAN_OUT ?? join(import.meta.dirname, '../docs/meridian');
      mkdirSync(out, { recursive: true });
      const report: string[] = [],
        only = process.env.MERIDIAN_ONLY?.split(','),
        want = (name: string) => !only || only.includes(name),
        T = Object.fromEntries(TEXTS),
        f2 = (v: number) => v.toFixed(2),
        say = (tag: string, id: string, l: Drawn | null) => {
          if (!l) return void report.push(`${tag} ${id}: no arrangement`);
          const f = (l.factors ?? []).slice().sort((p, q) => p - q);
          report.push(
            `${tag} ${id}: radius ${l.R.toFixed(1)} (${(l.R / NIB).toFixed(1)} nibs); lines: ${l.lines.join(' / ')}` +
              (l.roof ? `; canopy: ${l.roof.what}; ${(l.roof.from - l.roof.to).toFixed(0)} degrees of rim` : '') +
              (l.arc ? `; cradle ${l.arc.toFixed(0)} degrees of rim` : '') +
              (l.stems ? `; stems ${l.stems}, risen ${f.length}${f.length ? `: x${f.map(f2).join(' x')}` : ''}` : '') +
              (l.note ? `; ${l.note}` : ''),
          );
        },
        row = (tag: string, ids: string[], hows: How[]) =>
          ids.flatMap(id =>
            hows.map((h, i) => {
              const l = make(T[id], h);
              say(`${tag} ${i + 1}`, id, l);
              return l;
            }),
          ),
        png = (name: string, rows: (Drawn | null)[][], cell = 600) =>
          writeFileSync(join(out, name), toPNG(sheetOf(rows, cell), Math.max(...rows.map(r => r.length)) * cell));
      if (want('strength')) {
        const hows = [0, 0.5, 0.75, 1].map(k => (k ? { ...CURVED, k } : STRAIGHT));
        png('meridian-strength.png', [row('strength', ['salawat'], hows), row('strength', ['basmala'], hows)]);
      }
      if (want('stops')) {
        const hows = [null, 0, 1.5, 3].map(inner => ({ ...CURVED, inner }));
        png('meridian-stops.png', [row('stops', ['salawat'], hows), row('stops', ['basmala'], hows)]);
      }
      if (want('name')) {
        const hows = (['curved', 'straight', 'body'] as const).map(name => ({ ...CURVED, name }));
        png('meridian-name.png', [row('name', ['basmala'], hows)], 800);
        png('meridian-name-salawat.png', [row('name', ['salawat'], hows)], 800);
        png('meridian-name-ikhlas.png', [row('name', ['ikhlas'], hows)], 800);
      }
      if (want('unrisen')) {
        const hows = [false, true].map(all => ({ ...CURVED, all }));
        png('meridian-unrisen.png', [row('unrisen', ['basmala'], hows), row('unrisen', ['salawat'], hows), row('unrisen', ['ikhlas'], hows)], 800); // prettier-ignore
      }
      if (want('serifs')) {
        const hows = (['none', 'out', 'in', 'all'] as const).map(serif => ({ ...CURVED, serif }));
        writeFileSync(join(out, 'meridian-serifs.png'), toPNG(headsSheet(row('serifs', ['salawat'], hows)), 2400));
        writeFileSync(join(out, 'meridian-serifs-basmala.png'), toPNG(headsSheet(row('serifs', ['basmala'], hows)), 2400)); // prettier-ignore
      }
      if (want('axis')) {
        // a stem on the axis: its head as written, mirrored, and drawn both ways (a symmetric head)
        const l = lineOf('ا'),
          ink = ([undefined, 'mirror', 'both'] as const).flatMap((head, i) => {
            const c = meridians(l.b, l.stems, [8], [{ ox: 0, oy: 0, rho: 40, k: 0, head }]);
            return [...c.strokes, ...c.heads.map(h => h.stroke)].flatMap(st => th.strokePolys(st)).map(q => q.map(([x, y]) => [x + i * 7 - 4, y - 8] as Pt)); // prettier-ignore
          });
        writeFileSync(join(out, 'meridian-axis.png'), toPNG(svgOf({ R: 13, polys: cleanOutline(ink) }), 900));
      }
      if (want('sheet')) {
        const ids = TEXTS.map(([id]) => id).filter(id => !process.env.MERIDIAN_TEXTS || process.env.MERIDIAN_TEXTS.split(',').includes(id)), // prettier-ignore
          rows = [STRAIGHT, CURVED, KEPT].map((h, i) => ids.map(id => {
            const l = make(T[id], h);
            say(['as it is now', 'curved stems', 'curved stems, serifs outward'][i], id, l);
            if (l) writeFileSync(join(out, `${['now', 'curved', 'kept'][i]}-${id}.png`), toPNG(svgOf(l), 1000));
            return l;
          })); // prettier-ignore
        png('meridian-sheet.png', rows, 480);
      }
      writeFileSync(join(out, 'numbers.txt'), report.join('\n') + '\n');
      expect(report.length).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
