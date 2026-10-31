// The roundel filler: a thuluth roundel or cartouche (src/script/thuluth/roundel) sized to the space left inside the
// borders. The text is arranged to fill an oval, so the oval (with its gilded rim, if framed) is what gets fitted.
import { deepestPoint } from '../geometry/deepest';
import { bounds } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import type { FillerNode, RoundelColours, RoundelRecipe, Style } from '../model/schema';
import { thuluthStyleOf } from '../script/registry';
import { thuluth } from '../script/thuluth/engine';
import { FIELDS, fieldPolygon } from '../script/thuluth/roundel/fields';
import type { Thuluth } from '../script/thuluth/engine';
import type { BuiltRoundel, FinishOptions, Roundel, RoundelOptions, RoundelSpec } from '../script/thuluth/roundel';
import type { RoundelWorkers } from '../script/thuluth/roundel/parallel';
import {
  buildRoundel,
  clashes,
  crossings,
  findCounters,
  musenna,
  musennaArt,
  refusesMirror,
  roundelArt,
  roundelChecks,
  genreOf,
  roundelFeatures,
  tasteScore,
  roundelOrderFault,
} from '../script/thuluth/roundel';
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
/** Forget the roundels drawn so far (for tests that time or compare drawing them). */
export const forgetRoundels = () => CACHE.clear();
const keep = (key: string, out: RoundelDrawing | null) => {
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(key, out);
  return out;
};

/** What a roundel is drawn from: its text, recipe, pen, whether its eyes are drawn, and a two-name scheme. */
export interface RoundelRequest {
  text: string;
  recipe: RoundelRecipe;
  pen: Style['pen'];
  counters: boolean;
  pair?: RoundelColours['pair'];
}
const keyOf = (q: RoundelRequest) => JSON.stringify([q.text, q.recipe, q.pen ?? null, q.counters, q.pair ?? null]);

/** The pen, the composer's and the frame's options, and the build's spec, from a request. */
function setup({ text, recipe, pen, pair }: RoundelRequest) {
  const base = thuluthStyleOf(pen?.preset === 'roundel' ? pen : { preset: 'roundel' }),
    th: Thuluth = thuluth({ ...base, great: recipe.great });
  const fx = recipe.fixed && structuredClone(recipe.fixed);
  const compose: RoundelOptions = {
    elongate: recipe.elongate,
    cross: recipe.cross,
    merge: recipe.merge,
    cradle: recipe.cradle,
    kern: recipe.kern,
    nest: recipe.nest,
    stack: recipe.stack,
    stackAt: recipe.stackAt,
    learnedStack: recipe.learnedStack,
    girift: recipe.girift,
    towers: recipe.towers,
    towerPull: recipe.towerPull,
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
    path: recipe.path,
    field: recipe.field,
    lanes: recipe.lanes,
    pathFill: recipe.pathFill,
    pathTol: recipe.pathTol,
    readRule: recipe.readRule,
    ruled: recipe.ruled,
  };
  const frame = { markReach: recipe.markReach, ornaments: recipe.ornaments, density: recipe.density, ornStyle: recipe.ornStyle, fathaRule: recipe.fathaRule, longFatha: recipe.longFatha, allSigns: recipe.allSigns, clearance: recipe.clearance, markDensity: recipe.markDensity, fathaGap: recipe.fathaGap }; // prettier-ignore
  const spec: RoundelSpec = {
    text,
    compose,
    tweaks: recipe.tweaks,
    ...(pair ? { wordTints: [pair.first, pair.second], accent: pair.accent } : {}),
    choose: recipe.choose,
    vary: recipe.vary,
    judge: recipe.judge,
    tails: recipe.tails,
    rise: recipe.rise,
    bowl: recipe.bowl ? { ...recipe.bowl, oval: recipe.oval } : false,
    frame,
  };
  return { th, compose, frame, spec };
}

/** While a resolve is only looked through (collectRoundels), the roundels it asks for and has not drawn yet. */
let wanted: Map<string, RoundelRequest> | null = null;

