import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { comparePNG } from '../scripts/compare-lab.mjs';
import { toPNG } from '../scripts/raster.mjs';

const dir = join(import.meta.dirname, 'golden-lab');
const manifest: { id: string }[] = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

describe('Kufic Lab references', () => {
  it('has an SVG and a PNG for every case', () => {
    expect(manifest.length).toBeGreaterThan(30);
    for (const { id } of manifest) {
      expect(readFileSync(join(dir, `${id}.svg`), 'utf8')).toMatch(/^<svg /);
      expect(
        readFileSync(join(dir, `${id}.png`))
          .subarray(1, 4)
          .toString(),
      ).toBe('PNG');
    }
  });
  it('comparison scores a reference against itself as identical and a changed drawing as different', () => {
    const id = 'shape--fatimid-circle',
      svg = readFileSync(join(dir, `${id}.svg`), 'utf8'),
      ref = readFileSync(join(dir, `${id}.png`));
    expect(comparePNG(ref, toPNG(svg)).ratio).toBe(0);
    const changed = svg.replace(/fill="#4[Aa]3[Aa]2[Aa]"/g, 'fill="#00ff00"');
    expect(comparePNG(ref, toPNG(changed)).ratio).toBeGreaterThan(0.01);
  });
});
