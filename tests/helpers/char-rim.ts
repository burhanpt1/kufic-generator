// Fill from the bottom (owner's experiment, 15 November 2026): a second way of composing a short text (one to four
// words) in a circle, a rival to the ground line and the tiers of tests/helpers/char-roundel.ts. The owner on
// ما شاء الله: "The bottom is too much free space. If you had started there and curved it along the bottom, filling
// it to the top, it could have worked quite well." So the writing begins at the lower rim and is built upward until
// the circle is full; the letters decide what the foundation is. The rules, in the order they are applied (the
// numbers are just below; docs of the experiment: REPORT.md beside the sheets):
//   R1. THE UNITS. The words of the text. A single word that has no tall stem and more than one connected piece (a
//       piece ends at a letter that does not join on: نو ر, تو حيد) is laid out twice, whole and with its pieces
//       as the units, and the cheaper (R9) taken.
//   R2. THE TIERS. The units are split into consecutive level tiers, at most three. Words are read from the bottom
//       up (the classical order of a stacked composition): the first words are the bottom tier. The pieces of a
//       word descend: its first piece is the top tier. Every split is laid out and the cheapest (R9) taken.
//   R3. THE BASE is what the letters of the bottom tier offer, drawn along the rim's circle (0.9 nib inside the
//       circle), the first of these that stands:
//       a. the tier's last letter is a bowl (ن ي ى ل ق س ش ص ض, and ج ح خ ع غ, which return of themselves): the
//          returning bowl of the letters-first rules (rules.md 23), which comes down to the rim's circle and runs
//          back along it to the right, under its own tier: the tier stands in it (BOWL_LIFTS above its lowest
//          place, if it must);
//       b. else a tail (ر ز و and final م) that ends a piece of the tier, the first in the text first, MAX_TAILS at
//          most: it runs forth (rules.md 28), down to the rim's circle and on along it to the left for FORTH_RUN,
//          no higher than FORTH_TOP above the level diameter; what follows it in the tier stands over it. The tier
//          may stand LIFTS higher and BASE_SLIDES to the right;
//       c. else (no bowl and no tail in the tier) the BOAT: the bottom tier's line of writing is laid on the rim's
//          own circle (BOAT_FLAT), every point moved straight up by what that circle has risen there, so the
//          uprights stay upright and the pen keeps its angle; the tier's best join to elongate (the engine's own
//          choice, `kashidaJoin`; never in the name of God) is drawn out until the tier spans BOAT_SPAN of the
//          rim's width, KASH_MAX at most; the tier reaches no further from the axis than BOAT_REACH of the radius
//          (beyond that the writing is bent out of shape);
//       d. else none: the tiers stand level at the foot of the circle.
//       A dot stays with its letter (rules.md 6): only dots written under the line go with a redrawn bowl.
//   R4. FILLING UPWARD. Each tier above rests on what is under it at LINE_SPACE of ink, measured column by column
//       (the base stroke is not in that measure: a tier may stand in a bowl), level (`curve: 'level'`, the rule) or
//       on a circle LESS times flatter than the tier under it (`curve: 'less'`, with a boat). It is slid sideways
//       (SLIDES) to the place that lets the most stems of the tiers under it pass, then the nearest to the middle.
//   R5. STEMS RISE (rules S1, S2 and S6 of tests/helpers/char-stems.ts, whose one-stroke rise is used as it is):
//       every tall stem is drawn out as one stroke, from the axis outward, until its head meets the margin or its
//       ink comes within CLEAR of other writing; the arms of a lam-alif cross. Where it goes (`stems`):
//       straight, along its own lean (the rule); on its meridian (rules.md 30), if it passes the tiers above it;
//       or as a fan: drawn upright and then leaned about its foot so that, drawn on downward, it passes through a
//       point on the upright axis `fan` radii below the centre (tall stems only: the short uprights and the
//       writing stay as written).
//   R6. CLEARANCES (the letters-first ones): ink to the circle MARGIN (0.9 nib); tier to tier LINE_SPACE (0.55 nib)
//       of ink; any two units, and a base stroke (from two nibs past where it leaves its letter) to all other
//       units, CLEAR (0.3 nib), on a raster of 5 cells to the pen unit; a base stroke stands a cell free of its
//       own word. A layout that fails any is not drawn.
//   R7. THE BASE GIVES WAY. A bowl that does not stand clear is ended sooner (BOWL_ENDS), a tail's run shortened
//       (FORTH_RUNS); if it still does not stand, the next of R3 is tried, in that circle.
//   R8. THE CIRCLE. Every circle from the smallest in which the tiers stand up to LARGER times that is laid out.
//   R9. THE COST of a layout: its radius, times (1 + UNREACHED x the share of stems that do not come within
//       NEAR_RIM of the margin), times (1 + EMPTY x the share of the circle further than 0.15 of the radius from
//       any ink), times (1 - BASE_WORTH) where a base is drawn. The least is taken.
// Nothing here names a text or a word.
import { forms, isLetter, kashidaJoin } from '../../src/script/thuluth';
import type { Built } from '../../src/script/thuluth/engine';
import { cleanOutline } from '../../src/script/thuluth/outline';
import { Alpha, toPixels } from '../../src/script/thuluth/raster';
import type { Poly, Sample, Stroke } from '../../src/script/thuluth/types';
import type { Head } from './char-first';
import { CELL, CLEAR, FLOOR, MARGIN, NIB, SPAN_MAX, STEP, TIP_LEN, bowlPen, colsOf, mendDots, need, profile, sweep, takeOver, th } from './char-first'; // prettier-ignore
import type { Lead, Rib, Tier } from './char-stems';
import { drawn, emptyShare, ribsOf, splits } from './char-stems';

