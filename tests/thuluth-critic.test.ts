// The decorative critic, noise and the rating loop (PORT-PLAN.md §5; lab deco.js, tools/noise.py, bradley_terry.py).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bradleyTerry, fitPairwise, nextPair } from '../src/evolve/ratings';
import type { Vote } from '../src/evolve/ratings';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import {
  buildRoundel,
  decoMetrics,
  noiseOf,
  roundelFeatures,
  sampleRecipe,
  tasteScores,
} from '../src/script/thuluth/roundel';

const ratings = join(import.meta.dirname, '../prototypes/thuluth-lab/refresh/data/ratings'),
  read = (f: string) => JSON.parse(readFileSync(join(ratings, f), 'utf8'));

const disc = (W: number) => {
  const f = new Uint8Array(W * W);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) if ((x - W / 2 + 0.5) ** 2 + (y - W / 2 + 0.5) ** 2 < (W * 0.45) ** 2) f[y * W + x] = 1;
  return f;
};

describe('the decorative critic', () => {
  const W = 120,
    field = disc(W);
  it('finds an even texture even, and a knot a knot', () => {
    const even = new Uint8Array(W * W),
      knot = new Uint8Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (x % 8 < 3) even[y * W + x] = 1;
    for (let y = 50; y < 70; y++) for (let x = 50; x < 70; x++) knot[y * W + x] = 1;
    const e = decoMetrics(even, field, W, W),
      k = decoMetrics(knot, field, W, W);
    expect(e.uniformity).toBeGreaterThan(0.9);
    expect(e.knots).toBe(0);
    expect(k.uniformity).toBeLessThan(0.2);
    expect(k.knots).toBeGreaterThan(0);
  });
  it('counts one body as one, and scattered pieces as less', () => {
    const one = new Uint8Array(W * W),
      many = new Uint8Array(W * W);
    for (let y = 58; y < 62; y++) for (let x = 20; x < 100; x++) one[y * W + x] = 1;
    for (const [cx, cy] of [[30, 30], [90, 30], [30, 90], [90, 90]]) for (let y = cy; y < cy + 4; y++) for (let x = cx; x < cx + 4; x++) many[y * W + x] = 1; // prettier-ignore
    expect(decoMetrics(one, field, W, W).unity).toBe(1);
    expect(decoMetrics(many, field, W, W).unity).toBeCloseTo(0.25, 6);
  });
  it('hears noise in near-touches and pinholes, not in clean strokes', () => {
    const N = 480,
      f = disc(N),
      clean = new Uint8Array(N * N),
      noisy = new Uint8Array(N * N);
    for (let y = 200; y < 216; y++) for (let x = 100; x < 380; x++) clean[y * N + x] = noisy[y * N + x] = 1;
    // a second stroke two pixels short of touching, and a stroke with tiny holes
    for (let y = 218; y < 234; y++) for (let x = 100; x < 380; x++) noisy[y * N + x] = 1;
    for (let x = 110; x < 370; x += 12) noisy[205 * N + x] = noisy[206 * N + x] = 0;
    expect(noiseOf(noisy, f, N, N)).toBeGreaterThan(noiseOf(clean, f, N, N) + 1);
  });
  it('prefers a roundel on lanes to a scattered one, and picks among seeds by the fitted taste', () => {
    const th = thuluth(ROUNDEL_PEN),
      text = 'اللهم صل على محمد وآل محمد',
      compose = { elongate: true, cross: true, kern: true, fillTarget: 0.5, tries: 2, iters: 3000, seed: 29 };
    const lanes = buildRoundel(th, { text, compose: { ...compose, lanes: {} } })!,
      // (ruled lines are the default for a dense text now; the scattered one is free composition)
      free = buildRoundel(th, { text, compose: { ...compose, ruled: false } })!;
    const [a, b] = tasteScores([roundelFeatures(th, lanes.r, lanes.f), roundelFeatures(th, free.r, free.f)]);
    expect(a).toBeGreaterThan(b);
    const chosen = buildRoundel(th, { text: 'علي', compose: { tries: 1, iters: 1500 }, choose: 3 })!;
    expect(chosen.taste!.length).toBeGreaterThanOrEqual(1);
    expect(chosen.taste![chosen.picked!].score).toBe(Math.max(...chosen.taste!.map(t => t.score)));
  });
  it('samples what the recipe leaves open, seed by seed, and drops near-duplicates', () => {
    const a = sampleRecipe({}, 4, 108),
      b = sampleRecipe({ oval: 1.4, stack: true }, 1, 108);
    expect(a).toEqual(sampleRecipe({}, 4, 108));
    expect(b.oval).toBeUndefined();
    expect(b.stack).toBeUndefined();
    expect(b.lanes).toBeUndefined();
    const th = thuluth(ROUNDEL_PEN),
      // one word with nothing left open to vary and a pinned search: every seed finds the same, kept once
      same = buildRoundel(th, { text: 'علي', compose: { tries: 1, iters: 0, oval: 1, fillTarget: 0.4, stack: false, learnedStack: false, girift: 0 }, choose: 3 })!; // prettier-ignore
    expect(same.taste).toHaveLength(1);
  });
});

describe('the rating loop', () => {
  const votes: Vote[] = read('votes.json'),
    items: { id: string }[] = read('items.json'),
    ids = items.map(i => i.id);
  it('ranks the owner’s votes as the lab did', () => {
    const bt = bradleyTerry(votes, ids),
      lab: Record<string, number> = read('bt4.json'),
      common = ids.filter(i => lab[i] != null),
      xs = common.map(i => bt[i]),
      ys = common.map(i => lab[i]),
      m = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length,
      [mx, my] = [m(xs), m(ys)],
      r = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0)); // prettier-ignore
    expect(common.length).toBeGreaterThan(30);
    expect(r).toBeGreaterThan(0.9);
  });
  it('fits a taste that agrees with most of the votes', () => {
    // a toy: one feature decides
    const fs = Object.fromEntries(ids.slice(0, 6).map((id, i) => [id, [i, (i * 7) % 3]])),
      vs: Vote[] = [];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) vs.push({ a: ids[i], b: ids[j], w: 'b' });
    const f = fitPairwise(vs, fs, { looTest: true });
    expect(f.w[0]).toBeGreaterThan(Math.abs(f.w[1]));
    expect(f.loo).toBeGreaterThan(0.85);
  });
  it('offers the least-rated pair not yet compared', () => {
    const p = nextPair([{ a: 'x', b: 'y', w: 'a' }], ['x', 'y', 'z'], () => 0.9)!;
    expect(p).toContain('z');
    expect(nextPair([{ a: 'x', b: 'y', w: 'a' }], ['x', 'y'])).toBeNull();
  });
});
