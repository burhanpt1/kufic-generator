// Letter changes from the held-out seal review: final م drops its tail below the line (it read as ص in سلام), and
// the tooth after the loop of initial and medial ص ض is short (in ضياء it read as a missing letter). Both are the
// default style and the engine's fallback; the prototype's shapes stay available as variants.
import { describe, expect, it } from 'vitest';
import { baseDef, setVariants } from '../src/glyphs/overrides';
import { DEFAULT_STYLE } from '../src/model/style';
import { wordGrid } from '../src/monogram/words';
import { kufi } from '../src/script/kufi';

describe('letter variants', () => {
  it('default to the dropped م and the short ص tooth', () => {
    expect(DEFAULT_STYLE.letter.meem).toBe('drop');
    expect(DEFAULT_STYLE.letter.sad).toBe('short');
  });
  it('are the engine’s fallback too, with the prototype’s shapes still available', () => {
    setVariants({});
    expect(baseDef('MEEM', 'fin')).toEqual({ rows: ['..###', '..#.#', '#####', '#....', '#....'], base: 2 });
    expect(baseDef('SAD', 'ini')).toEqual(['..#####', '#.#...#', '#######']);
    setVariants({ meem: 'flat', sad: 'tall' });
    expect(baseDef('MEEM', 'fin')).toEqual(['..###', '#.#.#', '#####']);
    expect(baseDef('SAD', 'ini')).toEqual(['#.#####', '#.#...#', '#######']);
    setVariants({});
  });
  it('drop final م below the line, without the post that made it read as ص', () => {
    const { g, base } = wordGrid(kufi, 'سلام', { ...DEFAULT_STYLE.letter, ascenders: 7 }, 0)!,
      below = (x: number) => g.data[(base + 1) * g.w + x];
    // the leftmost column (the end of the word) carries the tail below the baseline
    expect(below(0)).toBe(1);
    // and the row above the baseline has no post at the far left
    expect(g.data[(base - 1) * g.w + 0]).toBe(0);
  });
  it('keep the tooth after ص’s loop to one cell', () => {
    setVariants({ sad: 'short' });
    const rows = baseDef('SAD', 'med') as string[];
    expect(rows.map(r => r[0]).join('')).toBe('.##');
    setVariants({});
  });
  it('never widen the loop of م when a line is stretched (a wide م read as ص)', () => {
    const loopWidth = (extra: number) => {
      const { g, base } = wordGrid(kufi, 'سلام', { ...DEFAULT_STYLE.letter, ascenders: 7 }, extra)!;
      // the loop's top bar: the leftmost horizontal run two rows above the baseline
      const y = base - 2;
      let x = 0;
      while (x < g.w && g.data[y * g.w + x] !== 1) x++;
      let w = 0;
      while (x + w < g.w && g.data[y * g.w + x + w] === 1) w++;
      return w;
    };
    expect(loopWidth(10)).toBe(loopWidth(0));
  });
  it('draw گ with a second arm, not as ك', () => {
    const grid = (t: string) => Array.from(wordGrid(kufi, t, { ...DEFAULT_STYLE.letter, ascenders: 7 }, 0)!.g.data);
    expect(grid('گل')).not.toEqual(grid('كل'));
  });
});
