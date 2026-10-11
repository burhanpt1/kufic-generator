// A region's geometry at any size: the outline scaled to `size`, and its inward offsets (rings) by any inset.
import { circlePoints, unitRing } from './outlines';
import type { Outline } from './outlines';
import { insetRing, makeRing } from './offset';
import { deepestPoint } from './deepest';
import { simplifyClosed } from './poly';
import { runsOf } from './runs';
import type { Ring, Run } from './types';

export interface ShapeGeometry {
  outline: Outline;
  /** 'circle' rings are exact circles; 'polygon' rings have straight edges; 'curve' rings are dense polylines. */
  kind: 'circle' | 'polygon' | 'curve';
  unit: Ring;
  /** The outline scaled by size and inset by `inset` (same units), or null if nothing is left. Cached. */
  ring(size: number, inset?: number): Ring | null;
  /** Runs of ring(size, inset). Cached with it. */
  runs(size: number, inset?: number): Run[];
  /** Deepest inset, as a fraction of size, that leaves more than `share` of the outline's area. Offsets scale with
   *  size, so this is found once per shape (on the unit outline) and cached. */
  depthFor(share: number): number;
}

const scaleRing = (r: Ring, s: number): Ring => makeRing(r.pts.map(([x, y]) => [x * s, y * s]));
/** Curves are dense; points closer than this (cells) to the line through their neighbours are dropped. */
const CURVE_TOL = 0.02;
const lighten = (r: Ring | null): Ring | null => (r ? makeRing(simplifyClosed(r.pts, CURVE_TOL)) : null);

const memo = new Map<string, ShapeGeometry>();
/** Geometry for an outline; memoised (a small LRU), since resolving retries sizes and nested regions repeat. */
export function shapeOf(outline: Outline): ShapeGeometry {
  const k = JSON.stringify(outline);
  let g = memo.get(k);
  if (g) {
    memo.delete(k);
    memo.set(k, g);
    return g;
  }
  g = makeShape(outline);
  memo.set(k, g);
  if (memo.size > 64) memo.delete(memo.keys().next().value!);
  return g;
}

function makeShape(outline: Outline): ShapeGeometry {
  const unit = unitRing(outline),
    kind =
      outline.kind === 'circle'
        ? 'circle'
        : outline.kind === 'polygon' || outline.kind === 'star'
          ? 'polygon'
          : 'curve';
  const cache = new Map<string, { ring: Ring | null; runs?: Run[] }>();
  const key = (size: number, inset: number) => `${Math.round(size * 1e4)}:${Math.round(inset * 1e4)}`;
  type Entry = { ring: Ring | null; runs?: Run[] };
  const get = (size: number, inset = 0): Entry => {
    const k = key(size, inset);
    let e = cache.get(k);
    if (!e) {
      let ring: Ring | null;
      if (kind === 'circle') {
        const r = size - inset;
        ring = r > 0 ? makeRing(circlePoints(r, Math.max(64, Math.min(1024, Math.ceil(2 * Math.PI * r * 2))))) : null;
      } else {
        const base: Ring | null = inset ? get(size, 0).ring : null;
        ring = inset ? (base ? insetRing(base, inset) : null) : scaleRing(unit, size);
        if (kind === 'curve') ring = lighten(ring);
      }
      e = { ring };
      cache.set(k, e);
    }
    return e;
  };
  const depths = new Map<number, number>();
  const depthFor = (share: number) => {
    let d = depths.get(share);
    if (d === undefined) {
      // bisection between 0 and the inscribed radius (no inset can go deeper), on a lightly simplified outline
      const A = unit.area,
        P = kind === 'curve' ? simplifyClosed(unit.pts, 2e-3) : unit.pts,
        ring = kind === 'curve' ? makeRing(P) : unit,
        ok = (r: number) => (kind === 'circle' ? Math.PI * (1 - r) ** 2 : (insetRing(ring, r)?.area ?? 0)) > A * share;
      let a = 0,
        b = kind === 'circle' ? 1 : deepestPoint(P).r * 1.001;
      for (let i = 0; i < 14 && !ok(b); i++) {
        const m = (a + b) / 2;
        if (ok(m)) a = m;
        else b = m;
      }
      d = ok(b) ? b : a;
      depths.set(share, d);
    }
    return d;
  };
  return {
    outline,
    kind,
    unit,
    depthFor,
    ring: (size, inset = 0) => get(size, inset).ring,
    runs: (size, inset = 0) => {
      const e = get(size, inset);
      if (!e.runs) e.runs = e.ring ? runsOf(e.ring) : [];
      return e.runs;
    },
  };
}
