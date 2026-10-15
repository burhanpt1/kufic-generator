// Zainab and Qusay (src/showpiece/wedding): the lab's cartouche rebuilt inside a Kufic ring of Ar-Rum 30:21 on Iznik
// tiles, one A3 sheet. `npm run wedding` writes the print files to docs/wedding.
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Placed } from '../src/compose';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';
import { WEDDING, weddingComposition, weddingSheet } from '../src/showpiece/wedding';
import type { Shaped } from '../src/types';

describe('Zainab and Qusay', () => {
  it('quotes the verse exactly as chosen, and every letter of it is drawn', () => {
    expect(WEDDING.verse).toBe('ومن آياته أن خلق لكم من أنفسكم أزواجا لتسكنوا إليها وجعل بينكم مودة ورحمة');
    expect((kufi.shape(WEDDING.verse, { ...DEFAULT_STYLE.letter, marks: 'dots' }) as Shaped).unsupported).toEqual([]);
  });
  for (const v of ['cobalt', 'lapis'] as const)
    describe(v, () => {
      let p: Placed;
      it('resolves with the verse once round the ring, closed by a star, and every mark of the names', () => {
        const c = weddingComposition(v);
        expect(isValidComposition(c)).toBe(true);
        p = resolve(c);
        expect(p.meta.warnings).toEqual([]);
        const [ring] = p.meta.borders[0].rings;
        expect(ring.rep).toBe(1);
        expect(ring.groupSizes.reduce((a, b) => a + b, 0)).toBe(ring.segsPerRep);
        expect(p.items.filter(i => i.type === 'star')).toHaveLength(1);
        expect(p.meta.fill).toMatchObject({ type: 'roundel', ok: true });
        expect(p.items.filter(i => i.type === 'tilework')).toHaveLength(2);
      }, 60000);
      it('makes one A3 landscape sheet', () => {
        const s = weddingSheet(v);
        expect(s.w / s.h).toBeCloseTo(Math.SQRT2, 6);
        expect(s.svg).toContain('width="420mm" height="297mm"');
        expect(s.placed.meta.warnings).toEqual([]);
        if (process.env.WEDDING) {
          mkdirSync('docs/wedding', { recursive: true });
          writeFileSync(`docs/wedding/zainab-qusay-${v}.svg`, s.svg);
        }
      }, 60000);
    });
});
