// Grid and line fillers: parallel lines of text (micrography), the Kufic maze, and monograms
// (lab composeFill, composeMaze/mazeCycle/mazeRuns and monoBuild).
import { bounds, inside } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import { partition, repeatSegs } from '../layout/solvers';
import type { FillerNode, RegionNode, Style } from '../model/schema';
import type { CellGrid } from '../monogram/grid';
import { G, markEnds, trimAt } from '../monogram/grid';
import { buildMonogram } from '../monogram/methods';
import type { MonoMethod, MonoParams } from '../monogram/methods';
import type { Segs } from '../types';
import { centreOf, registerFiller } from './fillers';
import type { Ctx, RegionResult } from './resolve';
import { layoutOpts } from './resolve';
import { weaveFill } from './weave';

// ---------- lines ----------
/** Horizontal crossings of a closed outline: y -> the inside intervals [x0, x1] along that line. Edges are bucketed
 *  by height so each query only looks at nearby edges (the results are the same as scanning every edge). */
export function crossingsOf(pts: Pt[]): (y: number) => [number, number][] {
  const n = pts.length,
    ys = pts.map(p => p[1]),
    Y0 = Math.min(...ys),
    Y1 = Math.max(...ys),
    K = Math.max(1, Math.min(512, n >> 1)),
    h = (Y1 - Y0) / K || 1;
  const slab = (y: number) => Math.min(K - 1, Math.max(0, Math.floor((y - Y0) / h)));
  const buckets: number[][] = Array.from({ length: K }, () => []);
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = slab(Math.min(pts[i][1], pts[j][1])),
      b = slab(Math.max(pts[i][1], pts[j][1]));
    for (let k = a; k <= b; k++) buckets[k].push(j);
  }
  return y => {
    const xs: number[] = [];
    if (y >= Y0 && y <= Y1)
      for (const j of buckets[slab(y)]) {
        const [x1, y1] = pts[j],
          [x2, y2] = pts[(j + 1) % n];
        if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    xs.sort((a, b) => a - b);
    const iv: [number, number][] = [];
    for (let k = 0; k + 1 < xs.length; k += 2) iv.push([xs[k], xs[k + 1]]);
    return iv;
  };
}
const ivIntersect = (A: [number, number][], B: [number, number][]) => {
  const out: [number, number][] = [];
  A.forEach(([a0, a1]) =>
    B.forEach(([b0, b1]) => {
      const lo = Math.max(a0, b0),
        hi = Math.min(a1, b1);
      if (hi > lo) out.push([lo, hi]);
    }),
  );
  return out;
};

/** A short text in a large region: keep only the middle lines it needs (about 1.25× its length), so it is set at full
 *  size in a centred block instead of being stretched thin or forcing the composition larger. */
function middleLines<T extends { yb: number; W: number }>(ivs: T[], total: number, centreY?: number): T[] {
  const rows = [...new Set(ivs.map(v => v.yb))];
  const cap = (rs: number[]) => ivs.filter(v => rs.includes(v.yb)).reduce((a, v) => a + v.W, 0);
  if (cap(rows) <= total * 1.9) return ivs;
  // the middle by row count, or (lines of varying height) by position, since small rows would pull it toward them
  const mid = (rows.length - 1) / 2,
    dist = (r: number, i: number) => (centreY === undefined ? Math.abs(i - mid) : Math.abs(r - centreY));
  const order = rows.map((r, i) => [r, dist(r, i)] as const).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const keep: number[] = [];
  for (const [r] of order) {
    keep.push(r);
    if (cap(keep) >= total * 1.25) break;
  }
  return ivs.filter(v => keep.includes(v.yb));
}

/** The n pieces nearest the middle height, in their reading order. */
function nearestMiddle<T extends { yb: number }>(ivs: T[], n: number, centreY: number): T[] {
  const keep = new Set([...ivs].sort((a, b) => Math.abs(a.yb - centreY) - Math.abs(b.yb - centreY)).slice(0, n));
  return ivs.filter(v => keep.has(v));
}

