// The rating loop (PORT-PLAN.md §5; prototypes/thuluth-lab/refresh/tools): pairwise votes between compositions ("which
// is more beautiful?"), ranked by Bradley–Terry, and a taste fitted to them by logistic regression on the differences
// of standardised features. The lab's fit (roundel/deco.ts TASTE_FIT) came from 148 such votes; refit as votes grow.
import { fitKernel } from '../kernels/ratings';

/** One vote: a against b, won by a, by b, or a tie. */
export interface Vote {
  a: string;
  b: string;
  w: 'a' | 'b' | 'tie';
  t?: number;
  /** Not a vote the owner cast: a row made up from a dislike or a tie (tests/refit.test.ts). The fit counts it like
   *  any other; evalPairwise trains on it but never scores itself on it. */
  synthetic?: boolean;
}

/** Log strengths by Bradley–Terry (minorise–maximise; ties as half wins; a light prior, one half-win against a unit
 *  opponent, so unbeaten items stay finite), normalised to a geometric mean of 1 (tools/bradley_terry.py). */
export function bradleyTerry(votes: readonly Vote[], ids: readonly string[], iters = 800): Record<string, number> {
  const n = ids.length,
    ix = new Map(ids.map((k, i) => [k, i])),
    Wm = Array.from({ length: n }, () => new Float64Array(n));
  for (const v of votes) {
    const a = ix.get(v.a),
      b = ix.get(v.b);
    if (a == null || b == null) continue;
    if (v.w === 'a') Wm[a][b] += 1;
    else if (v.w === 'b') Wm[b][a] += 1;
    else {
      Wm[a][b] += 0.5;
      Wm[b][a] += 0.5;
    }
  }
  const wins = Wm.map(r => r.reduce((s, v) => s + v, 0));
  let p = new Float64Array(n).fill(1);
  for (let it = 0; it < iters; it++) {
    const q = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let den = 1 / (p[i] + 1);
      for (let j = 0; j < n; j++) if (j !== i) den += (Wm[i][j] + Wm[j][i]) / (p[i] + p[j]);
      q[i] = (wins[i] + 0.5) / den;
    }
    const g = Math.exp(q.reduce((s, v) => s + Math.log(v), 0) / n);
    p = q.map(v => v / g);
  }
  return Object.fromEntries(ids.map((k, i) => [k, Math.log(p[i])]));
}

/** Weights for rows of feature differences d (k each) and outcomes y: gradient descent on the logistic loss with an
 *  L2 penalty, no intercept (in flat arrays, summed in the same order as a reduce over each row would). */
function descend(data: readonly { d: readonly number[]; y: number }[], k: number, l2: number, iters: number): number[] {
  // in WebAssembly (src/kernels/ratings.c) when it loads
  const native = fitKernel(data, k, l2, iters);
  if (native) return native;
  const m = data.length,
    D = new Float64Array(m * k),
    Y = Float64Array.from(data, r => r.y),
    w = new Float64Array(k),
    g = new Float64Array(k),
    lr = 0.5;
  data.forEach((r, i) => D.set(r.d, i * k));
  for (let it = 0; it < iters; it++) {
    for (let j = 0; j < k; j++) g[j] = l2 * w[j];
    for (let i = 0; i < m; i++) {
      let s = 0;
      for (let j = 0; j < k; j++) s = s + D[i * k + j] * w[j];
      const p = 1 / (1 + Math.exp(-s));
      for (let j = 0; j < k; j++) g[j] += ((p - Y[i]) * D[i * k + j]) / m;
    }
    for (let j = 0; j < k; j++) w[j] -= lr * g[j];
  }
  return Array.from(w);
}

/** Fit weights for standardised features to pairwise votes (logistic regression on feature differences, no
 *  intercept, a little L2), and the share of votes it gets right when each is left out in turn. Ties are skipped. */
