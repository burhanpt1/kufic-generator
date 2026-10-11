// Placed -> SVG (COMPOSITION_ENGINE.md §6). One SVG per composition, built from layers in z-order (ground,
// patterns, spandrels, letters, separators, features). Every id (clip paths, patterns, gradients) carries a
// per-render prefix, so several compositions can be inlined on one page.
import type { Area, Placed, PlacedItem, StripPlace } from '../compose/placed';
import { LAYER_ORDER, layerOf } from '../compose/placed';
import { placeMap } from '../compose/textBorder';
import type { Pt, Run } from '../geometry/types';
import { frameAt } from '../geometry/runs';
import { offsetPolyline } from '../geometry/offset';
import type { Style } from '../model/schema';
import { numberSVG } from '../ornament/numerals';
import { picPath } from '../ornament/patterns/pic';
import { tiles } from '../ornament/patterns/tilings';
import { starSVG, vineDefs } from '../ornament/stars';
import type { CellStrip } from '../script/types';
import { gridSource, letterShapes } from './letters';
import { NIB, nibSweep, simplify } from './strokes';
import type { Source } from './letters';
import type { RenderOptions, Shapes } from './svg';
import { U, acc, diamond, f2, groupsOut, merge, mix, wrap } from './svg';

export interface RenderPlacedOptions {
  /** Prefix for every id in the SVG; default derived from the seed. */
  idPrefix?: string;
  label?: string;
}

const TILING: Record<string, RenderOptions['tiling']> = { square: 'sq', '488': '488', hex: 'hex', '31212': '31212' };

export function renderOptions(s: Style, label = ''): RenderOptions {
  return {
    weight: s.stroke.weight,
    soft: s.stroke.softness,
    ink: s.palette.ink,
    ink2: s.palette.ink2,
    paper: s.palette.paper,
    mark: s.palette.mark,
    grid: false,
    label,
    terminal: s.terminals.kind,
    colourMode: s.colouring === 'byRing' ? 'ring' : s.colouring === 'byRepeat' ? 'repeat' : s.colouring,
    ground: 'plain',
    corners: 'none',
    bandStyle: 'lines',
    tiling: '488',
    geoAngle: 67,
    geoScale: 5,
    letterStyle: s.stroke.banded ? 'banded' : 'solid',
    stroke: s.stroke.kind,
    curve: s.stroke.corner,
  };
}

/** A finial filling the clear space at a sharp tip: a spine with diamonds narrowing towards the point (lab finialSVG). */
function finialSVG(B: Pt, bis: Pt, phi: number, L: number, maxR: number, colour: string) {
  const tanh = Math.tan(Math.min(phi, Math.PI * 0.95) / 2),
    perp: Pt = [-bis[1], bis[0]],
    pt = (x: number, y: number): Pt => [B[0] + bis[0] * x + perp[0] * y, B[1] + bis[1] * x + perp[1] * y];
  let g = '';
  const sp0 = pt(L * 0.2, 0),
    sp1 = pt(L * 0.98, 0);
  g += `<line x1="${f2(sp0[0])}" y1="${f2(sp0[1])}" x2="${f2(sp1[0])}" y2="${f2(sp1[1])}" stroke="${colour}" stroke-width="${f2(maxR * 0.16)}"/>`;
  [0.36, 0.62, 0.86].forEach((fr, i) => {
    const x = L * fr,
      r = Math.min(0.62 * x * tanh, maxR * (0.55 + 0.25 * i));
    if (r < 0.8) return;
    const q = [pt(x - r, 0), pt(x, r * 0.62), pt(x + r, 0), pt(x, -r * 0.62)];
    g += `<path fill="${colour}" d="M${q.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L')}Z"/>`;
  });
  const tip = pt(L * 0.16, 0),
    rt = Math.min(L * 0.16 * tanh * 0.7, maxR * 0.35);
  if (rt > 0.6) g += `<circle cx="${f2(tip[0])}" cy="${f2(tip[1])}" r="${f2(rt)}" fill="${colour}"/>`;
  return g;
}

