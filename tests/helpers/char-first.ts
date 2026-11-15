// What the character-first experiments share (owner's experiments, 15 November 2026): the pen and the four texts; the
// cradle's letter, its take-over point and its great bowl (tests/char-bowl-sheet.test.ts); the colonnade's stems, found
// by geometry and redrawn taller (tests/char-stems-sheet.test.ts); and the ink measured on a grid. Each experiment's
// own file says what it does with them.
import { ROUNDEL_PEN, forms, isLetter, thuluth } from '../../src/script/thuluth';
import { CHOSEN } from '../../src/script/thuluth/alts';
import type { Built } from '../../src/script/thuluth/engine';
import { cleanOutline } from '../../src/script/thuluth/outline';
import { Alpha, toPixels } from '../../src/script/thuluth/raster';
import { allahSpan } from '../../src/script/thuluth/shape';
import type { Poly, Sample, Stroke } from '../../src/script/thuluth/types';

export const th = thuluth({ ...ROUNDEL_PEN, alts: CHOSEN, pieceGap: 0.45, wordSpace: 1.4 });
/** How the strokes are drawn. An arrangement is found with the strokes as rounds one to three drew them (a risen
 *  stem pieced out with a shaft of one weight, an arc drawn with the pen turned with its circle): every clearance
 *  and every circle is measured on those. It is then drawn once more, `fine`, with the strokes mended (round four:
 *  a risen stem one stroke, the arcs written with the fixed pen, an initial hah open). The mended strokes lie inside
 *  the strokes the layout was found with, so the layout does not move with the pen. */
export const STROKES = { fine: false };
/** What `f` draws, with the mended strokes. */
export function fine<T>(f: () => T): T {
  const was = STROKES.fine;
  STROKES.fine = true;
  try {
    return f();
  } finally {
    STROKES.fine = was;
  }
}
export const NIB = th.style.nib,
  TEXTS: [string, string][] = [
    ['names', 'محمد علي'],
    ['basmala', 'بسم الله الرحمن الرحيم'],
    ['salawat', 'اللهم صل على محمد وآل محمد'],
    ['ikhlas', 'قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له كفوا أحد'],
  ];

// ======== the cradle ========
// ---- 1. which letter ----
/** How well a final letter becomes a wide bowl. A nun is a bowl and nothing else; a ya's bowl follows a small head; a
 *  lam's hangs from a stem (which then stands at the bowl's end like a mast); qaf, sin and sad carry a head or teeth
 *  before it. A ra, zay or waw is a tail, not a bowl: it can be drawn out, but it is a last resort. A final mim, alif,
 *  dal, heh, kaf or ba has no bowl to draw out. */
export const BOWL: Record<string, number> = { ن: 1, ي: 0.95, ى: 0.95, ل: 0.9, ق: 0.85, س: 0.8, ش: 0.8, ص: 0.8, ض: 0.8, ر: 0.4, ز: 0.4, و: 0.4 }; // prettier-ignore
/** The bowl holds the words that follow its word, on one line: each costs this much (the cradle is the foot of the
 *  text, read last or nearly), and more than MAX_AFTER do not fit on the one line a bowl holds. */
const AFTER_COST = 0.12,
  MAX_AFTER = 3,
  /** A ya's bowl returns in every hand; the others return by the licence of the great roundels. */
  YA_BONUS = 0.1;
export interface Cradle {
  wi: number;
  c: string;
  score: number;
  why: string;
}
/** The cradle letter of a text, or null when no final letter qualifies (the text is then set on level lines). `not`:
 *  letters an arrangement cannot use (the one ground line passes over a letter whose ground line would be too long). */
export function cradleOf(text: string, not?: (wi: number) => boolean): Cradle | null {
  const words = text.split(' ');
  let best: Cradle | null = null;
  words.forEach((w, wi) => {
    const c = forms(w).pop()?.c ?? '',
      shape = BOWL[c],
      after = words.length - 1 - wi;
    if (!shape || after > MAX_AFTER || not?.(wi)) return;
    const score = shape + (c === 'ي' || c === 'ى' ? YA_BONUS : 0) - AFTER_COST * after,
      why = `the final ${c} of ${w}, word ${wi + 1} of ${words.length}: shape ${shape}, ${after} word${after === 1 ? '' : 's'} after it in the bowl`;
    // (a later word wins a tie)
    if (!best || score >= best.score) best = { wi, c, score, why };
  });
  return best;
}
/** The cradle word without its bowl: the stroke that carries on into the bowl, cut where the bowl is taken over
 *  (`pre`), that point and the pen's heading at it, and how many dots the letter has (they are set again beside the
 *  new bowl). */
export interface Head {
  pre: Sample[];
  ang: number;
  C: [number, number];
  u: [number, number];
  dots: number;
  /** The letter's dots that stay where they were written: their place in the line's list, and where they stand. */
  stay?: { k: number; x: number; y: number }[];
}
/** How far into the letter's last descent the bowl is taken over, in samples (14 to a span of the skeleton): the pen
 *  has just set off downward and to the left, and the letter's head above it is the engine's. */
export const DOTS_STAY = !process.env.WIDE_DOTSGO, // a dot written above the line stays where it was written, whatever becomes of its letter's bowl (owner, round two's grades: a nun's dot set in the great bowl is lost, and the nun with it)
  CUT_IN = 5,
  /** A dot sits over the kept part of its letter if it stands within this of that part's extent along the line. */
  DOT_OVER = 0.8;
/** A line whose last letter is written bowl first, turned round so that its bowl comes last (owner, round two, on a
 *  final jim as the cradle: "the final character seems wrong"). The engine writes a final or isolated jim, hah or
 *  khah from the line down round its bowl and up into its head (the bowl returns to meet the join); taken over where
 *  the stroke first leaves the line, the letter lost its head, and a stub and a bowl were left. Such a letter (its
 *  stroke starts at the line, goes down, and after its lowest point rises at least HEAD_OVER above the line) is
 *  made a stroke of its own, written from its head: roof, the slope back, and the bowl last, which `takeOver` then
 *  takes over where the slope crosses the line. Where the letter is joined, the join is drawn on along the line to
 *  that crossing, so the letter still hangs from its word: the bowl it was joined by is the one that is redrawn. */
