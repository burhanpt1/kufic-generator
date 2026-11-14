// evalPairwise (src/evolve/ratings.ts): how well a fit predicts votes it has not seen, counted honestly. On made-up
// votes small enough to know the answer.
import { describe, expect, it } from 'vitest';
import type { Vote } from '../src/evolve/ratings';
import { evalPairwise, fitPairwise, wilson } from '../src/evolve/ratings';

/** A seeded random number in [0, 1) (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** n compositions with k random features, and m votes between distinct ones, each decided by `won`. */
function made(
  n: number,
  k: number,
  m: number,
  seed: number,
  won: (a: number[], b: number[], r: () => number) => boolean,
) {
  const r = seeded(seed),
    features: Record<string, number[]> = {},
    votes: Vote[] = [];
  for (let i = 0; i < n; i++) features[`c${i}`] = Array.from({ length: k }, () => r() * 2 - 1);
  while (votes.length < m) {
    const a = `c${Math.floor(r() * n)}`,
      b = `c${Math.floor(r() * n)}`;
    if (a !== b) votes.push({ a, b, w: won(features[a], features[b], r) ? 'a' : 'b' });
  }
  return { votes, features };
}

describe('the honest measure of a fit', () => {
  it('gets every vote right when one feature decides them all', () => {
    const { votes, features } = made(30, 1, 120, 1, (a, b) => a[0] > b[0]),
      e = evalPairwise(votes, features);
    expect(e.real).toBe(120);
    expect(e.synthetic).toBe(0);
    expect(e.grouped).toMatchObject({ right: 120, n: 120, acc: 1 });
    expect(e.baseline.acc).toBe(1);
    expect(e.baselineInSample).toEqual({ feature: 0, sign: 1, acc: 1 });
    expect(e.looReal).toBe(1);
    expect(e.looAll).toBe(1);
  });
  it('finds the feature and its sign among others that say nothing', () => {
    const { votes, features } = made(40, 4, 200, 2, (a, b) => a[2] < b[2]),
      e = evalPairwise(votes, features, { iters: 300 });
    expect(e.baselineInSample).toEqual({ feature: 2, sign: -1, acc: 1 });
    expect(e.baseline.acc).toBe(1);
    expect(e.grouped.acc).toBeGreaterThan(0.95);
  });
  it('gets about half right when the votes are coin tosses', () => {
    const { votes, features } = made(40, 3, 300, 3, (_a, _b, r) => r() < 0.5),
      e = evalPairwise(votes, features, { iters: 300 });
    expect(e.grouped.n).toBe(300);
    expect(e.grouped.acc).toBeGreaterThan(0.4);
    expect(e.grouped.acc).toBeLessThan(0.6);
    expect(e.baseline.acc).toBeGreaterThan(0.4);
    expect(e.baseline.acc).toBeLessThan(0.6);
    // and the interval holds a half
    expect(e.grouped.lo).toBeLessThan(0.5);
    expect(e.grouped.hi).toBeGreaterThan(0.5);
  });
  it('holds out every row that shares a composition with the vote', () => {
    // every vote has the same winner, so a fold that drops its rows has nothing left to learn from and scores
    // nothing; plain leave-one-out keeps the others and gets them all
    const features: Record<string, number[]> = { hub: [1] },
      votes: Vote[] = [];
    for (let i = 0; i < 8; i++) {
      features[`c${i}`] = [-i / 8];
      votes.push(i % 2 ? { a: 'hub', b: `c${i}`, w: 'a' } : { a: `c${i}`, b: 'hub', w: 'b' });
    }
    const e = evalPairwise(votes, features);
    expect(e.looAll).toBe(1);
    expect(e.looReal).toBe(1);
    expect(e.grouped).toMatchObject({ right: 0, n: 8, acc: 0 });
    expect(e.baseline.acc).toBe(0);
  });
  it('is not helped by the twins of a made-up loser', () => {
    // real votes follow the feature; one composition with the highest feature was set aside as disliked, and loses to
    // five winners in made-up rows, against the feature. Plain leave-one-out over every row is scored on those rows;
    // the honest figure trains on them but is scored on real votes only.
    const { votes, features } = made(20, 1, 60, 4, (a, b) => a[0] > b[0]);
    features.bad = [2];
    const twins: Vote[] = [0, 1, 2, 3, 4].map(i => ({ a: `c${i}`, b: 'bad', w: 'a', synthetic: true })),
      e = evalPairwise([...votes, ...twins], features);
    expect(e.real).toBe(60);
    expect(e.synthetic).toBe(5);
    expect(e.grouped.n).toBe(60);
    expect(e.grouped.acc).toBe(1);
    expect(e.looReal).toBe(1);
    expect(e.looAll).toBeCloseTo(60 / 65, 12);
  });
  it('takes the mean and spread inside the fold', () => {
    // one real vote, between two compositions far from the rest; every other row is made up, so the honest figure is
    // that one fold. It must be what a fit that never had the two gives: their rows gone, and the mean and spread
    // taken over the rest (with the pair in, the second feature's spread would be the pair's own).
    const base = made(20, 2, 80, 5, (a, b, r) => a[0] + 0.3 * (r() - 0.5) > b[0]),
      rest = base.votes.map(v => ({ ...v, synthetic: true }));
    for (const far of [-1000, -30, 30, 1000]) {
      const pair = { p: [0.2, far], q: [-0.2, -far] },
        ref = fitPairwise(rest, base.features),
        z = (x: number[]) => x.map((v, j) => (v - ref.mean[j]) / ref.sd[j]),
        s = z(pair.p).reduce((t, v, j) => t + (v - z(pair.q)[j]) * ref.w[j], 0),
        // two made-up rows on the pair as well, which the fold must drop
        twins: Vote[] = [
          { a: 'c0', b: 'p', w: 'a', synthetic: true },
          { a: 'q', b: 'c1', w: 'a', synthetic: true },
        ],
        e = evalPairwise([...rest, ...twins, { a: 'p', b: 'q', w: 'a' }], { ...base.features, ...pair });
      expect(e.grouped.n).toBe(1);
      expect(e.grouped.right).toBe(s > 0 ? 1 : 0);
    }
  });
  it('skips ties and votes on compositions it has no features for, as the fit does', () => {
    const { votes, features } = made(20, 2, 50, 6, (a, b) => a[0] > b[0]),
      more: Vote[] = [...votes, { a: 'c0', b: 'c1', w: 'tie' }, { a: 'c0', b: 'nowhere', w: 'a' }],
      e = evalPairwise(more, features);
    expect(e.real).toBe(50);
    expect(e.looAll).toBeCloseTo(fitPairwise(more, features, { looTest: true }).loo!, 12);
  });
  it('gives the same plain figure as fitPairwise', () => {
    const { votes, features } = made(25, 3, 90, 7, (a, b, r) => a[0] + 0.5 * a[1] + (r() - 0.5) > b[0] + 0.5 * b[1]);
    expect(evalPairwise(votes, features).looAll).toBeCloseTo(fitPairwise(votes, features, { looTest: true }).loo!, 12);
  });
});

describe('the 95% interval', () => {
  it('is Wilson’s', () => {
    const [lo, hi] = wilson(48, 79);
    expect(lo).toBeCloseTo(0.4974, 3);
    expect(hi).toBeCloseTo(0.7079, 3);
    expect(wilson(0, 10)[0]).toBe(0);
    expect(wilson(10, 10)[1]).toBe(1);
    expect(wilson(10, 10)[0]).toBeCloseTo(0.7225, 3);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
});
