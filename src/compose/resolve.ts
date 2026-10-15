// resolve(composition) -> Placed (COMPOSITION_ENGINE.md §3.3): regions, then their borders outermost first (each
// yields the inner outline for the next), then the fill, with features on every ring.
import { EndType, FillRule, JoinType, differenceD, inflatePathsD, intersectD } from '@countertype/clipper2-ts';
import polylabel from 'polylabel';
import { deepestPoint } from '../geometry/deepest';
import { insetRing } from '../geometry/offset';
import { area, bounds, dedupe, orientCCW } from '../geometry/poly';
import { shapeOf } from '../geometry/shape';
import type { ShapeGeometry } from '../geometry/shape';
import type { Pt, Ring } from '../geometry/types';
import { parseComposition } from '../model/schema';
import type {
  BorderNode,
  Composition,
  FillerNode,
  IznikSpec,
  RegionNode,
  Separator,
  Style,
  TextBorder,
} from '../model/schema';
import { inherit } from '../model/style';
import { scriptFor } from '../script/registry';
import type { LayoutOptions, Prepared, ScriptEngine } from '../script/types';
import { resolveFiller } from './fillers';
import type { Area, BorderMeta, Placed, PlacedItem } from './placed';
import { bandGeom, fitRing, fitsAtFullSize, layRing } from './textBorder';

export interface ResolveOptions {
  /** One engine for every region, whatever their styles ask for (tests, tools). */
  script?: ScriptEngine;
}

const DEFAULT_SEPARATOR: Separator = { kind: 'lines', width: 2 };
/** Iznik tilework when a ground asks for it without saying which. */
export const IZNIK: IznikSpec = { fold: 8, scale: 4 };

export interface Ctx {
  comp: Composition;
  /** The engine of the region being resolved (style.script, unless the options fix one). */
  script: ScriptEngine;
  fixedScript?: ScriptEngine;
  styles: Style[];
  styleIndex: Map<string, number>;
  items: PlacedItem[];
  borders: BorderMeta[];
  warnings: string[];
  /** Next colour key for "by ring" colouring. */
  ring: number;
  fill: Placed['meta']['fill'];
}

export function styleId(ctx: Ctx, s: Style): number {
  const k = JSON.stringify(s);
  let i = ctx.styleIndex.get(k);
  if (i === undefined) {
    i = ctx.styles.length;
    ctx.styles.push(s);
    ctx.styleIndex.set(k, i);
  }
  return i;
}

export const layoutOpts = (style: Style, wordGap: number): Omit<LayoutOptions, 'wrap'> => ({
  rhythm: true,
  wordGap,
  terminals: style.terminals.kind === 'none' ? 'none' : style.terminals.reach,
});

const textLines = (t: string) =>
  t
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);

/** Ring at an inset, as an area-ready point list (circles exact enough at their own resolution). */
const ringPts = (shape: ShapeGeometry, size: number, inset: number) => shape.ring(size, inset)?.pts ?? null;

function ringArea(shape: ShapeGeometry, size: number, inset: number) {
  if (shape.kind === 'circle') return Math.PI * Math.max(0, size - inset) ** 2;
  return shape.ring(size, inset)?.area ?? 0;
}

/** Smallest outline size at which the first text border holds its text once at full letter size. */
function autoSize(shape: ShapeGeometry, border: TextBorder, ctx: Ctx, style: Style): number | null {
  const slot = ctx.comp.texts[border.text],
    lines = textLines(slot.text);
  if (!lines.length) return null;
  const prepared = ctx.script.prepareLines(lines, style.letter)[0],
    sep = (border.separator ?? DEFAULT_SEPARATOR).width;
  const fits = (L: number) => {
    const bg = bandGeom(shape, L, sep);
    return (
      !!bg &&
      fitsAtFullSize(bg, ctx.script, prepared, slot.wordGap, bandRoom(prepared, style)) &&
      ringArea(shape, L, sep + bandRoom(prepared, style)) > 0
    );
  };
  let lo = Math.max(4, prepared.Hb * 2),
    hi = lo;
  while (!fits(hi)) {
    lo = hi;
    hi = Math.ceil(hi * 1.25);
    if (hi > 4000) return null;
  }
  // smallest integer size that fits (capacity grows with size)
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return fits(lo) ? lo : hi;
}

/** A text band's depth in cells (owner's feedback): clear space above the tallest ink, so stems never run into the
 *  separator beyond. Tall stems end at about 83% of the band, and whatever rises above them (leaf and palmette
 *  endings, marks) keeps at least a cell clear. */