// ---- the numbers (pen units unless it says nibs) ----
export const BOWLS = 'نيىلقسشصضجحخعغ', // R3a: final letters that become a returning bowl
  TAILS = 'رزوم', // R3b: final letters whose tail runs forth
  WORD_GAP = 1 * NIB, // between the inks of two words of a tier,
  PIECE_GAP = 0.3 * NIB, // and of two pieces of a word
  NECK = 2 * NIB, // a base stroke has its full weight within this of its start, and is checked from here on
  BOWL_ENDS = [1, 0.85, 0.7, 0.55, 0.4], // R7: the shares of its run a bowl is tried at
  FORTH_RUN = (110 * Math.PI) / 180, // a tail running forth follows the rim for this much,
  FORTH_TOP = (20 * Math.PI) / 180, // ends no higher than this above the level diameter,
  FORTH_DROP = 5 * NIB, // and is taken over no further than this from the rim's circle (rules.md 28)
  FORTH_RUNS = [1, 0.8, 0.6, 0.45], // R7
  TIP_ROOM = 1.7 * TIP_LEN, // a stroke on the rim's circle is at least this long: it thins to a tip (rules.md W8)
  BASE_SLIDES = [0, 2, 4].map(v => v * NIB), // R3b: how far right a tier is slid for its tail
  LIFTS = [0, 1, 2.5].map(v => v * NIB), // R3: how far above its lowest place the bottom tier may stand
  BOWL_LIFTS = [0, 1, 2.5, 4, 5.5].map(v => v * NIB), // (a bowl's tier may stand higher: the bowl comes down under its own word)
  MAX_TAILS = 2, // R3b: the tails of the bottom tier that are tried, from the first
  BOAT_FLAT = 1, // R3c: the boat's circle, in radii of the margin's circle
  BOAT_REACH = 0.6, // a boat's tier reaches no further from the axis than this share of its circle's radius
  BOAT_SPAN = 0.62, // the share of the margin's diameter a boat is drawn out to span,
  KASH_MAX = 9 * NIB, // by a join drawn out no more than this,
  KASH_STEP = 0.5 * NIB, // in steps of this
  LESS = 2, // R4, `curve: 'less'`: each tier's circle is this many times the one under it
  SLIDES = [0, 1, -1, 2, -2, 3, -3, 4.5, -4.5, 6, -6].map(v => v * NIB), // R4
  OVERHANG = 2.5 * NIB, // a tier is slid no further than this past the end of the tier under it
  MIN_RISE = 0.15, // R5: a stem rises by at least this share of its written height, or not at all
  NEAR_RIM = 1.5 * NIB, // a stem whose head stands within this of the margin has reached the rim
  FAN = 3, // R5: the fan's point, in radii below the centre
  UNREACHED = 0.6, // R9
  EMPTY = 2,
  BASE_WORTH = 0.1,
  LARGER = 1.22, // R8
  K = 5; // raster cells to a pen unit

export interface RimOptions {
  /** R3: `auto` is the rule (a bowl or a tail if the bottom tier ends in one, else the boat); `letter` only the
   *  bowl or tail; `boat` always the boat; `none` no base at all (level tiers at the foot). */
  base?: 'auto' | 'letter' | 'boat' | 'none';
  /** R4: the tiers above the bottom one level (the rule), or each on a flatter circle than the one under it. */
  curve?: 'level' | 'less';
  /** R5 (`still`: as written). */
  stems?: 'straight' | 'meridian' | 'fan' | 'still';
  fan?: number;
  /** How many units in each tier, from the bottom up (unset: R2, by cost). */
  tiers?: number[];
  /** A single stemless word: unset, the rule (R1: whole or as its pieces, the cheaper); true, as its pieces only;
   *  false, whole only. */
  pieces?: boolean;
  /** The first units at the bottom (the rule), or at the top. */
  order?: 'up' | 'down';
  flat?: number;
  /** The base is not given up (R7 off): a layout without it is not taken. */
  must?: boolean;
}
export interface RimLaid {
  R: number;
  polys: Poly[];
  /** The tiers from the bottom up, what the base is, and its letter. */
  lines: string[];
  base: string;
  ribs: number;
  reach: number;
  factors: number[];
  /** The share of the circle far from any ink, and the cost (R9). */
  empty: number;
  cost: number;
  /** The ink unit by unit, and last the base stroke where it runs free: for a check from outside. */
  inks: Poly[][];
  /** Which of them the base stroke belongs to (-1: there is none). */
  baseUnit: number;
}

