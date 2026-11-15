// The space between the pieces of a line, measured on the ink: a line's letter strokes split into its pieces (what
// the pen writes without lifting: the connected groups of each word), each as the quads the pen draws, with the
// piece's dots apart; and the gaps between them, ink edge to ink edge.
import type { Built, Thuluth } from '../../src/script/thuluth';
import { isLetter } from '../../src/script/thuluth';
import type { Quad } from '../../src/script/thuluth/roundel/checks';
import { inkGap, strokeQuads } from '../../src/script/thuluth/roundel/checks';
import type { VectorStrip } from '../../src/script/types';
import { parsePolys } from '../../src/script/vector';

export interface PieceInk {
  wi: number;
  /** The piece's letters, and the positions in the word of its first and last. */
  s: string;
  from: number;
  to: number;
  quads: Quad[];
  dots: Quad[];
}
const quadOf = (p: [number, number][]): Quad => {
  const xs = p.map(v => v[0]),
    ys = p.map(v => v[1]);
  return { p, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
/** The pieces of a built line, in reading order. The signs the engine adds (the name's shadda) belong to none. */
export function pieceInks(th: Thuluth, b: Built): PieceInk[] {
  const out: PieceInk[] = [],
    at = new Map<string, PieceInk>();
  for (const p of b.placed.filter(isLetter)) {
    let pc = out[out.length - 1];
    if (!pc || pc.wi !== p.wi || p.form === 'ini' || p.form === 'iso')
      out.push((pc = { wi: p.wi, s: '', from: p.li, to: p.li, quads: [], dots: [] }));
    pc.s += p.c;
    pc.to = p.li;
    at.set(p.wi + ':' + p.li, pc);
  }
  for (const s of b.strokes) {
    const li = s.own?.find(v => v >= 0);
    if (s.mark || li == null || s.wi == null || s.wi < 0) continue;
    at.get(s.wi + ':' + li)?.quads.push(...strokeQuads(th, [s]));
  }
  // the dots, in the order the engine sets them: a letter's groups in turn
  let k = 0;
  for (const g of b.dotGroups)
    for (let i = 0; i < g.n; i++, k++) {
      const [x, y] = b.dots[k];
      at.get(g.wi + ':' + g.li)?.dots.push(...th.dotPolysAt(x, y).map(quadOf));
    }
  return out;
}
export interface LineGap {
  kind: 'inside' | 'word';
  /** The two sides, as written. */
  a: string;
  b: string;
  wi: number;
  /** Ink edge to ink edge, letters only; and with the dots of both counted. */
  gap: number;
  dotGap: number;
}
/** The gaps of a line: between each piece and the next inside a word, and between each word and the next. */
export function lineGaps(th: Thuluth, b: Built): LineGap[] {
  const ps = pieceInks(th, b),
    out: LineGap[] = [],
    all = (p: PieceInk) => [...p.quads, ...p.dots];
  ps.forEach((p, i) => {
    const q = ps[i + 1];
    if (!q) return;
    if (q.wi === p.wi)
      out.push({ kind: 'inside', a: p.s, b: q.s, wi: p.wi, gap: inkGap(p.quads, q.quads), dotGap: inkGap(all(p), all(q)) }); // prettier-ignore
    else {
      const A = ps.filter(x => x.wi === p.wi),
        B = ps.filter(x => x.wi === q.wi);
      out.push({ kind: 'word', a: A.map(x => x.s).join(''), b: B.map(x => x.s).join(''), wi: p.wi, gap: inkGap(A.flatMap(x => x.quads), B.flatMap(x => x.quads)), dotGap: inkGap(A.flatMap(all), B.flatMap(all)) }); // prettier-ignore
    }
  });
  return out;
}
/** The least gap between any two pieces of a line that are not neighbours (0: they touch), dots counted. */
export function farGap(th: Thuluth, b: Built): number {
  const ps = pieceInks(th, b);
  let d = Infinity;
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 2; j < ps.length; j++) {
      // (far apart on the line: no need to look)
      if (Math.min(...ps[i].quads.map(q => q.x0)) - Math.max(...ps[j].quads.map(q => q.x1)) > 4) break;
      d = Math.min(d, inkGap([...ps[i].quads, ...ps[i].dots], [...ps[j].quads, ...ps[j].dots]));
    }
  return d;
}
/** A strip's ink by path: the outlines of each piece (role 'letter', in the order the pieces were set) and the
 *  vowels' quads (role 'vowel'), as polygons with their boxes. */
export function stripInks(st: VectorStrip): { letters: Quad[][]; vowels: Quad[] } {
  const of = (role: string) => st.paths.filter(p => p.role === role).map(p => parsePolys(p.d).map(q => quadOf(q as [number, number][]))); // prettier-ignore
  return { letters: of('letter'), vowels: of('vowel').flat() };
}
/** The vowels of a strip against its letters: how many of the vowels' quads there are, how many of them lie on a
 *  letter's ink, and the least space between a vowel and a letter. */
export function stripMarks(st: VectorStrip): { quads: number; onInk: number; clear: number } {
  const { letters, vowels } = stripInks(st),
    ink = letters.flat();
  let onInk = 0,
    clear = Infinity;
  for (const v of vowels) {
    const d = inkGap([v], ink);
    if (d === 0) onInk++;
    clear = Math.min(clear, d);
  }
  return { quads: vowels.length, onInk, clear };
}
export const SPACING_WORDS =['الرحمن', 'الرحيم', 'رسول', 'وآل', 'الصراط', 'أحد', 'الدين', 'يوم', 'إياك', 'مالك', 'نور', 'دار', 'ورد', 'زهراء', 'رب العالمين', 'لا إله إلا الله محمد رسول الله', 'بسم الله الرحمن الرحيم']; // prettier-ignore