export function drawRoundel(
  text: string,
  recipe: RoundelRecipe = {},
  pen: Style['pen'],
  counters: boolean,
  pair?: RoundelColours['pair'],
): RoundelDrawing | null {
  const q: RoundelRequest = { text, recipe, pen, counters, pair },
    key = keyOf(q);
  if (CACHE.has(key)) return CACHE.get(key)!;
  if (wanted) {
    wanted.set(key, q);
    return null;
  }
  const { th, compose, frame, spec } = setup(q);
  if (recipe.mirror) return keep(key, drawMusenna(th, text, recipe, compose, frame));
  const b = buildRoundel(th, spec);
  return keep(key, b && drawingOf(th, b, q));
}

/** The roundels a resolve would draw that are not drawn yet: `look` is run with roundels left undrawn and its result
 *  thrown away. */
export function collectRoundels(look: () => unknown): RoundelRequest[] {
  const asked = (wanted = new Map<string, RoundelRequest>());
  try {
    look();
  } catch {
    // a resolve missing its roundels may fail: only what it asked for matters
  }
  wanted = null;
  return [...asked.values()];
}

/** Draw a roundel on workers (its tries and its best arrangements side by side) and keep it, so a resolve finds it
 *  drawn: the same drawing drawRoundel makes. A mirrored roundel is left to drawRoundel. */
export async function prepareRoundel(q: RoundelRequest, workers: RoundelWorkers): Promise<void> {
  const key = keyOf(q);
  if (CACHE.has(key) || q.recipe.mirror) return;
  const { th, spec } = setup(q),
    b = await workers.build(th, spec);
  keep(key, b && drawingOf(th, b, q));
}

/** A built roundel as drawn: its ink, colours, eyes, and the measures the critic reads. */
function drawingOf(th: Thuluth, b: BuiltRoundel, { text, recipe, counters, pair }: RoundelRequest): RoundelDrawing {
  const art = roundelArt(th, b.r, b.f, { discScale: 1, counters: counters ? '#000000' : undefined }),
    tints = new Map<string, string>();
  let ink = '';
  // with hairline piercing, each group's letters are a layer of their own, in reading order
  const layers: string[] = [];
  for (const u of art.units) {
    const d = pathOf(u.polys, art.cx, art.cy);
    if (u.tint) tints.set(u.tint, (tints.get(u.tint) || '') + d);
    else if (recipe.hairline && !u.mark && u.gi != null) layers[u.gi] = (layers[u.gi] || '') + d;
    else ink += d;
  }
  return {
    ...(recipe.hairline && { hairline: recipe.hairline, layers: layers.filter(Boolean) }),
    oval: art.oval,
    Rf: art.Rf,
    rim: art.rim,
    field: art.field,
    ink,
    tints: [...tints].map(([colour, d]) => ({ colour, d })),
    counters: art.counters.map(rs => pathOf(rs, art.cx, art.cy)).join(''),
    ...(pair ? { counterTints: pairCounters(th, b.r, pair, art.cx, art.cy) } : {}),
    marks: b.f.solved?.count ?? 0,
    missing: b.f.missing,
    grow: b.r.bowlGrow ?? 0,
    overlap: b.r.overlap,
    tails: b.r.tailsDrawn ?? 0,
    levels: new Set(b.r.st.map(p => Math.round(p.y / 2))).size,
    order: roundelOrderFault(b.r),
    clash: clashes(th, b.r),
    deco: (f => ({ texture: f.texture, knots: f.knots, unity: f.unity, span: f.span, fill: f.fill, noise: f.noise, taste: tasteScore(f, genreOf(text)) }))(roundelFeatures(th, b.r, b.f)), // prettier-ignore
    checks: { ...roundelChecks(th, b.r, b.f), ...crossings(b.r) },
  };
}

/** A two-name scheme's eyes: each group's own counters, in the other name's colour (the accent's in the accent). */
function pairCounters(th: Thuluth, r: Roundel, pair: NonNullable<RoundelColours['pair']>, cx: number, cy: number) {
  const by = new Map<string, string>();
  r.groups.forEach((g, i) => {
    const colour = g.tint === pair.accent ? pair.accent : (pair.eyes ?? (g.word % 2 ? pair.first : pair.second)),
      { x, y } = r.st[i],
      strokes = r.shapes[i].b.strokes.map(st => ({ ...st, s: st.s.map(q => ({ x: q.x + x, y: q.y + y, w: q.w })) }));
    const d = findCounters(th, strokes)
      .map(rs => pathOf(rs, cx, cy))
      .join('');
    if (d) by.set(colour, (by.get(colour) || '') + d);
  });
  return [...by].map(([colour, d]) => ({ colour, d }));
}

