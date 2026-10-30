// Fabrication output (COMPOSITION_ENGINE.md §9 Phase 6.8): single-line plotter paths, laser/CNC layers, and a relief
// depth map. Everything is derived from a Placed composition, so it matches what the renderer draws.
import { parseLines } from '../script/vector';
import type { Area, Placed } from '../compose/placed';
import { placeMap } from '../compose/textBorder';
import { offsetPolyline } from '../geometry/offset';
import type { Pt } from '../geometry/types';
import { picPath } from '../ornament/patterns/pic';
import { tiles } from '../ornament/patterns/tilings';
import type { Tiling } from '../ornament/patterns/tilings';
import { renderPlaced } from '../render/composition';
import { cornerPoints, smoothChain, strokeGraph } from '../render/strokes';
import { U, f2 } from '../render/svg';

export interface Polyline {
  pts: Pt[];
  closed: boolean;
  /** What it draws, so outputs can be split into pens or layers. */
  kind: 'outline' | 'letter' | 'mark' | 'separator' | 'rule' | 'pattern';
}

const TILING: Record<string, Tiling> = {
  square: 'sq',
  '488': '488',
  hex: 'hex',
  '31212': '31212',
  mg8: 'mg8',
  mg10: 'mg10',
  mg12: 'mg12',
};

/** Inside test for an even-odd area. */
function insideArea(a: Area, x: number, y: number): boolean {
  let c = false;
  for (const P of a)
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i],
        [xj, yj] = P[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  return c;
}
/** The parts of segment ab inside an even-odd area. */
function clipSegment(a: Pt, b: Pt, area: Area): [Pt, Pt][] {
  const ts = [0, 1];
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  for (const P of area)
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [x1, y1] = P[j],
        [x2, y2] = P[i],
        ex = x2 - x1,
        ey = y2 - y1,
        den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((x1 - a[0]) * ey - (y1 - a[1]) * ex) / den,
        u = ((x1 - a[0]) * dy - (y1 - a[1]) * dx) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
  ts.sort((p, q) => p - q);
  const out: [Pt, Pt][] = [];
  for (let k = 0; k + 1 < ts.length; k++) {
    const t0 = ts[k],
      t1 = ts[k + 1];
    if (t1 - t0 < 1e-9) continue;
    const m = (t0 + t1) / 2;
    if (insideArea(area, a[0] + dx * m, a[1] + dy * m))
      out.push([
        [a[0] + dx * t0, a[1] + dy * t0],
        [a[0] + dx * t1, a[1] + dy * t1],
      ]);
  }
  return out;
}

export interface CentrelineOptions {
  /** Corner rounding in cells (0 = sharp, as on the grid). */
  curve?: number;
  /** Include star patterns (clipped to their areas). */
  patterns?: boolean;
}

/** Every drawable line of a composition as polylines in output units (the renderer's coordinates). Letters become
 *  their stroke centrelines; dots small diamonds; bands their edge rules; patterns their line work. */
