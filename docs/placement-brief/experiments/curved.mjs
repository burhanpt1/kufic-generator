#!/usr/bin/env node
// Curved axes: the same words, set on lines as in ../entries/baselines-first, but the lines are not level. Three
// families of lines are tried (owner's suggestion, 15 November 2026), each writing <family>.json beside this file:
//
//   lens   a line bends more the further it is from the centre, the way the circle's own edge does: the middle line
//          is straight, the lines above arch, the lines below hang, and a line at the edge would be the edge.
//   bow    the same, bent 2.4 times as much, to see the bend plainly.
//   pinch  the opposite bend: lines bow towards the centre, as a ruled sheet sags round a weight set on it.
//   flow   the centre is kept empty and the lines part to pass round it, as a stream passes a stone (the lines are
//          the streamlines of that flow); far from the centre they are level.
//
// For each family and text: the words of each line are set level by their ink (lines.mjs), and each word is then
// stood on its curved line where it would have stood on the level one, turned to the line's direction at its
// middle. The circle is the smallest in which some cut of the words into lines fits the lines' lengths; if words
// touch or leave the circle when drawn (curved lines bring tall strokes together on the inside of a bend), the
// spaces and the circle are opened a little and it is tried again.
//   node curved.mjs [family ...]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CELL, MARGIN, NIB, WORD_SPACE, kit, lineOf, pitchOf } from '../entries/baselines-first/lines.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const UP = 10, // how far a line's tall strokes rise above it, and
  DOWN = 6, // how far its tails fall below it, when judging how much of a line lies inside the circle
  MAX_LINES = 7;

/** A line through the point (0, h): where it is `s` along it from that point (positive to the right), and its
 *  direction there (radians). */
const FAMILIES = {
  lens: (h, R) => arc(h, h / (R * R)),
  bow: (h, R) => arc(h, (2.4 * h) / (R * R)),
  pinch: (h, R) => arc(h, (-0.7 * h) / (R * R)),
  flow: (h, R) => streamline(h, 0.22 * R),
};
function arc(h, k) {
  if (Math.abs(k) < 1e-7) return { pt: s => [s, h], ang: () => 0 };
  const rho = 1 / k;
  return { pt: s => [rho * Math.sin(s / rho), h - rho + rho * Math.cos(s / rho)], ang: s => -s / rho };
}
/** The streamline of a level flow past a disc of radius a that passes through (0, h): y (1 − a²/r²) = const. */
function streamline(h, a) {
  const sign = Math.sign(h) || 1,
    H = Math.abs(h),
    psi = H - (a * a) / H,
    step = 0.2,
    xs = [0],
    ys = [H],
    len = [0];
  for (let x = step; x < 400; x += step) {
    let lo = Math.max(psi, 1e-6),
      hi = H;
    for (let k = 0; k < 40; k++) {
      const y = (lo + hi) / 2;
      if (y * (1 - (a * a) / (x * x + y * y)) < psi) lo = y;
      else hi = y;
    }
    const y = (lo + hi) / 2,
      n = xs.length;
    len.push(len[n - 1] + Math.hypot(x - xs[n - 1], y - ys[n - 1]));
    xs.push(x);
    ys.push(y);
  }
  const at = s => {
    const t = Math.min(Math.abs(s), len[len.length - 1] - 1e-6);
    let i = Math.min(len.length - 2, Math.floor(t / step));
    while (i > 0 && len[i] > t) i--;
    while (i < len.length - 2 && len[i + 1] < t) i++;
    const f = (t - len[i]) / (len[i + 1] - len[i]);
    return { x: xs[i] + f * (xs[i + 1] - xs[i]), y: ys[i] + f * (ys[i + 1] - ys[i]), a: Math.atan2(ys[i + 1] - ys[i], xs[i + 1] - xs[i]) }; // prettier-ignore
  };
  return {
    pt: s => {
      const q = at(s);
      return [Math.sign(s) * q.x, sign * q.y];
    },
    ang: s => Math.sign(s) * sign * at(s).a,
  };
}
/** The heights at which the lines cross the circle's upright axis. */
function heights(family, n, pitch, R) {
  if (family !== 'flow') return Array.from({ length: n }, (_, i) => ((n - 1) / 2 - i) * pitch - 2);
  // above and below the empty centre: the lower half's tall strokes need the room the upper half's tails do not
  const a = 0.22 * R,
    top = Math.ceil(n / 2);
  return Array.from({ length: n }, (_, i) => (i < top ? a + 1 + (top - 1 - i) * pitch : -(a + UP * 0.75) - (i - top) * pitch)); // prettier-ignore
}
/** How long a stretch of the line, centred on the axis, lies inside the circle with its tall strokes and tails. */
function room(line, R) {
  const inside = s => {
    const [x, y] = line.pt(s),
      a = line.ang(s),
      nx = -Math.sin(a),
      ny = Math.cos(a);
    return Math.hypot(x + UP * nx, y + UP * ny) < R && Math.hypot(x - DOWN * nx, y - DOWN * ny) < R;
  };
  let s = 0;
  while (s < 3 * R && inside(s) && inside(-s)) s += 0.25;
  return 2 * Math.max(0, s - 0.25);
}

