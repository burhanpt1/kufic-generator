// Ink spacing on a line (ThuluthStyle.pieceGap, wordSpace; src/script/thuluth/spacing.ts): unset, nothing moves and
// nothing is written into a composition; set, the pieces of a word stand the clearance asked apart by their ink, in
// the line engine and in the strips the composition engine sets (borders, rings, line fills), words keep the word
// space, no two inks meet, no vowel is lost, and a text that fitted still fits whole.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Placed, PlacedItem } from '../src/compose/placed';
import type { Composition, Style } from '../src/model/schema';
import { isValidComposition, parseComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { PEN_PRESETS, scriptFor, thuluthStyleOf } from '../src/script/registry';
import { thuluth } from '../src/script/thuluth';
import type { ThuluthSegment } from '../src/script/thuluth/adapter';
import { thuluthScript } from '../src/script/thuluth/adapter';
import { inkGap } from '../src/script/thuluth/roundel/checks';
import { parseVowels, splitGroups, STEM_LETTERS } from '../src/script/thuluth/shape';
import { STEM_SPACE } from '../src/script/thuluth/spacing';
import type { LayoutOptions, Segments, VectorStrip } from '../src/script/types';
import { lineGaps, pieceInks, SPACING_WORDS, stripInks } from './helpers/line-spacing';
import { THULUTH_CASES } from './helpers/thuluth-cases';

const PENS = ['line', 'band', 'roundel'] as const,
  PIECE = 0.45,
  WORD = 2.2,
  /** How far a gap may pass the clearance asked: the measure takes heights in bands 0.1 high and counts two bands a
   *  band nearer than they are, so it errs by about that, always on the side of more space. */
  OVER = 0.15,
  /** And how far under: none, but for rounding. */
  UNDER = 0.01,
  letter = DEFAULT_STYLE.letter,
  vowelled = { ...letter, marks: 'all' as const },
  lay: LayoutOptions = { wrap: false, rhythm: true, wordGap: 2, terminals: 'none' },
  strips = (p: Placed) => p.items.filter((i): i is Extract<PlacedItem, { type: 'strip' }> => i.type === 'strip'),
  /** The composition with the spacing on every thuluth pen it names (its style's, and any region's own). */
  spaced = (c: Composition): Composition => {
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

describe('ink spacing, unset', () => {
  it('leaves a pen the style it was, and a composition as it was written', () => {
    for (const pen of PENS) {
      expect(Object.keys(thuluthStyleOf({ preset: pen }))).not.toContain('pieceGap');
      expect(Object.keys(thuluthStyleOf({ preset: pen }))).not.toContain('wordSpace');
      expect(scriptFor({ script: 'thuluth', pen: { preset: pen } })).toBe(scriptFor({ script: 'thuluth', pen: { preset: pen, pieceGap: undefined } })); // prettier-ignore
    }
    for (const c of Object.values(THULUTH_CASES)) expect(JSON.stringify(parseComposition(structuredClone(c)))).not.toMatch(/pieceGap|wordSpace/); // prettier-ignore
    expect(thuluthStyleOf({ preset: 'band', pieceGap: 0.5, wordSpace: 2 })).toMatchObject({
      pieceGap: 0.5,
      wordSpace: 2,
    });
  });
  it('is bounded in a composition', () => {
    const pen = (o: object) => ({ ...THULUTH_CASES['circle-names'], style: { ...THULUTH_CASES['circle-names'].style, pen: { preset: 'band', ...o } } }); // prettier-ignore
    for (const ok of [{ pieceGap: 0 }, { pieceGap: 3 }, { wordSpace: 0 }, { wordSpace: 6 }, { pieceGap: 0.45, wordSpace: 2.2 }]) expect(isValidComposition(pen(ok)), JSON.stringify(ok)).toBe(true); // prettier-ignore
    for (const bad of [{ pieceGap: -0.1 }, { pieceGap: 3.1 }, { wordSpace: -1 }, { wordSpace: 6.1 }, { pieceGap: '1' }, { wordSpace: NaN }]) expect(isValidComposition(pen(bad)), JSON.stringify(bad)).toBe(false); // prettier-ignore
    const kept = parseComposition(pen({ pieceGap: 0.45, wordSpace: 2.2 }));
    expect(kept.style.pen).toEqual({ preset: 'band', pieceGap: 0.45, wordSpace: 2.2 });
  });
  it('sets a line as it always did', () => {
    const a = thuluth(PEN_PRESETS.band),
      b = thuluth({ ...PEN_PRESETS.band, pieceGap: undefined, wordSpace: undefined });
    for (const t of SPACING_WORDS) expect(JSON.stringify(b.buildStrokes(parseVowels(t).bare)), t).toBe(JSON.stringify(a.buildStrokes(parseVowels(t).bare))); // prettier-ignore
  });
});

describe('ink spacing on a line (the line engine)', () => {
  for (const pen of PENS)
    it(`sets the pieces of a word the clearance apart, and the words the word space, at the ${pen} pen`, () => {
      const th = thuluth({ ...PEN_PRESETS[pen], pieceGap: PIECE, wordSpace: WORD }),
        nib = th.style.nib,
        cIn = PIECE * nib,
        cWord = WORD * nib,
        held: string[] = [];
      for (const t of SPACING_WORDS) {
        const b = th.buildStrokes(parseVowels(t).bare),
          ps = pieceInks(th, b),
          ink = (i: number) => [...ps[i].quads, ...ps[i].dots];
        // no two pieces nearer than what was asked of them (so no two inks meet), dots counted
        for (let i = 0; i < ps.length; i++)
          for (let j = i + 1; j < Math.min(ps.length, i + 4); j++)
            expect(inkGap(ink(i), ink(j)), `${t}: ${ps[i].s} and ${ps[j].s}`).toBeGreaterThanOrEqual((ps[i].wi === ps[j].wi ? cIn : cWord) - UNDER); // prettier-ignore
        // each piece as near the one before it as asked (twice that between two stems), unless an earlier piece of
        // its word holds it off
        for (let j = 1; j < ps.length; j++) {
          if (ps[j].wi !== ps[j - 1].wi) continue;
          const stems = STEM_LETTERS.has([...ps[j - 1].s].pop()!) && STEM_LETTERS.has([...ps[j].s][0]),
            want = stems ? cIn * STEM_SPACE : cIn,
            gap = inkGap(ink(j - 1), ink(j));
          expect(gap, `${t}: ${ps[j - 1].s}→${ps[j].s}`).toBeGreaterThanOrEqual(want - UNDER);
          if (gap <= want + OVER) continue;
          const by = ps.findIndex((p, i) => i < j - 1 && p.wi === ps[j].wi && inkGap(ink(i), ink(j)) <= cIn + OVER);
          expect(by, `${t}: ${ps[j - 1].s}→${ps[j].s} stands ${gap.toFixed(2)} off, and nothing holds it`).toBeGreaterThanOrEqual(0); // prettier-ignore
          held.push(`${t}: ${ps[j].s} by ${ps[by].s}`);
        }
        // and each word the word space from the one before it
        for (const g of lineGaps(th, b).filter(g => g.kind === 'word')) {
          expect(g.dotGap, `${t}: ${g.a} ‖ ${g.b}`).toBeGreaterThanOrEqual(cWord - UNDER);
          expect(g.dotGap, `${t}: ${g.a} ‖ ${g.b}`).toBeLessThanOrEqual(cWord + OVER);
        }
      }
      // the one exception in the list: the lam of وآل, which the waw's tail (two pieces back) holds off its alif
      // (at the line pen; at the heavier pens the room its alif asks as a stem is the greater)
      expect(held.filter(h => h !== 'وآل: ل by و')).toEqual([]);
    });
  it('brings the pieces of a word nearer than the words stand, where today they are further', () => {
    for (const pen of ['band'] as const) {
      const off = thuluth(PEN_PRESETS[pen]),
        on = thuluth({ ...PEN_PRESETS[pen], pieceGap: PIECE, wordSpace: WORD }),
        t = 'لا إله إلا الله محمد رسول الله',
        of = (th: typeof off, kind: string) => lineGaps(th, th.buildStrokes(parseVowels(t).bare)).filter(g => g.kind === kind).map(g => g.gap); // prettier-ignore
      expect(Math.max(...of(off, 'inside')), pen).toBeGreaterThan(Math.min(...of(off, 'word')));
      expect(Math.max(...of(on, 'inside')) * 2, pen).toBeLessThan(Math.min(...of(on, 'word')));
    }
  });
});

describe('ink spacing in strips (borders, rings and line fills)', () => {
  const TEXTS = ['لا إله إلا الله محمد رسول الله', 'بسم الله الرحمن الرحيم', 'رب العالمين', 'وآل محمد وزهراء'];
  /** A strip's pieces with the word each belongs to, and the gaps asked of them checked. */
  const check = (st: VectorStrip, text: string, cIn: number, cWord: number, natural: boolean, what: string) => {
    const { letters } = stripInks(st),
      groups = splitGroups(parseVowels(text).bare);
    expect(letters.length, what).toBe(groups.length);
    for (let i = 0; i < letters.length; i++)
      for (let j = i + 1; j < Math.min(letters.length, i + 4); j++) {
        const same = groups[i].word === groups[j].word,
          gap = inkGap(letters[i], letters[j]);
        // (the outlines are the pen's quads joined and smoothed: a few hundredths either way)
        expect(gap, `${what}: ${groups[i].s} and ${groups[j].s}`).toBeGreaterThanOrEqual((same ? cIn : cWord) - 0.1);
        if (same && j === i + 1 && gap > cIn * STEM_SPACE + OVER + 0.1) expect(groups[j].s, `${what}: ${groups[i].s}→${groups[j].s} ${gap.toFixed(2)}`).toBe('ل'); // prettier-ignore
      }
    if (natural)
      for (let i = 1; i < letters.length; i++)
        if (groups[i].word !== groups[i - 1].word) {
          const A = letters.filter((_, k) => groups[k].word === groups[i - 1].word).flat(),
            B = letters.filter((_, k) => groups[k].word === groups[i].word).flat();
          // (a strip is a whole number of cells long: what that leaves, under a cell, goes to the word gaps)
          expect(inkGap(A, B), `${what}: before ${groups[i].s}`).toBeLessThanOrEqual(cWord + OVER + 0.1 + 1);
        }
    const xs = letters.flat().flatMap(q => [q.x0, q.x1]);
    expect(Math.min(...xs), what).toBeGreaterThanOrEqual(-0.01);
    expect(Math.max(...xs), what).toBeLessThanOrEqual(st.W + 0.01);
  };
  it('sets whole words and pieces alike by their ink, at the natural width and justified', () => {
    for (const pen of ['band', 'roundel'] as const) {
      const style = { ...PEN_PRESETS[pen], pieceGap: PIECE, wordSpace: WORD },
        eng = thuluthScript(style),
        cIn = PIECE * style.nib,
        cWord = WORD * style.nib;
      for (const t of TEXTS)
        for (const mode of ['words', 'breaks'] as const) {
          const p = eng.prepare(eng.shape(t, letter), letter),
            segs = eng.segments(p, mode, 2),
            nat = eng.layout(segs, p, null, lay) as VectorStrip;
          check(nat, t, cIn, cWord, true, `${pen} ${mode} ${t}`);
          for (const more of [17]) {
            const st = eng.layout(segs, p, nat.W + more, lay) as VectorStrip;
            expect(st.W).toBe(nat.W + more);
            check(st, t, cIn, cWord, false, `${pen} ${mode} +${more} ${t}`);
          }
          // round a ring too
          const ring = eng.layout(segs, p, nat.W + 9, { ...lay, wrap: true }) as VectorStrip;
          check(ring, t, cIn, cWord, false, `${pen} ${mode} ring ${t}`);
        }
    }
  });
  it('never sets a line longer than the solvers count it (so a text that fits is set whole)', () => {
    // (the second: clearances wider than the 1 the solvers count for a break inside a word)
    for (const [piece, word] of [
      [PIECE, WORD],
      [1.4, 4],
      [PIECE, undefined],
      [undefined, WORD],
    ] as const)
      // prettier-ignore
      for (const pen of ['roundel'] as const) {
        const eng = thuluthScript({ ...PEN_PRESETS[pen], ...(piece == null ? {} : { pieceGap: piece }), ...(word == null ? {} : { wordSpace: word }) }); // prettier-ignore
        for (const t of [...TEXTS, 'ودار ورد وآل داود'])
          for (const mode of ['words', 'breaks'] as const)
            for (const wordGap of [1]) {
              const p = eng.prepare(eng.shape(t, letter), letter),
                segs = eng.segments(p, mode, wordGap) as Segments<ThuluthSegment>,
                counted = segs.reduce((a, s, i) => a + s.minW + (i < segs.length - 1 ? (s.endsWord ? segs.wg! : 1) : 0), 0),
                what = `${pen} ${piece}/${word} ${mode} ${wordGap} ${t}`;
              for (const s of segs) expect(s.minW, what).toBeGreaterThanOrEqual(s.w);
              const st = eng.layout(segs, p, Math.ceil(counted), { ...lay, wordGap }) as VectorStrip | null;
              expect(st, what).not.toBeNull();
              expect((eng.layout(segs, p, null, { ...lay, wordGap }) as VectorStrip).W, what).toBeLessThanOrEqual(Math.ceil(counted)); // prettier-ignore
              // any run of the pieces, as a solver may give a side of a ring
              for (let a = 0; a < segs.length; a++) {
                const run = segs.slice(a, a + 3) as Segments<ThuluthSegment>,
                  len = run.reduce((x, s, i) => x + s.minW + (i < run.length - 1 ? (s.endsWord ? segs.wg! : 1) : 0), 0);
                expect(eng.layout(run, p, Math.ceil(len), { ...lay, wordGap }), `${what} from ${a}`).not.toBeNull();
              }
            }
      }
  });
  it('keeps every vowel, and none on another piece', () => {
    const off = thuluthScript(PEN_PRESETS.band),
      on = thuluthScript({ ...PEN_PRESETS.band, pieceGap: PIECE, wordSpace: WORD });
    for (const t of ['بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ', 'لَا إِلَهَ إِلَّا اللَّهُ مُحَمَّدٌ رَسُولُ اللَّهِ'])
      for (const mode of ['words', 'breaks'] as const) {
        const strip = (eng: typeof off, m: 'words' | 'breaks') => {
          const p = eng.prepare(eng.shape(t, vowelled), vowelled);
          return eng.layout(eng.segments(p, m, 2), p, null, lay) as VectorStrip;
        };
        // as many as the pieces have when each is set alone (the vowels stand where they did round each piece)
        const st = strip(on, mode),
          { letters, vowels } = stripInks(st);
        expect(vowels.length, `${mode} ${t}`).toBe(stripInks(strip(off, 'breaks')).vowels.length);
        // each piece's vowels come after it in the strip: none touches the ink of another piece
        let piece = -1;
        for (const path of st.paths) {
          if (path.role === 'letter') piece++;
          if (path.role !== 'vowel') continue;
          const own = stripInks({ ...st, paths: [path] }).vowels;
          letters.forEach((L, k) => {
            if (k !== piece) expect(inkGap(own, L), `${mode} ${t}: vowels of piece ${piece} and piece ${k}`).toBeGreaterThan(0.2); // prettier-ignore
          });
        }
      }
  });
});

describe('ink spacing in compositions', () => {
  it('resolves the four golden compositions with the whole text and no warning', () => {
    for (const [id, c] of Object.entries(THULUTH_CASES)) {
      const p = resolve(spaced(c));
      expect(p.meta.warnings, id).toEqual([]);
      for (const b of p.meta.borders)
        for (const r of b.rings) expect(Number.isInteger(r.rep) && r.rep >= 1, id).toBe(true);
      for (const s of strips(p).filter(s => s.strip.kind === 'vector')) {
        const st = s.strip as VectorStrip,
          pts = stripInks(st).letters.flat();
        expect(Math.min(...pts.map(q => q.y0)), id).toBeGreaterThanOrEqual(-0.01);
        expect(Math.max(...pts.map(q => q.y1)), id).toBeLessThanOrEqual(st.Hb + 0.01);
        expect(Math.min(...pts.map(q => q.x0)), id).toBeGreaterThanOrEqual(-0.01);
        expect(Math.max(...pts.map(q => q.x1)), id).toBeLessThanOrEqual(st.W + 0.01);
      }
    }
    // the mihrab: every piece of the verse in its lines, and of the basmala in its border, each time it is written
    const c = THULUTH_CASES['mihrab-lines'],
      p = resolve(spaced(c)),
      pieces = strips(p).reduce((a, s) => a + (s.strip.kind === 'vector' ? s.strip.paths.filter(q => q.role === 'letter').length : 0), 0), // prettier-ignore
      of = (name: string) => splitGroups(parseVowels(c.texts[name].text).bare).length;
    expect(pieces).toBe(of('ayat') + of('basmala') * p.meta.borders[0].rings[0].rep);
  });
});
