#!/usr/bin/env node
// Baselines first: an entry for ../../BRIEF.md.   node procedure.mjs   writes placements.json beside this file.
//
// The idea: writing lives on lines. A reader finds the order of words by following a line and then taking the next
// one, so the words are set on a few level lines, read from the top line down and each line from right to left, and
// nothing else. What is left to decide is how many lines, which words on which, and how long each word is drawn; all
// three are chosen to make the writing as large as the circle allows. A circle is widest across its middle, so the
// lines that fit best are short at the top and bottom and long in the middle, and that is what comes out.
//
// Steps (every number is in nibs, the pen's width, unless it says otherwise):
//  1. On a line, each word is set after the one before it so that their inks are WORD_SPACE apart at their nearest
//     point (the ink is measured, not the boxes, so a word runs in over a tail or under a tall stroke). Each line
//     is centred on the circle's upright axis.
//  2. The lines stand at one even pitch, like ruled paper: the smallest pitch at which the inks of every pair of
//     neighbouring lines stay LINE_SPACE apart. An even pitch is what makes a stack of lines read as lines.
//  3. Every way of cutting the words into 1 to MAX_LINES lines in order is tried, and each is given a cost: the
//     radius of the smallest circle round its ink, raised by how far its lines fall short of the circle's width
//     where they sit (RAGGED times the mean squared shortfall). A cut whose lines follow the circle, short at the
//     top and bottom and long in the middle, costs least. The best few are carried to step 4.
//  4. In each of those, words that have a longer drawing are drawn out, shortest line first, wherever that lowers
//     the cost: a short line grows to meet its chord. The cheapest arrangement is kept.
//  5. The circle is the smallest one round all the ink, plus MARGIN.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const kit = JSON.parse(readFileSync(join(here, '../../kit.json'), 'utf8'));
const NIB = kit.nib,
  CELL = 0.2, // the grid the ink is measured on, pen units
  WORD_SPACE = 1.4, // between words on a line: clearly more than the space inside a word (about 0.45)
  LINE_SPACE = 0.55, // between the inks of neighbouring lines: a little more than the space inside a word
  MARGIN = 0.9, // between the ink and the circle
  RAGGED = 0.7, // how much a line that stops short of the circle's edge costs, against a larger circle
  MAX_LINES = 7,
  KEEP = 6; // cuts carried from step 3 to step 4

/** The convex hull of some points (Andrew's chain): all the smallest circle needs of a word. */
function hull(pts) {
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
function shapeOf(variant) {
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
function setLine(variants) {
  const reach = Math.ceil((WORD_SPACE * NIB) / CELL),
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
function lineOf(variants) {
  const at = setLine(variants),
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
function stack(lines, shifts) {
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
  return lines.map((_, i) => -i * pitch);
}
/** The smallest circle round a set of points (Bădoiu and Clarkson's walk towards the farthest point). */
function circle(pts) {
  let cx = 0,
    cy = 0;
  for (const [x, y] of pts) ((cx += x), (cy += y));
  cx /= pts.length;
  cy /= pts.length;
  let r = 0;
  for (let k = 1; k <= 150; k++) {
    let far = 0,
      fx = cx,
      fy = cy;
    for (const [x, y] of pts) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d > far) ((far = d), (fx = x), (fy = y));
    }
    r = Math.sqrt(far);
    cx += (fx - cx) / (k + 1);
    cy += (fy - cy) / (k + 1);
  }
  let far = 0;
  for (const [x, y] of pts) far = Math.max(far, (x - cx) ** 2 + (y - cy) ** 2);
  return { cx, cy, r: Math.sqrt(far) };
}
/** Everything about one arrangement: where each word's origin is (pen units), the circle round the ink, and its
 *  cost (step 3). */
function arrange(lines) {
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

function layout(text) {
  const n = text.words.length,
    plain = text.words.map(w => w.variants[0]),
    lineCache = new Map(),
    span = (a, b) => lineCache.get(a * 100 + b) ?? (lineCache.set(a * 100 + b, lineOf(plain.slice(a, b))), lineCache.get(a * 100 + b)); // prettier-ignore
  // step 3: every cut into lines
  const cuts = [];
  const walk = (start, cut) => {
    if (start === n) return void cuts.push({ cut: cut.slice(), cost: arrange(cut.map(([a, b]) => span(a, b))).cost });
    if (cut.length === MAX_LINES) return;
    for (let end = start + 1; end <= n; end++) {
      cut.push([start, end]);
      walk(end, cut);
      cut.pop();
    }
  };
  walk(0, []);
  cuts.sort((p, q) => p.cost - q.cost || p.cut.length - q.cut.length);
  // step 4: draw words out, on the best few cuts
  let best = null;
  for (const { cut } of cuts.slice(0, KEEP)) {
    const pick = text.words.map(() => 0),
      build = () => cut.map(([a, b]) => lineOf(text.words.slice(a, b).map((w, k) => w.variants[pick[a + k]]))); // prettier-ignore
    let lines = build(),
      cur = arrange(lines);
    for (let round = 0; round < 3; round++) {
      // the shortest line first: it has the most room to grow
      const order = cut.map((_, i) => i).sort((p, q) => lines[p].c1 - lines[p].c0 - (lines[q].c1 - lines[q].c0));
      for (const i of order)
        for (let w = cut[i][0]; w < cut[i][1]; w++)
          while (pick[w] + 1 < text.words[w].variants.length) {
            pick[w]++;
            const L2 = build(),
              a2 = arrange(L2);
            if (a2.cost < cur.cost - 1e-9) ((lines = L2), (cur = a2));
            else {
              pick[w]--;
              break;
            }
          }
    }
    if (!best || cur.cost < best.cost - 1e-9) best = { ...cur, pick: pick.slice(), lines: cut.length };
  }
  const R = best.r + MARGIN * NIB,
    r2 = x => Math.round(x * 100) / 100;
  return {
    radius: r2(R),
    lines: best.lines,
    words: best.words.map((w, i) => ({ variant: best.pick[i], x: r2(w.x - best.cx), y: r2(w.y - best.cy), rotate: 0, scale: 1 })), // prettier-ignore
  };
}

const layouts = {};
for (const t of kit.texts) {
  const { lines, ...l } = layout(t);
  layouts[t.id] = l;
  console.log(
    `${t.id}: ${lines} line${lines > 1 ? 's' : ''}, radius ${l.radius} (${(l.radius / NIB).toFixed(1)} nibs)`,
  );
}
writeFileSync(
  join(here, 'placements.json'),
  JSON.stringify(
    {
      entry: 'baselines-first',
      principle:
        'Writing lives on lines. The words are set on a few level lines and nowhere else; how many lines, which words on which, and how long each word is drawn are all chosen to make the writing as large as the circle allows. Words on a line, and lines under one another, are spaced by their ink, not their boxes.',
      reading: 'Start at the top line and read each line from right to left.',
      layouts,
    },
    null,
    1,
  ) + '\n',
);
