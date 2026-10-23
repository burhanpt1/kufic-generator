// The roundel and cartouche composer (lab roundel.js composeRoundel): the groups of a phrase are placed by simulated
// annealing to fill a disc or an oval, keeping the reading order, with word moves, variant swaps, and lifts onto
// shelves (an elongation, a long final) and into cradles (a great bowl). A recorded layout (`fixed`) rebuilds a chosen
// arrangement exactly, so letters can be refined without the layout reshuffling.
import type { Thuluth } from '../engine';
import { ligate, parseVowels, splitGroups } from '../shape';
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
}
/** A pinned arrangement: the variant of each group, and where each word sits. */
export interface Layout {
  lv: number[];
  wp: { x: number; y: number }[];
  /** The stacked pieces (by index), if any. */
  up?: number[];
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
  /** A reading path (paths.ts): the words keep near their targets along it, in reading order. A name from PATHS, or
   *  the path itself. */
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
  fixed?: Layout;
  /** Words that must sit on a shelf of a group of another word (an elongation or a long final): `at` names the
   *  elongation by the letter it leads into (index in the group); without it any shelf of the group will do. With
   *  `tail`, the word nests instead over the group's final tail, to its left and just above its bottom, for the tail
   *  to be drawn out beneath it (extendTails with `across`). */
  seat?: Seat[];
}
export interface Seat {
  word: number;
  on: number;
  at?: number;
  tail?: boolean;
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
  /** The lanes fitted, if lanes were asked for. */
  lanes?: { n: number; gap: number };
  /** Tails drawn out under what nests in them; stems risen into the space above. */
  tailsDrawn?: number;
  risen?: number;
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

export function composeRoundel(th: Thuluth, text: string, o: RoundelOptions = {}): Roundel[] {
  const tries = o.tries ?? 18,
    iters = o.iters ?? 6000,
    K = o.K ?? 1.6,
    seed = o.seed ?? 7;
  const { bare, marks } = parseVowels(text);
  const groups: RGroup[] = splitGroups(bare);
  if (!groups.length) return [];
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
  });
  const shapes = groups.map(g => {
    const vs = groupVariants(th, g, { ...o, deep: true, tails: true, levels: o.levels ?? [0, 2, 4, 7] }, K),
      st = o.stackAt?.includes(g.s) ? vs.filter(v => v.stacked) : [];
    return st.length ? st : vs;
  });
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
    for (let y = ys; y < ye; y++) {
      const ra = y * A.W,
        rb = (y - dy) * B.W - dx;
      for (let x = xs; x < xe; x++) {
        const ta = src[ra + x],
          tb = B.mask[rb + x];
        // a stem may pass through a horizontal (in girift it is sought, and never at a curve or eye)
        if (ta && tb)
          c += (ta === 1 && tb === 2) || (ta === 2 && tb === 1) ? cw : ta === 1 && tb === 1 ? mw : ta === 3 || tb === 3 ? curve : 1; // prettier-ignore
      }
    }
    return c;
  };
  const results: Roundel[] = [];
  for (let t = 0; t < tries; t++) {
    let sd = seed + t * 7919;
    const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const lv = groups.map((_, i) => Math.floor(R() * shapes[i].length)),
      wp = words.map(() => ({ x: 0, y: 0 })),
      gpos: { x: number; y: number }[] = new Array(n),
      // stacked pieces (lifted above the piece before them)
      up = new Uint8Array(n);
    // inside a word, a break after a non-joining letter is kerned: the next piece slides right until it would touch
    const kern = new Map<string, number>(),
      kernOf = (i: number, j: number) => {
        const key = i + ':' + lv[i] + '|' + j + ':' + lv[j];
        if (kern.has(key)) return kern.get(key)!;
        const A = shapes[i][lv[i]],
          B = shapes[j][lv[j]];
        let k = 0;
        for (let s = 0.25; s <= 4.01; s += 0.25) {
          const bx = -B.x1 + A.x0 - GAP + s;
          if (pairOverlap(A, 0, 0, B, bx, 0, true) > (o.kernTouch ?? 3)) break;
          k = s;
        }
        kern.set(key, k);
        return k;
      };
    // a piece after a ra or zay nests in its tail: of the places where it does not touch (with its margin), the one
    // furthest over the tail, a drop costing as much as half its length in slide
    const nests = new Map<string, [number, number]>(),
      nestOf = (i: number, j: number): [number, number] => {
        const key = i + ':' + lv[i] + '|' + j + ':' + lv[j];
        if (nests.has(key)) return nests.get(key)!;
        const A = shapes[i][lv[i]],
          B = shapes[j][lv[j]];
        let best: [number, number] = [0, 0],
          bs = -1e9;
        for (let dy = 0; dy >= -3.01; dy -= 0.25)
          for (let sx = 0; sx <= 8.01; sx += 0.25) {
            const bx = -B.x1 + A.x0 - GAP + sx;
            if (pairOverlap(A, 0, 0, B, bx, dy) > (o.kernTouch ?? 3)) break;
            const sc = sx + dy * 0.5;
            if (sc > bs) {
              bs = sc;
              best = [sx, dy];
            }
          }
        nests.set(key, best);
        return best;
      };
    const tailed = (i: number) => /[رزوي]$/.test(groups[i].s);
    // a stacked piece: lifted above the one before by the least that clears it, slid back over it as far as it goes
    const stacks = new Map<string, [number, number]>(),
      stackOf = (i: number, j: number): [number, number] => {
        const key = i + ':' + lv[i] + '|' + j + ':' + lv[j];
        if (stacks.has(key)) return stacks.get(key)!;
        const A = shapes[i][lv[i]],
          B = shapes[j][lv[j]],
          lift0 = Math.max(1.5, A.y1 - B.y0 - 6);
        let best: [number, number] = [0, A.y1 - B.y0 + 0.8],
          bs = -1e9;
        for (let dy = lift0; dy <= A.y1 - B.y0 + 0.8; dy += 0.5)
          for (let sx = 0; sx <= A.x1 - A.x0 + 0.01; sx += 0.5) {
            const bx = -B.x1 + A.x0 - GAP + sx;
            if (pairOverlap(A, 0, 0, B, bx, dy) > (o.kernTouch ?? 3)) break;
            const sc = sx - dy * 0.35;
            if (sc > bs) {
              bs = sc;
              best = [sx, dy];
            }
          }
        stacks.set(key, best);
        return best;
      };
    const layoutWord = (w: number) => {
      let cur = wp[w].x,
        prev = -1;
      words[w].forEach(gi => {
        const S = shapes[gi][lv[gi]];
        if (groups[gi].newWord) cur -= 1.4 * (groups[gi].sc || 1);
        let x = cur - S.x1,
          y = wp[w].y;
        if (up[gi] && prev >= 0 && !groups[gi].newWord) {
          const [sx, dy] = stackOf(prev, gi);
          x += sx;
          y = gpos[prev].y + dy;
        } else if (o.nest && prev >= 0 && !groups[gi].newWord && tailed(prev)) {
          const [sx, dy] = nestOf(prev, gi);
          x += sx;
          y = gpos[prev].y + dy;
        } else if (o.kern && prev >= 0 && !groups[gi].newWord) x += Math.max(0, kernOf(prev, gi) - 0.15);
        gpos[gi] = { x, y };
        cur = x + S.x0 - GAP * (groups[gi].sc || 1);
        prev = gi;
      });
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
      words[w].forEach(g2 => {
        const S = shapes[g2][lv[g2]],
          p = gpos[g2];
        x0 = Math.min(x0, p.x + S.x0);
        x1 = Math.max(x1, p.x + S.x1);
        y0 = Math.min(y0, p.y + S.y0);
        y1 = Math.max(y1, p.y + S.y1);
      });
      return { x0, x1, y0, y1 };
    };
    // on a reading path, words start at their targets (essential for the search to converge)
    let PP: ReadingPath | null = typeof o.path === 'string' ? (PATHS[o.path] ?? null) : (o.path ?? null),
      fitted: { n: number; gap: number } | undefined;
    const pFill = o.pathFill ?? 0.7;
    if (!PP && o.lanes && W > 1) {
      const bx0 = words.map((_, w) => wbox(w)),
        L = fitLanes(W, bx0.reduce((s2, q) => s2 + q.x1 - q.x0, 0), bx0.reduce((s2, q) => s2 + q.y1 - q.y0, 0) / W, o.lanes, pFill); // prettier-ignore
      PP = L.path;
      fitted = { n: L.n, gap: L.gap };
    }
    if (PP && W > 1) {
      const bx0 = words.map((_, w) => wbox(w)),
        T0 = pathTargets(
          PP,
          bx0.map(q => q.x1 - q.x0),
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
      words[a].forEach(i =>
        words[b].forEach(j => {
          const A = shapes[i][lv[i]],
            B = shapes[j][lv[j]];
          c += pairOverlap(A, gpos[i].x, gpos[i].y, B, gpos[j].x, gpos[j].y) + pairOverlap(B, gpos[j].x, gpos[j].y, A, gpos[i].x, gpos[i].y); // prettier-ignore
        }),
      );
      return c;
    };
    const recompute = (a: number) => {
      for (let b = 0; b < W; b++) if (b !== a) ov[a][b] = ov[b][a] = wordOverlap(a, b);
    };
    for (let a = 0; a < W; a++) recompute(a);
    // the disc: centred on the ink, radius reaching the furthest ink
    const disc = (): Disc => {
      const pts: [number, number][] = [];
      let sw = 0;
      groups.forEach((_, i) => {
        const S = shapes[i][lv[i]];
        sw += S.ink;
        S.hull.forEach(([hx, hy]) => pts.push([gpos[i].x + hx, gpos[i].y + hy]));
      });
      let x0 = 1e9,
        x1 = -1e9,
        y0 = 1e9,
        y1 = -1e9;
      pts.forEach(
        ([x, y]) => ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y))),
      );
      let cx = (x0 + x1) / 2,
        cy = (y0 + y1) / 2,
        r = 0;
      for (let it = 0; it < 12; it++) {
        // nudge the centre towards the furthest point (a quick smallest-enclosing circle)
        let far: [number, number] = pts[0],
          fd = -1;
        pts.forEach(p => {
          const dd = Math.hypot(p[0] - cx, p[1] - cy);
          if (dd > fd) {
            fd = dd;
            far = p;
          }
        });
        r = fd;
        cx += ((far[0] - cx) * 0.08) / (1 + it * 0.3);
        cy += ((far[1] - cy) * 0.08) / (1 + it * 0.3);
      }
      const ovl = o.oval || 1;
      r = 0;
      pts.forEach(p => (r = Math.max(r, Math.hypot((p[0] - cx) / ovl, p[1] - cy))));
      return { cx, cy, r: r + 0.8, ink: sw, oval: ovl };
    };
    const stackOrder = () =>
      o.stack
        ? orderFault(
            groups,
            groups.map((_, i) => {
              const S = shapes[i][lv[i]];
              return { x0: gpos[i].x + S.x0, x1: gpos[i].x + S.x1, y0: gpos[i].y + S.y0, y1: gpos[i].y + S.y1, base: gpos[i].y }; // prettier-ignore
            }),
            up,
          )
        : 0;
    const energy = () => {
      let o2 = 0;
      for (let a = 0; a < W; a++) for (let b = a + 1; b < W; b++) o2 += ov[a][b];
      let order = 0;
      const bx = words.map((_, w) => wbox(w));
      if (PP) {
        // each word near its target along the path (the whole text may shift)
        const T = pathTargets(
            PP,
            bx.map(q => q.x1 - q.x0),
            pFill,
          ),
          A = bx.map(q => [(q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2]),
          mx = A.reduce((s2, p, i) => s2 + p[0] - T[i][0], 0) / W,
          my = A.reduce((s2, p, i) => s2 + p[1] - T[i][1], 0) / W,
          tol = o.pathTol ?? 1.4;
        A.forEach((p, i) => {
          const d = Math.hypot(p[0] - T[i][0] - mx, p[1] - T[i][1] - my);
          if (d > tol) order += (o.pathW ?? 0.6) * (d - tol) ** 2;
        });
        if (o.readRule !== false) {
          // the eye reads across: a later word at about the same height as an earlier one must lie to its left
          const rowH = (bx.reduce((s2, q) => s2 + q.y1 - q.y0, 0) / W) * 0.45;
          for (let a = 0; a < W; a++)
            for (let b = a + 1; b < W; b++) {
              const dy = Math.abs(wp[b].y - wp[a].y);
              if (dy > rowH) continue;
              const v = bx[b].x1 - (bx[a].x0 + 1.0);
              if (v > 0) order += (o.readW ?? 1.5) * v * v * (1 - dy / rowH);
            }
          // and it reads downward: no later word climbs back above the one before
          for (let a = 0; a + 1 < W; a++) {
            const back = wp[a + 1].y - wp[a].y - (o.orderSlack ?? 1.0);
            if (back > 0) order += (o.orderFirm ?? 3) * back * back;
          }
        }
      } else
        for (let w = 0; w + 1 < W; w++) {
          const v = bx[w + 1].x1 - (bx[w].x1 - 1.5);
          if (v > 0) order += v * v;
        }
      if (o.topFirst)
        for (let w = 0; w + 1 < W; w++) {
          const ox2 = Math.min(bx[w].x1, bx[w + 1].x1) - Math.max(bx[w].x0, bx[w + 1].x0),
            wm = Math.min(bx[w].x1 - bx[w].x0, bx[w + 1].x1 - bx[w + 1].x0);
          if (ox2 > 0.35 * wm) {
            const dv = (bx[w + 1].y0 + bx[w + 1].y1) / 2 - (bx[w].y0 + bx[w].y1) / 2;
            if (dv > -1) order += 0.6 * (dv + 1) ** 2;
          }
        }
      let cost = 0;
      groups.forEach((_, i) => {
        cost += shapes[i][lv[i]].cost;
        if (i > 0 && shapes[i][lv[i]].elong && shapes[i - 1][lv[i - 1]].elong) cost += 2.5;
      });
      const d = disc(),
        fill = d.ink / (Math.PI * d.r * d.r * (o.oval || 1) * K * K);
      let bx0 = 1e9,
        bx1 = -1e9,
        by0 = 1e9,
        by1 = -1e9;
      groups.forEach((_, i) => {
        const S = shapes[i][lv[i]];
        bx0 = Math.min(bx0, gpos[i].x + S.x0);
        bx1 = Math.max(bx1, gpos[i].x + S.x1);
        by0 = Math.min(by0, gpos[i].y + S.y0);
        by1 = Math.max(by1, gpos[i].y + S.y1);
      });
      // balance: the ink's centre of mass near the centre of the disc
      let sx = 0,
        sy = 0;
      groups.forEach((_, i) => {
        const S = shapes[i][lv[i]];
        sx += (gpos[i].x + S.cx) * S.ink;
        sy += (gpos[i].y + S.cy) * S.ink;
      });
      const bal = Math.hypot(sx / d.ink - d.cx, sy / d.ink - d.cy) / d.r;
      let shelf = 0;
      if (o.elongate || o.emph)
        groups.forEach((g, i) => {
          const S = shapes[i][lv[i]];
          S.shelves.forEach(sh => {
            let cov = 0,
              tot = 0;
            for (let x = sh.x0 + 0.5; x < sh.x1 - 0.3; x += 0.6) {
              tot++;
              const gx = gpos[i].x + x,
                gy = gpos[i].y + sh.y;
              for (let j = 0; j < n && cov < tot; j++) {
                if (groups[j].word === g.word) continue;
                const T = shapes[j][lv[j]],
                  lx = Math.round((gx - gpos[j].x - T.x0) * K) + 1;
                if (lx < 0 || lx >= T.W) continue;
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
          });
        });
      // a later word may not rise above the first letters of the word before it (so the first name is read first)
      let rise = 0;
      if (o.noRise)
        for (let w = 0; w + 1 < W; w++) {
          const g0 = words[w][0],
            S0 = shapes[g0][lv[g0]],
            top0 = gpos[g0].y + S0.y1,
            v = bx[w + 1].y1 - top0;
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
      // a seated word over its shelf: how far it overhangs either end, and how far its line is from resting on it
      let seat = 0;
      for (const s of o.seat || []) {
        if (s.word >= W || s.on >= n) continue;
        const B = bx[s.word],
          base = Math.min(...words[s.word].map(i => gpos[i].y));
        let best = 30;
        const tl = s.tail && shapes[s.on][lv[s.on]].tailLow;
        if (tl) {
          // left of where the tail falls, its ink just clear above the tail's bottom
          const tx = gpos[s.on].x + tl[0],
            lift = B.y0 - (gpos[s.on].y + tl[1]);
          best = Math.max(0, B.x1 - (tx + 1)) + 2 * (Math.max(0, 1.4 - lift) + Math.max(0, lift - 4.5));
        }
        for (const sh of s.tail ? [] : shapes[s.on][lv[s.on]].shelves) {
          if (s.at != null && sh.at !== s.at) continue;
          const x0 = gpos[s.on].x + sh.x0,
            x1 = gpos[s.on].x + sh.x1,
            gap = base - (gpos[s.on].y + sh.y);
          best = Math.min(best, Math.max(0, x0 - B.x0) + Math.max(0, B.x1 - x1) + 2 * (Math.max(0, 1.2 - gap) + Math.max(0, gap - 4))); // prettier-ignore
        }
        seat += best;
      }
      return (
        6 * seat + 0.6 * ceil + 3 * o2 + 25 * order + 20 * stackOrder() + 30 * Math.abs(Math.log((bx1 - bx0) / (by1 - by0) / (o.oval || 1))) +
        110 * Math.max(0, (o.fillTarget || 0.36) - fill) + 25 * bal + cost - (o.emph ? 14 : 8) * shelf + 4 * rise
      ); // prettier-ignore
    };
    let E = energy(),
      T = 20;
    if (o.fixed) {
      // rebuild a recorded layout: the same variant of each piece, each word in the same place
      o.fixed.lv.forEach((v, i) => i < n && (lv[i] = Math.min(v, shapes[i].length - 1)));
      o.fixed.wp.forEach((p, w) => w < W && (wp[w] = { ...p }));
      (o.fixed.up || []).forEach(i => i < n && (up[i] = 1));
      for (let w = 0; w < W; w++) layoutWord(w);
      for (let a = 0; a < W; a++) recompute(a);
      E = energy();
    }
    // the pieces that can be stacked: not a word's first, not a companion's
    const stackable = o.stack ? groups.map((_, i) => i).filter(i => i > 0 && groups[i - 1].word === groups[i].word && !groups[i].newWord) : []; // prettier-ignore
    for (let it = 0; it < (o.fixed ? 0 : iters); it++) {
      const mv = R();
      let undo: () => void;
      if (stackable.length && mv < 0.1) {
        // lift a piece onto the one before it, or set it back down
        const gi = stackable[Math.floor(R() * stackable.length)],
          w = groups[gi].word;
        up[gi] ^= 1;
        layoutWord(w);
        recompute(w);
        undo = () => {
          up[gi] ^= 1;
          layoutWord(w);
          recompute(w);
        };
      } else if ((o.emph || o.elongate || o.seat?.length) && !PP && W > 1 && mv > (o.cradle ? 0.75 : 0.9)) {
        // (not on a reading path: the lift teleports whole words across the field)
        // lift a word onto a shelf (an elongated stroke or a long final sweep) or into a cradle
        // a seat lifts its word onto its own shelf
        const seat = o.seat?.length ? o.seat[Math.floor(R() * o.seat.length)] : null,
          seatShape = seat && shapes[seat.on]?.[lv[seat.on]],
          tl = seat?.tail && seatShape ? seatShape.tailLow : undefined,
          // a tail seat: the stretch to the left of where the tail falls, a little above its bottom
          seatShelf = tl
            ? { x0: tl[0] - 14, x1: tl[0] + 1, y: tl[1] + 1.4 }
            : seatShape && !seat.tail
              ? seatShape.shelves.find(s2 => seat.at == null || s2.at === seat.at)
              : undefined,
          withShelf = groups.map((_, i) => i).filter(i => shapes[i][lv[i]].shelves.length);
        if (seat && seatShelf && seat.word < W) {
          const gi = seat.on,
            sh = seatShelf,
            w = seat.word;
          const old = { ...wp[w] },
            bxw = wbox(w),
            sx0 = gpos[gi].x + sh.x0,
            sy = gpos[gi].y + sh.y,
            base = Math.min(...words[w].map(i => gpos[i].y));
          wp[w].x += sx0 + (bxw.x1 - bxw.x0) / 2 + 0.6 + R() * Math.max(0, sh.x1 - sh.x0 - (bxw.x1 - bxw.x0)) - (bxw.x0 + bxw.x1) / 2; // prettier-ignore
          wp[w].y += sy + 1.4 + R() * 2 - base;
          layoutWord(w);
          recompute(w);
          undo = () => {
            wp[w] = old;
            layoutWord(w);
            recompute(w);
          };
        } else if (withShelf.length) {
          const gi = withShelf[Math.floor(R() * withShelf.length)],
            shs = shapes[gi][lv[gi]].shelves,
            sh = shs.find(s2 => s2.cradle) || shs[0],
            others = words.map((_, w) => w).filter(w => w !== groups[gi].word),
            w = others[Math.floor(R() * others.length)];
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
            layoutWord(w);
            recompute(w);
          };
        } else undo = () => {};
      } else if (mv < 0.6 && W > 1) {
        const w = Math.floor(R() * W),
          old = { ...wp[w] },
          s = T > 2 ? 1 : 0.35;
        wp[w].x += (R() - 0.5) * 8 * s;
        wp[w].y += (R() - 0.5) * 8 * s;
        layoutWord(w);
        recompute(w);
        undo = () => {
          wp[w] = old;
          layoutWord(w);
          recompute(w);
        };
      } else {
        const g2 = Math.floor(R() * n),
          w = groups[g2].word,
          old = lv[g2];
        lv[g2] = Math.floor(R() * shapes[g2].length);
        layoutWord(w);
        recompute(w);
        undo = () => {
          lv[g2] = old;
          layoutWord(w);
          recompute(w);
        };
      }
      const E2 = energy();
      if (E2 <= E || R() < Math.exp((E - E2) / T)) E = E2;
      else undo();
      T = Math.max(0.03, T * Math.pow(0.03 / 20, 1 / iters));
    }
    let o2 = 0;
    for (let a = 0; a < W; a++) for (let b = a + 1; b < W; b++) o2 += ov[a][b];
    results.push({ E, overlap: o2, disc: disc(), st: gpos.map(p => ({ ...p })), shapes: groups.map((_, i) => shapes[i][lv[i]]), groups, lv: lv.slice(), wp: wp.map(p => ({ ...p })), up: [...up.keys()].filter(i => up[i]), lanes: fitted }); // prettier-ignore
    if (o.fixed) break;
  }
  results.sort((a, b) => a.E - b.E);
  return results;
}
