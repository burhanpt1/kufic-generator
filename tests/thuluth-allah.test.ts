// The name of God as one ligature (style.allah, the default): its lams keep their spacing however a line is drawn
// out, stand lower than the alif, and carry the shadda on the second lam with its top level with the alif's (the lab
// set the shadda and small alif behind the second lam's stem); its heh is small and round beside them.
import { describe, expect, it } from 'vitest';
import { isLetter, ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { roundelPieces } from '../src/script/thuluth/roundel';

const th = thuluth(ROUNDEL_PEN),
  plain = th.buildStrokes('الله', {}),
  letters = plain.placed.filter(isLetter);
const top = (ps: { y: number }[]) => Math.max(...ps.map(q => q.y));
const pts = (i: number) => letters[i].g.s.flatMap(s => s.pts.map(([x, y]) => ({ x: letters[i].ox + x, y })));

describe('the ligature of the name of God', () => {
  it('is on by default, and off with the lab’s letters', () => {
    expect(th.style.allah).toEqual({ alif: false });
    expect(thuluth({ ...ROUNDEL_PEN, labLetters: true }).style.allah).toBeUndefined();
  });

  it('keeps its lams together however the line is drawn out', () => {
    const drawn = th.buildStrokes('الله', { kashida: 6 }).placed.filter(isLetter),
      shift = drawn[1].ox - letters[1].ox;
    drawn.slice(1).forEach((p, i) => expect(p.ox).toBeCloseTo(letters[i + 1].ox + shift, 9));
  });

  it('sets the lams lower than the alif and the heh small beside them (a heh as tall as the lams read as اللم)', () => {
    const alif = top(pts(0)),
      lams = [top(pts(1)), top(pts(2))],
      heh = top(pts(3));
    for (const h of lams) expect(h).toBeLessThan(alif - 1);
    expect(heh).toBeLessThan(0.6 * lams[1]);
    expect(heh).toBeGreaterThan(0.35 * lams[1]);
  });

  it('sets the shadda on the second lam, its top level with the alif’s', () => {
    const shadda = plain.strokes[plain.strokes.length - 1].s,
      lam = pts(2),
      lamTop = lam.find(q => q.y === top(lam))!,
      // the second lam's stem as drawn (leaning), near its top
      stem = plain.strokes
        .slice(0, -1)
        .flatMap(s => s.s)
        .filter(q => q.y > lamTop.y - 2.5 && q.y < lamTop.y - 0.8 && Math.abs(q.x - letters[2].ox) < 1.5),
      sx = stem.reduce((a, q) => a + q.x, 0) / stem.length,
      cx = (Math.min(...shadda.map(q => q.x)) + Math.max(...shadda.map(q => q.x))) / 2;
    expect(stem.length).toBeGreaterThan(0);
    expect(Math.abs(cx - sx)).toBeLessThan(0.5);
    expect(Math.min(...shadda.map(q => q.y))).toBeGreaterThan(lamTop.y - 0.2);
    expect(Math.abs(top(shadda) - top(pts(0)))).toBeLessThan(0.6);
  });

  it('adds the small alif over the heh only when asked', () => {
    const withAlif = thuluth({ ...ROUNDEL_PEN, allah: { alif: true } }).buildStrokes('الله', {});
    expect(withAlif.strokes.length).toBe(plain.strokes.length + 1);
  });

  it('sets its own shadda in a vowelled text, keeping only the heh’s marks', () => {
    const p = roundelPieces(th, 'بِسْمِ اللَّهِ', {})!,
      g = p.groups.find(q => q.allah)!;
    expect(g.marks!.map(m => m.k)).toEqual([2]);
  });
});
