// Owner's feedback: tall letters must not fill their whole band and run into the separator beside it.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { bandRoom } from '../src/compose/resolve';
import { loadSealWasm } from '../src/kernels/seal';
import { PRESETS } from '../src/model/presets';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';
import { HEADROOM_CASES } from '../demos/headroom-cases';
import { clearances, reachOf } from './helpers/clearance';

await loadSealWasm();

describe('band depth', () => {
  it('ends tall stems at no more than 85% of the band, at least a cell below the band edge', () => {
    for (const ascenders of [7, 9, 11, 13])
      for (const kind of ['none', 'notch', 'leaf', 'palmette'] as const)
        for (const weight of [0.55, 0.85, 1]) {
          const style = {
              ...DEFAULT_STYLE,
              terminals: { kind, reach: 'tails' as const },
              stroke: { ...DEFAULT_STYLE.stroke, weight },
            },
            p = kufi.prepareLines(['بسم الله الرحمن الرحيم'], { ...style.letter, ascenders })[0],
            room = bandRoom(p, style),
            stem = p.base + p.ascenders;
          expect(stem / room).toBeLessThanOrEqual(0.85);
          expect(stem / room).toBeGreaterThan(0.7);
          expect(room - Math.max(p.Hb, stem + reachOf(kind, weight))).toBeGreaterThanOrEqual(1 - 1e-9);
        }
  });
});

describe('letters keep half a cell from separators and the outline', () => {
  it.each(PRESETS.map(p => [p.id, p.comp] as const))('preset %s', (_, comp) => {
    expect(clearances(resolve(comp))).toEqual([]);
  });
  it.each(HEADROOM_CASES.map(c => [c.id, c.comp] as const))('tallest ascenders: %s', (_, comp) => {
    expect(clearances(resolve(comp))).toEqual([]);
  });
});
