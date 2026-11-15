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
}
/** How far into the letter's last descent the bowl is taken over, in samples (14 to a span of the skeleton): the pen
 *  has just set off downward and to the left, and the letter's head above it is the engine's. */
export const CUT_IN = 5;
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
  // the last letter's dots are the last in the list
  let mine = 0;
  for (const g of b.dotGroups) if (g.li === last.li && g.wi === last.wi) mine += g.n;
  return { si, head: { pre, ang: st.ang, C: [st.s[cut].x, st.s[cut].y], u: [ux / ul, uy / ul], dots: mine } };
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
  TURN_BY = 0.6, // the pen has turned to the rim's direction by this share of the way down to it
  STEP = 0.14;
/** A point of the bowl, and how far the pen has turned to the rim's by then (0 to 1). */
export type Swept = { x: number; y: number; w: number; on: number };
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
    drop = rho - rC;
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
      w: wC + (1 - wC) * (neck ? e : t),
      on: ease,
    });
  }
  for (let phi = phi0 - STEP / rho; phi > phiEnd; phi -= STEP / rho) {
    const left = (phi - phiEnd) * rho,
      v = left < TIP_LEN ? 1 - left / TIP_LEN : 0,
      r = rho - TIP_RISE * v * v;
    s.push({ x: r * Math.sin(phi), y: -r * Math.cos(phi), w: 1 - (1 - TIP_W) * v * v, on: 1 });
  }
  return { s, phi0, phiEnd };
}
/** The bowl's samples, mirrored back to run from its letter (`swept` is a sweep's, which runs to the left), with the
 *  pen's turn at each. */
export function bowlPen(head: Head, swept: readonly Swept[]): Sample[] {
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
  return pts.map((q, i) => {
    // (each turn of the nib is taken the short way from the one before, so the pen never flips between samples)
    let rot = going(i) - (d0 + (d1 - d0) * q.on) - head.ang * deg;
    rot -= Math.PI * Math.round((rot - before) / Math.PI);
    before = rot;
    return { x: q.x, y: q.y, w: q.w, rot };
  });
}

// ---- 3. the cradle as first tried: level lines, and the bowl under them ----
export const MARGIN = 0.9 * NIB, // between the ink and the circle, as the level lines keep
  UP = 10, // how far a line's tall strokes rise above it, and
  DOWN = 6, // how far its tails fall below it, when judging how much of a line lies inside
  /** How thick the pen draws the bowl's floor: the nib held at its angle to a stroke that runs along the rim. */
  FLOOR = NIB * Math.sin((th.style.ang * Math.PI) / 180);

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
  const b = th.buildStrokes(text, {});
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
}
export interface CradleLaid {
  R: number;
  lines: string[];
  polys: Poly[];
  cradle: Cradle | null;
  /** The bowl's width as a share of the circle's diameter, and the angle of rim it follows (degrees). */
  span: number;
  arc: number;
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
export function cradleCompose(text: string, o: CradleOptions = {}): CradleLaid | null {
  const words = text.split(' '),
    n = words.length,
    cr = o.cradle === false ? null : cradleOf(text),
    roof = o.roof ?? 0,
    ci = cr ? cr.wi : -1,
    span = (a: number, b: number) => lineOf(words.slice(a, b).join(' '), b - 1 === ci),
    width = (a: number, b: number) => span(a, b).x1 - span(a, b).x0;
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
      return { R, lines: said, polys: outs.flat(), cradle: cr, span: 0, arc: 0, inside: 0, pieces: outs, hs: t.hs };
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
      inside: t.cut.length - 1 - k,
    };
  };
  let found: (CradleLaid & { land: number }) | null = null;
  for (let pitch = 15.5; pitch < 24 && !found; pitch *= 1.06)
    radius: for (let R = 12; R < 170; R *= 1.02) {
      if (found && R > found.R * LARGER) break;
      const Rt = R - MARGIN,
        Rb = cr ? Rt - FLOOR - CLEAR : Rt,
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
            for (const [x, y] of l.ink.flat())
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
/** A line's strokes with some stems redrawn taller: `extra[k]` is added to the height of stem k. Everything on the
 *  head side of the split moves up along the stem's own direction, whole; the shaft between is drawn straight, with
 *  samples along it. */
export function raise(b: Built, stems: readonly Stem[], extra: readonly number[]): Stroke[] {
  const out = b.strokes.slice();
  stems.forEach((m, k) => {
    const e = extra[k];
    if (!(e > 0)) return;
    const st = b.strokes[m.si],
      up = (q: Sample): Sample => ({ ...q, x: q.x + m.lean * e, y: q.y + e }),
      a = up(st.s[m.cut]),
      z = st.s[m.cut + 1],
      n = Math.ceil(e / 0.8),
      shaft: Sample[] = [];
    for (let i = 1; i < n; i++) shaft.push({ x: a.x + ((z.x - a.x) * i) / n, y: a.y + ((z.y - a.y) * i) / n, w: a.w + ((z.w - a.w) * i) / n }); // prettier-ignore
    out[m.si] = { ...st, s: [...st.s.slice(0, m.cut + 1).map(up), ...shaft, ...st.s.slice(m.cut + 1)], own: undefined };
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