// ---- R1: a unit as the engine writes it ----
/** What a letter offers the base: a bowl (the unit's last letter) or a tail (the last letter of any of its pieces),
 *  and where that letter's last descent is taken over. */
interface Offer {
  kind: 'bowl' | 'tail';
  c: string;
  take: { si: number; head: Head };
}
interface Unit {
  text: string;
  b: Built;
  ribs: Rib[];
  offers: Offer[];
  x0: number;
  x1: number;
  piece: boolean;
}
const made = new Map<string, Unit>();
function unitOf(text: string, kash = 0, piece = false): Unit {
  const key = `${text}|${kash}|${piece}`;
  let u = made.get(key);
  if (u) return u;
  const join = kash > 0 ? kashidaJoin(text) : null,
    b = mendDots(th.buildStrokes(text, join != null ? { kashMap: { [join]: kash } } : {})),
    xs = [...b.strokes.flatMap(s => th.strokePolys(s)), ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y))].flat().map(p => p[0]), // prettier-ignore
    offers: Offer[] = [],
    count = b.placed.filter(isLetter).length;
  let seen = 0;
  b.placed.forEach((q, i) => {
    if (!isLetter(q)) return;
    const end = ++seen === count,
      kind = end && BOWLS.includes(q.c) ? 'bowl' : TAILS.includes(q.c) && (q.form === 'fin' || q.form === 'iso') ? 'tail' : null; // prettier-ignore
    if (!kind) return;
    try {
      // (the helper takes over the last letter of a line: the line is given to it up to this letter)
      const take = takeOver({ ...b, placed: b.placed.slice(0, i + 1) });
      if (take.si >= 0 && take.head.pre.length >= 2 && Number.isFinite(take.head.u[0]) && (end || !take.head.dots)) offers.push({ kind, c: q.c, take }); // prettier-ignore
    } catch {
      // (a letter the helper cannot take over offers nothing)
    }
  });
  u = { text, b, ribs: ribsOf(b, text), offers, x0: Math.min(...xs), x1: Math.max(...xs), piece };
  made.set(key, u);
  return u;
}
/** Whether a unit has a join to draw out. */
const stretches = (text: string) => kashidaJoin(text) != null;
/** R1: the pieces of a word. */
export function piecesOf(word: string): string[] {
  const out: string[] = [];
  for (const f of forms(word)) {
    if (!out.length || f.form === 'ini' || f.form === 'iso') out.push('');
    out[out.length - 1] += f.c;
  }
  return out;
}

// ---- where a unit stands: moved by (dx, oy), and every point lifted by what its line has risen there ----
interface Place {
  dx: number;
  oy: number;
  sag: (x: number) => number;
}
const LEVEL = () => 0;
/** A circle's rise above its lowest point (R3c): the boat's line. */
const arc = (rc: number) => (x: number) => {
  const v = Math.min(Math.abs(x), 0.97 * rc);
  return rc - Math.sqrt(rc * rc - v * v);
};
const at = (s: readonly Sample[], p: Place, rigid = 0, fx = 0): Sample[] =>
  s.map((q, i) => ({ ...q, x: q.x + p.dx, y: q.y + p.oy + p.sag(i < rigid ? fx + p.dx : q.x + p.dx) }));
const inkOf = (ss: readonly Stroke[]) => ss.flatMap(s => th.strokePolys(s));
/** The parts of a unit where it stands. `based`: its last letter's descent is left to the base stroke. */
function parts(u: Unit, p: Place, based: Offer | null) {
  const ribs = u.ribs.filter(r => r.si !== based?.take.si),
    risen = new Set(ribs.flatMap(r => [r.si, ...r.riders])),
    gone = based ? based.take.head.dots : 0,
    body: Stroke[] = [];
  u.b.strokes.forEach((st, si) => {
    if (risen.has(si)) return;
    body.push({ ...st, own: undefined, s: at(si === based?.take.si ? based.take.head.pre : st.s, p) });
  });
  const dots = u.b.dots.slice(0, u.b.dots.length - gone).flatMap(([x, y]) => th.dotPolysAt(x + p.dx, y + p.oy + p.sag(x + p.dx))), // prettier-ignore
    low = [...inkOf(body), ...dots, ...ribs.flatMap(r => th.strokePolys({ ...u.b.strokes[r.si], own: undefined, s: at(r.s.slice(r.f), p) }))], // prettier-ignore
    foot = (r: Rib): Place => ({ dx: p.dx, oy: p.oy + p.sag(r.s[r.f].x + p.dx), sag: LEVEL }),
    upper = ribs.map(r => inkOf([{ ...u.b.strokes[r.si], own: undefined, s: at(r.s.slice(0, r.f + 1), foot(r)) }, ...r.riders.map(i => ({ ...u.b.strokes[i], own: undefined, s: at(u.b.strokes[i].s, foot(r)) }))])); // prettier-ignore
  return { ribs, low, upper, foot };
}

