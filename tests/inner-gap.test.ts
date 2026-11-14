// The space inside a word (RoundelOptions.innerGap): off, nothing moves; on, the pieces of a word broken by a
// non-joining letter stand that far apart, ink edge to ink edge, however each is written, and none touches another.
// And the ruled line count with wordGap: the number of lines that gives the largest letters (largestLetters).
import { describe, expect, it } from 'vitest';
import { thuluthStyleOf } from '../src/script/registry';
import { thuluth } from '../src/script/thuluth/engine';
import type { Roundel, RoundelOptions } from '../src/script/thuluth/roundel';
import { buildRoundel, composeRoundel, inkGap, largestLetters, roundelPieces, strokeQuads } from '../src/script/thuluth/roundel'; // prettier-ignore

const th = thuluth(thuluthStyleOf({ preset: 'roundel' })),
  PEN: RoundelOptions = { elongate: true, cross: true, kern: true },
  IG = 0.7,
  // common words with a non-joining letter inside
  WORDS = 'الرحمن الرحيم الله وآل الصمد أحد العالمين إله رسول نور الدين مالك يوم إياك الصراط المستقيم'.split(' '),
  /** A word alone, each piece in the given variant, as the composer lays it out; and each piece's ink. */
  laid = (word: string, lv: number[], o: RoundelOptions) => {
    const r = composeRoundel(th, word, { ...PEN, ...o, fixed: { lv, wp: [{ x: 0, y: 0 }] } })[0];
    return { r, ink: r.shapes.map((S, g) => strokeQuads(th, S.b.strokes, r.st[g].x, r.st[g].y)) };
  };

describe('the space inside a word', () => {
  it('off, the composer places every piece as before', () => {
    const o: RoundelOptions = { ...PEN, lanes: {}, tries: 1, iters: 300, seed: 11 },
      at = (x: RoundelOptions) => JSON.stringify(composeRoundel(th, 'بسم الله الرحمن الرحيم', x).map(r => [r.E, r.st, r.lv])); // prettier-ignore
    expect(at({ ...o, innerGap: 0 })).toBe(at(o));
    expect(at({ ...o, innerGap: IG })).not.toBe(at(o));
  });

  it('without it, a piece after a tailed letter stands a word’s space away (the kern stops at 4 pen units)', () => {
    const { ink } = laid('الرحمن', [2, 5, 3], {});
    // (the ha's head starts far to the right and high, the ra's tail ends far to the left and low: their boxes meet
    // long before their inks do)
    expect(inkGap(ink[1], ink[2])).toBeGreaterThan(2 * th.style.nib);
  });

  it('on, the pieces of a word stand the asked space apart, and none touches', () => {
    // Over the asked space by at most TOL, for these reasons: a dot of either piece is the nearer (dots keep half
    // the space, and the gap is measured between letters); heights are compared in bands of a tenth of a pen unit,
    // erring towards more space where the two meet at a slant. A piece keeps the space from every piece before it,
    // not only the last: the lam of وآل stands further from its alif, to clear the tail of the waw, so the space is
    // looked for at the nearest of them. (A piece that would pass the one before stops with its right edge at that
    // one's: none of these words has one.)
    const TOL = 0.35;
    let breaks = 0;
    for (const word of WORDS) {
      const P = roundelPieces(th, word, PEN)!,
        n = P.groups.length,
        plain = P.shapes.map(vs => Math.max(0, vs.findIndex(v => !v.elong && !v.stacked && !v.level && !v.cost))), // prettier-ignore
        // each piece in a spread of its variants (elongated, stacked, long-tailed), the others plain
        ways = [plain];
      P.shapes.forEach((vs, i) => {
        for (let v = 0; v < vs.length; v += Math.max(1, Math.ceil(vs.length / 5)))
          if (v !== plain[i]) ways.push(plain.map((p, k) => (k === i ? v : p)));
      });
      for (const lv of ways) {
        const { r, ink } = laid(word, lv, { innerGap: IG });
        for (let j = 1; j < n; j++) {
          // from every piece before it at least the space; from the nearest of them no more than it and TOL
          const gaps = ink.slice(0, j).map(a => inkGap(a, ink[j])),
            passed = r.st[j].x + r.shapes[j].x1 >= r.st[j - 1].x + r.shapes[j - 1].x1 - 1e-6;
          expect(Math.min(...gaps), `${word} ${j} [${lv.join(',')}]`).toBeGreaterThanOrEqual(IG - 0.02);
          if (!passed) expect(Math.min(...gaps), `${word} ${j} [${lv.join(',')}]`).toBeLessThanOrEqual(IG + TOL);
          breaks++;
        }
      }
    }
    expect(breaks).toBeGreaterThan(100);
  }, 60_000);
});

describe('ruled lines with a space between words', () => {
  it('the number of lines is the one with the largest letters, unless it costs too much', () => {
    const mk = (n: number, E: number, r: number) => ({ E, lanes: { n, gap: 1 }, disc: { r } }) as Roundel,
      lines = (rs: Roundel[]) => largestLetters(rs).map(r => r.lanes!.n);
    // two long lines in a wide disc lose to three in a smaller one; four that overflow do not win by being smaller
    expect(lines([mk(2, 53, 30.4), mk(3, 109, 24.1), mk(4, 267, 22.9), mk(3, 183, 24.2)])).toEqual([3, 3]);
    // and where the discs are alike, the energy decides
    expect(lines([mk(2, 30, 25), mk(3, 60, 24.5)])).toEqual([2]);
  });
  it('Ikhlas keeps its three lines when the gap is asked for', () => {
    const o: RoundelOptions = { ...PEN, ruled: true, tries: 4, iters: 6000 },
      build = (x: RoundelOptions) => buildRoundel(th, { text: 'قل هو الله أحد الله الصمد', compose: { ...o, ...x }, frame: {} })!.r, // prettier-ignore
      // (the radius of the circle as large as the fitted field: the letters are drawn smaller as it grows)
      size = (r: Roundel) => r.disc.r * Math.sqrt(r.disc.oval),
      off = build({}),
      on = build({ wordGap: 1.6 });
    expect(off.lanes!.n).toBe(3);
    expect(on.lanes!.n).toBe(3);
    // (it was two lines in a field of size 28.4, against 25.9 without the gap)
    expect(size(on)).toBeLessThan(size(off) * 1.05);
  }, 120_000);
});
