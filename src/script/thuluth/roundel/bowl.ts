// Finishing a roundel (lab bowl.js): a great final bowl redrawn to follow the frame, the frame fitted to everything
// drawn, and the small adjustments a calligrapher makes by hand (a smaller conjunction set under a letter).
import type { PlacedLetter, Thuluth } from '../engine';
import { isLetter } from '../engine';
import { sampleStroke } from '../pen';
import type { SkelPt } from '../types';
import type { Roundel } from './compose';
import type { Finished, FinishOptions } from './finish';
import { finishRoundel, roundelParts } from './finish';

export interface BowlOptions {
  oval?: number;
  /** Clearance below the other letters, room either side, and how far the tail rises. */
  clear?: number;
  side?: number;
  tailUp?: number;
  /** How far the bowl leads out left of the join before dropping, and the tail's extra turn. */
  lead?: number;
  tailAng?: number;
  /** Where the letter's dots sit along the bowl (share of its left half; negative goes right), or by default the
   *  first of a few places, from the middle out, that keeps clear of the other letters' dots. */
  dotAt?: number;
  /** Search the oval's proportion too. */
  autoOval?: boolean;
  /** A bowl letter that joins nothing before it (an isolated nun) starts from its own head at the top of the bowl's
   *  far side and drops straight into it, rather than leading out level from where it was written beside the letter
   *  before (a level lead-in from beside an alif made the pair read as a lam). On unless false. */
  free?: boolean;
}

const letters = (r: Roundel, i: number) => r.shapes[i].b.placed.filter(isLetter);

/** The oval of a great final bowl (a returning ya or a final nun going deep): the lower half of an ellipse that clears
 *  the other letters, as wide as the composition, before it is drawn. Null when there is no such letter. */
export function bowlOval(th: Thuluth, r: Roundel, o: BowlOptions = {}) {
  const clear = o.clear ?? 2.6,
    side = o.side ?? 1.0;
  let gi = -1,
    P: PlacedLetter | null = null;
  r.shapes.forEach((S, i) => {
    const last = S.b.placed.filter(isLetter).pop();
    if (!last) return;
    const ys = last.g.s.flatMap(st => st.pts.map(q => q[1]));
    if (Math.min(...ys) < -3.2 && (last.c === 'ي' || last.c === 'ى' || last.c === 'ن')) {
      gi = i;
      P = last;
    }
  });
  if (gi < 0 || !P) return null;
  const B: PlacedLetter = P;
  const S = r.shapes[gi],
    G = r.st[gi],
    sc = r.groups[gi].sc || 1,
    J = { x: G.x + B.ox, y: G.y + (B.oy || 0) };
  // the other ink: every glyph except the bowl
  let X0 = 1e9,
    X1 = -1e9,
    Y0 = 1e9,
    Y1 = -1e9;
  const other: [number, number][] = [];
  r.shapes.forEach((_, i) =>
    letters(r, i).forEach(p => {
      if (i === gi && p === B) return;
      const s2 = r.groups[i].sc || 1;
      p.g.s.forEach(st =>
        st.pts.forEach(q => {
          const x = r.st[i].x + p.ox + q[0] * s2,
            y = r.st[i].y + (p.oy || 0) + q[1] * s2;
          other.push([x, y]);
          X0 = Math.min(X0, x);
          X1 = Math.max(X1, x);
          Y0 = Math.min(Y0, y);
          Y1 = Math.max(Y1, y);
        }),
      );
    }),
  );
  // the bowl: the lower half of an ellipse that clears the letters, as wide as the composition. It leads out to the
  // left of the join and drops in a broad, open curve (a tight turn under the letter before closes into a small loop
  // that reads as a ta marbuta), then sweeps back beneath everything and rises on the right
  const lead = o.lead ?? 2.0,
    free = o.free !== false && B.form === 'iso',
    cx = (X0 + X1) / 2,
    bottom = Math.min(Y0, J.y) - clear;
  const cy = Math.min(J.y - 1.2, Math.max(bottom + 2, (Y0 + Y1) / 2 - (Y1 - Y0) * 0.1));
  let b = cy - bottom,
    aL = free ? cx - X0 + side : Math.max(cx - (J.x - lead), cx - X0 + side),
    aR = X1 - cx + side;
  const size0 = aL + aR + b;
  // every letter below the centre line stays inside the bowl by a pen's width and a gap: a descending tail (a ra's)
  // low at the side, where the bowl rises, widens that side, and anything too deep lowers the bottom
  const gap = th.style.nib + 1.0;
  for (let pass = 0; pass < 3; pass++)
    other.forEach(([x, y]) => {
      const dy = cy - y;
      if (dy <= 0) return;
      if (dy > b - gap) b = dy + gap + 0.01;
      const need = gap + Math.abs(x - cx) / Math.sqrt(1 - (dy / (b - gap)) ** 2);
      if (x < cx) aL = Math.max(aL, need);
      else aR = Math.max(aR, need);
    });
  if (free) {
    // the letter moves to the head of its bowl
    const dx = cx - aL + 0.6 - J.x;
    r.st[gi] = { x: r.st[gi].x + dx, y: r.st[gi].y };
    J.x += dx;
  }
  return { gi, B, S, G: r.st[gi], sc, J, cx, cy, b, aL, aR, size0, lead, free };
}