export function bandRoom(p: Prepared, style: Style): number {
  const t = style.script === 'thuluth' ? 'none' : style.terminals.kind,
    k = 0.8 + 0.4 * style.stroke.weight, // as the renderer sizes leaf and palmette endings
    reach = t === 'leaf' ? 0.3 + 1.05 * k - 0.5 : t === 'palmette' ? 0.3 + k - 0.5 : t === 'none' ? 0 : 0.25,
    stem = p.base + p.ascenders,
    top = Math.max(p.Hb, stem + reach);
  return Math.max(top + 1, stem / 0.83);
}
/** Clear margin on each side of a separator, in cells of the band beside it. */
export const SEP_MARGIN = 0.5;

/** Largest letter scale (≤ hi) at which a band starting at `inset` still has an inner edge. */
function maxScale(shape: ShapeGeometry, size: number, inset: number, Hb: number, hi: number): number {
  // the band's inner edge (inset + Hb·s) must leave more than 5% of the outline's area
  const s = (shape.depthFor(0.05) * size - inset) / Hb;
  return s >= hi ? hi : s >= 0.2 ? s : 0;
}

/** Share of the outline's area a growing band must leave inside it. */
const GROW_KEEP = 0.6;
function growScale(shape: ShapeGeometry, size: number, inset: number, Hb: number, hi: number): number {
  const s = (shape.depthFor(GROW_KEEP) * size - inset) / Hb;
  return Math.max(0, Math.min(hi, s));
}

export interface RegionResult {
  size: number;
  outer: Pt[];
  /** The region left for the fill. */
  inner: Ring | null;
  innerCircle: number | null;
  inset: number;
  /** Letter scale of the innermost text band. */
  lastScale: number | null;
}

/** Enlargements tried, in order, when the size is automatic and something inside doesn't fit (lab buildFill). */
const ENLARGE = [1, 1.3, 1.7, 2.2, 2.9, 3.8, 5];
/** A nested region needs room for its own borders inside the parent's centre, so it may enlarge further. */
const ENLARGE_NESTED = [...ENLARGE, 6.5, 8.5];
/** An inner fill's letters may be no smaller than this fraction of the innermost border's (lab: 0.42). */
export const MIN_FILL_RATIO = 0.42;

/** Resolve one region: at its fixed size, or (auto) at the smallest enlargement of the first text border's size at
 *  which every border and the fill fit. */
export function resolveRegion(node: RegionNode, parentStyle: Style, ctx: Ctx, fixedSize?: number): RegionResult | null {
  // each region writes in its own script (a Kufic ring round a thuluth centre)
  const prev = ctx.script;
  ctx.script = ctx.fixedScript ?? scriptFor(inherit(parentStyle, node.style));
  try {
    return resolveRegionIn(node, parentStyle, ctx, fixedSize);
  } finally {
    ctx.script = prev;
  }
}
function resolveRegionIn(node: RegionNode, parentStyle: Style, ctx: Ctx, fixedSize?: number): RegionResult | null {
  const style = inherit(parentStyle, node.style),
    shape = shapeOf(node.outline);
  const firstText = node.borders.find((b): b is TextBorder => b.type === 'textBorder');
  const fixed = fixedSize ?? (typeof node.size === 'number' ? node.size : null);
  if (fixed != null) return placeRegion(node, style, shape, ctx, fixed);
  const auto = firstText ? autoSize(shape, firstText, ctx, style) : null;
  if (auto == null && firstText) ctx.warnings.push(`text "${firstText.text}" doesn't fit this outline at any size`);
  const base = (auto ?? 30) * (node.spread ?? 1);
  let res: RegionResult | null = null;
  const steps = node.fill?.type === 'region' ? ENLARGE_NESTED : ENLARGE;
  for (let i = 0; i < steps.length; i++) {
    const snap = {
      items: ctx.items.length,
      borders: ctx.borders.length,
      warnings: ctx.warnings.length,
      ring: ctx.ring,
      fill: ctx.fill,
    };
    res = placeRegion(node, style, shape, ctx, Math.round(base * steps[i]));
    const fill = ctx.fill as Placed['meta']['fill'];
    const fillOk =
      !node.fill ||
      // a nested region that found no room at all is a failed fill too
      (node.fill.type === 'region' && fill?.ok !== false) ||
      (fill && fill.ok && (fill.scale == null || fill.scale >= MIN_FILL_RATIO * (res?.lastScale ?? 1)));
    if ((ctx.warnings.length === snap.warnings && fillOk) || i === steps.length - 1) break;
    ctx.items.length = snap.items;
    ctx.borders.length = snap.borders;
    ctx.warnings.length = snap.warnings;
    ctx.ring = snap.ring;
    ctx.fill = snap.fill;
  }
  return res;
}

