import { vineDefs } from '../ornament/stars';
import type { Grid } from '../types';
import { gridSVG } from './letters';
import type { RenderOptions } from './svg';
import { U, groupsOut, mix, wrap } from './svg';

/** A flat grid (line layout, letter table) with margin m cells. */
export function renderGrid(g: Grid, opt: RenderOptions, m: number) {
  const W = (g.w + 2 * m) * U,
    Hh = (g.h + 2 * m) * U;
  const sh = gridSVG(g, opt, m * U, m * U, 1, null, null);
  let defs = '',
    under = '';
  if (opt.ground === 'vine') {
    defs += vineDefs(opt);
    under = `<rect x="${m * U}" y="${m * U}" width="${g.w * U}" height="${g.h * U}" fill="url(#vine)"/>`;
  } else if (opt.ground === 'tint')
    under = `<rect x="${m * U}" y="${m * U}" width="${g.w * U}" height="${g.h * U}" fill="${mix(opt.paper, opt.ink2, 0.15)}"/>`;
  if (opt.grid) {
    defs += `<pattern id="gp" width="${U}" height="${U}" patternUnits="userSpaceOnUse" x="${m * U}" y="${m * U}"><path d="M ${U} 0 L 0 0 0 ${U}" fill="none" stroke="${opt.ink}" stroke-opacity=".18" stroke-width=".6"/></pattern>`;
    under += `<rect x="${m * U}" y="${m * U}" width="${g.w * U}" height="${g.h * U}" fill="url(#gp)"/>`;
  }
  return wrap(W, Hh, opt, (defs ? `<defs>${defs}</defs>` : '') + under + groupsOut(opt, sh, null));
}