/** Redraw a great final bowl (a returning ya or a final nun) as a curve that follows the frame's lower rim at a fixed
 *  clearance below the other letters, wide and low as a master would draw it; put the letter's dots inside the bowl,
 *  and recompute the frame around the new ink. */
export function shapeBowl(th: Thuluth, r: Roundel, o: BowlOptions = {}): Roundel {
  const ov = o.oval || r.disc?.oval || 1,
    tailUp = o.tailUp ?? 2.2,
    bo = bowlOval(th, r, o);
  if (!bo) return r;
  const { gi, B, S, G, sc, J, cx, cy, b, aL, aR, size0, lead, free } = bo;
  const E = (t: number): [number, number] => [cx + (Math.cos(t) < 0 ? aL : aR) * Math.cos(t), cy + b * Math.sin(t)];
  // how far the letters pushed the bowl out, for choosing between arrangements
  r.bowlGrow = (aL + aR + b) / size0 - 1;
  const ts = Math.PI,
    te = Math.PI * 2 - 0.12 + (o.tailAng || 0),
    pts: SkelPt[] = [[J.x, J.y, 1]];
  const s0 = E(ts);
  if (free) pts.push([J.x - 0.35, J.y - 0.9, 1], [s0[0] + 0.1, (J.y + s0[1]) / 2 - 0.4, 1]);
  else pts.push([J.x - lead * 0.45, J.y - 0.15, 1], [s0[0] + lead * 0.12, (J.y + s0[1]) / 2 + 0.25, 1]);
  for (let t = ts; t <= te; t += 0.18) {
    const [x, y] = E(t);
    pts.push([x, y, 1]);
  }
  const [ex, ey] = E(te);
  pts.push([ex + 0.15, ey + tailUp * 0.55, 0.6], [ex - 0.25, ey + tailUp, 0.2]);
  // replace the ink after the join with the new curve
  const lx = J.x - G.x,
    ly = J.y - G.y;
  let best: { d: number; si: number; qi: number } | null = null;
  S.b.strokes.forEach((st, si) =>
    st.s.forEach((q, qi) => {
      const d = Math.hypot(q.x - lx, q.y - ly);
      if (!best || d < best.d) best = { d, si, qi };
    }),
  );
  const at = best! as { d: number; si: number; qi: number },
    st = S.b.strokes[at.si];
  // a free bowl is the whole letter: its head, a short tooth turning in at the top, then the bowl, as one stroke
  if (free) {
    const head: SkelPt[] = [[J.x + 1.7, J.y + 0.2, 0.45], [J.x + 1.0, J.y + 0.95, 1], [J.x + 0.2, J.y + 0.45, 1]];
    st.s = sampleStroke([...head, ...pts.slice(1)].map(([x, y, w]) => [x - G.x, y - G.y, w] as SkelPt), th.style.tension); // prettier-ignore
  } else st.s = st.s.slice(0, at.qi + 1).concat(sampleStroke(pts.slice(1).map(([x, y, w]) => [x - G.x, y - G.y, w] as SkelPt), th.style.tension)); // prettier-ignore
  // the letter's vowels sit at its start; its dots inside the bowl, low and to the left
  B.g = {
    s: [
      {
        pts: [
          [0, 0, 1],
          [-1.4 / sc, -0.5 / sc, 1],
        ],
      },
    ],
    exit: null,
  };
  const dg = S.b.dotGroups.find(d => d.li === B.li);
  if (dg) {
    const at = (t: number): [number, number] => {
      const a = t >= 0 ? aL : aR,
        tx = cx - a * t,
        cth = Math.acos(Math.max(-1, Math.min(1, (tx - cx) / a)));
      return [tx, cy - b * Math.sin(cth) + 1.7]; // just inside the curve at that point
    };
    // the other letters' dots, so the bowl's own do not join them (a nun's beside a ya's pair reads as a third)
    const dots = r.shapes.flatMap((S2, i) => (i === gi ? [] : S2.b.dotGroups.map(d => [d.x + r.st[i].x, d.y + r.st[i].y]))); // prettier-ignore
    const room = ([x, y]: [number, number]) => Math.min(1e9, ...dots.map(([a, c]) => Math.hypot(x - a, y - c)));
    const cands = [0, 0.15, -0.15, 0.3, -0.3, 0.42, -0.42].map(at),
      [tx, ty] =
        o.dotAt != null
          ? at(o.dotAt)
          : (cands.find(q => room(q) >= th.style.nib * 3) ?? cands.reduce((m, q) => (room(q) > room(m) ? q : m)));
    // the letter it belongs to lies beneath dots above it (a nun's) and above dots below it (a ya's)
    const [top, bot] = dg.side > 0 ? [ty - 1.2, ty - 2] : [ty + 1.6, ty + 0.9];
    Object.assign(dg, { x: tx - G.x, y: ty - G.y, x0: tx - G.x - 1, x1: tx - G.x + 1, top: top - G.y, bot: bot - G.y }); // prettier-ignore
  }
  // the frame around the new ink
  const ink: [number, number][] = [];
  r.shapes.forEach((S2, i) =>
    S2.b.strokes.forEach(s2 => s2.s.forEach(q => ink.push([q.x + r.st[i].x, q.y + r.st[i].y]))),
  );
  const xs = ink.map(q => q[0]),
    ys = ink.map(q => q[1]),
    mx = (Math.min(...xs) + Math.max(...xs)) / 2,
    my = (Math.min(...ys) + Math.max(...ys)) / 2,
    Wd = Math.max(...xs) - Math.min(...xs),
    Hd = Math.max(...ys) - Math.min(...ys);
  // the smallest oval holding the ink: search its centre and (if asked) its proportions together
  const hull = ink.filter((_, i) => i % 3 === 0);
  let bestE: { area: number; cx: number; cy: number; R: number; v: number } | null = null;
  const ovs = o.autoOval ? [1.2, 1.35, 1.5, 1.65, 1.8, 2.0, 2.2] : [ov];
  for (const v of ovs)
    for (let dx = -0.2; dx <= 0.2001; dx += 0.05)
      for (let dy = -0.2; dy <= 0.2001; dy += 0.05) {
        const ccx = mx + dx * Wd,
          ccy = my + dy * Hd;
        let R2 = 0;
        hull.forEach(([x, y]) => (R2 = Math.max(R2, Math.hypot((x - ccx) / v, y - ccy))));
        const area = R2 * R2 * v * (1 + 0.15 * Math.abs(v - 1.5));
        if (!bestE || area < bestE.area) bestE = { area, cx: ccx, cy: ccy, R: R2, v };
      }
  const e = bestE!;
  r.disc = { ...r.disc, cx: e.cx, cy: e.cy, r: e.R + 0.8, oval: e.v };
  return r;
}

