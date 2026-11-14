// The word-block seal's output is pinned: its line breaks come from span widths, which are measured from per-word
// widths instead of laying out every span (wordBlock.ts), and that must give the same block for every text.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE } from '../src/model/style';
import { MAX_WORDS, wordBlock } from '../src/monogram/wordBlock';
import { wordGrid } from '../src/monogram/words';
import { kufi } from '../src/script/kufi';
import type { LetterStyle } from '../src/script/types';
import { digest, FUZZ_OUT, pick, rng, VOCAB, words, writeDigests } from './helpers/identity';

const LETTERS: Partial<LetterStyle>[] = [
  {},
  {},
  { set: 'fatimid' },
  { lamAlif: 'plain', ra: 'short' },
  { marks: 'all', ayn: 'open' },
  { alternates: true, loops: 'stretch' },
  { meem: 'flat', sad: 'tall', ra: 'hook' },
];
const HS = [[7, 10], [9, 12], [9, 12, 15], [11, 14], [7], [5, 8]]; // prettier-ignore

interface Case {
  label: string;
  ws: string[];
  letter: LetterStyle;
  Hs: number[];
  wg: number;
}
function cases(seed: number, n: number, maxWords: number): Case[] {
  const R = rng(seed),
    out: Case[] = [];
  for (let k = 0; k < n; k++) {
    // mostly short texts, some long
    const len = 1 + Math.floor(R() ** 2 * maxWords),
      ws = words(R, len),
      li = Math.floor(R() * LETTERS.length),
      Hs = pick(R, HS),
      wg = pick(R, [2, 2, 2, 1, 3, 0]);
    out.push({
      label: `${seed}/${k} n=${len} letter=${li} Hs=${Hs.join(',')} wg=${wg}`,
      ws,
      letter: { ...DEFAULT_STYLE.letter, ...LETTERS[li] },
      Hs,
      wg,
    });
  }
  return out;
}
const run = (c: Case) => {
  const b = wordBlock(kufi, c.ws, c.letter, c.Hs, c.wg);
  return digest(b && { w: b.grid.w, h: b.grid.h, data: b.grid.data, lines: b.lines, H: b.H, stretched: b.stretched });
};

describe('word-block seal identity', () => {
  it('gives the pinned blocks for a spread of texts', () => {
    const rows = cases(11, 60, 14).map(c => run(c));
    expect(digest(rows)).toBe('15732438b8fbc3509f6931fe9d93cbe88c34d21ef8cf9b71ec02f8a154c5bbb5');
  });
  it('a span of words is as wide as its words and the gaps between them', () => {
    // what the line breaker relies on: no layout of a span is needed to know its natural width
    const R = rng(5);
    for (let k = 0; k < 150; k++) {
      const ws = words(R, 1 + Math.floor(R() * 7)),
        wg = pick(R, [2, 1, 3, 0]),
        letter: LetterStyle = { ...DEFAULT_STYLE.letter, ...pick(R, LETTERS), ascenders: pick(R, [7, 9, 12]) },
        each = ws.map(w => wordGrid(kufi, w, letter, 0, wg)?.g.w).filter(w => w !== undefined),
        all = wordGrid(kufi, ws.join(' '), letter, 0, wg)?.g.w;
      expect(all, ws.join(' ')).toBe(
        each.length ? each.reduce((a, w) => a + w, 0) + wg * (each.length - 1) : undefined,
      );
    }
  });
  it('a text of more than MAX_WORDS words is refused at once', () => {
    const R = rng(3),
      t0 = performance.now();
    expect(wordBlock(kufi, words(R, MAX_WORDS + 1), DEFAULT_STYLE.letter, [9, 12])).toBe(null);
    expect(wordBlock(kufi, words(R, 20000), DEFAULT_STYLE.letter, [9, 12])).toBe(null);
    expect(performance.now() - t0).toBeLessThan(1000);
    // a long text under the cap is still set, in seconds where it took minutes
    const b = wordBlock(kufi, words(R, 150), DEFAULT_STYLE.letter, [9, 12])!;
    expect(b.lines.flat()).toHaveLength(150);
    expect(b.lines).toHaveLength(8);
  });
  it.runIf(!!FUZZ_OUT)('broad fuzz (IDENTITY_OUT)', { timeout: 3_600_000 }, () => {
    const rows: [string, string][] = [];
    for (const [seed, n, max] of [
      [101, 420, 16],
      [202, 60, 45],
      [303, 6, 110],
    ])
      // prettier-ignore
      for (const c of cases(seed, n, max)) rows.push([c.label, run(c)]);
    // one word, words the engine doesn't draw, a long run of one word
    const fixed = [['الله'], ['ـ'], ['پ', 'ڤ'], [...VOCAB.slice(0, 30)], Array<string>(12).fill('نور'), ['لا', 'ـ', 'اله']]; // prettier-ignore
    for (const ws of fixed)
      for (const Hs of HS)
        rows.push([
          `fixed ${ws.length} ${ws[0]} ${Hs.join(',')}`,
          run({ label: '', ws, letter: DEFAULT_STYLE.letter, Hs, wg: 2 }),
        ]);
    writeDigests('word-block', rows);
  });
});
