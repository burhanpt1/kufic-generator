// The straight-to-round check in CI (PLAN-2 §8): the letters' share of straight stroke, by length, on the 64 Calliar
// texts, must stay near the masters' 0.695. Rerun on every letter change; a drift past 0.05 fails the build.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THULUTH, ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { MASTER_STRAIGHT, straightLength } from '../src/script/thuluth/straight';

const texts: string[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '../prototypes/thuluth-lab/refresh/data/calliar_paths.json'), 'utf8'),
).map((x: { text: string }) => x.text);

describe('the balance of straight and round', () => {
  it('measures a straight stroke as straight, and a tight loop in a long letter as round', () => {
    const line = Array.from({ length: 30 }, (_, i) => ({ x: i, y: 0, w: 1 })),
      loop = Array.from({ length: 40 }, (_, i) => ({ x: 30 + Math.sin((i / 40) * 2 * Math.PI), y: 1 - Math.cos((i / 40) * 2 * Math.PI), w: 1 })), // prettier-ignore
      a = straightLength([{ ang: 69, s: line, own: line.map(() => 0) }]),
      b = straightLength([{ ang: 69, s: [...line, ...loop], own: [...line, ...loop].map(() => 0) }]);
    expect(a.straight / a.total).toBeGreaterThan(0.95);
    // 30 of straight and about 6 of loop
    expect(b.straight / b.total).toBeLessThan(0.9);
    expect(b.straight / b.total).toBeGreaterThan(0.7);
  });
  it.each([
    ['line', DEFAULT_THULUTH],
    ['roundel', ROUNDEL_PEN],
  ])('stays near the masters with the %s pen', (_, pen) => {
    const th = thuluth(pen);
    let s = 0,
      t = 0;
    for (const tx of texts) {
      const r = straightLength(th.buildStrokes(tx).strokes);
      s += r.straight;
      t += r.total;
    }
    expect(texts).toHaveLength(64);
    expect(Math.abs(s / t - MASTER_STRAIGHT)).toBeLessThan(0.05);
  });
});