const HEAD_OVER = 3;
export function bowlLast(b: Built): Built {
  const last = b.placed.filter(isLetter).pop();
  let si = -1;
  b.strokes.forEach((s, i) => {
    if (last && s.wi === last.wi && s.own?.includes(last.li)) si = i;
  });
  if (!last || si < 0) return b;
  const st = b.strokes[si],
    own = st.own!,
    n = st.s.length;
  let first = n - 1;
  while (first > 0 && own[first - 1] === last.li) first--;
  let low = first;
  for (let i = first; i < n; i++) if (st.s[i].y < st.s[low].y) low = i;
  let top = low;
  for (let i = low; i < n; i++) if (st.s[i].y > st.s[top].y) top = i;
  if (Math.abs(st.s[first].y - last.oy) > 1.5 || st.s[low].y > last.oy - 1 || st.s[top].y < last.oy + HEAD_OVER)
    return b;
  const mine = st.s.slice(first).reverse(),
    letter: Stroke = { ...st, s: mine, own: mine.map(() => last.li), raw: undefined },
    strokes = b.strokes.slice();
  if (first === 0) strokes[si] = letter;
  else {
    // the join, drawn on along the line to where the letter's slope comes down across it
    let cross = 0;
    for (let i = 0; i < mine.length && mine[i].y > st.s[low].y; i++) if (mine[i].y >= last.oy) cross = i;
    const J = st.s[first],
      X = mine[cross],
      steps = Math.max(1, Math.ceil(Math.hypot(X.x - J.x, X.y - J.y) / 0.3)),
      on: Sample[] = Array.from({ length: steps }, (_, i) => ({ x: J.x + ((X.x - J.x) * (i + 1)) / steps, y: J.y + ((X.y - J.y) * (i + 1)) / steps, w: J.w })), // prettier-ignore
      s = [...st.s.slice(0, first + 1), ...on];
    strokes[si] = { ...st, s, own: s.map((_, i) => own[Math.min(i, first - 1)]), raw: undefined };
    strokes.push(letter);
  }
  return { ...b, strokes };
}
/** Where the bowl of a written line's last letter is taken over: the stroke (its index) and the head. */
export function takeOver(b: Built, cutIn = CUT_IN): { si: number; head: Head } {
  const last = b.placed.filter(isLetter).pop()!;
  let si = -1;
  b.strokes.forEach((s, i) => {
    if (s.wi === last.wi && s.own?.includes(last.li)) si = i;
  });
  const st = b.strokes[si],
    own = st.own!,
    n = st.s.length;
  let first = n - 1;
  while (first > 0 && own[first - 1] === last.li) first--;
  let low = first;
  for (let i = first; i < n; i++) if (st.s[i].y < st.s[low].y) low = i;
  // the bowl begins where the stroke last leaves the line of writing on its way down
  let i0 = first;
  for (let i = first; i < low; i++) if (st.s[i].y >= 0) i0 = i;
  let cut = Math.max(1, Math.min(low, i0 + cutIn));
  // (a ya first hooks to the right: it is taken over once it has turned back)
  while (cut < low && st.s[cut].x >= st.s[cut - 1].x) cut++;
  const ux = st.s[cut].x - st.s[cut - 1].x,
    uy = st.s[cut].y - st.s[cut - 1].y,
    ul = Math.hypot(ux, uy),
    pre = st.s.slice(0, cut + 1);
  // the last letter's dots are the last in the list. A dot belongs to the part of the letter it sat over as written:
  // dots over (or under) the bowl that is redrawn go with it (a nun's, a ya's, a jim's); dots over the head that is
  // kept (a qaf's, a dad's, a shin's, a khah's: above the line, over what is written of the letter before the bowl is
  // taken over) stay where they are
  let mine = 0,
    k0 = Infinity,
    k1 = -Infinity;
  b.strokes.forEach((o, i) => {
    if (o.wi !== last.wi || !o.own) return;
    o.s.forEach((q, j) => {
      if (o.own![Math.min(j, o.own!.length - 1)] !== last.li || (i === si && j > cut)) return;
      k0 = Math.min(k0, q.x);
      k1 = Math.max(k1, q.x);
    });
  });
  const stay: NonNullable<Head['stay']> = [];
  let at = 0;
  for (const g of b.dotGroups) {
    if (g.li === last.li && g.wi === last.wi) {
      if (!(g.side > 0 && (DOTS_STAY || (g.x > k0 - DOT_OVER && g.x < k1 + DOT_OVER)))) mine += g.n;
      else for (let j = 0; j < g.n; j++) stay.push({ k: at + j, x: b.dots[at + j][0], y: b.dots[at + j][1] });
    }
    at += g.n;
  }
  return { si, head: { pre, ang: st.ang, C: [st.s[cut].x, st.s[cut].y], u: [ux / ul, uy / ul], dots: mine, stay } };
}

// ---- 2. how it is drawn ----
/** The great bowl, redrawn: from the point C where it is taken over, the pen comes down in one curve to the rim, runs
 *  along it at a constant distance (a circle of radius `rho` about the centre), and ends in a tip that lifts a little
 *  off the rim as it thins. The pen turns with the rim, so the floor has one weight from end to end. Worked out for a
 *  bowl that runs to the left (angles from the bottom of the circle, positive to the right); the caller mirrors it. */
export const LAND_MIN = 8, // (and never less than this)
  LAND = 1.4, // the pen comes down to the rim over this much of the rim, times how far from the rim it starts
  TIP_LEN = 9, // the last stretch of the bowl, where it thins,
  TIP_RISE = 1.4, // how far it lifts off the rim there,
  TIP_W = 0.06, // and the share of the pen's width it ends at
  LIGHT = !process.env.WIDE_HEAVY, // arcs scaled to the circle:
  LIGHT_R = 9 * NIB, // a stroke on a circle smaller than this (9 nibs) is drawn lighter, its weight as its radius to this,
  LIGHT_MIN = 0.55, // and never lighter than this share of the pen
  TURN_BY = 0.6, // the pen has turned to the rim's direction by this share of the way down to it
  STEP = 0.14;
/** A point of the bowl, and how far the pen has turned to the rim's by then (0 to 1). */
export type Swept = { x: number; y: number; w: number; on: number; /** Still on the way down to the rim. */ down?: boolean }; // prettier-ignore
export function sweep(
  C: [number, number],
  u: [number, number],
  wC: number,
  rho: number,
  end: (phi0: number) => number,
  /** The neck mended (crown and cradle): the pen has its full weight and has turned to the rim's direction within
   *  this length of the bowl's start, not over the whole way down. */
  neck?: number,
) {
  const rC = Math.hypot(C[0], C[1]),
    drop = rho - rC,
    // (on a small circle the stroke is drawn with a lighter pen: its weight goes with its circle's radius)
    full = LIGHT ? Math.min(1, Math.max(LIGHT_MIN, rho / LIGHT_R)) : 1;
  if (drop < 0.6) return null;
  const phi0 = Math.atan2(C[0], -C[1]) - Math.max(LAND * drop, LAND_MIN) / rho,
    phiEnd = end(phi0);
  if (phi0 - phiEnd < (TIP_LEN * 1.6) / rho) return null;
  const A: [number, number] = [rho * Math.sin(phi0), -rho * Math.cos(phi0)],
    t0: [number, number] = [-Math.cos(phi0), -Math.sin(phi0)],
    L = Math.hypot(A[0] - C[0], A[1] - C[1]),
    s: Swept[] = [],
    N = Math.max(4, Math.ceil(L / STEP));
  for (let k = 1; k <= N; k++) {
    const t = k / N,
      t2 = t * t,
      t3 = t2 * t,
      a = 2 * t3 - 3 * t2 + 1,
      b = t3 - 2 * t2 + t,
      c = -2 * t3 + 3 * t2,
      d = t3 - t2,
      e = Math.min(1, neck ? (t * L) / neck : t / TURN_BY),
      ease = e * e * (3 - 2 * e);
    s.push({
      x: a * C[0] + b * L * u[0] + c * A[0] + d * L * t0[0],
      y: a * C[1] + b * L * u[1] + c * A[1] + d * L * t0[1],
      w: wC + (full - wC) * (neck ? e : t),
      on: ease,
      down: k < N,
    });
  }
  for (let phi = phi0 - STEP / rho; phi > phiEnd; phi -= STEP / rho) {
    const left = (phi - phiEnd) * rho,
      v = left < TIP_LEN ? 1 - left / TIP_LEN : 0,
      r = rho - TIP_RISE * v * v;
    s.push({ x: r * Math.sin(phi), y: -r * Math.cos(phi), w: full * (1 - (1 - TIP_W) * v * v), on: 1 });
  }
  return { s, phi0, phiEnd };
}
/** The bowl's samples, mirrored back to run from its letter (`swept` is a sweep's, which runs to the left), with the
 *  pen's turn at each. */
export const FIXED_PEN = !process.env.WIDE_TURNED, // WIDE_TURNED=1: every arc drawn with the pen turned with the rim, as rounds one to three drew them
  EVEN_OVER = 0.15;
/** The pen's weight on a circle of radius rho (to the pen's middle), with no threshold (owner, round three: arcs just
 *  over 9 nibs still look heavy): v / (1 + v^4)^(1/4), v the radius over LIGHT_R, never under LIGHT_MIN. It is the
 *  radius over 9 nibs on a small circle and the full pen on a large one, as before, and passes from the one to the
 *  other without a corner: 0.84 at 9 nibs, 0.93 at 12, 0.97 at 15. It is never more than the weight the layout was
 *  found with (the radius over 9 nibs, at most 1). */
