// The critic (COMPOSITION_ENGINE.md §7): each part of a composition contributes metrics in [0, 1] through a
// registry; the overall score is their taste-weighted mean (taste.ts). Ported from the lab's analyseStrip/metrics
// and monoMetrics.
import type { Placed, PlacedItem } from '../compose/placed';
import type { CellStrip } from '../script/types';
import { emptySpace } from './space';

export type Metrics = Record<string, number>;
export type Critic = (placed: Placed) => Metrics;
const none: Metrics = {};
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** Stem rhythm (coefficient of variation of tall-stem spacing), ink density and the longest stretched run. */
export function analyseStrip(st: CellStrip, wrap: boolean) {
  const { W, Hb, data } = st,
    at = (x: number, y: number) => (x < 0 || x >= W || y < 0 || y >= Hb ? 0 : data[y * W + x]),
    isL = (v: number) => v === 1 || v === 4;
  let top = -1;
  for (let y = Hb - 1; y >= 0 && top < 0; y--)
    for (let x = 0; x < W; x++)
      if (isL(at(x, y))) {
        top = y;
        break;
      }
  const stems: number[] = [];
  if (top >= 0)
    for (let x = 0; x < W; x++) if (isL(at(x, top)) && !isL(at(x - 1, top)) && !isL(at(x + 1, top))) stems.push(x);
  let ink = 0,
    maxRun = 0;
  for (let y = 0; y < Hb; y++) {
    let run = 0;
    for (let x = 0; x < W; x++) {
      if (isL(at(x, y))) {
        ink++;
        run++;
        maxRun = Math.max(maxRun, run);
      } else run = 0;
    }
  }
  let cv: number | null = null;
  if (stems.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < stems.length; i++) gaps.push(stems[i] - stems[i - 1]);
    if (wrap) gaps.push(W + 1 - (stems[stems.length - 1] - stems[0]));
    const m = gaps.reduce((a, b) => a + b, 0) / gaps.length,
      sd = Math.sqrt(gaps.reduce((a, b) => a + (b - m) * (b - m), 0) / gaps.length);
    cv = sd / m;
  }
  return { cv, density: ink / (W * Hb), maxRun };
}

const borderStrips = (p: Placed) => {
  const rings = p.meta.borders.reduce((a, b) => a + b.rings.length, 0);
  return p.items.filter(
    (i): i is Extract<PlacedItem, { type: 'strip' }> =>
      i.type === 'strip' && i.ring <= rings && i.strip.kind === 'cells',
  );
};

const CRITICS = new Map<string, Critic>();
/** Add a critic (for a new node type). */
export const registerCritic = (name: string, c: Critic) => CRITICS.set(name, c);

// text bands: stem rhythm, even stretching, density and its evenness, little repetition, filled canvas
registerCritic('borders', p => {
  const strips = borderStrips(p);
  if (!strips.length) return none;
  const parts = strips.map(s => analyseStrip(s.strip as CellStrip, s.place.type === 'arc'));
  const Hb = Math.max(...strips.map(s => s.strip.Hb));
  const cvs = parts.map(x => x.cv).filter((v): v is number => v != null),
    dens = parts.map(x => x.density);
  const rhythm = cvs.length ? clamp(1.15 - cvs.reduce((a, b) => a + b, 0) / cvs.length / 1.1) : 0.4;
  const kashida = clamp(1 - (Math.max(...parts.map(x => x.maxRun)) / Hb - 1.6) / 3.5);
  const dm = dens.reduce((a, b) => a + b, 0) / dens.length,
    dsd = Math.sqrt(dens.reduce((a, b) => a + (b - dm) * (b - dm), 0) / dens.length);
  const density = clamp(1 - Math.abs(dm - 0.26) / 0.16) * clamp(1 - dsd / dm / 0.6);
  const maxRep = Math.max(1, ...p.meta.borders.flatMap(b => b.rings.map(r => r.rep)));
  const rep = clamp(1 - Math.max(0, maxRep - 4) / 10);
  const bandArea = strips.reduce((a, s) => {
    const sc = s.place.s;
    return a + s.strip.W * s.strip.Hb * sc * sc;
  }, 0);
  const fill = clamp(bandArea / (p.canvas.w * p.canvas.h) / 0.45);
  return { rhythm, kashida, density, rep, fill };
});
// the free centre left inside the borders: about a quarter of the size reads best (lab)
registerCritic('centre', p =>
  p.meta.borders.length ? { centre: clamp(1 - Math.abs(p.meta.inner - 0.24) / 0.2) } : none,
);
// monograms bring their own metrics (legibility, compactness, squareness, symmetry, shared strokes)
registerCritic('monogram', p =>
  p.meta.fill?.type === 'monogram' && p.meta.fill.metrics ? { ...p.meta.fill.metrics } : none,
);
// mazes: little repetition, and corridors neither empty nor crammed
registerCritic('maze', p => (p.meta.fill?.type === 'maze' && p.meta.fill.metrics ? { ...p.meta.fill.metrics } : none));
// a line fill reads well when its letters aren't much smaller than the border's
registerCritic('lines', p => {
  const f = p.meta.fill,
    b = p.meta.borders[p.meta.borders.length - 1]?.rings.at(-1);
  if ((f?.type !== 'lines' && f?.type !== 'flow' && f?.type !== 'strapwork' && f?.type !== 'lattice') || !f.scale || !b)
    return none;
  return { legibility: clamp(f.scale / b.scale / 0.65) };
});

// little empty space: blank area and the largest enclosed blank patch, measured on a small raster (lab)
registerCritic('space', p => ({ space: emptySpace(p) }));

/** Plain-language names for the metrics, for panels that explain the taste. */
export const METRIC_LABELS: Record<string, string> = {
  rhythm: 'Even stem rhythm', kashida: 'Even stretching', density: 'Even ink density', rep: 'Little repetition',
  fill: 'Bands fill the canvas', centre: 'Centre about a quarter', legibility: 'Legible', compact: 'Compact',
  squareness: 'Square', symmetry: 'Symmetric', sharing: 'Shared strokes', space: 'Little empty space',
}; // prettier-ignore

/** All metrics for a placed composition; null if nothing could be placed. */
export function metrics(p: Placed): Metrics | null {
  if (!p.items.length) return null;
  const m: Metrics = {};
  for (const c of CRITICS.values()) Object.assign(m, c(p));
  if (p.meta.warnings.length) for (const k of Object.keys(m)) m[k] *= 0.6; // didn't fully fit
  return m;
}