// ---- the ink on a raster: which units stand within CLEAR of a cell ----
class Field {
  readonly W: number;
  readonly halo: Uint32Array;
  readonly ribs: Uint32Array;
  readonly solid: Uint32Array;
  private readonly disc: [number, number][] = [];
  constructor(readonly R: number) {
    this.W = Math.ceil(2 * R * K) + 4;
    this.halo = new Uint32Array(this.W * this.W);
    this.ribs = new Uint32Array(this.W * this.W);
    this.solid = new Uint32Array(this.W * this.W);
    const r = CLEAR * K;
    for (let dy = -Math.ceil(r); dy <= r; dy++) for (let dx = -Math.ceil(r); dx <= r; dx++) if (dx * dx + dy * dy <= r * r) this.disc.push([dx, dy]); // prettier-ignore
  }
  private cells(polys: readonly Poly[], each: (i: number, x: number, y: number) => boolean): boolean {
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const q of polys)
      for (const [x, y] of q) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    if (!(x1 >= x0)) return false;
    const { R, W } = this,
      cx = Math.floor((x0 + R) * K),
      cy = Math.floor((R - y1) * K),
      w = Math.ceil((x1 + R) * K) - cx + 2,
      h = Math.ceil((R - y0) * K) - cy + 2,
      A = new Alpha(w, h);
    A.fill(toPixels(polys as Poly[], x => (x + R) * K + 2 - cx, y => (R - y) * K + 2 - cy)); // prettier-ignore
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        if (A.a[py * w + px] <= 127) continue;
        const gx = px + cx,
          gy = py + cy;
        if (gx < 0 || gy < 0 || gx >= W || gy >= W) return true;
        if (each(gy * W + gx, gx, gy)) return true;
      }
    return false;
  }
  /** Whether this ink of unit `id` stands within CLEAR of another unit's (or off the grid). */
  hits(polys: readonly Poly[], id: number): boolean {
    const not = ~(1 << id);
    return this.cells(polys, i => (this.halo[i] & not) !== 0);
  }
  /** Whether the risen part of a stem (group `g`) stands within CLEAR of another stem's. */
  crowds(polys: readonly Poly[], g: number): boolean {
    const not = ~(1 << (g % 32));
    return this.cells(polys, i => (this.ribs[i] & not) !== 0);
  }
  /** Whether this ink comes within a cell of unit `id`'s own (a base stroke and the word it leaves). */
  meets(polys: readonly Poly[], id: number): boolean {
    const { W, solid } = this,
      bit = 1 << id;
    return this.cells(polys, (_, gx, gy) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (solid[(gy + dy) * W + gx + dx] & bit) return true; // prettier-ignore
      return false;
    });
  }
  stamp(polys: readonly Poly[], id: number, rib = -1): void {
    const { W, disc } = this,
      halo = rib < 0 ? this.halo : this.ribs,
      bit = 1 << (rib < 0 ? id : rib % 32);
    this.cells(polys, (i, gx, gy) => {
      if (rib < 0) this.solid[i] |= bit;
      for (const [dx, dy] of disc) {
        const x = gx + dx,
          y = gy + dy;
        if (x >= 0 && y >= 0 && x < W && y < W) halo[y * W + x] |= bit;
      }
      return false;
    });
  }
}
const inside = (polys: readonly Poly[], Rt: number) => {
  for (const q of polys) for (const [x, y] of q) if (x * x + y * y > Rt * Rt) return false;
  return true;
};
/** How low some ink, written about a line at height 0, can stand in a circle (Infinity: it is too wide). */
const lowest = (polys: readonly Poly[], Rin: number) => {
  let y = -Infinity;
  for (const q of polys)
    for (const [px, py] of q) {
      if (Math.abs(px) >= Rin) return Infinity;
      y = Math.max(y, -Math.sqrt(Rin * Rin - px * px) - py);
    }
  return y;
};

