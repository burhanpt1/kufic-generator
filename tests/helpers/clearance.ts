// Clearance between letter ink and separators / the outline, in cells of each strip (headroom fix, owner feedback).
import type { Placed } from '../../src/compose/placed';
import { placeMap } from '../../src/compose/textBorder';
import { segDist } from '../../src/geometry/poly';
import type { Pt } from '../../src/geometry/types';

/** How far leaf and palmette endings rise above a stem's top edge, in cells (as the renderer draws them). */
export const reachOf = (kind: string, weight: number) => {
  const k = 0.8 + 0.4 * weight;
  return kind === 'leaf' ? 0.3 + 1.05 * k - 0.5 : kind === 'palmette' ? 0.3 + k - 0.5 : kind === 'none' ? 0 : 0.25;
};

/** Distance from a point to the nearest of many segments (each with an amount subtracted, e.g. half a drawn width),
 *  looking only within `R`: segments are bucketed on a grid of that size. */
function nearest(segs: { a: Pt; b: Pt; sub: number }[], R: number) {
  const grid = new Map<string, number[]>(),
    cell = (v: number) => Math.floor(v / R);
  segs.forEach(({ a, b }, i) => {
    for (let gx = cell(Math.min(a[0], b[0])); gx <= cell(Math.max(a[0], b[0])); gx++)
      for (let gy = cell(Math.min(a[1], b[1])); gy <= cell(Math.max(a[1], b[1])); gy++) {
        const k = gx + ',' + gy,
          l = grid.get(k);
        if (l) l.push(i);
        else grid.set(k, [i]);
      }
  });
  return (p: Pt) => {
    let d = Infinity;
    const gx = cell(p[0]),
      gy = cell(p[1]);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const i of grid.get(gx + dx + ',' + (gy + dy)) ?? [])
          d = Math.min(d, segDist(p, segs[i].a, segs[i].b) - segs[i].sub);
    return d;
  };
}
const segsOf = (q: Pt[], sub: number) => q.map((a, i) => ({ a, b: q[(i + 1) % q.length], sub }));

export interface Violation {
  ring: number;
  what: 'separator' | 'outline';
  gap: number;
}
/** Every strip whose ink comes closer than `need` cells to a separator's drawn band (±0.45 of its width) or to the
 *  outline, with its closest gap (gaps beyond about 3 cells are not measured exactly). */
export function clearances(p: Placed, need = 0.5): Violation[] {
  const seps = p.items.flatMap(i => (i.type === 'separator' ? segsOf(i.path, 0.45 * i.width) : [])),
    wMax = Math.max(0, ...p.items.map(i => (i.type === 'separator' ? i.width : 0))),
    out: Violation[] = [];
  const R = 0.45 * wMax + 4,
    toSep = nearest(seps, R),
    toOutline = nearest(segsOf(p.meta.outline, 0), R);
  for (const it of p.items) {
    if (it.type !== 'strip' || it.strip.kind !== 'cells') continue;
    const st = it.strip,
      map = placeMap(it.place),
      s = it.place.s,
      style = p.styles[it.style],
      reach = reachOf(style.terminals.kind, style.stroke.weight);
    let worstSep = Infinity,
      worstOut = Infinity;
    for (let y = 0; y < st.Hb; y++)
      for (let x = 0; x < st.W; x++) {
        const v = st.data[y * st.W + x];
        if (!v) continue;
        const top = v === 4 ? y + 1 + reach : y + 1;
        for (const q of [map(x, y), map(x + 1, y), map(x, top), map(x + 1, top), map(x + 0.5, top)]) {
          worstSep = Math.min(worstSep, toSep(q));
          worstOut = Math.min(worstOut, toOutline(q));
        }
      }
    if (worstSep / s < need - 1e-6) out.push({ ring: it.ring, what: 'separator', gap: worstSep / s });
    if (worstOut / s < need - 1e-6) out.push({ ring: it.ring, what: 'outline', gap: worstOut / s });
  }
  return out;
}

/** The headroom check for a batch of random evolvable compositions (split over several test files to run them in
 *  parallel). Returns a description of each composition that breaks the rule. */
export async function randomBatchViolations(seed: number, n: number) {
  const { resolve } = await import('../../src/compose');
  const { freshGeneration } = await import('../../src/evolve/breed');
  const { Rng } = await import('../../src/evolve/rng');
  const { loadSealWasm } = await import('../../src/kernels/seal');
  await loadSealWasm();
  const gen = freshGeneration(
    n,
    { main: { text: 'بسم الله الرحمن الرحيم', repeat: 'fill', wordGap: 2 } },
    { rng: new Rng(seed) },
  );
  return gen
    .map((c, i) => ({ i, v: clearances(resolve(c)) }))
    .filter(x => x.v.length)
    .map(x => `#${x.i}: ${x.v.map(v => `${v.what}@ring${v.ring} ${v.gap.toFixed(2)}`).join(', ')}`);
}