/** A mirrored roundel (müsennâ): composed once, mirrored on a vertical axis, the halves combined into one design. Null
 *  for a text holding الله, which the owner does not want mirrored. */
function drawMusenna(
  th: Thuluth,
  text: string,
  recipe: RoundelRecipe,
  compose: RoundelOptions,
  frame: FinishOptions,
): RoundelDrawing | null {
  const m = typeof recipe.mirror === 'object' ? recipe.mirror : {},
    { tries, iters, seed } = compose,
    // only what the recipe sets overrides the mirrored composer's own defaults (a pinned layout does not apply)
    rest = Object.fromEntries(Object.entries(compose).filter(([k, v]) => v !== undefined && !['fixed', 'tries', 'iters', 'seed'].includes(k))) as RoundelOptions; // prettier-ignore
  // mirroring is offered only where a tall stroke can stand on the axis, shared by both halves (علي's lam); where the
  // halves only face each other (محمد) it reads as a mask
  const c = musenna(th, text, { compose: rest, finish: frame, tries, iters, seeds: seed != null ? [seed] : undefined }).find(q => (q.shared ?? 0) > 0); // prettier-ignore
  if (!c) return null;
  const art = musennaArt(th, c, { shareStrokes: m.shareStrokes }),
    Rf = art.rad * 1.036,
    { texture, knots, unity, span, fill, noise } = c.features,
    taste = tasteScore(c.features, 'mirror');
  return {
    oval: 1,
    Rf,
    rim: Rf * 0.075,
    ink: pathOf(art.polys, art.cx, art.cy),
    tints: [],
    counters: '',
    marks: c.f.solved?.count ?? 0,
    missing: c.f.missing,
    grow: 0,
    overlap: c.r.overlap,
    tails: 0,
    levels: new Set(c.r.st.map(p => Math.round(p.y / 2))).size,
    order: roundelOrderFault(c.r),
    clash: clashes(th, c.r),
    deco: { texture, knots, unity, span, fill, noise, taste },
    checks: roundelChecks(th, c.r, c.f),
  };
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
  const colours: Required<Omit<RoundelColours, 'pair'>> = {
    field: f.colours?.field ?? style.palette.paper,
    letters: f.colours?.letters ?? style.palette.ink,
    sheen: f.colours?.sheen ?? '#f0d07a',
    rim: f.colours?.rim ?? style.palette.ink,
    line: f.colours?.line ?? style.palette.ink2,
    counters: f.colours?.counters ?? '',
  };
  if (f.recipe?.mirror && refusesMirror(slot.text)) {
    ctx.fill = { type: 'roundel', ok: false, note: 'الله is not mirrored' };
    return;
  }
  const art = drawRoundel(slot.text, f.recipe, style.pen, !!colours.counters, f.colours?.pair);
  if (!art) {
    ctx.fill = { type: 'roundel', ok: false, note: f.recipe?.mirror ? 'no tall stroke to share on the axis: not mirrored' : 'no letters' }; // prettier-ignore
    return;
  }
  const framed = f.frame !== false,
    R = framed ? art.Rf + art.rim : art.Rf;
  // the largest scale at which the oval fits, at the region's centre, its deepest point, or its box's centre
  const b = bounds(inner.pts),
    centres: Pt[] = [[0, 0], deepestPoint(inner.pts).p, [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]];
  const wide = (art.Rf + art.rim) * (art.oval - 1),
    // a shaped field fits by its own outline (y down here), the finial's room above a point included
    outline: Pt[] = art.field
      ? fieldPolygon(art.field).map(([x, y]) => [x * R, -y * R * (y > 0.95 && FIELDS[art.field!].tip ? 1 + (art.rim * 6) / R : 1)] as Pt) // prettier-ignore
      : ellipse(R + wide + (framed ? art.rim * (art.oval - 1) : 0), R),
    fit = fitInside(outline, inner.pts, centres);
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
    metrics: { marks: art.marks, missing: art.missing, grow: art.grow, overlap: art.overlap, tails: art.tails, levels: art.levels, order: art.order, clash: art.clash, ...art.deco, ...art.checks }, // prettier-ignore
  };
}

registerFiller('roundel', (f, res, style, ctx, sid) => roundelFill(f as RoundelNode, res, style, ctx, sid));
