// The A1 sheet of "Light upon light": the frame of the Ninety-Nine Names, the basmala and "God the Almighty has
// spoken the truth" in cartouches, and the niche of the Light Verse with light streaming from its glass.
import { resolve } from '../compose';
import type { Placed, PlacedItem } from '../compose/placed';
import type { Pt } from '../geometry/types';
import { renderPlaced } from '../render/composition';
import { U } from '../render/svg';
import { inside } from '../geometry/poly';
import { NAMES_99 } from '../mosque/texts';
import { cartouche, frame, NIGHT, niche, NUR } from './nur';
import { rosette, Writer, writtenRays } from './radial';
import { kufi } from '../script/kufi';
import { mix } from '../render/svg';
import type { Style } from '../model/schema';

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

export interface SheetOptions {
  /** The core of the star: the square Kufic spiral, or a rosette of نور على نور on eight spokes reading outward. */
  core?: 'spiral' | 'rosette';
  /** The light from the glass: plain wedges, or rays written in gold: نور, or the Light Verse word by word
   *  (the default). */
  rays?: 'wedges' | 'nur' | 'verse';
}

/** The chosen design: the square Kufic spiral at the core, light written in the Light Verse. */
export const NUR_DEFAULTS: Required<SheetOptions> = { core: 'spiral', rays: 'verse' };

