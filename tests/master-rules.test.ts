// Rules from reviewing "Light upon light" as a master calligrapher would: a band fills before it stretches; a run
// that would hold one lone word stays plain; a lone word over a line of several isn't pulled apart by kashidas.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { MAX_SLACK } from '../src/compose/textBorder';
import { loadSealWasm } from '../src/kernels/seal';
import { DEFAULT_STYLE } from '../src/model/style';
import { wordBlock } from '../src/monogram/wordBlock';
import { kufi } from '../src/script/kufi';
import { niche } from '../src/showpiece/nur';

await loadSealWasm();
const rings = () => {
  const p = resolve(niche());
  return Object.fromEntries(p.meta.borders.map(b => [b.slot, b.rings[0]]));
};

describe('master rules', () => {
  it('a text written once grows its letters to fill the band instead of stretching (the Light Verse)', () => {
    const r = rings();
    expect(r.verse.scale).toBeGreaterThan(1.3);
    expect(r.verse.slack).toBeLessThan(MAX_SLACK + 0.06);
  });
  it('a repeated text fills its band by repeating, with little stretch', () => {
    const r = rings();
    for (const k of ['niche', 'glass', 'tree', 'oil']) expect(r[k].slack).toBeLessThan(MAX_SLACK + 0.06);
  });
  it('keeps words whole on a broken outline, leaving narrow runs plain (the lamp)', () => {
    const lamp = rings().lamp;
    expect(lamp.mode).toBe('words');
    expect(lamp.groupSizes.filter(n => n === 0).length).toBeGreaterThan(lamp.groupSizes.length / 2);
    expect(lamp.groupSizes.filter(n => n === 1).length).toBeLessThanOrEqual(1);
  });
  it('keeps a lone word compact over a line of several (نور over على نور)', () => {
    const b = wordBlock(kufi, 'نور على نور'.split(' '), DEFAULT_STYLE.letter, [7, 10])!,
      g = b.grid;
    expect(b.lines).toEqual([['نور'], ['على', 'نور']]);
    // ink span of the top line against the block's width
    let x0 = g.w,
      x1 = -1;
    for (let y = 0; y < b.H; y++)
      for (let x = 0; x < g.w; x++)
        if (g.data[y * g.w + x] === 1) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
        }
    expect(x1 - x0 + 1).toBeLessThan(0.6 * g.w);
  });
});
