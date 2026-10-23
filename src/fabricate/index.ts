// Fabrication output (COMPOSITION_ENGINE.md §9 Phase 6.8): single-line plotter paths, laser/CNC layers, and a relief
// depth map. Everything is derived from a Placed composition, so it matches what the renderer draws.
import { parseLines } from '../script/vector';
import type { Area, Placed, PlacedItem } from '../compose/placed';
import { placeMap } from '../compose/textBorder';
import { inflate, offsetPolyline } from '../geometry/offset';
import type { Pt } from '../geometry/types';
import { picPath } from '../ornament/patterns/pic';
import { tiles } from '../ornament/patterns/tilings';
import type { Tiling } from '../ornament/patterns/tilings';
import { renderPlaced } from '../render/composition';
import { cornerPoints, smoothChain, strokeGraph } from '../render/strokes';
import { outline as unionOutline } from '../script/thuluth/outline';
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

type RoundelItem = Extract<PlacedItem, { type: 'roundel' }>;
type TileworkItem = Extract<PlacedItem, { type: 'tilework' }>;

/** Subpaths of SVG path data as this code writes it (absolute M, L, H, V, Q, C, Z), curves sampled into segments. */
export function flattenPath(d: string, steps = 8): { pts: Pt[]; closed: boolean }[] {
  const tok = d.match(/[MLHVQCZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [],
    out: { pts: Pt[]; closed: boolean }[] = [];
  let i = 0,
    cmd = '',
    cur: Pt = [0, 0],
    sub: { pts: Pt[]; closed: boolean } | null = null;
  const num = () => +tok[i++];
  const to = (p: Pt) => {
    sub!.pts.push(p);
    cur = p;
  };
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') {
      sub = { pts: [], closed: false };
      out.push(sub);
      to([num(), num()]);
      cmd = 'L';
    } else if (cmd === 'L') to([num(), num()]);
    else if (cmd === 'H') to([num(), cur[1]]);
    else if (cmd === 'V') to([cur[0], num()]);
    else if (cmd === 'Q' || cmd === 'C') {
      const c: Pt[] = [cur];
      for (let k = cmd === 'Q' ? 2 : 3; k > 0; k--) c.push([num(), num()]);
      for (let k = 1; k <= steps; k++) {
        const t = k / steps,
          u = 1 - t;
        to(
          c.length === 3
            ? [u * u * c[0][0] + 2 * u * t * c[1][0] + t * t * c[2][0], u * u * c[0][1] + 2 * u * t * c[1][1] + t * t * c[2][1]] // prettier-ignore
            : [u * u * u * c[0][0] + 3 * u * u * t * c[1][0] + 3 * u * t * t * c[2][0] + t * t * t * c[3][0], u * u * u * c[0][1] + 3 * u * u * t * c[1][1] + 3 * u * t * t * c[2][1] + t * t * t * c[3][1]], // prettier-ignore
        );
      }
    } else if (cmd === 'Z' || cmd === 'z') {
      if (sub) {
        sub.closed = true;
        cur = sub.pts[0];
      }
      cmd = '';
    } else i++; // a command this code never writes: skip its numbers
  }
  return out.filter(q => q.pts.length > 1);
}

const ellipsePts = (cx: number, cy: number, rx: number, ry: number, n = 180): Pt[] =>
  Array.from({ length: n }, (_, k) => [cx + rx * Math.cos((2 * Math.PI * k) / n), cy + ry * Math.sin((2 * Math.PI * k) / n)]); // prettier-ignore

/** A roundel's frame as the renderer draws it (outer rim, inner rim line, field edge), in its own units, and the map
 *  from its units onto the canvas. */
function roundelFrame(it: RoundelItem, P: (p: Pt) => Pt) {
  const [px, py] = P(it.centre),
    k = it.s * U,
    Rout = it.Rf + it.rim,
    wide = Rout * it.oval - Rout,
    rims: [number, number][] = it.framed
      ? [[Rout + it.rim * (it.oval - 1) + wide, Rout], ...(it.rimStyle === 'single' ? [] : [[Rout - it.rim * 0.32 + wide, Rout - it.rim * 0.32] as [number, number]])] // prettier-ignore
      : [];
  return {
    map: ([x, y]: Pt): Pt => [px + x * k, py + y * k],
    rims,
    field: [it.Rf + wide, it.Rf] as [number, number],
    at: `translate(${f2(px)} ${f2(py)}) scale(${f2(k)})`,
  };
}

