// Letter comparison sheets: the current thuluth letters beside the drafted alternatives (ThuluthStyle.alts,
// src/script/thuluth/alts.ts), written as PNGs to LETTERS_OUT for judging by eye. Nothing runs without LETTERS:
//   LETTERS=sheets      every sheet below
//   LETTERS=stems       stems-sheet.png (and -line): the heads and feet of the tall stems, current / a / b / c
//   LETTERS=muhammad    muhammad-sheet.png (and -line): the name and the words that share its letters
//   LETTERS=audit       audit-sheet.png, audit-words-sheet.png (and both again with the recommended set)
//   LETTERS=fixes       audit-fixes-sheet.png: the audit's corrections, before and after
//   LETTERS=redrawn     redrawn-sheet.png: the letters redrawn for the dense roundels (alts.redrawn), beside today's
//   LETTERS=roundels    roundels-before-after.png: two roundels, current and recommended
//   LETTERS=confusion   confusion.txt: the rasm confusion matrix with LETTERS_ALTS (JSON) against today's
//   LETTERS=probe       LETTERS_SPEC, a JSON file of rows { label, alts, pen, words, window, skel }, for looking at
//                       one drawing while redrawing it
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { thuluthStyleOf } from '../src/script/registry';
import type { Form, ThuluthStyle } from '../src/script/thuluth';
import type { Thuluth } from '../src/script/thuluth';
import { TILE_PEN, buildRoundel, roundelArt, thuluth } from '../src/script/thuluth';
import { CHOSEN, RECOMMENDED } from '../src/script/thuluth/alts';
import { confusionMatrix } from '../src/script/thuluth/checker';
import { toPNG } from '../scripts/raster.mjs';
import type { Cell } from './helpers/letters-sheet';
import { glyphCell, inkCell, sheet } from './helpers/letters-sheet';

/** One letter of each shape, and the forms to show. */
const SPECIMEN = [...'ابحدرسصطعفقكلمنهوي', 'ﻻ', 'ء'],
  FORMS: Form[] = ['iso', 'ini', 'med', 'fin'];
const RUN = process.env.LETTERS,
  OUT = process.env.LETTERS_OUT ?? '/tmp/letters';
type Pen = 'roundel' | 'line' | 'band';
const engine = (pen: Pen, alts?: ThuluthStyle['alts']) => thuluth({ ...thuluthStyleOf({ preset: pen }), alts });
const write = (name: string, svg: string, width: number) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), toPNG(svg, width));
};

