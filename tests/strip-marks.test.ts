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
  it.each([0, 1, 4, 9])('centre the dots of ي under its cup before a tall letter: يا +%i', extra => {
    const { g, base } = wordGrid(kufi, 'يا', { ...DEFAULT_STYLE.letter, ascenders: 7, marks: 'dots' }, extra)!;
    // the alif (left) and the tooth of ي (right) are the two columns with ink just above the baseline
    const cols: number[] = [];
    for (let x = 0; x < g.w; x++) if (g.data[(base - 1) * g.w + x] === 1) cols.push(x);
    const [alif, tooth] = [cols[0], cols[cols.length - 1]],
      { dots } = below('يا', extra);
    expect(dots).toHaveLength(2);
    expect(Math.abs((dots[0] + dots[1]) / 2 - (alif + tooth) / 2)).toBeLessThanOrEqual(0.5);
    // both dots inside the cup, neither under a stroke
    expect(dots[0]).toBeGreaterThan(alif);
    expect(dots[1]).toBeLessThan(tooth);
  });
  it('leave ي alone where no tall letter follows (بيت)', () => {
    expect(below('بيت', 0)).toEqual({ dots: [6, 8, 10], w: 11 });
  });
  // the rule for every tooth letter (ب ت ث ن ي): its dots, above or below, sit in the hollow between its tooth and the
  // stem of a tall letter it joins, the following letter's first, then the preceding one's
  const marks = (text: string) => {
    const { g, base } = wordGrid(kufi, text, { ...DEFAULT_STYLE.letter, ascenders: 7, marks: 'dots' }, 0)!,
      cols = (pred: (y: number) => boolean) => {
        const out: number[] = [];
        for (let y = 0; y < g.h; y++)
          if (pred(y)) for (let x = 0; x < g.w; x++) if (g.data[y * g.w + x] === 3) out.push(x);
        return out.sort((a, b) => a - b);
      };
    return { g, base, above: cols(y => y < base - 1), below: cols(y => y > base) };
  };
  const midOf = (d: number[]) => (d[0] + d[d.length - 1]) / 2;
  it.each([
    ['تا', 'above'],
    ['نا', 'above'],
    ['بل', 'below'],
  ] as const)('centre a tooth’s dots in the hollow before a tall letter: %s', (text, side) => {
    const m = marks(text),
      row = m.base - 1,
      ink: number[] = [];
    for (let x = 0; x < m.g.w; x++) if (m.g.data[row * m.g.w + x] === 1) ink.push(x);
    // the stem (left) and the tooth (right) of the first two columns with ink just above the baseline, read leftward
    const tooth = ink[ink.length - 1],
      stem = ink.filter(x => x < tooth).pop()!;
    expect(Math.abs(midOf(m[side]) - (stem + tooth) / 2)).toBeLessThanOrEqual(0.5);
  });
  it('take the preceding stem when no tall letter follows (كتب)', () => {
    const m = marks('كتب');
    // ت's two dots sit between its tooth and the stem of ك, clear of both
    expect(m.above).toHaveLength(2);
    expect(m.g.data[(m.base - 1) * m.g.w + m.above[0]]).toBe(0);
    expect(m.g.data[(m.base - 1) * m.g.w + m.above[1]]).toBe(0);
  });
});