// ---- R3a, R3b: the base stroke of a unit where it stands (level) ----
interface Base {
  ink: Poly[];
  loose: Poly[];
}
function baseStroke(f: Offer, p: Place, R: number, share: number): Base | null {
  const { head } = f.take,
    rho = R - MARGIN - FLOOR / 2 - 0.05,
    C: [number, number] = [head.C[0] + p.dx, head.C[1] + p.oy],
    w = head.pre[head.pre.length - 1].w,
    bowl = f.kind === 'bowl',
    sw = bowl
      ? sweep([-C[0], C[1]], [-head.u[0], head.u[1]], w, rho, phi0 => -Math.min(SPAN_MAX, Math.max(phi0, 0.5)) * share, NECK) // prettier-ignore
      : rho - Math.hypot(C[0], C[1]) > FORTH_DROP
        ? null
        : sweep(C, head.u, w, rho, phi0 => Math.max(phi0 - Math.max(FORTH_RUN * share, TIP_ROOM / rho), -(Math.PI / 2 + FORTH_TOP)), NECK); // prettier-ignore
  if (!sw) return null;
  // (the helper's pen mirrors a bowl back to the right: a tail running forth is given to it mirrored)
  const pen = bowlPen(head, bowl ? sw.s : sw.s.map(q => ({ ...q, x: -q.x }))),
    s = [...at(head.pre, p), ...pen],
    rd = rho - FLOOR / 2 - 1.25 * NIB,
    side = bowl ? -1 : 1,
    // the letter's dots written under the line: along the floor, where the stroke comes down to it
    dots = Array.from({ length: head.dots }, (_, i) => {
      const phi = sw.phi0 - (2.2 * NIB + i * 1.2 * NIB) / rd;
      return th.dotPolysAt(side * rd * Math.sin(phi), -rd * Math.cos(phi), 1, side * phi);
    }).flat();
  return {
    ink: [...th.strokePolys({ ang: head.ang, s }), ...dots],
    loose: [...th.strokePolys({ ang: head.ang, s: pen.slice(Math.ceil(NECK / STEP)) }), ...dots],
  };
}