export interface FrameOptions extends FinishOptions {
  ovals?: number[];
  ovalPull?: number;
  ovalPref?: number;
}
/** Fit the frame to everything drawn (letters, dots and vowels), then solve the marks again inside it. */
export function fitFrame(th: Thuluth, r: Roundel, o: FrameOptions = {}): Finished {
  const nib = th.style.nib;
  let f = finishRoundel(th, r, '', o);
  for (let pass = 0; pass < 2; pass++) {
    const units = roundelParts(r, { solved: f.solved, companion: f.companion }),
      pts: [number, number, number][] = [];
    units.forEach(u => {
      if (u.s) u.s.forEach((q, i) => i % 2 === 0 && pts.push([q.x, q.y, (u.nib || nib) * 0.7]));
      if (u.dot) pts.push([u.dot[0], u.dot[1], nib * 0.8]);
    });
    const xs = pts.map(q => q[0]),
      ys = pts.map(q => q[1]),
      mx = (Math.min(...xs) + Math.max(...xs)) / 2,
      my = (Math.min(...ys) + Math.max(...ys)) / 2,
      Wd = Math.max(...xs) - Math.min(...xs),
      Hd = Math.max(...ys) - Math.min(...ys);
    let best: { area: number; cx: number; cy: number; R: number; v: number } | null = null;
    for (const v of o.ovals || [1.0, 1.15, 1.3, 1.45, 1.6, 1.8, 2.0, 2.2])
      for (let dx = -0.15; dx <= 0.1501; dx += 0.03)
        for (let dy = -0.15; dy <= 0.1501; dy += 0.03) {
          const ccx = mx + dx * Wd,
            ccy = my + dy * Hd;
          let R = 0;
          pts.forEach(([x, y, m]) => (R = Math.max(R, Math.hypot((x - ccx) / v, y - ccy) + m)));
          const area = R * R * v * (1 + (o.ovalPull ?? 0.12) * Math.abs(v - (o.ovalPref || 1.5)));
          if (!best || area < best.area) best = { area, cx: ccx, cy: ccy, R, v };
        }
    const e = best!;
    r.disc = { ...r.disc, cx: e.cx, cy: e.cy, r: e.R / 1.02, oval: e.v };
    f = finishRoundel(th, r, '', o);
    f.discScale = 1.0;
  }
  return f;
}