/** On screen a roundel covers the tiles under it; to cut, score or plot, the tiles must stop at its rim: each
 *  roundel's outer rim becomes a hole in the tilework areas round it (the areas are even-odd). */
function tilesAroundRoundels(placed: Placed): Placed {
  const rims = placed.items
    .filter((i): i is RoundelItem => i.type === 'roundel')
    .map(it => {
      const fr = roundelFrame(it, p => p),
        [rx, ry] = fr.rims[0] ?? fr.field;
      // in canvas cells about the roundel's centre
      return {
        centre: it.centre,
        ring: ellipsePts(0, 0, rx, ry, 120).map(([x, y]): Pt => [it.centre[0] + x * it.s, it.centre[1] + y * it.s]),
      };
    });
  if (!rims.length) return placed;
  return {
    ...placed,
    items: placed.items.map(i =>
      i.type === 'tilework'
        ? { ...i, area: [...i.area, ...rims.filter(r => insideArea(i.area, ...r.centre)).map(r => r.ring)] }
        : i,
    ),
  };
}

/** Every shape of some SVG as polylines (paths and circles; definitions such as clip paths left out). */
function svgShapes(svg: string): { pts: Pt[]; closed: boolean }[] {
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '').replace(/<clipPath[\s\S]*?<\/clipPath>/g, '');
  const out: { pts: Pt[]; closed: boolean }[] = [];
  for (const m of body.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)) out.push(...flattenPath(m[1]));
  for (const m of body.matchAll(/<circle\b[^>]*>/g)) {
    const a = (n: string) => +(new RegExp(`\\b${n}="([^"]+)"`).exec(m[0])?.[1] ?? NaN);
    if ([a('cx'), a('cy'), a('r')].every(Number.isFinite))
      out.push({ pts: ellipsePts(a('cx'), a('cy'), a('r'), a('r'), 24), closed: true });
  }
  return out;
}

/** A polyline clipped to an area, as the runs of it inside (whole stretches kept together, so the plotter draws them
 *  in one go). */
function clipRuns(pts: Pt[], closed: boolean, area: Area): Pt[][] {
  const seq = closed ? [...pts, pts[0]] : pts,
    runs: Pt[][] = [];
  let run: Pt[] | null = null;
  for (let k = 0; k + 1 < seq.length; k++) {
    const parts = clipSegment(seq[k], seq[k + 1], area);
    for (const [a, b] of parts) {
      const joins = run && Math.hypot(run[run.length - 1][0] - a[0], run[run.length - 1][1] - a[1]) < 1e-6;
      if (joins) run!.push(b);
      else runs.push((run = [a, b]));
    }
    if (!parts.length) run = null;
  }
  return runs;
}

export interface CentrelineOptions {
  /** Corner rounding in cells (0 = sharp, as on the grid). */
  curve?: number;
  /** Include star patterns and tilework (clipped to their areas). */
  patterns?: boolean;
  /** Pen-script letters (a thuluth roundel): their outlines, drawn round (the default, which keeps the pen's thick and
   *  thin), or the pen's centreline. */
  pen?: 'outline' | 'centre';
}

/** Every drawable line of a composition as polylines in output units (the renderer's coordinates). Letters become
 *  their stroke centrelines; dots small diamonds; bands their edge rules; patterns their line work. */
