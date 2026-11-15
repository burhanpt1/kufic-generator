// Vowels lifted over a stroke that covers their letter (SolveOptions.markLift, on with RoundelOptions.innerGap),
// measured and drawn: MARKLIFT=1 builds five vocalised texts in fitted lanes and on ruled lines at the suggested
// spacing, two seeds each, four ways (without innerGap, and with it; the marks as they were, and lifted), and writes
// the numbers (marks left on ink, vowels and dots astray, vowels nearer another letter than their own, vowels past a
// neighbour's) as a table, numbers.txt, and a sheet, marks-before-after.png: each text and mode with innerGap, before
// beside after, flat black on light, with the worst three cases cut out at three times the size. MARKLIFT_OUT sets
// where (docs/marklift).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { thuluthStyleOf } from '../src/script/registry';
import { thuluth } from '../src/script/thuluth/engine';
import type { BuiltRoundel, RoundelOptions } from '../src/script/thuluth/roundel';
import { buildRoundel, markReading, roundelArt, roundelChecks } from '../src/script/thuluth/roundel';
import type { Poly } from '../src/script/thuluth/types';
import { toPNG } from '../scripts/raster.mjs';

const RUN = !!process.env.MARKLIFT,
  th = thuluth(thuluthStyleOf({ preset: 'roundel' })),
  PEN: RoundelOptions = { elongate: true, cross: true, kern: true, tries: 4, iters: 6000 },
  TEXTS: [string, string][] = [
    ['basmala', 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ'],
    ['salawat', 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَآلِ مُحَمَّدٍ'],
    ['ikhlas', 'قُلْ هُوَ اللَّهُ أَحَدٌ اللَّهُ الصَّمَدُ'],
    ['shahada', 'لَا إِلَهَ إِلَّا اللَّهُ مُحَمَّدٌ رَسُولُ اللَّهِ'],
    ['hamd', 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'],
  ],
  MODES: [string, RoundelOptions][] = [
    ['lanes', { lanes: {}, wordGap: 2.4 }],
    ['ruled', { ruled: true, wordGap: 1.6 }],
  ],
  SEEDS = [7, 23],
  // [innerGap, markLift]
  WAYS: [string, number | undefined, boolean][] = [
    ['no innerGap', undefined, false],
    ['no innerGap, lifted', undefined, true],
    ['innerGap 0.7 (before)', 0.7, false],
    ['innerGap 0.7, lifted (after)', 0.7, true],
  ];

interface Cell {
  b: BuiltRoundel;
  n: { unplaced: number; strayMarks: number; strayDots: number; notNearest: number; crossed: number; marks: number; size: number }; // prettier-ignore
}
const build = (
  text: string,
  how: RoundelOptions,
  seed: number,
  innerGap: number | undefined,
  markLift: boolean,
): Cell => {
  const b = buildRoundel(th, { text, compose: { ...PEN, ...how, seed, innerGap }, frame: { markLift } })!,
    c = roundelChecks(th, b.r, b.f),
    m = markReading(th, b.r, b.f),
    d = b.r.disc;
  return { b, n: { unplaced: c.marksUnplaced, strayMarks: c.strayMarks, strayDots: c.strayDots, notNearest: m.notNearest, crossed: m.crossed, marks: m.marks, size: d.r * Math.sqrt(d.oval || 1) } }; // prettier-ignore
};
/** The roundel's ink, flat, in a square of side S at (x, y); `zoom` cuts out the part about (cx, cy), in pen units. */
const flat = (b: BuiltRoundel, x: number, y: number, S: number, zoom?: { cx: number; cy: number; half: number }) => {
  const art = roundelArt(th, b.r, b.f),
    half = zoom?.half ?? art.Rout * Math.max(1, art.oval) * 1.02,
    cx = zoom?.cx ?? art.cx,
    cy = zoom?.cy ?? art.cy,
    U = S / (2 * half),
    path = (ps: Poly[]) => ps.map(p => 'M' + p.map(q => `${((q[0] - cx + half) * U).toFixed(1)} ${((half - (q[1] - cy)) * U).toFixed(1)}`).join('L') + 'Z').join(''); // prettier-ignore
  return `<svg x="${x}" y="${y}" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><path fill="#111" d="${art.units.map(u => path(u.polys)).join('')}"/></svg>`;
};

describe('marks lifted over a covering stroke, measured and drawn', () => {
  it.runIf(RUN)(
    'writes the table and the sheet',
    () => {
      const out = process.env.MARKLIFT_OUT ?? join(import.meta.dirname, '../docs/marklift');
      mkdirSync(out, { recursive: true });
      const KEYS = ['unplaced', 'strayMarks', 'strayDots', 'notNearest', 'crossed'] as const,
        lines: string[] = [`${'text'.padEnd(9)}${'mode'.padEnd(7)}seed  ${WAYS.map(w => w[0].padEnd(30)).join('')}`, `${''.padEnd(22)}${WAYS.map(() => 'unpl strM strD notN cros size  '.padEnd(30)).join('')}`], // prettier-ignore
        total = WAYS.map(() => ({
          unplaced: 0,
          strayMarks: 0,
          strayDots: 0,
          notNearest: 0,
          crossed: 0,
          marks: 0,
          size: 0,
        })),
        shown: { name: string; mode: string; before: Cell; after: Cell }[] = [];
      for (const [name, text] of TEXTS)
        for (const [mode, how] of MODES)
          for (const seed of SEEDS) {
            const cells = WAYS.map(([, ig, lift]) => build(text, how, seed, ig, lift));
            cells.forEach((c, k) => {
              for (const key of KEYS) total[k][key] += c.n[key];
              total[k].marks += c.n.marks;
              total[k].size += c.n.size;
            });
            lines.push(`${name.padEnd(9)}${mode.padEnd(7)}${String(seed).padEnd(6)}${cells.map(c => (KEYS.map(k => String(c.n[k]).padStart(4)).join(' ') + ' ' + c.n.size.toFixed(1).padStart(5)).padEnd(30)).join('')}`); // prettier-ignore
            if (seed === SEEDS[0]) shown.push({ name, mode, before: cells[2], after: cells[3] });
          }
      lines.push(`${'total'.padEnd(22)}${total.map(t => (KEYS.map(k => String(t[k]).padStart(4)).join(' ') + ' ' + (t.size / (TEXTS.length * MODES.length * SEEDS.length)).toFixed(1).padStart(5)).padEnd(30)).join('')}`); // prettier-ignore
      lines.push(`vowels placed: ${total.map(t => t.marks).join(', ')}`);
      writeFileSync(join(out, 'numbers.txt'), lines.join('\n') + '\n');
      // the sheet: a row per text and mode, before beside after; then the worst three, cut out
      const S = 520,
        CAP = 44,
        HEAD = 34,
        COLS = 4,
        cap = (c: Cell) => `on ink ${c.n.unplaced} · astray ${c.n.strayMarks} vowels, ${c.n.strayDots} dots · not nearest ${c.n.notNearest} · crossed ${c.n.crossed} of ${c.n.marks}`, // prettier-ignore
        text = (x: number, y: number, t: string, size = 14, bold = false) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}"${bold ? ' font-weight="bold"' : ''}>${t}</text>`; // prettier-ignore
      let body = '';
      // two pairs to a row: lanes on the left, ruled on the right
      ['lanes: before', 'lanes: after (lifted)', 'ruled: before', 'ruled: after (lifted)'].forEach((t, k) => (body += text(k * S + S / 2, 23, t, 17, true))); // prettier-ignore
      shown.forEach((p, i) => {
        const row = Math.floor(i / 2),
          y = HEAD + row * (S + CAP);
        [p.before, p.after].forEach((c, k) => {
          const x = ((i % 2) * 2 + k) * S;
          body += flat(c.b, x, y, S) + text(x + S / 2, y + S + 16, `${p.name}, ${p.mode}, innerGap 0.7`, 13, true) + text(x + S / 2, y + S + 34, cap(c), 13); // prettier-ignore
        });
      });
      // the worst: most marks on ink before, then most after
      const worst = [...shown].sort((a, b) => b.before.n.unplaced + b.after.n.unplaced - (a.before.n.unplaced + a.after.n.unplaced)).slice(0, 3), // prettier-ignore
        y0 = HEAD + Math.ceil(shown.length / 2) * (S + CAP) + 30,
        Z = (COLS * S) / 2;
      body += text((COLS * S) / 2, y0 - 8, 'the three with the most marks on ink, at three times the size (before, after)', 17, true); // prettier-ignore
      worst.forEach((p, i) => {
        const y = y0 + i * (Z + CAP);
        [p.before, p.after].forEach((c, k) => {
          // about the vowel that was moved furthest (the same vowel in both drawings)
          const at = (q: Cell) => q.b.f.solved!.items.filter(v => v.kind === 'mark'),
            from = at(p.before),
            to = at(p.after),
            moved = from.map((v, n) => (to[n] ? Math.hypot(to[n].x - v.x, to[n].y - v.y) : 0)),
            n = moved.indexOf(Math.max(...moved)),
            art = roundelArt(th, c.b.r, c.b.f),
            half = (art.Rout * Math.max(1, art.oval) * 1.02) / 3,
            v = at(c)[n] ?? at(c)[0];
          body += flat(c.b, k * Z, y, Z, { cx: v.x, cy: v.y, half }) + text(k * Z + Z / 2, y + Z + 16, `${p.name}, ${p.mode}: ${k ? 'after' : 'before'}`, 13, true) + text(k * Z + Z / 2, y + Z + 34, cap(c), 13); // prettier-ignore
        });
      });
      const Wd = COLS * S,
        Ht = y0 + worst.length * (Z + CAP);
      writeFileSync(
        join(out, 'marks-before-after.png'),
        toPNG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Ht}" width="${Wd}" height="${Ht}" font-family="DejaVu Sans, Arial, sans-serif" fill="#1d2440"><rect width="100%" height="100%" fill="#f4efe3"/>${body}</svg>`, Wd), // prettier-ignore
      );
      // each drawing alone, larger, for a close look
      shown.forEach(p => [p.before, p.after].forEach((c, k) => writeFileSync(join(out, `${p.name}-${p.mode}-${k ? 'after' : 'before'}.png`), toPNG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1400" width="1400" height="1400"><rect width="100%" height="100%" fill="#f4efe3"/>${flat(c.b, 0, 0, 1400)}</svg>`, 1400)))); // prettier-ignore
      expect(lines.length).toBe(TEXTS.length * MODES.length * SEEDS.length + 4);
    },
    3_600_000,
  );
});