function placeRegion(node: RegionNode, style: Style, shape: ShapeGeometry, ctx: Ctx, size: number): RegionResult {
  const sid = styleId(ctx, style);
  const outer = ringPts(shape, size, 0)!;
  let inset = 0,
    lastSep: { sep: Separator; s: number } | null = null,
    stopped = false;
  const features = node.features ?? {},
    tips = features.tips ?? 'finial',
    corners = features.corners ?? 'diamond';

  for (const b of node.borders as BorderNode[]) {
    if (stopped) break;
    if (b.type === 'ornamentBorder') {
      const path = ringPts(shape, size, inset + b.width / 2);
      if (!path) break;
      ctx.items.push({
        type: 'separator',
        style: sid,
        kind: b.ornament,
        path,
        width: b.width,
        ...circ(shape, size, inset + b.width / 2),
      });
      inset += b.width;
      lastSep = null;
      continue;
    }
    const slot = ctx.comp.texts[b.text],
      lines = textLines(slot.text);
    if (!lines.length) continue;
    const prepared = ctx.script.prepareLines(lines, style.letter),
      sep = b.separator ?? DEFAULT_SEPARATOR,
      meta: BorderMeta = { slot: b.text, rings: [] };
    for (let k = 0; k < lines.length; k++) {
      const p = prepared[k],
        ratio =
          shape.kind === 'circle'
            ? (size - inset) / size
            : Math.sqrt(ringArea(shape, size, inset) / ringArea(shape, size, 0));
      const sT = typeof b.scale === 'number' ? b.scale : Math.max(0.4, Math.pow(Math.max(ratio, 1e-6), b.taper ?? 0));
      // the separator sits in a gap with half a cell clear on each side (cells of the largest scale this band may
      // take), then the band, deep enough to leave headroom above the letters
      const room = bandRoom(p, style),
        sHi = typeof b.scale === 'number' ? b.scale : Math.min(1.15, sT * 1.3),
        sepW = sep.kind !== 'none' && sep.width > 0 ? sep.width * sT : 0,
        margin = SEP_MARGIN * sHi,
        dBand = inset + sepW + 2 * margin,
        sMax = maxScale(shape, size, dBand, room, sHi),
        // a band too short for its text may grow its letters instead of stretching them, but must leave at least
        // GROW_KEEP of the outline's area inside it
        sGrow = typeof b.scale === 'number' ? sMax : Math.max(sMax, growScale(shape, size, dBand, room, sT * 3));
      const bg = sMax > 0 ? bandGeom(shape, size, dBand) : null;
      const fit = bg
        ? fitRing(bg, ctx.script, p, {
            sTarget: sT,
            fixed: typeof b.scale === 'number' ? b.scale : undefined,
            once: slot.repeat === 'once',
            wordGap: slot.wordGap,
            sMax: sGrow,
            sHi: sMax,
            room,
          })
        : null;
      if (!bg || !fit) {
        ctx.warnings.push(
          `text "${b.text}"${lines.length > 1 ? ` line ${k + 1}` : ''} doesn't fit its band; inner borders skipped`,
        );
        stopped = true;
        break;
      }
      // separator outside the band, then the band
      if (sepW > 0) {
        const path = ringPts(shape, size, inset + margin + sepW / 2);
        if (path)
          ctx.items.push({
            type: 'separator',
            style: sid,
            kind: sep.kind,
            path,
            width: sepW,
            ...circ(shape, size, inset + margin + sepW / 2),
          });
      }
      const ringNo = ++ctx.ring;
      if (b.ground && b.ground.kind !== 'plain') {
        const o = ringPts(shape, size, dBand),
          i = ringPts(shape, size, dBand + room * fit.s);
        if (o && i) {
          const area: Area = [o, i],
            dp = deepestPoint(outer),
            radius = Math.max(...outer.map(q => Math.hypot(q[0] - dp.p[0], q[1] - dp.p[1])));
          if (b.ground.kind === 'iznik')
            ctx.items.push({
              type: 'tilework',
              style: sid,
              area,
              centre: dp.p,
              radius,
              iznik: b.ground.iznik ?? IZNIK,
            });
          else
            ctx.items.push({
              type: 'ground',
              style: sid,
              kind: b.ground.kind,
              index: ringNo - 1,
              area,
              pattern: b.ground.pattern,
              centre: dp.p,
              radius,
            });
        }
      }
      const laid = layRing(bg, fit, ctx.script, p, {
        ...layoutOpts(style, slot.wordGap),
        plait: !!b.plait && ctx.script.capabilities.plait !== false,
      });
      for (const l of laid) ctx.items.push({ type: 'strip', style: sid, strip: l.strip, place: l.place, ring: ringNo });
      const natural = fit.groups.reduce((a, g) => a + g.reduce((x, sg) => x + sg.minW, 0), 0);
      meta.rings.push({
        scale: fit.s,
        rep: fit.rep,
        segsPerRep: ctx.script.segments(p, fit.mode, slot.wordGap).length,
        groupSizes: fit.groups.map(g => g.length),
        groupRun: fit.groups.map((_, g) => (fit.caps.length - g) % fit.caps.length),
        mode: fit.mode,
        Hb: p.Hb,
        slack: fit.caps.reduce((a, c) => a + c, 0) / Math.max(1, natural) - 1,
        strips: laid.map(l => l.strip.W),
      });
      // features at this band's corners
      if (shape.kind !== 'circle') {
        const ring = shape.ring(size, dBand);
        const h = room * fit.s;
        ring?.corners.forEach(cn => {
          if (!cn.convex) return;
          if (cn.clearance >= 1.1) {
            if (tips === 'finial')
              ctx.items.push({
                type: 'finial',
                style: sid,
                p: cn.p,
                bisector: cn.bisector,
                phi: cn.interior,
                length: h * cn.clearance * 0.95,
                size: h * 0.2,
              });
            else if (tips === 'diamond')
              ctx.items.push({
                type: 'diamond',
                style: sid,
                p: add(cn.p, cn.bisector, h * cn.clearance * 0.5),
                r: h * 0.17,
              });
          } else if (corners !== 'none') {
            const len = (h * 0.5) / Math.max(0.25, Math.sin(cn.interior / 2)),
              at = add(cn.p, cn.bisector, len);
            if (corners === 'diamond') ctx.items.push({ type: 'diamond', style: sid, p: at, r: h * 0.17 });
            else ctx.items.push({ type: 'star', style: sid, centre: at, r: h * 0.3 });
          }
        });
      }
      inset = dBand + room * fit.s;
      lastSep = { sep, s: fit.s };
    }
    if (meta.rings.length) ctx.borders.push(meta);
  }
  // closing separator inside the last text band
  if (lastSep && lastSep.sep.kind !== 'none' && lastSep.sep.width > 0) {
    const w = lastSep.sep.width * lastSep.s,
      m = SEP_MARGIN * lastSep.s,
      path = ringPts(shape, size, inset + m + w / 2);
    if (path)
      ctx.items.push({
        type: 'separator',
        style: sid,
        kind: lastSep.sep.kind,
        path,
        width: w,
        ...circ(shape, size, inset + m + w / 2),
      });
    inset += w + 2 * m;
  } else if (lastSep) inset += lastSep.sep.width * lastSep.s + SEP_MARGIN * lastSep.s;
  const inner = shape.ring(size, inset);
  ctx.items.push({ type: 'outline', style: sid, outer, inner: inner?.pts ?? null });
  const res: RegionResult = {
    size,
    outer,
    inner,
    innerCircle: shape.kind === 'circle' ? size - inset : null,
    inset,
    lastScale: lastSep?.s ?? null,
  };
  if (node.fill) resolveFiller(node.fill, res, style, ctx, node);
  return res;
}

