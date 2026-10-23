// Checks made exact by stroke ownership (roundel/checks.ts): space within a word, marks over another word, misplaced
// dots, ink drawn twice. Reported, not scored.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { buildRoundel, roundelChecks } from '../src/script/thuluth/roundel';

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