export const lighter = (rho: number) => {
  const v = rho / LIGHT_R;
  return Math.max(LIGHT_MIN, v / (1 + v ** 4) ** 0.25);
};
export function bowlPen(head: Head, swept: readonly Swept[], turned = !FIXED_PEN || !STROKES.fine): Sample[] {
  // The pen. On the rim it is the line's own pen (whatever pen drew the letter's head: a lam's stem has a flatter
  // one), turned with the rim, so the floor has one weight. On the way down to the rim, the angle between the pen
  // and the way it is going passes evenly from what it is where the bowl is taken over to what it is on the rim,
  // and by the way that never lays the pen along the stroke: the stroke swells into the bowl and never pinches.
  const deg = Math.PI / 180,
    pts = swept.map(q => ({ ...q, x: -q.x })),
    going = (i: number) => {
      const a = pts[Math.max(0, i - 1)],
        b = pts[Math.min(pts.length - 1, i + 1)];
      return Math.atan2(b.y - a.y, b.x - a.x);
    },
    wrap = (a: number) => a - Math.PI * Math.round(a / Math.PI), // into (-90, 90] degrees: a nib has no front
    d0 = wrap(Math.atan2(head.u[1], head.u[0]) - head.ang * deg),
    d1 = d0 >= 0 ? Math.PI - th.style.ang * deg : -th.style.ang * deg;
  let before = 0;
  if (turned)
    return pts.map((q, i) => {
      // (each turn of the nib is taken the short way from the one before, so the pen never flips between samples)
      let rot = going(i) - (d0 + (d1 - d0) * q.on) - head.ang * deg;
      rot -= Math.PI * Math.round((rot - before) / Math.PI);
      before = rot;
      return { x: q.x, y: q.y, w: q.w, rot };
    });
  // The fixed pen (owner, round three: the arcs "are drawn with a pen that does not thin and swell like a real
  // stroke"). The nib is not turned with the rim: it is held at the line's own angle all the way round, as it is for
  // every other stroke, so the arc thins and swells of itself (its hairline where the rim runs along the nib, near
  // 3:40 and 9:40 on the clock; its full weight a quarter turn from there). A stroke begun with another pen (a
  // stem's, flatter) comes to the line's pen as it turns: by the share of its way round to the rim's direction that
  // the stroke has gone, so the weight passes evenly from the stem's to the arc's, with no swelling and no waist at
  // the shoulder. The arc is never drawn heavier than the turned pen drew it: where the fixed nib would lie more
  // squarely across the stroke, it is lightened to that, so the arc stays inside the stroke the layout was found
  // with.
  const a0 = head.ang * deg,
    a1 = a0 + wrap(th.style.ang * deg - a0),
    heading: number[] = [];
  pts.forEach((_, i) => {
    const g = going(i);
    heading.push(i ? g - 2 * Math.PI * Math.round((g - heading[i - 1]) / (2 * Math.PI)) : g);
  });
  const landed = Math.max(
      0,
      pts.findIndex(q => !q.down),
    ),
    round = heading[landed] - heading[0],
    // (the lighter pen of a smaller circle, with no threshold: see `lighter`)
    rho = Math.hypot(pts[landed].x, pts[landed].y),
    light = LIGHT ? lighter(rho) / Math.min(1, Math.max(LIGHT_MIN, rho / LIGHT_R)) : 1,
    w0 = pts[0].w,
    wL = pts[landed].w * light;
  let by = 0;
  const pens = pts.map((q, i) => {
      by =
        i >= landed ? 1 : Math.abs(round) < 1e-3 ? q.on : Math.max(by, Math.min(1, (heading[i] - heading[0]) / round));
      return a0 + (a1 - a0) * by;
    }),
    // (how squarely the nib lies across the stroke: the fixed pen's, and the turned pen's)
    across = pts.map((_, i) => Math.max(1e-6, Math.abs(Math.sin(pens[i] - heading[i])))),
    was = pts.map(q => Math.abs(Math.sin(d0 + (d1 - d0) * q.on))),
    turns = Math.abs(a1 - a0) > 1e-3,
    t0 = w0 * across[0],
    tL = wL * Math.min(across[landed], was[landed]);
  return pts.map((q, i) => {
    // (never heavier than the turned pen drew it: where the fixed nib lies more squarely across the stroke, lighter)
    const held = Math.min(1, was[i] / across[i]);
    let w = q.w * light * held;
    if (i < landed) {
      // On the way to the rim the pen's weight passes from the letter's to the arc's evenly over the whole way, not
      // within the neck: a stem that becomes an arc on a small circle, drawn with a lighter pen, has no step in it.
      // Where the pen turns as well (a stem's), it is the stroke's thickness that passes evenly, from the stem's to
      // the arc's. There the stroke may be a little heavier than the turned pen drew it: by EVEN_OVER of the pen at
      // the most, under a tenth of a pen unit to a side.
      const share = i / landed;
      w = Math.min(
        turns ? (t0 + (tL - t0) * share) / across[i] : (w0 + (wL - w0) * share) * held,
        (q.w + EVEN_OVER) * held,
      );
    }
    return { x: q.x, y: q.y, w, rot: pens[i] - a0 };
  });
}

// ---- 3. the cradle as first tried: level lines, and the bowl under them ----
export const MARGIN = 0.9 * NIB, // between the ink and the circle, as the level lines keep
  UP = 10, // how far a line's tall strokes rise above it, and
  DOWN = 6, // how far its tails fall below it, when judging how much of a line lies inside
  /** How thick the pen draws the bowl's floor: the nib held at its angle to a stroke that runs along the rim. */
  FLOOR = NIB * Math.sin((th.style.ang * Math.PI) / 180);

// ---- dots that touch a stroke (owner, round two's grades: a dot that merges with a stroke is a letter lost) ----
/** A line as written, with every group of dots that touches a stroke moved clear of it: the least move, straight
 *  away from the line of writing or along it (DOT_MOVES, nearest first), that leaves DOT_AIR between its dots and
 *  every stroke. The group moves whole: three dots stay a pyramid. A group that touches nothing is not moved. */
const DOT_AIR = 0.12 * NIB,
  DOT_MOVES: [number, number][] = [[0, 0], [0, 0.5], [0.5, 0], [-0.5, 0], [0, 1], [0.7, 0.7], [-0.7, 0.7], [1, 0], [-1, 0], [0, 1.5], [1.5, 0], [-1.5, 0], [0, 2], [1.4, 1.4], [-1.4, 1.4]], // prettier-ignore
  MEND = !process.env.WIDE_NOMEND;
export function mendDots(b: Built): Built {
  if (!MEND || !b.dots.length) return b;
  const ink = b.strokes.flatMap(st => th.strokePolys(st)),
    touches = (x: number, y: number) => {
      const near = ink.filter(q => q.some(v => Math.abs(v[0] - x) < 4 && Math.abs(v[1] - y) < 4));
      return (
        near.length > 0 &&
        nearPairs([near.map(q => q.map(([vx, vy]) => [vx - x, vy - y] as [number, number])), th.dotPolysAt(0, 0)], 5, DOT_AIR, 8).length > 0 // prettier-ignore
      );
    },
    dots = b.dots.map(d => d.slice() as (typeof b.dots)[number]),
    groups = b.dotGroups.map(g => ({ ...g }));
  let at = 0,
    moved = false;
  for (const g of groups) {
    const mine = dots.slice(at, at + g.n),
      up = g.side < 0 ? -1 : 1;
    for (const [mx, my] of DOT_MOVES) {
      if (mine.some(d => touches(d[0] + mx, d[1] + up * my))) continue;
      if (mx || my) {
        for (const d of mine) {
          d[0] += mx;
          d[1] += up * my;
        }
        g.x += mx;
        g.y += up * my;
        moved = true;
      }
      break;
    }
    at += g.n;
  }
  return moved ? { ...b, dots, dotGroups: groups } : b;
}

