// Lamiah (src/showpiece/lamiah): the name in thuluth three ways, letters only. `npm run lamiah` writes the SVGs to
// docs/lamiah.
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LAMIAH, lamiahSVGs } from '../src/showpiece/lamiah';

describe('Lamiah', () => {
  const svgs = lamiahSVGs();
  it('is spelled lam, mim, ya, ta marbuta', () => expect([...LAMIAH]).toEqual(['ل', 'م', 'ي', 'ة']));
  it('draws the three versions as ink only, with no paper, field or ring', () => {
    for (const svg of Object.values(svgs)) {
      expect(svg).not.toMatch(/<rect|<ellipse|<circle/);
      expect(svg.match(/<path /g)).toHaveLength(1);
    }
    expect(Object.keys(svgs)).toEqual(['classic', 'tughra', 'monogram']);
  });
  it('is deterministic', () => expect(lamiahSVGs()).toEqual(svgs));
  if (process.env.LAMIAH)
    it('writes docs/lamiah', () => {
      mkdirSync('docs/lamiah', { recursive: true });
      for (const [k, svg] of Object.entries(svgs)) writeFileSync(`docs/lamiah/lamiah-${k}.svg`, svg);
    });
});
