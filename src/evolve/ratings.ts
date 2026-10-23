// The rating loop (PORT-PLAN.md §5; prototypes/thuluth-lab/refresh/tools): pairwise votes between compositions ("which
// is more beautiful?"), ranked by Bradley–Terry, and a taste fitted to them by logistic regression on the differences
// of standardised features. The lab's fit (roundel/deco.ts TASTE_FIT) came from 148 such votes; refit as votes grow.

/** One vote: a against b, won by a, by b, or a tie. */
export interface Vote {
  a: string;
  b: string;
  w: 'a' | 'b' | 'tie';
  t?: number;
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
  const fit = (data: typeof rows) => {
    const w = new Array<number>(k).fill(0),
      l2 = o.l2 ?? 0.01,
      lr = 0.5;
    for (let it = 0; it < (o.iters ?? 2000); it++) {
      const g = w.map(wj => l2 * wj);
      for (const { d, y } of data) {
        const p = 1 / (1 + Math.exp(-d.reduce((s, x, j) => s + x * w[j], 0)));
        for (let j = 0; j < k; j++) g[j] += ((p - y) * d[j]) / data.length;
      }
      for (let j = 0; j < k; j++) w[j] -= lr * g[j];
    }
    return w;
  };
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
