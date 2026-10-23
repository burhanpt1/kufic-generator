// Lamiah (src/showpiece/lamiah): the name in thuluth three ways, letters only. `npm run lamiah` writes the SVGs to
// docs/lamiah.
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { LAMIAH, lamiahKuficSVGs, lamiahSVGs } from '../src/showpiece/lamiah';

/** The page cropped to the ink, with a margin. */
function cropToInk(svg: string, pad = 16) {
  const b = new Resvg(svg).getBBox()!;
  const [x, y, w, h] = [b.x - pad, b.y - pad, b.width + 2 * pad, b.height + 2 * pad].map(v => Math.round(v));
  return svg.replace(
    /viewBox="[^"]*" width="[^"]*" height="[^"]*"/,
    `viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}"`,
  );
}

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
  const kufic = lamiahKuficSVGs();
  it('builds the square Kufic maze, pinwheel and spiral with no paper or border', () => {
    expect(Object.keys(kufic)).toEqual(['maze', 'pinwheel', 'spiral']);
    for (const svg of Object.values(kufic)) {
      expect(svg).not.toMatch(/#ffffff/i);
      expect(svg).toContain('#1b1b1b');
      expect(svg).not.toMatch(/#DDD0B6|#4A3A2A/i);
    }
  }, 60000);
  if (process.env.LAMIAH)
    it('writes docs/lamiah', () => {
      mkdirSync('docs/lamiah', { recursive: true });
      for (const [k, svg] of Object.entries(svgs)) writeFileSync(`docs/lamiah/lamiah-${k}.svg`, svg);
      for (const [k, svg] of Object.entries(kufic)) writeFileSync(`docs/lamiah/lamiah-kufic-${k}.svg`, cropToInk(svg));
    });
});
