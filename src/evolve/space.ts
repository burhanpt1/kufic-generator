// Empty space (lab port §2): how much of a composition is blank, and how big its largest enclosed blank patch is.
// Workers can't decode SVG images, so the placed composition is rasterised directly at 160×160: letters, lines and
// ornaments as ink, patterned and vine areas as texture. Flat areas (paper, tints, plain bands) stay blank whatever
// their colour, as on the rendered image; unlike the lab, solid ink (a dense seal's blocks) counts as filled.
import { rasterCells } from '../script/vector';
import type { Area, Placed } from '../compose/placed';
import { placeMap } from '../compose/textBorder';
import type { Pt } from '../geometry/types';

const N = 160;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** Luminance raster of the composition (255 paper, 0 ink), N×N. */
export function rasterise(placed: Placed): Uint8Array {
  const img = new Uint8Array(N * N).fill(255),
    [ox, oy] = placed.canvas.origin,
    k = N / Math.max(placed.canvas.w, placed.canvas.h),
    P = (p: Pt): Pt => [(ox + p[0]) * k, (oy + p[1]) * k];
  const dot = (x: number, y: number, r = 0.5) => {
    const x0 = Math.floor(x - r),
      x1 = Math.ceil(x + r),
      y0 = Math.floor(y - r),
      y1 = Math.ceil(y + r);
    for (let Y = Math.max(0, y0); Y < Math.min(N, y1); Y++)
      for (let X = Math.max(0, x0); X < Math.min(N, x1); X++) img[Y * N + X] = 0;
  };
  const line = (a: Pt, b: Pt, w = 1) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.ceil(L * 2));
    for (let i = 0; i <= n; i++)
      dot(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, Math.max(0.5, w / 2));
  };
  const poly = (Q: Pt[], closed: boolean, w = 1) => {
    for (let i = 1; i < Q.length; i++) line(Q[i - 1], Q[i], w);
    if (closed && Q.length > 2) line(Q[Q.length - 1], Q[0], w);
  };
  // textured area: even-odd scanline fill with a hatch (alternate pixels), so it never reads as flat
  const texture = (area: Area) => {
    const rings = area.map(r => r.map(P));
    for (let Y = 0; Y < N; Y++) {
      const y = Y + 0.5,
        xs: number[] = [];
      for (const R of rings)
        for (let i = 0, j = R.length - 1; i < R.length; j = i++) {
          const [x1, y1] = R[j],
            [x2, y2] = R[i];
          if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2)
        for (let X = Math.max(0, Math.ceil(xs[q] - 0.5)); X < Math.min(N, xs[q + 1] - 0.5); X++)
          if ((X + Y) % 3 === 0) img[Y * N + X] = 0;
    }
  };
  poly(placed.meta.outline.map(P), true);
  for (const it of placed.items) {
    switch (it.type) {
      case 'ground':
      case 'spandrels':
        if (it.kind === 'pattern' || it.kind === 'vine') texture(it.area);
        else if (it.type === 'spandrels') for (const r of it.area) poly(r.map(P), true);
        break;
      case 'pattern':
        texture(it.area);
        break;
      case 'fill':
        if (it.kind === 'vine') texture(it.area);
        break;
      case 'strip': {
        const st = it.strip.kind === 'cells' ? it.strip : rasterCells(it.strip),
          cell = placeMap(it.place),
          r = Math.max(0.5, (it.place.s * k) / 2);
        for (let y = 0; y < st.Hb; y++)
          for (let x = 0; x < st.W; x++)
            if (st.data[y * st.W + x]) {
              const [X, Y] = P(cell(x + 0.5, y + 0.5));
              dot(X, Y, r);
            }
        break;
      }
      case 'grid': {
        // a maze's corridors and a seal's counters are part of the letters, not empty space: blank cells next to
        // ink get a speck of texture
        const g = it.grid,
          r = Math.max(0.5, (it.cell * k) / 2),
          ink = (x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h && !!g.data[y * g.w + x];
        for (let y = 0; y < g.h; y++)
          for (let x = 0; x < g.w; x++) {
            const [X, Y] = P([it.at[0] + (x + 0.5) * it.cell, it.at[1] + (y + 0.5) * it.cell]);
            if (ink(x, y)) dot(X, Y, r);
            else if (ink(x - 1, y) || ink(x + 1, y) || ink(x, y - 1) || ink(x, y + 1)) dot(X, Y, 0.5);
          }
        break;
      }
      case 'separator':
        poly(it.path.map(P), true, Math.max(1, it.width * k * 0.5));
        break;
      case 'rule':
        poly(it.path.map(P), true, Math.max(1, it.width * k));
        break;
      case 'ribbon':
        for (const q of it.paths) poly(q.map(P), false, Math.max(1, it.width * k));
        break;
      case 'star':
      case 'diamond': {
        const c = P(it.type === 'star' ? it.centre : it.p);
        dot(c[0], c[1], Math.max(1, it.r * k * 0.7));
        break;
      }
      case 'finial': {
        const a = P(it.p);
        line(
          a,
          [a[0] + it.bisector[0] * it.length * k, a[1] + it.bisector[1] * it.length * k],
          Math.max(1, it.size * k),
        );
        break;
      }
      case 'roundel': {
        // a filled field with letters all over it: no empty space inside its rim
        const R = it.Rf + (it.framed ? it.rim : 0),
          a = (R + (it.Rf + it.rim) * (it.oval - 1)) * it.s,
          b = R * it.s;
        texture([Array.from({ length: 48 }, (_, i) => [it.centre[0] + a * Math.cos((i * Math.PI) / 24), it.centre[1] + b * Math.sin((i * Math.PI) / 24)] as Pt)]); // prettier-ignore
        break;
      }
      case 'abjad': {
        const [cx, cy] = it.centre,
          hw = it.maxW / 2,
          hh = it.maxH / 2;
        texture([
          [
            [cx - hw, cy - hh],
            [cx + hw, cy - hh],
            [cx + hw, cy + hh],
            [cx - hw, cy + hh],
          ],
        ]);
        break;
      }
    }
  }
  return img;
}