const add = (p: Pt, v: Pt, k: number): Pt => [p[0] + v[0] * k, p[1] + v[1] * k];
const circ = (shape: ShapeGeometry, size: number, inset: number) =>
  shape.kind === 'circle' ? { circle: { C: [0, 0] as Pt, r: size - inset } } : {};

/** Canvas rect minus the outline, as an even-odd area; and the clear spot in each corner of it, for stars. */
function spandrelArea(
  outer: Pt[],
  w: number,
  h: number,
  origin: Pt,
  inset: number,
): { area: Area; pockets: { c: Pt; r: number }[] } {
  const x0 = inset - origin[0],
    y0 = inset - origin[1],
    x1 = w - inset - origin[0],
    y1 = h - inset - origin[1];
  const box = (a: number, b: number, c: number, d: number): Pt[] => [
    [a, b],
    [c, b],
    [c, d],
    [a, d],
  ];
  const rect = box(x0, y0, x1, y1),
    D = (P: Pt[]) => P.map(([x, y]) => ({ x, y }));
  // the spandrel region (outer boundary plus the outline as a hole, by winding), clipped to each canvas quadrant
  const region = differenceD([D(rect)], [D(outer)], FillRule.NonZero, 4);
  const mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  const pockets = [box(x0, y0, mx, my), box(mx, y0, x1, my), box(x0, my, mx, y1), box(mx, my, x1, y1)]
    .map(q => intersectD(region, [D(q)], FillRule.NonZero, 4))
    .filter(ps => ps.length)
    .map(ps => {
      // polylabel wants the outer ring first, then holes
      const rings = ps.map(p => dedupe(p.map(v => [v.x, v.y] as Pt))).sort((a, b) => area(b) - area(a));
      const d = polylabel(rings, 0.05);
      return { c: [d[0], d[1]] as Pt, r: d.distance };
    });
  return { area: [orientCCW(rect), outer], pockets };
}