export function renderPlaced(placed: Placed, opts: RenderPlacedOptions = {}): string {
  const pfx = (opts.idPrefix ?? `k${placed.seed.toString(36)}`) + '-';
  const [ox, oy] = placed.canvas.origin,
    W = placed.canvas.w * U,
    H = placed.canvas.h * U;
  const P = (p: Pt): Pt => [(ox + p[0]) * U, (oy + p[1]) * U];
  const dRing = (pts: Pt[]) =>
    'M' +
    pts
      .map(p => P(p))
      .map(([x, y]) => f2(x) + ' ' + f2(y))
      .join('L') +
    'Z';
  const dArea = (a: Area) => a.map(dRing).join(' ');
  const root = placed.styles[0];
  const ropt = (i: number) => renderOptions(placed.styles[i] ?? root, opts.label ?? '');
  const layers: Record<string, string> = Object.fromEntries(LAYER_ORDER.map(l => [l, '']));
  let defs = '',
    nId = 0;
  const id = (k: string) => `${pfx}${k}${nId++}`;
  // star patterns: one path per pattern (same tiling, angle, scale and centre), drawn once in defs over the largest
  // radius any item needs and reused under each item's clip, instead of once per band
  type PatItem = Extract<PlacedItem, { type: 'ground' | 'pattern' | 'spandrels' }>;
  const patKey = (it: PatItem) => JSON.stringify([it.pattern ? patOpts(it.pattern) : null, it.centre]);
  const patR = new Map<string, number>();
  for (const it of placed.items)
    if ((it.type === 'ground' || it.type === 'spandrels' || it.type === 'pattern') && it.pattern)
      patR.set(patKey(it), Math.max(patR.get(patKey(it)) ?? 0, it.radius));
  const patPaths = new Map<string, { pid: string; a: number }>();
  const pattern = (it: PatItem, o: RenderOptions, clipId: string, strength: number) => {
    const k = patKey(it),
      R = patR.get(k)! * U,
      po = { ...o, ...patOpts(it.pattern) };
    let e = patPaths.get(k);
    if (!e) {
      // keep huge compositions bounded: past PATTERN_TILES tiles, the tiles grow instead of multiplying
      const tilesAt = (Math.PI * R * R) / (po.geoScale * U) ** 2,
        a = po.geoScale * U * Math.sqrt(Math.max(1, tilesAt / PATTERN_TILES)),
        [cx, cy] = P(it.centre);
      e = { pid: id('pat'), a };
      defs += `<path id="${e.pid}" d="${picPath(tiles(po.tiling, a, cx, cy, R), (po.geoAngle * Math.PI) / 180)}"/>`;
      patPaths.set(k, e);
    }
    const c = mix(po.paper, acc(po), strength),
      sw = e.a * 0.16;
    return `<g clip-path="url(#${clipId})" fill="none" stroke-linejoin="miter" stroke-linecap="butt"><use href="#${e.pid}" stroke="${c}" stroke-width="${f2(sw)}"/><use href="#${e.pid}" stroke="${mix(po.paper, c, 0.25)}" stroke-width="${f2(sw * 0.38)}"/></g>`;
  };
  const vineId = `${pfx}vine`;
  let vineUsed: Style | null = null;
  const vine = (s: Style) => {
    vineUsed = vineUsed ?? s;
    return `url(#${vineId})`;
  };

  // letters: one Shapes per style so colours group, drawn at the end of the letters layer
  const strips = placed.items.filter(it => it.type === 'strip') as Extract<PlacedItem, { type: 'strip' }>[];
  const maxRing = Math.max(1, ...placed.items.map(it => ('ring' in it ? it.ring : 0)));
  const maxTag = Math.max(1, ...strips.map(st => (st.strip.kind === 'cells' ? Math.max(0, ...st.strip.tag) : 1)));
  const shapes = new Map<number, Shapes>();
  const shapesFor = (i: number) => {
    if (!shapes.has(i)) shapes.set(i, { ink: new Map(), vow: [] });
    return shapes.get(i)!;
  };

  const stripSVG = (it: Extract<PlacedItem, { type: 'strip' }>) => {
    const st = it.strip as CellStrip,
      o = ropt(it.style),
      cell = placeMap(it.place);
    const map = (x: number, y: number) => P(cell(x, y));
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= st.W || y >= st.Hb ? 0 : st.data[y * st.W + x]);
    const maxKey = o.colourMode === 'ring' ? maxRing : o.colourMode === 'repeat' ? maxTag : 1;
    const src: Source = {
      w: st.W,
      h: st.Hb,
      at,
      maxKey,
      key: (x, y) => (o.colourMode === 'ring' ? it.ring : o.colourMode === 'repeat' ? st.tag[y * st.W + x] : 1),
      up: () => [0, 1],
      right: () => [1, 0],
    };
    const sector = sectorFor(it.place, map, ox, oy);
    merge(shapesFor(it.style), letterShapes(src, o, map, sector, null));
  };

  for (const it of placed.items) {
    const layer = layerOf(it),
      s = placed.styles[it.style] ?? root,
      o = ropt(it.style),
      accent = acc(o);
    let out = '';
    switch (it.type) {
      case 'ground': {
        if (it.kind === 'pattern') {
          const cid = id('g');
          defs += `<clipPath id="${cid}"><path clip-rule="evenodd" d="${dArea(it.area)}"/></clipPath>`;
          out = pattern(it, o, cid, 0.16);
        } else
          out = `<path fill-rule="evenodd" fill="${it.kind === 'vine' ? vine(s) : it.index % 2 ? mix(o.paper, o.ink, 0.07) : mix(o.paper, o.ink2, 0.15)}" d="${dArea(it.area)}"/>`;
        break;
      }
      case 'fill':
        out =
          it.kind === 'solid'
            ? `<path fill="${accent}" d="${dArea(it.area)}"/>`
            : `<path fill="${mix(o.paper, o.ink2, 0.15)}" d="${dArea(it.area)}"/><path fill="${vine(s)}" d="${dArea(it.area)}"/>`;
        break;
      case 'pattern': {
        const cid = id('p');
        defs += `<clipPath id="${cid}"><path clip-rule="evenodd" d="${dArea(it.area)}"/></clipPath>`;
        out = pattern(it, o, cid, it.strength);
        break;
      }
      case 'spandrels': {
        const d = dArea(it.area);
        if (it.kind === 'vine')
          out = `<path fill-rule="evenodd" fill="${mix(o.paper, o.ink2, 0.15)}" d="${d}"/><path fill-rule="evenodd" fill="${vine(s)}" d="${d}"/>`;
        else if (it.kind === 'pattern') {
          const cid = id('s');
          defs += `<clipPath id="${cid}"><path clip-rule="evenodd" d="${d}"/></clipPath>`;
          out = pattern(it, o, cid, 0.55);
        } else
          out = `<path fill-rule="evenodd" fill="${it.kind === 'solid' ? accent : mix(o.paper, o.ink2, 0.15)}" d="${d}"/>`;
        layers.features += `<path fill-rule="evenodd" fill="none" stroke="${accent}" stroke-width="${f2(0.15 * U)}" d="${d}"/>`;
        break;
      }
      case 'star':
        out = starSVG(...P(it.centre), it.r * U, Math.max(0.12, o.weight * 0.35) * U, accent);
        break;
      case 'strip':
        stripSVG(it);
        break;
      case 'grid': {
        const g = { w: it.grid.w, h: it.grid.h, data: it.grid.data, tag: new Uint8Array(0), ring: new Uint8Array(0) };
        const src = gridSource(g, null),
          [gx, gy] = P(it.at),
          s2 = it.cell;
        const map = (x: number, y: number) => [gx + x * s2 * U, gy + y * s2 * U];
        const rx = f2(((o.soft * o.weight) / 2) * s2 * U);
        const sector = (x0: number, x1: number, y0: number, y1: number, inner?: boolean) =>
          `<rect x="${f2(gx + x0 * s2 * U)}" y="${f2(gy + y0 * s2 * U)}" width="${f2((x1 - x0) * s2 * U)}" height="${f2((y1 - y0) * s2 * U)}"${o.soft && !inner ? ` rx="${rx}"` : ''}/>`;
        merge(shapesFor(it.style), letterShapes(src, o, map, sector, it.colour === 'accent' ? accent : null));
        break;
      }
      case 'separator':
        out = separatorSVG(it, o, P);
        break;
      case 'finial':
        out = finialSVG(P(it.p), it.bisector, it.phi, it.length * U, it.size * U, accent);
        break;
      case 'diamond':
        out = diamond(...P(it.p), it.r * U).replace('<path ', `<path fill="${accent}" `);
        break;
      case 'abjad':
        out =
          (it.frame
            ? `<path d="${dRing(it.frame)}" fill="none" stroke="${accent}" stroke-width="${f2(0.18 * U)}"/>`
            : '') + numberSVG(it.value, ...P(it.centre), it.maxW * U, it.maxH * U, o, accent);
        break;
      case 'rule':
        out = `<path d="${dRing(it.path)}" fill="none" stroke="${it.colour === 'accent' ? accent : o.ink}" stroke-width="${f2(it.width * U)}"/>`;
        break;
      case 'ribbon':
        if (it.pen) {
          out = it.paths
            .map(q => nibSweep(simplify(q.map(P), 0.15), it.width * U * 1.25, it.width * U * 0.32, NIB, accent))
            .join('');
          break;
        }
        out = `<path d="${it.paths
          .map(
            q =>
              'M' +
              q
                .map(P)
                .map(([x, y]) => f2(x) + ' ' + f2(y))
                .join('L'),
          )
          .join(
            '',
          )}" fill="none" stroke="${accent}" stroke-width="${f2(it.width * U)}" stroke-linecap="round" stroke-linejoin="round"/>`;
        break;
    }
    layers[layer] += out;
  }
  // letters, grouped by colour per style; radial colouring uses one gradient over the canvas
  shapes.forEach((sh, i) => {
    const o = ropt(i);
    let fill: string | null = null;
    if (o.colourMode === 'radial') {
      const gid = id('rg'),
        [cx, cy] = P([0, 0]);
      defs += `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(Math.max(W, H) * 0.5)}"><stop offset="0.08" stop-color="${o.ink2}"/><stop offset="1" stop-color="${o.ink}"/></radialGradient>`;
      fill = `url(#${gid})`;
    }
    layers.letters += groupsOut(o, sh, fill, o.soft * o.weight * U * 0.8);
  });
  if (vineUsed) defs = vineDefs(renderOptions(vineUsed)).replace('id="vine"', `id="${vineId}"`) + defs;
  const body =
    (defs ? `<defs>${defs}</defs>` : '') +
    LAYER_ORDER.map(l => (layers[l] ? `<g data-layer="${l}">${layers[l]}</g>` : '')).join('');
  return wrap(W, H, { label: opts.label ?? 'Kufic composition', paper: root.palette.paper }, body);
}

