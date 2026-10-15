// The A1 sheet of "Light upon light": the frame of the Ninety-Nine Names, the basmala and "God the Almighty has
// spoken the truth" in cartouches, and the niche of the Light Verse with light streaming from its glass.
import { resolve } from '../compose';
import type { Placed, PlacedItem } from '../compose/placed';
import type { Pt } from '../geometry/types';
import { renderPlaced } from '../render/composition';
import { U } from '../render/svg';
import { NAMES_99 } from '../mosque/texts';
import { cartouche, frame, NIGHT, niche } from './nur';

const f = (n: number) => +n.toFixed(1);
const body = (svg: string) =>
  svg
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/^<rect width="[^"]*" height="[^"]*" fill="[^"]*"\/>/, '');
const ptsOf = (pl: Placed, P: Pt[]) =>
  P.map(([x, y]) => [(pl.canvas.origin[0] + x) * U, (pl.canvas.origin[1] + y) * U] as Pt);
const d = (P: Pt[]) => 'M' + P.map(([x, y]) => f(x) + ' ' + f(y)).join('L') + 'Z';
const bbox = (P: Pt[]) => {
  const xs = P.map(p => p[0]),
    ys = P.map(p => p[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
};

export interface Sheet {
  svg: string;
  warnings: string[];
  /** Width and height in SVG units (A-series proportions). */
  w: number;
  h: number;
}

export function nurSheet(): Sheet {
  const fr = resolve(frame(NAMES_99.join(' '))),
    W = fr.canvas.w * U,
    H = fr.canvas.h * U;
  const frOutline = fr.items.find((i): i is Extract<PlacedItem, { type: 'outline' }> => i.type === 'outline')!;
  const field = bbox(ptsOf(fr, frOutline.inner!));

  // the niche, with its regions' outlines for the light
  const ni = resolve(niche()),
    regions = ni.items.filter((i): i is Extract<PlacedItem, { type: 'outline' }> => i.type === 'outline'),
    [nicheR, lampR, glassR] = regions,
    nicheOuter = ptsOf(ni, nicheR.outer),
    nicheInner = ptsOf(ni, nicheR.inner!),
    lampOuter = ptsOf(ni, lampR.outer),
    lampInner = ptsOf(ni, lampR.inner!),
    glass = bbox(ptsOf(ni, glassR.outer)),
    gc: Pt = [glass.x + glass.w / 2, glass.y + glass.h / 2],
    nb = bbox(nicheOuter);
  // rays: alternating wedges from the glass's centre, fading outward
  const R = Math.hypot(nb.w, nb.h),
    N = 96,
    rays: string[] = [];
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * 2 * Math.PI,
      a1 = a0 + (k % 2 ? 0.35 : 0.6) * ((2 * Math.PI) / N),
      p = (a: number): string => f(gc[0] + R * Math.cos(a)) + ' ' + f(gc[1] + R * Math.sin(a));
    rays.push(`M${f(gc[0])} ${f(gc[1])}L${p(a0)}L${p(a1)}Z`);
  }
  const nicheLayers =
    `<defs>` +
    `<clipPath id="nur-light"><path clip-rule="evenodd" d="${d(nicheInner)} ${d(lampOuter)}"/></clipPath>` +
    `<radialGradient id="nur-glow" cx="${f(gc[0])}" cy="${f(gc[1])}" r="${f(R * 0.55)}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#F6D57A" stop-opacity=".55"/><stop offset=".35" stop-color="#D9AE48" stop-opacity=".18"/>` +
    `<stop offset="1" stop-color="#D9AE48" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="nur-core" cx="${f(gc[0])}" cy="${f(gc[1])}" r="${f(glass.w * 0.5)}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#F6D57A" stop-opacity=".35"/><stop offset="1" stop-color="#F6D57A" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<path d="${d(nicheOuter)}" fill="${NIGHT.paper}"/>` +
    `<g clip-path="url(#nur-light)"><rect x="${f(nb.x)}" y="${f(nb.y)}" width="${f(nb.w)}" height="${f(nb.h)}" fill="url(#nur-glow)"/>` +
    `<path d="${rays.join('')}" fill="url(#nur-glow)" opacity=".9"/></g>` +
    `<clipPath id="nur-lamp"><path d="${d(lampInner)}"/></clipPath>` +
    `<g clip-path="url(#nur-lamp)" opacity=".6"><rect x="${f(nb.x)}" y="${f(nb.y)}" width="${f(nb.w)}" height="${f(nb.h)}" fill="url(#nur-glow)"/></g>` +
    `<circle cx="${f(gc[0])}" cy="${f(gc[1])}" r="${f(glass.w / 2)}" fill="url(#nur-core)"/>` +
    body(renderPlaced(ni, { idPrefix: 'ni' }));

  // layout inside the frame's field: cartouche, niche, cartouche
  const g = field.w * 0.03,
    cH = field.h * 0.09,
    top = cartouche('بسم الله الرحمن الرحيم', 1),
    bottom = cartouche('صدق الله العظيم', 2);
  const parts: string[] = [];
  const nest = (
    svgBody: string,
    crop: { x: number; y: number; w: number; h: number },
    slot: { x: number; y: number; w: number; h: number },
  ) => {
    const k = Math.min(slot.w / crop.w, slot.h / crop.h),
      w = crop.w * k,
      h = crop.h * k;
    return `<svg x="${f(slot.x + (slot.w - w) / 2)}" y="${f(slot.y + (slot.h - h) / 2)}" width="${f(w)}" height="${f(h)}" viewBox="${f(crop.x)} ${f(crop.y)} ${f(crop.w)} ${f(crop.h)}" overflow="visible">${svgBody}</svg>`;
  };
  const cart = (c: ReturnType<typeof cartouche>, y: number, id: string) => {
    const pl = resolve(c),
      o = pl.items.find((i): i is Extract<PlacedItem, { type: 'outline' }> => i.type === 'outline')!,
      P = ptsOf(pl, o.outer),
      b = bbox(P);
    const svgBody = `<path d="${d(P)}" fill="${NIGHT.paper}"/>` + body(renderPlaced(pl, { idPrefix: id }));
    parts.push(nest(svgBody, b, { x: field.x + field.w * 0.22, y, w: field.w * 0.56, h: cH }));
    return pl.meta.warnings;
  };
  const warnings = [...fr.meta.warnings, ...ni.meta.warnings];
  warnings.push(...cart(top, field.y + g, 'ct'));
  const nicheSlot = { x: field.x + g, y: field.y + 2 * g + cH, w: field.w - 2 * g, h: field.h - 4 * g - 2 * cH };
  parts.push(nest(nicheLayers, { x: nb.x, y: nb.y, w: nb.w, h: nb.h }, nicheSlot));
  warnings.push(...cart(bottom, field.y + field.h - g - cH, 'cb'));

  // crop to the frame plus an even margin, at exactly 1 : √2 (A-series), sized for A1
  const fo = bbox(ptsOf(fr, frOutline.outer)),
    m = fo.w * 0.035,
    cw = fo.w + 2 * m,
    ch = cw * Math.SQRT2,
    cx = fo.x - m,
    cy = fo.y + fo.h / 2 - ch / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(cx)} ${f(cy)} ${f(cw)} ${f(ch)}" width="594mm" height="841mm" role="img" aria-label="Light upon light: the Light Verse in square Kufic">` +
    `<rect x="${f(cx)}" y="${f(cy)}" width="${f(cw)}" height="${f(ch)}" fill="${NIGHT.paper}"/>` +
    body(renderPlaced(fr, { idPrefix: 'fr' })) +
    parts.join('') +
    '</svg>';
  void W;
  void H;
  return { svg, warnings, w: cw, h: ch };
}
