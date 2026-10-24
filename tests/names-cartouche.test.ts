// Two names in a cartouche (src/showpiece/names) and its palettes (src/ornament/palette): the great nun stands free at
// the head of its bowl, nothing touches, and every colour is a shade of the primary or the accent, by contrast.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { isValidComposition } from '../src/model/schema';
import { preset } from '../src/model/presets';
import { namePalette } from '../src/ornament/palette';
import { NAMES_RECIPE, namesComposition } from '../src/showpiece/names';

const lum = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); // prettier-ignore
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('name palettes', () => {
  const p = namePalette('#1E5B4F', '#D9A23A');
  it('orders the roles by contrast with the field: quiet tiles, clear accents, strong names', () => {
    const c = (k: string) => contrast(k, p.field);
    expect(c(p.tiles.ink)).toBeLessThan(2.2);
    expect(c(p.tiles.ink2)).toBeLessThan(2.2);
    expect(c(p.accent)).toBeGreaterThan(4);
    expect(c(p.names)).toBeGreaterThan(8);
    expect(c(p.names)).toBeGreaterThan(c(p.rim));
  });
  it('is the same palette every time', () => expect(namePalette('#1E5B4F', '#D9A23A')).toEqual(p));
});

describe('the names cartouche', () => {
  it('keeps the great bowl, a free-standing nun, in its recipe', () => {
    expect(NAMES_RECIPE.bowl).toMatchObject({ free: true });
    expect(preset('names-cartouche').root.child.fill).toMatchObject({
      type: 'roundel',
      recipe: { bowl: { free: true } },
    });
  });
  it('resolves with nothing touching, the bowl clear, and both names in one colour', () => {
    const c = namesComposition('بُرْهَان وَشَمِيرَة', '#4B2A5C', '#2AA6A0', {
      recipe: { seed: 13, stackAt: ['شمير'] },
    });
    expect(isValidComposition(c)).toBe(true);
    const placed = resolve(c),
      m = placed.meta.fill!.metrics!;
    expect(m.clash).toBe(0);
    expect(m.grow).toBeLessThan(0.15);
    const it = placed.items.find(i => i.type === 'roundel') as Extract<(typeof placed.items)[number], { type: 'roundel' }>; // prettier-ignore
    const pal = namePalette('#4B2A5C', '#2AA6A0');
    expect(new Set(it.tints.map(t => t.colour))).toEqual(new Set([pal.names, pal.accent]));
    expect(it.counterTints!.map(t => t.colour)).toContain(pal.eyes);
  }, 120000);
});