export function centrelines(placed: Placed, o: CentrelineOptions = {}): Polyline[] {
  const [ox, oy] = placed.canvas.origin,
    P = (p: Pt): Pt => [(ox + p[0]) * U, (oy + p[1]) * U],
    R = Math.max(0, o.curve ?? 0.6) * 1.6,
    out: Polyline[] = [];
  const letters = (w: number, h: number, at: (x: number, y: number) => number, map: (x: number, y: number) => Pt) => {
    const { chains } = strokeGraph(w, h, (x, y) => {
      const v = at(x, y);
      return v === 1 || v === 4;
    });
    for (const ch of chains) {
      if (ch.pts.length === 1) {
        const [x, y] = ch.pts[0];
        out.push({ pts: [map(x + 0.25, y + 0.5), map(x + 0.75, y + 0.5)], closed: false, kind: 'letter' });
        continue;
      }
      out.push({
        pts: smoothChain(cornerPoints(ch.pts, ch.closed), ch.closed, R).map(([x, y]) => map(x, y)),
        closed: ch.closed,
        kind: 'letter',
      });
    }
    // dots and vowels: a small diamond per cell
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = at(x, y);
        if (v !== 2 && v !== 3) continue;
        out.push({
          pts: [map(x + 0.5, y + 0.15), map(x + 0.85, y + 0.5), map(x + 0.5, y + 0.85), map(x + 0.15, y + 0.5)],
          closed: true,
          kind: 'mark',
        });
      }
  };
  out.push({ pts: placed.meta.outline.map(P), closed: true, kind: 'outline' });
  for (const it of placed.items) {
    if (it.type === 'strip' && it.strip.kind === 'vector') {
      // a pen-stroke script: the pen's own centrelines
      const cell = placeMap(it.place);
      for (const l of it.strip.lines ?? [])
        for (const q of parseLines(l.d))
          out.push({
            pts: q.map(([x, y]) => P(cell(x, y))),
            closed: false,
            kind: l.role === 'letter' ? 'letter' : 'mark',
          });
    } else if (it.type === 'strip' && it.strip.kind === 'cells') {
      const st = it.strip,
        cell = placeMap(it.place);
      letters(
        st.W,
        st.Hb,
        (x, y) => (x < 0 || y < 0 || x >= st.W || y >= st.Hb ? 0 : st.data[y * st.W + x]),
        (x, y) => P(cell(x, y)),
      );
    } else if (it.type === 'grid') {
      const g = it.grid,
        [gx, gy] = P(it.at),
        s = it.cell * U;
      letters(
        g.w,
        g.h,
        (x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? 0 : g.data[y * g.w + x]),
        (x, y) => [gx + x * s, gy + y * s],
      );
    } else if (it.type === 'separator') {
      for (const d of [-it.width / 2, it.width / 2])
        for (const ring of offsetPolyline(it.path, d).slice(0, 1))
          out.push({ pts: ring.map(P), closed: true, kind: 'separator' });
    } else if (it.type === 'rule') out.push({ pts: it.path.map(P), closed: true, kind: 'rule' });
    else if (it.type === 'ribbon')
      for (const q of it.paths) out.push({ pts: q.map(P), closed: false, kind: 'separator' });
    else if (o.patterns !== false && (it.type === 'pattern' || it.type === 'ground' || it.type === 'spandrels')) {
      if (!it.pattern || (it.type !== 'pattern' && it.kind !== 'pattern')) continue;
      const [cx, cy] = P(it.centre),
        d = picPath(
          tiles(TILING[it.pattern.tiling] ?? '488', it.pattern.scale * U, cx, cy, it.radius * U),
          (it.pattern.angle * Math.PI) / 180,
        ),
        area = it.area.map(r => r.map(P));
      for (const sub of d.split('M').filter(Boolean)) {
        const pts = sub
          .split('L')
          .map(q => q.trim().split(/[ ,]+/).map(Number) as Pt)
          .filter(q => q.length === 2 && q.every(Number.isFinite));
        for (let k = 0; k + 1 < pts.length; k++)
          for (const [a, b] of clipSegment(pts[k], pts[k + 1], area))
            out.push({ pts: [a, b], closed: false, kind: 'pattern' });
      }
    }
  }
  return out;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Order polylines to keep pen-up travel short: greedy nearest start or end (open lines may be reversed), within
 *  each kind in drawing order. */
export function orderForPlotting(lines: Polyline[]): { lines: Polyline[]; draw: number; travel: number } {
  const order: Polyline['kind'][] = ['pattern', 'separator', 'rule', 'letter', 'mark', 'outline'];
  const res: Polyline[] = [];
  let at: Pt = [0, 0],
    travel = 0,
    draw = 0;
  for (const kind of order) {
    const left = lines.filter(l => l.kind === kind && l.pts.length);
    while (left.length) {
      let bi = 0,
        rev = false,
        bd = Infinity;
      for (let i = 0; i < left.length; i++) {
        const l = left[i],
          d0 = dist(at, l.pts[0]);
        if (d0 < bd) [bd, bi, rev] = [d0, i, false];
        if (!l.closed) {
          const d1 = dist(at, l.pts[l.pts.length - 1]);
          if (d1 < bd) [bd, bi, rev] = [d1, i, true];
        }
      }
      const l = left.splice(bi, 1)[0],
        pts = rev ? l.pts.slice().reverse() : l.pts;
      travel += bd;
      for (let k = 1; k < pts.length; k++) draw += dist(pts[k - 1], pts[k]);
      if (l.closed) draw += dist(pts[pts.length - 1], pts[0]);
      at = l.closed ? pts[0] : pts[pts.length - 1];
      res.push({ ...l, pts });
    }
  }
  return { lines: res, draw, travel };
}