/** For a short text in a shape that cuts rows into many pieces: the widest pieces nearest the middle (ignoring
 *  slivers under 40% of their row's widest), at most n of them, until they hold about 1.25× the text. */
function middlePieces<T extends { yb: number; W: number }>(ivs: T[], total: number, n: number, centreY: number): T[] {
  const widest = new Map<number, number>();
  for (const v of ivs) widest.set(v.yb, Math.max(widest.get(v.yb) ?? 0, v.W));
  const order = ivs
    .filter(v => v.W >= 0.4 * widest.get(v.yb)!)
    .sort((a, b) => Math.abs(a.yb - centreY) - Math.abs(b.yb - centreY) || b.W - a.W);
  const keep = new Set<T>();
  let cap = 0;
  for (const v of order) {
    if (keep.size >= n || cap >= total * 1.25) break;
    keep.add(v);
    cap += v.W;
  }
  return ivs.filter(v => keep.has(v));
}

function linesFill(f: Extract<FillerNode, { type: 'lines' }>, res: RegionResult, style: Style, ctx: Ctx, sid: number) {
  const slot = ctx.comp.texts[f.text],
    pts = res.inner!.pts,
    script = ctx.script;
  const prep = script.prepareLines([slot.text.replace(/\n+/g, ' ')], style.letter)[0],
    Hb = prep.Hb,
    wg = slot.wordGap,
    lineGap = f.lineGap,
    minCells = 7,
    margin = 0.6;
  const sMax = (res.lastScale ?? 1) * 0.85;
  const b = bounds(pts),
    y0 = b.y0,
    y1 = b.y1,
    vary = f.vary ?? 0,
    crossings = crossingsOf(pts);
  // variable line height: a line's scale follows the region's width at its height, from 1 where the region is
  // widest down to (1 - vary / 2) at the tips, so lines there stay readable instead of being dropped
  // the width profile, sampled once (row placement asks for it many times)
  const N_PROFILE = 1024,
    profile = new Float64Array(N_PROFILE + 1);
  let wMax = 0;
  if (vary > 0)
    for (let i = 0; i <= N_PROFILE; i++) {
      profile[i] = crossings(y0 + ((y1 - y0) * i) / N_PROFILE).reduce((a, [p, q]) => Math.max(a, q - p), 0);
      wMax = Math.max(wMax, profile[i]);
    }
  const widthAt = (y: number) => {
    const t = Math.min(N_PROFILE, Math.max(0, ((y - y0) / (y1 - y0 || 1)) * N_PROFILE)),
      i = Math.min(N_PROFILE - 1, Math.floor(t));
    return profile[i] + (profile[i + 1] - profile[i]) * (t - i);
  };
  const kAt = (y: number) =>
    vary > 0 && wMax > 0 ? 1 - vary * (1 - Math.min(1, Math.max(0.5, Math.sqrt(widthAt(y) / wMax)))) : 1;
  /** Line bands from `start` downward at base scale s: [top, scale] pairs. */
  const rows = (s: number, start: number) => {
    const out: [number, number][] = [];
    for (let y = start; ;) {
      // the band's scale follows the width at its middle (a few fixed-point steps); the ends of a band can graze
      // rounded corners, which would shrink a line that has plenty of room
      let k = kAt(y);
      for (let it = 0; it < 3; it++) k = kAt(y + Hb * s * k * 0.5);
      const h = Hb * s * k;
      if (y + h > y1 - margin) break;
      out.push([y, s * k]);
      y += h + lineGap * s * k;
    }
    return out;
  };
  const ivsOf = (rs: [number, number][]) => {
    const ivs: { a: number; b: number; yb: number; W: number; s: number }[] = [];
    for (const [yt, sl] of rs) {
      const yb = yt + Hb * sl;
      let iv = crossings(yt + 0.01);
      [0.25, 0.5, 0.75, 1].forEach(fr => (iv = ivIntersect(iv, crossings(yt + (yb - yt) * fr - 0.01))));
      iv.map(([a, bb]) => [a + margin, bb - margin] as [number, number])
        .filter(([a, bb]) => (bb - a) / sl >= minCells)
        .sort((p, q) => q[0] - p[0]) // right to left
        .forEach(([a, bb]) => ivs.push({ a, b: bb, yb, W: Math.floor((bb - a) / sl), s: sl }));
    }
    return ivs;
  };
  const lay = (s: number) => {
    if (vary > 0) {
      // rows of varying height land differently against the outline's steps (a dome on a wide base); try several
      // starting offsets and keep the one that holds the most, the most centred on a tie
      // (offsets are ranked by the sampled width profile; exact intervals are found for the winner only)
      let best: { rs: [number, number][]; cap: number; off: number } | null = null;
      const step = (Hb * s) / 8;
      for (let k = 0; k < 8; k++) {
        const rs = rows(s, y0 + margin + k * step);
        if (!rs.length) continue;
        let cap = 0;
        for (const [yt, sl] of rs) {
          const hh = Hb * sl,
            w = Math.min(
              widthAt(yt),
              widthAt(yt + hh * 0.25),
              widthAt(yt + hh * 0.5),
              widthAt(yt + hh * 0.75),
              widthAt(yt + hh),
            );
          cap += Math.max(0, w - 2 * margin);
        }
        const [ly, ls] = rs[rs.length - 1],
          off = Math.abs(y1 - margin - (ly + Hb * ls) - k * step);
        if (!best || cap > best.cap + 1e-9 || (Math.abs(cap - best.cap) <= 1e-9 && off < best.off))
          best = { rs, cap, off };
      }
      return best ? ivsOf(best.rs) : null;
    }
    const pitch = (Hb + lineGap) * s,
      usableH = y1 - y0 - 2 * margin,
      nLines = Math.floor((usableH + lineGap * s) / pitch);
    if (nLines < 1) return null;
    const top = y0 + margin + (usableH - (nLines * pitch - lineGap * s)) / 2;
    return ivsOf(Array.from({ length: nLines }, (_, L) => [top + L * pitch, s] as [number, number]));
  };
  let best: { sc: number; s: number; ivs: NonNullable<ReturnType<typeof lay>>; groups: Segs[] } | null = null;
  // a second pass, only when nothing fits, lets a short text skip the shortest pieces of lines (a star or a mosque
  // cuts each row into more pieces than the text has words)
  for (const trim of [false, true])
    for (const mode of ['words', 'breaks'] as const) {
      if (best) break;
      const segs = script.segments(prep, mode, wg) as Segs;
      const total = segs.reduce((a, x) => a + x.minW, 0) + wg * (segs.length - 1);
      for (let i = 0; i < 90; i++) {
        const s = sMax * Math.pow(0.97, i);
        let ivs = lay(s);
        if (!ivs || !ivs.length) continue;
        if (trim) ivs = middlePieces(ivs, total, segs.length, (y0 + y1) / 2);
        else if (i === 0 || mode === 'words') {
          // whole words: a short text keeps to the middle lines at every size, no more lines than it has words,
          // rather than falling back to breaking words to fill a tall region (العلم نور in a mihrab)
          ivs = middleLines(ivs, total, vary > 0 ? (y0 + y1) / 2 : undefined);
          if (mode === 'words' && ivs.length > segs.length) ivs = nearestMiddle(ivs, segs.length, (y0 + y1) / 2);
        }
        const caps = ivs.map(v => v.W),
          sum = caps.reduce((a, c) => a + c, 0);
        if (sum < total) continue; // too big: the text doesn't fit yet
        if (sum > total * 1.9 && !trim) break; // too small: lines would be mostly stretching
        if (caps.length > segs.length) continue;
        const p = partition(repeatSegs(segs, 1), caps);
        if (!p) continue;
        const sc = p.score + 0.25 * (1 - s / sMax) + (mode === 'breaks' ? 0.12 : 0);
        if (!best || sc < best.sc) best = { sc, s, ivs, groups: p.groups as Segs[] };
      }
      if (best) break;
    }
  if (!best) {
    ctx.fill = { type: 'lines', ok: false, note: "the text doesn't fit this region" };
    return;
  }
  const ring = ++ctx.ring,
    o = { ...layoutOpts(style, wg), plait: !!f.plait && script.capabilities.plait !== false };
  best.ivs.forEach((v, i) => {
    const st = script.layout(best!.groups[i], prep, v.W, { ...o, wrap: false });
    if (!st) return;
    const used = v.W * v.s;
    ctx.items.push({
      type: 'strip',
      style: sid,
      strip: st,
      place: { type: 'line', O: [v.a + (v.b - v.a - used) / 2, v.yb], t: [1, 0], n: [0, -1], s: v.s },
      ring,
    });
  });
  // the reported scale is the width-weighted mean letter scale (equal to s when lines don't vary)
  const wsum = best.ivs.reduce((a, v) => a + v.W, 0);
  ctx.fill = {
    type: 'lines',
    ok: true,
    scale: vary > 0 ? best.ivs.reduce((a, v) => a + v.W * v.s, 0) / (wsum || 1) : best.s,
    note: `${new Set(best.ivs.map(v => v.yb.toFixed(2))).size} lines`,
  };
}

