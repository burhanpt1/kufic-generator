// The space inside a word (RoundelOptions.innerGap) beside the space between words (wordGap), drawn: INNERGAP=1 draws
// four dense texts in fitted lanes and on ruled lines, each without either option, with wordGap, and with wordGap and
// innerGap, as a contact sheet (a row per text, a column per setting), each cell captioned with the measured space
// between words (wordClear), the widest space inside a word (wordInner), the pairs of words that run on, the marks
// astray or unplaced, and the fitted field (its half-height and proportion; `size` is the radius of the circle of
// the same area, so smaller is larger letters). Each cell is also written alone, three times the size, and the
// numbers as text. INNERGAP_OUT sets where (docs/innergap); INNERGAP_IG the innerGap (pen units, 0.7).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import type { RoundelOptions } from '../src/script/thuluth/roundel';
import { buildRoundel, renderRoundel, roundelChecks, wordGaps } from '../src/script/thuluth/roundel';
import { toPNG } from '../scripts/raster.mjs';

const RUN = !!process.env.INNERGAP,
  IG = +(process.env.INNERGAP_IG ?? 0.7),
  th = thuluth(ROUNDEL_PEN),
  NIB = th.style.nib,
  PEN: RoundelOptions = { elongate: true, cross: true, kern: true, tries: 4, iters: 6000 },
  TEXTS: [string, string][] = [
    ['basmala-vowels', 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ'],
    ['basmala', 'بسم الله الرحمن الرحيم'],
    ['salawat', 'اللهم صل على محمد وآل محمد'],
    ['ikhlas', 'قل هو الله أحد الله الصمد'],
  ],
  COLS: [string, RoundelOptions][] = [
    ['lanes, off', { lanes: {} }],
    ['lanes, wordGap 2.4', { lanes: {}, wordGap: 2.4 }],
    [`lanes, wordGap 2.4, innerGap ${IG}`, { lanes: {}, wordGap: 2.4, innerGap: IG }],
    ['ruled, off', { ruled: true }],
    ['ruled, wordGap 1.6', { ruled: true, wordGap: 1.6 }],
    [`ruled, wordGap 1.6, innerGap ${IG}`, { ruled: true, wordGap: 1.6, innerGap: IG }],
  ];

describe('the space inside a word, drawn', () => {
  it.runIf(RUN)(
    'draws the contact sheet',
    () => {
      const out = process.env.INNERGAP_OUT ?? join(import.meta.dirname, '../docs/innergap'),
        S = 420,
        CAP = 66,
        HEAD = 30;
      mkdirSync(out, { recursive: true });
      let body = '';
      const lines: string[] = [];
      COLS.forEach(([name], x) => {
        body += `<text x="${x * S + S / 2}" y="21" text-anchor="middle" font-size="16" font-weight="bold">${name}</text>`;
      });
      TEXTS.forEach(([name, text], ti) =>
        COLS.forEach(([col, how], x) => {
          const b = buildRoundel(th, { text, compose: { ...PEN, ...how }, frame: {} })!,
            svg = renderRoundel(th, b.r, b.f, { U: 8 }),
            g = wordGaps(th, b.r),
            c = roundelChecks(th, b.r, b.f),
            d = b.r.disc,
            y = HEAD + ti * (S + CAP),
            inner = svg.replace(
              /^<svg ([^>]*?) width="[^"]*" height="[^"]*">/,
              `<svg $1 x="${x * S}" y="${y}" width="${S}" height="${S}">`,
            ),
            nibs = (v: number | null) => (v == null ? 'none' : `${v.toFixed(2)} (${(v / NIB).toFixed(2)} nib)`),
            cap = [
              `${name}: between words ${nibs(g.wordClear)}, inside ${nibs(g.wordInner)}`,
              `run on ${g.wordsRunOn} of ${g.wordPairs}; lines ${b.r.lanes?.n ?? '-'}; stray marks ${c.strayMarks}, unplaced ${c.marksUnplaced}`,
              `field ${d.r.toFixed(1)} × ${d.oval.toFixed(2)}, size ${(d.r * Math.sqrt(d.oval)).toFixed(1)}`,
            ];
          expect(inner).not.toBe(svg);
          body += inner + cap.map((t, k) => `<text x="${x * S + S / 2}" y="${y + S + 17 + 18 * k}" text-anchor="middle" font-size="13">${t}</text>`).join(''); // prettier-ignore
          writeFileSync(join(out, `${name}-${x}-${col.replace(/[, ]+/g, '-')}.png`), toPNG(svg, 3 * S));
          lines.push(`${name.padEnd(15)} ${col.padEnd(36)} ${cap.join('; ')}; pairs ${g.pairs.map(p => `${p.a}-${p.b}: ${p.clear.toFixed(2)} (inside ${p.inner.toFixed(2)})`).join(', ')}`); // prettier-ignore
        }),
      );
      const Wd = COLS.length * S,
        Ht = HEAD + TEXTS.length * (S + CAP);
      writeFileSync(
        join(out, 'sheet.png'),
        toPNG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Ht}" width="${Wd}" height="${Ht}" font-family="DejaVu Sans, Arial, sans-serif" fill="#1d2440"><rect width="100%" height="100%" fill="#f4efe3"/>${body}</svg>`, Wd), // prettier-ignore
      );
      writeFileSync(join(out, 'numbers.txt'), lines.join('\n') + '\n');
      expect(lines.length).toBe(TEXTS.length * COLS.length);
    },
    3_600_000,
  );
});