/** Clashes: sampled points of a group's strokes that come within a pen's width of another group's (two letters
 *  that touch or nearly do), over every pair but the neighbouring pieces of one word, which are set close on
 *  purpose. 0 when every letter keeps clear. */
export function clashes(th: Thuluth, r: Roundel, near = th.style.nib * 1.3): number {
  const cell = near,
    grid = new Map<string, [number, number, number][]>(),
    key = (x: number, y: number) => Math.floor(x / cell) + ',' + Math.floor(y / cell);
  const pts = r.shapes.map((S, i) => S.b.strokes.flatMap(st => st.s.filter((_, k) => k % 2 === 0).map(q => [q.x + r.st[i].x, q.y + r.st[i].y] as [number, number]))); // prettier-ignore
  pts.forEach((ps, i) =>
    ps.forEach(([x, y]) => {
      const k = key(x, y);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k)!.push([x, y, i]);
    }),
  );
  const apart = (i: number, j: number) => i !== j && !(r.groups[i].word === r.groups[j].word && Math.abs(i - j) === 1);
  let n = 0;
  pts.forEach((ps, i) =>
    ps.forEach(([x, y]) => {
      const cx = Math.floor(x / cell),
        cy = Math.floor(y / cell);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const [qx, qy, j] of grid.get(cx + dx + ',' + (cy + dy)) || [])
            if (apart(i, j) && Math.hypot(qx - x, qy - y) < near) {
              n++;
              return;
            }
    }),
  );
  return n;
}

/** How crowded the marks are: overlap between the boxes of dots and vowels. */
export function crowding(f: Finished): number {
  const its = f.solved?.items || [];
  let c = 0;
  for (let i = 0; i < its.length; i++)
    for (let j = i + 1; j < its.length; j++) {
      const a = its[i],
        b = its[j],
        gap = Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.y - b.y) - (a.h + b.h) / 2);
      if (gap < 0.9) c += (0.9 - gap) ** 2;
    }
  return c;
}

export interface TailOptions {
  /** The letters whose tails are drawn out (default ra, zay, waw, ya). */
  letters?: string;
  /** Clearance under what nests in the tail, and how far the tail runs past it. */
  gap?: number;
  reach?: number;
  /** The tail's course: an inset of the great bowl's curve, running parallel to it (bowl, the default; level where
   *  there is no bowl), or level. */
  follow?: 'bowl' | 'level';
  /** The bowl's options, so its curve can be foreseen before it is drawn. */
  bowl?: BowlOptions;
  /** A word's last tail runs on under the next word too, which nests in it. */
  across?: boolean;
  /** A word's last tail with nothing nested in it is drawn out this far all the same (pen units; default: left). */
  free?: number;
  /** A level course dips by this much at its middle, so the tail swoops (pen units; default 0). */
  sag?: number;
  /** A joined letter whose tail runs on under the next word is written with its head, a tooth rising from the join,
   *  and the tail falls from the top of it (as the free-standing great nun has its head). */
  head?: boolean;
  /** Its dots along the drawn-out run, just inside it: 0 the middle, -1 its start, 1 its end (default: left). */
  dotAt?: number;
}

/** Draw out the tail of a letter that has the rest of its word nested in it (a ra, a waw) as a long, level stroke
 *  under all of it, turning up at its end: the nested pieces sit on it as on a tughra's arm laid flat, so the lines of
 *  a composition read as layers (a word, its tail, the next word, its tail, the bowl). */
