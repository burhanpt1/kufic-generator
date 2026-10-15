// The vendored thuluth lab and its references (prototypes/thuluth-lab, tests/golden-thuluth-lab).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';

const dir = join(import.meta.dirname, 'golden-thuluth-lab'),
  manifest: { id: string; width: number }[] = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

describe('thuluth lab references', () => {
  it('cover the line specimens at both pens, the wedding cartouche and the three tilings', () => {
    const ids = manifest.map(m => m.id);
    expect(ids.filter(i => i.endsWith('-roundel'))).toHaveLength(9);
    expect(ids.filter(i => i.endsWith('-tile'))).toHaveLength(9);
    expect(ids).toContain('cartouche-zainab-qusay');
    expect(ids.filter(i => i.startsWith('tiling-'))).toEqual(['tiling-8fold', 'tiling-10fold', 'tiling-12fold']);
  });
  it('have a raster at the recorded width, and an SVG except for the tilings', () => {
    for (const { id, width } of manifest) {
      expect(PNG.sync.read(readFileSync(join(dir, `${id}.png`))).width, id).toBe(width);
      expect(existsSync(join(dir, `${id}.svg`)), id).toBe(!id.startsWith('tiling-'));
    }
  });
  it('leave the photo-derived letter masks out of the repo', () => {
    expect(existsSync(join(import.meta.dirname, '../prototypes/thuluth-lab/data/targets'))).toBe(false);
  });
});
