// A star pattern drawn in words: its lines written in a text, so the stars are outlined in the word (Light upon
// light: the field of stars outlined in نور).
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { placeMap } from '../src/compose/textBorder';
import { inside } from '../src/geometry/poly';
import { isValidComposition } from '../src/model/schema';
import type { Composition } from '../src/model/schema';
import type { CellStrip } from '../src/script/types';
import { NAMES_99 } from '../src/mosque/texts';
import { frame } from '../src/showpiece/nur';

const field = () => {
  const p = resolve(frame(NAMES_99.join(' ')));
  const strips = p.items.filter(i => i.type === 'strip' && i.place.type === 'line' && i.place.s < 0.5);
  const region = p.items.find(i => i.type === 'outline');
  return { p, strips, region };
};

describe('pattern drawn in words', () => {
  it('writes the word thousands of times along the pattern lines', () => {
    const { p, strips } = field();
    expect(p.meta.warnings).toEqual([]);
    expect(p.meta.fill?.ok).toBe(true);
    let words = 0;
    for (const it of strips) if (it.type === 'strip') words += Math.max(...Array.from((it.strip as CellStrip).tag));
    expect(words).toBeGreaterThan(2000);
  });
  it('keeps every letter inside the region', () => {
    const { strips, region } = field();
    const R = region!.type === 'outline' ? region!.inner! : [];
    for (const it of strips) {
      if (it.type !== 'strip') continue;
      const st = it.strip as CellStrip,
        m = placeMap(it.place);
      for (let y = 0; y < st.Hb; y++)
        for (let x = 0; x < st.W; x++)
          if (st.data[y * st.W + x]) {
            const [px, py] = m(x + 0.5, y + 0.5);
            expect(inside(R, px, py)).toBe(true);
          }
    }
  });
  it('writes words upright, reading left to right along their line', () => {
    const { strips } = field();
    for (const it of strips)
      if (it.type === 'strip' && it.place.type === 'line') expect(it.place.n[1]).toBeLessThanOrEqual(1e-9);
  });
  it('is validated: the text must name a slot', () => {
    const c: Composition = frame('الله');
    expect(isValidComposition(c)).toBe(true);
    (c.root.child.fill as { text: string }).text = 'missing';
    expect(isValidComposition(c)).toBe(false);
  });
});
