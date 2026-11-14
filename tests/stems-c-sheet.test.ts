// Sheets for judging the chosen letter set (stems c, muhammad c, fixes: alts.ts CHOSEN) by eye. Nothing runs without
// STEMSC; the PNGs go to STEMSC_OUT:
//   STEMSC=ba        stems-c-before-after.png: the places where a tall stem stood tight, as an earlier drawing of the
//                    set had them and as they are now, with the measured room in each caption. The earlier drawing
//                    is a checkout of that commit's src/ at STEMSC_BEFORE (a folder holding src/); without it the
//                    sheet shows today's default letters in its place.
//   STEMSC=words     words-c.png: the audit's dozen common words in the chosen set
//   STEMSC=roundels  roundels-c.png: four texts in lanes and ruled, with the recommended spacing, default letters
//                    beside the chosen set, in gold on green and in flat black
//   STEMSC=all       all three
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { thuluthStyleOf } from '../src/script/registry';
import type { Thuluth, ThuluthAlts } from '../src/script/thuluth';
import * as NOW from '../src/script/thuluth';
import { CHOSEN } from '../src/script/thuluth/alts';
import { cleanOutline } from '../src/script/thuluth/outline';
import type { RoundelOptions } from '../src/script/thuluth/roundel';
import { toPNG } from '../scripts/raster.mjs';
import type { Cell } from './helpers/letters-sheet';
import { inkCell, sheet } from './helpers/letters-sheet';
import { letterInks, stemRoom } from './helpers/stem-clearance';

const RUN = process.env.STEMSC,
  OUT = process.env.STEMSC_OUT ?? '/tmp/stems-c',
  on = (name: string) => RUN === name || RUN === 'all';