export function resolve(input: Composition | unknown, opts: ResolveOptions = {}): Placed {
  const comp = parseComposition(input);
  const ctx: Ctx = {
    comp,
    script: opts.script ?? scriptFor(comp.style),
    fixedScript: opts.script,
    styles: [],
    styleIndex: new Map(),
    items: [],
    borders: [],
    warnings: [],
    ring: 0,
    fill: null,
  };
  const style = inherit(comp.style, comp.root.style);
  const region = resolveRegion(comp.root.child, style, ctx);
  const outer = region?.outer ?? [];
  // canvas: the outline's bounds plus the margin, square or 3:4
  const b = bounds(
      outer.length
        ? outer
        : ([
            [-10, -10],
            [10, 10],
          ] as Pt[]),
    ),
    m = comp.canvas.margin;
  let w = b.x1 - b.x0 + 2 * m,
    h = b.y1 - b.y0 + 2 * m;
  if (comp.canvas.shape === 'square') w = h = Math.max(w, h);
  else if (comp.canvas.shape === 'portrait') {
    w = Math.max(w, (h * 3) / 4);
    h = Math.max(h, (w * 4) / 3);
  } else {
    h = Math.max(h, (w * 3) / 4);
    w = Math.max(w, (h * 4) / 3);
  }
  const origin: Pt = [w / 2 - (b.x0 + b.x1) / 2, h / 2 - (b.y0 + b.y1) / 2];
  const sp = comp.root.spandrels;
  if (sp && region) {
    const sid = styleId(ctx, style),
      { area, pockets } = spandrelArea(outer, w, h, origin, 0.6),
      centre: Pt = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2],
      radius = Math.hypot(w, h) / 2;
    if (sp.type === 'stars')
      pockets
        .filter(p => p.r > 1.5)
        .forEach(p => ctx.items.push({ type: 'star', style: sid, centre: p.c, r: p.r * 0.92 }));
    else if (sp.type === 'pattern')
      ctx.items.push({ type: 'spandrels', style: sid, kind: 'pattern', area, pattern: sp.pattern, centre, radius });
    else if (sp.type === 'iznik')
      ctx.items.push({ type: 'tilework', style: sid, area, centre, radius, iznik: sp.iznik });
    else if (sp.type === 'vine' || sp.type === 'solid')
      ctx.items.push({ type: 'spandrels', style: sid, kind: sp.type, area, centre, radius });
    else ctx.warnings.push(`spandrels of type ${sp.type} are not supported`);
  }
  return {
    version: 1,
    seed: comp.seed,
    canvas: { w, h, origin },
    styles: ctx.styles,
    items: ctx.items,
    meta: {
      size: region?.size ?? 0,
      outline: outer,
      borders: ctx.borders,
      fill: ctx.fill,
      warnings: ctx.warnings,
      inner: region && region.inner ? Math.sqrt(region.inner.area / Math.max(1e-9, area(outer))) : 0,
    },
  };
}

/** Outward offset helper (for spandrel frames and nested regions). */
export const outsetPts = (P: Pt[], d: number): Pt[] =>
  orientCCW(
    dedupe(
      inflatePathsD([P.map(([x, y]) => ({ x, y }))], d, JoinType.Miter, EndType.Polygon, 4, 4)[0].map(
        q => [q.x, q.y] as Pt,
      ),
    ),
  );
export { insetRing };
export type { FillerNode };