// ---------- maze ----------
type Unit = [number, number];
function mazeCycle(S: number, ok: (i: number, j: number) => boolean, straight: number, seed: number): Unit[] | null {
  const inS: boolean[] = [];
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) inS[j * S + i] = ok(i, j);
  // largest connected group
  const comp = new Int32Array(S * S).fill(-1);
  let bestC = -1,
    bestN = 0;
  for (let k = 0; k < S * S; k++) {
    if (!inS[k] || comp[k] >= 0) continue;
    const st = [k];
    comp[k] = k;
    let n = 0;
    while (st.length) {
      const c = st.pop()!;
      n++;
      const i = c % S,
        j = (c - i) / S;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const a = i + dx,
          bb = j + dy;
        if (a < 0 || bb < 0 || a >= S || bb >= S) continue;
        const q = bb * S + a;
        if (inS[q] && comp[q] < 0) {
          comp[q] = k;
          st.push(q);
        }
      }
    }
    if (n > bestN) {
      bestN = n;
      bestC = k;
    }
  }
  if (bestN < 2) return null;
  let sd = seed;
  const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  // random tree that tends to keep going straight (longer corridors)
  const inT = new Uint8Array(S * S),
    tree: [number, number][] = [];
  inT[bestC] = 1;
  const stack: [number, number][] = [[bestC, -1]];
  while (stack.length) {
    const [c, lastDir] = stack[stack.length - 1],
      i = c % S,
      j = (c - i) / S;
    const dirs = (
      [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ] as Unit[]
    )
      .map((d, di) => [d, di] as [Unit, number])
      .filter(([[dx, dy]]) => {
        const a = i + dx,
          bb = j + dy;
        return a >= 0 && bb >= 0 && a < S && bb < S && comp[bb * S + a] === bestC && !inT[bb * S + a];
      });
    if (!dirs.length) {
      stack.pop();
      continue;
    }
    let pickD = dirs[Math.floor(R() * dirs.length)];
    const same = dirs.find(([, di]) => di === lastDir);
    if (same && R() < straight) pickD = same;
    const [[dx, dy], di] = pickD,
      q = (j + dy) * S + i + dx;
    inT[q] = 1;
    tree.push([c, q]);
    stack.push([q, di]);
  }
  // walk around the tree on the doubled grid: each super cell is a 2×2 block of corridor units
  const N2 = 2 * S,
    adj = new Map<number, Set<number>>(),
    key = (x: number, y: number) => y * N2 + x;
  const link = (a: number, b: number) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  const unlink = (a: number, b: number) => {
    adj.get(a)!.delete(b);
    adj.get(b)!.delete(a);
  };
  for (let k = 0; k < S * S; k++) {
    if (!inT[k]) continue;
    const i = k % S,
      j = (k - i) / S,
      x = 2 * i,
      y = 2 * j;
    link(key(x, y), key(x + 1, y));
    link(key(x + 1, y), key(x + 1, y + 1));
    link(key(x + 1, y + 1), key(x, y + 1));
    link(key(x, y + 1), key(x, y));
  }
  tree.forEach(([a, b]) => {
    const ia = a % S,
      ja = (a - ia) / S,
      ib = b % S,
      jb = (b - ib) / S,
      xa = 2 * ia,
      ya = 2 * ja,
      xb = 2 * ib,
      yb = 2 * jb;
    if (ib === ia + 1) {
      unlink(key(xa + 1, ya), key(xa + 1, ya + 1));
      unlink(key(xb, yb), key(xb, yb + 1));
      link(key(xa + 1, ya), key(xb, yb));
      link(key(xa + 1, ya + 1), key(xb, yb + 1));
    } else if (ib === ia - 1) {
      unlink(key(xa, ya), key(xa, ya + 1));
      unlink(key(xb + 1, yb), key(xb + 1, yb + 1));
      link(key(xa, ya), key(xb + 1, yb));
      link(key(xa, ya + 1), key(xb + 1, yb + 1));
    } else if (jb === ja + 1) {
      unlink(key(xa, ya + 1), key(xa + 1, ya + 1));
      unlink(key(xb, yb), key(xb + 1, yb));
      link(key(xa, ya + 1), key(xb, yb));
      link(key(xa + 1, ya + 1), key(xb + 1, yb));
    } else {
      unlink(key(xa, ya), key(xa + 1, ya));
      unlink(key(xb, yb + 1), key(xb + 1, yb + 1));
      link(key(xa, ya), key(xb, yb + 1));
      link(key(xa + 1, ya), key(xb + 1, yb + 1));
    }
  });
  // traverse the cycle, starting at the bottom-most unit and heading left (clockwise, like the rings)
  const s0 = [...adj.keys()].reduce((b, k) => {
    const y = Math.floor(k / N2),
      by = Math.floor(b / N2);
    return y > by || (y === by && k % N2 > b % N2) ? k : b;
  });
  const nb = [...adj.get(s0)!],
    left = nb.find(k => k % N2 < s0 % N2) ?? nb[0];
  const path = [s0];
  let prev = s0,
    cur = left;
  while (cur !== s0 && path.length <= adj.size) {
    path.push(cur);
    const nx = [...adj.get(cur)!].find(k => k !== prev)!;
    prev = cur;
    cur = nx;
  }
  return path.map(k => [k % N2, Math.floor(k / N2)] as Unit);
}
interface MazeRun {
  corner: Unit;
  dir: Unit;
  units: Unit[];
  next: Unit;
}
function mazeRuns(path: Unit[]): MazeRun[] {
  const n = path.length,
    dir = (i: number): Unit => {
      const [x1, y1] = path[i],
        [x2, y2] = path[(i + 1) % n];
      return [x2 - x1, y2 - y1];
    };
  const turnAt = (i: number) => {
    const a = dir((i - 1 + n) % n),
      b = dir(i);
    return a[0] !== b[0] || a[1] !== b[1];
  };
  let s = 0;
  while (!turnAt(s)) s = (s + 1) % n;
  const runs: MazeRun[] = [];
  let i = s;
  do {
    const d = dir(i),
      units: Unit[] = [];
    let j = (i + 1) % n;
    while (!turnAt(j)) {
      units.push(path[j]);
      j = (j + 1) % n;
    }
    runs.push({ corner: path[i], dir: d, units, next: path[j] });
    i = j;
  } while (i !== s);
  return runs;
}