// ---- a level line as the engine writes it ----
const inkOf = (b: Pick<Built, 'strokes' | 'dots'>): Poly[] => [
  ...b.strokes.flatMap(s => th.strokePolys(s)),
  ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y)),
];
const moved = (ps: Poly[], dx: number, dy: number): Poly[] => ps.map(q => q.map(([x, y]) => [x + dx, y + dy]));
/** A line's ink, its extent along the line, and, for a line that ends in the cradle word, where its bowl is taken
 *  over. */
interface Line {
  ink: Poly[];
  x0: number;
  x1: number;
  head?: Head;
}
const lines = new Map<string, Line>();
function lineOf(text: string, cradle = false): Line {
  const key = (cradle ? '*' : '') + text;
  let l = lines.get(key);
  if (l) return l;
  const b = cradle ? bowlLast(mendDots(th.buildStrokes(text, {}))) : mendDots(th.buildStrokes(text, {}));
  if (!cradle) {
    const ink = inkOf(b),
      xs = ink.flat().map(p => p[0]);
    l = { ink, x0: Math.min(...xs), x1: Math.max(...xs) };
  } else {
    const { si, head } = takeOver(b),
      st = b.strokes[si],
      ink = [
        ...b.strokes.filter((_, i) => i !== si).flatMap(s => th.strokePolys(s)),
        ...th.strokePolys({ ...st, s: head.pre }),
        ...b.dots.slice(0, b.dots.length - head.dots).flatMap(([x, y]) => th.dotPolysAt(x, y)),
      ],
      xs = ink.flat().map(p => p[0]);
    l = { ink, x0: Math.min(...xs), x1: Math.max(...xs), head };
  }
  lines.set(key, l);
  return l;
}

// ---- 3. what goes inside ----
/** How long a level stretch, centred on the axis, lies inside: its tall strokes within `Rt`, its tails within `Rb`. */
function chord(h: number, Rt: number, Rb: number) {
  const a = Rt * Rt - (h + UP) ** 2,
    b = Rb * Rb - (h - DOWN) ** 2,
    c = Rt * Rt - h * h;
  return a <= 0 || b <= 0 || c <= 0 ? 0 : 2 * Math.sqrt(Math.min(a, b, c));
}
export type Span = 'even' | 'long' | 'short';
export interface CradleOptions {
  cradle?: boolean;
  /** Where the bowl ends: as high on the right as it lands on the left (the default), far up the rim, or just past
   *  the line it holds. */
  span?: Span;
  /** The ink above the level diameter keeps this much further from the circle: a canopy runs along the rim there
   *  (tests/char-canopy-sheet.test.ts). */
  roof?: number;
  /** The bottom line keeps this much further from the bowl's floor: a sub-cradle runs along it there
   *  (tests/char-nested-sheet.test.ts). */
  floor?: number;
}
export interface CradleLaid {
  R: number;
  lines: string[];
  polys: Poly[];
  cradle: Cradle | null;
  /** The bowl's width as a share of the circle's diameter, and the angle of rim it follows (degrees). */
  span: number;
  arc: number;
  /** Where the bowl lands on the left and ends on the right (radians from the bottom, positive to the left). */
  ends: [number, number];
  /** The lines in the bowl, after the cradle word's own. */
  inside: number;
  /** Line by line: its ink (the bowl with the cradle word's line) and the height of its baseline. */
  pieces: Poly[][];
  hs: number[];
}
/** Between the bowl's floor and the ink it holds, at the least (the raster check is what decides). */
export const CLEAR = 0.3 * NIB,
  /** The furthest up the rim a bowl ends (radians from the bottom). */
  SPAN_MAX = 1.4,
  /** How far above its lowest place the bottom line may be lifted to make a smaller circle. */
  LIFTS = [0, 1, 2, 3.5, 5, 7, 9],
  /** Arrangements whose bowls land within this much of each other on the rim count as equally long, */
  LAND_STEP = 0.2,
  /** A bowl that lands this far up the rim (radians from the bottom) is long enough: no more is sought. */
  LAND_ENOUGH = 1.0,
  /** and a longer bowl is worth a circle this much larger than the smallest. */
  LARGER = 1.08,
  K = 4; // raster cells to a pen unit