/** Tiles per pattern before they grow instead (a 2400-unit canvas of 5-cell tiles would be ~230k). */
const PATTERN_TILES = 6000;
const patOpts = (p?: { tiling: string; angle: number; scale: number }) =>
  p ? { tiling: TILING[p.tiling] ?? '488', geoAngle: p.angle, geoScale: p.scale } : {};

/** Filled region (x0..x1, y0..y1) of a strip in canvas units, bending with curved placements. */
function sectorFor(place: StripPlace, map: (x: number, y: number) => Pt, ox: number, oy: number) {
  if (place.type === 'arc') {
    const { C, R, N, s, rot } = place;
    const c: Pt = [(ox + C[0]) * U, (oy + C[1]) * U];
    const phi = (xc: number) => rot + Math.PI / 2 + (2 * Math.PI * (N - xc)) / N;
    const Pp = (r: number, a: number) => `${f2(c[0] + r * s * U * Math.cos(a))} ${f2(c[1] + r * s * U * Math.sin(a))}`;
    return (x0: number, x1: number, y0: number, y1: number) => {
      const a0 = phi(x1),
        a1 = phi(x0),
        r1 = R - y0,
        r0 = R - y1,
        big = a1 - a0 > Math.PI ? 1 : 0;
      return `<path d="M${Pp(r1, a0)}A${f2(r1 * s * U)} ${f2(r1 * s * U)} 0 ${big} 1 ${Pp(r1, a1)}L${Pp(r0, a1)}A${f2(r0 * s * U)} ${f2(r0 * s * U)} 0 ${big} 0 ${Pp(r0, a0)}Z"/>`;
    };
  }
  const curved = place.type === 'run';
  return (x0: number, x1: number, y0: number, y1: number) => {
    const k = curved ? Math.max(1, Math.ceil(x1 - x0)) : 1,
      top: Pt[] = [],
      bot: Pt[] = [];
    for (let i = 0; i <= k; i++) {
      const x = x0 + ((x1 - x0) * i) / k;
      top.push(map(x, y0));
      bot.push(map(x, y1));
    }
    const q = top.concat(bot.reverse());
    return `<path d="M${q.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L')}Z"/>`;
  };
}

