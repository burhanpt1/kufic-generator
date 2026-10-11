import type { RenderOptions } from '../render/svg';
import { U, diamond, f2, mix } from '../render/svg';

/** Eight-pointed star (two overlapping squares) with an inner circle and a centre diamond. */
export function starSVG(cx: number, cy: number, r: number, sw: number, colour: string) {
  const sq = (rot: number) => {
    const p = [];
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2;
      p.push(f2(cx + r * Math.cos(a)) + ' ' + f2(cy + r * Math.sin(a)));
    }
    return `<path d="M${p.join('L')}Z"/>`;
  };
  return (
    `<g fill="none" stroke="${colour}" stroke-width="${f2(sw)}" stroke-linejoin="miter">${sq(0)}${sq(Math.PI / 4)}<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r * 0.5)}"/></g>` +
    diamond(cx, cy, r * 0.22).replace('<path ', `<path fill="${colour}" `)
  );
}

/** <pattern id="vine">: a scrolling vine tile, faint ink on paper. */
export const vineDefs = (opt: RenderOptions) =>
  `<pattern id="vine" width="${6 * U}" height="${6 * U}" patternUnits="userSpaceOnUse"><g transform="scale(${U})" fill="none" stroke="${mix(opt.paper, opt.ink, 0.19)}" stroke-width=".16" stroke-linecap="round"><path d="M0 4.5C1.5 4.5 1.5 1.5 3 1.5S4.5 4.5 6 4.5"/><path d="M1.55 3.1c-.55.05-.75-.75-.2-.95.45-.15.7.4.3.55"/><path d="M4.45 2.9c.55-.05.75.75.2.95-.45.15-.7-.4-.3-.55"/><path d="M3 1.5c.2-.6.9-.8 1.3-.6-.3.4-.8.6-1.3.6z" fill="${mix(opt.paper, opt.ink, 0.19)}"/></g></pattern>`;
