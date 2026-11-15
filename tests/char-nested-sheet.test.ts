// Nested arcs (owner's experiment, 15 November 2026). The canopy (tests/char-canopy-sheet.test.ts) and the cradle
// draw the circle with one stroke above and one below. Here each has an echo: THE TEXT STAYS LEVEL AND UPRIGHT, as in
// the one ground line, and only the stylised strokes follow circles, a family of them concentric with the rim. The
// outermost carries the canopy and the cradle as before; on the next circle in, a shorter arc above (the sub-canopy:
// the next stem, bowed over) and a shorter one below (the sub-cradle: the bowl, tail or foot of a letter that sits in
// the cradle), like ripples. (The canopy file's "rings", words bent round circles, are not this and are left behind.)
// The ground line's and the canopy's rules are written again here (those files are not changed); the nested arcs'
// rules are 6 to 9 below, and every number is at the top.
// `NESTED=1 NESTED_OUT=<dir> npx vitest run tests/char-nested-sheet.test.ts --maxWorkers=2` writes the sheets
// (NESTED_PARTS=sheet,options,third; NESTED_ONLY=<text ids>; NESTED_AIR, NESTED_SHARE, NESTED_BACK to try others).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPNG } from '../scripts/raster.mjs';
import { FLOOR, NIB, TEXTS, cradleOf, svgOf } from './helpers/char-first';
import type { Canopied, Mode } from './helpers/char-roundel';
import { AIR, STEPIN, SUB_BACK, SUB_RUN_MIN, TIP, canopyArc, ground, groundCradle, labelled, nested, plain, short, subCradleOf } from './helpers/char-roundel'; // prettier-ignore

