// Angular Eastern Arabic numerals as polylines in a unit box (x right, y down); '0' is a diamond dot.
import type { RenderOptions } from '../render/svg';
import { U, diamond, f2 } from '../render/svg';

type Digit = { dot: true } | number[][][];
export const DIGITS: Record<string, Digit> = {
  '0': { dot: true },
  '1': [[[0.3, 0], [0.3, 1]]],
  '2': [[[0.15, 1], [0.15, 0.3], [0.5, 0.3], [0.5, 0]]],
  '3': [[[0.05, 1], [0.05, 0.3], [0.3, 0.3], [0.3, 0.05]], [[0.3, 0.3], [0.55, 0.3], [0.55, 0.05]]],
  '4': [[[0.55, 0.02], [0.08, 0.02], [0.08, 0.45], [0.5, 0.45]], [[0.08, 0.45], [0.08, 0.98], [0.55, 0.98]]],
  '5': [[[0.08, 0.35], [0.52, 0.35], [0.52, 0.98], [0.08, 0.98], [0.08, 0.35]]],
  '6': [[[0.05, 0.02], [0.5, 0.02], [0.5, 1]]],
  '7': [[[0.02, 0], [0.3, 1], [0.58, 0]]],
  '8': [[[0.02, 1], [0.3, 0], [0.58, 1]]],
  '9': [[[0.5, 0.42], [0.08, 0.42], [0.08, 0.02], [0.5, 0.02], [0.5, 1]]],
}; // prettier-ignore

/** n centred at (cx, cy) within maxW × maxH, with a rule and diamond above and below. */
export function numberSVG(
  n: number,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  opt: RenderOptions,
  colour: string,
) {
  const ds = String(n).split(''),
    adv = 0.82,
    h = Math.min(maxH * 0.85, maxW / (ds.length * adv - 0.22)),
    sw = Math.max(h * 0.1, Math.min(h * 0.16, opt.weight * U * 1.1));
  const total = (ds.length * adv - 0.22) * h,
    x0 = cx - total / 2,
    y0 = cy - h / 2;
  let out = '';
  ds.forEach((d, i) => {
    const ox = x0 + i * adv * h,
      g = DIGITS[d];
    if ('dot' in g) {
      out += diamond(ox + 0.3 * h, y0 + 0.55 * h, h * 0.12).replace('<path ', `<path fill="${colour}" `);
      return;
    }
    g.forEach(pl => {
      out += `<polyline points="${pl.map(([x, y]) => f2(ox + x * h) + ',' + f2(y0 + y * h)).join(' ')}" fill="none" stroke="${colour}" stroke-width="${f2(sw)}" stroke-linejoin="miter" stroke-linecap="square"/>`;
    });
  });
  const dr = sw * 0.9;
  [cy - h / 2 - sw * 3.4, cy + h / 2 + sw * 3.4].forEach(y => {
    out += `<line x1="${f2(x0)}" y1="${f2(y)}" x2="${f2(x0 + total)}" y2="${f2(y)}" stroke="${colour}" stroke-width="${f2(sw * 0.35)}"/>`;
    out += diamond(cx, y, dr).replace('<path ', `<path fill="${colour}" `);
  });
  return out;
}
