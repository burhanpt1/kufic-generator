// Letter changes from the held-out seal review: final م drops its tail below the line (it read as ص in سلام), and
// the tooth after the loop of initial and medial ص ض is short (in ضياء it read as a missing letter). Both are the
// default style; the engine's fallback keeps the prototype's shapes, which the golden snapshots pin.
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
  it('fall back to the prototype’s shapes', () => {
    setVariants({});
    expect(baseDef('MEEM', 'fin')).toEqual(['..###', '#.#.#', '#####']);
    expect(baseDef('SAD', 'ini')).toEqual(['#.#####', '#.#...#', '#######']);
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
});