export interface SizeOptions {
  /** Output width in millimetres (the height follows the composition). */
  widthMM?: number;
}
const svgOpen = (placed: Placed, widthMM: number, extra = '') => {
  const W = placed.canvas.w * U,
    H = placed.canvas.h * U,
    hMM = (widthMM * H) / W;
  return `<svg xmlns="http://www.w3.org/2000/svg"${extra} viewBox="0 0 ${f2(W)} ${f2(H)}" width="${f2(widthMM)}mm" height="${f2(hMM)}mm">`;
};
const dOf = (l: Polyline) => 'M' + l.pts.map(([x, y]) => f2(x) + ' ' + f2(y)).join('L') + (l.closed ? 'Z' : '');

/** A pen plotter drawing: one stroked path per line, in plotting order, grouped by kind (one pen per group). */
export function plotterSVG(placed: Placed, o: CentrelineOptions & SizeOptions & { penMM?: number } = {}): string {
  const widthMM = o.widthMM ?? 200,
    { lines } = orderForPlotting(centrelines(placed, o)),
    sw = ((o.penMM ?? 0.3) * placed.canvas.w * U) / widthMM;
  const groups = new Map<string, string[]>();
  for (const l of lines) {
    if (!groups.has(l.kind)) groups.set(l.kind, []);
    groups.get(l.kind)!.push(`<path d="${dOf(l)}"/>`);
  }
  const body = [...groups]
    .map(
      ([k, ps]) =>
        `<g id="pen-${k}" fill="none" stroke="#000" stroke-width="${f2(sw)}" stroke-linecap="round" stroke-linejoin="round">${ps.join('')}</g>`,
    )
    .join('');
  return svgOpen(placed, widthMM) + body + '</svg>';
}

type LayerColours = { fill?: string; stroke?: string; paper?: string };
/** Recolour every fill and stroke inside each top-level layer group (layers are sequential <g data-layer> groups).
 *  Paper-coloured details (halos, cut-outs) take the layer's `paper` colour; pattern fills (url) count as fills. */
