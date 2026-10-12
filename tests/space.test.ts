// Lab port §2: the empty-space measure.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { metrics } from '../src/evolve/critic';
import { emptySpace, spaceScore } from '../src/evolve/space';
import { DEFAULT_WEIGHTS } from '../src/evolve/taste';
import { preset, PRESETS } from '../src/model/presets';
import type { Composition } from '../src/model/schema';
import { loadSealWasm } from '../src/kernels/seal';

await loadSealWasm();
const medallion = preset('fatimid-medallion');
// a single basmala ring around a centre left blank
const lonely: Composition = {
  ...medallion,
  canvas: { shape: 'square', margin: 3 },
  root: {
    type: 'frame',
    child: {
      type: 'region',
      outline: { kind: 'circle' },
      borders: [{ type: 'textBorder', text: 'basmala', separator: { kind: 'lines', width: 2 } }],
      fill: { type: 'solid' },
    },
  },
};

describe('empty space', () => {
  it('scores a blank raster 0 and a textured one 1', () => {
    const N = 160,
      blank = new Uint8Array(N * N).fill(255),
      busy = blank.map((_, i) => (((i % N) + Math.floor(i / N)) % 3 ? 255 : 0));
    expect(spaceScore(blank)).toBe(0);
    expect(spaceScore(busy)).toBe(1);
  });
  it('a single ring round an empty centre scores clearly lower than the filled medallion', () => {
    const a = emptySpace(resolve(lonely)),
      b = emptySpace(resolve(medallion));
    expect(b).toBeGreaterThan(0.7);
    expect(b - a).toBeGreaterThan(0.4);
  });
  it('is a critic metric with default weight 0.3, in [0, 1] for every preset', () => {
    expect(DEFAULT_WEIGHTS.space).toBe(0.3);
    for (const p of PRESETS) {
      const s = metrics(resolve(p.comp))!.space;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
  it('is quick: well under the 75 ms a 16-candidate generation can spare per candidate', () => {
    // the fastest of 16 runs, so a busy machine (the full suite runs files in parallel) doesn't fail it
    const p = resolve(medallion);
    let best = Infinity;
    for (let i = 0; i < 16; i++) {
      const t = performance.now();
      emptySpace(p);
      best = Math.min(best, performance.now() - t);
    }
    expect(best).toBeLessThan(25);
  });
});
