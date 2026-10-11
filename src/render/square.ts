import { bandSVG } from '../ornament/bands';
import { numberSVG } from '../ornament/numerals';
import { patternSVG } from '../ornament/patterns/pic';
import { starSVG, vineDefs } from '../ornament/stars';
import type { ComposeResult, Grid, SquareRing } from '../types';
import { gridSVG } from './letters';
import type { RenderOptions, Shapes } from './svg';
import { U, acc, f2, groupsOut, merge, mix, wrap } from './svg';

type Composition = Extract<ComposeResult, { kind: 'square' | 'circle' }>;

export function renderSquare(res: Composition, opt: RenderOptions) {
  const L = res.size,
    m = 1.5 + (res.info.gap || 1),
    W = (L + 2 * m) * U,
    M = m * U,
    C = W / 2;
  let defs = '',
    under = '',
    over = '',
    centre = '';
  const gf = (i: number) =>
    opt.ground === 'vine' ? 'url(#vine)' : i % 2 ? mix(opt.paper, opt.ink, 0.07) : mix(opt.paper, opt.ink2, 0.15);
  if (opt.ground === 'vine' || opt.corners === 'vine') defs += vineDefs(opt);
  const frame = (o: number, hb: number) => {
    const a = M + o * U,
      s = (L - 2 * o) * U,
      ia = a + hb * U,
      is = s - 2 * hb * U;
    return `M${f2(a)} ${f2(a)}h${f2(s)}v${f2(s)}h${f2(-s)}Z M${f2(ia)} ${f2(ia)}h${f2(is)}v${f2(is)}h${f2(-is)}Z`;
  };
  if (opt.ground !== 'plain') {
    if (opt.ground === 'geo') {
      defs += `<clipPath id="cg">${res.bands.map(b => `<path clip-rule="evenodd" d="${frame(b.o, b.hb)}"/>`).join('')}</clipPath>`;
      under += patternSVG(opt, C, C, W * 0.75, 'cg', 0.16);
    } else
      res.bands.forEach((b, i) => {
        under += `<path fill-rule="evenodd" fill="${gf(i)}" d="${frame(b.o, b.hb)}"/>`;
      });
  }
  res.rules.forEach(r => {
    over += bandSVG(opt.bandStyle, 'square', { o: M + r.o * U, Ls: (L - 2 * r.o) * U }, r.w * U, opt);
  });
  // letters
  const rings = res.rings as SquareRing[];
  const keyMode = opt.colourMode;
  let maxKey = 1;
  if (keyMode === 'ring') maxKey = rings.length;
  else if (keyMode === 'repeat')
    rings.forEach(r => {
      for (const v of r.grid.tag) if (v > maxKey) maxKey = v;
    });
  const sh: Shapes = { ink: new Map(), vow: [] };
  rings.forEach(r => {
    const keyArr =
      keyMode === 'ring' ? r.grid.data.map(v => (v ? r.ring : 0)) : keyMode === 'repeat' ? r.grid.tag : null;
    merge(sh, gridSVG(r.grid, opt, M + r.off * U, M + r.off * U, r.scale, keyArr, null, maxKey));
    // corner blocks
    r.corners.forEach(cn => {
      const x = M + (r.off + cn.x * r.scale) * U,
        y = M + (r.off + cn.y * r.scale) * U,
        s = cn.s * r.scale * U;
      if (opt.corners === 'stars')
        over += starSVG(x + s / 2, y + s / 2, s * 0.46, Math.max(0.12, opt.weight * 0.35) * U * r.scale, acc(opt));
      else if (opt.corners === 'vine')
        under += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(s)}" height="${f2(s)}" fill="${mix(opt.paper, opt.ink2, 0.15)}"/><rect x="${f2(x)}" y="${f2(y)}" width="${f2(s)}" height="${f2(s)}" fill="url(#vine)" stroke="${acc(opt)}" stroke-width="${f2(0.15 * U)}"/>`;
      else if (opt.corners === 'geo') {
        const id = 'ck' + Math.round(x) + '_' + Math.round(y);
        defs += `<clipPath id="${id}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(s)}" height="${f2(s)}"/></clipPath>`;
        under +=
          patternSVG(opt, x + s / 2, y + s / 2, s, id, 0.55) +
          `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(s)}" height="${f2(s)}" fill="none" stroke="${acc(opt)}" stroke-width="${f2(0.15 * U)}"/>`;
      }
    });
  });
  // centre
  const ce = res.centre,
    a = M + ce.o! * U,
    s = ce.C! * U;
  if (s > 2 * U) {
    if (ce.type === 'abjad')
      centre +=
        `<rect x="${f2(a + 0.5 * U)}" y="${f2(a + 0.5 * U)}" width="${f2(s - U)}" height="${f2(s - U)}" fill="none" stroke="${acc(opt)}" stroke-width="${f2(0.18 * U)}"/>` +
        numberSVG(res.info.abjad, C, C, s * 0.72, s * 0.42, opt, acc(opt));
    else if (ce.type === 'solid')
      centre += `<rect x="${f2(a)}" y="${f2(a)}" width="${f2(s)}" height="${f2(s)}" fill="${acc(opt)}"/>`;
    else if (ce.type === 'squares') {
      for (let i = 0.5; 2 * i < ce.C!; i += 2)
        centre += `<rect x="${f2(a + i * U)}" y="${f2(a + i * U)}" width="${f2(s - 2 * i * U)}" height="${f2(s - 2 * i * U)}" fill="none" stroke="${acc(opt)}" stroke-width="${f2(opt.weight * U)}"/>`;
    } else if (ce.type === 'geo') {
      defs += `<clipPath id="cc"><rect x="${f2(a)}" y="${f2(a)}" width="${f2(s)}" height="${f2(s)}"/></clipPath>`;
      centre += patternSVG(opt, C, C, s, 'cc', 0.85);
    } else if (ce.type === 'letters' && ce.emblem) {
      const e = ce.emblem as { grid: Grid; scale: number },
        es = e.scale,
        off = a + (s - e.grid.w * es * U) / 2;
      merge(sh, gridSVG(e.grid, opt, off, off, es, null, acc(opt)));
    }
  }
  let fill: string | null = null;
  if (opt.colourMode === 'radial') {
    defs += `<radialGradient id="rg" gradientUnits="userSpaceOnUse" cx="${f2(C)}" cy="${f2(C)}" r="${f2(W * 0.62)}"><stop offset="0.08" stop-color="${opt.ink2}"/><stop offset="1" stop-color="${opt.ink}"/></radialGradient>`;
    fill = 'url(#rg)';
  }
  let grid = '';
  if (opt.grid) {
    defs += `<pattern id="gp" width="${U}" height="${U}" patternUnits="userSpaceOnUse" x="${M}" y="${M}"><path d="M ${U} 0 L 0 0 0 ${U}" fill="none" stroke="${opt.ink}" stroke-opacity=".18" stroke-width=".6"/></pattern>`;
    grid = `<rect x="${M}" y="${M}" width="${L * U}" height="${L * U}" fill="url(#gp)"/>`;
  }
  return wrap(
    W,
    W,
    opt,
    (defs ? `<defs>${defs}</defs>` : '') + under + grid + centre + groupsOut(opt, sh, fill) + over,
  );
}
