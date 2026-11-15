// Curved axes with bent letters (owner's experiment, 15 November 2026). docs/placement-brief/experiments/curved.mjs
// stood whole words on curved lines, and they read as tilted words; here each line is written by the engine and its
// letters are bent with the line: every point of a letter's skeleton is carried to the curve, and the pen turns with
// it, before the pen draws. Families: lens (lines bend as the circle's edge does), bow (twice that), flow (the lines
// part round an empty centre), and centre (flow, with the name of God or the first word standing upright in the
// middle). `CURVED=1 CURVED_OUT=<dir> npx vitest run tests/curved-letters-sheet.test.ts` writes a sheet.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPNG } from '../scripts/raster.mjs';
import * as curved from '../docs/placement-brief/experiments/curved.mjs';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { CHOSEN } from '../src/script/thuluth/alts';
import type { Built } from '../src/script/thuluth/engine';
import { cleanOutline } from '../src/script/thuluth/outline';
import { Alpha, toPixels } from '../src/script/thuluth/raster';
import type { Poly } from '../src/script/thuluth/types';

type Curve = { pt(s: number): [number, number]; ang(s: number): number };
type Family = 'lens' | 'bow' | 'flow' | 'centre';
// the line families are plain JavaScript: say what they give
const arc = curved.arc as (h: number, k: number) => Curve,
  streamline = curved.streamline as (h: number, a: number) => Curve,
  heights = curved.heights as (family: string, n: number, pitch: number, R: number, hole?: number) => number[],
  room = curved.room as (line: Curve, R: number) => number;
const th = thuluth({ ...ROUNDEL_PEN, alts: CHOSEN, pieceGap: 0.45, wordSpace: 1.4 });
const NIB = th.style.nib,
  MARGIN = 0.9 * NIB,
  TEXTS: [string, string][] = [
    ['names', 'محمد علي'],
    ['basmala', 'بسم الله الرحمن الرحيم'],
    ['salawat', 'اللهم صل على محمد وآل محمد'],
    ['ikhlas', 'قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له كفوا أحد'],
  ];

/** A level line as the engine writes it, and its ink's extent along the line. */
const lines = new Map<string, { b: Built; x0: number; x1: number }>();
function levelLine(text: string) {
  let l = lines.get(text);
  if (!l) {
    const b = th.buildStrokes(text, {}),
      xs = [...b.strokes.flatMap(s => th.strokePolys(s)), ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y))].flat().map(p => p[0]); // prettier-ignore
    l = { b, x0: Math.min(...xs), x1: Math.max(...xs) };
    lines.set(text, l);
  }
  return l;
}
/** The ink of a level line bent onto a curve: each skeleton point carried to the curve, the pen turned with it. */
function bent(text: string, c: Curve, nibScale = 1): Poly[] {
  const { b, x0, x1 } = levelLine(text),
    mid = (x0 + x1) / 2,
    carry = (x: number, y: number) => {
      const s = x - mid,
        [px, py] = c.pt(s),
        a = c.ang(s);
      return { x: px - y * Math.sin(a), y: py + y * Math.cos(a), a };
    };
  return [
    ...b.strokes.flatMap(
      st =>
      th.strokePolys({ ...st, s: st.s.map(q => { const p = carry(q.x, q.y); return { ...q, x: p.x, y: p.y, rot: (q.rot || 0) + p.a }; }) }, nibScale), // prettier-ignore
    ),
    ...b.dots.flatMap(([x, y, sc, rot]) => {
      const p = carry(x, y);
      return th.dotPolysAt(p.x, p.y, (sc ?? 1) * nibScale, (rot || 0) + p.a);
    }),
  ];
}
const curveOf = (family: Family, h: number, R: number, hole: number): Curve =>
  family === 'lens' ? arc(h, h / (R * R)) : family === 'bow' ? arc(h, (2 * h) / (R * R)) : streamline(h, hole);

