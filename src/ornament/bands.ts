import type { RenderOptions } from '../render/svg';
import { f2, mix } from '../render/svg';

export type BandShape =
  | { C: number; r: number } // circle: centre (C, C), radius r
  | { o: number; Ls: number }; // square: inset o, side Ls

// ornamental band along a circle (r) or square (inset o, side Ls) of width bw, in screen units
export function bandSVG(style: string, shape: 'circle' | 'square', p: BandShape, bw: number, opt: RenderOptions) {
  if (style === 'none' || bw <= 0) return '';
  const col = mix(opt.ink, opt.paper, 0.2),
    C = (p as { C: number }).C;
  const pc = p as { C: number; r: number },
    ps = p as { o: number; Ls: number };
  // point at parameter t (0..1) with offset off along the outward normal
  const at = (t: number, off: number) => {
    if (shape === 'circle') {
      const a = 2 * Math.PI * t,
        r = pc.r + off;
      return [C + r * Math.cos(a), C + r * Math.sin(a)];
    }
    const Ls = ps.Ls,
      side = Math.min(3, Math.floor(t * 4)),
      u = (t * 4 - side) * Ls,
      a0 = ps.o,
      a1 = ps.o + Ls;
    return [
      [a0 + u, a0 - off],
      [a1 + off, a0 + u],
      [a1 - u, a1 + off],
      [a0 - off, a1 - u],
    ][side];
  };
  const len = shape === 'circle' ? 2 * Math.PI * pc.r : 4 * ps.Ls;
  const line = (off: number, sw: number) => {
    if (shape !== 'circle') {
      const a0 = ps.o - off,
        s = ps.Ls + 2 * off;
      return `<rect x="${f2(a0)}" y="${f2(a0)}" width="${f2(s)}" height="${f2(s)}" fill="none" stroke="${col}" stroke-width="${f2(sw)}"/>`;
    }
    const n = shape === 'circle' ? 240 : 4;
    let d = '';
    for (let i = 0; i <= n; i++) {
      const [x, y] = at(i / n, off);
      d += (i ? 'L' : 'M') + f2(x) + ' ' + f2(y);
    }
    return `<path d="${d}Z" fill="none" stroke="${col}" stroke-width="${f2(sw)}" stroke-linejoin="miter"/>`;
  };
  const thin = bw * 0.06;
  if (style === 'lines') return line(-bw * 0.18, thin) + line(bw * 0.18, thin);
  let out = line(-bw * 0.42, thin) + line(bw * 0.42, thin);
  const per = shape === 'circle' ? 1 : 4,
    unit = style === 'pearls' ? bw * 0.62 : style === 'chevron' ? bw * 0.7 : bw * 1.5;
  const count = Math.max(per, Math.round(len / unit / per) * per);
  if (style === 'pearls') {
    for (let i = 0; i < count; i++) {
      const [x, y] = at((i + 0.5) / count, 0);
      out += `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(bw * 0.17)}" fill="${col}"/>`;
    }
    return out;
  }
  if (style === 'chevron') {
    let d = '';
    for (let i = 0; i <= count * 2; i++) {
      const [x, y] = at(i / (count * 2), (i % 2 ? 1 : -1) * bw * 0.24);
      d += (i ? 'L' : 'M') + f2(x) + ' ' + f2(y);
    }
    return out + `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f2(bw * 0.09)}" stroke-linejoin="miter"/>`;
  }
  // braid: two strands crossing; the second is drawn over a paper halo on alternate crossings
  const strand = (ph: number) => {
    const pts = [];
    const n = count * 16;
    for (let i = 0; i <= n; i++) pts.push(at(i / n, Math.sin((2 * Math.PI * count * i) / n + ph) * bw * 0.26));
    return pts;
  };
  const toD = (pts: number[][]) => pts.map(([x, y], i) => (i ? 'L' : 'M') + f2(x) + ' ' + f2(y)).join('');
  const A = strand(0),
    B = strand(Math.PI),
    sw = bw * 0.11;
  out += `<path d="${toD(A)}" fill="none" stroke="${col}" stroke-width="${f2(sw)}"/>`;
  for (let k = 0; k < count; k++) {
    const s = k * 16 + 4,
      seg = B.slice(s - 4, s + 5);
    out += `<path d="${toD(seg)}" fill="none" stroke="${opt.paper}" stroke-width="${f2(sw * 2.4)}"/><path d="${toD(seg)}" fill="none" stroke="${col}" stroke-width="${f2(sw)}"/>`;
  }
  for (let k = 0; k < count; k++) {
    const s = k * 16 + 12,
      seg = B.slice(s - 4, Math.min(B.length, s + 5));
    out += `<path d="${toD(seg)}" fill="none" stroke="${col}" stroke-width="${f2(sw)}"/>`;
  }
  for (let k = 0; k < count; k++) {
    const [x, y] = at((k + 0.25) / count, 0);
    out += `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(bw * 0.07)}" fill="${col}"/>`;
  }
  return out;
}
