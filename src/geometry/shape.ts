// A region's geometry at any size: the outline scaled to `size`, and its inward offsets (rings) by any inset.
import { circlePoints, unitRing } from './outlines';
import type { Outline } from './outlines';
import { insetRing, makeRing } from './offset';
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
  return {
    outline,
    kind,
    unit,
    ring: (size, inset = 0) => get(size, inset).ring,
    runs: (size, inset = 0) => {
      const e = get(size, inset);
      if (!e.runs) e.runs = e.ring ? runsOf(e.ring) : [];
      return e.runs;
    },
  };
}