export function nurSheet(opts: SheetOptions = {}): Sheet {
  const o = { ...NUR_DEFAULTS, ...opts };
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
  // experiments: the core as a rosette, and the light written in words, added to the niche as placed strips
  const gold = (k: number): Style => ({
    ...ni.styles[0],
    palette: { ...ni.styles[0].palette, ink: mix(NIGHT.paper, '#F2CF6E', k) },
    colouring: 'solid',
    stroke: { ...ni.styles[0].stroke, contrast: 0, taper: 0 },
    terminals: { ...ni.styles[0].terminals, kind: 'none', flourish: 'none' },
  });
  const addStyle = (st: Style) => ni.styles.push(st) - 1;
  const rayItems: PlacedItem[] = [];
  const w = new Writer(kufi, ni.styles[0]);
  const ctr = (P: Pt[]): Pt => {
    const b = bbox(P);
    return [b.x + b.w / 2, b.y + b.h / 2];
  };
  if (o.core === 'rosette') {
    const starR = regions[3],
      at = ni.items.indexOf(starR),
      c = ctr(starR.inner!),
      // spokes reach into the star's points
      R = Math.max(...starR.inner!.map(q => Math.hypot(q[0] - c[0], q[1] - c[1]))) * 0.96;
    ni.items = ni.items.filter((it, i) => !(i > at && it.type === 'grid'));
    const ro = rosette(w, NUR.core, c, R, 8, addStyle(gold(1)), 90);
    ni.items.push(...ro.items, { type: 'star', style: addStyle(gold(1)), centre: c, r: ro.r0 * 0.8 });
  }
  if (o.rays === 'nur' || o.rays === 'verse') {
    const words = o.rays === 'nur' ? ['نور'] : NUR.verse.split(' '),
      c = ctr(glassR.outer),
      sids = [addStyle(gold(1))],
      rMax = Math.hypot(nb.w, nb.h) / U;
    rayItems.push(...writtenRays(w, words, c, lampR.outer, nicheR.inner!, 40, 0.42, sids, 91, rMax));
  }
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
    (o.rays === 'nur' || o.rays === 'verse' ? '' : `<path d="${rays.join('')}" fill="url(#nur-glow)" opacity=".9"/>`) +
    `</g>` +
    `<clipPath id="nur-lamp"><path d="${d(lampInner)}"/></clipPath>` +
    `<g clip-path="url(#nur-lamp)" opacity=".6"><rect x="${f(nb.x)}" y="${f(nb.y)}" width="${f(nb.w)}" height="${f(nb.h)}" fill="url(#nur-glow)"/></g>` +
    `<circle cx="${f(gc[0])}" cy="${f(gc[1])}" r="${f(glass.w / 2)}" fill="url(#nur-core)"/>` +
    // written rays: one continuous run of words per ray, fading outward through a radial mask
    (rayItems.length
      ? `<mask id="nur-fade" maskUnits="userSpaceOnUse" x="${f(nb.x)}" y="${f(nb.y)}" width="${f(nb.w)}" height="${f(nb.h)}">` +
        `<radialGradient id="nur-fadeg" cx="${f(gc[0])}" cy="${f(gc[1])}" r="${f(R * 0.5)}" gradientUnits="userSpaceOnUse">` +
        `<stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></radialGradient>` +
        `<rect x="${f(nb.x)}" y="${f(nb.y)}" width="${f(nb.w)}" height="${f(nb.h)}" fill="url(#nur-fadeg)"/></mask>` +
        `<g mask="url(#nur-fade)">${body(renderPlaced({ ...ni, items: rayItems }, { idPrefix: 'nr' }))}</g>`
      : '') +
    body(renderPlaced(ni, { idPrefix: 'ni' }));

  // layout inside the frame's field: cartouche, niche, cartouche
  const g = field.w * 0.03,
    cH = field.h * 0.09,
    top = cartouche('بسم الله الرحمن الرحيم', 1),
    bottom = cartouche('صدق الله العظيم', 2);
  const parts: string[] = [];
  // outlines of what is set over the field, in sheet coordinates
  const covers: Pt[][] = [];
  const nest = (
    svgBody: string,
    crop: { x: number; y: number; w: number; h: number },
    slot: { x: number; y: number; w: number; h: number },
    cover: Pt[],
  ) => {
    const k = Math.min(slot.w / crop.w, slot.h / crop.h),
      w = crop.w * k,
      h = crop.h * k,
      x0 = slot.x + (slot.w - w) / 2,
      y0 = slot.y + (slot.h - h) / 2;
    covers.push(cover.map(([x, y]) => [x0 + (x - crop.x) * k, y0 + (y - crop.y) * k] as Pt));
    return `<svg x="${f(x0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" viewBox="${f(crop.x)} ${f(crop.y)} ${f(crop.w)} ${f(crop.h)}" overflow="visible">${svgBody}</svg>`;
  };
  const cart = (c: ReturnType<typeof cartouche>, y: number, id: string) => {
    const pl = resolve(c),
      o = pl.items.find((i): i is Extract<PlacedItem, { type: 'outline' }> => i.type === 'outline')!,
      P = ptsOf(pl, o.outer),
      b = bbox(P);
    const svgBody = `<path d="${d(P)}" fill="${NIGHT.paper}"/>` + body(renderPlaced(pl, { idPrefix: id }));
    parts.push(nest(svgBody, b, { x: field.x + field.w * 0.22, y, w: field.w * 0.56, h: cH }, P));
    return pl.meta.warnings;
  };
  const warnings = [...fr.meta.warnings, ...ni.meta.warnings];
  warnings.push(...cart(top, field.y + g, 'ct'));
  const nicheSlot = { x: field.x + g, y: field.y + 2 * g + cH, w: field.w - 2 * g, h: field.h - 4 * g - 2 * cH };
  parts.push(nest(nicheLayers, { x: nb.x, y: nb.y, w: nb.w, h: nb.h }, nicheSlot, nicheOuter));
  warnings.push(...cart(bottom, field.y + field.h - g - cH, 'cb'));

  // crop to the frame plus an even margin, at exactly 1 : √2 (A-series), sized for A1
  const fo = bbox(ptsOf(fr, frOutline.outer)),
    m = fo.w * 0.035,
    cw = fo.w + 2 * m,
    ch = cw * Math.SQRT2,
    cx = fo.x - m,
    cy = fo.y + fo.h / 2 - ch / 2;
  // field words hidden behind the niche and the cartouches are not drawn
  const hidden = covers.map(P => ({ P, b: bbox(P) }));
  const frShown: Placed = {
    ...fr,
    items: fr.items.filter(it => {
      if (it.type !== 'strip' || it.place.type !== 'line') return true;
      const [x, y] = ptsOf(fr, [it.place.O])[0];
      return !hidden.some(({ P, b }) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h && inside(P, x, y));
    }),
  };
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(cx)} ${f(cy)} ${f(cw)} ${f(ch)}" width="594mm" height="841mm" role="img" aria-label="Light upon light: the Light Verse in square Kufic">` +
    `<rect x="${f(cx)}" y="${f(cy)}" width="${f(cw)}" height="${f(ch)}" fill="${NIGHT.paper}"/>` +
    body(renderPlaced(frShown, { idPrefix: 'fr' })) +
    parts.join('') +
    '</svg>';
  void W;
  void H;
  return { svg, warnings, w: cw, h: ch };
}
