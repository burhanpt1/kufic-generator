import type { Cmd } from './svg';
import { f2 } from './svg';

type Pt = [number, number];

/** Cells -> horizontal runs [x0, x1, y], vertical runs [x, y0, y1], lone dots [x, y] and diagonal links. `D` leaves
 *  out cells a diagonal link already draws; `lone` keeps them, for marks, which draw no links (the three dots of ش
 *  touch diagonally and were never drawn). */
export function prims(pred: (x: number, y: number) => boolean | number, w: number, h: number) {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && pred(x, y);
  const H: number[][] = [],
    V: number[][] = [],
    D: number[][] = [],
    X: number[][] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (on(x, y) && on(x + 1, y)) {
        let e = x;
        while (on(e + 1, y)) e++;
        H.push([x, e, y]);
        x = e + 1;
      } else x++;
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (on(x, y) && on(x, y + 1)) {
        let e = y;
        while (on(x, e + 1)) e++;
        V.push([x, y, e]);
        y = e + 1;
      } else y++;
    }
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      if (!on(x - 1, y) && !on(x + 1, y) && !on(x, y - 1) && !on(x, y + 1)) D.push([x, y]);
      if (on(x + 1, y + 1) && !on(x + 1, y) && !on(x, y + 1)) X.push([x, y, x + 1, y + 1]);
      if (on(x - 1, y + 1) && !on(x - 1, y) && !on(x, y + 1)) X.push([x, y, x - 1, y + 1]);
    }
  const linked = new Set<string>();
  X.forEach(([a, b, c, d]) => {
    linked.add(a + ',' + b);
    linked.add(c + ',' + d);
  });
  return { H, V, D: D.filter(([x, y]) => !linked.has(x + ',' + y)), lone: D, X };
}

/** Stem-ending shape in local units: x across the stem (width w), y along it, 0 = cell centre. */
export function termCmds(style: string, w: number): Cmd[] {
  const h = w / 2,
    k = style === 'palmette' || style === 'leaf' ? 0.8 + 0.4 * w : 0.55 + 0.45 * w;
  switch (style) {
    case 'notch':
      return [['M', -h, -0.5], ['L', -h, 0.62], ['L', 0, 0.22], ['L', h, 0.62], ['L', h, -0.5], ['Z']];
    case 'bevel':
      return [['M', -h, -0.5], ['L', -h, 0.72], ['L', h, 0.18], ['L', h, -0.5], ['Z']];
    case 'leaf':
      return [
        ['M', h, -0.5],
        ['L', h, 0.3],
        ['C', h, 0.3 + 0.6 * k, -0.15 * k, 0.3 + 1.05 * k, -1.15 * k, 0.3 + 0.95 * k],
        ['C', -0.75 * k, 0.3 + 0.75 * k, -h, 0.3 + 0.45 * k, -h, 0.3],
        ['L', -h, -0.5],
        ['Z'],
      ];
    case 'palmette':
      return [
        ['M', -h, -0.5],
        ['L', -h, 0.3],
        ['C', -h, 0.3 + 0.45 * k, -0.55 * k, 0.3 + 0.65 * k, -0.95 * k, 0.3 + 0.9 * k],
        ['C', -0.5 * k, 0.3 + k, -0.12 * k, 0.3 + 0.8 * k, 0, 0.3 + 0.5 * k],
        ['C', 0.12 * k, 0.3 + 0.8 * k, 0.5 * k, 0.3 + k, 0.95 * k, 0.3 + 0.9 * k],
        ['C', 0.55 * k, 0.3 + 0.65 * k, h, 0.3 + 0.45 * k, h, 0.3],
        ['L', h, -0.5],
        ['Z'],
      ];
    default:
      return [['M', -h, -0.5], ['L', -h, h], ['L', h, h], ['L', h, -0.5], ['Z']];
  }
}

/** A diagonal link of width w between two cell centres, slightly overshooting both ends. */
export function diag(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  map: (x: number, y: number) => number[],
) {
  const dx = x2 - x1,
    dy = y2 - y1,
    l = Math.hypot(dx, dy),
    nx = ((-dy / l) * w) / 2,
    ny = ((dx / l) * w) / 2,
    ex = (dx / l) * w * 0.2,
    ey = (dy / l) * w * 0.2;
  const P = (
    [
      [x1 - ex + nx, y1 - ey + ny],
      [x2 + ex + nx, y2 + ey + ny],
      [x2 + ex - nx, y2 + ey - ny],
      [x1 - ex - nx, y1 - ey - ny],
    ] as Pt[]
  ).map(([a, b]) => map(a, b));
  return `<path d="M${P.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L')}Z"/>`;
}