export function fitPairwise(
  votes: readonly Vote[],
  features: Record<string, readonly number[]>,
  o: { l2?: number; iters?: number; looTest?: boolean } = {},
): { w: number[]; mean: number[]; sd: number[]; loo?: number } {
  const ids = Object.keys(features),
    k = features[ids[0]]?.length ?? 0,
    mean = Array.from({ length: k }, (_, j) => ids.reduce((s, id) => s + features[id][j], 0) / ids.length),
    sd = mean.map((m, j) => Math.sqrt(ids.reduce((s, id) => s + (features[id][j] - m) ** 2, 0) / ids.length) || 1);
  const z = (id: string) => features[id].map((v, j) => (v - mean[j]) / sd[j]);
  const rows = votes
    .filter(v => v.w !== 'tie' && features[v.a] && features[v.b])
    .map(v => {
      const za = z(v.a),
        zb = z(v.b);
      return { d: za.map((x, j) => x - zb[j]), y: v.w === 'a' ? 1 : 0 };
    });
  const fit = (data: typeof rows) => descend(data, k, o.l2 ?? 0.01, o.iters ?? 2000);
  const w = fit(rows);
  let loo: number | undefined;
  if (o.looTest && rows.length > 1) {
    let right = 0;
    rows.forEach((r, i) => {
      const wi = fit(rows.filter((_, j) => j !== i));
      if (r.d.reduce((s, x, j) => s + x * wi[j], 0) > 0 === (r.y === 1)) right++;
    });
    loo = right / rows.length;
  }
  return { w, mean, sd, loo };
}

/** The 95% interval (Wilson's) for a share of `right` out of `n`. */
export function wilson(right: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 1];
  const p = right / n,
    den = 1 + (z * z) / n,
    mid = (p + (z * z) / (2 * n)) / den,
    half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [Math.max(0, mid - half), Math.min(1, mid + half)];
}

/** How well a fit predicts the votes, counted several ways (tests/ratings/README.md says which to quote). */
export interface PairwiseEval {
  /** Votes the owner cast, and rows made up from dislikes and ties (ties themselves are skipped, as in the fit). */
  real: number;
  synthetic: number;
  /** The honest figure: each real vote predicted by a fit that saw no row sharing either of its two compositions,
   *  with the mean and spread taken without them too. `lo` and `hi` are its 95% interval. */
  grouped: { right: number; n: number; acc: number; lo: number; hi: number };
  /** One feature's sign alone, the feature and sign chosen inside each of the same folds. */
  baseline: { right: number; n: number; acc: number };
  /** One feature's sign alone, chosen on the real votes it is then scored on (so it flatters itself). */
  baselineInSample: { feature: number; sign: 1 | -1; acc: number };
  /** Plain leave-one-out (a row's twins and its compositions stay in training), on the real votes only. */
  looReal: number;
  /** Plain leave-one-out over every row, synthetic ones included: fitPairwise's `loo`. */
  looAll: number;
}