function mazeFill(f: Extract<FillerNode, { type: 'maze' }>, res: RegionResult, style: Style, ctx: Ctx, sid: number) {
  const slot = ctx.comp.texts[f.text],
    script = ctx.script,
    pts = res.inner!.pts;
  if (!script.capabilities.mazes) {
    ctx.fill = { type: 'maze', ok: false, note: `the ${script.id} script can't build mazes` };
    return;
  }
  if (f.interlace) {
    if (!weaveFill(f, res, style, ctx, sid))
      ctx.fill = { type: 'maze', ok: false, note: "the text doesn't fit an interlaced maze in this region" };
    return;
  }
  // the region, normalised to [-1, 1] on its bounding square
  const b = bounds(pts),
    cx = (b.x0 + b.x1) / 2,
    cy = (b.y0 + b.y1) / 2,
    half = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2;
  const insideN = (x: number, y: number) => inside(pts, cx + x * half, cy + y * half);
  const letter = { ...style.letter, ascenders: Math.min(style.letter.ascenders, 9) };
  const prep = script.prepareLines([slot.text.replace(/\n+/g, ' ')], letter)[0],
    Hb = prep.Hb,
    pitch = Hb + 1,
    wg = slot.wordGap;
  const seed = f.seed ?? ctx.comp.seed,
    straight = f.corridors,
    minCells = 6;
  const o = { ...layoutOpts(style, wg), rhythm: true, plait: !!f.plait };
  let best: { sc: number; S: number; runs: MazeRun[]; groups: Segs[]; rep: number; minC: number } | null = null;
  for (let S = 3; S <= 26; S++) {
    const ok = (i: number, j: number) =>
      // corners sampled just inside the super cell, so cells along a straight boundary count
      [
        [0.01, 0.01],
        [0.99, 0.01],
        [0.01, 0.99],
        [0.99, 0.99],
        [0.5, 0.5],
      ].every(([a, bb]) => insideN(((i + a) / S) * 2 - 1, ((j + bb) / S) * 2 - 1));
    const path = mazeCycle(S, ok, straight, seed);
    if (!path) continue;
    const runs = mazeRuns(path),
      allCap = runs.reduce((a, r) => a + Math.max(0, r.units.length * pitch - 1), 0);
    for (const minC of [minCells, 2 * pitch - 1, 3 * pitch - 1, 4 * pitch - 1, 6 * pitch - 1]) {
      const caps = runs.filter(r => r.units.length * pitch - 1 >= minC).map(r => r.units.length * pitch - 1),
        sum = caps.reduce((a, c) => a + c, 0);
      if (!caps.length) continue;
      for (const mode of ['words', 'breaks'] as const) {
        const segs0 = script.segments(prep, mode, wg) as Segs;
        const one = segs0.reduce((a, x) => a + x.minW, 0) + wg * segs0.length;
        for (let rep = 1; rep <= 12; rep++) {
          if (rep * one > sum + wg) break;
          if (rep * segs0.length < caps.length) continue;
          if (sum > rep * one * (rep === 1 ? 2.1 : 1.7)) continue;
          const p = partition(repeatSegs(segs0, rep), caps);
          if (!p) continue;
          const sc = p.score + (mode === 'breaks' ? 0.1 : 0) + 0.03 * (rep - 1) + 0.012 * S + 0.8 * (1 - sum / allCap);
          if (!best || sc < best.sc) best = { sc, S, runs, groups: p.groups as Segs[], rep, minC };
          break;
        }
        if (best && best.S === S && mode === 'words') break;
      }
    }
    if (best && S > best.S + 4) break;
  }
  if (!best) {
    ctx.fill = { type: 'maze', ok: false, note: "the text doesn't fit a maze in this region" };
    return;
  }
  const N2 = 2 * best.S,
    size = N2 * pitch + 6,
    g = G(size, size),
    off = 3;
  const put = (x: number, y: number, v: number) => {
    x += off;
    y += off;
    if (x >= 0 && y >= 0 && x < size && y < size && (!g.data[y * size + x] || v === 1)) g.data[y * size + x] = v;
  };
  const tOf = (d: Unit): Unit => [-d[0], -d[1]],
    nOf = (t: Unit): Unit => [t[1], -t[0]];
  const baseLine = (d: Unit, unit: Unit) => {
    const n = nOf(tOf(d));
    if (d[1] === 0) return unit[1] * pitch + (n[1] > 0 ? 0 : Hb - 1);
    return unit[0] * pitch + (n[0] > 0 ? 0 : Hb - 1);
  };
  let ri = 0;
  best.runs.forEach((run, k) => {
    const t = tOf(run.dir),
      n = nOf(t),
      isText = run.units.length * pitch - 1 >= best!.minC;
    if (isText && run.units.length) {
      const st = script.layout(best!.groups[ri++], prep, run.units.length * pitch - 1, { ...o, wrap: false });
      if (st && st.kind === 'cells') {
        const xs = run.units.map(u => u[0]),
          ys = run.units.map(u => u[1]);
        const x0 = Math.min(...xs) * pitch,
          x1 = (Math.max(...xs) + 1) * pitch - 2,
          y0 = Math.min(...ys) * pitch,
          y1 = (Math.max(...ys) + 1) * pitch - 2;
        const rx0 = run.dir[1] === 0 ? x0 : Math.min(...xs) * pitch,
          rx1 = run.dir[1] === 0 ? x1 : Math.min(...xs) * pitch + Hb - 1;
        const ry0 = run.dir[0] === 0 ? y0 : Math.min(...ys) * pitch,
          ry1 = run.dir[0] === 0 ? y1 : Math.min(...ys) * pitch + Hb - 1;
        const O = [t[0] > 0 || n[0] > 0 ? rx0 : rx1, t[1] > 0 || n[1] > 0 ? ry0 : ry1];
        for (let y = 0; y < Hb; y++)
          for (let x = 0; x < st.W; x++) {
            const v = st.data[y * st.W + x];
            if (v) put(O[0] + x * t[0] + y * n[0], O[1] + x * t[1] + y * n[1], v === 4 ? 1 : v);
          }
      }
    }
    // the baseline turns the corner at the end of this run
    const nextRun = best!.runs[(k + 1) % best!.runs.length],
      c = run.next;
    const b1 = baseLine(run.dir, c),
      b2 = baseLine(nextRun.dir, c);
    if (run.dir[1] === 0) {
      const xe = run.dir[0] > 0 ? c[0] * pitch : c[0] * pitch + Hb - 1;
      for (let x = Math.min(xe, b2); x <= Math.max(xe, b2); x++) put(x, b1, 1);
      const ye = nextRun.dir[1] > 0 ? c[1] * pitch + Hb - 1 : c[1] * pitch;
      for (let y = Math.min(ye, b1); y <= Math.max(ye, b1); y++) put(b2, y, 1);
    } else {
      const ye = run.dir[1] > 0 ? c[1] * pitch : c[1] * pitch + Hb - 1;
      for (let y = Math.min(ye, b2); y <= Math.max(ye, b2); y++) put(b1, y, 1);
      const xe = nextRun.dir[0] > 0 ? c[0] * pitch + Hb - 1 : c[0] * pitch;
      for (let x = Math.min(xe, b1); x <= Math.max(xe, b1); x++) put(x, b2, 1);
    }
    // short runs without text carry the baseline straight through
    if (!isText && run.units.length) {
      const bl = baseLine(run.dir, run.units[0]);
      run.units.forEach(u => {
        for (let q = 0; q < pitch; q++) {
          if (run.dir[1] === 0) put(u[0] * pitch + q, bl, 1);
          else put(bl, u[1] * pitch + q, 1);
        }
      });
    }
  });
  if (f.wall) {
    // a frame one cell clear of everything
    const occ = new Uint8Array(size * size);
    best.runs.forEach(r =>
      [r.corner, ...r.units].forEach(([ux, uy]) => {
        for (let y = 0; y < pitch; y++)
          for (let x = 0; x < pitch; x++) occ[(uy * pitch + y + off) * size + ux * pitch + x + off] = 1;
      }),
    );
    const dil = (src: Uint8Array, r: number) => {
      const out = new Uint8Array(size * size);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          if (!src[y * size + x]) continue;
          for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
              const X = x + dx,
                Y = y + dy;
              if (X >= 0 && Y >= 0 && X < size && Y < size) out[Y * size + X] = 1;
            }
        }
      return out;
    };
    const d1 = dil(occ, 1),
      d2 = dil(occ, 2);
    for (let k = 0; k < size * size; k++) if (d2[k] && !d1[k] && !g.data[k]) g.data[k] = 1;
  }
  // grid cell (x, y) covers the region's bounding square: corridor units span [-1, 1]
  const cell = (2 * half) / (N2 * pitch),
    t = trimAt(g, 1);
  markEnds(t.g);
  let at: Pt = [cx - half + (-off - t.dx) * cell, cy - half + (-off - t.dy) * cell],
    c = cell;
  // the wall sits just outside the corridors; scale back inside the region if it overflows
  const k = Math.min(1, (2 * half * 0.97) / (Math.max(t.g.w, t.g.h) * cell));
  if (k < 1) {
    at = [cx + (at[0] - cx) * k, cy + (at[1] - cy) * k];
    c = cell * k;
  }
  ctx.items.push({ type: 'grid', style: sid, grid: t.g, at, cell: c, colour: 'ink', ring: ++ctx.ring });
  let ink = 0;
  for (const v of t.g.data) if (v) ink++;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  ctx.fill = {
    type: 'maze',
    ok: true,
    scale: c,
    note: `${best.runs.length} turns, text ×${best.rep}`,
    metrics: {
      rep: clamp(1 - Math.max(0, best.rep - 4) / 10),
      density: clamp(1 - Math.abs(ink / (t.g.w * t.g.h) - 0.3) / 0.25),
    },
  };
}

