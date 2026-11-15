// One engine, any order: a line of writing depends only on its text and its options. An engine keeps what it has
// measured (the sides of each piece of a word, engine.ts `pieceSides`; the room between two, `slideRooms`), and what it
// keeps must not show: the same line comes out the same to the last bit whatever the engine wrote before it, and the
// same as from an engine made for that line alone.
import { describe, expect, it } from 'vitest';
import { CHOSEN } from '../src/script/thuluth/alts';
import { thuluth, thuluthScript, DEFAULT_THULUTH, ROUNDEL_PEN, TILE_PEN } from '../src/script/thuluth';
import type { Built, LineOptions, Thuluth } from '../src/script/thuluth/engine';
import type { ThuluthStyle } from '../src/script/thuluth/types';
import { parkMiller } from '../src/script/thuluth/rng';
import type { LayoutOptions, LetterStyle, VectorStrip } from '../src/script/types';
import { FRESH, TUNED, UNSEEN } from './helpers/char-texts';

const TEXTS = [...TUNED, ...UNSEEN, ...FRESH].map(t => t[1]);
/** The texts whole, and the longer ones cut into lines of one, two and three words. */
const LINES: string[] = (() => {
  const out = new Set<string>(TEXTS);
  TEXTS.forEach((t, ti) => {
    const ws = t.split(' ');
    if (ws.length < 3) return;
    for (let i = 0, k = 0; i < ws.length; k++) {
      const n = 1 + ((ti + k) % 3);
      out.add(ws.slice(i, i + n).join(' '));
      i += n;
    }
  });
  return [...out];
})();
/** The same line with the options a caller sets: a kashida, a stretched tail, a long final. */
const OPTIONS: LineOptions[] = [{}, { kashida: 1.2 }, { tail: { sx: 1.6, sy: 1.3 } }, { kashida: 0.6, sag: 0.5 }];
const CASES: [string, LineOptions][] = LINES.flatMap((l, i) =>
  i % 4 === 0 ? OPTIONS.map(o => [l, o] as [string, LineOptions]) : [[l, {}] as [string, LineOptions]],
);

function shuffled<T>(xs: readonly T[], seed: number): T[] {
  const r = parkMiller(seed),
    out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
/** Everything a line is drawn from, exactly. */
const exact = (b: Built) => ({
  strokes: b.strokes.map(s => [s.ang, s.nib ?? null, s.s.map(q => [q.x, q.y, q.w, q.rot ?? 0])]),
  dots: b.dots,
  placed: b.placed.map(p =>
    'g' in p ? [p.c, p.form, p.ox, p.oy] : 'kash' in p ? [p.ox, p.oy, p.len] : [p.from, p.to],
  ),
});
const keyOf = ([l, o]: [string, LineOptions]) => l + JSON.stringify(o);
function written(th: Thuluth, cases: readonly [string, LineOptions][]) {
  const out = new Map<string, ReturnType<typeof exact>>();
  for (const c of cases) out.set(keyOf(c), exact(th.buildStrokes(c[0], c[1])));
  return out;
}
/** The lines that differ between two writings, and the furthest any sample or dot moved. */
function differing(a: ReturnType<typeof written>, b: ReturnType<typeof written>) {
  let worst = 0;
  const lines: string[] = [];
  for (const [k, va] of a) {
    const vb = b.get(k)!;
    if (JSON.stringify(va) === JSON.stringify(vb)) continue;
    lines.push(k);
    va.strokes.forEach((s, si) =>
      (s[2] as number[][]).forEach((q, qi) => {
        const r = (vb.strokes[si]?.[2] as number[][] | undefined)?.[qi];
        worst = Math.max(worst, r ? Math.abs(q[0] - r[0]) : Infinity, r ? Math.abs(q[1] - r[1]) : Infinity);
      }),
    );
  }
  return { lines, worst };
}

const SPACED: ThuluthStyle = { ...ROUNDEL_PEN, alts: CHOSEN, pieceGap: 0.45, wordSpace: 1.4 };
const STYLES: [string, ThuluthStyle][] = [
  ['the roundel pen with the chosen letters and ink spacing', SPACED],
  ['the tile pen with ink spacing', { ...TILE_PEN, pieceGap: 0.45, wordSpace: 1.5 }],
  ['the roundel pen with word spacing alone', { ...ROUNDEL_PEN, wordSpace: 1.4 }],
  ['the roundel pen, spacing off', ROUNDEL_PEN],
  ['the roundel pen with the chosen letters, spacing off', { ...ROUNDEL_PEN, alts: CHOSEN }],
  ['the line pen, spacing off', DEFAULT_THULUTH],
  ['the tile pen, spacing off', TILE_PEN],
];

describe('a thuluth engine writes a line the same whatever it wrote before', () => {
  it('has enough lines to tell', () => {
    expect(LINES.length).toBeGreaterThanOrEqual(30);
  });
  for (const [name, style] of STYLES) {
    it(name, () => {
      // (each line by an engine of its own is the truth)
      const alone = new Map(CASES.map(c => [keyOf(c), exact(thuluth(style).buildStrokes(c[0], c[1]))]));
      const inOrder = written(thuluth(style), CASES),
        mixed = written(thuluth(style), shuffled(CASES, 20261115)),
        // (and a line written twice by one engine, the second time from what it kept)
        twice = thuluth(style),
        again = (written(twice, CASES), written(twice, shuffled(CASES, 7)));
      expect(differing(inOrder, alone), 'in order, against alone').toEqual({ lines: [], worst: 0 });
      expect(differing(mixed, alone), 'shuffled, against alone').toEqual({ lines: [], worst: 0 });
      expect(differing(again, alone), 'written again, against alone').toEqual({ lines: [], worst: 0 });
    });
  }

  it('and so does the strip adapter (prepareLines, layout)', () => {
    for (const style of [SPACED, ROUNDEL_PEN]) {
      const texts = shuffled(TEXTS, 3).slice(0, 12),
        strip = (script: ReturnType<typeof thuluthScript>, t: string, slack: number) => {
          const [P] = script.prepareLines([t], { marks: 'all' } as LetterStyle),
            opts = { wrap: false, rhythm: false, wordGap: 1 } as LayoutOptions,
            out: unknown[] = [P];
          for (const mode of ['words', 'breaks'] as const) {
            const segs = script.segments(P, mode, 1),
              natural = script.layout(segs, P, null, opts) as VectorStrip;
            out.push(segs, natural, script.layout(segs, P, natural.W + slack, opts));
          }
          return JSON.stringify(out);
        };
      const alone = texts.map(t => strip(thuluthScript(style), t, 6)),
        shared = thuluthScript(style),
        first = texts.map(t => strip(shared, t, 6));
      // (other widths in between, then the same again, backwards)
      texts.forEach(t => strip(shared, t, 0));
      const second = [...texts].reverse().map(t => strip(shared, t, 6)).reverse(); // prettier-ignore
      expect(first).toEqual(alone);
      expect(second).toEqual(alone);
    }
  });
});
