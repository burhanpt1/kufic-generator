import { describe, expect, it } from 'vitest';
import { setVariants } from '../src/glyphs/overrides';
import { partition, repeatSegs, widthFn } from '../src/layout/solvers';
import { RHY, strip } from '../src/layout/strip';
import { breakSegs, prepare, wordSegs } from '../src/shaping/prepare';
import { shape } from '../src/shaping/shape';
import type { Segs } from '../src/types';

const WG = 2;
function segsFor(text: string, split: 'words' | 'all' = 'words') {
  setVariants({});
  const p = prepare(shape(text).words, 9, 'dots', 'modern');
  const segs: Segs = split === 'words' ? wordSegs(p.words) : breakSegs(p.words);
  segs.wg = WG;
  return { segs, Hb: p.Hb, base: p.base };
}
const natural = (segs: Segs) => widthFn(segs)(0, segs.length);

describe('partition()', () => {
  const { segs } = segsFor('بسم الله الرحمن الرحيم محمد علي فاطمة الحسن الحسين', 'all');
  const total = natural(segs);

  it('keeps every segment, in order, in non-empty contiguous groups that fit their capacities', () => {
    for (const G of [1, 2, 4, 8]) {
      const cap = Math.ceil(total / G) + 12,
        caps = Array(G).fill(cap);
      const p = partition(segs, caps)!;
      expect(p).not.toBeNull();
      expect(p.groups).toHaveLength(G);
      expect(p.groups.flat()).toEqual([...segs]);
      p.groups.forEach((g, i) => {
        expect(g.length).toBeGreaterThan(0);
        const gs: Segs = Object.assign([...g], { wg: WG });
        expect(natural(gs)).toBeLessThanOrEqual(caps[i]);
      });
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThan(1);
    }
  });
  it('returns null when there are more groups than segments or nothing fits', () => {
    expect(partition(segs, Array(segs.length + 1).fill(1000))).toBeNull();
    expect(partition(segs, [total - 1])).toBeNull();
    expect(partition(segs, [0, 1000])).toBeNull();
  });
  it('fits exactly at the natural width with one group', () => {
    const p = partition(segs, [total])!;
    expect(p.groups).toEqual([[...segs]]);
    expect(p.score).toBe(0);
  });
  it('prefers breaking between words over breaking inside one', () => {
    const p = partition(segs, [Math.ceil(total / 2) + 6, Math.ceil(total / 2) + 6])!;
    expect(p.groups[0][p.groups[0].length - 1].endsWord).toBe(true);
  });
  it('repeatSegs repeats in order and tags each copy', () => {
    const r = repeatSegs(segs, 3);
    expect(r).toHaveLength(segs.length * 3);
    expect(r.wg).toBe(WG);
    expect(r.map(s => s.rep)).toEqual([0, 1, 2].flatMap(k => Array(segs.length).fill(k)));
    expect(r[segs.length - 1].endsWord).toBe(true);
  });
});

describe('strip()', () => {
  const texts = ['بسم الله الرحمن الرحيم', 'لا اله الا الله', 'يا علي مدد', 'محمد'];
  for (const text of texts)
    for (const rhythm of [false, true])
      it(`justifies "${text}" to exactly the target width (rhythm ${rhythm ? 'on' : 'off'})`, () => {
        const { segs, Hb, base } = segsFor(text);
        RHY.on = rhythm;
        const nat = natural(segs);
        for (const W of [nat, nat + 1, nat + 7, nat + 40, Math.round(nat * 2.5)]) {
          const st = strip(segs, Hb, base, WG, W, true)!;
          expect(st.W).toBe(W);
          expect(st.data).toHaveLength(W * Hb);
          expect(st.tag).toHaveLength(W * Hb);
          // something is drawn in the first and last columns (letters or their dots): the line spans the full width
          let minX = W,
            maxX = -1;
          for (let y = 0; y < Hb; y++)
            for (let x = 0; x < W; x++)
              if (st.data[y * W + x]) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
              }
          expect(minX).toBe(0);
          expect(maxX).toBe(W - 1);
        }
        RHY.on = false;
      });
  it('returns null when the text is wider than the target, and natural width for null', () => {
    const { segs, Hb, base } = segsFor('بسم الله');
    const nat = natural(segs);
    expect(strip(segs, Hb, base, WG, nat - 1)).toBeNull();
    expect(strip(segs, Hb, base, WG, null)!.W).toBe(nat);
  });
  it('is deterministic with the rhythm search on', () => {
    const { segs, Hb, base } = segsFor('بسم الله الرحمن الرحيم');
    RHY.on = true;
    const a = strip(segs, Hb, base, WG, 140, true)!,
      b = strip(segs, Hb, base, WG, 140, true)!;
    RHY.on = false;
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });
});
