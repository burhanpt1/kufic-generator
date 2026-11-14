// The space between words (RoundelOptions.wordGap), shown and held to its word. Four dense texts, in fitted lanes and
// on ruled lines, each without the option and with a gap of 1 nib and of 1.5 nibs: with it on, the words of a ruled
// line stand at least that far apart, and in lanes further apart than without it. WORDGAP=1 also draws them as a
// contact sheet (a row per text, a column per setting, each captioned with its measured wordClear) with the numbers
// beside it as text; WORDGAP_OUT sets where (docs/wordgap).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import type { RoundelOptions, WordGaps } from '../src/script/thuluth/roundel';
import { buildRoundel, renderRoundel, wordGaps } from '../src/script/thuluth/roundel';
import { toPNG } from '../scripts/raster.mjs';

const RUN = !!process.env.WORDGAP,
  th = thuluth(ROUNDEL_PEN),
  NIB = th.style.nib,
  PEN: RoundelOptions = { elongate: true, cross: true, kern: true, tries: 4, iters: 6000 },
  TEXTS: [string, string][] = [
    ['basmala-vowels', 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ'],
    ['basmala', 'بسم الله الرحمن الرحيم'],
    ['salawat', 'اللهم صل على محمد وآل محمد'],
    ['ikhlas', 'قل هو الله أحد الله الصمد'],
  ],
  MODES: [string, RoundelOptions][] = [
    ['lanes', { lanes: {} }],
    ['ruled', { ruled: true }],
  ],
  /** In nibs: 0 is the option off. */
  GAPS = [0, 1, 1.5];

interface Cell {
  text: string;
  mode: string;
  gap: number;
  svg: string;
  g: WordGaps;
  /** The disc's radius (pen units): the letters are drawn smaller as it grows. */
  r: number;
}
const CELLS = new Map<string, Cell>();
function cell(ti: number, mi: number, gap: number): Cell {
  const key = `${ti}:${mi}:${gap}`;
  let c = CELLS.get(key);
  if (!c) {
    const [name, text] = TEXTS[ti],
      [mode, how] = MODES[mi],
      b = buildRoundel(th, { text, compose: { ...PEN, ...how, ...(gap ? { wordGap: gap * NIB } : {}) }, frame: {} })!;
    c = { text: name, mode, gap, svg: renderRoundel(th, b.r, b.f, { U: 8 }), g: wordGaps(th, b.r), r: b.r.disc.r };
    CELLS.set(key, c);
  }
  return c;
}
const nibs = (v: number | null) => (v == null ? 'none on a line' : `${(v / NIB).toFixed(2)} nib`);

describe('the space between words', () => {
  it('ruled: the words of a line stand at least the gap apart', () => {
    TEXTS.forEach(([name], ti) =>
      GAPS.slice(1).forEach(gap => {
        const c = cell(ti, 1, gap);
        expect(c.g.wordPairs, name).toBeGreaterThan(0);
        // (the composer measures on its raster, a pixel of which is 0.6 of a pen unit: it errs on the wide side)
        expect(c.g.wordClear!, `${name}, ${gap} nib`).toBeGreaterThanOrEqual(gap * NIB - 0.15);
      }),
    );
  }, 300_000);
  it('lanes: the words of a lane stand further apart than without it', () => {
    TEXTS.forEach(([name], ti) => {
      const off = cell(ti, 0, 0);
      GAPS.slice(1).forEach(gap => {
        const c = cell(ti, 0, gap);
        if (c.g.wordClear != null) expect(c.g.wordClear, `${name}, ${gap} nib`).toBeGreaterThan(off.g.wordClear!);
      });
    });
  }, 300_000);

  it.runIf(RUN)(
    'draws the contact sheet',
    () => {
      const out = process.env.WORDGAP_OUT ?? join(import.meta.dirname, '../docs/wordgap'),
        S = 420,
        CAP = 48,
        HEAD = 30,
        cols = MODES.flatMap((_, mi) => GAPS.map(gap => [mi, gap] as const));
      mkdirSync(out, { recursive: true });
      let body = '';
      const lines: string[] = [];
      cols.forEach(([mi, gap], x) => {
        body += `<text x="${x * S + S / 2}" y="21" text-anchor="middle" font-size="17" font-weight="bold">${MODES[mi][0]}, ${gap ? `wordGap ${gap} nib` : 'off'}</text>`;
      });
      TEXTS.forEach(([name], ti) =>
        cols.forEach(([mi, gap], x) => {
          const c = cell(ti, mi, gap),
            y = HEAD + ti * (S + CAP),
            // (the drawing as it is, without its own size: the sheet sets it)
            inner = c.svg.replace(
              /^<svg ([^>]*?) width="[^"]*" height="[^"]*">/,
              `<svg $1 x="${x * S}" y="${y}" width="${S}" height="${S}">`,
            ),
            cap = [
              `${name}: wordClear ${nibs(c.g.wordClear)} (inside a word ${nibs(c.g.wordInner)})`,
              `run on ${c.g.wordsRunOn} of ${c.g.wordPairs} pairs; disc radius ${c.r.toFixed(1)}`,
            ];
          expect(inner).not.toBe(c.svg);
          body += inner + cap.map((t, k) => `<text x="${x * S + S / 2}" y="${y + S + 17 + 18 * k}" text-anchor="middle" font-size="13">${t}</text>`).join(''); // prettier-ignore
          writeFileSync(join(out, `${name}-${c.mode}-${gap ? gap + 'nib' : 'off'}.png`), toPNG(c.svg, S));
          lines.push(`${name.padEnd(18)} ${c.mode.padEnd(6)} ${(gap ? gap + ' nib' : 'off').padEnd(8)} wordClear ${c.g.wordClear == null ? '-' : c.g.wordClear.toFixed(2)} (${nibs(c.g.wordClear)})  widest inside ${c.g.wordInner.toFixed(2)}  run on ${c.g.wordsRunOn}/${c.g.wordPairs}  disc r ${c.r.toFixed(1)}  pairs ${c.g.pairs.map(p => `${p.a}-${p.b}: ${p.clear.toFixed(2)} (inside ${p.inner.toFixed(2)})`).join(', ')}`); // prettier-ignore
        }),
      );
      const Wd = cols.length * S,
        Ht = HEAD + TEXTS.length * (S + CAP);
      writeFileSync(
        join(out, 'sheet.png'),
        toPNG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Ht}" width="${Wd}" height="${Ht}" font-family="DejaVu Sans, Arial, sans-serif" fill="#1d2440"><rect width="100%" height="100%" fill="#f4efe3"/>${body}</svg>`, Wd), // prettier-ignore
      );
      writeFileSync(join(out, 'numbers.txt'), lines.join('\n') + '\n');
      expect(lines.length).toBe(TEXTS.length * cols.length);
    },
    3_600_000,
  );
});
