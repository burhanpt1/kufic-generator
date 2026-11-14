// Checks made exact by stroke ownership (roundel/checks.ts): space within a word, marks over another word, misplaced
// dots, ink drawn twice. Reported, not scored.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { buildRoundel, composeRoundel, crossings, linePairs, roundelChecks, wordGaps } from '../src/script/thuluth/roundel'; // prettier-ignore

const th = thuluth(ROUNDEL_PEN),
  build = () => buildRoundel(th, { text: 'حَسَن رَسُول عَلِيّ', compose: { elongate: true, cross: true, kern: true, tries: 1, iters: 1500, seed: 5 } })!; // prettier-ignore

describe('roundel checks', () => {
  const { r, f } = build(),
    base = roundelChecks(th, r, f);
  it('find a composed roundel clean, or nearly', () => {
    expect(base.wordSpace).toBeLessThan(2);
    expect(base.strayMarks + base.strayDots).toBeLessThanOrEqual(1);
    expect(base.doubled).toBeLessThan(1);
  });
  it('see a word pulled apart', () => {
    const b = build(),
      i = b.r.groups.findIndex((g, k) => k > 0 && g.word === b.r.groups[k - 1].word && !g.newWord);
    expect(i).toBeGreaterThan(0);
    b.r.st[i] = { x: b.r.st[i].x - 6, y: b.r.st[i].y };
    expect(roundelChecks(th, b.r, b.f).wordSpace).toBeGreaterThan(base.wordSpace + 2);
  });
  it('see a vowel set over another word, and a dot group under another letter', () => {
    const b = build(),
      items = b.f.solved!.items,
      mark = items.find(it => it.kind === 'mark')!,
      dots = items.find(it => it.kind === 'dots')!,
      [g] = mark.key!.split(':').map(Number),
      other = b.r.groups.findIndex(q => q.word !== b.r.groups[g].word),
      far = b.r.st[other],
      S = b.r.shapes[other];
    Object.assign(mark, { x: far.x + (S.x0 + S.x1) / 2, y: far.y + S.y1 + 0.5 });
    Object.assign(dots, { x: far.x + (S.x0 + S.x1) / 2, y: far.y + S.y0 - 0.5 });
    const c = roundelChecks(th, b.r, b.f);
    expect(c.strayMarks).toBeGreaterThanOrEqual(1);
    expect(c.strayDots).toBeGreaterThanOrEqual(1);
  });
  it('see two letters drawn along the same course', () => {
    const b = build(),
      s = b.r.shapes[0].b.strokes.find(q => !q.mark)!,
      [d0, d1] = [b.r.st[0], b.r.st[1]];
    // the first group's stroke laid again as the second group's, on the same ink
    b.r.shapes[1].b.strokes.push({ ...s, s: s.s.map(q => ({ ...q, x: q.x + d0.x - d1.x, y: q.y + d0.y - d1.y })), own: s.own?.slice() }); // prettier-ignore
    expect(roundelChecks(th, b.r, b.f).doubled).toBeGreaterThan(3);
  });
});

describe('the space between words on a line', () => {
  // an alif, then a word of teeth, set by hand: on one baseline, on two, and run together
  const at = (wp: { x: number; y: number }[]) => composeRoundel(th, 'ا ببب', { fixed: { lv: [0, 0], wp }, tries: 1 })[0],
    nib = th.style.nib; // prettier-ignore
  it('is the gap between their inks, edge to edge', () => {
    const near = wordGaps(th, at([{ x: 0, y: 0 }, { x: -6, y: 0 }])), // prettier-ignore
      far = wordGaps(th, at([{ x: 0, y: 0 }, { x: -8, y: 0 }])); // prettier-ignore
    expect(near.wordPairs).toBe(1);
    expect(near.wordClear).toBeGreaterThan(0);
    // moved 2 pen units further off along the line, the gap is at most 2 wider, and nearly that
    expect(far.wordClear! - near.wordClear!).toBeGreaterThan(1.2);
    expect(far.wordClear! - near.wordClear!).toBeLessThanOrEqual(2 + 1e-9);
    expect(far.wordClearNibs).toBeCloseTo(far.wordClear! / nib, 12);
    expect(far.wordsRunOn).toBe(0);
  });
  it('is nothing when they touch, and they run on', () => {
    const g = wordGaps(th, at([{ x: 0, y: 0 }, { x: 2, y: 0 }])); // prettier-ignore
    expect(g.wordClear).toBe(0);
    expect(g.wordsRunOn).toBe(1);
  });
  it('is not measured between words on different lines', () => {
    const r = at([{ x: 0, y: 0 }, { x: -6, y: -12 }]); // prettier-ignore
    expect(linePairs(r, nib)).toEqual([]);
    expect(wordGaps(th, r)).toMatchObject({ wordPairs: 0, wordClear: null, wordClearNibs: null, wordsRunOn: 0 });
  });
  it('counts a pair standing closer than the pieces inside one of the words', () => {
    // دار breaks after its dal and its alif: its dal pulled away to the right opens a gap inside the word wider
    // than the one between the two words
    const r = composeRoundel(th, 'دار نور', { kern: true, fixed: { lv: [0, 0, 0, 0, 0], wp: [{ x: 0, y: 0 }, { x: -14, y: 0 }] }, tries: 1 })[0], // prettier-ignore
      whole = wordGaps(th, r);
    expect(whole.wordPairs).toBe(1);
    expect(whole.wordClear).toBeGreaterThan(0);
    r.st[0].x += whole.wordClear! + 3;
    const g = wordGaps(th, r);
    expect(g.wordClear).toBeCloseTo(whole.wordClear!, 9);
    expect(g.wordInner).toBeGreaterThan(g.wordClear!);
    expect(g.wordsRunOn).toBe(1);
  });
  it('is reported with the other checks', () => {
    const { r, f } = build(),
      c = roundelChecks(th, r, f),
      g = wordGaps(th, r);
    expect([c.wordPairs, c.wordClear, c.wordClearNibs, c.wordInner, c.wordsRunOn]).toEqual([g.wordPairs, g.wordClear, g.wordClearNibs, g.wordInner, g.wordsRunOn]); // prettier-ignore
    expect(c.wordsRunOn).toBeLessThanOrEqual(c.wordPairs);
  });
});

describe('crossings', () => {
  const th2 = thuluth(ROUNDEL_PEN),
    at = (wp: { x: number; y: number }[]) => composeRoundel(th2, 'ا ببب', { fixed: { lv: [0, 0], wp }, tries: 1 })[0];
  it('count a stem through a horizontal of another word, exactly', () => {
    const crossed = at([{ x: 0, y: 0 }, { x: 5, y: 5 }]), // prettier-ignore
      apart = at([{ x: 0, y: 0 }, { x: -8, y: 0 }]); // prettier-ignore
    expect(crossings(crossed).stemHorizontal).toBeGreaterThanOrEqual(1);
    expect(crossings(apart)).toEqual({ stemHorizontal: 0, curve: 0, eye: 0 });
  });
});