// ---- R3 to R7: one layout ----
/** Why layouts did not stand (for the facts). */
export const WHY = new Map<string, number>();
const no = (why: string) => {
  WHY.set(why, (WHY.get(why) ?? 0) + 1);
  return null;
};
/** The base of a layout: none, the boat, or what a letter of unit `k` of the bottom tier offers. */
type Spec = { kind: 'none' | 'boat' } | { kind: 'bowl' | 'tail'; k: number; f: Offer };
function layout(
  ts: readonly Unit[][],
  R: number,
  o: RimOptions,
  spec: Spec,
  slide0: number,
  lift: number,
): RimLaid | null {
  const kind = spec.kind,
    f0 = 'f' in spec ? spec : null,
    Rt = R - MARGIN,
    n = ts.length,
    stems = o.stems ?? 'straight',
    rc = (o.flat ?? BOAT_FLAT) * Rt,
    sags = ts.map((_, t) => (kind !== 'boat' ? LEVEL : t === 0 ? arc(rc) : o.curve === 'less' ? arc(rc * LESS ** t) : LEVEL)), // prettier-ignore
    // the units of a tier side by side, right to left, the tier centred
    row = (tier: readonly Unit[]) => {
      const dx: number[] = [];
      tier.forEach((u, k) => dx.push(k ? tier[k - 1].x0 + dx[k - 1] - (u.piece ? PIECE_GAP : WORD_GAP) - u.x1 : -u.x1));
      const mid = (tier[tier.length - 1].x0 + dx[dx.length - 1] + tier[0].x1 + dx[0]) / 2;
      return dx.map(v => v - mid);
    },
    width = (tier: readonly Unit[]) => {
      const dx = row(tier);
      return tier[0].x1 + dx[0] - (tier[tier.length - 1].x0 + dx[dx.length - 1]);
    },
    id = (t: number, k: number) => ts.slice(0, t).reduce((a, T) => a + T.length, 0) + k,
    places: Place[][] = [],
    laid: ReturnType<typeof parts>[][] = [],
    passes: boolean[][][] = [];
  // a stem of a lower tier on its way up: the columns it needs
  const cols: { t: number; k: number; r: number; xa: number; xb: number }[] = [];
  for (let t = 0; t < n; t++) {
    const T = ts[t],
      dx = row(T),
      whole = (slide: number, oy: number) => T.flatMap((u, k) => {
        const q = parts(u, { dx: dx[k] + slide, oy, sag: sags[t] }, null);
        return [...q.low, ...q.upper.flat()];
      }), // prettier-ignore
      based = (k: number) => (t === 0 && f0?.k === k ? f0.f : null);
    let slide = 0,
      oy = 0;
    if (t === 0) {
      slide = slide0;
      // (a boat's tier keeps to the gentle part of its circle)
      if (kind === 'boat' && width(T) / 2 > BOAT_REACH * rc) return no('boat too steep');
      // (the tier stands in a bowl, and what follows a tail stands over it: clear of the stroke on the rim's circle)
      const ink = T.flatMap((u, k) => {
          const q = parts(u, { dx: dx[k] + slide, oy: 0, sag: sags[0] }, based(k));
          return [...q.low, ...q.upper.flat()];
        }),
        over = Rt - FLOOR - CLEAR,
        cx = f0 ? f0.f.take.head.C[0] + dx[f0.k] + slide : 0;
      oy = kind === 'bowl' ? lowest(ink, over) : kind === 'tail' ? Math.max(lowest(ink, Rt), lowest(ink.map(q => q.filter(v => v[0] < cx)), over)) : lowest(ink, Rt); // prettier-ignore
      if (oy === Infinity) return no('bottom tier too wide');
      oy += lift;
    } else {
      // R4: the place that lets the most stems from below pass, then the nearest to the middle
      const reach = Math.abs(width(ts[t - 1]) - width(T)) / 2 + OVERHANG,
        mid = places[t - 1].reduce((a, p, k) => a + p.dx - row(ts[t - 1])[k], 0) / places[t - 1].length;
      let best = -Infinity,
        free: boolean[] = [];
      for (const s of SLIDES) {
        if (Math.abs(s) > reach) continue;
        const c = colsOf(whole(mid + s, 0)),
          ok = cols.map(q => {
            for (let i = Math.max(0, Math.floor(q.xa / CELL) - c.c0); i <= Math.min(c.lo.length - 1, Math.ceil(q.xb / CELL) - c.c0); i++) if (c.hi[i] >= c.lo[i]) return false; // prettier-ignore
            return true;
          }),
          score = ok.filter(Boolean).length * 100 - (1.5 * Math.abs(s)) / NIB;
        if (score > best + 1e-9) {
          best = score;
          slide = mid + s;
          free = ok;
        }
      }
      for (let i = cols.length - 1; i >= 0; i--)
        if (!free[i]) {
          passes[cols[i].t][cols[i].k][cols[i].r] = false;
          cols.splice(i, 1);
        }
      const below: Poly[] = [];
      for (let b = 0; b < t; b++)
        laid[b].forEach((q, k) => {
          below.push(...q.low);
          q.upper.forEach((up, r) => {
            if (!passes[b][k][r] || stems === 'still') below.push(...up);
          });
        });
      oy = need(profile([[colsOf(whole(slide, 0)), 0]]), profile([[colsOf(below), 0]]));
    }
    places.push(T.map((_, k) => ({ dx: dx[k] + slide, oy, sag: sags[t] })));
    laid.push(T.map((u, k) => parts(u, places[t][k], based(k))));
    passes.push(laid[t].map(q => q.ribs.map(() => true)));
    laid[t].forEach((q, k) =>
      q.upper.forEach((up, r) => {
        const xs = up.flat().map(v => v[0]);
        cols.push({ t, k, r, xa: Math.min(...xs) - CLEAR - 0.3, xb: Math.max(...xs) + CLEAR + 0.3 });
      }),
    );
  }
  // R6: the bodies
  const field = new Field(R),
    ink: Poly[][] = [];
  for (let t = 0; t < n; t++)
    for (let k = 0; k < ts[t].length; k++) {
      const b = laid[t][k].low;
      if (!inside(b, Rt + 1e-6)) return no(`tier ${t} outside`);
      if (field.hits(b, id(t, k))) return no(`bodies touch, tier ${t}`);
      ink[id(t, k)] = b.slice();
    }
  ink.forEach((b, i) => field.stamp(b, i));
  // R3a, R3b, R7: the base stroke, as long as it stands clear
  const count = ink.length,
    last = f0 ? f0.k : ts[0].length - 1;
  let base: Base | null = null;
  if (f0) {
    for (const share of kind === 'bowl' ? BOWL_ENDS : FORTH_RUNS) {
      const b = baseStroke(f0.f, places[0][last], R, share);
      if (!b) {
        no('base: no sweep');
        continue;
      }
      if (!inside(b.ink, Rt + 1e-6)) {
        no('base: outside');
        continue;
      }
      // (CLEAR of every other unit; of its own word it need only stand free)
      if (field.hits(b.loose, id(0, last)) || field.meets(b.loose, id(0, last))) {
        no('base: touches');
        continue;
      }
      base = b;
      break;
    }
    if (!base) return no('no base');
    field.stamp(base.loose, count);
    field.stamp(base.ink, id(0, last));
    ink[id(0, last)].push(...base.ink);
  }
  // R5: the stems, from the axis outward
  const V = stems === 'fan' ? -(o.fan ?? FAN) * R : null,
    todo: { t: number; k: number; rs: number[]; x: number }[] = [];
  laid.forEach((row2, t) =>
    row2.forEach((q, k) =>
      q.ribs.forEach((r, i) => {
        // (the two arms of a lam-alif rise by one length: the pair is settled once, at its first arm)
        const mate = r.pair >= 0 ? q.ribs.indexOf(ts[t][k].ribs[r.pair]) : -1,
          rs = mate >= 0 ? [i, mate] : [i];
        if (mate >= 0 && mate < i) return;
        todo.push({ t, k, rs, x: Math.min(...rs.map(j => Math.abs(q.ribs[j].s[q.ribs[j].f].x + places[t][k].dx))) });
      }),
    ),
  );
  todo.sort((p, q) => p.x - q.x || p.t - q.t);
  let reach = 0,
    ribs = 0,
    groups = 0;
  const factors: number[] = [];
  for (const { t, k, rs } of todo) {
    const u = ts[t][k],
      q = laid[t][k],
      p = places[t][k],
      mine = rs.map(i => q.ribs[i]),
      two = mine.length > 1,
      bent = stems === 'meridian' && rs.every(i => passes[t][k][i]),
      draw = (e: number) => {
        const all: Poly[] = [],
          upper: Poly[] = [];
        mine.forEach((r, j) => {
          const f = q.foot(r),
            lead: Lead = { ox: f.dx, oy: f.oy, rho: bent ? Rt : undefined, upright: V != null, to: two ? mine[1 - j] : undefined }, // prettier-ignore
            d = drawn({ b: u.b } as Tier, r, e, lead),
            tail = r.s.length - r.f,
            [st, ...riders] = d.all,
            // (what is under its foot stays on its line; what is above stands on the foot)
            placed = [{ ...st, s: at(st.s, p, st.s.length - tail, r.s[r.f].x) }, ...riders.map(v => ({ ...v, s: at(v.s, f) }))], // prettier-ignore
            fy = r.s[r.f].y + f.oy,
            fan = (ps: Poly[]): Poly[] => V == null ? ps : ps.map(g => g.map(([x, y]) => [y > fy ? (x * (y - V)) / (fy - V) : x, y] as [number, number])); // prettier-ignore
          all.push(...fan(inkOf(placed)));
          upper.push(...fan(inkOf(d.upper.map(v => ({ ...v, s: at(v.s, f) })))));
        });
        return { all, upper };
      },
      g = groups++,
      hit = (d: { all: Poly[]; upper: Poly[] }) => field.hits(d.all, id(t, k)) || field.crowds(d.upper, g),
      written = Math.max(...mine.map(r => r.written));
    ribs += mine.length;
    let e = 0;
    if (stems !== 'still') {
      let lo = 0,
        hi = 2 * R;
      for (let i = 0; i < 12; i++) {
        const m = (lo + hi) / 2;
        if (inside(draw(m).all, Rt)) lo = m;
        else hi = m;
      }
      const rim = lo;
      if (hit(draw(rim))) {
        lo = 0;
        hi = rim;
        for (let i = 0; i < 11; i++) {
          const m = (lo + hi) / 2;
          if (!hit(draw(m))) lo = m;
          else hi = m;
        }
      }
      e = lo >= MIN_RISE * written ? lo : 0;
      if (e > 0 && e >= rim - NEAR_RIM) reach += mine.length;
      else if (e === 0 && rim < NEAR_RIM) reach += mine.length;
      if (e > 0) for (const r of mine) factors.push((r.written + e) / r.written);
    }
    const final = draw(e);
    if (e === 0 && (field.hits(final.all, id(t, k)) || !inside(final.all, Rt + 1e-6)))
      return no('a stem as written touches');
    field.stamp(final.all, id(t, k));
    field.stamp(final.upper, id(t, k), g);
    ink[id(t, k)].push(...final.all);
  }
  const all = ink.flat(),
    empty = emptyShare(all, R),
    cost = R * (1 + (UNREACHED * (ribs - reach)) / Math.max(1, ribs)) * (1 + EMPTY * empty) * (kind === 'none' ? 1 : 1 - BASE_WORTH); // prettier-ignore
  if (!inside(all, Rt + 1e-6)) return no('ink outside');
  const u0 = ts[0][last];
  return {
    R,
    polys: ink.flatMap(b => cleanOutline(b)),
    lines: ts.map(T => T.map(u => u.text).join(u0.piece ? '' : ' ')),
    base: f0 ? `the ${kind} of the ${f0.f.c} of ${u0.text}` : kind === 'boat' ? `a boat: ${ts[0].map(u => u.text).join(' ')}` : 'none', // prettier-ignore
    ribs,
    reach,
    factors,
    empty,
    cost,
    inks: base ? [...ink, base.loose] : ink,
    baseUnit: base ? id(0, last) : -1,
  };
}

