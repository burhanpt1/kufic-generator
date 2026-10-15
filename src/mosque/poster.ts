// The qibla wall elevation: every piece of the mosque programme resolved and set into the wall composition as an
// inlaid panel. Pieces are cropped to their outlines' bounds, so shapes sit close; the result is one SVG.
import { resolve } from '../compose';
import type { Placed } from '../compose/placed';
import type { Composition } from '../model/schema';
import { renderPlaced } from '../render/composition';
import { U } from '../render/svg';
import * as P from './pieces';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const f = (n: number) => +n.toFixed(1);

/** A resolved piece: its SVG body and the bounds of its outline on its own canvas (in SVG units). */
function piece(c: Composition, id: string) {
  const pl: Placed = resolve(c),
    svg = renderPlaced(pl, { idPrefix: id }),
    [ox, oy] = pl.canvas.origin,
    xs = pl.meta.outline.map(p => (ox + p[0]) * U),
    ys = pl.meta.outline.map(p => (oy + p[1]) * U);
  const box: Box = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
  return { pl, svg, box, warnings: pl.meta.warnings };
}

/** Fit a piece (cropped to its outline bounds plus a margin) into a slot, centred, keeping its aspect. */
function place(p: ReturnType<typeof piece>, slot: Box, margin = 0.04, round = false) {
  const m = Math.max(p.box.w, p.box.h) * margin,
    vb = { x: p.box.x - m, y: p.box.y - m, w: p.box.w + 2 * m, h: p.box.h + 2 * m },
    k = Math.min(slot.w / vb.w, slot.h / vb.h),
    w = vb.w * k,
    h = vb.h * k,
    x = slot.x + (slot.w - w) / 2,
    y = slot.y + (slot.h - h) / 2;
  const inner = p.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const frame = round
    ? `<circle cx="${f(x + w / 2)}" cy="${f(y + h / 2)}" r="${f(w / 2)}"`
    : `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"`;
  const cid = `clip-${p.pl.seed}-${f(x)}-${f(y)}`,
    clip = round ? `<clipPath id="${cid}">${frame}/></clipPath>` : '';
  return (
    `${clip}<g filter="url(#lift)">${frame} fill="#000" opacity=".35"/></g>` +
    (round ? `<g clip-path="url(#${cid})">` : '') +
    `<svg x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}"` +
    ` preserveAspectRatio="xMidYMid meet" overflow="hidden">${inner}</svg>` +
    (round ? '</g>' : '') +
    `${frame} fill="none" stroke="#D8AC45" stroke-width="${f(w * 0.006 + 4)}"/>`
  );
}

export interface Poster {
  svg: string;
  warnings: string[];
}

/** Build the qibla wall: dome flanked by minarets; mihrab between roundels; portal, lattice and floor below. */
export function mosquePoster(): Poster {
  const wall = piece(P.wall(), 'wall'),
    pl = wall.pl,
    W = pl.canvas.w * U,
    H = pl.canvas.h * U;
  // the field inside the wall's borders: the outline inset evenly so its area matches meta.inner
  const a = wall.box.w,
    b = wall.box.h,
    r = pl.meta.inner,
    d = (a + b - Math.sqrt((a + b) ** 2 - 4 * a * b * (1 - r * r))) / 4,
    F: Box = { x: wall.box.x + d, y: wall.box.y + d, w: a - 2 * d, h: b - 2 * d };
  const g = F.w * 0.022;
  const pieces = {
    dome: piece(P.dome(), 'dome'),
    minaret: piece(P.minaret(), 'minaret'),
    mihrab: piece(P.mihrab(), 'mihrab'),
    portal: piece(P.portal(), 'portal'),
    floor: piece(P.floor(), 'floor'),
    floor2: piece(P.floor2(), 'floor2'),
    abjad: piece(P.abjadRoundel(), 'abjad'),
    lattice: piece(P.latticeRoundel(), 'lattice'),
    strap: piece(P.strapRoundel(), 'strap'),
    seal: piece(P.sealPanel(), 'seal'),
  };
  // minarets run the height of the dome and the mihrab on both sides; between them the dome, then the mihrab
  // between stacked roundels; a row of panels below
  const mW = F.w * 0.13,
    cX = F.x + 2 * g + mW,
    cW = F.w - 2 * mW - 4 * g,
    h3 = F.h * 0.2,
    hTall = F.h - h3 - 3 * g,
    h1 = Math.min(cW, hTall * 0.55),
    h2 = hTall - h1 - g,
    y1 = F.y + g,
    y2 = y1 + h1 + g,
    y3 = y2 + h2 + g;
  const out: string[] = [];
  out.push(place(pieces.minaret, { x: F.x + g, y: y1, w: mW, h: hTall }, 0.01));
  out.push(place(pieces.minaret, { x: F.x + F.w - g - mW, y: y1, w: mW, h: hTall }, 0.01));
  out.push(place(pieces.dome, { x: cX, y: y1, w: cW, h: h1 }, 0.0, true));
  const mihW = Math.min(cW * 0.5, h2 * 0.8),
    sW = (cW - mihW - 2 * g) / 2,
    rH = (h2 - g) / 2;
  out.push(place(pieces.mihrab, { x: cX + sW + g, y: y2, w: mihW, h: h2 }, 0.01));
  out.push(place(pieces.abjad, { x: cX, y: y2, w: sW, h: rH }, 0.0, true));
  out.push(place(pieces.lattice, { x: cX, y: y2 + rH + g, w: sW, h: rH }, 0.01));
  out.push(place(pieces.strap, { x: cX + cW - sW, y: y2, w: sW, h: rH }, 0.01));
  out.push(place(pieces.seal, { x: cX + cW - sW, y: y2 + rH + g, w: sW, h: rH }, 0.01));
  const tw = (F.w - 4 * g) / 3;
  out.push(place(pieces.floor, { x: F.x + g, y: y3, w: tw, h: h3 }, 0.0));
  out.push(place(pieces.portal, { x: F.x + 2 * g + tw, y: y3, w: tw, h: h3 }, 0.0));
  out.push(place(pieces.floor2, { x: F.x + 3 * g + 2 * tw, y: y3, w: tw, h: h3 }, 0.0));
  const body = wall.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}" height="${f(H)}" role="img" aria-label="Qibla wall">` +
    `<defs><filter id="lift" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${f(g * 0.3)}"/></filter></defs>` +
    body +
    out.join('') +
    '</svg>';
  const warnings = [wall, ...Object.values(pieces)].flatMap(p => p.warnings);
  return { svg, warnings };
}