interface Try {
  /** How far up the left rim the bowl lands (radians from the bottom), in steps of LAND_STEP: the longer bowl. */
  land: number;
  full: number;
  cut: [number, number][];
  hs: number[];
}
const composed = new Map<string, CradleLaid | null>();
/** (The same text with the same options and the same table of bowls is composed once.) */
export function cradleCompose(text: string, o: CradleOptions = {}): CradleLaid | null {
  const key = JSON.stringify([text, o.cradle, o.span, o.roof, o.floor, BOWL]);
  if (!composed.has(key)) composed.set(key, cradleCompose1(text, o));
  return composed.get(key)!;
}
function cradleCompose1(text: string, o: CradleOptions): CradleLaid | null {
  const words = text.split(' '),
    n = words.length,
    cr = o.cradle === false ? null : cradleOf(text),
    roof = o.roof ?? 0,
    ci = cr ? cr.wi : -1,
    // (each stretch of words is written once, and its hull kept: a line is inside a circle when its hull is)
    spans = new Map<number, Line & { hull: Pt[]; w: number }>(),
    span = (a: number, b: number) => {
      let l = spans.get(a * 256 + b);
      if (!l) {
        const q = lineOf(words.slice(a, b).join(' '), b - 1 === ci);
        spans.set(a * 256 + b, (l = { ...q, hull: hull(q.ink.flat() as Pt[]), w: q.x1 - q.x0 }));
      }
      return l;
    },
    width = (a: number, b: number) => span(a, b).w;
  /** Draw one arrangement and say whether it stands: 'pitch' when two lines touch, 'bowl' when the bowl cannot be
   *  drawn, leaves the circle or touches what it holds. */
  const draw = (t: Try, R: number): CradleLaid | 'pitch' | 'bowl' => {
    const Rt = R - MARGIN,
      rho = Rt - FLOOR / 2 - 0.05,
      pieces: Poly[][] = t.cut.map(([a, b], i) => {
        const l = span(a, b);
        return moved(l.ink, -(l.x0 + l.x1) / 2, t.hs[i]);
      }),
      said = t.cut.map(([a, b]) => words.slice(a, b).join(' '));
    if (Math.max(...pieces.flat(2).map(([x, y]) => Math.hypot(x, y) + (y > 0 ? roof : 0))) > Rt + 1e-6) return 'bowl';
    const hit = touching(pieces, R, false);
    if (hit) return hit;
    if (!cr) {
      const outs = pieces.map(k => cleanOutline(k));
      return {
        R,
        lines: said,
        polys: outs.flat(),
        cradle: cr,
        span: 0,
        arc: 0,
        ends: [0, 0],
        inside: 0,
        pieces: outs,
        hs: t.hs,
      };
    }
    const k = t.cut.findIndex(([, b]) => b - 1 === ci),
      l = span(...t.cut[k]),
      head = l.head!,
      dx = -(l.x0 + l.x1) / 2,
      hc = t.hs[k],
      last = span(...t.cut[t.cut.length - 1]),
      // (the bowl is worked out running to the left, so everything is mirrored into that and back)
      C: [number, number] = [-(head.C[0] + dx), head.C[1] + hc],
      end = (phi0: number) =>
        o.span === 'long'
          ? -SPAN_MAX
          : o.span === 'short'
            ? -Math.asin(Math.min(0.95, ((last.x1 - last.x0) / 2 + 2 * NIB) / rho))
            : -Math.min(SPAN_MAX, Math.max(phi0, 0.5)),
      bowl = sweep(C, [-head.u[0], head.u[1]], head.pre[head.pre.length - 1].w, rho, end);
    if (!bowl) return 'bowl';
    const s: Sample[] = [...head.pre.map(q => ({ ...q, x: q.x + dx, y: q.y + hc })), ...bowlPen(head, bowl.s)],
      // the letter's dots: in the bowl where it begins, along the floor
      rd = rho - FLOOR / 2 - 1.25 * NIB,
      dots = Array.from({ length: head.dots }, (_, i) => {
        const phi =
          k === t.cut.length - 1
            ? (((head.dots - 1) / 2 - i) * 1.2 * NIB) / rd
            : bowl.phi0 - (2.2 * NIB + i * 1.2 * NIB) / rd;
        return th.dotPolysAt(-rd * Math.sin(phi), -rd * Math.cos(phi), 1, -phi);
      }).flat(),
      // (for the check the bowl is a piece of its own, from two nibs past where it leaves its letter)
      free = [...th.strokePolys({ ang: head.ang, s: s.slice(head.pre.length + Math.ceil((2 * NIB) / STEP)) }), ...dots];
    if (Math.max(...free.flat().map(([x, y]) => Math.hypot(x, y))) > Rt + 1e-6) return 'bowl';
    if (touching([...pieces, free], R, true)) return 'bowl';
    pieces[k] = [...pieces[k], ...th.strokePolys({ ang: head.ang, s }), ...dots];
    const bx = bowl.s.map(q => q.x),
      outs = pieces.map(p => cleanOutline(p));
    return {
      R,
      lines: said,
      polys: outs.flat(),
      pieces: outs,
      hs: t.hs,
      cradle: cr,
      span: (Math.max(...bx) - Math.min(...bx)) / (2 * R),
      arc: ((bowl.phi0 - bowl.phiEnd) * 180) / Math.PI,
      ends: [bowl.phi0, bowl.phiEnd],
      inside: t.cut.length - 1 - k,
    };
  };
  let found: (CradleLaid & { land: number }) | null = null;
  for (let pitch = 15.5; pitch < 24 && !found; pitch *= 1.06)
    radius: for (let R = 12; R < 170; R *= 1.02) {
      if (found && R > found.R * LARGER) break;
      const Rt = R - MARGIN,
        Rb = cr ? Rt - FLOOR - CLEAR - (o.floor ?? 0) : Rt,
        tries: Try[] = [];
      for (const lift of cr ? LIFTS : [0]) {
        let best: Try | null = null;
        // the bottom line is words k to the end
        for (let k = cr ? (ci === n - 1 ? 0 : ci + 1) : 0; k < n; k++) {
          // with a cradle, the bottom line sits as low as its ink lets it: just clear of the floor
          let hb = 0;
          if (cr) {
            const l = span(k, n),
              mid = (l.x0 + l.x1) / 2;
            hb = -Infinity;
            for (const [x, y] of l.hull)
              hb = Math.max(hb, Math.abs(x - mid) < Rb ? -Math.sqrt(Rb * Rb - (x - mid) ** 2) - y : Infinity);
            hb += lift;
            if (hb === Infinity) continue;
          }
          // the words before it, on m lines above; the cradle word ends a line
          for (let m = k ? 1 : 0; m <= Math.min(k, 6); m++) {
            const hs = Array.from({ length: m + 1 }, (_, i) => (cr ? hb + (m - i) * pitch : (m / 2 - i) * pitch - 2)),
              rooms = hs.map((h, i) => chord(h, Rt - (h + UP > 0 ? roof : 0), cr && i === m ? Rb : Rt));
            if (rooms.some(r => r <= 0)) continue;
            const full = Array.from({ length: m + 1 }, () => new Array<number>(k + 1).fill(Infinity)),
              from = Array.from({ length: m + 1 }, () => new Array<number>(k + 1).fill(-1));
            full[0][0] = 0;
            for (let i = 1; i <= m; i++)
              for (let b = i; b <= k; b++)
                for (let a = i - 1; a < b; a++) {
                  if (a <= ci && ci < b - 1) continue;
                  const f = Math.max(full[i - 1][a], width(a, b) / rooms[i - 1]);
                  if (f < full[i][b]) {
                    full[i][b] = f;
                    from[i][b] = a;
                  }
                }
            const f = Math.max(full[m][k], width(k, n) / rooms[m]);
            // where the bowl would land: the cradle word's line, wide and high, starts it far up the rim
            let land = 0;
            if (cr && f <= 1) {
              const b = k > ci ? ci + 1 : n;
              let aa = k,
                row = m;
              if (k > ci)
                for (let i = m, bb = k; i > 0; bb = from[i][bb], i--)
                  if (bb === ci + 1) {
                    aa = from[i][bb];
                    row = i - 1;
                    break;
                  }
              const l = span(aa, b),
                cx = l.head!.C[0] - (l.x0 + l.x1) / 2,
                cy = l.head!.C[1] + hs[row],
                rho = Rt - FLOOR / 2;
              land = Math.round(
                Math.min(LAND_ENOUGH, Math.atan2(-cx, -cy) - (LAND * (rho - Math.hypot(cx, cy))) / rho) / LAND_STEP,
              );
            }
            if (f <= 1 && (!best || land > best.land || (land === best.land && f < best.full))) {
              const cut: [number, number][] = [[k, n]];
              for (let i = m, b = k; i > 0; i--) {
                cut.unshift([from[i][b], b]);
                b = from[i][b];
              }
              best = { land, full: f, cut, hs };
            }
          }
        }
        if (best) tries.push(best);
      }
      // the lowest that stands is taken: the bowl is no deeper than it has to be
      let tight = tries.length > 0;
      tries.sort((p, q) => q.land - p.land);
      for (const t of tries) {
        if (found && t.land <= found.land) break;
        const l = draw(t, R);
        if (typeof l !== 'string') {
          if (!cr) return l;
          found = { ...l, land: t.land };
          break;
        }
        if (l === 'bowl') tight = false;
      }
      // two lines touch however the bottom line sits: a wider pitch
      if (tight && !found) break radius;
    }
  return found;
}
/** Whether any two pieces come within 0.3 of a nib of each other: each piece's ink, grown by a cell (0.16 of a nib),
 *  must not meet another's. With `bowl`, only the last piece (the bowl) is asked about. */
function touching(pieces: Poly[][], R: number, bowl: boolean): 'pitch' | null {
  const W = Math.ceil(2 * R * K),
    X = (x: number) => (x + R) * K,
    Y = (y: number) => (R - y) * K,
    seen = new Int8Array(W * W).fill(-1);
  for (let p = 0; p < pieces.length; p++) {
    const A = new Alpha(W, W);
    A.fill(toPixels(pieces[p], X, Y));
    for (let y = 1; y < W - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        if (A.a[y * W + x] <= 127) continue;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const i = (y + dy) * W + x + dx,
              q = seen[i];
            if (q >= 0 && q !== p && (!bowl || p === pieces.length - 1)) return 'pitch';
            if (q < 0) seen[i] = p;
          }
      }
  }
  return null;
}
/** The drawing: black on a light disc. */
export const discOf = (l: { R: number; polys: Poly[] }) => {
  const R = l.R,
    pad = 2,
    d = l.polys.map(q => 'M' + q.map(([x, y]) => `${(x + R + pad).toFixed(2)} ${(R + pad - y).toFixed(2)}`).join('L') + 'Z').join(''); // prettier-ignore
  return { S: 2 * (R + pad), body: `<circle cx="${R + pad}" cy="${R + pad}" r="${R}" fill="#fffdf6" stroke="#b9a76a" stroke-width="${(R * 0.03).toFixed(2)}"/><path d="${d}" fill="#1a1a1a" fill-rule="nonzero"/>` }; // prettier-ignore
};
export const svgOf = (l: { R: number; polys: Poly[] }) => {
  const { S, body } = discOf(l);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="900" height="900"><rect width="100%" height="100%" fill="#f3efe4"/>${body}</svg>`;
};
/** Rows of discs, each drawn to the same size. */
export const sheetOf = (rows: ({ R: number; polys: Poly[] } | null)[][], cell = 480) => {
  const cols = Math.max(...rows.map(r => r.length));
  let body = '';
  rows.forEach((row, j) =>
    row.forEach((l, i) => {
      if (!l) return;
      const { S, body: b } = discOf(l);
      body += `<g transform="translate(${i * cell} ${j * cell}) scale(${(cell / S).toFixed(4)})">${b}</g>`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * cell} ${rows.length * cell}" width="${cols * cell}" height="${rows.length * cell}"><rect width="100%" height="100%" fill="#f3efe4"/>${body}</svg>`;
};

