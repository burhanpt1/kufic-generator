// What the baselines-first procedure and the curved-axes experiments share: a word's ink on a grid, a line of words
// set by their ink, the even pitch of a stack of lines, and the smallest circle round some points.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export { here };
export const kit = JSON.parse(readFileSync(join(here, '../../kit.json'), 'utf8'));
export const NIB = kit.nib;
export const CELL = 0.2, // the grid the ink is measured on, pen units
  WORD_SPACE = 1.4, // between words on a line: clearly more than the space inside a word (about 0.45)
  LINE_SPACE = 0.55, // between the inks of neighbouring lines: a little more than the space inside a word
  MARGIN = 0.9, // between the ink and the circle
  RAGGED = 0.7; // how much a line that stops short of the circle's edge costs, against a larger circle

/** The convex hull of some points (Andrew's chain): all the smallest circle needs of a word. */
export function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]),
    half = list => {
      const h = [];
      for (const q of list) {
        while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
        h.push(q);
      }
      h.pop();
      return h;
    };
  return [...half(p), ...half(p.reverse())];
}
// ---- a word's ink on the grid: for each row its leftmost and rightmost ink, for each column its lowest and highest
const shapes = new Map();
export function shapeOf(variant) {
  let s = shapes.get(variant);
  if (s) return s;
  const { x0, x1, y0, y1 } = variant.box,
    c0 = Math.floor(x0 / CELL) - 1,
    r0 = Math.floor(y0 / CELL) - 1,
    W = Math.ceil(x1 / CELL) + 1 - c0,
    H = Math.ceil(y1 / CELL) + 1 - r0,
    g = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) {
    const yc = (r0 + j + 0.5) * CELL,
      xs = [];
    for (const q of variant.polys)
      for (let i = 0; i < q.length; i++) {
        const [ax, ay] = q[i],
          [bx, by] = q[(i + 1) % q.length];
        if (ay <= yc === by <= yc) continue;
        xs.push([ax + ((yc - ay) / (by - ay)) * (bx - ax), by > ay ? 1 : -1]);
      }
    xs.sort((p, q) => p[0] - q[0]);
    let w = 0;
    for (let k = 0; k + 1 < xs.length; k++) {
      w += xs[k][1];
      if (w !== 0)
        for (let i = Math.max(0, Math.floor(xs[k][0] / CELL) - c0); i <= Math.min(W - 1, Math.floor(xs[k + 1][0] / CELL) - c0); i++) g[j * W + i] = 1; // prettier-ignore
    }
  }
  // rows: [row index, leftmost column, rightmost column]; columns: [column index, lowest row, highest row]
  const rows = [],
    cols = new Map();
  for (let j = 0; j < H; j++) {
    let a = -1,
      b = -1;
    for (let i = 0; i < W; i++)
      if (g[j * W + i]) {
        if (a < 0) a = i;
        b = i;
        const c = cols.get(i + c0);
        if (!c) cols.set(i + c0, [j + r0, j + r0]);
        else c[1] = j + r0;
      }
    if (a >= 0) rows.push([j + r0, a + c0, b + c0]);
  }
  s = { rows, cols: [...cols].map(([c, [lo, hi]]) => [c, lo, hi]), pts: hull(variant.polys.flat()) };
  shapes.set(variant, s);
  return s;
}