/** R3, R7, R8: one split, in every circle from the smallest in which it stands to LARGER times that. `texts`: the
 *  tiers from the bottom up. */
function tiersOf(texts: readonly string[][], piece: boolean, o: RimOptions): RimLaid | null {
  const plain = texts.map(T => T.map(t => unitOf(t, 0, piece))),
    want = o.base ?? 'auto',
    specs: Spec[] = [],
    // the boat's kashida: the last unit of the bottom tier that has a join to draw out
    long = plain[0].map(u => stretches(u.text)).lastIndexOf(true),
    natural = (() => {
      let w = 0;
      plain[0].forEach((u, k) => (w += u.x1 - u.x0 + (k ? (piece ? PIECE_GAP : WORD_GAP) : 0)));
      return w;
    })();
  // R3: a bowl that ends the tier; else its tails, the first in the text first; else the boat
  if (want === 'auto' || want === 'letter') {
    const k = plain[0].length - 1,
      bowl = plain[0][k].offers.find(f => f.kind === 'bowl');
    if (bowl) specs.push({ kind: 'bowl', k, f: bowl });
    else
      plain[0].forEach((u, i) =>
        u.offers.forEach(f => specs.length < MAX_TAILS && specs.push({ kind: 'tail', k: i, f })),
      );
  }
  if (want === 'boat' || (want === 'auto' && !specs.length)) specs.push({ kind: 'boat' });
  if (!o.must || specs.length === 0) specs.push({ kind: 'none' });
  let best: RimLaid | null = null,
    least = 0;
  for (
    let R = Math.max(...plain.flat().map(u => (u.x1 - u.x0) / 2)) * 0.8 + MARGIN;
    R < 260 && !(least && R > least * LARGER);
    R *= 1.04
  ) {
    // (a base is looked for only in a circle in which the tiers stand without it)
    const bare = layout(plain, R, o, { kind: 'none' }, 0, 0),
      got: RimLaid[] = [];
    if (!bare) continue;
    for (const spec of specs) {
      if (spec.kind === 'none') {
        got.push(bare);
        break;
      }
      let ts = plain;
      if (spec.kind === 'boat' && long >= 0) {
        const more = Math.min(KASH_MAX, 2 * BOAT_SPAN * (R - MARGIN) - natural),
          kash = Math.floor(more / KASH_STEP) * KASH_STEP;
        if (kash >= NIB)
          ts = [plain[0].map((u, k) => (k === long ? unitOf(u.text, kash, piece) : u)), ...plain.slice(1)];
      }
      for (const lift of spec.kind === 'bowl' ? BOWL_LIFTS : spec.kind === 'tail' ? LIFTS : [0])
        for (const s of spec.kind === 'tail' ? BASE_SLIDES : [0]) {
          const l = layout(ts, R, o, spec, s, lift);
          if (l) got.push(l);
        }
      // (R7: the next offer, and at last no base, only where this one does not stand)
      if (got.length) break;
    }
    for (const l of got) {
      least ||= R;
      if (!best || l.cost < best.cost - 1e-9) best = l;
    }
  }
  return best;
}

