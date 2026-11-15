#!/usr/bin/env node
// Draws and checks a placement file against kit.json. No dependencies:
//   node kit.mjs my-placements.json [out-dir]
// For every text placed it writes <out-dir>/<entry>-<text>.svg (black on a light disc) and prints:
//   inside   whether every point of every word lies inside the circle
//   touching the area (square pen units) where two words' inks overlap or come nearer than 0.3 of a nib
//   fill     ink area as a share of the disc
//   radius   in pen units and in nibs (smaller means larger letters for the same disc)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const kit = JSON.parse(readFileSync(join(here, 'kit.json'), 'utf8'));
const file = process.argv[2];
if (!file) {
  console.error('usage: node kit.mjs placements.json [out-dir]');
  process.exit(2);
}
const entry = JSON.parse(readFileSync(file, 'utf8'));
const out = process.argv[3] ?? '.';
mkdirSync(out, { recursive: true });
const name = String(entry.entry ?? 'entry').replace(/[^A-Za-z0-9_-]/g, '-');

/** A word's outline moved to where the placement puts it. */
function placed(variant, p) {
  const s = p.scale ?? 1,
    a = ((p.rotate ?? 0) * Math.PI) / 180,
    c = Math.cos(a),
    n = Math.sin(a);
  return variant.polys.map(q => q.map(([x, y]) => [p.x + s * (x * c - y * n), p.y + s * (x * n + y * c)]));
}
/** Cells (of side `cell`) whose centre is inside the polygons, non-zero winding, grown by `grow` cells. */
function raster(polys, R, cell, grow) {
  const N = Math.ceil((2 * R) / cell) + 2 * grow + 4,
    g = new Uint8Array(N * N),
    X = x => (x + R) / cell + grow + 2,
    Y = y => (y + R) / cell + grow + 2;
  for (let j = 0; j < N; j++) {
    const yc = j + 0.5,
      xs = [];
    for (const q of polys)
      for (let i = 0; i < q.length; i++) {
        const [x0, y0] = q[i],
          [x1, y1] = q[(i + 1) % q.length],
          a = Y(y0),
          b = Y(y1);
        if (a <= yc === b <= yc) continue;
        xs.push([X(x0) + ((yc - a) / (b - a)) * (X(x1) - X(x0)), b > a ? 1 : -1]);
      }
    xs.sort((p, q) => p[0] - q[0]);
    let w = 0;
    for (let k = 0; k + 1 < xs.length; k++) {
      w += xs[k][1];
      if (w !== 0) for (let i = Math.max(0, Math.ceil(xs[k][0] - 0.5)); i < Math.min(N, xs[k + 1][0] - 0.5); i++) g[j * N + i] = 1; // prettier-ignore
    }
  }
  if (!grow) return { g, N };
  const d = new Uint8Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if (!g[j * N + i]) continue;
      for (let dj = -grow; dj <= grow; dj++)
        for (let di = -grow; di <= grow; di++)
          if (di * di + dj * dj <= grow * grow && j + dj >= 0 && j + dj < N && i + di >= 0 && i + di < N) d[(j + dj) * N + i + di] = 1; // prettier-ignore
    }
  return { g: d, N };
}

let bad = false;
for (const [id, lay] of Object.entries(entry.layouts ?? {})) {
  const text = kit.texts.find(t => t.id === id);
  if (!text) {
    console.log(`${id}: no such text in the kit`);
    bad = true;
    continue;
  }
  const R = lay.radius,
    ws = lay.words ?? [];
  const problems = [];
  if (!(R > 0)) problems.push('radius missing');
  if (ws.length !== text.words.length) problems.push(`${ws.length} words placed, the text has ${text.words.length}`);
  const shapes = ws.map((p, i) => {
    const w = text.words[i],
      v = w?.variants[p.variant ?? 0];
    if (!v) problems.push(`word ${i}: no variant ${p.variant}`);
    if ((p.scale ?? 1) < 0.5 || (p.scale ?? 1) > 1) problems.push(`word ${i}: scale ${p.scale} is outside 0.5 to 1`);
    return v ? placed(v, p) : [];
  });
  let outside = 0;
  for (const s of shapes) for (const q of s) for (const [x, y] of q) if (Math.hypot(x, y) > R + 1e-6) outside++;
  // inks grown by 0.15 of a nib each, so two that share a cell stand nearer than 0.3 of a nib
  const cell = 0.2,
    grow = Math.round((0.15 * kit.nib) / cell);
  const grown = shapes.map(s => raster(s, R, cell, grow)),
    plain = shapes.map(s => raster(s, R, cell, 0));
  let touch = 0,
    ink = 0;
  if (grown.length) {
    const n = grown[0].g.length,
      count = new Uint8Array(n);
    for (const { g } of grown) for (let i = 0; i < n; i++) count[i] += g[i];
    for (let i = 0; i < n; i++) if (count[i] > 1) touch++;
    for (const { g } of plain) for (let i = 0; i < g.length; i++) ink += g[i];
  }
  const fill = (ink * cell * cell) / (Math.PI * R * R);
  console.log(
    `${id}: inside ${outside ? `NO (${outside} points out)` : 'yes'}; touching ${(touch * cell * cell).toFixed(1)}; fill ${(100 * fill).toFixed(1)}%; radius ${R} (${(R / kit.nib).toFixed(1)} nibs)` +
      (problems.length ? `; PROBLEMS: ${problems.join('; ')}` : ''),
  );
  if (outside || problems.length) bad = true;
  const pad = 2,
    S = 2 * (R + pad),
    d = shapes
      .map(s =>
        s
          .map(q => 'M' + q.map(([x, y]) => `${(x + R + pad).toFixed(2)} ${(R + pad - y).toFixed(2)}`).join('L') + 'Z')
          .join(''),
      )
      .join('');
  writeFileSync(
    join(out, `${name}-${id}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="900" height="900"><rect width="100%" height="100%" fill="#f3efe4"/>` +
      `<circle cx="${R + pad}" cy="${R + pad}" r="${R}" fill="#fffdf6" stroke="#b9a76a" stroke-width="${(R * 0.03).toFixed(2)}"/>` +
      `<path d="${d}" fill="#1a1a1a" fill-rule="nonzero"/></svg>\n`,
  );
}
process.exit(bad ? 1 : 0);
