// Ink spacing on a line (ThuluthStyle.pieceGap, wordSpace), measured and drawn: LINESPACE=1 writes, to LINESPACE_OUT
// (docs/linespace), today.txt (the gaps of the word list at the line, band and roundel pens as the engine sets them
// without the option: inside words and between words), lines-before-after.png (the word list and two phrases at the
// three pens, off above on, each captioned with its measured gaps) and compositions-before-after.png (the four
// golden compositions of tests/thuluth-compose.test.ts through resolve and renderPlaced, off beside on).
// LINESPACE_PIECE and LINESPACE_WORD set the clearances drawn (nibs; 0.45 and 1.5).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Composition, Style } from '../src/model/schema';
import { renderPlaced } from '../src/render/composition';
import { PEN_PRESETS } from '../src/script/registry';
import { thuluth } from '../src/script/thuluth';
import { thuluthScript } from '../src/script/thuluth/adapter';
import type { ThuluthStyle } from '../src/script/thuluth/types';
import type { LayoutOptions, VectorStrip } from '../src/script/types';
import { DEFAULT_STYLE } from '../src/model/style';
import { TEXTS } from '../src/model/presets';
import { parseVowels } from '../src/script/thuluth/shape';
import { farGap, lineGaps, SPACING_WORDS, stripMarks } from './helpers/line-spacing';
import { THULUTH_CASES } from './helpers/thuluth-cases';
import { toPNG } from '../scripts/raster.mjs';

const RUN = !!process.env.LINESPACE,
  OUT = process.env.LINESPACE_OUT ?? join(import.meta.dirname, '../docs/linespace'),
  PIECE = +(process.env.LINESPACE_PIECE ?? 0.45),
  WORD = +(process.env.LINESPACE_WORD ?? 1.5),
  PENS = ['line', 'band', 'roundel'] as const,
  FONT = 'font-family="DejaVu Sans, Arial, sans-serif" fill="#1d2440"',
  VOWELLED = [
    'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
    'لَا إِلَهَ إِلَّا اللَّهُ مُحَمَّدٌ رَسُولُ اللَّهِ',
    'وَإِذَا قُرِئَ الْقُرْآنُ فَاسْتَمِعُوا لَهُ وَأَنْصِتُوا',
  ],
  f2 = (v: number) => v.toFixed(2),
  /** A strip drawn flat: letters dark, vowels red. */
  stripSVG = (st: VectorStrip) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${st.W + 2} ${st.Hb + 2}" width="${(st.W + 2) * 12}" height="${(st.Hb + 2) * 12}"><rect x="-1" y="-1" width="100%" height="100%" fill="#f4efe3"/><g transform="translate(0 ${st.Hb}) scale(1 -1)">${st.paths.map(p => `<path d="${p.d}" fill="${p.role === 'vowel' ? '#b3261e' : '#1b1b1b'}"/>`).join('')}</g></svg>`,
  /** An SVG set into a sheet at (x, y), fitted to w × h. */
  inset = (svg: string, x: number, y: number, w: number, h: number) =>
    svg.replace(
      /^<svg ([^>]*?) width="[^"]*" height="[^"]*">/,
      `<svg $1 x="${x}" y="${y}" width="${w}" height="${h}">`,
    );