export function extendTails(th: Thuluth, r: Roundel, o: TailOptions = {}): Roundel {
  const set = o.letters ?? 'رزوي',
    gap = o.gap ?? th.style.nib + 0.6,
    reach = o.reach ?? 0.6;
  // a great final bowl (a nun or ya going deep) holds everything, so it is not among what a tail runs under
  const deep = (j: number) => {
    const L = letters(r, j).pop();
    return !!L && 'نيى'.includes(L.c) && Math.min(...L.g.s.flatMap(st => st.pts.map(q => q[1]))) < -3.2;
  };
  // the bowl's curve as it will be drawn, which the tails run parallel to, inset
  // with no great bowl, the oval round all the ink stands in for it, so tails still curve with the composition
  const inkOval = () => {
    let X0 = 1e9,
      X1 = -1e9,
      Y0 = 1e9,
      Y1 = -1e9;
    r.shapes.forEach((S, j) =>
      S.b.strokes.forEach(st =>
        st.s.forEach(q => {
          X0 = Math.min(X0, q.x + r.st[j].x);
          X1 = Math.max(X1, q.x + r.st[j].x);
          Y0 = Math.min(Y0, q.y + r.st[j].y);
          Y1 = Math.max(Y1, q.y + r.st[j].y);
        }),
      ),
    );
    const half = (X1 - X0) / 2 + 2;
    return { gi: -1, cx: (X0 + X1) / 2, cy: (Y0 + Y1) / 2, aL: half, aR: half, b: (Y1 - Y0) / 2 + 3 };
  };
  const bo = o.follow === 'level' ? null : (bowlOval(th, r, o.bowl) ?? inkOval()),
    inset = (d: number, x: number) => {
      if (!bo) return NaN;
      const a = (x < bo.cx ? bo.aL : bo.aR) - d,
        t = (x - bo.cx) / a;
      return Math.abs(t) < 1 ? bo.cy - (bo.b - d) * Math.sqrt(1 - t * t) : NaN;
    };
  // every letter, to keep a tail's course clear of what does not nest in it
  const allInk = (skip: Set<number>) =>
    r.groups.flatMap((_, j) =>
      skip.has(j) || (bo && j === bo.gi)
        ? []
        : letters(r, j).flatMap(p =>
            p.g.s.flatMap(
              st =>
              st.pts.map(q => [r.st[j].x + p.ox + q[0] * (r.groups[j].sc || 1), r.st[j].y + (p.oy || 0) + q[1] * (r.groups[j].sc || 1)] as [number, number]), // prettier-ignore
            ),
          ),
    );
  // the last tails first, so a tail with another tail nested in it runs beneath that one as drawn out
  for (let i = r.groups.length - 1; i >= 0; i--) {
    const g = r.groups[i],
      P = r.shapes[i].b.placed.filter(isLetter).pop();
    if (!P || !set.includes(P.c)) continue;
    const last = !r.groups[i + 1] || r.groups[i + 1].word !== g.word,
      after = r.groups
        .map((_, j) => j)
        .filter(
          j =>
            j > i &&
            (r.groups[j].word === g.word
              ? !r.groups[j].newWord
              : o.across && last && r.groups[j].word === g.word + 1) &&
            !deep(j),
        );
    if (!after.length && !(o.free && last)) continue;
    // what nests: the rest of the word's letters (and with `across` the next word), in composition coordinates
    let fx0 = 1e9,
      fy0 = 1e9;
    const nested: [number, number][] = [];
    after.forEach(j => {
      const s2 = r.groups[j].sc || 1;
      letters(r, j).forEach(p =>
        p.g.s.forEach(st =>
          st.pts.forEach(q => {
            const x = r.st[j].x + p.ox + q[0] * s2,
              y = r.st[j].y + (p.oy || 0) + q[1] * s2;
            nested.push([x, y]);
            fx0 = Math.min(fx0, x);
            fy0 = Math.min(fy0, y);
          }),
        ),
      );
    });
    const sc = r.groups[i].sc || 1,
      O = { x: r.st[i].x + P.ox, y: r.st[i].y + (P.oy || 0) },
      // the tail is the stroke that goes lowest
      si = P.g.s.reduce((m, st, k) => (Math.min(...st.pts.map(q => q[1])) < Math.min(...P.g.s[m].pts.map(q => q[1])) ? k : m), 0), // prettier-ignore
      pts = P.g.s[si].pts,
      // from the bottom of the tail's own curve
      k = pts.reduce((m, q, a) => (q[1] < pts[m][1] ? a : m), 0);
    if (k < 1) continue;
    if (!after.length) {
      // a free tail: as if something as long as `free` sat on it, level with its own bottom
      fx0 = O.x + (pts[k][0] - o.free!) * sc;
      fy0 = O.y + pts[k][1] * sc + gap;
    }
    const [xk, yk] = pts[k],
      Ly = Math.min((fy0 - gap - O.y) / sc, yk),
      xe = (fx0 - reach - O.x) / sc;
    if (xe > xk - 3) continue;
    // the tail leaves the letter where its own tail starts to fall, and from there is one curve: down onto its course,
    // along it, and up at its end
    const k0 = Math.max(1, pts.findIndex(q => q[1] < 0) - 1),
      // with its head: along from the join, up into the tooth, and the tail falls from its top
      headed = o.head && P.form === 'fin' && after.some(j => r.groups[j].word !== g.word),
      lead: SkelPt[] = headed
        ? [
            [0, 0, 1],
            [-0.7, 0.05, 1],
            [-1.25, 0.55, 0.95],
            [-1.45, 1.35, 0.7],
          ]
        : pts.slice(0, k0 + 1).map(([x, y, w]) => [x, y, w ?? 1] as SkelPt),
      run = lead[lead.length - 1][0] - xk + 1.2;
    if (xe + 1.4 > xk - run) continue;
    let course: SkelPt[] | null = null;
    if (bo) {
      // the highest inset of the bowl's curve that passes beneath what nests (by the gap) and clear of other letters
      const x0 = O.x + (xk - run) * sc,
        x1 = Math.max(xe, bo.cx - bo.aL * 0.97),
        others = allInk(new Set([i, ...after]));
      const xs: number[] = [];
      for (let X = x0; X > x1 + 1.4 * sc; X -= 0.7 * sc) xs.push(X);
      xs.push(x1 + 1.4 * sc);
      for (let d = bo.b - 1; d >= 0 && !course; d -= 0.2) {
        const ys = xs.map(X => inset(d, X));
        if (ys.some(y => Number.isNaN(y))) continue;
        const at = (x: number) => ys[Math.max(0, Math.min(ys.length - 1, Math.round((x0 - x) / (0.7 * sc))))];
        const under = nested.every(([x, y]) => x < x1 || x > x0 || at(x) <= y - gap),
          apart = others.every(([x, y]) => x < x1 || x > x0 || Math.abs(at(x) - y) > gap);
        if (under && apart) course = xs.map((X, m) => [(X - O.x) / sc, (ys[m] - O.y) / sc, 1] as SkelPt);
      }
    }
    if (!course && (o.follow === 'level' || !bo)) {
      // level, if that too keeps clear of the letters that do not nest in it
      const x0 = O.x + (xk - run) * sc,
        a = xk - run,
        e = xe + 1.4,
        // the course in the letter's units at x: level, or dipping by `sag` at its middle
        yAt = (x: number) => Ly - (o.sag ?? 0) * Math.sin((Math.PI * (a - x)) / (a - e));
      if (
        allInk(new Set([i, ...after])).every(
          ([x, y2]) => x < O.x + xe * sc || x > x0 || Math.abs(y2 - (O.y + yAt((x - O.x) / sc) * sc)) > gap,
        )
      ) {
        // sampled along its length, so the tail can join it part way
        const ls: SkelPt[] = [];
        for (let X = a; X > e; X -= 0.7) ls.push([X, yAt(X), 1]);
        course = [...ls, [e, Ly - 0.05, 1]];
      }
    }
    // no clear course: the tail stays as written
    if (!course) continue;
    // onto the course along a cubic that leaves the letter in the direction its tail was going and arrives along the
    // course, joining it a little further on than the drop is deep
    const [ax, ay] = lead[lead.length - 1],
      [bx, by] = headed ? [ax - 0.3, ay - 1] : (pts[k0 + 1] ?? pts[k0]),
      drop = Math.max(1, ay - course[0][1]),
      j = Math.max(
        1,
        course.findIndex(q => q[0] < ax - drop * 1.3),
      );
    if (j >= course.length - 1) continue;
    const [jx, jy] = course[j],
      [tx, ty] = [jx - course[j - 1][0], jy - course[j - 1][1]],
      dl = Math.hypot(bx - ax, by - ay) || 1,
      tl = Math.hypot(tx, ty) || 1,
      h = Math.hypot(jx - ax, jy - ay) * 0.4,
      c1 = [ax + ((bx - ax) / dl) * h, ay + ((by - ay) / dl) * h],
      c2 = [jx - (tx / tl) * h, jy - (ty / tl) * h];
    const ease: SkelPt[] = [0.2, 0.4, 0.6, 0.8].map(t => {
      const u = 1 - t;
      return [
        u * u * u * ax + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * jx,
        u * u * u * ay + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * jy,
        1,
      ];
    });
    const [lx, ly] = course[course.length - 1],
      tail: SkelPt[] = [...lead, ...ease, ...course.slice(j), [lx - 1.1, ly + 0.4, 0.6], [lx - 1.5, ly + 1.15, 0.2]];
    // the tail as it will be drawn keeps a pen's width from every other letter as drawn (but the piece nested right
    // after it, and the great bowl, which is redrawn later); otherwise it stays as written
    const drawn = sampleStroke(
        tail.map(([x, y, w]) => [O.x + x * sc, O.y + y * sc, w] as SkelPt),
        th.style.tension,
      ),
      near = th.style.nib * 1.3,
      kept = r.shapes.flatMap((S2, j) =>
        j === i || j === i + 1 || (bo && j === bo.gi)
          ? []
          : S2.b.strokes.flatMap(st2 => st2.s.map(q => [q.x + r.st[j].x, q.y + r.st[j].y] as [number, number])),
      );
    if (drawn.some(q => kept.some(([x, y]) => Math.abs(x - q.x) < near && Math.hypot(x - q.x, y - q.y) < near)))
      continue;
    // with its head, the letter's marks sit at its head (as the great bowl's at its start): the solver sees the head
    P.g = { ...P.g, s: P.g.s.map((st, m) => (m === si ? { ...st, pts: headed ? lead : tail } : st)) };
    // the drawn stroke: the letter redrawn from where it begins, as one curve with no corners of its own
    const S = r.shapes[i],
      [sx, sy] = pts[0],
      cx = P.ox + sx * sc,
      cy = (P.oy || 0) + sy * sc;
    // where the letter begins: a stroke of its own that starts there (the stroke of the letter before, ending at the
    // join, is not it), else the first sample there (a loop like the waw's head comes back past its own start)
    const own = S.b.strokes.findIndex(st2 => st2.s.length && Math.hypot(st2.s[0].x - cx, st2.s[0].y - cy) < 0.3);
    let best = { d: 1e9, si: Math.max(0, own), qi: 0 };
    if (own < 0)
      S.b.strokes.forEach((st, a) =>
        st.s.forEach((q, b) => {
          const d = Math.hypot(q.x - cx, q.y - cy);
          if (d < best.d - 0.15) best = { d, si: a, qi: b };
        }),
      );
    const st = S.b.strokes[best.si];
    r.tailsDrawn = (r.tailsDrawn ?? 0) + 1;
    st.s = st.s.slice(0, best.qi).concat(sampleStroke(tail.map(([x, y, w]) => [P.ox + x * sc, (P.oy || 0) + y * sc, w] as SkelPt), th.style.tension)); // prettier-ignore
    // its dots on their own side of the run (a ya's below it, a nun's above), at `dotAt` along it
    const dg = o.dotAt != null ? S.b.dotGroups.find(d => d.li === P.li) : undefined;
    if (dg) {
      const nib = th.style.nib,
        xm = (ax + lx) / 2 + (o.dotAt! * (lx - ax)) / 2,
        near = course.reduce((m, q) => (Math.abs(q[0] - xm) < Math.abs(m[0] - xm) ? q : m)),
        dx = P.ox + xm * sc,
        ly2 = (P.oy || 0) + near[1] * sc,
        dy = ly2 + (dg.side > 0 ? nib * 1.3 : -nib * 1.5);
      Object.assign(dg, { x: dx, y: dy, x0: dx - 1, x1: dx + 1, top: ly2 + nib * 0.5, bot: ly2 - nib * 0.5 });
    }
  }
  return r;
}

