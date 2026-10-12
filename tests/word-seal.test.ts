// Word seals (owner's reviews, rounds 3–4): whole words in reading order, as a square block of justified lines, each
// word clear of the others, each dot clear of every other line, and squared up so the seal takes a frame.
import { describe, expect, it } from 'vitest';
import { loadSealWasm } from '../src/kernels/seal';
import { buildMonogram, clearMonogramCache, MONO_DEFAULTS } from '../src/monogram/methods';
import { MARK_CLEAR, wordBlock } from '../src/monogram/wordBlock';
import type { CellGrid } from '../src/monogram/grid';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';

await loadSealWasm();
const TEXTS = [
  'يا علي مدد',
  'محمد علي',
  'بسم الله الرحمن الرحيم',
  'لا اله الا الله',
  'الحمد لله رب العالمين',
  'الله اكبر',
  'علي ولي الله',
];
const words = (t: string) => t.split(' ');
const at = (g: CellGrid, x: number, y: number) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? 0 : g.data[y * g.w + x]);

describe('word seals', () => {
  it('are the default, unmirrored, with no loose dots', () => {
    expect(MONO_DEFAULTS.words).toBe(true);
    clearMonogramCache();
    const m = buildMonogram('seal', { sym: 'mirror', dots: true }, 'يا علي مدد', kufi, DEFAULT_STYLE.letter)!;
    expect(m.stats?.sym).toBe('none');
    expect(m.stats?.letters).toEqual(['يا', 'علي', 'مدد']);
    // the same seal without the decorative dot fill: no extra dots (a loose dot made ر read as ز)
    clearMonogramCache();
    const plain = buildMonogram('seal', {}, 'يا علي مدد', kufi, DEFAULT_STYLE.letter)!;
    expect(Array.from(m.grid.data)).toEqual(Array.from(plain.grid.data));
  });
  it('keep the words in order, in whole lines', () => {
    const b = wordBlock(kufi, words('لا اله الا الله'), DEFAULT_STYLE.letter, [7, 10])!;
    expect(b.lines).toEqual([
      ['لا', 'اله'],
      ['الا', 'الله'],
    ]);
    expect(wordBlock(kufi, words('بسم الله الرحمن الرحيم'), DEFAULT_STYLE.letter, [7, 10])!.lines.flat()).toEqual(
      words('بسم الله الرحمن الرحيم'),
    );
  });
  it.each(TEXTS)('keep every dot clear of the other lines: %s', text => {
    for (const H of [7, 9]) {
      const b = wordBlock(kufi, words(text), DEFAULT_STYLE.letter, [H, H + 3])!,
        g = b.grid;
      // a dot never has letter ink both above and below it within MARK_CLEAR rows: it isn't wedged between lines
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          const v = at(g, x, y);
          if (v !== 2 && v !== 3) continue;
          let up = false,
            down = false;
          for (let dy = 1; dy <= MARK_CLEAR; dy++)
            for (let dx = -MARK_CLEAR; dx <= MARK_CLEAR; dx++) {
              if (at(g, x + dx, y - dy) === 1) up = true;
              if (at(g, x + dx, y + dy) === 1) down = true;
            }
          expect(up && down).toBe(false);
        }
    }
  });
  it.each(TEXTS)('come out square and framed: %s', text => {
    for (const H of [7, 9]) {
      clearMonogramCache();
      const m = buildMonogram('seal', { H, frame: 'square' }, text, kufi, DEFAULT_STYLE.letter)!;
      expect(m.metrics.squareness).toBeGreaterThan(0.8);
      expect(m.grid.w).toBe(m.grid.h);
      // the frame: the outer ring is all ink
      for (let t = 0; t < m.grid.w; t++)
        expect(m.grid.data[t] && m.grid.data[(m.grid.h - 1) * m.grid.w + t]).toBeTruthy();
    }
  });
  it('share a stem where a stem stands right under another (الله over اكبر)', () => {
    const g = wordBlock(kufi, words('الله اكبر'), DEFAULT_STYLE.letter, [7, 10])!.grid;
    // a column whose vertical run passes through both lines: longer than any one line is tall
    let longest = 0;
    for (let x = 0; x < g.w; x++) {
      let run = 0;
      for (let y = 0; y < g.h; y++) {
        run = at(g, x, y) === 1 || at(g, x, y) === 4 ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
    }
    expect(longest).toBeGreaterThan(14);
  });
  it.each([7, 9])('line up and join the alifs of اله and الله, not the لا knot (Shahada, H %i)', H => {
    const b = wordBlock(kufi, words('لا اله الا الله'), DEFAULT_STYLE.letter, [H, H + 3])!,
      g = b.grid,
      ink = (x: number, y: number) => at(g, x, y) === 1 || at(g, x, y) === 4;
    expect(b.lines).toEqual([
      ['لا', 'اله'],
      ['الا', 'الله'],
    ]);
    // a column inked from the top row of the first line to the bottom of the second: the shared alif
    const runs: number[] = [];
    for (let x = 0; x < g.w; x++) {
      let run = 0,
        best = 0;
      for (let y = 0; y < g.h; y++) best = Math.max(best, (run = ink(x, y) ? run + 1 : 0));
      runs.push(best);
    }
    expect(Math.max(...runs)).toBeGreaterThan(2 * b.H);
    // the knot (rightmost strokes) is not joined to the line below: its columns stay shorter than one line
    expect(runs[g.w - 2]).toBeLessThanOrEqual(b.H + 1);
  });
  it('are deterministic', () => {
    const a = wordBlock(kufi, words('الحمد لله رب العالمين'), DEFAULT_STYLE.letter, [9, 12])!,
      b = wordBlock(kufi, words('الحمد لله رب العالمين'), DEFAULT_STYLE.letter, [9, 12])!;
    expect(Array.from(a.grid.data)).toEqual(Array.from(b.grid.data));
  });
});
