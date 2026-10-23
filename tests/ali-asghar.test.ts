// Ali Asghar (src/showpiece/aliAsghar): the name in a thuluth cartouche framed by ornament alone, one A3 sheet per
// layout. `npm run ali-asghar` writes the print files to docs/ali-asghar.
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { isValidComposition } from '../src/model/schema';
import { ALI_ASGHAR_LAYOUTS, aliAsgharComposition, aliAsgharSheet } from '../src/showpiece/aliAsghar';
import type { AliAsgharLayout } from '../src/showpiece/aliAsghar';

describe('Ali Asghar', () => {
  for (const v of ['lapis', 'cobalt'] as const)
    it(`${v}: a cartouche with no text round it, on one A3 landscape sheet`, () => {
      const c = aliAsgharComposition(v);
      expect(isValidComposition(c)).toBe(true);
      expect(Object.keys(c.texts)).toEqual(['names']);
      const s = aliAsgharSheet(v);
      expect(s.placed.meta.warnings).toEqual([]);
      expect(s.placed.meta.fill).toMatchObject({ type: 'roundel', ok: true });
      expect(s.w / s.h).toBeCloseTo(Math.SQRT2, 6);
      expect(s.svg).toContain('width="420mm" height="297mm"');
      if (process.env.ALI_ASGHAR) {
        mkdirSync('docs/ali-asghar', { recursive: true });
        writeFileSync(`docs/ali-asghar/ali-asghar-${v}.svg`, s.svg);
      }
    }, 60000);
  for (const layout of Object.keys(ALI_ASGHAR_LAYOUTS).filter(k => k !== 'side') as AliAsgharLayout[])
    it(`${layout}: the swoops or the shelf are drawn`, () => {
      const c = aliAsgharComposition('lapis', layout);
      expect(isValidComposition(c)).toBe(true);
      const p = resolve(c),
        m = p.meta.fill?.type === 'roundel' ? p.meta.fill.metrics : undefined;
      expect(p.meta.warnings).toEqual([]);
      expect(p.meta.fill).toMatchObject({ type: 'roundel', ok: true });
      // the swoop: the ya's tail under أصغر and the ra's own
      if (layout.startsWith('swoop')) expect(m?.tails).toBe(2);
      if (process.env.ALI_ASGHAR) {
        mkdirSync('docs/ali-asghar', { recursive: true });
        writeFileSync(`docs/ali-asghar/ali-asghar-${layout}.svg`, aliAsgharSheet('lapis', layout).svg);
      }
    }, 60000);
});
