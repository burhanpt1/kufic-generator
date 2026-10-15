// Shared SVG helpers and render options.

/** Screen units per cell. */
export const U = 10;
/** Number formatting used in every coordinate: at most 2 decimals, no trailing zeros. */
export const f2 = (n: number) => (Math.round(n * 100) / 100).toString();
export const markW = (w: number) => Math.min(w, 0.5);
export const diamondR = (w: number) => 0.42 + 0.22 * w;

export interface RenderOptions {
  weight: number;
  soft: number;
  ink: string;
  ink2: string;
  paper: string;
  mark: string;
  grid: boolean;
  label: string;
  terminal: 'none' | 'notch' | 'bevel' | 'leaf' | 'palmette';
  colourMode: 'solid' | 'ring' | 'repeat' | 'radial';
  ground: 'plain' | 'tint' | 'vine' | 'geo';
  corners: 'none' | 'stars' | 'geo' | 'vine';
  bandStyle: 'none' | 'lines' | 'pearls' | 'chevron' | 'braid';
  tiling: 'sq' | '488' | 'hex' | '31212' | 'mg8' | 'mg10' | 'mg12';
  geoAngle: number;
  geoScale: number;
  letterStyle: 'solid' | 'banded';
  /** Stroke mode for letters; blocks (the default) is the cell grid. */
  stroke?: 'blocks' | 'curved' | 'pen';
  /** Corner rounding for curved and pen strokes. */
  curve?: number;
  /** Curved strokes: verticals thinner than horizontals (0..1), and free stem ends thinning to their tips (0..1). */
  contrast?: number;
  taper?: number;
  /** Curved strokes: leaves along long stems and tendrils along long horizontal runs. */
  flourish?: 'none' | 'sprouts';
}

/** Letter output grouped by fill colour, plus vowel marks (drawn in the mark colour). */
export interface Shapes {
  ink: Map<string, string[]>;
  vow: string[];
}

/** Linear mix of two #rrggbb colours. */
export function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)),
    A = p(a),
    B = p(b);
  return (
    '#' +
    A.map((v, i) =>
      Math.round(v + (B[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    ).join('')
  );
}

export type Cmd = (string | number)[];
/** Path commands in local coordinates -> <path>, mapping each point through map. */
export function pathFrom(cmds: Cmd[], map: (x: number, y: number) => number[]) {
  let d = '';
  for (const c of cmds) {
    if (c[0] === 'Z') {
      d += 'Z';
      continue;
    }
    const pts = [];
    for (let i = 1; i < c.length; i += 2) {
      const [x, y] = map(c[i] as number, c[i + 1] as number);
      pts.push(f2(x) + ' ' + f2(y));
    }
    d += c[0] + pts.join(' ');
  }
  return `<path d="${d}"/>`;
}
export const diamond = (cx: number, cy: number, r: number) =>
  `<path d="M${f2(cx)} ${f2(cy - r)}L${f2(cx + r)} ${f2(cy)}L${f2(cx)} ${f2(cy + r)}L${f2(cx - r)} ${f2(cy)}Z"/>`;

export function keyColour(opt: RenderOptions, key: number, maxKey: number) {
  if (opt.colourMode === 'solid' || opt.colourMode === 'radial' || !key) return opt.ink;
  return mix(opt.ink, opt.ink2, maxKey > 1 ? (key - 1) / (maxKey - 1) : 0);
}
/** Accent colour for ornament: the second ink unless letters are a single solid colour. */
export const acc = (opt: RenderOptions) => (opt.colourMode === 'solid' ? opt.ink : opt.ink2);

export const merge = (a: Shapes, b: Shapes) => {
  b.ink.forEach((arr, c) => {
    if (!a.ink.has(c)) a.ink.set(c, []);
    a.ink.get(c)!.push(...arr);
  });
  a.vow.push(...b.vow);
  return a;
};

/** The outer <svg> with a paper background. */
export const wrap = (W: number, Hh: number, opt: Pick<RenderOptions, 'label' | 'paper'>, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(W)} ${f2(Hh)}" width="${f2(W)}" height="${f2(Hh)}" role="img" aria-label="${opt.label.replace(/["<>&]/g, '')}"><rect width="${f2(W)}" height="${f2(Hh)}" fill="${opt.paper}"/>${body}</svg>`;
/** Letter groups (one <g> per colour; fill overrides the colour unless it's the paper) then vowels. */
export const groupsOut = (opt: RenderOptions, sh: Shapes, fill: string | null, soft?: number) =>
  [...sh.ink]
    .map(([c, arr]) => {
      const f = c === opt.paper ? c : fill || c;
      return `<g fill="${f}"${soft && c !== opt.paper ? ` stroke="${f}" stroke-width="${f2(soft)}" stroke-linejoin="round"` : ''}>${arr.join('')}</g>`;
    })
    .join('') + `<g fill="${opt.mark}">${sh.vow.join('')}</g>`;