type Pen = 'roundel' | 'line' | 'band';
type Mod = Pick<typeof NOW, 'thuluth' | 'buildRoundel' | 'renderRoundel' | 'roundelArt' | 'roundelChecks'>;
const write = (name: string, svg: string, width: number) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), toPNG(svg, width));
};
const engine = (M: Mod, pen: Pen, alts?: ThuluthAlts) => M.thuluth({ ...thuluthStyleOf({ preset: pen }), alts });
const COMPOSE: RoundelOptions = { elongate: true, cross: true, kern: true, tries: 4, iters: 6000 },
  LANES: RoundelOptions = { lanes: {}, wordGap: 2.4, innerGap: 0.7 },
  RULED: RoundelOptions = { ruled: true, wordGap: 1.6, innerGap: 0.7 },
  TEXTS: [string, string][] = [
    ['basmala, vowelled', 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ'],
    ['basmala', 'بسم الله الرحمن الرحيم'],
    ['salawat', 'اللهم صل على محمد وآل محمد'],
    ['ikhlas', 'قل هو الله أحد الله الصمد'],
  ];

/** The tightest room round a tall stem among `inks` (in nibs), and between which letters. */
function tightest(th: Thuluth, rooms: ReturnType<typeof stemRoom>): string {
  // (the second lam of the name of God is joined to the first by its bowl: that is no gap)
  const rs = rooms.filter(r => r.other && !(r.stem.c === 'ل' && r.other.c === 'ل' && r.other.piece === r.stem.piece && r.gap < 0.7)), // prettier-ignore
    r = rs.sort((a, b) => a.gap - b.gap)[0];
  if (!r) return 'no stem beside another letter';
  return `${r.gap <= 0 ? 'TOUCHING' : (r.gap / th.style.nib).toFixed(2) + ' nib'} (${r.stem.c} and ${r.other!.c || 'shadda'})`;
}
/** Some words of a composed roundel, cut out: their letters black, the rest of the composition grey. */
function roundelCrop(M: Mod, th: Thuluth, text: string, how: RoundelOptions, words: number[], group: string): Cell {
  const b = M.buildRoundel(th, { text, compose: { ...COMPOSE, ...how }, frame: {} })!,
    r = b.r,
    path = (polys: readonly (readonly [number, number])[][], dx: number, dy: number) =>
      polys
        .map(q => 'M' + q.map(([x, y]) => `${(x + dx).toFixed(3)} ${(-y - dy).toFixed(3)}`).join('L') + 'Z')
        .join('');
  let body = '',
    x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  r.shapes.forEach((S, g) => {
    const mine = words.includes(r.groups[g].word),
      { x: dx, y: dy } = r.st[g],
      polys = [
        ...S.b.strokes.filter(s => !s.mark).flatMap(s => cleanOutline(th.strokePolys(s))),
        ...S.b.dots.flatMap(([x, y, sc, rot]) => th.dotPolysAt(x, y, sc ?? 1, rot ?? 0)),
      ];
    body += `<path fill="${mine ? '#1b1b1b' : '#cfc8b4'}" fill-rule="nonzero" d="${path(polys, dx, dy)}"/>`;
    if (mine)
      for (const q of polys)
        for (const [x, y] of q) {
          x0 = Math.min(x0, x + dx);
          x1 = Math.max(x1, x + dx);
          y0 = Math.min(y0, y + dy);
          y1 = Math.max(y1, y + dy);
        }
  });
  const inks = letterInks(th, r.shapes.map((S, g) => ({ b: S.b, dx: r.st[g].x, dy: r.st[g].y }))), // prettier-ignore
    of = new Set(r.groups.flatMap((g, i) => (words.includes(g.word) ? [i] : []))),
    // (the room inside the words shown: what another word does beside them is the composer's arrangement)
    rooms = stemRoom(inks.filter(e => of.has(e.piece)));
  return { body, box: [x0 - 1, -y1 - 1, x1 + 1, -y0 + 1], group, label: tightest(th, rooms) };
}
const lineCell = (th: Thuluth, text: string, group: string): Cell => {
  const b = th.buildStrokes(NOW.parseVowels(text).bare);
  return { ...inkCell(th, text, { group }), label: tightest(th, stemRoom(letterInks(th, [{ b }]))) };
};

describe('the chosen letter set, drawn', () => {
  it.runIf(on('ba'))(
    'stems-c-before-after',
    async () => {
      const dir = process.env.STEMSC_BEFORE,
        WAS = dir ? ((await import(/* @vite-ignore */ resolve(dir, 'src/script/thuluth/index.ts'))) as Mod) : null,
        sets: [string, Mod, ThuluthAlts | undefined][] = [
          WAS ? ['c as first drafted', WAS, CHOSEN] : ['default letters', NOW, undefined],
          ['c refined', NOW, CHOSEN],
        ],
        crops: [string, string, RoundelOptions, number[]][] = [
          ['الله', TEXTS[1][1], { lanes: {} }, [1]],
          ['الرحمن', TEXTS[1][1], { lanes: {} }, [2]],
          ['الرحيم', TEXTS[1][1], { lanes: {} }, [3]],
          ['اللهم', TEXTS[2][1], { lanes: {} }, [0]],
          ['وآل', TEXTS[2][1], { lanes: {} }, [4]],
          ['الله أحد', TEXTS[3][1], { ruled: true }, [2, 3]],
          ['الصمد', TEXTS[3][1], { ruled: true }, [5]],
        ],
        spaced: [string, string, RoundelOptions, number[]][] = [
          ['الله', TEXTS[1][1], LANES, [1]],
          ['الرحمن', TEXTS[1][1], LANES, [2]],
          ['الرحيم', TEXTS[1][1], RULED, [3]],
          ['اللهم', TEXTS[2][1], LANES, [0]],
          ['وآل', TEXTS[2][1], RULED, [4]],
          ['الله أحد', TEXTS[3][1], RULED, [2, 3]],
          ['الصمد', TEXTS[3][1], LANES, [5]],
        ],
        words = ['الله', 'الل', 'الملك', 'الصمد', 'إلا الله', 'إياك', 'طلا'],
        rows: { label: string; cells: Cell[] }[] = [];
      for (const [title, list] of [
        ['in a roundel, kern only\n(no innerGap)', crops],
        ['in a roundel, wordGap\nand innerGap 0.7', spaced],
      ] as const)
        for (const [name, M, alts] of sets) {
          const th = engine(M, 'roundel', alts);
          rows.push({ label: `${name}\n${title}`, cells: list.map(([w, text, how, ws], k) => { const c = roundelCrop(M, th, text, how, ws, `${title}${k}`); return { ...c, label: `${w}: ${c.label}` }; }) }); // prettier-ignore
        }
      for (const pen of ['roundel', 'line', 'band'] as const)
        for (const [name, M, alts] of sets) {
          const th = engine(M, pen, alts);
          rows.push({
            label: `${name}\non a line\n${pen} pen`,
            cells: words.map((w, k) => lineCell(th, w, `${pen}${k}`)),
          });
        }
      const svg = sheet(rows, { cell: [460, 400], title: 'Tall stems of alternative c: where they stood tight, before and after (captions: the tightest room round a stem, ink to ink)' }); // prettier-ignore
      write('stems-c-before-after.png', svg, 3410);
      // and in parts, to be read one at a time
      for (let i = 0; i < rows.length; i += 2) write(`stems-c-before-after-${i / 2 + 1}.png`, sheet(rows.slice(i, i + 2), { cell: [460, 400] }), 3410); // prettier-ignore
      expect(rows.length).toBe(10);
    },
    1_200_000,
  );

  it.runIf(on('words'))('words-c', () => {
    const WORDS = ['بسم الله الرحمن الرحيم', 'الحمد لله رب العالمين', 'لا إله إلا الله', 'علي', 'فاطمة', 'الحسن', 'الحسين', 'سبحان الله', 'ما شاء الله', 'نور', 'قلب', 'هو'], // prettier-ignore
      extra = ['محمد رسول الله', 'اللهم صل على محمد', 'كل ملك طلا إياك'];
    for (const pen of ['roundel', 'line'] as const) {
      const th = engine(NOW, pen, CHOSEN),
        rows = [];
      for (let i = 0; i < WORDS.length; i += 3) rows.push({ label: '', cells: WORDS.slice(i, i + 3).map(w => inkCell(th, w, { group: w.length > 12 ? 'long' : 'short', label: w })) }); // prettier-ignore
      rows.push({ label: '', cells: extra.map(w => inkCell(th, w, { group: 'long', label: w })) });
      write(pen === 'roundel' ? 'words-c.png' : 'words-c-line.png', sheet(rows, { cell: [1060, 420], labelW: 12, title: `Common words in the chosen set (stems c, muhammad c, fixes), ${pen} pen` }), 3204); // prettier-ignore
    }
  });

  it.runIf(on('roundels'))(
    'roundels-c',
    () => {
      const S = 620,
        CAP = 44,
        HEAD = 64,
        cols: [string, RoundelOptions, ThuluthAlts | undefined][] = [
          ['lanes 2.4 / 0.7, default letters', LANES, undefined],
          ['lanes 2.4 / 0.7, chosen set', LANES, CHOSEN],
          ['ruled 1.6 / 0.7, default letters', RULED, undefined],
          ['ruled 1.6 / 0.7, chosen set', RULED, CHOSEN],
        ];
      let body = '';
      const lines: string[] = [];
      cols.forEach(([name], x) => (body += `<text x="${x * S + S / 2}" y="${HEAD - 14}" text-anchor="middle" font-size="19" font-weight="bold">${name}</text>`)); // prettier-ignore
      TEXTS.forEach(([name, text], ti) =>
        cols.forEach(([col, how, alts], x) => {
          const th = engine(NOW, 'roundel', alts),
            b = NOW.buildRoundel(th, { text, compose: { ...COMPOSE, ...how }, frame: {} })!,
            ck = NOW.roundelChecks(th, b.r, b.f),
            inks = letterInks(th, b.r.shapes.map((sh, g) => ({ b: sh.b, dx: b.r.st[g].x, dy: b.r.st[g].y }))), // prettier-ignore
            cap = `${name}: field ${(b.r.disc.r * Math.sqrt(b.r.disc.oval)).toFixed(1)}; marks unplaced ${ck.marksUnplaced}, astray ${ck.strayMarks}; tightest stem ${tightest(th, stemRoom(inks))}`;
          lines.push(`${col}; ${cap}; ${b.r.groups.map((g, i) => g.s + (b.r.shapes[i].elong ? '~' + b.r.shapes[i].elong : '') + (b.r.shapes[i].stacked ? '^' : '')).join(' | ')}`); // prettier-ignore
          // gold on green, as a roundel is drawn; and the same ink flat black on a light ground
          const gold = NOW.renderRoundel(th, b.r, b.f, { U: 8 }),
            art = NOW.roundelArt(th, b.r, b.f),
            K = (S - 50) / (2 * art.Rout * Math.max(1, art.oval)),
            flat = (cx: number, cy: number) => {
              const d = art.units.map(u => `<path d="${u.polys.map(q => 'M' + q.map(([px, py]) => `${(cx + (px - art.cx) * K).toFixed(1)} ${(cy - (py - art.cy) * K).toFixed(1)}`).join('L') + 'Z').join('')}"/>`).join(''); // prettier-ignore
              return `<ellipse cx="${cx}" cy="${cy}" rx="${art.Rout * art.oval * K}" ry="${art.Rout * K}" fill="#fffdf6" stroke="#b9a66a" stroke-width="${art.rim * K}"/><g fill="#1b1b1b">${d}</g>`;
            };
          for (const [k, paint] of ['gold', 'flat'].entries()) {
            const y = HEAD + (ti * 2 + k) * (S + CAP),
              tile =
                paint === 'gold'
                  ? gold.replace(/^<svg ([^>]*?) width="[^"]*" height="[^"]*">/, `<svg $1 x="${x * S}" y="${y}" width="${S}" height="${S}">`) // prettier-ignore
                  : flat(x * S + S / 2, y + S / 2);
            body +=
              tile + `<text x="${x * S + S / 2}" y="${y + S + 20}" text-anchor="middle" font-size="11.5">${cap}</text>`;
            const alone = paint === 'gold' ? gold : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="100%" height="100%" fill="#f4efe3"/>${flat(S / 2, S / 2)}</svg>`; // prettier-ignore
            mkdirSync(join(OUT, 'roundels-c'), { recursive: true });
            writeFileSync(join(OUT, 'roundels-c', `${ti}-${name.replace(/[, ]+/g, '-')}-${x}-${paint}.png`), toPNG(alone, 1100)); // prettier-ignore
          }
        }),
      );
      const Wd = cols.length * S,
        Ht = HEAD + TEXTS.length * 2 * (S + CAP);
      write('roundels-c.png', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Ht}" width="${Wd}" height="${Ht}" font-family="DejaVu Sans, Arial, sans-serif" fill="#1d2440"><rect width="100%" height="100%" fill="#f4efe3"/><text x="12" y="24" font-size="20" font-weight="bold">Roundels with the recommended spacing (wordGap / innerGap): default letters and the chosen set (stems c, muhammad c, fixes)</text>${body}</svg>`, Wd); // prettier-ignore
      writeFileSync(join(OUT, 'roundels-c.txt'), lines.join('\n') + '\n');
      expect(lines.length).toBe(16);
    },
    1_800_000,
  );
});
