// Stretching a line (kashida) must not split or strand a letter's dots (owner's review: the two dots of ي drifted
// apart and off its cup when the line was justified).
import { describe, expect, it } from 'vitest';
import { wordGrid } from '../src/monogram/words';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';

/** The dots below the baseline as columns, and the inked span of the letters. */
function below(text: string, extra: number) {
  const { g, base } = wordGrid(kufi, text, { ...DEFAULT_STYLE.letter, ascenders: 7, marks: 'dots' }, extra)!;
  const dots: number[] = [];
  for (let y = base + 1; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.data[y * g.w + x] === 3) dots.push(x);
  return { dots: dots.sort((a, b) => a - b), w: g.w };
}

describe('marks on a stretched line', () => {
  it.each([0, 3, 6, 10, 15])('keep the dots of ي together and centred: علي +%i', extra => {
    const plain = below('علي', 0),
      s = below('علي', extra);
    expect(s.dots).toHaveLength(plain.dots.length);
    // the same pattern, only moved
    expect(s.dots.map(x => x - s.dots[0])).toEqual(plain.dots.map(x => x - plain.dots[0]));
    // still under the same share of the word as before (within a cell)
    const mid = (d: number[]) => (d[0] + d[d.length - 1] + 1) / 2;
    expect(Math.abs(mid(s.dots) / s.w - mid(plain.dots) / plain.w) * s.w).toBeLessThanOrEqual(1.5);
  });
  it('never doubles a dot', () => {
    for (const extra of [4, 9, 14]) expect(below('بي', extra).dots).toHaveLength(below('بي', 0).dots.length);
  });
});
