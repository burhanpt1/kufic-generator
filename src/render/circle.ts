import { bandSVG } from '../ornament/bands';
import { numberSVG } from '../ornament/numerals';
import { patternSVG } from '../ornament/patterns/pic';
import { starSVG, vineDefs } from '../ornament/stars';
import type { CircleRing, ComposeResult } from '../types';
import { ringSVG } from './letters';
import type { RenderOptions, Shapes } from './svg';
import { U, acc, f2, groupsOut, merge, mix, wrap } from './svg';

type Composition = Extract<ComposeResult, { kind: 'square' | 'circle' }>;

export function renderCircle(res: Composition, opt: RenderOptions) {
  const R = res.R!,
    m = 1.5 + (res.info.gap || 1),
    S = (2 * R + 2 * m) * U,
    C = S / 2,
    w = opt.weight,
    rot = ((res.rotation || 0) * Math.PI) / 180;
  let defs = '',
    under = '',
    over = '',
    centre = '';
  const rings = res.rings as CircleRing[];
  const keyMode = opt.colourMode,
    maxKey =
      keyMode === 'ring'
        ? rings.length
        : keyMode === 'repeat'
          ? Math.max(1, ...rings.map(r => Math.max(0, ...r.tag)))
          : 1;
  const sh: Shapes = { ink: new Map(), vow: [] };
  rings.forEach(r => merge(sh, ringSVG(r, opt, C, rot, keyMode, maxKey, null)));
  const ce = res.centre;
  if (ce.type === 'letters' && ce.emblem)
    merge(sh, ringSVG(ce.emblem as CircleRing, opt, C, rot, 'solid', 1, acc(opt)));
  const annulus = (r0: number, r1: number) =>
    `M${f2(C + r1 * U)} ${f2(C)}a${f2(r1 * U)} ${f2(r1 * U)} 0 1 0 ${f2(-2 * r1 * U)} 0a${f2(r1 * U)} ${f2(r1 * U)} 0 1 0 ${f2(2 * r1 * U)} 0Z M${f2(C + r0 * U)} ${f2(C)}a${f2(r0 * U)} ${f2(r0 * U)} 0 1 0 ${f2(-2 * r0 * U)} 0a${f2(r0 * U)} ${f2(r0 * U)} 0 1 0 ${f2(2 * r0 * U)} 0Z`;
  if (opt.ground === 'vine' || opt.corners === 'vine') defs += vineDefs(opt);
  if (opt.ground !== 'plain') {
    if (opt.ground === 'geo') {
      defs += `<clipPath id="cg">${res.bands.map(b => `<path clip-rule="evenodd" d="${annulus(b.r0, b.r1)}"/>`).join('')}</clipPath>`;
      under += patternSVG(opt, C, C, S * 0.75, 'cg', 0.16);
    } else
      res.bands.forEach((b, i) => {
        under += `<path fill-rule="evenodd" fill="${opt.ground === 'vine' ? 'url(#vine)' : i % 2 ? mix(opt.paper, opt.ink, 0.07) : mix(opt.paper, opt.ink2, 0.15)}" d="${annulus(b.r0, b.r1)}"/>`;
      });
  }
  res.rules.forEach(r => {
    over += bandSVG(opt.bandStyle, 'circle', { C, r: r.r * U }, r.w * U, opt);
  });
  // centre
  const cr = (ce.r || 0) * U - (res.rules.length ? (res.rules[res.rules.length - 1].w * U) / 2 : 0);
  if (cr > 2 * U) {
    if (ce.type === 'abjad')
      centre +=
        `<circle cx="${f2(C)}" cy="${f2(C)}" r="${f2(cr - 0.4 * U)}" fill="none" stroke="${acc(opt)}" stroke-width="${f2(0.18 * U)}"/>` +
        numberSVG(res.info.abjad, C, C, cr * 1.25, cr * 0.62, opt, acc(opt));
    else if (ce.type === 'solid') centre += `<circle cx="${f2(C)}" cy="${f2(C)}" r="${f2(cr)}" fill="${acc(opt)}"/>`;
    else if (ce.type === 'squares') {
      for (let r = cr - 0.5 * U; r > 0.75 * U; r -= 2 * U)
        centre += `<circle cx="${f2(C)}" cy="${f2(C)}" r="${f2(r)}" fill="none" stroke="${acc(opt)}" stroke-width="${f2(w * U)}"/>`;
    } else if (ce.type === 'geo') {
      defs += `<clipPath id="cc"><circle cx="${f2(C)}" cy="${f2(C)}" r="${f2(cr)}"/></clipPath>`;
      centre += patternSVG(opt, C, C, cr, 'cc', 0.85);
    }
  }
  // corners (spandrels)
  if (opt.corners !== 'none') {
    const Rc = (R + (res.info.gap || 1)) * U,
      e = 0.6 * U,
      B = C - e;
    const sp = `M${f2(e)} ${f2(e)}H${f2(S - e)}V${f2(S - e)}H${f2(e)}Z M${f2(C + Rc)} ${f2(C)}a${f2(Rc)} ${f2(Rc)} 0 1 0 ${f2(-2 * Rc)} 0a${f2(Rc)} ${f2(Rc)} 0 1 0 ${f2(2 * Rc)} 0Z`;
    if (opt.corners === 'vine') {
      under += `<path fill-rule="evenodd" fill="${mix(opt.paper, opt.ink2, 0.15)}" d="${sp}"/><path fill-rule="evenodd" fill="url(#vine)" d="${sp}"/>`;
      over += `<path fill-rule="evenodd" fill="none" stroke="${acc(opt)}" stroke-width="${f2(0.15 * U)}" d="${sp}"/>`;
    } else if (opt.corners === 'geo') {
      defs += `<clipPath id="ck"><path clip-rule="evenodd" d="${sp}"/></clipPath>`;
      under += patternSVG(opt, C, C, S * 0.75, 'ck', 0.55);
      over += `<path fill-rule="evenodd" fill="none" stroke="${acc(opt)}" stroke-width="${f2(0.15 * U)}" d="${sp}"/>`;
    } else {
      const g = 0.8 * U,
        r = (B * Math.SQRT2 - Rc - g) / (Math.SQRT2 + 1);
      if (r > 1.5 * U)
        [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].forEach(([sx, sy]) => {
          const d = B - r;
          over += starSVG(C + sx * d, C + sy * d, r * 0.92, Math.max(0.12, w * 0.35) * U, acc(opt));
        });
    }
  }
  let fill: string | null = null;
  if (opt.colourMode === 'radial') {
    defs += `<radialGradient id="rg" gradientUnits="userSpaceOnUse" cx="${f2(C)}" cy="${f2(C)}" r="${f2(R * U)}"><stop offset="0.08" stop-color="${opt.ink2}"/><stop offset="1" stop-color="${opt.ink}"/></radialGradient>`;
    fill = 'url(#rg)';
  }
  return wrap(
    S,
    S,
    opt,
    (defs ? `<defs>${defs}</defs>` : '') + under + centre + groupsOut(opt, sh, fill, opt.soft * w * U * 0.8) + over,
  );
}