// ======== the colonnade ========
// ---- the numbers the stems are found and measured by (pen units) ----
export const CELL = 0.2, // the grid the ink is measured on
  LINE_SPACE = 0.55 * NIB, // between the inks of neighbouring lines (baselines-first)
  STEM_RUN = 4.5, // a stem is a near-upright run of a stroke at least this long...
  STEM_TOP = 6, // ...whose top stands at least this far above its line
  UPRIGHT = 0.2, // near-upright: no more than this much sideways for each unit of rise
  SPLIT = 3, // a stem is never cut lower than this above its line: the body of the letters is below
  FULL = 0.985, // the shaft is where the pen has this share of its full weight
  CAP = 3; // a stem is drawn no taller than this many times its height as written

// ---- 1. finding the stems, and 2. redrawing one taller ----
export interface Stem {
  /** The stroke, and the last sample of its head side: samples 0..cut rise (a stem is written from its top). */
  si: number;
  cut: number;
  /** The word it belongs to, and whether that word is the name of God (whose stems rise together). */
  wi: number;
  name: boolean;
  /** Where the shaft stands at the split, its direction there (sideways for each unit of rise), and its line. */
  x: number;
  y: number;
  lean: number;
  base: number;
  /** The top of its ink as written, above its line. */
  top: number;
  /** Other strokes that ride with its head: marks above it (the shadda of the name) and strokes of its own letter
   *  that lie wholly above the split (the shoulder of a kaf). */
  riders: number[];
}
/** The tall stems of a written line, by their geometry: a run of a letter's stroke, near upright, at least STEM_RUN
 *  long, whose top is at least STEM_TOP above the line. The split is the lowest point of the run where the pen still
 *  has its full weight, and never lower than SPLIT. */
export function findStems(b: Built, text: string): Stem[] {
  const words = text.trim().split(/\s+/),
    letters = b.placed.filter(isLetter),
    out: Stem[] = [];
  b.strokes.forEach((st, si) => {
    if (!st.own || st.nib) return;
    const s = st.s;
    // the longest near-upright run, written downwards
    let best: [number, number] | null = null;
    for (let i = 0; i + 1 < s.length;) {
      let j = i;
      // (a spline may waver by a hair where two of its points stand close: that does not end a run)
      while (j + 1 < s.length && s[j].y - s[j + 1].y > -0.02 && Math.abs(s[j + 1].x - s[j].x) <= UPRIGHT * Math.abs(s[j].y - s[j + 1].y) + 0.02) j++; // prettier-ignore
      if (j > i && (!best || s[i].y - s[j].y > s[best[0]].y - s[best[1]].y)) best = [i, j];
      i = Math.max(j, i + 1);
    }
    if (!best) return;
    const [i0, i1] = best,
      li = st.own[Math.min(i0 + 1, st.own.length - 1)],
      letter = letters.find(p => p.wi === st.wi && p.li === li),
      base = letter?.oy ?? 0;
    if (s[i0].y - s[i1].y < STEM_RUN || s[i0].y - base < STEM_TOP) return;
    let wmax = 0;
    for (let i = i0; i <= i1; i++) wmax = Math.max(wmax, s[i].w);
    let cut = -1;
    for (let i = i0 + 2; i < i1; i++) if (s[i].w >= FULL * Math.min(1, wmax) && s[i].y >= base + SPLIT) cut = i;
    if (cut < 0) return;
    const k = Math.max(i0, cut - 4),
      top =
        Math.max(
          ...th
            .strokePolys(st)
            .flat()
            .map(p => p[1]),
        ) - base;
    out.push({ si, cut, wi: st.wi ?? 0, name: !!allahSpan(words[st.wi ?? 0] ?? ''), x: s[cut].x, y: s[cut].y, lean: (s[k].x - s[cut].x) / (s[k].y - s[cut].y), base, top, riders: [] }); // prettier-ignore
  });
  // what rides with a head: a mark over it, or another stroke of its letter that lies wholly above the split
  b.strokes.forEach((st, si) => {
    if (out.some(m => m.si === si)) return;
    const ys = st.s.map(q => q.y),
      xm = st.s.reduce((t, q) => t + q.x, 0) / st.s.length,
      lo = Math.min(...ys);
    let near: Stem | null = null;
    for (const m of out) {
      const dx = Math.abs(xm - (m.x + m.lean * (lo - m.y)));
      if (lo < m.y || dx > (st.nib ? 1.6 : 2.6)) continue;
      // (a letter's own stroke: of the same word, and joined to the stem's top)
      if (!st.nib && (st.wi !== m.wi || lo < m.base + m.top - 2.5)) continue;
      if (!near || dx < Math.abs(xm - near.x)) near = m;
    }
    near?.riders.push(si);
  });
  return out.sort((p, q) => q.x - p.x);
}
/** A risen stem is one stroke (rule S2 of tests/helpers/char-stems.ts, carried here; owner on round two: "the long
 *  alif looks broken as if it's two or three separate strokes"). The stem is not cut and pieced out with a rod of one
 *  weight: the stretch of its skeleton between the split and its foot is drawn out whole. The foot is the end of the
 *  upright run below the split, no lower than FOOT above the line where the stroke runs on into a join or a bowl,
 *  FREE_FOOT where it ends at the line (an alif). */
export const FOOT = 3,
  FREE_FOOT = 1.2,
  ONE_STROKE = !process.env.WIDE_RODS; // WIDE_RODS=1: the stems as rounds one to three drew them (head, rod, foot); and so they are while a layout is being found (STROKES)
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** The foot of a stem: the index of the last sample of the stretch that is drawn out (cut + 1: there is none, the
 *  stem has one weight down to its join, and it is lengthened by a straight shaft as before). */
export function stemFoot(s: readonly Sample[], cut: number, base: number): number {
  if (!ONE_STROKE || !STROKES.fine) return cut + 1;
  const n = s.length,
    run = (floor: number) => {
      let i = cut;
      while (i + 1 < n && s[i + 1].y < s[i].y && Math.abs(s[i + 1].x - s[i].x) <= 0.25 * (s[i].y - s[i + 1].y) + 0.02 && s[i + 1].y >= floor) i++; // prettier-ignore
      return i;
    },
    end = run(-Infinity),
    free = Math.hypot(s[n - 1].x - s[end].x, s[n - 1].y - s[end].y) < 0.8 && s[n - 1].y < base + 1;
  return Math.max(cut + 1, run(base + (free ? FREE_FOOT : FOOT)));
}
/** The stretch between the split (`cut`) and the foot (`f`) of a stem drawn `e` taller, without its two ends, from
 *  the top down: a point that stood at the share u of the stretch (from the foot) stands at u still, moved up along
 *  the stem's direction by e (3u^2 - 2u^3), so the stroke leaves its foot and reaches its split with the direction it
 *  had; and it keeps the pen's weight it had at u, so the taper of the written stem is the taper of the risen one,
 *  spread over its whole length. With no stretch (f = cut + 1) the two ends are joined by a straight shaft. */