export function centrelines(input: Placed, o: CentrelineOptions = {}): Polyline[] {
  const placed = tilesAroundRoundels(input),
    [ox, oy] = placed.canvas.origin,
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
    if (it.type === 'roundel') {
      const fr = roundelFrame(it, P),
        shape = (q: { pts: Pt[]; closed: boolean }, kind: Polyline['kind']) =>
          out.push({ pts: q.pts.map(fr.map), closed: q.closed, kind });
      for (const [rx, ry] of [...fr.rims, ...(it.framed ? [fr.field] : [])])
        out.push({ pts: ellipsePts(0, 0, rx, ry).map(fr.map), closed: true, kind: 'rule' });
      if (o.pen === 'centre') {
        for (const q of flattenPath(it.lines)) shape(q, 'letter');
        for (const q of flattenPath(it.lineMarks)) shape(q, 'mark');
      } else {
        // the union of the pen's shapes: one outline per connected shape, a counter wound the other way
        const signed = (q: Pt[]) => q.reduce((a, [x, y], k) => a + x * q[(k + 1) % q.length][1] - q[(k + 1) % q.length][0] * y, 0) / 2; // prettier-ignore
        // every piece of ink wound the same way, so none cancels another where they overlap
        const polysOf = (ds: string[]) =>
          ds.flatMap(d => flattenPath(d).map(q => q.pts)).map(q => (signed(q) < 0 ? q.slice().reverse() : q));
        // the letters closed and opened (grown, shrunk and grown back by a tenth of a pen unit), which fills the
        // hairline slits and takes off the whiskers where the nib's quads meet: on screen the fill hides them, an
        // outline traces them. The marks are too fine for that, so they are only joined
        const letters = inflate(inflate(inflate(unionOutline(polysOf([it.ink.slice(0, it.markFrom), ...it.tints.map(t => t.d)]), 0.02), 0.1), -0.2), 0.1), // prettier-ignore
          marks = unionOutline(polysOf([it.ink.slice(it.markFrom)]), 0.02);
        for (const q of letters) if (Math.abs(signed(q)) > 0.04) shape({ pts: q, closed: true }, 'letter');
        for (const q of marks) if (Math.abs(signed(q)) > 0.01) shape({ pts: q, closed: true }, 'mark');
      }
    } else if (it.type === 'tilework') {
      if (o.patterns === false) continue;
      const area = it.area.map(r => r.map(P));
      for (const q of svgShapes(renderPlaced({ ...placed, items: [it] }, { idPrefix: 'fab' })))
        for (const run of clipRuns(q.pts, q.closed, area)) out.push({ pts: run, closed: false, kind: 'pattern' });
    } else if (it.type === 'strip' && it.strip.kind === 'vector') {
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

/** A layer's colours; `outline` (a stroke width) gives every shape left without fill or stroke an outline in the
 *  stroke colour, so filled tiles score as their outlines. */
type LayerColours = { fill?: string; stroke?: string; paper?: string; outline?: number };
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
      const done = part
        .replace(/fill="(#[0-9a-fA-F]{3,8}|[a-z]+|url\(#[^)]*\))"/g, (_, v) => `fill="${to(v, c.fill)}"`)
        .replace(/stroke="(#[0-9a-fA-F]{3,8}|[a-z]+)"/g, (_, v) => `stroke="${to(v, c.stroke)}"`);
      return c.outline == null
        ? done
        : done.replace(/<(path|circle|ellipse)\b(?![^>]*\bstroke=)([^>]*?)(\/?)>/g, (m, tag, attrs, end) =>
            /\bfill="none"/.test(attrs)
              ? `<${tag}${attrs} stroke="${c.stroke}" stroke-width="${f2(c.outline!)}"${end}>`
              : m,
          );
    })
    .join('');
}

const body = (svg: string) =>
  svg
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/^<rect [^>]*\/>/, '');
/** The composition drawn for fabrication with its tilework (as a layer of its own, under everything) and roundels left
 *  out, for each output to give them their own colours: a roundel's field, rim and letters are told apart. */