describe('the space on a line, measured and drawn', () => {
  it.runIf(RUN)('measures today', () => {
    mkdirSync(OUT, { recursive: true });
    const lines: string[] = [];
    for (const pen of PENS) {
      const th = thuluth(PEN_PRESETS[pen]),
        nib = th.style.nib;
      lines.push(`\n== ${pen} pen (nib ${nib}) ==`);
      const ins: number[] = [],
        wds: number[] = [];
      for (const t of SPACING_WORDS) {
        const b = th.buildStrokes(parseVowels(t).bare),
          gs = lineGaps(th, b);
        ins.push(...gs.filter(g => g.kind === 'inside').map(g => g.gap));
        wds.push(...gs.filter(g => g.kind === 'word').map(g => g.gap));
        lines.push(`${t}: ` + gs.map(g => `${g.kind === 'word' ? '‖' : ''}${g.a}→${g.b} ${f2(g.gap)}`).join(', '));
      }
      const st = (v: number[]) => `n ${v.length}, min ${f2(Math.min(...v))}, median ${f2([...v].sort((a, b) => a - b)[v.length >> 1])}, max ${f2(Math.max(...v))}`; // prettier-ignore
      lines.push(`inside words: ${st(ins)}; between words: ${st(wds)} (pen units; nib ${nib})`);
    }
    writeFileSync(join(OUT, 'today.txt'), lines.join('\n') + '\n');
    expect(lines.length).toBeGreaterThan(10);
  });

  it.runIf(RUN)('draws the lines, off and on', () => {
    mkdirSync(OUT, { recursive: true });
    const Wd = 2600,
      COLS = 5,
      CW = Wd / COLS,
      RH = 120,
      CAP = 34,
      short = SPACING_WORDS.filter(t => !/\s/.test(t) || t.split(/\s+/).length < 3),
      long = SPACING_WORDS.filter(t => !short.includes(t)),
      numbers: string[] = [];
    let body = '',
      y = 0;
    for (const pen of PENS) {
      const base = PEN_PRESETS[pen],
        off = thuluth(base),
        on = thuluth({ ...base, pieceGap: PIECE, wordSpace: WORD }),
        nib = base.nib,
        // one scale for the pen, off and on: a pen unit is so many pixels
        U = 9,
        draw = (th: typeof off, t: string) => {
          const b = th.buildStrokes(parseVowels(t).bare),
            gs = lineGaps(th, b),
            ins = gs.filter(g => g.kind === 'inside'),
            wds = gs.filter(g => g.kind === 'word'),
            svg = th.drawSVG(b.strokes, b.dots, { U, pad: 1 }),
            [, w, h] = /width="(\d+)" height="(\d+)"/.exec(svg)!;
          return { svg, w: +w, h: +h, ins, wds, far: farGap(th, b) };
        },
        cap = (d: ReturnType<typeof draw>, full = false) =>
          (d.ins.length ? `inside ${full ? `${f2(Math.min(...d.ins.map(g => g.gap)))}–${f2(Math.max(...d.ins.map(g => g.gap)))}` : d.ins.map(g => f2(g.gap)).join(' ')}` : 'one piece') +
          (d.wds.length ? `; words ${full ? `${f2(Math.min(...d.wds.map(g => g.gap)))}–${f2(Math.max(...d.wds.map(g => g.gap)))}` : d.wds.map(g => f2(g.gap)).join(' ')}` : ''); // prettier-ignore
      y += 40;
      body += `<text x="16" y="${y - 10}" font-size="24" font-weight="bold">${pen} pen (nib ${nib}): off above, on below (pieceGap ${PIECE} = ${f2(PIECE * nib)}, wordSpace ${WORD} = ${f2(WORD * nib)} pen units); captions: ink to ink, pen units</text>`;
      short.forEach((t, i) => {
        const x = (i % COLS) * CW,
          yy = y + Math.floor(i / COLS) * (2 * (RH + CAP) + 14);
        [draw(off, t), draw(on, t)].forEach((d, k) => {
          const y0 = yy + k * (RH + CAP),
            sc = Math.min(1, (CW - 20) / d.w, RH / d.h);
          body += inset(d.svg, x + CW - 10 - d.w * sc, y0, d.w * sc, d.h * sc);
          body += `<text x="${x + CW - 10}" y="${y0 + RH + 20}" text-anchor="end" font-size="17">${k ? 'on' : 'off'}: ${cap(d)}</text>`;
          numbers.push(`${pen} ${k ? 'on ' : 'off'} ${t}: ${[...d.ins, ...d.wds].map(g => `${g.kind === 'word' ? '‖' : ''}${g.a}→${g.b} ${f2(g.gap)} (dots ${f2(g.dotGap)})`).join(', ')}; pieces apart ${d.far === Infinity ? '-' : f2(d.far)}`); // prettier-ignore
        });
      });
      y += Math.ceil(short.length / COLS) * (2 * (RH + CAP) + 14);
      for (const t of long)
        [draw(off, t), draw(on, t)].forEach((d, k) => {
          const sc = Math.min(1, (Wd - 20) / d.w, RH / d.h);
          body += inset(d.svg, Wd - 10 - d.w * sc, y, d.w * sc, d.h * sc);
          body += `<text x="${Wd - 10}" y="${y + RH + 20}" text-anchor="end" font-size="17">${k ? 'on' : 'off'}: ${cap(d, true)} (line ${f2(d.w / U)} long)</text>`;
          numbers.push(`${pen} ${k ? 'on ' : 'off'} ${t}: ${[...d.ins, ...d.wds].map(g => `${g.kind === 'word' ? '‖' : ''}${g.a}→${g.b} ${f2(g.gap)} (dots ${f2(g.dotGap)})`).join(', ')}; pieces apart ${d.far === Infinity ? '-' : f2(d.far)}`); // prettier-ignore
          y += RH + CAP + (k ? 14 : 0);
        });
      y += 20;
    }
    writeFileSync(
      join(OUT, 'lines-before-after.png'),
      toPNG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${y}" width="${Wd}" height="${y}" ${FONT}><rect width="100%" height="100%" fill="#f4efe3"/>${body}</svg>`, Wd), // prettier-ignore
    );
    writeFileSync(join(OUT, 'lines-numbers.txt'), numbers.join('\n') + '\n');
    expect(numbers.length).toBe(PENS.length * SPACING_WORDS.length * 2);
  });

  it.runIf(RUN)('reports the cost on a long line, and the vowels before and after', () => {
    mkdirSync(OUT, { recursive: true });
    const lines: string[] = [],
      ms = (f: () => unknown) => {
        const t = performance.now();
        f();
        return (performance.now() - t).toFixed(0) + ' ms';
      },
      letter = DEFAULT_STYLE.letter,
      lay: LayoutOptions = { wrap: false, rhythm: true, wordGap: 2, terminals: 'none' };
    for (const pen of PENS) {
      const base = PEN_PRESETS[pen],
        how: [string, ThuluthStyle][] = [['off', base], ['on ', { ...base, pieceGap: PIECE, wordSpace: WORD }]]; // prettier-ignore
      for (const [name, style] of how) {
        const th = thuluth(style),
          eng = thuluthScript(style),
          strip = (mode: 'words' | 'breaks') => {
            const p = eng.prepare(eng.shape(TEXTS.ayatKursi, letter), letter),
              segs = eng.segments(p, mode, 2);
            return eng.layout(segs, p, null, lay)!;
          };
        lines.push(
          `${pen} ${name} Ayat al-Kursi (${TEXTS.ayatKursi.split(/\s+/).length} words): setLine first ${ms(() => th.setLine(TEXTS.ayatKursi))}, again ${ms(() => th.setLine(TEXTS.ayatKursi))}; ` +
            `buildStrokes ${ms(() => th.buildStrokes(TEXTS.ayatKursi))}; strip by words first ${ms(() => strip('words'))}, again ${ms(() => strip('words'))}; by pieces first ${ms(() => strip('breaks'))}, again ${ms(() => strip('breaks'))}; ` +
            `line ${strip('words').W} long by words, ${strip('breaks').W} by pieces`,
        );
      }
      for (const t of VOWELLED)
        for (const mode of ['words', 'breaks'] as const)
          for (const [name, style] of how) {
            const eng = thuluthScript(style),
              v = { ...letter, marks: 'all' as const },
              p = eng.prepare(eng.shape(t, v), v),
              st = eng.layout(eng.segments(p, mode, 2), p, null, lay) as VectorStrip,
              m = stripMarks(st);
            lines.push(
              `${pen} ${name} vowels, by ${mode}: ${t}: ${m.quads} quads of vowels, ${m.onInk} on a letter's ink, nearest ${f2(m.clear)}`,
            );
            if (pen === 'band') writeFileSync(join(OUT, `vowels-${VOWELLED.indexOf(t)}-${mode}-${name.trim()}.png`), toPNG(stripSVG(st), 1600)); // prettier-ignore
          }
    }
    writeFileSync(join(OUT, 'cost-and-vowels.txt'), lines.join('\n') + '\n');
    expect(lines.length).toBeGreaterThan(6);
  });

  it.runIf(RUN)(
    'draws the compositions, off and on',
    () => {
      mkdirSync(OUT, { recursive: true });
      const S = 900,
        CAP = 60,
        ids = Object.keys(THULUTH_CASES),
        notes: string[] = [];
      let body = '';
      /** The composition with the spacing on every thuluth pen it names (its style, and any region's own). */
      const spaced = (c: Composition): Composition => {
        const d = structuredClone(c),
          walk = (v: unknown) => {
            if (!v || typeof v !== 'object') return;
            const s = v as { script?: string; pen?: Style['pen'] };
            if (s.script === 'thuluth' && s.pen) s.pen = { ...s.pen, pieceGap: PIECE, wordSpace: WORD };
            Object.values(v).forEach(walk);
          };
        walk(d);
        return d;
      };
      ids.forEach((id, i) => {
        [THULUTH_CASES[id], spaced(THULUTH_CASES[id])].forEach((c, k) => {
          const p = resolve(c),
            svg = renderPlaced(p, { idPrefix: `${id}${k}` }),
            x = (i % 2) * 2 * S + k * S,
            y = 30 + Math.floor(i / 2) * (S + CAP),
            rings = p.meta.borders.flatMap(b => b.rings.map(r => `×${r.rep}`)).join(' '),
            note = `${id} ${k ? `on (pieceGap ${PIECE}, wordSpace ${WORD})` : 'off'}: warnings ${p.meta.warnings.length ? p.meta.warnings.join('; ') : 'none'}; rings ${rings || '-'}`;
          const png = toPNG(svg, S);
          writeFileSync(join(OUT, `${id}-${k ? 'on' : 'off'}.png`), png);
          body += `<image x="${x}" y="${y}" width="${S}" height="${S}" href="data:image/png;base64,${Buffer.from(png).toString('base64')}"/>`;
          body += `<text x="${x + S / 2}" y="${y + S + 30}" text-anchor="middle" font-size="22">${note}</text>`;
          notes.push(note);
        });
      });
      const Wd = 4 * S,
        Ht = 30 + Math.ceil(ids.length / 2) * (S + CAP);
      writeFileSync(
        join(OUT, 'compositions-before-after.png'),
        toPNG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Ht}" width="${Wd}" height="${Ht}" ${FONT}><rect width="100%" height="100%" fill="#ffffff"/>${body}</svg>`, Wd), // prettier-ignore
      );
      writeFileSync(join(OUT, 'compositions.txt'), notes.join('\n') + '\n');
      expect(notes.length).toBe(ids.length * 2);
    },
    600_000,
  );
});
