// Seeds of the roundel composer: the generator was written inline, unguarded, so seed 0 gave a stream stuck at zero
// (an anneal that never moves) and a negative seed threw (a negative index). Every seed is now a valid state, and a
// seed that worked gives the stream it always gave.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth/engine';
import { parkMiller, seedState } from '../src/script/thuluth/rng';
import { composeRoundel, sampleRecipe } from '../src/script/thuluth/roundel';
import { Rng } from '../src/evolve/rng';

/** The generator as it was written inline in the composer. */
const inline = (seed: number) => {
  let sd = seed;
  return () => (sd = (sd * 16807) % 2147483647) / 2147483647;
};

describe('seeded randomness', () => {
  it('keeps the stream of every seed that worked', () => {
    for (const seed of [1, 7, 12345, 7 + 3 * 7919, 2147483646, 2147483648, 4294967301]) {
      const a = parkMiller(seed),
        b = inline(seed);
      for (let i = 0; i < 50; i++) expect(a()).toBe(b());
    }
  });
  it('is the stream of Rng', () => {
    const a = parkMiller(99),
      b = new Rng(99);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b.next());
  });
  it('maps zero, negative and unusable seeds to valid ones', () => {
    expect(seedState(0)).toBe(1);
    expect(seedState(-3)).toBe(3);
    expect(seedState(2147483647)).toBe(1);
    expect(seedState(-2147483650)).toBe(3);
    expect(seedState(NaN)).toBe(1);
    expect(seedState(Infinity)).toBe(1);
    for (const seed of [0, -3, -7919, 2147483647, NaN]) {
      const R = parkMiller(seed),
        vs = Array.from({ length: 200 }, R);
      for (const v of vs) expect(v > 0 && v < 1).toBe(true);
      expect(new Set(vs).size).toBe(200);
    }
  });
});

describe('the roundel composer with any seed', () => {
  const th = thuluth(ROUNDEL_PEN),
    key = (seed: number) => {
      const r = composeRoundel(th, 'محمد علي', { tries: 1, iters: 400, seed })[0];
      return JSON.stringify([r.lv, r.st.map(p => [Math.round(p.x * 100), Math.round(p.y * 100)])]);
    };
  it('composes with seed 0 and with a negative seed, deterministically', () => {
    for (const seed of [0, -3, -7919]) {
      const a = key(seed);
      expect(a).toBe(key(seed));
    }
    // seed 0 was a stream of zeros (an anneal that never moved); it is now the stream of seed 1, and −3 that of 3
    expect(key(0)).toBe(key(1));
    expect(key(-3)).toBe(key(3));
  });
  it('samples a recipe from a negative seed', () => {
    const o = sampleRecipe({}, 3, -11);
    expect([1, 1.15, 1.3]).toContain(o.oval);
    expect([0.36, 0.45, 0.5]).toContain(o.fillTarget);
    expect([0, 0.04]).toContain(o.girift);
  });
});