/** The lab's empty-space score on a 160×160 luminance raster: 1 = little empty space. */
export function spaceScore(lum: Uint8Array): number {
  const C = 40,
    S = 4,
    blank = new Uint8Array(C * C);
  for (let cy = 0; cy < C; cy++)
    for (let cx = 0; cx < C; cx++) {
      let s = 0,
        s2 = 0;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const l = lum[(cy * S + y) * N + cx * S + x];
          s += l;
          s2 += l * l;
        }
      const n = S * S,
        sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
      blank[cy * C + cx] = sd < 7 && s / n > 127 ? 1 : 0; // flat paper = blank (solid ink is filled, not empty)
    }
  let cnt = 0,
    tot = 0; // ignore a 3-cell frame
  for (let y = 3; y < C - 3; y++)
    for (let x = 3; x < C - 3; x++) {
      tot++;
      cnt += blank[y * C + x];
    }
  const seen = new Uint8Array(C * C);
  let maxBlob = 0; // largest enclosed blank patch
  for (let k = 0; k < C * C; k++) {
    if (!blank[k] || seen[k]) continue;
    let n = 0,
      edge = false;
    const st = [k];
    seen[k] = 1;
    while (st.length) {
      const q = st.pop()!,
        qx = q % C,
        qy = (q - qx) / C;
      n++;
      if (qx < 3 || qy < 3 || qx >= C - 3 || qy >= C - 3) edge = true;
      for (const [a, b] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const X = qx + a,
          Y = qy + b;
        if (X < 0 || Y < 0 || X >= C || Y >= C) continue;
        const r = Y * C + X;
        if (blank[r] && !seen[r]) {
          seen[r] = 1;
          st.push(r);
        }
      }
    }
    if (!edge) maxBlob = Math.max(maxBlob, n);
  }
  const empty = cnt / tot,
    blob = maxBlob / tot;
  return clamp(1 - Math.max(0, empty - 0.3) / 0.45) * clamp(1 - Math.max(0, blob - 0.05) / 0.2);
}

export const emptySpace = (p: Placed) => spaceScore(rasterise(p));