function recolour(svg: string, colours: Record<string, LayerColours | null>, paper: string) {
  const isPaper = (v: string) => v.toLowerCase() === paper.toLowerCase();
  return svg
    .split(/(?=<g data-layer=")/)
    .map(part => {
      const m = /^<g data-layer="([a-z]+)"/.exec(part),
        c = m ? colours[m[1]] : undefined;
      if (!m || !c) return part;
      const to = (v: string, set: string | undefined) =>
        v === 'none' ? v : isPaper(v) ? (c.paper ?? '#ffffff') : (set ?? v);
      return part
        .replace(/fill="(#[0-9a-fA-F]{3,8}|[a-z]+|url\(#[^)]*\))"/g, (_, v) => `fill="${to(v, c.fill)}"`)
        .replace(/stroke="(#[0-9a-fA-F]{3,8}|[a-z]+)"/g, (_, v) => `stroke="${to(v, c.stroke)}"`);
    })
    .join('');
}

/** Laser or CNC: layers named for the usual colour conventions (Inkscape layers, LightBurn colours): the outline as
 *  a red cut line, letters as black engraving, bands and patterns as blue scoring. Letters are drawn solid. */
export function laserSVG(placed: Placed, o: SizeOptions & { cutMM?: number } = {}): string {
  const widthMM = o.widthMM ?? 200,
    solid: Placed = { ...placed, styles: placed.styles.map(s => ({ ...s, stroke: { ...s.stroke, banded: false } })) },
    paper = solid.styles[0].palette.paper;
  let svg = renderPlaced(solid, { idPrefix: 'laser' });
  svg = recolour(
    svg,
    {
      ground: { fill: 'none', stroke: '#0000ff', paper: 'none' },
      pattern: { fill: 'none', stroke: '#0000ff', paper: 'none' },
      spandrels: { fill: 'none', stroke: '#0000ff', paper: 'none' },
      letters: { fill: '#000000', stroke: '#000000', paper: '#ffffff' },
      separators: { fill: 'none', stroke: '#0000ff', paper: 'none' },
      features: { fill: 'none', stroke: '#0000ff', paper: 'none' },
    },
    paper,
  );
  const names: Record<string, string> = {
    ground: 'score-ground',
    pattern: 'score-pattern',
    spandrels: 'score-corners',
    letters: 'engrave-letters',
    separators: 'score-bands',
    features: 'score-features',
  };
  svg = svg.replace(
    /<g data-layer="([a-z]+)"/g,
    (_, l) => `<g data-layer="${l}" inkscape:groupmode="layer" inkscape:label="${names[l] ?? l}"`,
  );
  const W = placed.canvas.w * U,
    sw = ((o.cutMM ?? 0.1) * W) / widthMM,
    [ox, oy] = placed.canvas.origin,
    cut = `<g data-layer="cut" inkscape:groupmode="layer" inkscape:label="cut-outline" fill="none" stroke="#ff0000" stroke-width="${f2(sw)}"><path d="M${placed.meta.outline.map(p => f2((ox + p[0]) * U) + ' ' + f2((oy + p[1]) * U)).join('L')}Z"/></g>`;
  // white sheet, then the layers, with physical size
  return svg
    .replace(/^<svg [^>]*>/, svgOpen(placed, widthMM, ' xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"'))
    .replace(/(<rect [^>]*fill=")[^"]*(")/, '$1#ffffff$2')
    .replace(/<\/svg>$/, cut + '</svg>');
}

/** The relief map's heights (0..1). */
export const RELIEF_LEVELS = { floor: 0, ground: 0.25, pattern: 0.4, bands: 0.65, letters: 1 };

/** Relief depth map: white is high. Letters stand highest, bands and ornaments below them, patterns in low relief on
 *  the ground; outside the outline is the floor (black). Rasterise to a greyscale PNG for 3D printing or carving. */
export function reliefSVG(
  placed: Placed,
  o: { levels?: Partial<Record<'floor' | 'ground' | 'pattern' | 'bands' | 'letters', number>> } = {},
): string {
  const L = { ...RELIEF_LEVELS, ...o.levels },
    grey = (v: number) => {
      const h = Math.round(Math.max(0, Math.min(1, v)) * 255)
        .toString(16)
        .padStart(2, '0');
      return `#${h}${h}${h}`;
    };
  const solid: Placed = {
      ...placed,
      styles: placed.styles.map(s => ({ ...s, stroke: { ...s.stroke, banded: false } })),
    },
    paper = solid.styles[0].palette.paper;
  let svg = renderPlaced(solid, { idPrefix: 'relief' });
  svg = recolour(
    svg,
    {
      ground: { fill: grey(L.ground), stroke: grey(L.ground), paper: grey(L.ground) },
      pattern: { fill: grey(L.pattern), stroke: grey(L.pattern), paper: grey(L.ground) },
      spandrels: { fill: grey(L.ground), stroke: grey(L.pattern), paper: grey(L.ground) },
      // halos where strands cross stay at letter height (the strands merge in relief)
      letters: { fill: grey(L.letters), stroke: grey(L.letters), paper: grey(L.letters) },
      separators: { fill: grey(L.bands), stroke: grey(L.bands), paper: grey(L.ground) },
      features: { fill: grey(L.bands), stroke: grey(L.bands), paper: grey(L.ground) },
    },
    paper,
  );
  // the floor outside, the ground inside the outline
  const [ox, oy] = placed.canvas.origin,
    base = `<path fill="${grey(L.ground)}" d="M${placed.meta.outline.map(p => f2((ox + p[0]) * U) + ' ' + f2((oy + p[1]) * U)).join('L')}Z"/>`;
  return svg.replace(/(<rect [^>]*fill=")[^"]*("\/>)/, `$1${grey(L.floor)}$2${base}`);
}