describe('letter sheets', () => {
  it.runIf(RUN === 'confusion')('confusion', () => {
    const alts = JSON.parse(
      process.env.LETTERS_ALTS ?? '{"stems":"a","muhammad":"c","fixes":true}',
    ) as ThuluthStyle['alts'];
    let out = '';
    for (const pen of ['roundel', 'tile'] as const) {
      const base = pen === 'roundel' ? thuluthStyleOf({ preset: 'roundel' }) : TILE_PEN,
        cur = confusionMatrix(thuluth(base)),
        alt = confusionMatrix(thuluth({ ...base, alts })),
        key = (c: { a: string; b: string; form: string }) => `${c.a}/${c.b} ${c.form}`,
        was = new Map(cur.map(c => [key(c), c.d]));
      out += `\n== ${pen}: pairs under 0.4 with the alternatives (was -> now)\n`;
      for (const c of alt)
        if (c.d < 0.4 || (was.get(key(c)) ?? 1) < 0.4)
          out += `${key(c)}  ${(was.get(key(c)) ?? NaN).toFixed(3)} -> ${c.d.toFixed(3)}\n`;
      out += `-- largest falls\n`;
      for (const c of [...alt]
        .sort((p, q) => p.d - (was.get(key(p)) ?? 1) - (q.d - (was.get(key(q)) ?? 1)))
        .slice(0, 12))
        out += `${key(c)}  ${(was.get(key(c)) ?? NaN).toFixed(3)} -> ${c.d.toFixed(3)}\n`;
    }
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'confusion.txt'), out);
    expect(out.length).toBeGreaterThan(0);
  });

  const on = (name: string) => RUN === name || RUN === 'sheets';

  it.runIf(on('stems'))('stems-sheet: the heads and feet of the tall stems', () => {
    const words = ['ا', 'ل', 'الله', 'الرحمن', 'كل', 'لا'],
      rows: [string, ThuluthStyle['alts']][] = [
        ['current', undefined],
        ['alt a\ntarwis: a pointed\nserif on the right', { stems: 'a' }],
        ['alt b\nplain top, cut by\nthe nib', { stems: 'b' }],
        ['alt c\nfuller jali head', { stems: 'c' }],
      ];
    for (const pen of ['roundel', 'line'] as const) {
      const sheetRows = rows.map(([label, alts]) => {
        const th = engine(pen, alts),
          // the heads three times larger: the top of ا, of ل and of the name, and the foot where a lam joins on
          zoom = (w: string, width: number, foot = false) => {
            const c = inkCell(th, w, { pad: 0.5 }),
              [, y0, x1] = c.box;
            return { ...c, group: 'zoom', box: (foot ? [x1 - width, -3, x1, 1.4] : [x1 - width, y0, x1, y0 + 4.4]) as Cell['box'] }; // prettier-ignore
          };
        return {
          label,
          cells: [...words.map(w => inkCell(th, w)), zoom('ا', 4.4), zoom('ل', 4.4), zoom('الله', 4.4), zoom('لم', 4.4, true)], // prettier-ignore
        };
      });
      const svg = sheet(sheetRows, { cell: [440, 440], title: `Tall stems, ${pen} pen: current and three alternatives (alts.stems)`, cols: [...words, 'ا head ×3', 'ل head ×3', 'الله first head ×3', 'لم foot ×3'] }); // prettier-ignore
      write(pen === 'roundel' ? 'stems-sheet.png' : 'stems-sheet-line.png', svg, 4600);
    }
  });

  it.runIf(on('muhammad'))('muhammad-sheet: the name and the words that share its letters', () => {
    const rows: [string, ThuluthStyle['alts']][] = [
      ['current', undefined],
      ['alt a\nletters redrawn,\nwritten along the line', { muhammad: 'a' }],
      ['alt b\nthe jali ligature,\nin the name only', { muhammad: 'b' }],
      ["alt c\nboth: a's letters,\nthe name as b", { muhammad: 'c' }],
    ];
    const near = ['الحمد', 'احمد', 'محمود', 'حميد', 'مسلم', 'الرحمن', 'الرحيم'];
    for (const pen of ['roundel', 'line'] as const) {
      const sheetRows = rows.map(([label, alts]) => {
        const th = engine(pen, alts);
        return {
          label,
          cells: [
            inkCell(th, 'محمد', { group: 'name' }),
            inkCell(th, 'على محمد وآل محمد', { group: 'phrase' }),
            inkCell(th, 'اللهم صل على محمد', { group: 'phrase' }),
            ...near.map(w => inkCell(th, w, { group: 'near' })),
          ],
        };
      });
      const svg = sheet(sheetRows, { cell: [620, 440], title: `محمد, ${pen} pen: current and three alternatives (alts.muhammad)`, cols: ['محمد', 'على محمد وآل محمد', 'اللهم صل على محمد', ...near] }); // prettier-ignore
      write(pen === 'roundel' ? 'muhammad-sheet.png' : 'muhammad-sheet-line.png', svg, 6400);
    }
  });

  /** The audit's ten weakest forms: letter, form, rank. */
  const WEAK: [string, Form, number][] = [
    ['ك', 'med', 1], ['م', 'med', 2], ['ح', 'med', 3], ['ا', 'iso', 4], ['ا', 'fin', 4], ['ع', 'fin', 5], ['م', 'ini', 6],
    ['ك', 'fin', 7], ['ك', 'iso', 7], ['د', 'fin', 8], ['ق', 'fin', 9], ['ق', 'iso', 9], ['ق', 'ini', 9], ['ل', 'med', 10], ['ل', 'ini', 10],
  ]; // prettier-ignore
  const WORDS = ['بسم الله الرحمن الرحيم', 'الحمد لله رب العالمين', 'لا إله إلا الله', 'علي', 'فاطمة', 'الحسن', 'الحسين', 'سبحان الله', 'ما شاء الله', 'نور', 'قلب', 'هو']; // prettier-ignore
  const blank: Cell = { body: '', box: [0, 0, 1, 1] };
  /** Every letter shape in every form it takes (a letter that does not join onwards has no initial or medial). */
  const specimen = (th: Thuluth, per: number, mark: boolean) => {
    const NOJOIN = new Set([...'ادرو', 'ﻻ', 'ء']),
      cells = SPECIMEN.map(c =>
        FORMS.map(f => {
          if ((f === 'ini' || f === 'med') && NOJOIN.has(c)) return { ...blank, label: `${c} ${f}: none` };
          if (c === 'ء' && f === 'fin') return { ...blank, label: 'ء fin: none' };
          const weak = mark ? WEAK.find(w => w[0] === c && w[1] === f) : undefined;
          return glyphCell(th, c, f, { group: 'all', label: `${c} ${f}`, mark: weak ? String(weak[2]) : undefined })!;
        }),
      ),
      rows: { label: string; cells: Cell[] }[] = [];
    for (let i = 0; i < cells.length; i += per) rows.push({ label: SPECIMEN.slice(i, i + per).join(' '), cells: cells.slice(i, i + per).flat() }); // prettier-ignore
    return rows;
  };

  it.runIf(on('audit'))('audit-sheet: every letter in every form, and a dozen words', () => {
    const th = engine('roundel');
    const letters = sheet(specimen(th, 2, true), { cell: [400, 400], labelW: 70, title: 'Audit, roundel pen: every letter shape in every form (iso, ini, med, fin). Red: the ten weakest, by rank', cols: [...FORMS, ...FORMS] }); // prettier-ignore
    write('audit-sheet.png', letters, 3282);
    const words = [];
    for (let i = 0; i < WORDS.length; i += 3) words.push({ label: '', cells: WORDS.slice(i, i + 3).map(w => inkCell(th, w, { group: w.length > 12 ? 'long' : 'short', label: w })) }); // prettier-ignore
    write('audit-words-sheet.png', sheet(words, { cell: [1060, 420], labelW: 12, title: 'Audit, roundel pen: common words as drawn today' }), 3204); // prettier-ignore
    const alt = engine('roundel', RECOMMENDED);
    write('audit-sheet-recommended.png', sheet(specimen(alt, 2, false), { cell: [400, 400], labelW: 70, title: 'The same specimen with the recommended alternatives (stems a, muhammad c, fixes)', cols: [...FORMS, ...FORMS] }), 3282); // prettier-ignore
    const words2 = [];
    for (let i = 0; i < WORDS.length; i += 3) words2.push({ label: '', cells: WORDS.slice(i, i + 3).map(w => inkCell(alt, w, { group: w.length > 12 ? 'long' : 'short', label: w })) }); // prettier-ignore
    write('audit-words-sheet-recommended.png', sheet(words2, { cell: [1060, 420], labelW: 12, title: 'The same words with the recommended alternatives' }), 3204); // prettier-ignore
  });

  it.runIf(on('fixes'))('audit-fixes-sheet: before and after for the corrected forms', () => {
    const cur = engine('roundel'),
      fix = engine('roundel', { fixes: true }),
      cols: [string, string[]][] = [
        ['kaf-med: the join reaches the kaf', ['لكم', 'شكر']],
        ['kaf-iso: no stub at the foot', ['ك', 'بارك']],
        ['dal-fin: no spur under the corner', ['بعد', 'عبد']],
        ['qaf-end: the bowl leaves the head cleanly', ['ق', 'الحق']],
        ['fa-qaf-room: dots clear of the next stem', ['قلب', 'فلا']],
      ];
    const row = (th: Thuluth, label: string) => ({
      label,
      cells: cols.flatMap(([, ws], k) => ws.map(w => inkCell(th, w, { group: `g${k}`, label: w }))),
    });
    const svg = sheet([row(cur, 'current'), row(fix, 'fixes')], { cell: [420, 440], title: 'Audit corrections (alts.fixes): before and after', cols: cols.flatMap(([c]) => [c, '']) }); // prettier-ignore
    write('audit-fixes-sheet.png', svg, 4400);
  });

  it.runIf(on('redrawn'))("redrawn-sheet: the letters redrawn for the dense roundels, beside today's", () => {
    const cols: [string, string[]][] = [
        ['hah: the head smaller', ['الحمد', 'الرحمن']],
        ['mim: loops on the line', ['محمد', 'بسم']],
        ['seen: three pointed teeth', ['رسول', 'شمس']],
        ['heh: medial larger, final lower', ['اللهم', 'فاطمة']],
        ['the name of God', ['الله', 'لا إله إلا الله']],
      ],
      rows: [string, ThuluthStyle['alts']][] = [
        ['current', undefined],
        ['redrawn', { redrawn: true }],
        ['chosen stems and\nname, with redrawn', { ...CHOSEN, redrawn: true }],
      ];
    for (const pen of ['roundel', 'line'] as const) {
      const row = (th: Thuluth, label: string) => ({
        label,
        cells: cols.flatMap(([, ws], k) => ws.map(w => inkCell(th, w, { group: `g${k}`, label: w }))),
      });
      const svg = sheet(rows.map(([label, alts]) => row(engine(pen, alts), label)), { cell: [420, 440], title: `The redrawn letters (alts.redrawn), ${pen} pen: today's, the redrawn set, and the redrawn set under the chosen drafts`, cols: cols.flatMap(([c]) => [c, '']) }); // prettier-ignore
      write(pen === 'roundel' ? 'redrawn-sheet.png' : 'redrawn-sheet-line.png', svg, 4400);
    }
  });

  it.runIf(on('roundels'))(
    'roundels-before-after',
    () => {
      const texts = ['بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ', 'اللهم صل على محمد وآل محمد'],
        sets: [string, ThuluthStyle['alts']][] = [['current', undefined], ['recommended: stems a, muhammad c, fixes', RECOMMENDED]], // prettier-ignore
        S = 900;
      let body = '';
      sets.forEach(([label, alts], row) => {
        const th = engine('roundel', alts);
        texts.forEach((text, col) => {
          const b = buildRoundel(th, { text, compose: { elongate: true, cross: true, kern: true, tries: 4, iters: 6000, lanes: {} }, frame: {} })!, // prettier-ignore
            art = roundelArt(th, b.r, b.f),
            K = (S - 60) / (2 * art.Rout * Math.max(1, art.oval)),
            cx = 20 + col * S + (S - 20) / 2,
            cy = 70 + row * (S + 50) + (S - 20) / 2,
            d = art.units.map(u => u.polys.map(q => 'M' + q.map(([x, y]) => `${(cx + (x - art.cx) * K).toFixed(1)} ${(cy - (y - art.cy) * K).toFixed(1)}`).join('L') + 'Z').join('')).join(''); // prettier-ignore
          body += `<ellipse cx="${cx}" cy="${cy}" rx="${art.Rout * art.oval * K}" ry="${art.Rout * K}" fill="#fffdf6" stroke="#b9a66a" stroke-width="${art.rim * K}"/><path fill="#1b1b1b" fill-rule="nonzero" d="${d}"/>`;
        });
        body += `<text x="20" y="${56 + row * (S + 50)}" font-family="DejaVu Sans, sans-serif" font-size="26" font-weight="bold" fill="#1d2440">${label}</text>`;
      });
      const W = 2 * S + 20,
        H = 2 * (S + 50) + 40;
      write('roundels-before-after.png', `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#f6f1e4"/>${body}</svg>`, W); // prettier-ignore
    },
    1_200_000,
  );

  it.runIf(RUN === 'probe')('probe', () => {
    interface Row {
      label?: string;
      alts?: ThuluthStyle['alts'];
      pen?: Pen;
      words: string[];
      window?: [number, number, number, number];
      skel?: boolean;
    }
    const spec = JSON.parse(readFileSync(process.env.LETTERS_SPEC!, 'utf8')) as { rows: Row[]; cell?: [number, number]; name?: string; width?: number }; // prettier-ignore
    const rows = spec.rows.map(r => {
      const th = engine(r.pen ?? 'roundel', r.alts);
      return {
        label: r.label ?? JSON.stringify(r.alts ?? 'current'),
        cells: r.words.map(w => inkCell(th, w, { window: r.window, skel: r.skel })),
      };
    });
    const svg = sheet(rows, { cell: spec.cell });
    write(spec.name ?? 'probe.png', svg, spec.width ?? 1600);
    expect(svg.length).toBeGreaterThan(0);
  });
});
