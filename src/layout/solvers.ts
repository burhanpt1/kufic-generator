// Split segment lists into rings / sides, and find the smallest composition size that fits.
import type { Seg, Segs } from '../types';

export interface Partition {
  groups: Seg[][];
  score: number;
  L?: number;
  rep?: number;
}

export function repeatSegs(segs0: Segs, rep: number): Segs {
  const out: Segs = [];
  for (let r = 0; r < rep; r++)
    segs0.forEach((s, i) => out.push({ ...s, rep: r, endsWord: i === segs0.length - 1 ? true : s.endsWord }));
  out.wg = segs0.wg;
  return out;
}
/** width(i, j): natural width of segs[i..j) including the gaps between them. */
export const widthFn = (segs: Segs) => {
  const n = segs.length,
    pw = [0],
    pg = [0];
  segs.forEach((s, i) => {
    pw.push(pw[i] + s.minW);
    pg.push(pg[i] + (i < n - 1 ? (s.endsWord ? segs.wg! : 1) : 0));
  });
  return (i: number, j: number) => pw[j] - pw[i] + pg[j - 1] - pg[i];
};
/** Can segs be laid greedily into groups of the given capacities? */
export function greedyOK(segs: Segs, caps: number[]): boolean {
  const width = widthFn(segs),
    n = segs.length;
  let i = 0;
  for (let g = 0; g < caps.length && i < n; g++) {
    const c = caps[g];
    if (!(c >= 1)) return false;
    let j = i;
    while (j < n && width(i, j + 1) <= c) j++;
    if (j === i) return false;
    i = j;
  }
  return i === n;
}
// split segs into caps.length contiguous non-empty groups, spreading slack evenly; null if impossible
export function partition(segs: Segs, caps: number[]): Partition | null {
  const G = caps.length,
    n = segs.length;
  if (n < G) return null;
  const width = widthFn(segs),
    INF = 1e18,
    PEN = 0.3;
  const f = Array.from({ length: G + 1 }, () => new Float64Array(n + 1).fill(INF)),
    from = Array.from({ length: G + 1 }, () => new Int32Array(n + 1));
  f[0][0] = 0;
  for (let g = 1; g <= G; g++) {
    const c = caps[g - 1];
    if (!(c >= 1)) return null;
    for (let j = g; j <= n - (G - g); j++)
      for (let i = j - 1; i >= g - 1; i--) {
        const W = width(i, j);
        if (W > c) break;
        if (f[g - 1][i] === INF) continue;
        const sl = (c - W) / c,
          cost = f[g - 1][i] + sl * sl + (j < n && !segs[j - 1].endsWord ? PEN : 0);
        if (cost < f[g][j]) {
          f[g][j] = cost;
          from[g][j] = i;
        }
      }
  }
  if (f[G][n] >= INF) return null;
  const groups: Seg[][] = [];
  let j = n,
    slack = 0;
  for (let g = G; g > 0; g--) {
    const i = from[g][j];
    groups.unshift(segs.slice(i, j));
    slack += (caps[g - 1] - width(i, j)) / caps[g - 1];
    j = i;
  }
  return { groups, score: slack / G };
}
// one text flowing through all sides of all rings; finds the smallest size L
export function fitFlow(
  segs0: Segs,
  capsOf: (L: number) => number[] | null | undefined,
  L0: number,
  allowRep: boolean,
): Partition | null {
  const G = capsOf(L0 + 400) ? capsOf(L0 + 400)!.length : 0;
  if (!G) return null;
  const rep0 = Math.max(1, Math.ceil(G / segs0.length));
  let best: Partition | null = null;
  for (let rep = rep0; rep <= rep0 + (allowRep ? 12 : 0); rep++) {
    const segs = repeatSegs(segs0, rep);
    let L = L0;
    while (L < 3000) {
      const c = capsOf(L);
      if (c && greedyOK(segs, c)) break;
      L++;
    }
    if (L >= 3000) continue;
    for (let t = 0; t < 300; t++, L++) {
      const c = capsOf(L);
      if (!c) continue;
      const p = partition(segs, c);
      if (p) {
        p.score += 0.02 * (rep - rep0);
        p.L = L;
        p.rep = rep;
        if (!best || p.score < best.score) best = p;
        break;
      }
    }
  }
  return best;
}
// a separate text for each ring: smallest L where every ring holds its text once, then repeat to fill
export function fitPerRing(
  ringSegs: Segs[],
  capsOf: (L: number) => number[][] | null | undefined,
  L0: number,
  allowRep: boolean,
): { L: number; groups: Seg[][][]; rep: number } | null {
  let L = L0;
  for (; L < 3000; L++) {
    const c = capsOf(L);
    if (!c) continue;
    if (ringSegs.every((segs, k) => greedyOK(segs, c[k]))) break;
  }
  if (L >= 3000) return null;
  const c = capsOf(L)!,
    groups: Seg[][][] = [];
  let reps = 1;
  ringSegs.forEach((segs0, k) => {
    let best = partition(
      segs0.length >= c[k].length ? segs0 : repeatSegs(segs0, Math.ceil(c[k].length / segs0.length)),
      c[k],
    );
    if (allowRep)
      for (let rep = 2; rep <= 12; rep++) {
        const p = partition(repeatSegs(segs0, rep), c[k]);
        if (p) best = p;
        else break;
      }
    if (!best) best = partition(repeatSegs(segs0, c[k].length), c[k]);
    groups.push(best ? best.groups : c[k].map(() => []));
    reps = Math.max(
      reps,
      best && best.groups.flat().length ? Math.max(...best.groups.flat().map(s => (s.rep || 0) + 1)) : 1,
    );
  });
  return { L, groups, rep: reps };
}