export function drawnOut(
  s: readonly Sample[],
  cut: number,
  f: number,
  e: number,
  lean: number,
  step: number,
): Sample[] {
  const A = s[cut],
    F = s[f],
    out: Sample[] = [];
  if (f === cut + 1) {
    const a = { x: A.x + lean * e, y: A.y + e, w: A.w },
      n = Math.ceil(e / step);
    for (let i = 1; i < n; i++) out.push({ x: a.x + ((F.x - a.x) * i) / n, y: a.y + ((F.y - a.y) * i) / n, w: a.w + ((F.w - a.w) * i) / n }); // prettier-ignore
    return out;
  }
  const H = A.y - F.y,
    n = Math.max(2, Math.ceil((H + e) / Math.min(step, 0.4)));
  let j = cut;
  for (let i = n - 1; i >= 1; i--) {
    const u = i / n,
      y0 = F.y + u * H;
    while (j < f && s[j + 1].y >= y0) j++;
    const a = s[j],
      c = s[Math.min(f, j + 1)],
      v = a.y > c.y ? Math.min(1, Math.max(0, (a.y - y0) / (a.y - c.y))) : 0,
      k = e * smooth(u);
    out.push({ x: a.x + (c.x - a.x) * v + lean * k, y: y0 + k, w: a.w + (c.w - a.w) * v });
  }
  return out;
}
/** A line's strokes with some stems redrawn taller: `extra[k]` is added to the height of stem k. Everything on the
 *  head side of the split moves up along the stem's own direction, whole; the stretch between the split and the foot
 *  is drawn out (`drawnOut`): one stroke, with samples along it. */
export function raise(b: Built, stems: readonly Stem[], extra: readonly number[]): Stroke[] {
  const out = b.strokes.slice();
  stems.forEach((m, k) => {
    const e = extra[k];
    if (!(e > 0)) return;
    const st = b.strokes[m.si],
      up = (q: Sample): Sample => ({ ...q, x: q.x + m.lean * e, y: q.y + e }),
      f = stemFoot(st.s, m.cut, m.base);
    out[m.si] = { ...st, s: [...st.s.slice(0, m.cut + 1).map(up), ...drawnOut(st.s, m.cut, f, e, m.lean, 0.8), ...st.s.slice(f)], own: undefined }; // prettier-ignore
    for (const r of m.riders) out[r] = { ...b.strokes[r], s: b.strokes[r].s.map(up), own: undefined };
  });
  return out;
}
export type Pt = [number, number];
/** The convex hull of some points (Andrew's chain). */
export function hull(pts: readonly Pt[]): Pt[] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]),
    half = (list: Pt[]) => {
      const h: Pt[] = [];
      for (const q of list) {
        while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
        h.push(q);
      }
      h.pop();
      return h;
    };
  return p.length < 3 ? p : [...half(p), ...half(p.reverse())];
}
/** Some ink on the grid: for each column from c0 its lowest and highest inked row (lo > hi where there is none). */
export interface Cols {
  c0: number;
  lo: Int16Array;
  hi: Int16Array;
}
export function colsOf(polys: readonly Poly[]): Cols {
  const pts = polys.flat(),
    c0 = Math.floor(Math.min(...pts.map(p => p[0])) / CELL) - 1,
    r0 = Math.floor(Math.min(...pts.map(p => p[1])) / CELL) - 1,
    W = Math.ceil(Math.max(...pts.map(p => p[0])) / CELL) + 1 - c0,
    H = Math.ceil(Math.max(...pts.map(p => p[1])) / CELL) + 1 - r0,
    A = new Alpha(W, H),
    lo = new Int16Array(W).fill(32767),
    hi = new Int16Array(W).fill(-32768);
  A.fill(toPixels(polys, x => x / CELL - c0, y => H - (y / CELL - r0))); // prettier-ignore
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++)
      if (A.a[py * W + px] > 100) {
        const r = r0 + H - 1 - py;
        if (r < lo[px]) lo[px] = r;
        if (r > hi[px]) hi[px] = r;
      }
  return { c0, lo, hi };
}
export type Profile = Map<number, [number, number]>;
/** Some inks on the grid as one, each where it stands. */
export function profile(parts: readonly (readonly [Cols, number])[]): Profile {
  const m: Profile = new Map();
  for (const [c, at] of parts) {
    const d = Math.round(at / CELL) + c.c0;
    for (let i = 0; i < c.lo.length; i++) {
      if (c.hi[i] < c.lo[i]) continue;
      const e = m.get(i + d);
      if (!e) m.set(i + d, [c.lo[i], c.hi[i]]);
      else {
        e[0] = Math.min(e[0], c.lo[i]);
        e[1] = Math.max(e[1], c.hi[i]);
      }
    }
  }
  return m;
}
/** The least pitch at which a line and the one under it keep LINE_SPACE of ink (baselines-first, step 2). */
export function need(A: Profile, B: Profile): number {
  const reach = Math.ceil(LINE_SPACE / CELL);
  let p = 0;
  for (const [c, [, top]] of B)
    for (let d = -reach; d <= reach; d++) {
      const a = A.get(c + d);
      if (a) p = Math.max(p, top - a[0] + 1 + Math.ceil(Math.sqrt(reach * reach - d * d)));
    }
  return p * CELL;
}
/** How much taller a stem can be drawn before what rises of it meets the circle (-1: it is outside as written). */
export function room(head: readonly Pt[], dx: number, dy: number, lean: number, Rin: number): number {
  let e = Infinity;
  for (const p of head) {
    const x = p[0] + dx,
      y = p[1] + dy,
      a = lean * lean + 1,
      b = x * lean + y,
      c = x * x + y * y - Rin * Rin;
    if (c > 0) return -1;
    e = Math.min(e, (-b + Math.sqrt(b * b - a * c)) / a);
  }
  return e;
}
/** 3. Where the stems of a line stop: each at the circle, none taller than CAP times its height as written; and the
 *  stems of the name of God by one factor, the least of theirs, so that its lams keep their proportion to its alif. */
export function settle(stems: readonly Stem[], free: readonly number[]): number[] {
  const e = stems.map((m, k) => Math.max(0, Math.min(free[k], (CAP - 1) * m.top)));
  return stems.map((m, k) =>
    m.name
      ? (Math.min(...stems.map((o, j) => (o.name && o.wi === m.wi ? 1 + e[j] / o.top : Infinity))) - 1) * m.top
      : e[k],
  );
}

// ======== measured on a raster ========
/** The pairs of inks that come within `clear` of each other in a circle of radius R (or overlap), as the colonnade
 *  measures its words: each ink is filled on a grid of K cells to a pen unit, and a cell of one ink within `clear` of
 *  a cell of another makes a pair. */
export function nearPairs(inks: readonly Poly[][], R: number, clear: number, K = 5): [number, number][] {
  const W = Math.ceil(2 * R * K) + 2,
    label = new Int16Array(W * W),
    r = clear * K,
    near: [number, number][] = [],
    pairs = new Set<number>();
  for (let dy = 0; dy <= r; dy++) for (let dx = -Math.floor(r); dx <= r; dx++) if ((dy > 0 || dx > 0) && dx * dx + dy * dy <= r * r) near.push([dx, dy]); // prettier-ignore
  inks.forEach((ink, k) => {
    if (!ink.length) return;
    const A = new Alpha(W, W);
    A.fill(toPixels(ink, x => (x + R) * K + 1, y => (R - y) * K + 1)); // prettier-ignore
    for (let i = 0; i < label.length; i++)
      if (A.a[i] > 127) {
        if (label[i] && label[i] !== k + 1) pairs.add(label[i] * 1000 + k + 1);
        label[i] = k + 1;
      }
  });
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const a = label[y * W + x];
      if (!a) continue;
      for (const [dx, dy] of near) {
        const b = x + dx >= 0 && x + dx < W && y + dy < W ? label[(y + dy) * W + x + dx] : 0;
        if (b && b !== a) pairs.add(Math.min(a, b) * 1000 + Math.max(a, b));
      }
    }
  return [...pairs].map(p => [Math.floor(p / 1000) - 1, (p % 1000) - 1]);
}

