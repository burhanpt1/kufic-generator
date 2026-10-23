// Phase 6.8: fabrication outputs.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { centrelines, laserSVG, orderForPlotting, plotterSVG, reliefSVG } from '../src/fabricate';
import { preset } from '../src/model/presets';
import { aliAsgharComposition } from '../src/showpiece/aliAsghar';
import { U } from '../src/render/svg';
import { toPNG } from '../scripts/raster.mjs';
import { PNG } from 'pngjs';

const placed = resolve(preset('octagon-panel')),
  medallion = resolve(preset('fatimid-medallion'));
const bodyOf = (svg: string) => svg.replace(/<defs>[\s\S]*?<\/defs>/g, '');

describe('centrelines', () => {
  const ls = centrelines(placed);
  it('covers the outline, letters, marks, bands and patterns, inside the canvas', () => {
    const kinds = new Set(ls.map(l => l.kind));
    for (const k of ['outline', 'letter', 'mark', 'separator', 'pattern']) expect(kinds.has(k as never), k).toBe(true);
    const W = placed.canvas.w * U,
      H = placed.canvas.h * U;
    for (const l of ls)
      for (const [x, y] of l.pts) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(-1);
        expect(y).toBeGreaterThanOrEqual(-1);
        expect(x).toBeLessThanOrEqual(W + 1);
        expect(y).toBeLessThanOrEqual(H + 1);
      }
  });
  it('can leave patterns out', () => {
    expect(centrelines(placed, { patterns: false }).some(l => l.kind === 'pattern')).toBe(false);
  });
  it('plotting order cuts pen-up travel and keeps every line', () => {
    const naive = ls.reduce(
      (a, l, i) =>
        i ? a + Math.hypot(l.pts[0][0] - ls[i - 1].pts.at(-1)![0], l.pts[0][1] - ls[i - 1].pts.at(-1)![1]) : 0,
      0,
    );
    const o = orderForPlotting(ls);
    expect(o.lines.length).toBe(ls.length);
    expect(o.travel).toBeLessThan(naive * 0.5);
    expect(o.draw).toBeGreaterThan(0);
  });
});

describe('plotter SVG', () => {
  it('is stroke-only, in millimetres, one group per pen', () => {
    const svg = plotterSVG(placed, { widthMM: 300 });
    expect(svg).toMatch(/width="300mm"/);
    expect(svg).toMatch(/<g id="pen-letter"/);
    expect(svg).not.toMatch(/fill="(?!none)/);
  });
});

describe('laser SVG', () => {
  const svg = laserSVG(medallion);
  it('has named layers and a red cut outline', () => {
    for (const l of ['cut-outline', 'engrave-letters', 'score-bands']) expect(svg).toContain(`inkscape:label="${l}"`);
    expect(svg).toMatch(/<g data-layer="cut"[^>]*stroke="#ff0000"/);
  });
  it('engraves letters in black only and scores everything else in blue', () => {
    const body = bodyOf(svg),
      layers = body.split(/(?=<g data-layer=")/).slice(1);
    for (const part of layers) {
      const name = /data-layer="([a-z]+)"/.exec(part)![1];
      const colours = [...part.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map(m => m[1]);
      const allowed =
        name === 'letters'
          ? ['#000000', '#ffffff', 'none']
          : name === 'cut'
            ? ['#ff0000', 'none']
            : ['#0000ff', 'none'];
      for (const c of colours) expect(allowed, `${name}: ${c}`).toContain(c);
    }
  });
});

describe('relief', () => {
  it('uses only greys, letters highest and the floor black', async () => {
    const svg = reliefSVG(medallion),
      colours = [...bodyOf(svg).matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/g)].map(m => m[1]);
    for (const c of colours) expect(c.slice(1, 3) === c.slice(3, 5) && c.slice(3, 5) === c.slice(5, 7), c).toBe(true);
    const png = PNG.sync.read(await toPNG(svg));
    let hi = 0,
      lo = 255;
    for (let i = 0; i < png.data.length; i += 4) {
      hi = Math.max(hi, png.data[i]);
      lo = Math.min(lo, png.data[i]);
    }
    expect(hi).toBe(255);
    expect(lo).toBe(0);
  });
});

describe('a thuluth roundel on tiles (Ali Asghar)', () => {
  const ali = resolve(aliAsgharComposition('lapis', 'side')),
    rd = ali.items.find(i => i.type === 'roundel')!,
    [ox, oy] = ali.canvas.origin,
    [cx, cy] = [(ox + rd.centre[0]) * U, (oy + rd.centre[1]) * U];
  it('plots its letters (as outlines, or the pen centreline), marks and rim, and tiles only round it', () => {
    const ls = centrelines(ali),
      kinds = new Set(ls.map(l => l.kind));
    for (const k of ['letter', 'mark', 'rule', 'pattern']) expect(kinds.has(k as never), k).toBe(true);
    expect(ls.filter(l => l.kind === 'letter').every(l => l.closed)).toBe(true);
    // no tile line near the cartouche's centre
    const near = (l: (typeof ls)[0]) => l.pts.some(([x, y]) => Math.hypot(x - cx, y - cy) < rd.Rf * rd.s * U * 0.8);
    expect(ls.filter(l => l.kind === 'pattern').some(near)).toBe(false);
    const centre = centrelines(ali, { pen: 'centre', patterns: false });
    expect(centre.filter(l => l.kind === 'letter').some(l => !l.closed)).toBe(true);
    expect(centre.some(l => l.kind === 'pattern')).toBe(false);
  }, 60000);
  it('laser: engraves the letters, scores the rim and the tiles', () => {
    const svg = laserSVG(ali),
      layers = bodyOf(svg)
        .split(/(?=<g data-layer=")/)
        .slice(1);
    expect(svg).toContain('inkscape:label="score-tiles"');
    expect(layers.some(p => p.startsWith('<g data-layer="letters"') && p.includes(rd.ink.slice(0, 40)))).toBe(true);
    for (const part of layers) {
      const name = /data-layer="([a-z]+)"/.exec(part)![1],
        colours = [...part.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map(m => m[1]),
        allowed = name === 'letters' ? ['#000000', '#ffffff', 'none'] : name === 'cut' ? ['#ff0000', 'none'] : ['#0000ff', 'none']; // prettier-ignore
      for (const c of colours) expect(allowed, `${name}: ${c}`).toContain(c);
    }
  }, 60000);
  it('relief: the letters stand above the field, the field above the ground', () => {
    const svg = reliefSVG(ali);
    expect(svg).toContain(`fill="#ffffff" d="${rd.ink.slice(0, 40)}`);
    // the field at its own level, between the ground's and the letters'
    expect(svg).toMatch(/<ellipse [^>]*fill="#808080"/);
  }, 60000);
});