function fabRender(input: Placed, idPrefix: string) {
  const placed = tilesAroundRoundels(input),
    own = (i: PlacedItem) => i.type === 'tilework' || i.type === 'roundel',
    base = renderPlaced({ ...placed, items: placed.items.filter(i => !own(i)) }, { idPrefix }),
    tiles = placed.items.filter((i): i is TileworkItem => i.type === 'tilework'),
    tileSvg = tiles.length
      ? body(renderPlaced({ ...placed, items: tiles }, { idPrefix: idPrefix + 't' })).replace(/data-layer="ground"/g, 'data-layer="tiles"') // prettier-ignore
      : '',
    at = base.search(/<g data-layer="/),
    svg = at < 0 ? base.replace(/<\/svg>$/, tileSvg + '</svg>') : base.slice(0, at) + tileSvg + base.slice(at);
  const [ox, oy] = placed.canvas.origin,
    P = (p: Pt): Pt => [(ox + p[0]) * U, (oy + p[1]) * U];
  return {
    svg,
    roundels: placed.items.filter((i): i is RoundelItem => i.type === 'roundel').map(it => ({ it, fr: roundelFrame(it, P) })), // prettier-ignore
  };
}
const ell = ([rx, ry]: [number, number], attrs: string) =>
  `<ellipse cx="0" cy="0" rx="${f2(rx)}" ry="${f2(ry)}" ${attrs}/>`;
const roundelInk = (it: RoundelItem, fill: string) =>
  `<path fill="${fill}" d="${it.ink}"/>` + it.tints.map(t => `<path fill="${fill}" d="${t.d}"/>`).join('');

/** Laser or CNC: layers named for the usual colour conventions (Inkscape layers, LightBurn colours): the outline as
 *  a red cut line, letters as black engraving, bands and patterns as blue scoring. Letters are drawn solid. */
export function laserSVG(placed: Placed, o: SizeOptions & { cutMM?: number } = {}): string {
  const widthMM = o.widthMM ?? 200,
    solid: Placed = { ...placed, styles: placed.styles.map(s => ({ ...s, stroke: { ...s.stroke, banded: false } })) },
    paper = solid.styles[0].palette.paper,
    W = placed.canvas.w * U,
    sw = ((o.cutMM ?? 0.1) * W) / widthMM,
    fab = fabRender(solid, 'laser');
  let svg = recolour(
    fab.svg,
    {
      tiles: { fill: 'none', stroke: '#0000ff', paper: 'none', outline: sw },
      ground: { fill: 'none', stroke: '#0000ff', paper: 'none' },
      pattern: { fill: 'none', stroke: '#0000ff', paper: 'none' },
      spandrels: { fill: 'none', stroke: '#0000ff', paper: 'none' },
      letters: { fill: '#000000', stroke: '#000000', paper: '#ffffff' },
      separators: { fill: 'none', stroke: '#0000ff', paper: 'none' },
      features: { fill: 'none', stroke: '#0000ff', paper: 'none' },
    },
    paper,
  );
  // roundels: the letters engraved, the rim scored, the field left
  svg = svg.replace(
    /<\/svg>$/,
    fab.roundels
      .map(
        ({ it, fr }) =>
          `<g data-layer="features"><g transform="${fr.at}" fill="none" stroke="#0000ff" stroke-width="${f2(sw)}">${[...fr.rims, fr.field].map(r => ell(r, 'vector-effect="non-scaling-stroke"')).join('')}</g></g>` + // prettier-ignore
          `<g data-layer="letters"><g transform="${fr.at}">${roundelInk(it, '#000000')}</g></g>`,
      )
      .join('') + '</svg>',
  );
  const names: Record<string, string> = {
    tiles: 'score-tiles',
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
  const [ox, oy] = placed.canvas.origin,
    cut = `<g data-layer="cut" inkscape:groupmode="layer" inkscape:label="cut-outline" fill="none" stroke="#ff0000" stroke-width="${f2(sw)}"><path d="M${placed.meta.outline.map(p => f2((ox + p[0]) * U) + ' ' + f2((oy + p[1]) * U)).join('L')}Z"/></g>`;
  // white sheet, then the layers, with physical size
  return svg
    .replace(/^<svg [^>]*>/, svgOpen(placed, widthMM, ' xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"'))
    .replace(/(<rect [^>]*fill=")[^"]*(")/, '$1#ffffff$2')
    .replace(/<\/svg>$/, cut + '</svg>');
}

/** Relief depth map: white is high. Letters stand highest, bands and ornaments below them, patterns in low relief on
 *  the ground; outside the outline is the floor (black). Rasterise to a greyscale PNG for 3D printing or carving. */
export function reliefSVG(
  placed: Placed,
  o: { levels?: Partial<Record<'floor' | 'ground' | 'pattern' | 'field' | 'bands' | 'letters', number>> } = {},
): string {
  const L = { floor: 0, ground: 0.25, pattern: 0.4, field: 0.5, bands: 0.65, letters: 1, ...o.levels },
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
    paper = solid.styles[0].palette.paper,
    fab = fabRender(solid, 'relief');
  let svg = recolour(
    fab.svg,
    {
      // tiles in low relief: their figures raised off their own ground
      tiles: { fill: grey(L.pattern), stroke: grey(L.pattern), paper: grey(L.ground) },
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
  // roundels: the rim as a band, the field a step below it, the letters standing highest
  svg = svg.replace(
    /<\/svg>$/,
    fab.roundels
      .map(
        ({ it, fr }) =>
          `<g data-layer="letters"><g transform="${fr.at}">${fr.rims.slice(0, 1).map(r => ell(r, `fill="${grey(L.bands)}"`)).join('')}${ell(fr.field, `fill="${grey(L.field)}"`)}${roundelInk(it, grey(L.letters))}</g></g>`, // prettier-ignore
      )
      .join('') + '</svg>',
  );
  // the floor outside, the ground inside the outline
  const [ox, oy] = placed.canvas.origin,
    base = `<path fill="${grey(L.ground)}" d="M${placed.meta.outline.map(p => f2((ox + p[0]) * U) + ' ' + f2((oy + p[1]) * U)).join('L')}Z"/>`;
  return svg.replace(/(<rect [^>]*fill=")[^"]*("\/>)/, `$1${grey(L.floor)}$2${base}`);
}