/** Ornamental band along a ring's centre line (lab band code in renderShape, generalised to any outline). */
function separatorSVG(it: Extract<PlacedItem, { type: 'separator' }>, o: RenderOptions, P: (p: Pt) => Pt): string {
  const col = mix(o.ink, o.paper, 0.2),
    bw = it.width,
    style = it.kind;
  if (style === 'none' || bw <= 0) return '';
  const closed = (pts: Pt[]) =>
    'M' +
    pts
      .map(P)
      .map(([x, y]) => f2(x) + ' ' + f2(y))
      .join('L') +
    'Z';
  // path offset by `off` cells, outward positive
  const ringAt = (off: number): Pt[] => {
    if (it.circle) {
      const r = it.circle.r + off,
        n = Math.max(64, Math.ceil(r * 8));
      return Array.from({ length: n }, (_, i) => {
        const a = Math.PI / 2 - (i * 2 * Math.PI) / n;
        return [it.circle!.C[0] + r * Math.cos(a), it.circle!.C[1] + r * Math.sin(a)] as Pt;
      });
    }
    return Math.abs(off) < 1e-9 ? it.path : (offsetPolyline(it.path, -off)[0] ?? it.path);
  };
  const line = (off: number, sw: number) =>
    `<path d="${closed(ringAt(off))}" fill="none" stroke="${col}" stroke-width="${f2(sw * U)}" stroke-linejoin="miter"/>`;
  if (style === 'lines') return line(-bw * 0.18, bw * 0.06) + line(bw * 0.18, bw * 0.06);
  let out = line(-bw * 0.42, bw * 0.06) + line(bw * 0.42, bw * 0.06);
  // centre line as a closed run, for points at a fraction of the way round with an offset along the normal
  const pts = it.path.concat([it.path[0]]),
    cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const run: Run = { pts, cum, len: cum[cum.length - 1], start: null, end: null };
  const ptAt = (t: number, off: number): Pt => {
    if (it.circle) {
      const a = Math.PI / 2 - 2 * Math.PI * t,
        r = it.circle.r + off;
      return P([it.circle.C[0] + r * Math.cos(a), it.circle.C[1] + r * Math.sin(a)]);
    }
    const f = frameAt(run, (((t % 1) + 1) % 1) * run.len);
    return P([f.p[0] - f.n[0] * off, f.p[1] - f.n[1] * off]);
  };
  const unit = style === 'pearls' ? bw * 0.62 : style === 'chevron' ? bw * 0.7 : bw * 1.5,
    cnt = Math.max(6, Math.round(run.len / unit));
  if (style === 'pearls') {
    for (let i = 0; i < cnt; i++) {
      const [x, y] = ptAt((i + 0.5) / cnt, 0);
      out += `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(bw * 0.17 * U)}" fill="${col}"/>`;
    }
    return out;
  }
  if (style === 'chevron') {
    let d = '';
    for (let i = 0; i <= cnt * 2; i++) {
      const [x, y] = ptAt(i / (cnt * 2), (i % 2 ? 1 : -1) * bw * 0.24);
      d += (i ? 'L' : 'M') + f2(x) + ' ' + f2(y);
    }
    return (
      out + `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f2(bw * 0.09 * U)}" stroke-linejoin="miter"/>`
    );
  }
  // braid: two strands crossing
  const strand = (ph: number) => {
    let d = '';
    const n = cnt * 16;
    for (let i = 0; i <= n; i++) {
      const [x, y] = ptAt(i / n, Math.sin((2 * Math.PI * cnt * i) / n + ph) * bw * 0.26);
      d += (i ? 'L' : 'M') + f2(x) + ' ' + f2(y);
    }
    return d;
  };
  return (
    out +
    `<path d="${strand(0)}" fill="none" stroke="${col}" stroke-width="${f2(bw * 0.11 * U)}"/><path d="${strand(Math.PI)}" fill="none" stroke="${col}" stroke-width="${f2(bw * 0.11 * U)}"/>`
  );
}