// ---------- monogram ----------
const METHOD: Record<string, MonoMethod> = { pinwheel: 'pinwheel', pinwheelIn: 'pinwheelIn' };
function monogramFill(
  f: Extract<FillerNode, { type: 'monogram' }>,
  res: RegionResult,
  style: Style,
  ctx: Ctx,
  sid: number,
) {
  const cr = centreOf(res);
  if (!cr || cr.r < 2) {
    ctx.fill = { type: 'monogram', ok: false, note: 'no room for a monogram' };
    return;
  }
  if (!ctx.script.capabilities.grid || (f.method === 'seal' && !ctx.script.capabilities.seals)) {
    ctx.fill = { type: 'monogram', ok: false, note: `the ${ctx.script.id} script can't build this monogram` };
    return;
  }
  const params = { seed: ctx.comp.seed, ...(f.params as Partial<MonoParams>) };
  const m = buildMonogram(METHOD[f.method] ?? f.method, params, ctx.comp.texts[f.text].text, ctx.script, style.letter);
  if (!m) {
    ctx.fill = { type: 'monogram', ok: false, note: 'the monogram could not be built' };
    return;
  }
  const g: CellGrid = m.grid,
    size = cr.r * 1.35,
    cell = size / Math.max(g.w, g.h);
  ctx.items.push({
    type: 'grid',
    style: sid,
    grid: g,
    at: [cr.c[0] - (g.w * cell) / 2, cr.c[1] - (g.h * cell) / 2],
    cell,
    colour: 'accent',
    ring: ++ctx.ring,
  });
  if (m.curves?.length) {
    const at: Pt = [cr.c[0] - (g.w * cell) / 2, cr.c[1] - (g.h * cell) / 2];
    ctx.items.push({
      type: 'ribbon',
      style: sid,
      paths: m.curves.map(c => c.map(([x, y]) => [at[0] + x * cell, at[1] + y * cell] as Pt)),
      // the same width as the letters' strokes, and the same nib when they're drawn with a pen
      width: style.stroke.weight * cell,
      pen: style.stroke.kind === 'pen',
    });
  }
  const { total: _t, ...mm } = m.metrics;
  void _t;
  ctx.fill = {
    type: 'monogram',
    ok: true,
    note: `${f.method}, overall ${Math.round(m.metrics.total * 100)}`,
    metrics: mm as Record<string, number>,
  };
}

registerFiller('lines', (f, res, style, ctx, sid) =>
  linesFill(f as Extract<FillerNode, { type: 'lines' }>, res, style, ctx, sid),
);
registerFiller('maze', (f, res, style, ctx, sid) =>
  mazeFill(f as Extract<FillerNode, { type: 'maze' }>, res, style, ctx, sid),
);
registerFiller('monogram', (f, res, style, ctx, sid) =>
  monogramFill(f as Extract<FillerNode, { type: 'monogram' }>, res, style, ctx, sid),
);
export type { RegionNode };