/** R2: the cheapest of the splits of some units. */
function stack(units: readonly string[], piece: boolean, o: RimOptions, said?: string[]): RimLaid | null {
  let best: RimLaid | null = null;
  for (const cut of o.tiers ? [o.tiers] : splits(units.length)) {
    const tiers: string[][] = [];
    let a = 0;
    for (const c of cut) {
      tiers.push(units.slice(a, a + c));
      a += c;
    }
    // (the pieces of a word descend: its first piece is the top tier)
    if (piece || o.order === 'down') tiers.reverse();
    const l = tiersOf(tiers, piece, o);
    said?.push(`${piece ? 'pieces ' : ''}${cut.join('+')}: ${l ? `cost ${l.cost.toFixed(1)} (radius ${(l.R / NIB).toFixed(1)} nibs, ${l.reach} of ${l.ribs} stems reach, ${(l.empty * 100).toFixed(0)}% empty; base: ${l.base})` : 'does not stand'}`); // prettier-ignore
    if (l && (!best || l.cost < best.cost - 1e-9)) best = l;
  }
  return best;
}
/** The rule. `said`: what each split came to. */
export function rim(text: string, o: RimOptions = {}, said?: string[]): RimLaid | null {
  const words = text.trim().split(/\s+/),
    pieces = words.length === 1 && o.pieces !== false && !unitOf(words[0]).ribs.length ? piecesOf(words[0]) : [],
    whole = o.pieces === true && pieces.length > 1 ? null : stack(words, false, o, said),
    apart = pieces.length > 1 ? stack(pieces, true, o, said) : null;
  return apart && (!whole || apart.cost < whole.cost - 1e-9) ? apart : whole;
}