function layout(family, text, open) {
  const n = text.words.length,
    plain = text.words.map(w => w.variants[0]),
    space = WORD_SPACE * open.space,
    cache = new Map(),
    span = (a, b) => cache.get(a * 100 + b) ?? (cache.set(a * 100 + b, lineOf(plain.slice(a, b), space)), cache.get(a * 100 + b)), // prettier-ignore
    width = (a, b) => (span(a, b).c1 - span(a, b).c0 + 1) * CELL;
  // one pitch for the text: that of its words taken three to a line, which is about what a line holds
  const sample = [];
  for (let a = 0; a < n; a += 3) sample.push(span(a, Math.min(n, a + 3)));
  const pitch = Math.max(UP + DOWN * 0.5, pitchOf(sample, sample.map(L => -Math.round((L.c0 + L.c1 + 1) / 2))) * CELL) * open.pitch; // prettier-ignore
  for (let R = 10; R < 200; R *= 1.02) {
    let best = null;
    for (let m = 1; m <= Math.min(n, MAX_LINES); m++) {
      const hs = heights(family, m, pitch, R - MARGIN * NIB),
        lines = hs.map(h => FAMILIES[family](h, R)),
        rooms = lines.map(L => room(L, R - MARGIN * NIB));
      if (rooms.some(r => r <= 0)) continue;
      // the cut of the words into these m lines whose fullest line is least full
      const full = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(Infinity)),
        from = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(-1));
      full[0][0] = 0;
      for (let i = 1; i <= m; i++)
        for (let b = i; b <= n; b++)
          for (let a = i - 1; a < b; a++) {
            const f = Math.max(full[i - 1][a], width(a, b) / rooms[i - 1]);
            if (f < full[i][b]) {
              full[i][b] = f;
              from[i][b] = a;
            }
          }
      if (full[m][n] <= 1 && (!best || full[m][n] < best.full)) {
        const cut = [];
        for (let i = m, b = n; i > 0; i--) {
          cut.unshift([from[i][b], b]);
          b = from[i][b];
        }
        best = { full: full[m][n], cut, lines };
      }
    }
    if (!best) continue;
    const words = [];
    best.cut.forEach(([a, b], i) => {
      const L = span(a, b),
        mid = (L.c0 + L.c1 + 1) / 2;
      L.variants.forEach((v, k) => {
        const xm = (v.box.x0 + v.box.x1) / 2, // the word's middle, along its own line
          s = (L.at[k] - mid) * CELL + xm,
          [px, py] = best.lines[i].pt(s),
          ang = best.lines[i].ang(s);
        words.push({ variant: 0, x: px - xm * Math.cos(ang), y: py - xm * Math.sin(ang), rotate: (ang * 180) / Math.PI, scale: 1 }); // prettier-ignore
      });
    });
    const r2 = x => Math.round(x * 100) / 100;
    return { radius: r2(R * open.radius), lines: best.cut.length, words: words.map(w => ({ ...w, x: r2(w.x), y: r2(w.y), rotate: r2(w.rotate) })) }; // prettier-ignore
  }
  return null;
}
/** The kit's own check of one layout: is every word inside, and how much ink touches. */
function check(id, lay) {
  const dir = mkdtempSync(join(tmpdir(), 'curved-')),
    file = join(dir, 'p.json');
  writeFileSync(file, JSON.stringify({ entry: 'x', layouts: { [id]: lay } }));
  let out;
  try {
    out = execFileSync('node', [join(here, '../kit.mjs'), file, dir], { encoding: 'utf8' });
  } catch (e) {
    out = e.stdout;
  }
  return { inside: /inside yes/.test(out), touching: +(/touching ([\d.]+)/.exec(out)?.[1] ?? 99) };
}

const PRINCIPLES = {
  lens: 'Lines that bend as the circle does: straight through the middle, more bent towards the edge, so the outer lines lie along the rim.',
  bow: 'As lens, bent 2.4 times as much.',
  pinch: 'Lines that bow towards the centre, as a ruled sheet sags round a weight.',
  flow: 'The centre is left empty and the lines part to pass round it, as a stream passes a stone.',
};
for (const family of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FAMILIES)) {
  const layouts = {};
  for (const t of kit.texts) {
    const open = { space: 1, pitch: 1, radius: 1 };
    let lay = null,
      c = null;
    for (let tries = 0; tries < 30; tries++) {
      lay = layout(family, t, open);
      if (!lay) break;
      c = check(t.id, lay);
      if (c.inside && c.touching === 0) break;
      // out of the circle: a larger one; touching: wider spaces, along the line and between lines by turns
      if (!c.inside) open.radius *= 1.02;
      else if (tries % 2) open.pitch *= 1.05;
      else open.space *= 1.12;
    }
    if (!lay) {
      console.log(`${family} ${t.id}: no arrangement`);
      continue;
    }
    const { lines, ...rest } = lay;
    layouts[t.id] = rest;
    console.log(`${family} ${t.id}: ${lines} line${lines > 1 ? 's' : ''}, radius ${lay.radius} (${(lay.radius / NIB).toFixed(1)} nibs)${c.inside && c.touching === 0 ? '' : `  NOT CLEAN: inside ${c.inside}, touching ${c.touching}`}; spaces ×${open.space.toFixed(2)}, pitch ×${open.pitch.toFixed(2)}`); // prettier-ignore
  }
  writeFileSync(join(here, `${family}.json`), JSON.stringify({ entry: `curved-${family}`, principle: PRINCIPLES[family], reading: 'Start at the top line and read each line from right to left.', layouts }, null, 1) + '\n'); // prettier-ignore
}
