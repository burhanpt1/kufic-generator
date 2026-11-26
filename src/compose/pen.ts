// One pen for several compositions (the rooms of a plan, the panels of a wall): the single letter scale at which
// every text border among them holds its text whole, with the least and the most even stretching. Each border left
// on 'auto' is otherwise fitted on its own and comes out at its own size; a scale fixed by hand either fits or drops
// the border. This searches the scale they can all share.
import type { Composition, FillerNode, RegionNode } from '../model/schema';
import { resolve } from './resolve';
import type { ResolveOptions } from './resolve';

export interface PenOptions extends ResolveOptions {
  /** Scales tried, largest first (default 1.15 down to 0.4 in steps of 0.025). */
  lo?: number;
  hi?: number;
  step?: number;
  /** Which text borders take the shared pen (default: those whose scale is not set to a number). */
  takes?: (slot: string, comp: number) => boolean;
}

export interface PenRing {
  /** Index of the composition, and the border's text slot. */
  comp: number;
  slot: string;
  rep: number;
  mode: 'words' | 'breaks';
  /** Share of each written side left to stretching. */
  runSlack: number[];
}

export interface PenFit {
  /** The shared letter scale. */
  scale: number;
  /** Mean over the rings of the most stretched side, plus half the difference between a ring's sides (lower is
   *  better; 0 = every side full). */
  score: number;
  /** The compositions with the scale set on their borders, ready to resolve. */
  compositions: Composition[];
  rings: PenRing[];
  /** What stops a larger pen: the composition that no longer fits at the next scale up, if any. */
  limit: { scale: number; comp: number; warning: string } | null;
  /** Every scale tried: its score, or the composition that failed there. */
  tried: { scale: number; score: number | null; failed?: number }[];
}

type Takes = (slot: string) => boolean;

function regionWith(r: RegionNode, f: (r: RegionNode) => RegionNode): RegionNode {
  const out = f(r);
  return out.fill?.type === 'region' ? { ...out, fill: { ...out.fill, node: regionWith(out.fill.node, f) } } : out;
}

/** The composition with the scale set on the borders that take it. */
function withScale(c: Composition, s: number, takes: Takes): Composition {
  const child = regionWith(c.root.child, r => ({
    ...r,
    borders: r.borders.map(b =>
      b.type === 'textBorder' && typeof b.scale !== 'number' && takes(b.text) ? { ...b, scale: s } : b,
    ),
  }));
  return { ...c, root: { ...c.root, child } };
}

/** The borders alone: fills other than nested regions don't change how a border of a sized region fits. */
function bordersOnly(c: Composition): Composition {
  if (typeof c.root.child.size !== 'number') return c;
  const child = regionWith(c.root.child, r => {
    const fill: FillerNode | undefined = r.fill?.type === 'region' ? r.fill : undefined,
      { fill: _dropped, ...rest } = r;
    void _dropped;
    return fill ? { ...rest, fill } : rest;
  });
  const { spandrels: _sp, ...root } = c.root;
  void _sp;
  return { ...c, root: { ...root, child } };
}

const slotsOf = (c: Composition, takes: Takes): Set<string> => {
  const out = new Set<string>();
  regionWith(c.root.child, r => {
    for (const b of r.borders)
      if (b.type === 'textBorder' && typeof b.scale !== 'number' && takes(b.text)) out.add(b.text);
    return r;
  });
  return out;
};

const BREAK_COST = 0.15;
/** Scores this close count as equal, and the larger pen wins. */
const TIE = 0.01;

export function solvePen(comps: Composition[], o: PenOptions = {}): PenFit | null {
  const { lo = 0.4, hi = 1.15, step = 0.025, takes = () => true, ...ro } = o;
  const takesOf =
      (i: number): Takes =>
      slot =>
        takes(slot, i),
    slots = comps.map((c, i) => slotsOf(c, takesOf(i))),
    probes = comps.map(bordersOnly);
  if (!slots.some(s => s.size)) return null;
  const tried: PenFit['tried'] = [];
  let best: { scale: number; score: number; rings: PenRing[] } | null = null,
    limit: PenFit['limit'] = null,
    lastFail: PenFit['limit'] = null;
  const n = Math.max(0, Math.round((hi - lo) / step));
  for (let k = 0; k <= n; k++) {
    const scale = +(hi - k * step).toFixed(4),
      rings: PenRing[] = [];
    let failed = -1,
      warning = '';
    for (let i = 0; i < comps.length && failed < 0; i++) {
      if (!slots[i].size) continue;
      const pl = resolve(withScale(probes[i], scale, takesOf(i)), ro),
        w = pl.meta.warnings.find(x => x.includes("doesn't fit")),
        got = pl.meta.borders.filter(b => slots[i].has(b.slot));
      // a border dropped without a warning (no room for its band at all) is a failure too
      if (w || new Set(got.map(b => b.slot)).size < slots[i].size) {
        failed = i;
        warning = w ?? 'a border has no room at this scale';
        break;
      }
      for (const b of got)
        for (const r of b.rings) {
          // the sides that were written; one left blank (a notch too short for a word) has nothing to stretch
          const runSlack = r.runSlack.filter((_, g) => r.groupSizes[g] > 0);
          rings.push({ comp: i, slot: b.slot, rep: r.rep, mode: r.mode, runSlack });
        }
    }
    if (failed >= 0) {
      tried.push({ scale, score: null, failed });
      lastFail = { scale, comp: failed, warning };
      continue;
    }
    const score =
      rings.reduce((a, r) => {
        const max = Math.max(...r.runSlack),
          min = Math.min(...r.runSlack);
        return a + max + 0.5 * (max - min) + (r.mode === 'breaks' ? BREAK_COST : 0);
      }, 0) / Math.max(1, rings.length);
    tried.push({ scale, score });
    if (!best || score < best.score - TIE) {
      best = { scale, score, rings };
      limit = lastFail;
    }
  }
  if (!best) return null;
  return {
    scale: best.scale,
    score: best.score,
    compositions: comps.map((c, i) => (slots[i].size ? withScale(c, best!.scale, takesOf(i)) : c)),
    rings: best.rings,
    limit,
    tried,
  };
}
