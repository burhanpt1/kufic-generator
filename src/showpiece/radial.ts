// Text along rays from a centre, reading outward (the start of the text nearest the centre): a rosette of spokes,
// or light streaming from the lamp's glass written in words. Experimental (Light upon light).
import type { PlacedItem } from '../compose/placed';
import { layoutOpts } from '../compose/resolve';
import { inside } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import type { Style } from '../model/schema';
import type { CellStrip, ScriptEngine } from '../script/types';

const inkMid = (st: CellStrip) => {
  let lo = st.Hb,
    hi = -1;
  for (let y = 0; y < st.Hb; y++)
    for (let x = 0; x < st.W; x++)
      if (st.data[y * st.W + x]) {
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
        break;
      }
  return { mid: (lo + hi + 1) / 2, ink: hi - lo + 1 };
};

export class Writer {
  private cache = new Map<string, CellStrip | null>();
  constructor(
    private script: ScriptEngine,
    private style: Style,
    private ascenders: 7 | 9 | 11 = 7,
  ) {}
  strip(text: string): CellStrip | null {
    if (!this.cache.has(text)) {
      const lt = { ...this.style.letter, ascenders: this.ascenders },
        p = this.script.prepareLines([text], lt)[0],
        segs = this.script.segments(p, 'words', 2);
      this.cache.set(
        text,
        this.script.layout(segs, p, null, { ...layoutOpts(this.style, 2), wrap: false }) as CellStrip | null,
      );
    }
    return this.cache.get(text)!;
  }
  /** A strip on the ray from c at angle a, its first letter at radius r0, centred on the ray. */
  place(st: CellStrip, c: Pt, a: number, r0: number, s: number, sid: number, ring: number): PlacedItem {
    const u: Pt = [Math.cos(a), Math.sin(a)],
      t: Pt = [-u[0], -u[1]],
      n: Pt = [t[1], -t[0]],
      { mid } = inkMid(st),
      r = r0 + st.W * s,
      O: Pt = [c[0] + u[0] * r - n[0] * mid * s, c[1] + u[1] * r - n[1] * mid * s];
    return { type: 'strip', style: sid, strip: st, place: { type: 'line', O, t, n, s }, ring };
  }
  ink(st: CellStrip) {
    return inkMid(st).ink;
  }
}

/** A rosette: the text once along each of N spokes, reading outward, filling the circle of radius R about c. Returns
 *  the strips and the radius of the clear centre. */
export function rosette(w: Writer, text: string, c: Pt, R: number, N: number, sid: number, ring: number) {
  const st = w.strip(text)!,
    // spokes clear of each other at the centre: band height fits the chord between neighbours
    k = (st.Hb * 1.1) / (2 * Math.sin(Math.PI / N)),
    s = R / (st.W + k),
    r0 = k * s,
    items: PlacedItem[] = [];
  for (let i = 0; i < N; i++) items.push(w.place(st, c, -Math.PI / 2 + (i * 2 * Math.PI) / N, r0, s, sid, ring));
  return { items, r0, s };
}

/** Distance along the ray from c at angle a at which `pred` first turns false (from r = from), up to rMax. */
function exitAt(c: Pt, a: number, from: number, rMax: number, pred: (p: Pt) => boolean): number {
  const at = (r: number): Pt => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
  let r = from;
  const step = (rMax - from) / 400;
  while (r < rMax && pred(at(r))) r += step;
  let lo = Math.max(from, r - step),
    hi = r;
  for (let k = 0; k < 20; k++) {
    const m = (lo + hi) / 2;
    if (pred(at(m))) lo = m;
    else hi = m;
  }
  return lo;
}

/** Light rays written in words: N rays from c, each from where it leaves `from` (the lamp) to where it leaves `within`
 *  (the niche), carrying words of `words` in turn (cycled), in brightness bands (sids, brightest first). */
export function writtenRays(
  w: Writer,
  words: string[],
  c: Pt,
  from: Pt[],
  within: Pt[],
  N: number,
  s: number,
  sids: number[],
  ring: number,
  rMax: number,
) {
  const items: PlacedItem[] = [];
  let wi = 0;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / N,
      r0 = exitAt(c, a, 0, rMax, p => inside(from, p[0], p[1])) + 2 * s,
      r1 = exitAt(c, a, r0, rMax, p => inside(within, p[0], p[1])) - 2 * s;
    if (!(r1 > r0)) continue;
    // pieces along the ray (one per style band), each as many words as fit
    const bands = sids.length,
      piece = (r1 - r0) / bands;
    let r = r0;
    for (let b = 0; b < bands; b++) {
      const end = r0 + piece * (b + 1);
      let text = '',
        st: CellStrip | null = null;
      for (let guard = 0; guard < 40; guard++) {
        const next = (text ? text + ' ' : '') + words[wi % words.length],
          cand = w.strip(next);
        if (!cand || r + cand.W * s > end) break;
        text = next;
        st = cand;
        wi++;
      }
      if (st) items.push(w.place(st, c, a, r + (end - r - st.W * s) / 2, s, sids[b], ring));
      r = end;
    }
  }
  return items;
}
