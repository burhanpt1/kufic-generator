// Ali Asghar (src/showpiece/aliAsghar): the name in a thuluth cartouche framed by ornament alone, one A3 sheet.
// `npm run ali-asghar` writes the print files to docs/ali-asghar.
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { isValidComposition } from '../src/model/schema';
import { aliAsgharComposition, aliAsgharSheet } from '../src/showpiece/aliAsghar';

describe('Ali Asghar', () => {
  for (const v of ['lapis', 'cobalt'] as const)
    it(`${v}: a cartouche with no text round it, on one A3 landscape sheet`, () => {
      const c = aliAsgharComposition(v);
      expect(isValidComposition(c)).toBe(true);
      expect(Object.keys(c.texts)).toEqual(['names']);
      const p = resolve(c);
      expect(p.meta.warnings).toEqual([]);
      expect(p.meta.fill).toMatchObject({ type: 'roundel', ok: true });
      const s = aliAsgharSheet(v);
      expect(s.w / s.h).toBeCloseTo(Math.SQRT2, 6);
      expect(s.svg).toContain('width="420mm" height="297mm"');
      if (process.env.ALI_ASGHAR) {
        mkdirSync('docs/ali-asghar', { recursive: true });
        writeFileSync(`docs/ali-asghar/ali-asghar-${v}.svg`, s.svg);
      }
    }, 60000);
});