export interface RiseOptions {
  /** Clearance kept below the oval the stems rise into, and the most a stem may grow (times its height). */
  margin?: number;
  most?: number;
  /** Width over height of the oval they rise into, built on the composition's width (default 1.3). */
  oval?: number;
}

/** Let the tall stems (alif, lam) rise into the empty space above them: each is stretched upward, from a little above
 *  its foot, until it nears an oval of the given proportion standing on the composition's width and bottom (a wide
 *  bowl leaves room above the letters that the stems can take), or would meet ink above it. */
export function riseStems(th: Thuluth, r: Roundel, o: RiseOptions = {}): Roundel {
  const d = r.disc,
    a = d.r * (d.oval || 1),
    b = a / (o.oval ?? 1.3),
    cy = d.cy - d.r + b,
    margin = o.margin ?? th.style.nib * 2.2,
    most = o.most ?? 1.8;
  const top = (x: number) => {
    const t = (x - d.cx) / a;
    return Math.abs(t) < 1 ? cy + b * Math.sqrt(1 - t * t) - margin : -1e9;
  };
  r.groups.forEach((g, i) => {
    const sc = g.sc || 1;
    letters(r, i).forEach(p => {
      if (!'اأإلك'.includes(p.c)) return;
      const ys = p.g.s.flatMap(st => st.pts.map(q => q[1]));
      const h = Math.max(...ys);
      if (h < 6) return;
      const xs = p.g.s.flatMap(st => st.pts.filter(q => q[1] > h * 0.6).map(q => q[0]));
      const x0 = Math.min(...xs) - 0.6,
        x1 = Math.max(...xs) + 0.6,
        G = r.st[i],
        foot = 1.5,
        X = G.x + p.ox + ((x0 + x1) / 2) * sc,
        Y0 = G.y + (p.oy || 0);
      // ink of every other group in this column, above the stem
      let ceil = top(X);
      r.shapes.forEach((S2, j) => {
        if (j === i) return;
        S2.b.strokes.forEach(st =>
          st.s.forEach(q => {
            const qx = q.x + r.st[j].x,
              qy = q.y + r.st[j].y;
            if (qx > G.x + p.ox + x0 * sc - 1 && qx < G.x + p.ox + x1 * sc + 1 && qy > Y0 + h * sc)
              ceil = Math.min(ceil, qy - th.style.nib * 1.6);
          }),
        );
      });
      const H = Math.min((ceil - Y0) / sc, h * most);
      if (H <= h + 0.5) return;
      const k = (H - foot) / (h - foot),
        up = (y: number) => (y > foot ? foot + (y - foot) * k : y);
      p.g = { ...p.g, s: p.g.s.map(st => ({ ...st, pts: st.pts.map(([x, y, w, c]) => [x, up(y), w, c] as SkelPt) })) };
      const lx0 = p.ox + x0 * sc,
        lx1 = p.ox + x1 * sc,
        oy = p.oy || 0;
      r.shapes[i].b.strokes.forEach(st => {
        st.s = st.s.map(q =>
          q.x > lx0 && q.x < lx1 && q.y - oy > foot * sc ? { ...q, y: oy + up((q.y - oy) / sc) * sc } : q,
        );
      });
      r.risen = (r.risen ?? 0) + 1;
    });
  });
  return r;
}

