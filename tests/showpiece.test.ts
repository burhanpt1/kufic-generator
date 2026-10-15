// "Light upon light" (src/showpiece): the Light Verse as one A1 sheet, nested as the verse nests (niche → lamp →
// glass → star). `npm run showpiece` writes the print file to docs/showpiece.
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from '../src/compose';
import { loadSealWasm } from '../src/kernels/seal';
import { isValidComposition } from '../src/model/schema';
import { NAMES_99 } from '../src/mosque/texts';
import { cartouche, frame, NUR, niche } from '../src/showpiece/nur';
import { nurSheet } from '../src/showpiece/sheet';
import { kufi } from '../src/script/kufi';
import { DEFAULT_STYLE } from '../src/model/style';

await loadSealWasm();

describe('Light upon light', () => {
  it('quotes the verse whole, and every phrase it nests is part of it', () => {
    for (const [k, t] of Object.entries(NUR)) {
      if (k !== 'verse') expect(NUR.verse.includes(t)).toBe(true);
      expect(kufi.shape(t, DEFAULT_STYLE.letter).unsupported).toEqual([]);
    }
  });
  it.each([
    ['niche', niche()],
    ['frame', frame(NAMES_99.join(' '))],
    ['cartouche', cartouche('بسم الله الرحمن الرحيم', 1)],
  ])('%s resolves with every border and fill in place', (_, c) => {
    expect(isValidComposition(c)).toBe(true);
    const p = resolve(c);
    expect(p.meta.warnings).toEqual([]);
    expect(p.meta.fill?.ok).toBe(true);
  });
  it('nests niche, lamp, glass and star, each recorded with its outline', () => {
    const outlines = resolve(niche()).items.filter(i => i.type === 'outline');
    expect(outlines).toHaveLength(4);
    expect(outlines.every(o => o.type === 'outline' && o.inner && o.inner.length > 2)).toBe(true);
  });
  it('makes one A1 sheet at 1 : √2', () => {
    const s = nurSheet();
    expect(s.warnings).toEqual([]);
    expect(s.h / s.w).toBeCloseTo(Math.SQRT2, 6);
    expect(s.svg).toContain('width="594mm" height="841mm"');
    if (process.env.SHOWPIECE) {
      mkdirSync('docs/showpiece', { recursive: true });
      writeFileSync('docs/showpiece/light-upon-light.svg', s.svg);
    }
  }, 120000);
});
