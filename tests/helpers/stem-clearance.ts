// The room round the tall stems, measured on the ink: each letter's quads (a stroke runs through a whole joined group,
// so its quads are given to the letter that drew the sample they start from), and for each stem its upper part (the
// shaft above the bodies and the head) against every other letter's ink.
import type { Built, Thuluth } from '../../src/script/thuluth';
import { isLetter } from '../../src/script/thuluth';
import type { Quad } from '../../src/script/thuluth/roundel/checks';
import { inkGap } from '../../src/script/thuluth/roundel/checks';
import { STEM_LETTERS } from '../../src/script/thuluth/shape';

export interface Piece {
  b: Pick<Built, 'strokes' | 'placed'>;
  dx?: number;
  dy?: number;
}
export interface LetterInk {
  /** Piece, word and letter; the letter itself ('' for a sign: the name's shadda). */
  piece: number;
  wi: number;
  li: number;
  c: string;
  /** Its baseline and its top, on the page. */
  base: number;
  top: number;
  quads: Quad[];
}

/** Every letter's ink in a set of pieces (one line is one piece; a roundel has one per group). Joins and kashidas
 *  belong to no letter and are left out; signs the engine adds are gathered as one entry per piece with c = ''. */
export function letterInks(th: Thuluth, pieces: readonly Piece[]): LetterInk[] {
  const out: LetterInk[] = [];
  pieces.forEach((pc, piece) => {
    const dx = pc.dx ?? 0,
      dy = pc.dy ?? 0,
      by = new Map<string, LetterInk>(),
      of = (wi: number, li: number, c: string, base: number) => {
        const k = wi + ':' + li;
        let e = by.get(k);
        if (!e) {
          e = { piece, wi, li, c, base, top: -Infinity, quads: [] };
          by.set(k, e);
          out.push(e);
        }
        return e;
      },
      letters = pc.b.placed.filter(isLetter);
    for (const s of pc.b.strokes) {
      const polys = th.strokePolys(s);
      let i = 0;
      for (const q of polys) {
        const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4,
          cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4,
          at = (k: number) => Math.hypot((s.s[k].x + s.s[k + 1].x) / 2 - cx, (s.s[k].y + s.s[k + 1].y) / 2 - cy);
        while (i + 2 < s.s.length && at(i) > 1e-6) i++;
        const li = s.own ? s.own[i] : -2;
        if (li === -1) continue;
        const p = li >= 0 ? letters.find(l => l.li === li && (s.wi == null || s.wi < 0 || l.wi === s.wi)) : undefined,
          e = p ? of(p.wi, p.li, p.c, (p.oy || 0) + dy) : of(-1, -2, '', dy),
          P = q.map(([x, y]) => [x + dx, y + dy] as [number, number]),
          xs = P.map(v => v[0]),
          ys = P.map(v => v[1]);
        e.quads.push({ p: P, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
        e.top = Math.max(e.top, ...ys);
      }
    }
  });
  return out;
}

export interface StemRoom {
  stem: LetterInk;
  /** The nearest other letter to the stem's upper part (above `from` over its baseline), and the gap (pen units). */
  other: LetterInk | null;
  gap: number;
  /** The same for the head alone (the top `headDepth` of the stem). */
  headOther: LetterInk | null;
  headGap: number;
}
/** The room round each tall stem's upper part: the nearest ink of any other letter. */
export function stemRoom(inks: readonly LetterInk[], from = 3.4, headDepth = 3): StemRoom[] {
  return inks
    .filter(e => STEM_LETTERS.has(e.c) && e.top - e.base > 6)
    .map(stem => {
      const upper = stem.quads.filter(q => q.y0 > stem.base + from),
        head = stem.quads.filter(q => q.y0 > stem.top - headDepth);
      let other: LetterInk | null = null,
        gap = Infinity,
        headOther: LetterInk | null = null,
        headGap = Infinity;
      for (const e of inks) {
        if (e === stem) continue;
        // (a box test first: most letters are far away)
        const x0 = Math.min(...e.quads.map(q => q.x0)),
          x1 = Math.max(...e.quads.map(q => q.x1)),
          sx0 = Math.min(...upper.map(q => q.x0)),
          sx1 = Math.max(...upper.map(q => q.x1));
        if (x0 - sx1 > Math.min(gap, 6) || sx0 - x1 > Math.min(gap, 6)) continue;
        const d = inkGap(upper, e.quads);
        if (d < gap) {
          gap = d;
          other = e;
        }
        const h = inkGap(head, e.quads);
        if (h < headGap) {
          headGap = h;
          headOther = e;
        }
      }
      return { stem, other, gap, headOther, headGap };
    });
}
