// Fillers: what occupies a region once its borders are placed.
import { deepestPoint } from '../geometry/deepest';
import { insetRing } from '../geometry/offset';
import { unitRing } from '../geometry/outlines';
import { bounds, inside } from '../geometry/poly';
import type { Pt, Ring } from '../geometry/types';
import type { FillerNode, RegionNode, Style } from '../model/schema';
import type { Ctx, RegionResult } from './resolve';
import { resolveRegion, styleId } from './resolve';
import { translateItem } from './transform';

/** Centre and clear radius of a region (exact for circles). */
export function centreOf(res: RegionResult): { c: Pt; r: number } | null {
  if (res.innerCircle != null) return res.innerCircle > 0 ? { c: [0, 0], r: res.innerCircle } : null;
  if (!res.inner) return null;
  const d = deepestPoint(res.inner.pts);
  return { c: d.p, r: d.r };
}

const boundsCentre = (P: Pt[]): Pt => {
  const b = bounds(P);
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
};
/** The largest scale s (and which of the given centres) at which outline U, scaled by s about its origin and moved
 *  to the centre, lies inside polygon P: every point of U inside P, and no corner of P inside it. */
export function fitInside(U: Pt[], P: Pt[], centres: Pt[]): { c: Pt; s: number } | null {
  const ok = (c: Pt, s: number) => {
    const Q = U.map(([x, y]) => [c[0] + x * s, c[1] + y * s] as Pt);
    return Q.every(([x, y]) => inside(P, x, y)) && !P.some(([x, y]) => inside(Q, x, y));
  };
  let best: { c: Pt; s: number } | null = null;
  for (const c of centres) {
    if (!inside(P, c[0], c[1])) continue;
    let lo = 0,
      hi = 1;
    while (ok(c, hi) && hi < 1e4) hi *= 2;
    for (let k = 0; k < 30; k++) {
      const m = (lo + hi) / 2;
      if (ok(c, m)) lo = m;
      else hi = m;
    }
    if (lo > 0 && (!best || lo > best.s)) best = { c, s: lo };
  }
  return best;
}

const farthest = (P: Pt[], c: Pt) => Math.max(...P.map(p => Math.hypot(p[0] - c[0], p[1] - c[1])));

export type FillerImpl = (
  f: FillerNode,
  res: RegionResult,
  style: Style,
  ctx: Ctx,
  sid: number,
  region: RegionNode,
) => void;
const EXTRA: Partial<Record<FillerNode['type'], FillerImpl>> = {};
/** Register the grid-based fillers (lines, maze, monogram), which live in their own modules. */
export const registerFiller = (type: FillerNode['type'], impl: FillerImpl) => (EXTRA[type] = impl);

export function resolveFiller(f: FillerNode, res: RegionResult, style: Style, ctx: Ctx, region: RegionNode) {
  const sid = styleId(ctx, style),
    inner = res.inner;
  if (!inner || inner.area < 1) {
    ctx.fill = { type: f.type, ok: false, note: 'no room left inside the borders' };
    return;
  }
  const area = [inner.pts];
  switch (f.type) {
    case 'abjad': {
      const cr = centreOf(res);
      if (!cr || cr.r < 2) break;
      const value = ctx.script.abjad(ctx.comp.texts[f.text].text, style.abjad);
      const frame = insetRing(inner, 0.4);
      ctx.items.push({
        type: 'abjad',
        style: sid,
        value,
        centre: cr.c,
        maxW: cr.r * 1.25,
        maxH: cr.r * 0.62,
        frame: frame?.pts ?? null,
      });
      ctx.fill = { type: 'abjad', ok: true };
      return;
    }
    case 'pattern': {
      const cr = centreOf(res)!;
      ctx.items.push({
        type: 'pattern',
        style: sid,
        area,
        pattern: f.pattern,
        centre: cr.c,
        radius: farthest(inner.pts, cr.c) * 1.05,
        strength: 0.85,
      });
      ctx.fill = { type: 'pattern', ok: true };
      return;
    }
    case 'rings': {
      let n = 0;
      for (let d = 0.5; ; d += 2) {
        const r: Ring | null = insetRing(inner, d);
        if (!r || r.area < 1) break;
        ctx.items.push({ type: 'rule', style: sid, path: r.pts, width: style.stroke.weight, colour: 'accent' });
        n++;
      }
      ctx.fill = { type: 'rings', ok: n > 0 };
      return;
    }
    case 'solid':
    case 'vine':
      ctx.items.push({ type: 'fill', style: sid, kind: f.type, area });
      ctx.fill = { type: f.type, ok: true };
      return;
    case 'region': {
      const cr = centreOf(res);
      if (!cr) break;
      const unit = unitRing(f.node.outline),
        reach = Math.max(...unit.pts.map(([x, y]) => Math.hypot(x, y)));
      // the largest size at which the nested outline itself fits the space left inside (an arch in an arch fills it),
      // never smaller than its circle fitting the largest clear circle
      const circle = { c: cr.c, s: (cr.r * 0.96) / reach };
      let fit = circle;
      if (res.inner && res.innerCircle == null) {
        const b = fitInside(unit.pts, res.inner.pts, [[0, 0], cr.c, boundsCentre(res.inner.pts)]);
        if (b && b.s * 0.96 > fit.s) fit = { c: b.c, s: b.s * 0.96 };
      }
      const place = (at: { c: Pt; s: number }) => {
        const size = typeof f.node.size === 'number' ? Math.min(f.node.size, at.s) : at.s,
          before = ctx.items.length;
        ctx.fill = null;
        resolveRegion(f.node, style, ctx, size);
        for (let i = before; i < ctx.items.length; i++) ctx.items[i] = translateItem(ctx.items[i], at.c);
      };
      const snap = {
        items: ctx.items.length,
        borders: ctx.borders.length,
        warnings: ctx.warnings.length,
        ring: ctx.ring,
      };
      place(fit);
      // a larger nested region whose own fill no longer fits falls back to the clear-circle size
      const failed = (ctx.fill as { ok?: boolean } | null)?.ok === false || ctx.warnings.length > snap.warnings;
      if (fit !== circle && failed) {
        ctx.items.length = snap.items;
        ctx.borders.length = snap.borders;
        ctx.warnings.length = snap.warnings;
        ctx.ring = snap.ring;
        place(circle);
      }
      const innerFill = ctx.fill as { type: string } | null;
      ctx.fill = { type: 'region', ok: true, note: innerFill ? `inner fill: ${innerFill.type}` : undefined };
      return;
    }
    default: {
      const impl = EXTRA[f.type];
      if (impl) {
        impl(f, res, style, ctx, sid, region);
        return;
      }
      ctx.fill = { type: f.type, ok: false, note: 'filler not available' };
      return;
    }
  }
  ctx.fill = { type: f.type, ok: false, note: 'too little room' };
}