/** Scale one group of letters about its own origin (a smaller conjunction, say); its marks scale with it. */
export function scaleGroup(th: Thuluth, r: Roundel, gi: number, s: number) {
  const S = r.shapes[gi],
    g = r.groups[gi];
  S.b.strokes.forEach(st => {
    st.s = st.s.map(q => ({ x: q.x * s, y: q.y * s, w: q.w }));
    st.nib = (st.nib || th.style.nib) * s;
  });
  S.b.dots = S.b.dots.map(([x, y, sc]) => [x * s, y * s, (sc || 1) * s]);
  S.b.dotGroups.forEach(d => {
    for (const f of ['x', 'y', 'x0', 'x1', 'top', 'bot'] as const) d[f] *= s;
    d.sc = (d.sc || 1) * s;
  });
  S.b.placed.forEach(p => {
    if (isLetter(p)) {
      p.ox *= s;
      p.oy = (p.oy || 0) * s;
    }
  });
  S.x0 *= s;
  S.x1 *= s;
  S.y0 *= s;
  S.y1 *= s;
  g.sc = (g.sc || 1) * s;
}

/** The ink box of one group, in composition coordinates. */
export function groupBox(r: Roundel, gi: number) {
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  r.shapes[gi].b.strokes.forEach(st =>
    st.s.forEach(q => {
      x0 = Math.min(x0, q.x);
      x1 = Math.max(x1, q.x);
      y0 = Math.min(y0, q.y);
      y1 = Math.max(y1, q.y);
    }),
  );
  const { x, y } = r.st[gi];
  return { x0: x0 + x, x1: x1 + x, y0: y0 + y, y1: y1 + y };
}

/** Put a group centred under the last letter of another group (the conjunction under Zainab's ba). */
export function placeUnder(r: Roundel, gi: number, under: number, gap = 1.0, dx = 0) {
  const S = r.shapes[under],
    p = S.b.placed.filter(isLetter).pop()!,
    sc = r.groups[under].sc || 1;
  const xs = p.g.s.flatMap(st => st.pts.map(q => r.st[under].x + p.ox + q[0] * sc)),
    ys = p.g.s.flatMap(st => st.pts.map(q => r.st[under].y + (p.oy || 0) + q[1] * sc));
  let bot = Math.min(...ys);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2 + dx,
    b = groupBox(r, gi);
  // clear the letter's own dots below it too
  S.b.dotGroups.filter(d => d.li === p.li && d.side < 0).forEach(d => (bot = Math.min(bot, r.st[under].y + d.y - 1.0)));
  r.st[gi] = { x: r.st[gi].x + cx - (b.x0 + b.x1) / 2, y: r.st[gi].y + (bot - gap) - b.y1 };
}