// ---- step 1: a line of words, right to left, each set by its ink. Returns each word's origin column (in cells).
export function setLine(variants, space = WORD_SPACE) {
  const reach = Math.ceil((space * NIB) / CELL),
    left = new Map(); // row -> leftmost ink column so far on the line
  const at = [];
  let boxLeft = 0;
  variants.forEach((v, k) => {
    const s = shapeOf(v);
    let x = k === 0 ? 0 : Infinity;
    if (k > 0) {
      for (const [r, , hi] of s.rows)
        for (let d = -reach; d <= reach; d++) {
          const l = left.get(r + d);
          if (l === undefined) continue;
          // the gap wanted, across the line, for inks this many rows apart (a circle of WORD_SPACE round the ink)
          const need = Math.sqrt(Math.max(0, reach * reach - d * d));
          x = Math.min(x, l - hi - 1 - Math.ceil(need));
        }
      if (x === Infinity) x = boxLeft - reach - Math.max(...s.rows.map(q => q[2])); // nothing faces it: by its box
    }
    at.push(x);
    for (const [r, lo] of s.rows) left.set(r, Math.min(left.get(r) ?? Infinity, x + lo));
    boxLeft = Math.min(boxLeft, x + Math.min(...s.rows.map(q => q[1])));
  });
  return at;
}
/** A line as set: its words' origin columns, its lowest and highest ink per column, and its extent. */
export function lineOf(variants, space = WORD_SPACE) {
  const at = setLine(variants, space),
    lo = new Map(),
    hi = new Map();
  variants.forEach((v, k) => {
    for (const [c, a, b] of shapeOf(v).cols) {
      const x = c + at[k];
      lo.set(x, Math.min(lo.get(x) ?? Infinity, a));
      hi.set(x, Math.max(hi.get(x) ?? -Infinity, b));
    }
  });
  const xs = [...lo.keys()];
  return { variants, at, lo, hi, c0: Math.min(...xs), c1: Math.max(...xs) };
}

// ---- step 2: the lines at one even pitch: the least at which every pair of neighbours keeps LINE_SPACE of ink
/** The even pitch of some lines, in cells. */
export function pitchOf(lines, shifts) {
  const reach = Math.ceil((LINE_SPACE * NIB) / CELL);
  let pitch = 0;
  for (let i = 1; i < lines.length; i++) {
    const A = lines[i - 1],
      B = lines[i];
    for (const [c, top] of B.hi)
      for (let d = -reach; d <= reach; d++) {
        const low = A.lo.get(c + shifts[i] - shifts[i - 1] + d);
        if (low === undefined) continue;
        const need = Math.sqrt(Math.max(0, reach * reach - d * d));
        pitch = Math.max(pitch, top - low + 1 + Math.ceil(need));
      }
  }
  return pitch;
}
export function stack(lines, shifts) {
  const pitch = pitchOf(lines, shifts);
  return lines.map((_, i) => -i * pitch);
}
/** The smallest circle round a set of points (Bădoiu and Clarkson's walk towards the farthest point). */
export function circle(pts) {
  let cx = 0,
    cy = 0;
  for (const [x, y] of pts) {
    cx += x;
    cy += y;
  }
  cx /= pts.length;
  cy /= pts.length;
  for (let k = 1; k <= 150; k++) {
    let far = 0,
      fx = cx,
      fy = cy;
    for (const [x, y] of pts) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d > far) {
        far = d;
        fx = x;
        fy = y;
      }
    }
    cx += (fx - cx) / (k + 1);
    cy += (fy - cy) / (k + 1);
  }
  let far = 0;
  for (const [x, y] of pts) far = Math.max(far, (x - cx) ** 2 + (y - cy) ** 2);
  return { cx, cy, r: Math.sqrt(far) };
}
/** Everything about one arrangement: where each word's origin is (pen units), the circle round the ink, and its
 *  cost (step 3). */
export function arrange(lines) {
  const shifts = lines.map(L => -Math.round((L.c0 + L.c1 + 1) / 2)),
    base = stack(lines, shifts),
    words = [],
    pts = [];
  lines.forEach((L, i) =>
    L.variants.forEach((v, k) => {
      const x = (L.at[k] + shifts[i]) * CELL,
        y = base[i] * CELL;
      words.push({ v, x, y });
      for (const [px, py] of shapeOf(v).pts) pts.push([px + x, py + y]);
    }),
  );
  const c = circle(pts);
  // how far each line falls short of the circle's width at the height of its body (baseline to mid-height)
  let short = 0;
  lines.forEach((L, i) => {
    const y0 = base[i] * CELL - c.cy,
      y1 = y0 + 5,
      half = Math.sqrt(Math.max(0, c.r * c.r - Math.max(y0 * y0, y1 * y1))),
      w = (L.c1 - L.c0 + 1) * CELL;
    short += half > 0 ? Math.max(0, 1 - w / (2 * half)) ** 2 : 1;
  });
  return { words, ...c, cost: c.r * (1 + (RAGGED * short) / lines.length) };
}