/** Measure a fit as fitPairwise makes it (same penalty, same steps) without changing it. */
export function evalPairwise(
  votes: readonly Vote[],
  features: Record<string, readonly number[]>,
  o: { l2?: number; iters?: number } = {},
): PairwiseEval {
  const ids = Object.keys(features),
    k = features[ids[0]]?.length ?? 0,
    l2 = o.l2 ?? 0.01,
    iters = o.iters ?? 2000,
    used = votes.filter(v => v.w !== 'tie' && features[v.a] && features[v.b]),
    y = used.map(v => (v.w === 'a' ? 1 : 0)),
    raw = used.map(v => features[v.a].map((x, j) => x - features[v.b][j])),
    realAt = used.flatMap((v, i) => (v.synthetic ? [] : [i]));
  // the mean and spread over some compositions, as fitPairwise takes them over all
  const spread = (over: readonly string[]) => {
    const mean = Array.from({ length: k }, (_, j) => over.reduce((s, id) => s + features[id][j], 0) / over.length),
      sd = mean.map((m, j) => Math.sqrt(over.reduce((s, id) => s + (features[id][j] - m) ** 2, 0) / over.length) || 1);
    return (id: string) => features[id].map((v, j) => (v - mean[j]) / sd[j]);
  };
  const diff = (z: (id: string) => number[], i: number) => {
    const zb = z(used[i].b);
    return z(used[i].a).map((x, j) => x - zb[j]);
  };
  const dot = (d: readonly number[], w: readonly number[]) => d.reduce((s, x, j) => s + x * w[j], 0);
  // right only when it leans the way the vote went: a fit with nothing to say is wrong
  const hit = (s: number, i: number) => (y[i] === 1 ? s > 0 : s < 0);
  // the one feature and sign that get most of these rows right
  const bestSign = (at: readonly number[]) => {
    let best = { feature: 0, sign: 1 as 1 | -1, right: -1 };
    for (let j = 0; j < k; j++) {
      const up = at.filter(i => hit(raw[i][j], i)).length,
        down = at.filter(i => hit(-raw[i][j], i)).length;
      if (Math.max(up, down) > best.right) best = { feature: j, sign: up >= down ? 1 : -1, right: Math.max(up, down) };
    }
    return best;
  };

  // plain leave-one-out, exactly fitPairwise's
  const zAll = spread(ids),
    rows = used.map((_, i) => ({ d: diff(zAll, i), y: y[i] }));
  let looAllRight = 0,
    looRealRight = 0;
  if (rows.length > 1)
    rows.forEach((r, i) => {
      const w = descend(rows.filter((_, j) => j !== i), k, l2, iters); // prettier-ignore
      if (dot(r.d, w) > 0 === (r.y === 1)) {
        looAllRight++;
        if (!used[i].synthetic) looRealRight++;
      }
    });

  // grouped: neither composition of the held-out vote is seen, in a row or in the mean and spread
  let right = 0,
    baseRight = 0;
  for (const i of realAt) {
    const out = new Set([used[i].a, used[i].b]),
      train = used.flatMap((v, j) => (out.has(v.a) || out.has(v.b) ? [] : [j])),
      rest = ids.filter(id => !out.has(id));
    if (!train.length || !rest.length) continue;
    const z = spread(rest),
      w = descend(train.map(j => ({ d: diff(z, j), y: y[j] })), k, l2, iters); // prettier-ignore
    if (hit(dot(diff(z, i), w), i)) right++;
    const b = bestSign(train);
    if (hit(b.sign * raw[i][b.feature], i)) baseRight++;
  }
  const n = realAt.length,
    [lo, hi] = wilson(right, n),
    inSample = bestSign(realAt);
  return {
    real: n,
    synthetic: used.length - n,
    grouped: { right, n, acc: n ? right / n : 0, lo, hi },
    baseline: { right: baseRight, n, acc: n ? baseRight / n : 0 },
    baselineInSample: { feature: inSample.feature, sign: inSample.sign, acc: n ? inSample.right / n : 0 },
    looReal: n ? looRealRight / n : 0,
    looAll: rows.length ? looAllRight / rows.length : 0,
  };
}

/** The next pair to rate: among the least-rated items, a pair not yet compared (the rating page's rule). */
export function nextPair(
  votes: readonly Vote[],
  ids: readonly string[],
  rand: () => number = Math.random,
): [string, string] | null {
  const count = new Map(ids.map(i => [i, 0])),
    seen = new Set<string>();
  for (const v of votes) {
    count.set(v.a, (count.get(v.a) ?? 0) + 1);
    count.set(v.b, (count.get(v.b) ?? 0) + 1);
    seen.add([v.a, v.b].sort().join('|'));
  }
  const order = [...ids].sort((p, q) => count.get(p)! - count.get(q)! || rand() - 0.5);
  for (let i = 0; i < order.length; i++)
    for (let j = i + 1; j < order.length; j++)
      if (!seen.has([order[i], order[j]].sort().join('|'))) return rand() < 0.5 ? [order[i], order[j]] : [order[j], order[i]]; // prettier-ignore
  return null;
}
