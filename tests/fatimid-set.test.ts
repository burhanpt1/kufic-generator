// The Fatimid letter set (letter.set = 'fatimid'): its own forms of ر و د and medial ه, and more long alternates
// (final ف ق ص س) for the justifier to choose. Original designs; the square set stays the default.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { traitsOf } from '../src/evolve/genes';
import { applyTrait } from '../src/evolve/operators';
import { Rng } from '../src/evolve/rng';
import { def, getRows, setVariants } from '../src/glyphs/overrides';
import { preset } from '../src/model/presets';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';
import type { CellStrip } from '../src/script/types';
import type { BandGlyph, Seg } from '../src/types';

const style = (set: 'square' | 'fatimid', alternates = true) => ({ ...DEFAULT_STYLE.letter, set, alternates });
const glyphs = (text: string, set: 'square' | 'fatimid') =>
  kufi.prepareLines([text], style(set))[0].words.flatMap(w => (w as { glyphs: BandGlyph[] }).glyphs);

describe('Fatimid letter set', () => {
  it('draws its own ر و د and medial ه, and leaves other letters as they are', () => {
    for (const [k, f] of [
      ['REH', 'iso'],
      ['WAW', 'iso'],
      ['DAL', 'iso'],
      ['DAL', 'fin'],
      ['HEH', 'med'],
    ] as const) {
      setVariants({ set: 'fatimid' });
      const fa = def(k, f);
      setVariants({});
      expect(fa).not.toEqual(def(k, f));
    }
    for (const [k, f] of [
      ['ALEF', 'iso'],
      ['BEH', 'ini'],
      ['HEH', 'ini'],
      ['SEEN', 'fin'],
    ] as const)
      expect(getRows(k, f, { set: 'fatimid' })).toEqual(getRows(k, f, {}));
  });
  it('keeps every stroke orthogonal (diagonal links draw as crossings in block style)', () => {
    for (const [k, f] of [
      ['REH', 'iso'],
      ['WAW', 'iso'],
      ['DAL', 'iso'],
      ['HEH', 'med'],
    ] as const) {
      const r = getRows(k, f, { set: 'fatimid' }),
        at = (x: number, y: number) => r[y]?.[x] === '#';
      for (let y = 0; y < r.length; y++)
        for (let x = 0; x < r[y].length; x++)
          if (at(x, y) && !at(x - 1, y) && !at(x + 1, y) && !at(x, y - 1) && !at(x, y + 1))
            throw new Error(`${k}.${f}: cell ${x},${y} touches its neighbours only at a corner`);
    }
  });
  it('offers rising-tail alternates for final ف ق ص س, only in the Fatimid set', () => {
    const text = 'قوس رفيق خالص لطف';
    const sq = glyphs(text, 'square'),
      fa = glyphs(text, 'fatimid');
    expect(sq.filter(g => g.alt).length).toBe(0);
    expect(fa.filter(g => g.alt).length).toBe(4);
  });
  it('keeps the dots of a long alternate over the letter they belong to (ش)', () => {
    const g = glyphs('عرش', 'fatimid').find(b => b.alt)!,
      alt = g.alt!;
    const cols = (b: BandGlyph, v: number) => {
      const xs: number[] = [];
      for (let i = 0; i < b.data.length; i++) if (b.data[i] === v) xs.push(i % b.w);
      return xs;
    };
    // the dots sit as far from the right edge in the alternate as in the plain form
    const right = (b: BandGlyph) => b.w - 1 - Math.min(...cols(b, 3));
    expect(right(alt)).toBe(right(g));
  });
  it('the justifier takes them when a line has room, at the exact width', () => {
    const p = kufi.prepareLines(['قوس خالص'], style('fatimid'))[0],
      segs = kufi.segments(p, 'words', 2) as Seg[],
      nat = segs.reduce((a, s) => a + s.minW, 0) + 2 * (segs.length - 1);
    const s = kufi.layout(segs, p, nat + 24, { wordGap: 2, rhythm: false, terminals: 'none', wrap: false });
    expect((s as CellStrip).W).toBe(nat + 24);
  });
  it('resolves in compositions, and evolves as a letter trait', () => {
    const c = structuredClone(preset('fatimid-medallion'));
    c.style.letter.set = 'fatimid';
    expect(isValidComposition(c)).toBe(true);
    expect(resolve(c).meta.warnings).toEqual([]);
    applyTrait(c, 'letterSet', 'square', new Rng(1));
    expect(traitsOf(c).letterSet).toBe('square');
  });
});