interface Laid {
  R: number;
  lines: number;
  polys: Poly[];
}
function lay(family: Family, text: string): Laid | null {
  let words = text.split(' ');
  // centre: the name of God, or else the first word, stands upright in the middle and the rest pass round it
  let centre: string | null = null;
  if (family === 'centre' && words.length > 2) {
    const i = Math.max(0, words.indexOf('الله'));
    centre = words[i];
    words = words.filter((_, k) => k !== i);
  }
  const n = words.length,
    width = (a: number, b: number) => { const l = levelLine(words.slice(a, b).join(' ')); return l.x1 - l.x0; }, // prettier-ignore
    centreInk = centre ? cleanOutline(bent(centre, arc(0, 0))) : [],
    cb = centreInk.flat(),
    cy = centre ? (Math.min(...cb.map(p => p[1])) + Math.max(...cb.map(p => p[1]))) / 2 : 0,
    centred = centreInk.map(q => q.map(([x, y]) => [x, y - cy] as [number, number])),
    holeOf = (R: number) =>
      centre ? Math.max(...centred.flat().map(([x, y]) => Math.hypot(x, y))) + 0.6 * NIB : 0.22 * R;
  for (let pitch = 15.5; pitch < 24; pitch *= 1.06)
    for (let R = 10; R < 160; R *= 1.02) {
      let best: { full: number; cut: [number, number][]; curves: Curve[] } | null = null;
      for (let m = 1; m <= Math.min(n, 7); m++) {
        const fam = family === 'centre' ? 'flow' : family,
          hs = heights(fam === 'bow' ? 'lens' : fam, m, pitch, R - MARGIN, holeOf(R)),
          curves = hs.map(h => curveOf(family === 'centre' ? 'flow' : family, h, R, holeOf(R))),
          rooms = curves.map(c => room(c, R - MARGIN));
        if (rooms.some(r => r <= 0)) continue;
        const full = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(Infinity)),
          from = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(-1));
        full[0][0] = 0;
        for (let i = 1; i <= m; i++)
          for (let b = i; b <= n; b++)
            for (let a = i - 1; a < b; a++) {
              const f = Math.max(full[i - 1][a], width(a, b) / rooms[i - 1]);
              if (f < full[i][b]) {
                full[i][b] = f;
                from[i][b] = a;
              }
            }
        if (full[m][n] <= 1 && (!best || full[m][n] < best.full)) {
          const cut: [number, number][] = [];
          for (let i = m, b = n; i > 0; i--) {
            cut.unshift([from[i][b], b]);
            b = from[i][b];
          }
          best = { full: full[m][n], cut, curves };
        }
      }
      if (!best) continue;
      // drawn: inside the circle, and no two lines (or a line and the centre word) touching
      const inks = best.cut.map(([a, b], i) => bent(words.slice(a, b).join(' '), best!.curves[i])),
        far = Math.max(...[...inks.flat(), ...centred].flat().map(([x, y]) => Math.hypot(x, y)));
      if (far > R - MARGIN) continue;
      const K = 4,
        W = Math.ceil(2 * R * K),
        X = (x: number) => (x + R) * K,
        Y = (y: number) => (R - y) * K,
        count = new Uint8Array(W * W),
        fat = [...best.cut.map(([a, b], i) => bent(words.slice(a, b).join(' '), best!.curves[i], 1.25)), ...(centre ? [centred] : [])]; // prettier-ignore
      for (const ink of fat) {
        const A = new Alpha(W, W);
        A.fill(toPixels(ink, X, Y));
        for (let i = 0; i < count.length; i++) if (A.a[i] > 127) count[i]++;
      }
      if (count.some(v => v > 1)) break; // touching: open the pitch and start again
      return { R, lines: best.cut.length, polys: [...inks.flatMap(k => cleanOutline(k)), ...centred] };
    }
  return null;
}
const svgOf = (l: Laid) => {
  const R = l.R,
    pad = 2,
    S = 2 * (R + pad),
    d = l.polys.map(q => 'M' + q.map(([x, y]) => `${(x + R + pad).toFixed(2)} ${(R + pad - y).toFixed(2)}`).join('L') + 'Z').join(''); // prettier-ignore
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="900" height="900"><rect width="100%" height="100%" fill="#f3efe4"/><circle cx="${R + pad}" cy="${R + pad}" r="${R}" fill="#fffdf6" stroke="#b9a76a" stroke-width="${(R * 0.03).toFixed(2)}"/><path d="${d}" fill="#1a1a1a" fill-rule="nonzero"/></svg>`;
};

describe('curved axes with bent letters', () => {
  it('bends a line onto an arc without losing ink', () => {
    const level = cleanOutline(bent('بسم الله', arc(0, 0))),
      arched = cleanOutline(bent('بسم الله', arc(8, 8 / 900))),
      area = (ps: Poly[]) => Math.abs(ps.reduce((a, q) => a + q.reduce((s, [x, y], i) => s + x * q[(i + 1) % q.length][1] - q[(i + 1) % q.length][0] * y, 0) / 2, 0)); // prettier-ignore
    expect(arched.length).toBeGreaterThan(0);
    expect(Math.abs(area(arched) - area(level)) / area(level)).toBeLessThan(0.08);
  });
  it.runIf(!!process.env.CURVED)(
    'writes the sheet',
    () => {
      const out = process.env.CURVED_OUT ?? join(import.meta.dirname, '../docs/curved');
      mkdirSync(out, { recursive: true });
      const report: string[] = [];
      for (const family of ['lens', 'bow', 'flow', 'centre'] as Family[])
        for (const [id, text] of TEXTS) {
          const l = lay(family, text);
          report.push(`${family} ${id}: ${l ? `${l.lines} lines, radius ${l.R.toFixed(1)} (${(l.R / NIB).toFixed(1)} nibs)` : 'no arrangement'}`); // prettier-ignore
          if (l) writeFileSync(join(out, `${family}-${id}.png`), toPNG(svgOf(l), 480));
        }
      writeFileSync(join(out, 'numbers.txt'), report.join('\n') + '\n');
      expect(report.length).toBe(16);
    },
    1_800_000,
  );
});