describe('nested arcs', () => {
  it('finds the sub-cradle letter among the words in the cradle', () => {
    const pick = TEXTS.map(([, t]) => {
      const words = t.split(' '),
        c = subCradleOf(words, (short(t) ? groundCradle(t) : cradleOf(t))!.wi);
      return c ? `${words[c.wi]} ${c.c}` : null;
    });
    // (the names have no word in the cradle)
    expect(pick).toEqual([null, 'الرحيم م', 'وآل ل', 'أحد د']);
  });
  it('draws an inner arc on its own circle, shorter than the canopy', () => {
    const outer = canopyArc([18, 8], [0, 1], 1, 69, 24)!,
      inner = canopyArc([12, 9], [0, 1], 1, 69, 24 - STEPIN, TIP - SUB_BACK, SUB_RUN_MIN)!,
      r = inner.s.map(q => Math.hypot(q.x, q.y));
    expect(Math.max(...r)).toBeLessThanOrEqual(24 - STEPIN + 1e-9);
    expect(r.filter(v => Math.abs(v - (24 - STEPIN)) < 0.01).length).toBeGreaterThan(r.length / 4);
    expect(inner.phi0 - inner.phiEnd).toBeLessThan(outer.phi0 - outer.phiEnd);
    expect(inner.phiEnd).toBeGreaterThan(outer.phiEnd);
    expect(inner.s[0].w).toBeLessThan(0.2);
  });
  it.runIf(!!process.env.NESTED)(
    'writes the sheets',
    () => {
      const out = process.env.NESTED_OUT ?? join(import.meta.dirname, '../docs/nested');
      mkdirSync(out, { recursive: true });
      const report: string[] = [],
        only = process.env.NESTED_ONLY?.split(','),
        parts = process.env.NESTED_PARTS?.split(',') ?? ['sheet', 'options'],
        texts = TEXTS.filter(([id]) => !only || only.includes(id)),
        f2 = (v: number) => v.toFixed(2),
        nibs = (v: number) => (v / NIB).toFixed(1),
        say = (tag: string, l: Canopied | null, base?: Canopied | null) => {
          if (!l) return void report.push(`${tag}: no arrangement`);
          const f = l.factors.slice().sort((p, q) => p - q);
          report.push(
            `${tag}: radius ${nibs(l.R)} nibs` +
              (base ? ` (${nibs(base.R)} before: ${((l.R / base.R - 1) * 100).toFixed(1)}% larger)` : '') +
              `; lines: ${l.lines.join(' / ')}; stems ${l.stems}, risen ${f.length}${f.length ? `: x${f.map(f2).join(' x')}` : ''}; ${l.note}`,
            ...l.arcs.map(a => `    ${a.name}: ${a.what}; circle of radius ${nibs(a.r)} nibs; ${a.name.endsWith('canopy') ? `from ${a.from.toFixed(0)} to ${a.to.toFixed(0)} degrees clockwise of the top` : `from ${a.from.toFixed(0)} degrees left of the bottom to ${(-a.to).toFixed(0)} right of it`}: ${(a.from - a.to).toFixed(0)} degrees`), // prettier-ignore
          );
        },
        cap = (l: Canopied | null, base?: Canopied | null, than = 'now') =>
          l ? [`radius ${nibs(l.R)} nibs${base && base !== l ? ` (${Math.abs((l.R / base.R - 1) * 100).toFixed(0)}% ${l.R < base.R ? 'smaller' : 'larger'} than ${than})` : ''}`, l.arcs.map(a => `${a.name} ${(a.from - a.to).toFixed(0)}°`).join(', ')] : ['cannot be had']; // prettier-ignore
      report.push(`nib ${NIB}; a stroke on a circle is ${nibs(FLOOR)} nibs thick; air ${nibs(AIR)} nibs; circles ${nibs(STEPIN)} nibs apart`); // prettier-ignore
      if (parts.includes('sheet')) {
        const rows: (Canopied | null)[][] = [[], []],
          caps: string[][][] = [[], []];
        for (const [id, t] of texts) {
          const base = plain(t);
          say(`${id}, as it is now`, base);
          const said: string[] = [],
            l = base && nested(t, base, said);
          say(`${id}, nested`, l, base);
          report.push(...said.map(v => `    ${v}`));
          if (base) writeFileSync(join(out, `now-${id}.png`), toPNG(svgOf(base), 900));
          if (l) writeFileSync(join(out, `nested-${id}.png`), toPNG(svgOf(l), 900));
          rows[0].push(base);
          rows[1].push(l);
          caps[0].push([`${id}: as it is now`, ...cap(base)]);
          caps[1].push([`${id}: nested arcs`, ...cap(l, base)]);
        }
        writeFileSync(join(out, 'nested-sheet.png'), toPNG(labelled(rows, caps), texts.length * 480));
      }
      if (parts.includes('options')) {
        const t = TEXTS[1][1],
          a = ground(t, 'entry'),
          tops: [string, Mode, boolean][] = [['canopy (a) alone', 'entry', false], ['(a) + (c) nested', 'entry', true], ['(b) + (c) nested', 'kashida', true]], // prettier-ignore
          rows = [false, true].map(cradle => tops.map(([, mode, canopy]) => (!canopy && !cradle ? a : ground(t, mode, { canopy, cradle })))), // prettier-ignore
          caps = [false, true].map((cradle, j) => tops.map(([name], i) => [`${name}, ${cradle ? 'cradle + sub-cradle' : 'cradle only'}`, ...cap(rows[j][i], a, '(a) alone')])); // prettier-ignore
        rows.forEach((row, j) => row.forEach((l, i) => say(`option ${caps[j][i][0]}`, l, a)));
        writeFileSync(join(out, 'nested-options.png'), toPNG(labelled(rows, caps, 640), 1920));
      }
      if (parts.includes('third')) {
        // a third ripple: two stems bowed over under the canopy
        const cells: [string, string, Mode][] = [['salawat', TEXTS[2][1], 'stem'], ['basmala (b)', TEXTS[1][1], 'kashida'], ['basmala (a)', TEXTS[1][1], 'entry']], // prettier-ignore
          row = cells.map(([, t, mode]) => ground(t, mode, { canopy: true, cradle: true, canopies: 2 }));
        row.forEach((l, i) => say(`third ripple, ${cells[i][0]}`, l));
        writeFileSync(join(out, 'nested-third.png'), toPNG(labelled([row], [cells.map(([name], i) => [`${name}: two stems bowed`, ...cap(row[i])])], 640), 1920)); // prettier-ignore
      }
      writeFileSync(join(out, 'numbers.txt'), report.join('\n') + '\n');
      expect(report.length).toBeGreaterThan(1);
    },
    1_800_000,
  );
});
