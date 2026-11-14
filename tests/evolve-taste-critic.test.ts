// Two faults of the critic and the taste. learn() took a metric's population mean over every composition, counting 0
// for those without it, so picking any monogram (or maze, or roundel) raised all of that kind's weights, however the
// pick did against its peers. And the borders critic divided by the mean ink density, which is 0 for a strip with no
// ink: a NaN metric, and so a NaN score.
import { describe, expect, it } from 'vitest';
import type { Placed } from '../src/compose/placed';
import { criticOf, type Metrics } from '../src/evolve/critic';
import { learn, newTaste, score } from '../src/evolve/taste';
import { PRESETS } from '../src/model/presets';
import type { CellStrip } from '../src/script/types';

const comp = PRESETS[0].comp;
/** A metric's share of all the weight. */
const share = (w: Record<string, number>, k: string) => w[k] / Object.values(w).reduce((a, b) => a + b, 0);

describe('learning from picks', () => {
  // two with borders only, two monograms, alike in everything but the monograms' legibility
  const band: Metrics = { rhythm: 0.5, density: 0.5 },
    good: Metrics = { rhythm: 0.5, density: 0.5, legibility: 0.9, compact: 0.6 },
    poor: Metrics = { rhythm: 0.5, density: 0.5, legibility: 0.5, compact: 0.6 },
    population = [band, band, good, poor],
    t0 = newTaste();
  it('compares a pick with its peers: the weaker monogram lowers the weight of what it does worse', () => {
    const t = learn(t0, [{ comp, m: poor }], population);
    // (over the whole population the mean was 0.35, and picking the weaker one raised legibility)
    expect(share(t.w, 'legibility')).toBeLessThan(share(t0.w, 'legibility'));
    // what it does as well as its peers does not move against the rest
    expect(t.w.compact / t.w.rhythm).toBeCloseTo(t0.w.compact / t0.w.rhythm, 12);
  });
  it('raises the weight of what the pick does better than its peers', () => {
    const t = learn(t0, [{ comp, m: good }], population);
    expect(share(t.w, 'legibility')).toBeGreaterThan(share(t0.w, 'legibility'));
    expect(t.w.compact / t.w.rhythm).toBeCloseTo(t0.w.compact / t0.w.rhythm, 12);
  });
  it('does not reward a kind of composition for being that kind', () => {
    // the only monogram in the population, picked: nothing to compare it with, so no weight moves
    const t = learn(t0, [{ comp, m: good }], [band, band, band, good]);
    for (const k of Object.keys(t0.w)) expect(share(t.w, k), k).toBeCloseTo(share(t0.w, k), 12);
  });
  it('keeps the weights finite and summing to 1, and counts the pick', () => {
    const t = learn(t0, [{ comp, m: good }], [null, band, good, poor]);
    expect(Object.values(t.w).every(Number.isFinite)).toBe(true);
    expect(Object.values(t.w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(t.picks).toBe(1);
    expect(Number.isFinite(score(good, t))).toBe(true);
  });
});

describe('the borders critic', () => {
  const strip = (ink: boolean): CellStrip => {
    const W = 40,
      Hb = 8,
      data = new Uint8Array(W * Hb);
    if (ink) for (let x = 0; x < W; x += 3) for (let y = 2; y < 6; y++) data[y * W + x] = 1;
    return { kind: 'cells', W, Hb, base: 2, data, tag: new Uint8Array(W * Hb) };
  };
  const placed = (strips: CellStrip[]) =>
    ({
      canvas: { w: 100, h: 100 },
      items: strips.map((s, i) => ({ type: 'strip', style: 0, strip: s, ring: i + 1, place: { type: 'line', s: 1 } })),
      meta: { size: 100, outline: [], borders: [{ rings: strips.map(() => ({ rep: 1 })) }], fill: null, inner: 0.25, warnings: [] }, // prettier-ignore
    }) as unknown as Placed;
  const borders = criticOf('borders')!;
  it('scores strips with no ink as numbers, not NaN', () => {
    for (const p of [placed([strip(false)]), placed([strip(false), strip(false)])]) {
      const m = borders(p);
      expect(Object.keys(m)).toEqual(['rhythm', 'kashida', 'density', 'rep', 'fill']);
      for (const [k, v] of Object.entries(m)) expect(Number.isFinite(v), k).toBe(true);
      expect(m.density).toBe(0);
      expect(Number.isFinite(score(m, newTaste()))).toBe(true);
    }
  });
  it('scores strips with ink as before', () => {
    const m = borders(placed([strip(true), strip(false)]));
    for (const v of Object.values(m)) expect(v >= 0 && v <= 1).toBe(true);
    // one strip inked, one empty: uneven density is the spread over the mean, here 1
    const d = (4 * 14) / (40 * 8) / 2;
    expect(m.density).toBeCloseTo(Math.max(0, 1 - Math.abs(d - 0.26) / 0.16) * Math.max(0, 1 - 1 / 0.6), 12);
  });
});