// ======== the meridians (tests/char-meridian-sheet.test.ts) ========
// A risen stem keeps its share of the circle's width as it rises: the lines of writing are the parallels of a globe
// seen from the side, the stems its meridians.
export const HEAD_LEN = 4.2, // the head of a stem: what lies within this of its top (alts.ts headC is 3.8 long)
  SHAFT_STEP = 0.4, // a curved shaft is drawn with a sample this often
  EASE = 3, // the stem leaves its foot upright and has turned to its meridian's direction within about this length
  LAP = 1.6; // a mirrored head is a stroke of its own, and runs this far down the shaft over the stem's own stroke
/** How one stem is bent. */
export interface Bend {
  /** Where the stem's line stands in the circle (added to its samples), the circle the meridians belong to, and how
   *  much of the rule's shift is applied (1: the rule). */
  ox: number;
  oy: number;
  rho: number;
  k: number;
  /** The foot of the meridian it follows, when that is not its own (the name of God bent as one body). */
  x0?: number;
  y0?: number;
  /** The head mirrored about the stem's own line, or drawn both ways. */
  head?: 'mirror' | 'both';
  ease?: number;
}
/** The rule: how far sideways a stem that stands at x0 at height y0 has moved by height y (heights from the centre
 *  of a circle of radius rho), and the slope of that (sideways for each unit of rise). x0 w(y)/w(y0) - x0, times k;
 *  less the slope it would have at its foot, which is let in over `ease`. */
export function meridianShift(x0: number, y0: number, y: number, rho: number, k = 1, ease = 0): [number, number] {
  const w0 = Math.sqrt(rho * rho - y0 * y0),
    yy = Math.min(y, rho * 0.9995);
  if (!(w0 > 0) || y <= y0) return [0, 0];
  const w = Math.sqrt(rho * rho - yy * yy),
    s0 = (k * x0 * -y0) / (w0 * w0),
    f = ease > 0 ? Math.exp(-(y - y0) / ease) : 0;
  return [k * x0 * (w / w0 - 1) - s0 * ease * (1 - f), (k * x0 * -yy) / (w * w0) - s0 * f];
}
export interface Bent {
  /** The line's strokes, as `raise` gives them (a mirrored head's stem starts lower: its head is in `heads`). */
  strokes: Stroke[];
  heads: { si: number; stroke: Stroke }[];
  /** For each stem, what stands above its split, as strokes (the shaft and head, a mirrored head, the riders). */
  rise: Stroke[][];
}
/** `raise`, on the meridians: stem k is drawn `extra[k]` taller and, where `bends[k]` is given, every sample above
 *  its split is moved sideways by the rule and the pen turned with the stem's direction there; the head (and what
 *  rides with it) is carried whole on the top, turned with the stem. A mirrored head is the head's skeleton mirrored
 *  about the stem's own line, written with the mirrored pen. */
export function meridians(
  b: Built,
  stems: readonly Stem[],
  extra: readonly number[],
  bends: readonly (Bend | null | undefined)[],
): Bent {
  const out = b.strokes.slice(),
    heads: Bent['heads'] = [],
    rise: Stroke[][] = stems.map(() => []);
  stems.forEach((m, k) => {
    const e = Math.max(0, extra[k] || 0),
      bd = bends[k],
      st = b.strokes[m.si],
      up = (q: Sample): Sample => ({ ...q, x: q.x + m.lean * e, y: q.y + e }),
      z = st.s[m.cut + 1],
      // (one stroke: the stretch down to the foot is drawn out, `drawnOut`; what rises is what stands above z)
      f = e > 0 ? stemFoot(st.s, m.cut, m.base) : m.cut + 1,
      top: Sample[] = [...st.s.slice(0, m.cut + 1).map(up), ...(e > 0 ? drawnOut(st.s, m.cut, f, e, m.lean, SHAFT_STEP) : [])]; // prettier-ignore
    let above = top.length;
    while (above > m.cut + 1 && top[above - 1].y <= z.y) above--;
    const riders = m.riders.map(r => b.strokes[r].s.map(up));
    if (!bd) {
      if (e > 0) {
        out[m.si] = { ...st, s: [...top, ...st.s.slice(f)], own: undefined };
        m.riders.forEach((r, i) => (out[r] = { ...b.strokes[r], s: riders[i], own: undefined }));
      }
      rise[k] = [
        { ang: st.ang, s: top.slice(0, above) },
        ...m.riders.map((r, i) => ({ ...b.strokes[r], s: riders[i], own: undefined })),
      ];
      return;
    }
    // the head: what lies within HEAD_LEN of the top; it turns about its lowest sample
    const ymax = Math.max(...top.map(q => q.y));
    let hi = 0;
    while (hi < m.cut && top[hi + 1].y > ymax - HEAD_LEN) hi++;
    const A = top[hi],
      x0 = bd.x0 ?? z.x + bd.ox,
      y0 = bd.y0 ?? z.y + bd.oy,
      tilt = Math.atan(m.lean),
      at = (y: number) => meridianShift(x0, y0, y + bd.oy, bd.rho, bd.k, bd.ease ?? EASE),
      turn = (s: number) => tilt - Math.atan(m.lean + s),
      [dA, sA] = at(A.y),
      phi = turn(sA),
      cos = Math.cos(phi),
      sin = Math.sin(phi),
      rigid = (q: Sample): Sample => ({ ...q, x: A.x + dA + (q.x - A.x) * cos - (q.y - A.y) * sin, y: A.y + (q.x - A.x) * sin + (q.y - A.y) * cos, rot: (q.rot ?? 0) + phi }), // prettier-ignore
      bend = (q: Sample, i: number): Sample => {
        if (i <= hi) return rigid(q);
        const [d, s] = at(q.y);
        return { ...q, x: q.x + d, y: q.y, rot: (q.rot ?? 0) + turn(s) };
      },
      // (the mirror: about the stem's line through A; a nib at angle a then lies at 2 beta - a, beta the line's own)
      beta = Math.PI / 2 - tilt,
      mirror = (q: Sample): Sample => {
        const t = ((q.x - A.x) * m.lean + (q.y - A.y)) / (m.lean * m.lean + 1),
          fx = A.x + t * m.lean,
          fy = A.y + t;
        return { ...q, x: 2 * fx - q.x, y: 2 * fy - q.y, rot: 2 * beta - (2 * st.ang * Math.PI) / 180 - (q.rot ?? 0) };
      },
      bent = top.map(bend),
      rode = m.riders.map((r, i) => ({ ...b.strokes[r], s: riders[i].map(rigid), own: undefined }));
    let from = 0;
    if (bd.head) {
      let h2 = hi;
      while (h2 + 1 < top.length && top[h2].y > A.y - LAP) h2++;
      const stroke: Stroke = { ang: st.ang, s: top.slice(0, h2 + 1).map((q, i) => bend(mirror(q), i)) };
      heads.push({ si: m.si, stroke });
      rise[k].push(stroke);
      if (bd.head === 'mirror') from = hi;
    }
    out[m.si] = { ...st, s: [...bent.slice(from), ...st.s.slice(f)], own: undefined };
    m.riders.forEach((r, i) => (out[r] = rode[i]));
    rise[k].push({ ang: st.ang, s: bent.slice(from, above) }, ...rode);
  });
  return { strokes: out, heads, rise };
}
