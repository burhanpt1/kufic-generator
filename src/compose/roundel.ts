// The roundel filler: a thuluth roundel or cartouche (src/script/thuluth/roundel) sized to the space left inside the
// borders. The text is arranged to fill an oval, so the oval (with its gilded rim, if framed) is what gets fitted.
import { deepestPoint } from '../geometry/deepest';
import { bounds } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import type { FillerNode, RoundelColours, RoundelRecipe, Style } from '../model/schema';
import { thuluthStyleOf } from '../script/registry';
import { thuluth } from '../script/thuluth/engine';
import type { Thuluth } from '../script/thuluth/engine';
import { buildRoundel, clashes, roundelArt, roundelOrderFault } from '../script/thuluth/roundel';
import type { Poly } from '../script/thuluth/types';
import { fitInside, registerFiller } from './fillers';
import type { RoundelDrawing } from './placed';
import type { Ctx, RegionResult } from './resolve';

type RoundelNode = Extract<FillerNode, { type: 'roundel' }>;

const f3 = (v: number) => (Math.round(v * 1000) / 1000).toString();
const pathOf = (ps: Poly[], cx: number, cy: number) =>
  ps.map(q => 'M' + q.map(([x, y]) => f3(x - cx) + ' ' + f3(cy - y)).join('L') + 'Z').join('');

/** Composing a roundel takes seconds: keep the last few by their inputs. */
const CACHE = new Map<string, RoundelDrawing | null>();
const CACHE_MAX = 8;

export function drawRoundel(
  text: string,
  recipe: RoundelRecipe = {},
  pen: Style['pen'],
  counters: boolean,
): RoundelDrawing | null {
  // prettier-ignore
  const key = JSON.stringify([text, recipe, pen ?? null, counters]);
  if (CACHE.has(key)) return CACHE.get(key)!;
  const base = thuluthStyleOf(pen?.preset === 'roundel' ? pen : { preset: 'roundel' }),
    th: Thuluth = thuluth({ ...base, great: recipe.great });
  const fx = recipe.fixed && structuredClone(recipe.fixed);
  const b = buildRoundel(th, {
    text,
    compose: {
      elongate: recipe.elongate,
      cross: recipe.cross,
      merge: recipe.merge,
      cradle: recipe.cradle,
      kern: recipe.kern,
      nest: recipe.nest,
      stack: recipe.stack,
      stackAt: recipe.stackAt,
      noRise: recipe.noRise,
      ceiling: recipe.ceiling,
      topFirst: recipe.topFirst,
      fillTarget: recipe.fillTarget,
      oval: recipe.oval,
      emph: recipe.emph,
      tries: recipe.tries ?? (fx ? 1 : 4),
      iters: recipe.iters,
      seed: recipe.seed,
      fixed: fx,
    },
    tweaks: recipe.tweaks,
    tails: recipe.tails,
    rise: recipe.rise,
    bowl: recipe.bowl ? { ...recipe.bowl, oval: recipe.oval } : false,
    frame: { markReach: recipe.markReach, ornaments: recipe.ornaments, density: recipe.density, ornStyle: recipe.ornStyle, fathaRule: recipe.fathaRule, longFatha: recipe.longFatha, allSigns: recipe.allSigns }, // prettier-ignore
  });
  let out: RoundelDrawing | null = null;
  if (b) {
    const art = roundelArt(th, b.r, b.f, { discScale: 1, counters: counters ? '#000000' : undefined }),
      tints = new Map<string, string>();
    let ink = '';
    for (const u of art.units) {
      const d = pathOf(u.polys, art.cx, art.cy);
      if (u.tint) tints.set(u.tint, (tints.get(u.tint) || '') + d);
      else ink += d;
    }
    out = {
      oval: art.oval,
      Rf: art.Rf,
      rim: art.rim,
      ink,
      tints: [...tints].map(([colour, d]) => ({ colour, d })),
      counters: art.counters.map(rs => pathOf(rs, art.cx, art.cy)).join(''),
      marks: b.f.solved?.count ?? 0,
      missing: b.f.missing,
      grow: b.r.bowlGrow ?? 0,
      overlap: b.r.overlap,
      tails: b.r.tailsDrawn ?? 0,
      levels: new Set(b.r.st.map(p => Math.round(p.y / 2))).size,
      order: roundelOrderFault(b.r),
      clash: clashes(th, b.r),
    };
  }
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(key, out);
  return out;
}

/** Polygon of an ellipse with half-axes (a, b), for fitting. */
const ellipse = (a: number, b: number, n = 72): Pt[] =>
  Array.from({ length: n }, (_, i) => [a * Math.cos((2 * Math.PI * i) / n), b * Math.sin((2 * Math.PI * i) / n)]);

export function roundelFill(f: RoundelNode, res: RegionResult, style: Style, ctx: Ctx, sid: number) {
  const slot = ctx.comp.texts[f.text],
    inner = res.inner!;
  if (!slot || !slot.text.trim()) {
    ctx.fill = { type: 'roundel', ok: false, note: 'no text' };
    return;
  }
  const colours: Required<RoundelColours> = {
    field: f.colours?.field ?? style.palette.paper,
    letters: f.colours?.letters ?? style.palette.ink,
    sheen: f.colours?.sheen ?? '#f0d07a',
    rim: f.colours?.rim ?? style.palette.ink,
    line: f.colours?.line ?? style.palette.ink2,
    counters: f.colours?.counters ?? '',
  };
  const art = drawRoundel(slot.text, f.recipe, style.pen, !!colours.counters);
  if (!art) {
    ctx.fill = { type: 'roundel', ok: false, note: 'no letters' };
    return;
  }
  const framed = f.frame !== false,
    R = framed ? art.Rf + art.rim : art.Rf;
  // the largest scale at which the oval fits, at the region's centre, its deepest point, or its box's centre
  const b = bounds(inner.pts),
    centres: Pt[] = [[0, 0], deepestPoint(inner.pts).p, [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]];
  const wide = (art.Rf + art.rim) * (art.oval - 1),
    fit = fitInside(ellipse(R + wide + (framed ? art.rim * (art.oval - 1) : 0), R), inner.pts, centres);
  if (!fit || fit.s * R < 1) {
    ctx.fill = { type: 'roundel', ok: false, note: 'too little room' };
    return;
  }
  const s = fit.s * 0.97;
  if (f.ground)
    ctx.items.push({ type: 'tilework', style: sid, area: [inner.pts], centre: fit.c, radius: Math.max(...inner.pts.map(q => Math.hypot(q[0] - fit.c[0], q[1] - fit.c[1]))), iznik: f.ground }); // prettier-ignore
  ctx.items.push({ type: 'roundel', style: sid, centre: fit.c, s, framed, colours, fieldTiles: f.fieldTiles, rimStyle: f.rim, ...art }); // prettier-ignore
  ctx.fill = {
    type: 'roundel',
    scale: s,
    ok: art.missing === 0,
    note: art.missing ? `${art.missing} marks found no room` : undefined,
    metrics: { marks: art.marks, missing: art.missing, grow: art.grow, overlap: art.overlap, tails: art.tails, levels: art.levels, order: art.order, clash: art.clash }, // prettier-ignore
  };
}

registerFiller('roundel', (f, res, style, ctx, sid) => roundelFill(f as RoundelNode, res, style, ctx, sid));
